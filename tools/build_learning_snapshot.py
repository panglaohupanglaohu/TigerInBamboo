"""Write the learning snapshot to a static path so GitHub Pages can serve it.

The learning workshop fetches `../../../api/workshop/learning-snapshot` relative to
`src/scene-authoring/learning-workshop.js`, which resolves to `<site>/api/workshop/...`
on GitHub Pages (site root is /TigerInBamboo/). Locally that route is served by the
FastAPI backend; on Pages there is no server, so the same path is committed as a static
file. Re-run this after changing anything under `townscaper-web/REACodeRefactoring/learn/`.
"""
from pathlib import Path
import json, sys

root = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(root))
from backend.learning_snapshot import learning_snapshot  # noqa: E402

target = root / 'api' / 'workshop' / 'learning-snapshot'
snapshot = learning_snapshot(root / 'townscaper-web' / 'REACodeRefactoring')
target.parent.mkdir(parents=True, exist_ok=True)
target.write_text(json.dumps(snapshot, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
print(f'wrote {target.relative_to(root)} {target.stat().st_size} bytes snapshotId={snapshot["snapshotId"]}')
