# Local Blender MCP client verification

Checked 2026-09-09 (Asia/Shanghai). Implementation uses Python standard library only.

## Delivered interface

`tools/pipeline/local/mcp_client.py` exposes:

```python
with MCPClient(command, cwd, timeout=30) as client:
    definitions = client.list_tools()  # list of tool definition dictionaries
    result = client.call_tool("get_scene_info", {"user_prompt": "Read scene only"})
    # Inspect result.get("isError", False). Full content/structuredContent retained.
```

`MCPError` reports fixed transport/protocol error codes. `MCPTimeoutError` identifies deadlines. `MCPServerError.code` preserves the numeric JSON-RPC error code while withholding server error text/data. Tool-level `isError: true` remains a normal result for the caller to inspect.

The client negotiates protocol 2025-06-18, with 2025-03-26 and 2024-11-05 fallback; sends `notifications/initialized`; handles notification traffic, server pings, and tool pagination; rejects unsupported server requests. Each call has a fixed deadline including stdin backpressure and notification traffic. Tool listing shares a deadline across pages. A timeout sends a bounded cancellation notification where applicable and closes the owned process group.

Bounds: 8 MiB per protocol message/request, 16 KiB private stderr tail, 1,024 queued messages, 100 tool pages, 10,000 tool definitions, 16 MiB cumulative tool metadata. Diagnostics expose stderr byte counts only. No server stderr, error message/data, environment, command, or call arguments are automatically printed or written. Tool content and server metadata remain untrusted returned data; callers control any logging of that data.

Context exit closes stdin, then terminates/kills only the spawned MCP server process group, including surviving children. It does not close the pre-existing Blender application. A timeout cannot undo effects of a tool that already started; callers own tool authorization and idempotency.

## Tests actually completed

Command: `rtk proxy python3 -m unittest discover -s tools/pipeline/local -p test_mcp_client.py -v`

Result: **15 tests passed in 2.681 seconds** on the connected macOS host. Offline fixture tests cover handshake/initialized ordering, Unicode arguments, full structured results, tool errors, safe JSON-RPC errors, pagination and cycles, request and initialization timeout, process death, unsupported versions, large/malformed/truncated messages, stderr pressure and capture bound, server ping and unsupported request replies, notification-flood deadline, stdin backpressure, process-group cleanup after parent exit, and safe invalid-command failure.

Later combined-suite verification exposed a fixture race: an unbounded notification producer could correctly reach the queue cap before the intended deadline assertion. The deadline fixture now emits at 100 notifications/second and still requires `MCPTimeoutError`, observed notifications, bounded elapsed time, and cleanup. A separate deterministic 1,025-message batch asserts the distinct queue-cap error and cleanup. Transport behavior was not weakened. Full local discovery (`rtk proxy python3 -m unittest discover -s tools/pipeline/local -p 'test_*.py' -v`) then passed **57 tests in 5.798 seconds**, including 16 MCP tests, on 2026-09-09.

## Real read-only check

Evidence: [read-only-check.json](read-only-check.json).

The already-cached `uvx --offline blender-mcp==1.9.1` server initialized successfully and advertised **28 tools**. `get_scene_info` completed with `isError: false`; its parsed scene result reported **94 objects**, with 10 objects in its capped detail list. The MCP child exited with return code 0. Package network downloads were disabled; no Blender scene edits, save, foreground replacement, or pipeline asset generation was performed.

This proves connection and read-only scene inspection on the currently connected host. Full modeling/export workflows, target Mac Studio execution, Windows transport, concurrent use of one client instance, and third-party MCP servers were not tested. The implementation intentionally supports POSIX only and one synchronous request at a time.

## Protocol sources checked

