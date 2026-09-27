import bpy

head = bpy.data.objects.get('head')
if head:
    print("Children of head:")
    for child in head.children_recursive:
        print(f"  {child.name} (type={child.type})")
