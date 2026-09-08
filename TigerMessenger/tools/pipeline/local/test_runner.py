"""Execution evidence, invalidation, locks and failure recovery without engines."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import tempfile
import time
import unittest

from runner import Runner, atomic_json, locked, validate_catalog, load_catalogs


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'input.txt').write_text('original')
        self.job = {
            'id': 'fixture', 'asset_id': None, 'world_placement': 'fixture-world',
            'inputs': ['input.txt'], 'argv': [sys.executable, '-c',
                "import json,sys;open(sys.argv[1],'w').write(json.dumps({'passed':True,'visual_approved':False}))",
                '{run_dir}/report.json'],
            'expected_reports': ['{run_dir}/report.json'], 'cwd': '.',
            'timeout_seconds': 2, 'resource_lock': 'fixture',
            'success_criteria': {'report_equals': {'visual_approved': False}},
        }

    def runner(self):
        return Runner(self.root, {'version': 1, 'jobs': [self.job]})

    def test_pass_resume_and_input_invalidation(self):
        r = self.runner()
        self.assertEqual(r.run()[0]['status'], 'passed')
        self.assertEqual(r.run()[0]['status'], 'cached_pass')
        (self.root / 'input.txt').write_text('changed')
        self.assertEqual(r.run()[0]['status'], 'passed')
        self.assertEqual(len(r.load()['jobs']['fixture']['history']), 2)

    def test_merge_catalogs_and_reject_duplicate_job_ids(self):
        first, second = self.root / 'first.json', self.root / 'second.json'
        atomic_json(first, {'version': 1, 'jobs': [self.job]})
        atomic_json(second, {'version': 1, 'jobs': [dict(self.job, id='second')]})
        self.assertEqual(len(load_catalogs([first, second])['jobs']), 2)
        with self.assertRaisesRegex(ValueError, 'duplicate'):
            load_catalogs([first, first])

    def test_corrupted_evidence_reexecutes(self):
        r = self.runner()
        r.run()
        record = r.load()['jobs']['fixture']
        (self.root / next(iter(record['reports']))).write_text('{}')
        self.assertEqual(r.run()[0]['status'], 'passed')

    def test_export_artifact_corruption_invalidates_cache(self):
        self.job['expected_artifacts'] = ['{run_dir}/candidate.glb']
        self.job['argv'][2] += ";from pathlib import Path;Path(sys.argv[1]).with_name('candidate.glb').write_bytes(b'fixture')"
        r = self.runner()
        self.assertEqual(r.run()[0]['status'], 'passed')
        self.assertEqual(r.run()[0]['status'], 'cached_pass')
        artifact = next(iter(r.load()['jobs']['fixture']['artifacts']))
        (self.root / artifact).write_bytes(b'corrupted')
        self.assertEqual(r.run()[0]['status'], 'passed')

    def test_failed_report_stops_after_two_attempts(self):
        self.job['argv'][2] = self.job['argv'][2].replace("'passed':True", "'passed':False")
        r = self.runner()
        self.assertEqual(r.run()[0]['status'], 'failed')
        self.assertEqual(r.run()[0]['status'], 'failed')
        self.assertEqual(r.run()[0]['status'], 'needs_review')
        self.assertEqual(len(r.load()['jobs']['fixture']['history']), 2)

    def test_exit_zero_with_missing_report_fails(self):
        self.job['argv'][2] = 'pass'
        self.assertEqual(self.runner().run()[0]['status'], 'failed')

    def test_input_mutation_during_worker_rejected(self):
        self.job['argv'][2] += ";open('input.txt','w').write('worker mutation')"
        self.assertEqual(self.runner().run()[0]['status'], 'failed')

    def test_timeout_and_next_independent_job(self):
        self.job['argv'][2] = 'import time;time.sleep(30)'
        self.job['timeout_seconds'] = 1
        good = dict(self.job, id='second', argv=[sys.executable, '-c',
            "import json,sys;open(sys.argv[1],'w').write(json.dumps({'passed':True,'visual_approved':False}))",
            '{run_dir}/report.json'])
        r = Runner(self.root, {'version': 1, 'jobs': [self.job, good]})
        self.assertEqual([v['status'] for v in r.run()], ['failed', 'passed'])

    def test_single_runner_lock(self):
        r = self.runner()
        with locked(r.folder / 'runner.lock'):
            with self.assertRaises(BlockingIOError):
                r.run()

    def test_resource_lock(self):
        r = self.runner()
        with locked(r.folder / 'fixture.lock'):
            self.assertEqual(r.run()[0]['status'], 'resource_busy')

    def test_directory_hash_excludes_engine_cache(self):
        (self.root / 'source').mkdir()
        (self.root / 'source/code.gd').write_text('a')
        cache = self.root / 'source/.godot'
        cache.mkdir()
        (cache / 'cache').write_text('one')
        self.job['inputs'] = ['source']
        r = self.runner()
        r.run()
        (cache / 'cache').write_text('two')
        self.assertEqual(r.run()[0]['status'], 'cached_pass')
        (self.root / 'source/code.gd').write_text('b')
        self.assertEqual(r.run()[0]['status'], 'passed')

    def test_report_type_and_regression_criteria(self):
        self.job['success_criteria']['report_equals']['passed'] = 1
        self.assertEqual(self.runner().run()[0]['status'], 'failed')

    def test_no_old_external_report_as_new_evidence(self):
        (self.root / 'old.json').write_text('{"passed":true}')
        self.job['expected_reports'] = ['old.json']
        self.assertEqual(self.runner().run()[0]['status'], 'failed')

    def test_interrupted_dead_worker_resumes(self):
        r = self.runner()
        r.run()
        data = r.load()
        data['jobs']['fixture']['status'] = 'running'
        data['jobs']['fixture']['history'][-1]['status'] = 'running'
        data['jobs']['fixture'].pop('pid', None)
        r.save(data)
        self.assertEqual(r.run()[0]['status'], 'passed')
        self.assertEqual(r.load()['jobs']['fixture']['history'][0]['status'], 'interrupted')

    def test_validation_lease_does_not_promote_asset(self):
        from asset_pipeline import Pipeline
        pipe = Pipeline(self.root)
        source = pipe.artifact('input.txt')
        row = {'id': 'asset', 'family': 'family', 'lease': None, 'failures': [],
               'source': source, 'blend': source,
               'stages': {'source': {'state': 'evidenced'}, 'blend': {'state': 'evidenced'}, 'candidate': {'state': 'pending'}}}
        atomic_json(pipe.path, {'version': 1, 'assets': [row], 'events': []})
        self.job['asset_id'] = 'asset'
        r = self.runner()
        self.assertEqual(r.run()[0]['status'], 'passed')
        updated = json.loads(pipe.path.read_text())['assets'][0]
        self.assertIsNone(updated['lease'])
        self.assertEqual(updated['stages']['candidate']['state'], 'pending')
        token = pipe.claim('asset', 'test', 'validation')['lease']['id']
        with self.assertRaisesRegex(ValueError, 'not asset acceptance'):
            pipe.record('asset', token, stage='candidate', path='input.txt', note='invalid promotion')

    def test_recovery_releases_own_lease_and_cached_completion_lease(self):
        from asset_pipeline import Pipeline
        pipe = Pipeline(self.root)
        source = pipe.artifact('input.txt')
        row = {'id': 'asset', 'family': 'family', 'lease': None, 'failures': [], 'source': source, 'blend': source,
               'stages': {'source': {'state': 'evidenced'}, 'blend': {'state': 'evidenced'}}}
        atomic_json(pipe.path, {'version': 1, 'assets': [row], 'events': []})
        self.job['asset_id'] = 'asset'
        r = self.runner()
        r.run()
        for old_status in ('running', 'passed'):
            token = pipe.claim('asset', 'local-runner:fixture', 'validation')['lease']['id']
            data = r.load()
            data['jobs']['fixture'].update(status=old_status, lease=token)
            if old_status == 'running':
                data['jobs']['fixture']['history'][-1]['status'] = 'running'
            r.save(data)
            result = r.run()[0]['status']
            self.assertEqual(result, 'passed' if old_status == 'running' else 'cached_pass')
            self.assertIsNone(json.loads(pipe.path.read_text())['assets'][0]['lease'])

    def test_sigterm_cleans_worker_and_saves_interruption(self):
        self.job['argv'][2] = 'import time;time.sleep(30)'
        self.job['timeout_seconds'] = 60
        catalog = self.root / 'jobs.json'
        atomic_json(catalog, {'version': 1, 'jobs': [self.job]})
        proc = subprocess.Popen([sys.executable, str(Path(__file__).with_name('runner.py')),
                                 '--root', str(self.root), '--catalog', str(catalog), '--run'],
                                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        child = None
        try:
            deadline = time.monotonic() + 5
            while time.monotonic() < deadline:
                state = self.runner().load()
                child = state['jobs'].get('fixture', {}).get('pid')
                if child:
                    break
                time.sleep(.02)
            self.assertIsNotNone(child)
            proc.terminate()
            self.assertEqual(proc.wait(timeout=5), 143)
            self.assertEqual(self.runner().load()['jobs']['fixture']['status'], 'interrupted')
            with self.assertRaises(ProcessLookupError):
                os.killpg(child, 0)
        finally:
            if proc.poll() is None:
                proc.kill()
                proc.wait()
            if child:
                try:
                    os.killpg(child, signal.SIGKILL)
                except ProcessLookupError:
                    pass

    def test_validation_obeys_existing_family_lock(self):
        from asset_pipeline import Pipeline
        pipe = Pipeline(self.root)
        source = pipe.artifact('input.txt')
        row = {'id': 'asset', 'family': 'family', 'lease': None, 'failures': [], 'source': source, 'blend': source,
               'stages': {'source': {'state': 'evidenced'}, 'blend': {'state': 'evidenced'}}}
        atomic_json(pipe.path, {'version': 1, 'assets': [row], 'events': []})
        pipe.claim('asset', 'other', 'validation')
        self.job['asset_id'] = 'asset'
        self.assertEqual(self.runner().run()[0]['status'], 'queue_blocked')


if __name__ == '__main__':
    unittest.main()
