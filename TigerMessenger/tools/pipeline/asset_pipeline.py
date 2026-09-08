#!/usr/bin/env python3
"""Evidence-backed local asset queue; does not generate art or launch applications."""
import argparse
from contextlib import contextmanager
from datetime import datetime, timezone
import fcntl
import hashlib
import json
import os
from pathlib import Path
import tempfile
import time
import uuid

LANES = ('concepts', 'modeling', 'integration', 'validation')
FIELDS = ('source', 'blend', 'concept', 'candidate', 'godotResource', 'worldPlacement', 'behaviorEvidence', 'visualEvidence')
DOWNSTREAM = {'source': ('blend','concept','candidate','godotResource','worldPlacement','behaviorEvidence','visualEvidence'), 'blend': ('concept','candidate','godotResource','worldPlacement','behaviorEvidence','visualEvidence'), 'concept': ('candidate','godotResource','worldPlacement','behaviorEvidence','visualEvidence'), 'candidate': ('godotResource','worldPlacement','behaviorEvidence','visualEvidence'), 'godotResource': ('worldPlacement','behaviorEvidence','visualEvidence'), 'worldPlacement': ('behaviorEvidence','visualEvidence')}
ALLOWED = {'concepts': {'concept', 'visualEvidence'}, 'modeling:archive': {'source', 'blend'}, 'modeling:edit': {'candidate', 'visualEvidence'}, 'integration': {'godotResource', 'worldPlacement', 'behaviorEvidence', 'visualEvidence'}}

def now_text():
    return datetime.now(timezone.utc).isoformat()

