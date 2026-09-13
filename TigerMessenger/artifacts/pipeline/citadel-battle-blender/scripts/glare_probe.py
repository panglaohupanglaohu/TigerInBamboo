import bpy, json
ng = bpy.data.node_groups.new("G", "CompositorNodeTree")
n = ng.nodes.new("CompositorNodeGlare")
info = {"props": [p.identifier for p in n.bl_rna.properties if not p.is_readonly][:60],
        "inputs": [i.name for i in n.inputs], "outputs": [o.name for o in n.outputs]}
print("GLARE_PROBE", json.dumps(info))
