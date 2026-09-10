import bpy,importlib.util,sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[3]
spec=importlib.util.spec_from_file_location('vanguard',ROOT/'tools/pipeline/build_vanguard_battle_blender.py');v=importlib.util.module_from_spec(spec);spec.loader.exec_module(v)
bpy.ops.wm.open_mainfile(filepath=str(v.OUT/'vanguard-battle-v1.blend'));sc=bpy.context.scene
sc.frame_set(31);v.render('aim-front.png',direction=(0,-5,0));v.render('aim-top.png',direction=(0,-.001,5));v.render('aim-three-quarter.png')
if '--aim-only' not in sys.argv:
 sc.frame_set(1);v.render('idle-three-quarter.png');v.render('idle-hand-detail.png',['n54','n60','add:blade-guard','n52']);v.render('idle-cannon-detail.png',['n39','n40','n42','n44','n46','add:cannon-axis','add:cannon-fork--1','add:cannon-fork-1','n28','n34','add:cannon-foot'])
 for name,frame in [('slash',61),('stagger',101),('rope',131)]:sc.frame_set(frame);v.render(name+'-three-quarter.png')