class Pipeline:
    def __init__(self, root):
        self.root = Path(root).resolve()
        self.path = self.root / 'assets/pipeline/queue.json'

    @contextmanager
    def transaction(self):
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.with_suffix('.lock').open('a+') as lock:
            fcntl.flock(lock, fcntl.LOCK_EX)
            data = json.loads(self.path.read_text()) if self.path.exists() else {'version': 1, 'assets': [], 'events': []}
            original = json.dumps(data, sort_keys=True)
            self.recover(data)
            try:
                yield data
            finally:
                if json.dumps(data, sort_keys=True) != original:
                    data['updatedAt'] = now_text()
                    fd, temp = tempfile.mkstemp(prefix='.queue-', suffix='.json', dir=self.path.parent)
                    try:
                        with os.fdopen(fd, 'w') as stream:
                            json.dump(data, stream, ensure_ascii=False, indent=2)
                            stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
                        os.replace(temp, self.path)
                        directory_fd = os.open(self.path.parent, os.O_RDONLY)
                        try: os.fsync(directory_fd)
                        finally: os.close(directory_fd)
                    finally:
                        if os.path.exists(temp): os.unlink(temp)
                fcntl.flock(lock, fcntl.LOCK_UN)

    def recover(self, data):
        for asset in data['assets']:
            lease = asset.get('lease')
            if lease and lease['expiresAtEpoch'] <= time.time():
                asset['failures'].append({'at': now_text(), 'kind': 'lease-expired', 'worker': lease['worker'], 'lane': lease['lane'], 'message': 'Execution interrupted or lease not renewed; prior files and evidence retained.'})
                data['events'].append({'at': now_text(), 'event': 'lease-recovered', 'asset': asset['id'], 'lease': lease['id']})
                asset['lease'] = None

    def artifact(self, path, expected=None):
        path = Path(path)
        if not path.is_absolute(): path = self.root / path
        path = path.resolve()
        if not path.is_relative_to(self.root) or not path.is_file():
            raise ValueError('Artifact must be an existing file inside the project: ' + str(path))
        sha = hashlib.sha256()
        with path.open('rb') as stream:
            for chunk in iter(lambda: stream.read(1024*1024), b''): sha.update(chunk)
        digest = sha.hexdigest()
        if expected and expected.lower() != digest:
            raise ValueError('Artifact SHA256 mismatch')
        return {'path': str(path.relative_to(self.root)), 'sha256': digest, 'bytes': path.stat().st_size}

    def item(self, data, aid):
        row = next((a for a in data['assets'] if a['id'] == aid), None)
        if row is None: raise ValueError('Unknown asset: ' + aid)
        return row

    def init(self):
        registry = json.loads((self.root / 'godot/data/asset-registry.json').read_text())
        with self.transaction() as data:
            existing = {a['id'] for a in data['assets']}
            for src in registry['assets']:
                if src['id'] in existing:
                    self.item(data,src['id'])['label'] = src['label']
                    self.item(data,src['id']).setdefault('priorWorkHints',{'registryStages':src.get('stages',{}),'currentResource':src.get('currentResource'),'note':'Hints only; missing queue evidence does not mean prior work never happened.'})
                    continue
                aid, family = src['id'], src.get('family', src['id'])
                priority = {'scoutAircraft': 10, 'gatePodCraft': 20, 'vanguardTrooper': 30, 'romanSoldier': 40, 'citadelTrojanHorse': 50}.get(family, 200)
                if aid == 'bubblePod': priority = 150
                row = {'id': aid, 'stableId': src['stableId'], 'label': src['label'], 'family': family, 'variant': src.get('variant'), 'relationship': src.get('relationship'), 'priority': priority, 'queueScope': 'existing reference' if aid == 'bubblePod' else 'asset/configuration, not independent design count', 'stages': {f: {'state': 'pending', 'records': []} for f in FIELDS}, **{f: None for f in FIELDS}, 'lease': None, 'failures': [], 'placementRefs': src.get('placementRefs', [])}
                for field, path in [('source', src['source']['snapshot']), ('blend', src['source']['blend'])]:
                    evidence = self.artifact(path)
                    row[field] = evidence
                    row['stages'][field] = {'state': 'evidenced', 'records': [{'at': now_text(), 'artifact': evidence, 'note': 'Existing original archive; no optimization inferred.', 'origin': 'registry initialization'}]}
                # Import is a separate fact; it does not unlock optimized integration.
                verification_path = src.get('evidence', {}).get('godotInstantiation')
                if verification_path:
                    report = json.loads((self.root / verification_path).read_text())
                    proof = next((r for r in report.get('results', []) if r.get('id') == aid and r.get('passed')), None)
                    artifact = self.artifact('godot/' + src['archiveResource'].removeprefix('res://'))
                    if proof and proof.get('sha256') == artifact['sha256'] and proof.get('resource') == src['archiveResource']:
                        row['godotResource'] = artifact
                        row['stages']['godotResource'] = {'state': 'evidenced', 'records': [{'at': now_text(), 'artifact': artifact, 'evidence': [self.artifact(verification_path)], 'note': 'Original archive instantiated in Godot. No art optimization or world placement inferred.', 'origin': 'registry initialization'}]}
                row['priorWorkHints']={'registryStages':src.get('stages',{}),'currentResource':src.get('currentResource'),'note':'Hints only; missing queue evidence does not mean prior work never happened.'}
                data['assets'].append(row)
            data.update({'registry': 'godot/data/asset-registry.json', 'rules': {'foregroundModelingLimit': 1, 'backgroundArchiveLimit': 2, 'singleAssetLease': True, 'sharedFamilyLease': True, 'countWarning': 'Entries include variants and compound scenes; do not use entry count as completion percentage.', 'conceptExecution': 'Image workers record the actual provider, model revision and reference hash; this queue does not itself run inference.', 'terrain': 'Rebuild after priority asset and system integration batches.'}})
            return {'entries': len(data['assets']), 'initialized': True}

    def readiness(self, row, lane, mode, verify=False):
        if lane == 'modeling' and mode == 'archive': return None
        required = ['source', 'blend'] if lane in ('concepts', 'validation') else ['source', 'blend', 'concept'] if lane == 'modeling' else ['source', 'blend', 'concept', 'candidate']
        missing = [f for f in required if row['stages'][f]['state'] != 'evidenced']
        if missing:return 'Missing prerequisite evidence: ' + ', '.join(missing)
        if verify:
            for field in required:self.artifact(row[field]['path'],row[field]['sha256'])
        return None

    def conflict(self, data, row, lane, mode):
        live = [(a, a.get('lease')) for a in data['assets'] if a.get('lease')]
        for a, lease in live:
            if a['id'] == row['id'] or a['family'] == row['family']:
                return 'Asset/shared family held by ' + lease['worker']
        if lane == 'modeling':
            count = sum(l['lane'] == lane and l['mode'] == mode for _, l in live)
            if count >= (2 if mode == 'archive' else 1):
                return 'Blender lane capacity reached: ' + mode
        return None

    def claim(self, aid, worker, lane, mode='edit', ttl=1800):
        if lane not in LANES: raise ValueError('Unknown lane')
        if mode not in ('archive', 'edit') or (lane != 'modeling' and mode != 'edit'): raise ValueError('archive mode is only for modeling lane')
        if not worker.strip() or not 1 <= ttl <= 14400: raise ValueError('Worker required; TTL must be 1..14400 seconds')
        with self.transaction() as data:
            row = self.item(data, aid)
            error = self.readiness(row, lane, mode, verify=True) or self.conflict(data, row, lane, mode)
            if error: raise ValueError(error)
            lease = {'id': uuid.uuid4().hex, 'worker': worker, 'lane': lane, 'mode': mode, 'startedAt': now_text(), 'expiresAtEpoch': time.time()+ttl}
            row['lease'] = lease
            data['events'].append({'at': now_text(), 'event': 'claimed', 'asset': aid, **lease})
            return {'asset': aid, 'lease': lease}

    def owned(self, data, aid, token):
        row = self.item(data, aid)
        if not row.get('lease') or row['lease']['id'] != token: raise ValueError('Current lease token required; expired/released workers cannot write')
        return row

    def release(self, aid, token, reason='checkpoint saved'):
        with self.transaction() as data:
            row = self.owned(data, aid, token)
            data['events'].append({'at': now_text(), 'event': 'released', 'asset': aid, 'lease': token, 'reason': reason})
            row['lease'] = None
            return {'asset': aid, 'released': True, 'stagesUnchanged': True}

    def renew(self, aid, token, ttl=1800):
        if not 1 <= ttl <= 14400: raise ValueError('TTL must be 1..14400 seconds')
        with self.transaction() as data:
            row = self.owned(data, aid, token)
            row['lease']['expiresAtEpoch'] = time.time()+ttl
            return {'asset': aid, 'lease': row['lease']}

    def record(self, aid, token, stage=None, path=None, expected=None, note='', evidence=(), failure=None):
        with self.transaction() as data:
            row = self.owned(data, aid, token)
            if failure:
                row['failures'].append({'at': now_text(), 'kind': 'execution-failed', 'message': failure, 'lease': token})
                return {'asset': aid, 'failureRecorded': True, 'stagesUnchanged': True}
            lease = row['lease']; key = 'modeling:'+lease['mode'] if lease['lane']=='modeling' else lease['lane']
            if key == 'validation': raise ValueError('Validation leases record job reports, not asset acceptance stages')
            prerequisite_error=self.readiness(row,lease['lane'],lease['mode'],verify=True)
            if prerequisite_error:raise ValueError(prerequisite_error)
            if stage not in ALLOWED[key]: raise ValueError('Stage is not writable in this lane/mode')
            if not path or not note.strip(): raise ValueError('Artifact path and a truthful evidence note are required')
            artifact = self.artifact(path, expected)
            extensions = {'blend': {'.blend'}, 'concept': {'.png','.jpg','.jpeg','.webp'}, 'candidate': {'.blend'}, 'godotResource': {'.glb','.gltf','.tscn','.scn'}}
            if stage in extensions and Path(artifact['path']).suffix.lower() not in extensions[stage]: raise ValueError('Artifact type does not match stage')
            if stage == 'candidate' and artifact['path'] == row['blend']['path']: raise ValueError('Candidate must be a separate Blender copy, not original archive')
            needed={'worldPlacement':'godotResource','behaviorEvidence':'worldPlacement'}.get(stage)
            if needed and row['stages'][needed]['state']!='evidenced':raise ValueError('Record current '+needed+' evidence first')
            references = [self.artifact(p) for p in evidence]
            input_hashes={f:row[f]['sha256'] for f in FIELDS if row.get(f) and row['stages'][f]['state']=='evidenced' and f!=stage}
            changed=row.get(stage) is None or row[stage]['sha256']!=artifact['sha256']
            if changed:
                for dependent in DOWNSTREAM.get(stage,()):
                    row['stages'][dependent]['state']='pending'
                    row['stages'][dependent]['pendingReason']='Upstream '+stage+' changed; previous artifact/history retained for review.'
            record = {'inputHashes':input_hashes, 'at': now_text(), 'artifact': artifact, 'evidence': references, 'note': note, 'worker': lease['worker'], 'lease': token}
            row[stage] = artifact
            row['stages'][stage]['state'] = 'evidenced'
            row['stages'][stage]['records'].append(record)
            data['events'].append({'at': now_text(), 'event': 'evidence-recorded', 'asset': aid, 'stage': stage, 'sha256': artifact['sha256']})
            return {'asset': aid, 'stage': stage, 'state': 'evidenced', 'artifact': artifact, 'acceptance': 'Evidence recorded; artistic/gameplay acceptance is not inferred.'}

    def next(self, lane, mode='edit', limit=5):
        if lane == 'validation':
            return {'lane': lane, 'suggestions': [], 'reserved': False, 'note': 'Validation jobs are explicitly selected from a job catalog, not inferred from missing art stages.'}
        with self.transaction() as data:
            target = 'concept' if lane == 'concepts' else 'blend' if mode == 'archive' else 'candidate' if lane == 'modeling' else 'behaviorEvidence'
            candidates = [a for a in sorted(data['assets'], key=lambda a:(a['priority'],a['id'])) if a['stages'][target]['state']=='pending' and not a.get('priorWorkHints',{}).get('registryStages',{}).get('artOptimized',False) and not self.readiness(a,lane,mode) and not self.conflict(data,a,lane,mode)]
            # Show one representative per shared family; family variants remain linked.
            seen = set(); rows=[]
            for a in candidates:
                if a['family'] in seen: continue
                seen.add(a['family']); rows.append({k:a[k] for k in ('id','label','family','priority','variant')})
                if len(rows)>=limit: break
            return {'lane': lane, 'mode': mode, 'suggestions': rows, 'reserved': False, 'backfillPriorWorkFirst':[a['id'] for a in data['assets'] if a.get('priorWorkHints',{}).get('registryStages',{}).get('artOptimized',False) and a['stages'][target]['state']=='pending']}

    def status(self):
        with self.transaction() as data:
            return {'entries':len(data['assets']), 'warning':'Not a completion percentage: variants and compound scenes overlap.', 'evidenceCounts':{f:sum(a['stages'][f]['state']=='evidenced' for a in data['assets']) for f in FIELDS}, 'leases':[{'asset':a['id'],**a['lease']} for a in data['assets'] if a.get('lease')], 'failures':sum(len(a['failures']) for a in data['assets']), 'execution':'Queue tracks work; workers explicitly run image generation, Blender MCP and Godot.'}

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root',default=str(Path(__file__).resolve().parents[2]))
    commands=parser.add_subparsers(dest='command',required=True)
    for name in ('init','status'): commands.add_parser(name)
    claim=commands.add_parser('claim'); claim.add_argument('asset'); claim.add_argument('--worker',required=True); claim.add_argument('--lane',choices=LANES,required=True); claim.add_argument('--mode',choices=['edit','archive'],default='edit'); claim.add_argument('--ttl',type=int,default=1800)
    release=commands.add_parser('release'); release.add_argument('asset'); release.add_argument('--lease',required=True); release.add_argument('--reason',default='checkpoint saved')
    renew=commands.add_parser('renew'); renew.add_argument('asset'); renew.add_argument('--lease',required=True); renew.add_argument('--ttl',type=int,default=1800)
    record=commands.add_parser('record'); record.add_argument('asset'); record.add_argument('--lease',required=True); record.add_argument('--stage',choices=FIELDS); record.add_argument('--artifact'); record.add_argument('--sha256'); record.add_argument('--note',default=''); record.add_argument('--evidence',action='append',default=[]); record.add_argument('--failure')
    next_cmd=commands.add_parser('next'); next_cmd.add_argument('--lane',choices=LANES,required=True); next_cmd.add_argument('--mode',choices=['edit','archive'],default='edit'); next_cmd.add_argument('--limit',type=int,default=5)
    args=parser.parse_args();pipe=Pipeline(args.root)
    try:
        if args.command in ('init','status'): result=getattr(pipe,args.command)()
        elif args.command=='claim': result=pipe.claim(args.asset,args.worker,args.lane,args.mode,args.ttl)
        elif args.command=='release': result=pipe.release(args.asset,args.lease,args.reason)
        elif args.command=='renew': result=pipe.renew(args.asset,args.lease,args.ttl)
        elif args.command=='record': result=pipe.record(args.asset,args.lease,args.stage,args.artifact,args.sha256,args.note,args.evidence,args.failure)
        else: result=pipe.next(args.lane,args.mode,args.limit)
        print(json.dumps(result,ensure_ascii=False,indent=2))
    except (ValueError,OSError,KeyError) as error:
        parser.exit(1,'PIPELINE_ERROR: '+str(error)+'\n')

if __name__=='__main__': main()
