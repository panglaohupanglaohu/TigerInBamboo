"""Persistent, bounded execution of reviewed local job catalogs.

Catalogs are trusted project code, never model-generated shell instructions.
Reports do not promote an asset's visual or gameplay acceptance stages.
"""
from __future__ import annotations

import argparse
from contextlib import contextmanager
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import signal
import subprocess
import sys
import tempfile
import time
import uuid

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from asset_pipeline import Pipeline


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def atomic_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, temp = tempfile.mkstemp(prefix='.checkpoint-', dir=path.parent)
    try:
        with os.fdopen(fd, 'w') as stream:
            json.dump(data, stream, ensure_ascii=False, indent=2)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)


@contextmanager
def locked(path):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('a+') as stream:
        fcntl.flock(stream, fcntl.LOCK_EX | fcntl.LOCK_NB)
        try:
            yield
        finally:
            fcntl.flock(stream, fcntl.LOCK_UN)


def inside(root, path):
    resolved = (root / path).resolve()
    if not resolved.is_relative_to(root):
        raise ValueError('Path outside project')
    return resolved


def inputs_for(root, job):
    result = {}
    for name in job['inputs']:
        path = inside(root, name)
        if not path.exists():
            raise ValueError('Missing job input: ' + name)
        files = sorted(path.rglob('*')) if path.is_dir() else [path]
        for file in files:
            # Engine caches do not describe source inputs.
            if file.is_file() and not {'.godot', '__pycache__'}.intersection(file.relative_to(root).parts):
                resolved = inside(root, str(file.relative_to(root)))
                result[str(file.relative_to(root))] = digest(resolved)
    if not result:
        raise ValueError('Job requires nonempty inputs')
    return result


def validate_catalog(data):
    if data.get('version') != 1 or not isinstance(data.get('jobs'), list):
        raise ValueError('Invalid catalog')
    seen = set()
    for job in data['jobs']:
        jid = job.get('id')
        if not isinstance(jid, str) or not re.fullmatch(r'[a-zA-Z0-9_-]+', jid) or jid in seen:
            raise ValueError('Invalid/duplicate job id')
        seen.add(jid)
        for field in ('inputs', 'argv', 'expected_reports'):
            values = job.get(field)
            if not isinstance(values, list) or not values or not all(isinstance(v, str) and v for v in values):
                raise ValueError('Invalid ' + field)
        if not isinstance(job.get('expected_artifacts', []), list) or not all(isinstance(v, str) and v for v in job.get('expected_artifacts', [])):
            raise ValueError('Invalid expected_artifacts')
        if not job.get('asset_id') and not job.get('world_placement'):
            raise ValueError('Job needs an actual asset or world placement')
        if not 1 <= job.get('timeout_seconds', 120) <= 1800:
            raise ValueError('Timeout outside 1..1800 seconds')
        if not re.fullmatch(r'[a-zA-Z0-9_-]+', job.get('resource_lock', 'local')):
            raise ValueError('Invalid resource lock')
    return data['jobs']


def load_catalogs(paths):
    jobs = []
    for path in paths:
        jobs.extend(validate_catalog(json.loads(Path(path).read_text())))
    merged = {'version': 1, 'jobs': jobs}
    validate_catalog(merged)
    return merged


def check_report(data, criteria):
    if data.get('passed') is not True:
        raise ValueError('Report did not pass')
    for key, expected in criteria.get('report_equals', {}).items():
        if key not in data or data[key] != expected or type(data[key]) is not type(expected):
            raise ValueError('Report criterion failed: ' + key)
    regression = data.get('result', {})
    for key, expected in criteria.get('regression', {}).items():
        match = re.fullmatch(r'(.+)_(lt|gt|gte|lte)', key)
        if match:
            field, op = match.groups()
            actual = regression.get(field)
            if isinstance(actual, bool) or not isinstance(actual, (int, float)):
                raise ValueError('Missing numeric criterion: ' + field)
            valid = {'lt': actual < expected, 'gt': actual > expected,
                     'gte': actual >= expected, 'lte': actual <= expected}[op]
        else:
            valid = key in regression and regression[key] == expected and type(regression[key]) is type(expected)
        if not valid:
            raise ValueError('Regression criterion failed: ' + key)


