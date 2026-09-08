"""Offline stdio integration tests; no Blender process or network required."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import unittest

from mcp_client import MCPClient, MCPError, MCPServerError, MCPTimeoutError


SERVER = r'''
import json, os, signal, subprocess, sys, time
mode = sys.argv[1]
initialized = False
def emit(value):
    print(json.dumps(value), flush=True)
def result(request, value):
    emit({"jsonrpc": "2.0", "id": request["id"], "result": value})
if mode == "init_timeout":
    time.sleep(30)
if mode == "init_death":
    sys.exit(7)
for line in sys.stdin:
    request = json.loads(line)
    method = request.get("method")
    if method == "initialize":
        result(request, {"protocolVersion": "unsupported" if mode == "version" else request["params"]["protocolVersion"], "capabilities": {"tools": {}}, "serverInfo": {"name": "offline-fixture", "version": "1"}})
    elif method == "notifications/initialized":
        initialized = True
        if mode == "blocked_input":
            time.sleep(30)
    elif method == "tools/list":
        assert initialized
        emit({"jsonrpc": "2.0", "method": "notifications/tools/list_changed"})
        if mode == "pagination" and "cursor" not in request["params"]:
            result(request, {"tools": [{"name": "first"}], "nextCursor": "second"})
        elif mode == "cycle":
            result(request, {"tools": [], "nextCursor": "same"})
        else:
            result(request, {"tools": [{"name": "get_scene_info", "inputSchema": {"type": "object"}}]})
    elif method == "tools/call":
        assert initialized
        if mode == "timeout":
            time.sleep(30)
        elif mode == "death":
            sys.exit(9)
        elif mode == "error":
            emit({"jsonrpc": "2.0", "id": request["id"], "error": {"code": -32602, "message": "DO_NOT_LEAK_SECRET", "data": "DO_NOT_LEAK_SECRET"}})
        elif mode == "stderr":
            sys.stderr.write("DO_NOT_LEAK_SECRET\n" * 10000)
            sys.stderr.flush()
            result(request, {"content": []})
        elif mode == "malformed":
            print("DO_NOT_LEAK_SECRET", flush=True)
        elif mode == "truncated":
            sys.stdout.write('{"jsonrpc":"2.0"')
            sys.stdout.flush()
            sys.exit(0)
        elif mode == "oversized":
            print("x" * (9 * 1024 * 1024), flush=True)
        elif mode == "ping":
            emit({"jsonrpc": "2.0", "id": "server-ping", "method": "ping"})
            reply = json.loads(next(sys.stdin))
            assert reply == {"jsonrpc": "2.0", "id": "server-ping", "result": {}}
            emit({"jsonrpc": "2.0", "id": "server-sampling", "method": "sampling/createMessage"})
            reply = json.loads(next(sys.stdin))
            assert reply["error"]["code"] == -32601
            result(request, {"content": [], "structuredContent": {"pingAnswered": True}})
        elif mode == "child":
            child = subprocess.Popen([sys.executable, "-c", "import signal,time;signal.signal(signal.SIGTERM,signal.SIG_IGN);time.sleep(30)"])
            time.sleep(.1)
            result(request, {"content": [], "structuredContent": {"pid": child.pid}})
        elif mode == "periodic_notifications":
            while True:
                emit({"jsonrpc": "2.0", "method": "notifications/progress"})
                # Isolate deadline handling from the independent queue cap.
                # At 100/s, even a stalled reader cannot accumulate 1,024
                # notifications during the test's 150 ms request deadline.
                time.sleep(.01)
        elif mode == "notification_queue_overflow":
            # One oversized batch deterministically exercises the queue bound,
            # independent of OS pipe chunking or child scheduling speed.
            emit([{"jsonrpc": "2.0", "method": "notifications/progress"}] * 1025)
        else:
            result(request, {"content": [{"type": "text", "text": "fixture result"}], "structuredContent": {"objectCount": 3, "arguments": request["params"]["arguments"]}, "isError": mode == "tool_error"})
'''


@unittest.skipUnless(os.name == "posix", "POSIX process-group transport")
class MCPClientTests(unittest.TestCase):
    def client(self, mode="success", timeout=2):
        return MCPClient([sys.executable, "-u", "-c", SERVER, mode], Path(__file__).parent, timeout)

    def test_initialize_list_and_structured_call(self):
        client = self.client()
        with client:
            self.assertEqual(client.list_tools()[0]["name"], "get_scene_info")
            result = client.call_tool("get_scene_info", {"label": "虎\nscene"})
            self.assertFalse(result["isError"])
            self.assertEqual(result["structuredContent"]["arguments"], {"label": "虎\nscene"})
            self.assertEqual(client.notification_count, 1)
        self.assertIsNotNone(client._process.poll())
        self.assertTrue(client._process.stdout.closed)

    def test_pagination(self):
        with self.client("pagination") as client:
            self.assertEqual([t["name"] for t in client.list_tools()], ["first", "get_scene_info"])

    def test_pagination_cycle_is_bounded(self):
        with self.client("cycle") as client:
            with self.assertRaisesRegex(MCPError, "mcp_invalid_pagination"):
                client.list_tools()

    def test_tool_error_result_is_preserved(self):
        with self.client("tool_error") as client:
            self.assertTrue(client.call_tool("bad", {})["isError"])

    def test_protocol_error_omits_server_error_text(self):
        with self.client("error") as client:
            with self.assertRaises(MCPServerError) as raised:
                client.call_tool("bad", {})
            self.assertEqual(raised.exception.code, -32602)
            self.assertNotIn("DO_NOT_LEAK_SECRET", str(raised.exception))
            # Protocol errors do not poison the usable connection.
            self.assertEqual(len(client.list_tools()), 1)

    def test_timeout_closes_process(self):
        client = self.client("timeout", .15)
        started = time.monotonic()
        with client:
            with self.assertRaises(MCPTimeoutError):
                client.call_tool("slow", {})
            self.assertIsNotNone(client._process.poll())
        self.assertLess(time.monotonic() - started, 2)

    def test_initialize_timeout_and_death_cleanup(self):
        for mode, error in [("init_timeout", MCPTimeoutError), ("init_death", MCPError), ("version", MCPError)]:
            with self.subTest(mode=mode):
                client = self.client(mode, .15)
                with self.assertRaises(error):
                    with client:
                        self.fail("initialization should fail")
                self.assertIsNotNone(client._process.poll())

    def test_server_death(self):
        with self.client("death") as client:
            with self.assertRaisesRegex(MCPError, "mcp_server_closed"):
                client.call_tool("get_scene_info", {})

    def test_bounded_stderr_and_safe_diagnostics(self):
        with self.client("stderr") as client:
            client.call_tool("get_scene_info", {})
            diagnostics = client.diagnostics
            self.assertGreater(diagnostics["stderrBytes"], client.MAX_STDERR_BYTES)
            self.assertEqual(diagnostics["stderrCapturedBytes"], client.MAX_STDERR_BYTES)
            self.assertNotIn("DO_NOT_LEAK_SECRET", json.dumps(diagnostics))

    def test_malformed_and_large_message(self):
        for mode, code in [("malformed", "mcp_invalid_json"), ("oversized", "mcp_message_too_large"), ("truncated", "mcp_truncated_message")]:
            with self.subTest(mode=mode):
                with self.client(mode) as client:
                    with self.assertRaisesRegex(MCPError, code):
                        client.call_tool("get_scene_info", {})

    def test_server_ping_and_unsupported_request(self):
        with self.client("ping") as client:
            self.assertTrue(client.call_tool("get_scene_info", {})["structuredContent"]["pingAnswered"])

    def test_notifications_do_not_extend_timeout(self):
        with self.client("periodic_notifications") as client:
            client.timeout = .15
            started = time.monotonic()
            with self.assertRaises(MCPTimeoutError):
                client.call_tool("get_scene_info", {})
            self.assertGreater(client.notification_count, 0)
            self.assertLess(time.monotonic() - started, 2)
            self.assertIsNotNone(client._process.poll())

    def test_notification_queue_cap_is_distinct_from_deadline(self):
        with self.client("notification_queue_overflow") as client:
            with self.assertRaisesRegex(MCPError, '^mcp_message_queue_limit$') as raised:
                client.call_tool("get_scene_info", {})
            self.assertNotIsInstance(raised.exception, MCPTimeoutError)
            self.assertIsNotNone(client._process.poll())

    def test_stdin_backpressure_is_bounded(self):
        started = time.monotonic()
        with self.client("blocked_input", .15) as client:
            with self.assertRaises(MCPTimeoutError):
                client.call_tool("get_scene_info", {"large": "x" * (2 * 1024 * 1024)})
        self.assertLess(time.monotonic() - started, 2)

    def test_process_group_cleanup_after_parent_exit(self):
        child_pid = None
        try:
            with self.client("child") as client:
                child_pid = client.call_tool("get_scene_info", {})["structuredContent"]["pid"]
            for _ in range(50):
                try:
                    os.kill(child_pid, 0)
                except ProcessLookupError:
                    break
                time.sleep(.02)
            else:
                # Linux may keep a killed orphan as a zombie until init reaps it.
                state = subprocess.run(["ps", "-o", "stat=", "-p", str(child_pid)], capture_output=True, text=True).stdout.strip()
                self.assertTrue(not state or state.startswith("Z"), "child still running")
        finally:
            if child_pid:
                try:
                    os.kill(child_pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass

    def test_invalid_arguments_and_launch_failure_are_safe(self):
        for timeout in [0, -1, float("nan"), float("inf"), True]:
            with self.assertRaisesRegex(ValueError, "mcp_invalid_timeout"):
                self.client(timeout=timeout)
        with self.assertRaisesRegex(ValueError, "mcp_invalid_command"):
            MCPClient("shell string not accepted", ".")
        with self.assertRaisesRegex(MCPError, "mcp_start_failed") as raised:
            with MCPClient(["/DO_NOT_LEAK_SECRET/missing"], "."):
                pass
        self.assertNotIn("DO_NOT_LEAK_SECRET", str(raised.exception))


if __name__ == "__main__":
    unittest.main()
