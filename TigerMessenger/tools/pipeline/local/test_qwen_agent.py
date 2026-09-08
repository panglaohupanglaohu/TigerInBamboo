"""Offline HTTP/tool roundtrips; validation and Blender calls are stubbed."""
from contextlib import contextmanager, redirect_stdout
import base64
import copy
import hashlib
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import io
from pathlib import Path
import subprocess
import sys
import tempfile
import threading
import unittest
from unittest.mock import patch

from qwen_agent import MAX_IMAGE_BYTES, main, run_agent


def call(name, arguments, cid='call_1'):
    return {'id': cid, 'type': 'function', 'function': {'name': name, 'arguments': json.dumps(arguments)}}


def assistant(calls=None, text=None):
    message = {'role': 'assistant', 'content': text}
    if calls is not None:
        message['tool_calls'] = calls
    return {'choices': [{'message': message}]}


@contextmanager
def fake_endpoint(replies, models=None):
    requests = []
    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *args):
            pass
        def do_GET(self):
            requests.append(('GET', self.path, None))
            self.respond({'data': [{'id': 'fixture-qwen'}]} if models is None else models)
        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers['Content-Length'])))
            requests.append(('POST', self.path, body))
            self.respond(replies.pop(0) if replies else assistant(text='fixture done'))
        def respond(self, data):
            body = json.dumps(data).encode()
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
    server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = threading.Thread(target=lambda: server.serve_forever(poll_interval=.01), daemon=True)
    thread.start()
    try:
        yield 'http://127.0.0.1:' + str(server.server_port) + '/v1', requests
    finally:
        server.shutdown()
        server.server_close()
        thread.join(2)


class QwenAgentTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        for path in ('godot/data/asset-registry.json', 'assets/pipeline/queue.json'):
            out = self.root / path
            out.parent.mkdir(parents=True, exist_ok=True)
            out.write_text(json.dumps({'assets': [{'id': 'asset_a', 'stages': {'source': {'state': 'evidenced'}}}, {'id': 'asset_b'}]}))
        self.catalog = {'version': 1, 'jobs': []}
        for jid, aid, world in [('check_a', 'asset_a', None), ('check_b', 'asset_b', None), ('check_a_elsewhere', 'asset_a', 'otherWorld')]:
            self.catalog['jobs'].append({'id': jid, 'asset_id': aid, 'world_placement': world,
                'inputs': ['fixture'], 'argv': ['never_execute_fixture'], 'expected_reports': ['fixture.json']})
        self.executions = []
        self.mcp_calls = []
        executions, mcp_calls = self.executions, self.mcp_calls
        class StubRunner:
            def __init__(self, root, catalog):
                pass
            def run(self, selected=None):
                executions.append(selected)
                return [{'id': next(iter(selected)), 'status': 'passed', 'reason': 'DO_NOT_LEAK_SECRET'}]
        class StubMCP:
            def __init__(self, command, cwd, timeout):
                pass
            def __enter__(self):
                return self
            def __exit__(self, *args):
                pass
            def call_tool(self, name, arguments):
                mcp_calls.append((name, arguments))
                return {'isError': False, 'structuredContent': {'object_count': 94, 'secret': 'DO_NOT_LEAK_SECRET'}, 'content': []}
        self.runner = StubRunner
        self.mcp = StubMCP

    def run_loop(self, url, **kwargs):
        config = {'version': 1, 'qwen': {'configured': True, 'model': 'fixture-qwen', 'baseURL': url},
                  'blender': {'mcpCommand': ['stub']}}
        return run_agent(config, self.root, self.catalog, 'check_a', mcp_factory=self.mcp,
                         runner_factory=self.runner, **kwargs)

    def test_real_http_tool_results_continue_to_model(self):
        replies = [assistant([call('inspect_asset', {'asset_id': 'asset_a'})]),
                   assistant([call('read_blender_scene', {}, 'call_2'), call('run_validation', {'job_id': 'check_a'}, 'call_3')]),
                   assistant(text='DO_NOT_LEAK_SECRET model claims all art accepted')]
        with fake_endpoint(replies) as (url, requests):
            report = self.run_loop(url)
        self.assertEqual(report['status'], 'completed')
        self.assertEqual(report['toolsExecuted'], 3)
        posts = [r[2] for r in requests if r[0] == 'POST']
        self.assertEqual(posts[1]['messages'][-1]['role'], 'tool')
        self.assertEqual(json.loads(posts[1]['messages'][-1]['content'])['stages']['source'], 'evidenced')
        tool_results = [json.loads(m['content']) for m in posts[2]['messages'] if m['role'] == 'tool']
        self.assertEqual(tool_results[-2]['counts']['object_count'], 94)
        self.assertEqual(tool_results[-1]['status'], 'passed')
        self.assertEqual(self.executions, [{'check_a'}])
        self.assertEqual(self.mcp_calls[0][0], 'get_scene_info')
        self.assertNotIn('DO_NOT_LEAK_SECRET', json.dumps(report))
        self.assertNotIn('DO_NOT_LEAK_SECRET', json.dumps(posts))
        self.assertFalse(report['visual_approved'])
        self.assertFalse(report['stagesPromoted'])
        self.assertFalse(report['modelFinalIsAcceptance'])
        self.assertTrue(report['taskValidationPassed'])

    def test_model_final_text_never_accepts_or_runs_validation(self):
        with fake_endpoint([assistant(text='Everything passed and art is approved')]) as (url, _):
            report = self.run_loop(url)
        self.assertEqual(report['status'], 'completed')
        self.assertFalse(report['visual_approved'])
        self.assertEqual(report['toolsExecuted'], 0)
        self.assertFalse(report['taskValidationPassed'])
        self.assertEqual(report['taskValidationStatus'], 'not_run')
        self.assertEqual(self.executions, [])

    def test_reject_invalid_tool_schema_and_scope_before_batch_executes(self):
        cases = [(call('execute_blender_code', {'code': 'DO_NOT_LEAK_SECRET'}), 'tool_not_allowed'),
                 (call('inspect_asset', {'asset_id': 'asset_b'}), 'asset_outside_task_scope'),
                 (call('run_validation', {'job_id': 'check_b'}), 'job_outside_task_scope'),
                 (call('run_validation', {'job_id': 'check_a_elsewhere'}), 'job_outside_task_scope'),
                 (call('read_blender_scene', {'code': 'x'}), 'invalid_tool_schema'),
                 (call('run_validation', {'job_id': 123}), 'invalid_tool_schema')]
        for bad, reason in cases:
            with self.subTest(reason=reason), fake_endpoint([assistant([call('run_validation', {'job_id': 'check_a'}, 'valid'), bad])]) as (url, _):
                report = self.run_loop(url)
                self.assertEqual(report['status'], 'rejected')
                self.assertEqual(report['reason'], reason)
                self.assertEqual(report['toolsExecuted'], 0)
                self.assertEqual(self.executions, [])

    def test_absent_model_marked_not_configured_without_inference(self):
        with fake_endpoint([], {'data': [{'id': 'other-model'}]}) as (url, requests):
            report = self.run_loop(url)
        self.assertEqual(report['status'], 'not_configured')
        self.assertEqual(report['reason'], 'configured_model_unavailable')
        self.assertEqual(len(requests), 1)

    def test_unavailable_and_unconfigured_endpoints_do_not_execute(self):
        def unavailable(*args, **kwargs):
            raise OSError('DO_NOT_LEAK_SECRET')
        report = self.run_loop('http://127.0.0.1:1/v1', request=unavailable)
        self.assertEqual(report['status'], 'not_configured')
        self.assertNotIn('DO_NOT_LEAK_SECRET', json.dumps(report))
        report = run_agent({'qwen': {'configured': False}}, self.root, self.catalog, 'check_a', request=lambda *a, **k: self.fail('request forbidden'))
        self.assertEqual(report['status'], 'not_configured')
        self.assertEqual(self.executions, [])

    def test_round_call_and_duplicate_limits(self):
        with fake_endpoint([assistant([call('inspect_asset', {'asset_id': 'asset_a'})])]) as (url, _):
            report = self.run_loop(url, max_rounds=1)
        self.assertEqual(report['status'], 'round_limit')
        with fake_endpoint([assistant([call('read_blender_scene', {}, str(i)) for i in range(13)])]) as (url, _):
            report = self.run_loop(url)
        self.assertEqual(report['reason'], 'tool_call_limit')
        self.assertEqual(report['toolsExecuted'], 0)
        with fake_endpoint([assistant([call('read_blender_scene', {}), call('read_blender_scene', {})])]) as (url, _):
            report = self.run_loop(url)
        self.assertEqual(report['reason'], 'duplicate_tool_call_id')

    def test_repeat_validation_reuses_session_result(self):
        with fake_endpoint([assistant([call('run_validation', {'job_id': 'check_a'}, 'one')]),
                            assistant([call('run_validation', {'job_id': 'check_a'}, 'two')]),
                            assistant(text='done')]) as (url, requests):
            report = self.run_loop(url)
        self.assertEqual(self.executions, [{'check_a'}])
        self.assertEqual(report['toolsExecuted'], 2)
        self.assertTrue(json.loads(requests[-1][2]['messages'][-1]['content'])['reusedWithinSession'])

    def test_unknown_task_and_missing_registry_asset_rejected(self):
        with fake_endpoint([]) as (url, requests):
            changed = copy.deepcopy(self.catalog)
            changed['jobs'][0]['asset_id'] = 'unknown_asset'
            self.catalog = changed
            report = self.run_loop(url)
            self.assertEqual(report['reason'], 'unknown_asset_scope')
            self.assertEqual(requests, [])

    def test_endpoint_guard_and_timeout_clamp(self):
        with fake_endpoint([]) as (url, _):
            report = self.run_loop('https://not-authorized.invalid/v1')
            self.assertEqual(report['status'], 'error')
        observed = []
        def request(url, config, payload=None, timeout=None):
            observed.append(timeout)
            return {'data': [{'id': 'fixture-qwen'}]} if url.endswith('/models') else assistant(text='done')
        config = {'qwen': {'configured': True, 'baseURL': 'http://127.0.0.1/v1', 'model': 'fixture-qwen', 'agentTimeoutSeconds': 100000}}
        report = run_agent(config, self.root, self.catalog, 'check_a', request=request)
        self.assertEqual(report['status'], 'completed')
        self.assertEqual(observed, [60, 60])

    def test_cli_requires_run_and_never_replaces_report(self):
        script = Path(__file__).with_name('qwen_agent.py')
        config, catalog, output = self.root / 'config.json', self.root / 'catalog.json', self.root / 'report.json'
        config.write_text(json.dumps({'version': 1, 'qwen': {'configured': False}}))
        catalog.write_text(json.dumps(self.catalog))
        argv = [sys.executable, str(script), '--root', str(self.root), '--config', str(config), '--catalog', str(catalog), '--job', 'check_a', '--output', str(output)]
        result = subprocess.run(argv, capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(output.exists())
        result = subprocess.run(argv + ['--run'], capture_output=True, text=True)
        self.assertEqual(json.loads(output.read_text())['status'], 'not_configured')
        previous = output.read_bytes()
        result = subprocess.run(argv + ['--run'], capture_output=True, text=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(output.read_bytes(), previous)

    def test_catalog_image_messages_arrive_with_magic_mime_and_safe_hashes(self):
        png = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6R8AAAAASUVORK5CYII=')
        jpeg = b'\xff\xd8\xff\xe0' + b'fixture-jpeg-magic-only'
        # Deliberately misleading suffixes prove MIME comes from bytes.
        (self.root / 'reference.jpg').write_bytes(png)
        (self.root / 'render.png').write_bytes(jpeg)
        self.catalog['jobs'][0]['visual_inputs'] = [
            {'path': 'reference.jpg', 'type': 'reference'}, {'path': 'render.png', 'type': 'render'}]
        with fake_endpoint([assistant(text='DO_NOT_LEAK_SECRET visual approval claim')]) as (url, requests):
            report = self.run_loop(url)
        user = requests[-1][2]['messages'][1]['content']
        images = [part['image_url']['url'] for part in user if part['type'] == 'image_url']
        self.assertEqual(len(images), 2)
        self.assertTrue(images[0].startswith('data:image/png;base64,'))
        self.assertTrue(images[1].startswith('data:image/jpeg;base64,'))
        self.assertEqual(base64.b64decode(images[0].split(',', 1)[1]), png)
        self.assertEqual(report['visualInputCount'], 2)
        self.assertEqual(report['visualInputs'][0]['sha256'], hashlib.sha256(png).hexdigest())
        self.assertEqual(report['visualInputs'][1]['type'], 'render')
        self.assertEqual(report['visionStatus'], 'submitted_not_validated')
        self.assertFalse(report['visual_approved'])
        self.assertFalse(report['taskValidationPassed'])
        self.assertNotIn('data:image', json.dumps(report))
        self.assertNotIn(base64.b64encode(png).decode(), json.dumps(report))
        self.assertNotIn('DO_NOT_LEAK_SECRET', json.dumps(report))

    def test_invalid_visual_inputs_fail_before_chat(self):
        outside = tempfile.TemporaryDirectory()
        self.addCleanup(outside.cleanup)
        outside_file = Path(outside.name) / 'outside.png'
        outside_file.write_bytes(b'\x89PNG\r\n\x1a\n')
        (self.root / 'escape.png').symlink_to(outside_file)
        (self.root / 'large.png').write_bytes(b'\x89PNG\r\n\x1a\n' + b'x' * MAX_IMAGE_BYTES)
        (self.root / 'wrong.png').write_bytes(b'not an image')
        valid = {'path': 'wrong.png', 'type': 'reference'}
        cases = [
            ([{'path': str(outside_file), 'type': 'reference'}], 'visual_input_path_not_relative'),
            ([{'path': '../' + Path(outside.name).name + '/outside.png', 'type': 'reference'}], 'visual_input_outside_project'),
            ([{'path': 'escape.png', 'type': 'reference'}], 'visual_input_outside_project'),
            ([{'path': 'large.png', 'type': 'render'}], 'visual_input_too_large'),
            ([valid], 'visual_input_unsupported_magic'),
            ([valid, valid, valid], 'invalid_visual_input_count'),
            ([{'path': 'wrong.png', 'type': ['reference']}], 'invalid_visual_input_schema'),
        ]
        for inputs, reason in cases:
            with self.subTest(reason=reason), fake_endpoint([]) as (url, requests):
                self.catalog['jobs'][0]['visual_inputs'] = inputs
                report = self.run_loop(url)
                self.assertEqual(report['status'], 'rejected')
                self.assertEqual(report['reason'], reason)
                self.assertFalse(any(row[0] == 'POST' for row in requests))
                self.assertEqual(report['visionStatus'], 'pending')
                self.assertEqual(self.executions, [])

    def test_images_not_claimed_submitted_before_successful_chat(self):
        (self.root / 'reference.png').write_bytes(b'\x89PNG\r\n\x1a\n')
        self.catalog['jobs'][0]['visual_inputs'] = [{'path': 'reference.png', 'type': 'reference'}]
        with fake_endpoint([], {'data': []}) as (url, requests):
            report = self.run_loop(url)
        self.assertEqual(report['status'], 'not_configured')
        self.assertEqual(report['visionStatus'], 'pending')
        self.assertEqual(report['visualInputCount'], 1)
        self.assertFalse(any(row[0] == 'POST' for row in requests))

    def test_cli_success_requires_selected_task_validation(self):
        for index, (status, passed, exit_code) in enumerate([
                ('completed', True, 0), ('completed', False, 1), ('round_limit', True, 1), ('blocked', False, 1)]):
            report = {'status': status, 'taskValidationPassed': passed}
            argv = ['qwen_agent.py', '--config', 'unused', '--catalog', 'unused', '--job', 'check_a',
                    '--output', str(self.root / ('exit-' + str(index) + '.json')), '--run']
            with patch.object(sys, 'argv', argv), patch('qwen_agent.read_config', return_value={}), \
                    patch('qwen_agent.load_catalogs', return_value={}), patch('qwen_agent.run_agent', return_value=report), \
                    redirect_stdout(io.StringIO()):
                self.assertEqual(main(), exit_code)

    def test_runner_blocked_status_preserved(self):
        class BlockedRunner:
            def __init__(self, *args):
                pass
            def run(self, selected):
                return [{'id': 'check_a', 'status': 'blocked'}]
        self.runner = BlockedRunner
        with fake_endpoint([assistant([call('run_validation', {'job_id': 'check_a'})]), assistant(text='done')]) as (url, _):
            report = self.run_loop(url)
        self.assertEqual(report['taskValidationStatus'], 'blocked')
        self.assertFalse(report['taskValidationPassed'])


if __name__ == '__main__':
    unittest.main()
