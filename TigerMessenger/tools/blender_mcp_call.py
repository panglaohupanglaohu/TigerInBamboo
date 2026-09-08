import asyncio, json, os
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

import sys
async def main():
    env = dict(os.environ, DISABLE_TELEMETRY='true', BLENDER_HOST='127.0.0.1', BLENDER_PORT='9876')
    params = StdioServerParameters(command='/Users/panglaohu/.local/bin/uvx', args=['--from', 'blender-mcp==1.9.1', 'blender-mcp'], env=env)
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            if len(sys.argv) == 1:
                listed = await session.list_tools()
                print(json.dumps([t.model_dump() for t in listed.tools if t.name in ['execute_blender_code','get_viewport_screenshot']], indent=2))
                return
            job = json.loads(Path(sys.argv[1]).read_text())
            result = await session.call_tool(job['tool'], job['arguments'])
            print(result.model_dump_json())
            if result.isError: raise RuntimeError('MCP tool failed')
asyncio.run(main())
