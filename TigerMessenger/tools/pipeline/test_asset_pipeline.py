"""Temporary-directory contract tests; never edit the real asset queue."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from concurrent.futures import ThreadPoolExecutor
spec=importlib.util.spec_from_file_location('asset_pipeline',Path(__file__).with_name('asset_pipeline.py'))
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class PipelineTest(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        self.root=Path(self.temp.name);self.pipe=module.Pipeline(self.root)
        (self.root/'data').mkdir(); (self.root/'godot/data').mkdir(parents=True)
        assets=[]
        for aid in ['a','b','c']:
            (self.root/f'data/{aid}.json').write_text('{}')
            (self.root/f'data/{aid}.blend').write_bytes(b'fixture, not real Blender model')
            assets.append({'id':aid,'stableId':'tiger:'+aid,'label':aid,'family':aid,'source':{'snapshot':f'data/{aid}.json','blend':f'data/{aid}.blend'},'evidence':{}})
        (self.root/'godot/data/asset-registry.json').write_text(json.dumps({'assets':assets}))
        self.pipe.init()
        (self.root/'data/concept.png').write_bytes(b'fixture, not generated art')

    def concept(self,aid):
        lease=self.pipe.claim(aid,'concept worker','concepts')['lease']['id']
        self.pipe.record(aid,lease,'concept','data/concept.png',note='test fixture only')
        self.pipe.release(aid,lease)

    def test_archives_do_not_imply_optimization(self):
        status=self.pipe.status()
        self.assertEqual(status['evidenceCounts']['blend'],3)
        self.assertEqual(status['evidenceCounts']['candidate'],0)
        with self.assertRaises(ValueError):self.pipe.claim('a','worker','modeling')

    def test_concurrent_claim_only_one_winner(self):
        def attempt(worker):
            try:self.pipe.claim('a',worker,'concepts');return True
            except ValueError:return False
        with ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(attempt,['worker1','worker2']))
        self.assertEqual(sum(results),1)
        json.loads(self.pipe.path.read_text())

    def test_capacity_front_one_background_two(self):
        for aid in ['a','b','c']: self.concept(aid)
        lease=self.pipe.claim('a','front','modeling')['lease']['id']
        with self.assertRaises(ValueError):self.pipe.claim('b','second front','modeling')
        self.pipe.release('a',lease)
        self.pipe.claim('a','background1','modeling','archive')
        self.pipe.claim('b','background2','modeling','archive')
        with self.assertRaises(ValueError):self.pipe.claim('c','background3','modeling','archive')

    def test_missing_or_wrong_hash_evidence_cannot_advance(self):
        lease=self.pipe.claim('a','worker','concepts')['lease']['id']
        with self.assertRaises(ValueError):self.pipe.record('a',lease,'concept','absent.png',note='must fail')
        with self.assertRaises(ValueError):self.pipe.record('a',lease,'concept','data/concept.png',expected='0'*64,note='must fail')
        self.pipe.record('a',lease,failure='image service unavailable; no result')
        self.assertEqual(self.pipe.status()['evidenceCounts']['concept'],0)
        self.pipe.release('a',lease,'paused with failure checkpoint')
        with self.assertRaises(ValueError):self.pipe.record('a',lease,'concept','data/concept.png',note='old worker cannot mutate queue')

    def test_expiry_recovery_and_renewal(self):
        lease=self.pipe.claim('a','interrupted','concepts')['lease']['id']
        self.pipe.renew('a',lease,1200)
        with self.pipe.transaction() as data:data['assets'][0]['lease']['expiresAtEpoch']=0
        status=self.pipe.status()
        self.assertEqual(status['leases'],[])
        self.assertEqual(status['failures'],1)
        self.pipe.claim('a','replacement','concepts')
        with self.assertRaises(ValueError):self.pipe.renew('a',lease)

    def test_shared_family_and_original_blend_protected(self):
        with self.pipe.transaction() as data:data['assets'][1]['family']='a'
        token=self.pipe.claim('a','worker','concepts')['lease']['id']
        with self.assertRaises(ValueError):self.pipe.claim('b','other','concepts')
        self.pipe.release('a',token);self.concept('a')
        token=self.pipe.claim('a','modeler','modeling')['lease']['id']
        with self.assertRaises(ValueError):self.pipe.record('a',token,'candidate','data/a.blend',note='must keep original')
        self.assertEqual(self.pipe.status()['evidenceCounts']['candidate'],0)

    def test_upstream_revision_invalidates_candidate_without_deleting_it(self):
        self.concept('a')
        (self.root/'data/candidate.blend').write_bytes(b'new candidate fixture')
        token=self.pipe.claim('a','modeler','modeling')['lease']['id']
        self.pipe.record('a',token,'candidate','data/candidate.blend',note='candidate fixture')
        self.pipe.release('a',token)
        token=self.pipe.claim('a','concept revision','concepts')['lease']['id']
        (self.root/'data/concept-v2.png').write_bytes(b'new concept fixture')
        self.pipe.record('a',token,'concept','data/concept-v2.png',note='revised concept fixture')
        self.assertEqual(self.pipe.status()['evidenceCounts']['candidate'],0)
        self.assertTrue((self.root/'data/candidate.blend').exists())
        with self.pipe.transaction() as data:self.assertEqual(len(data['assets'][0]['stages']['candidate']['records']),1)

    def test_changed_source_hash_blocks_claim(self):
        (self.root/'data/a.blend').write_bytes(b'changed behind queue')
        with self.assertRaises(ValueError):self.pipe.claim('a','worker','concepts')

if __name__=='__main__':unittest.main()
