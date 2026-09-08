"""Reuse the existing original importer for the supplemental archive only.
Usage: Blender --background --python-exit-code 1 --python this_file -- scoutAircraft
Writes supplemental/blender-r3/<id>.blend, never the original 72 archive.
"""
import json, sys
from pathlib import Path
here = Path(__file__).resolve().parent
root = here.parents[1]
asset = sys.argv[sys.argv.index('--') + 1]
catalog = json.loads((root / 'assets/models/originals/supplemental/catalog.json').read_text())
if asset not in {row['id'] for row in catalog['entries']}:
    raise ValueError('Unknown supplemental asset: ' + asset)
original = here / 'import_blender.py'
code = original.read_text()
old = "source=root/'assets/models/originals'/f'{asset}.source.json'"
new = "source=root/'assets/models/originals/supplemental'/f'{asset}.source.json'"
if code.count(old) != 1:
    raise RuntimeError('Original importer changed; review adapter before continuing')
exec(compile(code.replace(old, new), str(original), 'exec'), {'__name__': '__main__', '__file__': str(original)})
