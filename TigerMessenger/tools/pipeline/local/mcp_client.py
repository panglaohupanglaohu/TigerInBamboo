"""Bounded, synchronous POSIX MCP stdio client using only the standard library.

The context manager owns only its spawned process group, never Blender itself.
Tool results are returned unchanged; callers must inspect ``isError`` and treat
content as untrusted data. No command, arguments, environment, raw stderr, or
server error text is included in diagnostics/exceptions. Not thread-safe.
"""
import json
import math
import os
import selectors
import signal
import subprocess
import time
from collections import deque


class MCPError(RuntimeError):
    """A safe, fixed-code transport/protocol error."""


class MCPTimeoutError(MCPError):
    pass


class MCPServerError(MCPError):
    def __init__(self, code):
        self.code = code if type(code) is int else None
        super().__init__("mcp_server_error" + (f":{self.code}" if self.code is not None else ""))


class MCPClient:
    PROTOCOL_VERSIONS = ("2025-06-18", "2025-03-26", "2024-11-05")
    MAX_MESSAGE_BYTES = 8 * 1024 * 1024
    MAX_STDERR_BYTES = 16 * 1024
    MAX_QUEUED_MESSAGES = 1024
    MAX_TOOL_PAGES = 100
    MAX_TOOLS = 10000
    MAX_TOOL_LIST_BYTES = 16 * 1024 * 1024

    def __init__(self, command, cwd, timeout=30):
        if (not isinstance(command, (list, tuple)) or not command
                or any(not isinstance(x, str) or not x or "\0" in x for x in command)):
            raise ValueError("mcp_invalid_command")
        if isinstance(timeout, bool) or not isinstance(timeout, (int, float)) or not math.isfinite(timeout) or timeout <= 0:
            raise ValueError("mcp_invalid_timeout")
        self._command = list(command)
        self._cwd = cwd
        self.timeout = float(timeout)
        self._process = None
        self._selector = None
        self._stdout = bytearray()
        self._stderr = bytearray()
        self._messages = deque()
        self._next_id = 0
        self._closed = False
        self._ready = False
        self.stderr_bytes = 0
        self.notification_count = 0
        self.server_info = None
        self.protocol_version = None

    @property
    def diagnostics(self):
        return {"stderrBytes": self.stderr_bytes,
                "stderrCapturedBytes": len(self._stderr),
                "stderrContentsWithheld": True,
                "notificationCount": self.notification_count,
                "returnCode": self._process.poll() if self._process else None}

    def __enter__(self):
        if self._process is not None or self._closed:
            raise MCPError("mcp_client_already_used")
        if os.name != "posix":
            raise MCPError("mcp_posix_required")
        try:
            # Preserve the established local Blender telemetry policy. Never log env.
            env = dict(os.environ, DISABLE_TELEMETRY="true")
            self._process = subprocess.Popen(
                self._command, cwd=self._cwd, env=env, stdin=subprocess.PIPE,
                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                bufsize=0, start_new_session=True,
            )
            self._selector = selectors.DefaultSelector()
            for stream in (self._process.stdin, self._process.stdout, self._process.stderr):
                os.set_blocking(stream.fileno(), False)
            self._selector.register(self._process.stdout, selectors.EVENT_READ, "stdout")
            self._selector.register(self._process.stderr, selectors.EVENT_READ, "stderr")
            result = self._request("initialize", {
                "protocolVersion": self.PROTOCOL_VERSIONS[0], "capabilities": {},
                "clientInfo": {"name": "tigermessenger-local", "version": "1.0.0"},
            })
            if result.get("protocolVersion") not in self.PROTOCOL_VERSIONS:
                raise MCPError("mcp_unsupported_protocol")
            if not isinstance(result.get("capabilities"), dict) or "tools" not in result["capabilities"]:
                raise MCPError("mcp_tools_not_supported")
            self.protocol_version = result["protocolVersion"]
            self.server_info = result.get("serverInfo")
            self._send({"jsonrpc": "2.0", "method": "notifications/initialized"}, time.monotonic() + self.timeout)
            self._ready = True
            return self
        except MCPError:
            self.close()
            raise
        except (OSError, ValueError):
            self.close()
            raise MCPError("mcp_start_failed") from None
        except BaseException:
            self.close()
            raise

    def __exit__(self, exc_type, exc, tb):
        self.close()

    def close(self):
        """Close stdin, then terminate/kill our process group within bounded time."""
        if self._closed:
            return
        self._closed = True
        self._ready = False
        process = self._process
        if process is not None:
            if process.stdin:
                process.stdin.close()
            try:
                process.wait(timeout=0.2)
            except subprocess.TimeoutExpired:
                pass
            # Kill surviving children even if their direct parent already exited.
            for sig, grace in ((signal.SIGTERM, 0.3), (signal.SIGKILL, 0.3)):
                try:
                    os.killpg(process.pid, sig)
                except ProcessLookupError:
                    break
                try:
                    process.wait(timeout=grace)
                except subprocess.TimeoutExpired:
                    pass
                if sig == signal.SIGTERM:
                    # A reaped parent does not prove its children have exited.
                    time.sleep(0.03)
            for stream in (process.stdout, process.stderr):
                if stream:
                    stream.close()
        if self._selector is not None:
            self._selector.close()
        self._stdout.clear()
        self._messages.clear()

    def _pump(self, deadline):
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise MCPTimeoutError("mcp_timeout")
        events = self._selector.select(remaining)
        if not events:
            raise MCPTimeoutError("mcp_timeout")
        for key, mask in events:
            if key.data == "stdin":
                continue
            try:
                chunk = os.read(key.fd, 65536)
            except BlockingIOError:
                continue
            if not chunk:
                self._selector.unregister(key.fileobj)
                if key.data == "stdout":
                    # Responses already read before EOF are still valid.
                    if self._stdout:
                        raise MCPError("mcp_truncated_message")
                continue
            if key.data == "stderr":
                self.stderr_bytes += len(chunk)
                self._stderr.extend(chunk)
                del self._stderr[:-self.MAX_STDERR_BYTES]
                continue
            self._stdout.extend(chunk)
            while b"\n" in self._stdout:
                raw, _, tail = self._stdout.partition(b"\n")
                self._stdout = bytearray(tail)
                if len(raw) > self.MAX_MESSAGE_BYTES:
                    raise MCPError("mcp_message_too_large")
                try:
                    message = json.loads(raw)
                except (ValueError, UnicodeError):
                    raise MCPError("mcp_invalid_json") from None
                batch = message if isinstance(message, list) else [message]
                if not batch or len(batch) + len(self._messages) > self.MAX_QUEUED_MESSAGES:
                    raise MCPError("mcp_message_queue_limit")
                self._messages.extend(batch)
            if len(self._stdout) > self.MAX_MESSAGE_BYTES:
                raise MCPError("mcp_message_too_large")

    def _send(self, message, deadline):
        try:
            data = json.dumps(message, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8") + b"\n"
        except (TypeError, ValueError, UnicodeError):
            raise MCPError("mcp_invalid_request") from None
        if len(data) > self.MAX_MESSAGE_BYTES:
            raise MCPError("mcp_request_too_large")
        stream = self._process.stdin
        self._selector.register(stream, selectors.EVENT_WRITE, "stdin")
        try:
            offset = 0
            while offset < len(data):
                if time.monotonic() >= deadline:
                    raise MCPTimeoutError("mcp_timeout")
                try:
                    offset += os.write(stream.fileno(), data[offset:])
                except BlockingIOError:
                    self._pump(deadline)
                except (BrokenPipeError, OSError):
                    raise MCPError("mcp_server_closed") from None
        finally:
            self._selector.unregister(stream)

    def _request(self, method, params, deadline=None):
        if self._closed or self._process is None:
            raise MCPError("mcp_client_not_open")
        deadline = deadline if deadline is not None else time.monotonic() + self.timeout
        self._next_id += 1
        request_id = self._next_id
        try:
            self._send({"jsonrpc": "2.0", "id": request_id, "method": method, "params": params}, deadline)
            while True:
                if time.monotonic() >= deadline:
                    raise MCPTimeoutError("mcp_timeout")
                if not self._messages:
                    if not any(k.data == "stdout" for k in self._selector.get_map().values()):
                        raise MCPError("mcp_server_closed")
                    self._pump(deadline)
                    continue
                message = self._messages.popleft()
                if not isinstance(message, dict) or message.get("jsonrpc") != "2.0":
                    raise MCPError("mcp_invalid_message")
                if "method" in message:
                    if "id" not in message:
                        self.notification_count += 1
                        continue
                    reply = {"jsonrpc": "2.0", "id": message["id"]}
                    if message["method"] == "ping":
                        reply["result"] = {}
                    else:
                        reply["error"] = {"code": -32601, "message": "Client method not supported"}
                    self._send(reply, deadline)
                    continue
                if type(message.get("id")) is not int or message["id"] != request_id:
                    raise MCPError("mcp_unexpected_response_id")
                if "error" in message:
                    error = message["error"]
                    raise MCPServerError(error.get("code") if isinstance(error, dict) else None)
                if not isinstance(message.get("result"), dict):
                    raise MCPError("mcp_invalid_result")
                return message["result"]
        except MCPServerError:
            raise
        except MCPTimeoutError:
            if method != "initialize":
                try:
                    self._send({"jsonrpc": "2.0", "method": "notifications/cancelled",
                                "params": {"requestId": request_id, "reason": "Timeout"}}, time.monotonic() + 0.05)
                except MCPError:
                    pass
            self.close()
            raise
        except MCPError:
            self.close()
            raise
        except OSError:
            self.close()
            raise MCPError("mcp_transport_failed") from None

    def list_tools(self):
        """Return all tool definitions, with bounded pagination and total timeout."""
        if not self._ready:
            raise MCPError("mcp_client_not_ready")
        tools, seen, params = [], set(), {}
        total_bytes = 0
        deadline = time.monotonic() + self.timeout
        for _ in range(self.MAX_TOOL_PAGES):
            result = self._request("tools/list", params, deadline)
            page = result.get("tools")
            if not isinstance(page, list) or any(not isinstance(t, dict) or not isinstance(t.get("name"), str) for t in page):
                raise MCPError("mcp_invalid_tools")
            total_bytes += len(json.dumps(page).encode("utf-8"))
            if len(tools) + len(page) > self.MAX_TOOLS or total_bytes > self.MAX_TOOL_LIST_BYTES:
                raise MCPError("mcp_tool_list_limit")
            tools.extend(page)
            cursor = result.get("nextCursor")
            if cursor is None:
                return tools
            if not isinstance(cursor, str) or cursor in seen:
                raise MCPError("mcp_invalid_pagination")
            seen.add(cursor)
            params = {"cursor": cursor}
        raise MCPError("mcp_tool_page_limit")

    def call_tool(self, name, arguments):
        """Return the complete result; tool execution errors retain isError=True."""
        if not self._ready:
            raise MCPError("mcp_client_not_ready")
        if not isinstance(name, str) or not name or not isinstance(arguments, dict):
            raise ValueError("mcp_invalid_tool_call")
        return self._request("tools/call", {"name": name, "arguments": arguments})