class Runner:
    def __init__(self, root, catalog):
        self.root = Path(root).resolve()
        self.jobs = validate_catalog(catalog)
        self.folder = self.root / 'assets/pipeline/local-runs'
        self.state_path = self.folder / 'state.json'
        self.pipeline = Pipeline(self.root)

    def load(self):
        return json.loads(self.state_path.read_text()) if self.state_path.exists() else {'version': 1, 'jobs': {}}

    def save(self, state):
        state['updated_at'] = time.time()
        atomic_json(self.state_path, state)

    def current_pass(self, previous, fingerprint):
        if previous.get('status') != 'passed' or previous.get('fingerprint') != fingerprint:
            return False
        records = previous.get('reports', {})
        artifacts = previous.get('artifacts', {})
        return bool(records) and all(inside(self.root, p).is_file() and digest(inside(self.root, p)) == h for p, h in {**records, **artifacts}.items())

    def run(self, selected=None):
        # A second scheduler observes busy instead of launching duplicate work.
        with locked(self.folder / 'runner.lock'):
            state = self.load()
            results = []
            for job in self.jobs:
                if selected and job['id'] not in selected:
                    continue
                try:
                    results.append(self.run_job(state, job))
                except (ValueError, RuntimeError, OSError) as exc:
                    # One missing input or orphan cannot halt other families.
                    results.append({'id': job['id'], 'status': 'blocked', 'reason': str(exc)[:300]})
            return results

    def run_job(self, state, job):
        jid = job['id']
        previous = state['jobs'].get(jid, {})
        if previous.get('lease') and previous.get('status') != 'running':
            self.recover_process(previous)
            self.release_previous(job, previous)
            self.save(state)
        inputs = inputs_for(self.root, job)
        signature = {'inputs': inputs, 'job': job, 'runner_sha256': digest(Path(__file__))}
        fingerprint = hashlib.sha256(json.dumps(signature, sort_keys=True).encode()).hexdigest()
        if self.current_pass(previous, fingerprint):
            return {'id': jid, 'status': 'cached_pass', 'visual_approved': False}
        history = previous.get('history', [])
        failures = [a for a in history if a.get('fingerprint') == fingerprint and a.get('status') in ('failed', 'interrupted')]
        if previous.get('status') == 'running':
            # Previous process died; first reap its known process group before retrying.
            self.recover_process(previous)
            self.release_previous(job, previous)
            previous['status'] = 'interrupted'
            if history:
                history[-1]['status'] = 'interrupted'
            failures = [a for a in history if a.get('fingerprint') == fingerprint and a.get('status') in ('failed', 'interrupted')]
            self.save(state)
        if len(failures) >= 2:
            previous['status'] = 'needs_review'
            self.save(state)
            return {'id': jid, 'status': 'needs_review', 'reason': 'two_failed_attempts_for_same_inputs'}
        try:
            with locked(self.folder / (job.get('resource_lock', 'local') + '.lock')):
                return self.execute(state, job, inputs, fingerprint, history)
        except BlockingIOError:
            return {'id': jid, 'status': 'resource_busy'}

    def release_previous(self, job, previous):
        token = previous.get('lease')
        if token and job.get('asset_id'):
            try:
                self.pipeline.release(job['asset_id'], token, 'Dead/completed validation worker reconciled')
            except ValueError:
                pass  # Token replaced/expired: do not touch the current owner.
        previous['lease'] = None

    def recover_process(self, previous):
        # A PID can be reused after a crash. Never kill an unverified stale PID.
        # With the runner lock gone, children are conservatively treated as
        # needing review if the recorded process group still exists.
        pid = previous.get('pid')
        if pid:
            try:
                os.killpg(pid, 0)
            except ProcessLookupError:
                return
            raise RuntimeError('Prior worker group still exists; inspect before resuming')

    def execute(self, state, job, inputs, fingerprint, history):
        jid = job['id']
        run_dir = self.root / 'artifacts/pipeline/local-runs' / jid / uuid.uuid4().hex
        run_dir.mkdir(parents=True)
        lease = None
        if job.get('asset_id'):
            try:
                lease = self.pipeline.claim(job['asset_id'], 'local-runner:' + jid, 'validation', ttl=int(job.get('timeout_seconds', 120)) + 120)['lease']['id']
            except ValueError as exc:
                return {'id': jid, 'status': 'queue_blocked', 'reason': str(exc)}
        attempt = {'started_at': time.time(), 'fingerprint': fingerprint, 'status': 'running', 'run_dir': str(run_dir.relative_to(self.root))}
        history.append(attempt)
        current = {'status': 'running', 'fingerprint': fingerprint, 'history': history, 'lease': lease, 'reports': {}, 'artifacts': {}}
        state['jobs'][jid] = current
        proc = None
        try:
            self.save(state)
            atomic_json(run_dir / 'inputs.json', inputs)
            expand = lambda s: s.replace('{run_dir}', str(run_dir))
            argv = [expand(s) for s in job['argv']]
            cwd = inside(self.root, job.get('cwd', '.'))
            with (run_dir / 'worker.log').open('w') as log:
                proc = subprocess.Popen(argv, cwd=cwd, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
                current['pid'] = proc.pid
                self.save(state)
                proc.wait(timeout=job.get('timeout_seconds', 120))
            if proc.returncode != job.get('success_criteria', {}).get('exit_code', 0):
                raise RuntimeError('Worker exit code: ' + str(proc.returncode))
            records = {}
            for name in job['expected_reports']:
                path = inside(self.root, expand(name))
                if not path.is_relative_to(run_dir):
                    raise ValueError('Output report must belong to this new run directory')
                check_report(json.loads(path.read_text()), job.get('success_criteria', {}))
                records[str(path.relative_to(self.root))] = digest(path)
            artifacts = {}
            for name in job.get('expected_artifacts', []):
                path = inside(self.root, expand(name))
                if not path.is_relative_to(run_dir) or not path.is_file() or path.stat().st_size == 0:
                    raise ValueError('Output artifact must be nonempty and belong to this run')
                artifacts[str(path.relative_to(self.root))] = digest(path)
            if inputs_for(self.root, job) != inputs:
                raise ValueError('Inputs changed during execution; evidence stale')
            current['status'] = attempt['status'] = 'passed'
            current['reports'] = records
            current['artifacts'] = artifacts
        except BaseException as exc:
            current['status'] = attempt['status'] = 'interrupted' if isinstance(exc, (KeyboardInterrupt, SystemExit)) else 'failed'
            attempt['error'] = type(exc).__name__ + ': ' + str(exc)[:300]
            if proc is not None:
                self.stop_group(proc)
            if isinstance(exc, (KeyboardInterrupt, SystemExit)):
                raise
        finally:
            if proc is not None:
                # Also remove background descendants after a wrapper exited.
                self.stop_group(proc)
            current.pop('pid', None)
            attempt['finished_at'] = time.time()
            atomic_json(run_dir / 'execution.json', {'job_id': jid, **attempt, 'reports': current['reports'], 'artifacts': current['artifacts'], 'visual_approved': False})
            self.save(state)
            if lease:
                try:
                    self.pipeline.release(job['asset_id'], lease, 'Validation job ' + current['status'] + '; no art stage promotion')
                except ValueError:
                    pass  # Expired leases cannot be written by this worker.
                current['lease'] = None
                self.save(state)
        return {'id': jid, 'status': current['status'], 'run_dir': str(run_dir.relative_to(self.root)), 'visual_approved': False}

    @staticmethod
    def stop_group(proc):
        try:
            os.killpg(proc.pid, signal.SIGTERM)
        except ProcessLookupError:
            pass
        try:
            proc.wait(timeout=2)
        except subprocess.TimeoutExpired:
            pass
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        proc.wait()


def main():
    def terminated(signum, frame):
        raise SystemExit(128 + signum)
    signal.signal(signal.SIGTERM, terminated)
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', default=str(Path(__file__).resolve().parents[3]))
    parser.add_argument('--catalog', required=True, action='append')
    parser.add_argument('--job', action='append')
    parser.add_argument('--run', action='store_true')
    args = parser.parse_args()
    if not args.run:
        parser.error('--run required to execute the reviewed catalog')
    runner = Runner(args.root, load_catalogs(args.catalog))
    if args.job and set(args.job) - {j['id'] for j in runner.jobs}:
        parser.error('Unknown selected job')
    try:
        results = runner.run(set(args.job) if args.job else None)
    except BlockingIOError:
        results = [{'status': 'runner_busy'}]
    print(json.dumps(results, ensure_ascii=False, indent=2))
    return 0 if all(r['status'] in ('passed', 'cached_pass') for r in results) else 1


if __name__ == '__main__':
    raise SystemExit(main())
