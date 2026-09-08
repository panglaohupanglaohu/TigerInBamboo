"""Run the real Web tiger fixture with a temporary local server and private output."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import subprocess
import threading

ROOT = Path(__file__).resolve().parents[3]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    output = Path(args.output).resolve()
    if output.name != 'report.json' or not output.parent.is_relative_to(ROOT / 'artifacts/pipeline'):
        raise ValueError('Output must be report.json inside a new project artifacts/pipeline run')
    if output.exists() or (output.parent / 'browser-check.json').exists():
        raise ValueError('Existing run evidence must not be overwritten')
    output.parent.mkdir(parents=True, exist_ok=True)
    report = {'passed': False, 'visual_approved': False, 'foreground_touched': False}
    server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(ROOT.parent)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    proc = None
    try:
        env = dict(os.environ)
        env['TIGER_TEST_BASE_URL'] = f'http://127.0.0.1:{server.server_port}/{ROOT.name}'
        env['TIGER_TEST_OUTPUT'] = str(output.parent)
        with (output.parent / 'web-worker.log').open('w') as stream:
            proc = subprocess.Popen(['node', str(ROOT / 'tools/pipeline/test_tiger_anatomy_web.mjs')],
                                    cwd=ROOT, env=env, stdout=stream, stderr=subprocess.STDOUT)
            proc.wait(timeout=180)
        result = json.loads((output.parent / 'browser-check.json').read_text())
        checks = result.get('checks', [])
        report.update(browser_passed=result.get('passed') is True, checks_passed=sum(c.get('passed') is True for c in checks),
                      runtime_inputs_unchanged=result.get('runtimeInputsUnchanged') is True,
                      page_errors=result.get('pageErrors', []), network_errors=result.get('networkErrors', []))
        report['passed'] = proc.returncode == 0 and report['browser_passed'] and report['runtime_inputs_unchanged'] and len(checks) >= 36 and all(c.get('passed') is True for c in checks)
    except Exception as exc:
        report['failure'] = type(exc).__name__ + ': ' + str(exc)[:300]
    finally:
        if proc is not None and proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait()
        server.shutdown()
        server.server_close()
        thread.join(timeout=2)
        output.write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps(report))
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
