import bpy

head = bpy.data.objects.get('head')
if head:
    print(f"head location: {head.location}")
    print(f"head rotation_euler: {head.rotation_euler}")
    print(f"head scale: {head.scale}")
    print(f"head matrix_world translation: {head.matrix_world.translation}")

body = bpy.data.objects.get('body')
if body:
    print(f"body location: {body.location}")
    print(f"body matrix_world translation: {body.matrix_world.translation}")

neck = bpy.data.objects.get('Neck')
if neck:
    print(f"neck location: {neck.location}")
    print(f"neck matrix_world translation: {neck.matrix_world.translation}")

