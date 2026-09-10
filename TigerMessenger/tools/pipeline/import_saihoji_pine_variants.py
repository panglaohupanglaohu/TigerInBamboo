"""Blender background batch: preserve the 25 seed-specific source archives."""
import bpy, json, runpy, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
SOURCE=ROOT/'assets/models/originals/saihoji-pines-r1'
manifest=json.loads((SOURCE/'manifest.json').read_text())
for item in manifest['files']:
    name=f"ancient-pine-{item['seed']}"
    destination=SOURCE/'blender-r3'/f'{name}.blend'
    if destination.exists():
        raise RuntimeError('Archive already exists; never overwrite: '+str(destination))
for item in manifest['files']:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sys.argv=['blender','--',f"saihoji-pines-r1/ancient-pine-{item['seed']}"]
    runpy.run_path(str(ROOT/'tools/originals/import_blender.py'),run_name='__main__')
print('SAIHOJI_PINE_ARCHIVES_COMPLETE',len(manifest['files']))
