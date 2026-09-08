"""Validate the candidate layout contract; does not certify terrain or gameplay."""
import argparse
import copy
import hashlib
import json
import math
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[2]
DEFAULT=ROOT/'godot/data/world-layout-v2.json'

def angle(a,b):
    la,lb=map(math.radians,[a['targetLat'],b['targetLat']])
    dl=math.radians(a['targetLon']-b['targetLon'])
    return math.degrees(math.acos(max(-1,min(1,math.sin(la)*math.sin(lb)+math.cos(la)*math.cos(lb)*math.cos(dl)))))
def max_lon_gap(rows):
    longs=sorted(r['targetLon']%360 for r in rows)
    return max([b-a for a,b in zip(longs,longs[1:])]+[longs[0]+360-longs[-1]])
def connected(routes,start,goal,modes=None):
    graph={}
    for r in routes:
        if modes and r['mode'] not in modes:continue
        graph.setdefault(r['from'],set()).add(r['to'])
        if r.get('bidirectional'):graph.setdefault(r['to'],set()).add(r['from'])
    seen={start};pending=[start]
    while pending:
        for nxt in graph.get(pending.pop(),()):
            if nxt not in seen:seen.add(nxt);pending.append(nxt)
    return goal in seen

def validate(data):
    errors=[]
    def check(condition,message):
        if not condition:errors.append(message)
    rows=data['regions'];routes=data['routes'];constraints=data['constraints'];ids=[r['id'] for r in rows];by={r['id']:r for r in rows}
    check(len(ids)==len(set(ids)),'duplicate region id')
    check(len({r['stableId'] for r in rows})==len(rows),'duplicate stableId')
    manifest_path=ROOT/data['provenance']['sourceManifest'];manifest=json.loads(manifest_path.read_text())
    check(hashlib.sha256(manifest_path.read_bytes()).hexdigest()==data['provenance']['sourceManifestSha256'],'source manifest changed; review candidate provenance')
    check(data['radius']==manifest['radius']==160,'original radius160 required')
    original=[r for r in rows if r['sourceLandmark']]
    check(all(r['sourceLandmark'] in manifest['landmarks'] for r in original),'unknown original landmark')
    check(all(r['preserveInternalDesign'] for r in rows),'local design preservation missing')
    for r in rows:
        check(constraints['latitudeRange'][0]<=r['targetLat']<=constraints['latitudeRange'][1],'latitude out of range '+r['id'])
        check(-180<=r['targetLon']<180,'longitude out of range '+r['id'])
        check(0<r['angularRadius']<=30,'invalid navigation radius '+r['id'])
        check(abs(r['targetLat'])+r['angularRadius']<=constraints['polarSettlementExclusionBeyondAbsLat'],'polar boundary consumed '+r['id'])
    quadrants={int((r['targetLon']+180)//90) for r in original}
    check(quadrants=={0,1,2,3},'original regions must occupy all four longitude quadrants')
    check(min(r['targetLat'] for r in original)<=-55 and max(r['targetLat'] for r in original)>=55,'original regions must span both hemispheres')
    check(max_lon_gap(original)<180,'original destinations leave an entire longitude hemisphere empty')
    check(max_lon_gap(rows)<=constraints['maximumEmptyLongitudeArcDegrees'],'candidate has unassigned longitude gap')
    pairs=[(angle(a,b),angle(a,b)-a['angularRadius']-b['angularRadius'],a['id'],b['id']) for i,a in enumerate(rows) for b in rows[i+1:]]
    check(min(x[0] for x in pairs)>=constraints['minimumCenterSeparationDegrees'],'region centres too close')
    check(min(x[1] for x in pairs)>=constraints['minimumPlanningBoundaryGapDegrees'],'navigation planning circles overlap')
    check(len({r['id'] for r in routes})==len(routes),'duplicate route id')
    check(all(r['from'] in by and r['to'] in by for r in routes),'route endpoint missing')
    story=sorted([r for r in routes if r['storyOrder'] is not None],key=lambda r:r['storyOrder'])
    check([r['storyOrder'] for r in story]==list(range(1,len(story)+1)),'story route order is not continuous')
    check(story and story[0]['from']=='coast-civil' and story[-1]['to']=='highland-sanctum','story start/end incorrect')
    check(all(a['to']==b['from'] for a,b in zip(story,story[1:])),'main story route disconnected')
    visited={r[k] for r in story for k in ('from','to')}
    check(set(constraints['mainStoryRegionIds'])<=visited,'required main story region omitted')
    check('mirror-lab' not in visited and by['mirror-lab']['mainStory'] is False,'mirror lab incorrectly counted in main story')
    check(all(r['mode']=='debug-transfer' for r in routes if 'mirror-lab' in (r['from'],r['to'])),'mirror lab leaks into production transport')
    check(connected(routes,'old-harbor','crystal-city',{'sea'}),'cross-civilization port sea network disconnected')
    check(connected(routes,'old-harbor','highland-sanctum',{'ground'}),'port lacks final land connection')
    check(connected(routes,'old-harbor','coast-civil',{'sea'}),'port lacks northern sea return')
    check(all(connected(routes,'coast-civil',r['id']) for r in rows if r['role']!='experimental'),'planned region graph disconnected')
    whale=[r for r in routes if r['mode']=='leviathan-migration']
    check(len(whale)==1,'one explicit dynamic whale route required')
    if whale:
        w=whale[0];points=w.get('waypoints',[])
        check(w.get('dynamic') and w.get('loop') and len(points)>=5,'whale route must be a moving loop')
        check(points and points[0]==points[-1],'whale path not closed')
        check(len({int((p['lon']+180)//90) for p in points})==4,'whale route does not use all longitude quadrants')
        check(all(-80<p['lat']<80 and -180<=p['lon']<180 for p in points),'invalid whale waypoint')
        check('live' in w.get('navigationAnchor',''),'whale navigation improperly uses fixed anchor')
    check(not constraints['randomOceanDecorationFill'] and not constraints['rebuildTerrainNow'],'candidate must not mutate terrain or spawn random ocean decoration')
    check(all(r['contentResponsibility'] for r in rows if not r['sourceLandmark']),'unassigned ocean/reserve content responsibility')
    return errors,{'regions':len(rows),'routes':len(routes),'originalLongitudeQuadrants':sorted(quadrants),'maximumLongitudeGap':max_lon_gap(rows),'minimumCenterDistance':min(pairs)[0],'minimumPlanningBoundaryGap':min(x[1] for x in pairs),'stage':'candidate data validation only; no terrain/mesh/gameplay acceptance'}

class RegressionTests(unittest.TestCase):
    def setUp(self):self.data=json.loads(DEFAULT.read_text())
    def test_candidate(self):self.assertEqual(validate(self.data)[0],[])
    def test_reject_hemisphere_packing(self):
        for r in self.data['regions']:r['targetLon']=abs(r['targetLon'])/2
        self.assertTrue(any('quadrant' in e or 'gap' in e for e in validate(self.data)[0]))
    def test_reject_disconnected_story(self):
        self.data['routes'][2]['from']='crystal-city'
        self.assertIn('main story route disconnected',validate(self.data)[0])
    def test_reject_mirror_as_story(self):
        self.data['routes'][0]['from']='mirror-lab'
        self.assertIn('mirror lab incorrectly counted in main story',validate(self.data)[0])
    def test_reject_static_whale(self):
        next(r for r in self.data['routes'] if r.get('dynamic'))['dynamic']=False
        self.assertIn('whale route must be a moving loop',validate(self.data)[0])
    def test_reject_lost_port_link(self):
        self.data['routes']=[r for r in self.data['routes'] if r['mode']!='sea']
        self.assertIn('cross-civilization port sea network disconnected',validate(self.data)[0])
    def test_reject_overlapping_regions(self):
        self.data['regions'][1].update(targetLat=self.data['regions'][0]['targetLat'],targetLon=self.data['regions'][0]['targetLon'])
        self.assertIn('region centres too close',validate(self.data)[0])

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--path',type=Path,default=DEFAULT);parser.add_argument('--self-test',action='store_true');args=parser.parse_args()
    if args.self_test:unittest.main(argv=['test_world_layout.py'])
    else:
        errors,metrics=validate(json.loads(args.path.read_text()));print(json.dumps({'passed':not errors,'errors':errors,**metrics},ensure_ascii=False,indent=2));raise SystemExit(bool(errors))
