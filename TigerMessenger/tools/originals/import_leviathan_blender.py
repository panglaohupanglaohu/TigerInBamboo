"""Background-only adapter for the immutable original leviathan snapshot."""
from pathlib import Path
here=Path(__file__).resolve().parent
original=here/'import_blender.py'
code=original.read_text()
old="source=root/'assets/models/originals'/f'{asset}.source.json'"
new="source=root/'assets/models/originals/leviathan'/f'{asset}.source.json'"
if code.count(old)!=1:raise RuntimeError('Review original importer adapter')
exec(compile(code.replace(old,new),str(original),'exec'),{'__name__':'__main__','__file__':str(original)})
