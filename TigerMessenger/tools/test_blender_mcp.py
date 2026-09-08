import asyncio, json, os
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

async def main():
    env = dict(os.environ, DISABLE_TELEMETRY='true', BLENDER_HOST='127.0.0.1', BLENDER_PORT='9876')
    params = StdioServerParameters(command='/Users/panglaohu/.local/bin/uvx', args=['--from', 'blender-mcp==1.9.1', 'blender-mcp'], env=env)
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            listed = await session.list_tools()
            result = await session.call_tool('get_scene_info', {'user_prompt': 'Verify the authorized TigerMessenger Blender MCP connection by reading the current scene only.'})
            report = {'mcpHandshake': True, 'toolCount': len(listed.tools), 'toolNames': [t.name for t in listed.tools], 'sceneReadIsError': result.isError, 'scene': [c.text for c in result.content if c.type == 'text']}
            out = Path(__file__).resolve().parents[1] / 'artifacts/blender-mcp-check.json'
            out.parent.mkdir(exist_ok=True)
            out.write_text(json.dumps(report, ensure_ascii=False, indent=2))
            assert not result.isError
            print(json.dumps(report, ensure_ascii=False))

asyncio.run(main())
