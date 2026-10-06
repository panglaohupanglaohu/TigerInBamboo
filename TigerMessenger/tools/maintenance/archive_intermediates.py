#!/usr/bin/env python3
"""Reversible cold-artifact offload. Default is a read-only plan."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

PROJECT = Path(__file__).resolve().parents[2]
DEFAULT_ARCHIVE = PROJECT.parent.parent / 'TigerMessenger-Archive'
EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp', '.mp4', '.blend', '.blend1', '.blend2', '.glb', '.gltf', '.zip', '.exr'}
PINNED = {'city-gate-expansion', 'crystal-twelve-clusters', 'holy-city-style-v2', 'tiger-target-v1-ten-rounds', 'swamp-v2-fifty-rounds', 'citadel-living-slopes', 'old-tower-crown', 'citadel-vegetation', 'citadel-landform-rebuild'}

def digest(path):
    h = hashlib.sha256()
    with path.open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()

def atomic_json(path, value):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    os.replace(tmp, path)

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--restore', action='store_true', help='Restore all unchanged links from this project manifest')
    parser.add_argument('--days', type=int, default=7)
    parser.add_argument('--archive', type=Path, default=DEFAULT_ARCHIVE)
    args = parser.parse_args()
    if args.days < 7:
        parser.error('Minimum retention is 7 days')
    archive = args.archive.expanduser().resolve()
    if archive.is_relative_to(PROJECT.parent):
        parser.error('Archive must be outside the entire repository')
    if args.restore:
        manifest = archive / 'manifest.json'
        records = json.loads(manifest.read_text())
        restored = 0
        for item in records:
            if item['project'] != str(PROJECT):
                continue
            p = PROJECT / item['path']
            blob = archive / item['blob']
            if not p.is_symlink() or p.resolve() != blob or digest(blob) != item['sha256']:
                continue
            if args.apply:
                fd, name = tempfile.mkstemp(dir=p.parent, prefix='.restore-')
                os.close(fd)
                temp = Path(name)
                import shutil
                shutil.copy2(blob, temp)
                temp.chmod(item.get("mode", 0o644))
                os.replace(temp, p)
            restored += 1
        print(json.dumps({'restore_files': restored, 'applied': args.apply}))
        return
    git_root = Path(subprocess.check_output(['git', '-C', str(PROJECT), 'rev-parse', '--show-toplevel'], text=True).strip())
    tracked = {git_root / p for p in subprocess.check_output(['git', '-C', str(git_root), 'ls-files', '-z']).decode().split('\0') if p}
    candidates = []
    tracked_bytes = 0
    cutoff = time.time() - args.days * 86400
    for base in [PROJECT / 'artifacts', PROJECT / 'assets/models/optimized']:
        for p in sorted(base.rglob('*')):
            if p.is_symlink() or not p.is_file() or p.suffix.lower() not in EXTENSIONS:
                continue
            if any(parent.is_symlink() for parent in p.parents):
                continue
            if base.name == 'optimized' and p.suffix.lower() not in {'.blend', '.blend1', '.blend2'}:
                continue
            rel = p.relative_to(PROJECT)
            if (PINNED.intersection(rel.parts)
                    or any('target' in part.lower() for part in rel.parts)
                    or 'approved' in p.name.lower()):
                continue
            stat = p.stat()
            if stat.st_mtime > cutoff:
                continue
            if p in tracked:
                tracked_bytes += stat.st_size
                continue
            candidates.append((p, stat))
    result = {'project': str(PROJECT), 'archive': str(archive), 'retention_days': args.days,
              'files': len(candidates), 'bytes': sum(s.st_size for _, s in candidates),
              'tracked_cold_bytes_kept': tracked_bytes, 'applied': args.apply}
    if not args.apply:
        print(json.dumps({**result, 'paths': [str(p.relative_to(PROJECT)) for p, _ in candidates]}, ensure_ascii=False, indent=2))
        return
    archive.mkdir(parents=True, exist_ok=True)
    lock = archive / '.archive.lock'
    fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    try:
        os.close(fd)
        manifest = archive / 'manifest.json'
        records = json.loads(manifest.read_text()) if manifest.exists() else []
        moved = 0
        saved = 0
        import shutil
        for p, initial in candidates:
            if p.is_symlink() or p.stat().st_mtime_ns != initial.st_mtime_ns:
                continue
            sha = digest(p)
            blob = archive / 'objects' / sha[:2] / (sha + p.suffix.lower())
            blob.parent.mkdir(parents=True, exist_ok=True)
            if not blob.exists():
                temp = blob.with_suffix(blob.suffix + '.tmp')
                shutil.copy2(p, temp)
                if digest(temp) != sha:
                    raise RuntimeError('Copy verification failed: ' + str(p))
                os.replace(temp, blob)
            elif digest(blob) != sha:
                raise RuntimeError('Archive checksum mismatch: ' + str(blob))
            if p.stat().st_mtime_ns != initial.st_mtime_ns or digest(p) != sha:
                continue
            blob.chmod(0o444)  # Existing links must not silently mutate the archive.
            records = [r for r in records if (r['project'], r['path']) != (str(PROJECT), str(p.relative_to(PROJECT)))]
            records.append({'project': str(PROJECT), 'path': str(p.relative_to(PROJECT)),
                            'blob': str(blob.relative_to(archive)), 'sha256': sha,
                            'bytes': initial.st_size, 'mode': initial.st_mode & 0o777, 'archived_at': time.time()})
            atomic_json(manifest, records)  # Record recovery information before changing source.
            temp_link = p.with_name('.' + p.name + '.archive-link')
            temp_link.symlink_to(blob)
            os.replace(temp_link, p)
            moved += 1
            saved += initial.st_size
        atomic_json(archive / 'last-run.json', {**result, 'moved_files': moved, 'offloaded_bytes': saved})
        print(json.dumps({**result, 'moved_files': moved, 'offloaded_bytes': saved}, ensure_ascii=False))
    finally:
        lock.unlink(missing_ok=True)

if __name__ == '__main__':
    main()
