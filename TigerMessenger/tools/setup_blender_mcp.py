"""Enable the installed MCP add-on in the active Blender without saving its scene."""
import bpy, addon_utils, os
os.environ['DISABLE_TELEMETRY'] = 'true'
bpy.utils.refresh_script_paths()
addon_utils.modules_refresh()
addon_utils.enable('blender_mcp', default_set=True, persistent=True)
prefs = bpy.context.preferences.addons['blender_mcp'].preferences
prefs.telemetry_consent = False
bpy.ops.wm.save_userpref()
server = getattr(bpy.types, 'blendermcp_server', None)
if not server or not server.running:
    bpy.ops.blendermcp.start_server()
print('TIGERMESSENGER_MCP_READY', bool(bpy.types.blendermcp_server.running))
