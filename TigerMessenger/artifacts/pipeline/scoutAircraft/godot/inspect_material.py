import bpy,json
bpy.ops.wm.open_mainfile(filepath='/Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger/assets/models/optimized/scoutAircraft-art-v1.blend')
o=next(o for o in bpy.data.objects if o.get('three_node_id')=='n1')
m=o.data.materials[0]
print(json.dumps({'material':m.name,'diffuse':list(m.diffuse_color),'nodes':[{'name':n.name,'type':n.type,'inputs':{i.name:str(i.default_value) for i in n.inputs if hasattr(i,'default_value')},'outputs':{i.name:str(i.default_value) for i in n.outputs if hasattr(i,'default_value')}} for n in m.node_tree.nodes],'links':[(l.from_node.name,l.from_socket.name,l.to_node.name,l.to_socket.name) for l in m.node_tree.links]},indent=2))
