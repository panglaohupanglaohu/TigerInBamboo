import bpy
import sys

print("Blender script executing successfully!")
print("Scene:", bpy.context.scene.name)
print("Camera:", bpy.context.scene.camera.name if bpy.context.scene.camera else "None")

for obj in bpy.data.objects:
    if obj.type == 'MESH':
        print(f"  Mesh: {obj.name}, verts={len(obj.data.vertices)}, polys={len(obj.data.polygons)}")
