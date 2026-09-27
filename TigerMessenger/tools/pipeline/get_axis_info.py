import bpy

for name in ['Face', 'Nose', 'Hair_target_top', 'Sun_brooch', 'Belt_buckle']:
    obj = bpy.data.objects.get(name)
    if obj and obj.type == 'MESH':
        bbox = [obj.matrix_world @ v.co for v in obj.data.vertices]
        min_x = min(v.x for v in bbox); max_x = max(v.x for v in bbox)
        min_y = min(v.y for v in bbox); max_y = max(v.y for v in bbox)
        min_z = min(v.z for v in bbox); max_z = max(v.z for v in bbox)
        print(f"{name}: X=[{min_x:.3f}, {max_x:.3f}], Y=[{min_y:.3f}, {max_y:.3f}], Z=[{min_z:.3f}, {max_z:.3f}]")