- [MCP stdio transport specification](https://modelcontextprotocol.io/specification/2025-06-18/basic/transports): newline-delimited UTF-8 JSON-RPC and separate stderr logging.
- [MCP lifecycle specification](https://modelcontextprotocol.io/specification/2025-03-26/basic/lifecycle): initialize/initialized sequence, version negotiation, deadlines, and stdio shutdown.
- [MCP tools specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools): tools/list pagination, tools/call, structuredContent, and separation of tool versus JSON-RPC errors.

## Bounded Qwen orchestration bridge

`tools/pipeline/local/qwen_agent.py` now implements actual Chat Completions tool roundtrips, continuing inference with `role: tool` results after executing allowlisted Python operations. It is separate from the earlier schema-only probe. Example invocation, after configuring a real available model:

```sh
rtk proxy python3 tools/pipeline/local/qwen_agent.py \
  --config tools/pipeline/local/config.m5max64.example.json \
  --catalog tools/pipeline/local/jobs.godot.example.json \
  --job godot-tiger-world \
  --output artifacts/pipeline/local-mcp/new-qwen-run.json --run
```

The selected job is the trusted task anchor. The bridge validates the reviewed catalog, verifies the selected asset exists in registry and queue, and permits only `inspect_asset(asset_id)`, `read_blender_scene()`, and `run_validation(job_id)`. Validation jobs must match the task's exact `(asset_id, world_placement)` pair; related asset IDs do not widen scope. All calls in a model batch are validated before the first executes. The model cannot supply code, command arguments, file paths, another catalog, or arbitrary MCP tool names. Repeated validation requests reuse the current session's first result. Blender reading returns counts with `sceneScopeVerified: false`, so an unrelated currently open scene cannot become task evidence.

Maximums are 6 inference rounds, 12 tool calls, 32 KiB per assistant message, 2 KiB tool arguments, 8 KiB per returned tool summary, and 8 MiB per registry/queue/catalog read. Configured HTTP socket timeout is clamped to 0.1–60 seconds, using the existing guarded `common.request_json` transport with its 1 MiB response limit. Loop requests are serial; validation runtimes additionally follow reviewed catalog bounds. Endpoint use requires `qwen.configured: true`, a model found in `/models`, and the existing local-endpoint guard (nonlocal needs explicit `--allow-nonlocal`). CLI requires `--run` and exclusive creation of a new report.

The transcript and model final text are never written to reports. Reports record fixed statuses and counts; `taskValidationPassed` is set only from the selected runner job result. A model final response only completes the orchestration loop. It never implies validation pass, visual approval, gameplay acceptance, or art-stage promotion. CLI exit 0 requires both a completed loop and `taskValidationPassed: true`; a conversational finish alone exits 1. Runner `blocked` is preserved as a validation outcome. Modeling/edit operations and production Qwen inference remain pending.

**Verification:** `rtk proxy python3 -m unittest discover -s tools/pipeline/local -p test_qwen_agent.py -v` passed **15 tests in 0.804 seconds** after the image-input update. Tests run a real localhost HTTP fixture and confirm actual tool results in continuation messages. Blender and validation workers are stubs: no Godot job or scene edit is launched. Tests cover scoped tool/schema rejection before effects, cross-world rejection for the same asset, unavailable/missing models, call/round/duplicate bounds, repeated job reuse, safe reports, timeout clamping, endpoint restriction, explicit CLI execution, report preservation, image message delivery, pre-chat image rejection, CLI task-pass semantics, and the runner's blocked state.

The example configuration was executed through the CLI and correctly returned `not_configured`, zero rounds and zero tools: [qwen-agent-not-configured.json](qwen-agent-not-configured.json). This is truthful configuration evidence, not a claim of real Qwen inference or target-machine deployment.

Tool continuation format was checked against the [official function-calling guide](https://developers.openai.com/api/docs/guides/function-calling). OpenAI-compatible behavior is verified with the local fixture only; compatibility of the user's eventual Qwen service remains to be tested.

### Reviewed catalog images

The selected catalog job may declare `visual_inputs`, for example:

```json
"visual_inputs": [
  {"path": "artifacts/reference.png", "type": "reference"},
  {"path": "artifacts/render.jpg", "type": "render"}
]
```

At most two images are accepted, each at most 3 MiB. Paths must be project-relative and resolve to files inside the project; absolute paths, traversal outside the root, and symlinks pointing outside are rejected before model chat. MIME is derived from PNG/JPEG magic bytes, not file extension. Magic validation does not establish that the whole image decodes correctly.

Only the selected trusted catalog entry can provide images. Model messages cannot add image paths. The user message receives labeled reference/render image parts as base64 data URLs; reports retain only total image count and each image's type, MIME, byte count, and SHA-256. No image data, image URL, model transcript, or model final text is persisted in the report.

`visionStatus` remains `pending` until an image-bearing chat request returns, then becomes `submitted_not_validated`. This confirms submission, not model decoding, visual reasoning quality, or acceptance. If no configured model exists, no image chat is sent and the status stays pending. The HTTP fixture verifies both MIME types arriving and the absence of raw images in reports; real Qwen multimodal inference has not been tested.
