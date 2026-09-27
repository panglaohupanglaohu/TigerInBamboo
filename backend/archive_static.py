"""Serve only explicit artifact links into the local, fixed archive object store."""
import os
from pathlib import Path
from fastapi.staticfiles import StaticFiles


class ArchiveStaticFiles(StaticFiles):
    def __init__(self, *, directory, archive_objects, **kwargs):
        super().__init__(directory=directory, **kwargs)
        self.project_root = Path(directory).resolve()
        self.archive_objects = Path(archive_objects).resolve()

    def lookup_path(self, path):
        full_path, stat = super().lookup_path(path)
        if stat is not None:
            return full_path, stat
        candidate = Path(os.path.abspath(self.project_root / path))
        try:
            relative = candidate.relative_to(self.project_root)
            allowed = relative.parts[0] == 'artifacts' or relative.parts[:3] == ('assets', 'models', 'optimized')
            if not allowed or not candidate.is_symlink():
                return '', None
            destination = candidate.resolve(strict=True)
            destination.relative_to(self.archive_objects)
            if not destination.is_file():
                return '', None
            return str(destination), destination.stat()
        except (OSError, ValueError, IndexError):
            return '', None
