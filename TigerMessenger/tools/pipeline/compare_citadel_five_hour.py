"""Compare exported real-scene reports; never turns visual scores into a pass."""
import argparse
import json
from pathlib import Path


def compare(before, after):
    a, b = before['report'], after['report']
    result = {}
    for kind in ('walkable', 'architecture'):
        left = {r['path']: r for r in a[kind]['items']}
        right = {r['path']: r for r in b[kind]['items']}
        changed = [p for p in sorted(left.keys() | right.keys()) if left.get(p) != right.get(p)]
        result[kind] = dict(before=len(left), after=len(right), changed=len(changed), changedPaths=changed)
        if kind == 'architecture':
            result[kind]['unclassified'] = [p for p in changed if '/highland-hero-cloud-blobs[' not in p and '/holy-old-town-waterfall[' not in p]
    result['railCurvesEqual'] = a['railCurveProtection']['items'] == b['railCurveProtection']['items']
    result['railHits'] = b['rail']['hitCount']
    result['railProbes'] = b['rail']['tests']
    result['minSeaClearance'] = b['rail']['minSeaClearance']
    groups = {}
    for row in b['roots']['items']:
        groups.setdefault(row['name'], []).append(row['signedRadialGap'])
    result['roots'] = {}
    for name, values in groups.items():
        valid = [v for v in values if v is not None]
        result['roots'][name] = dict(count=len(values), missing=len(values)-len(valid), min=min(valid, default=None), max=max(valid, default=None), above2mm=sum(v > .002 for v in valid), below2cm=sum(v < -.02 for v in valid))
    result['shaderStatus'] = b['shader']['status']
    result['glErrors'] = b['shader']['glErrors']
    result['pageErrors'] = after['errors']
    result['samplingStatus'] = b['status']
    result['limitations'] = 'Discrete railway and root samples; clouds/waterfall changes classified by exact ancestor names. No full navigation, canopy shadow, visual acceptance or GPU timing claim.'
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('before', type=Path)
    parser.add_argument('after', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    result = compare(json.loads(args.before.read_text()), json.loads(args.after.read_text()))
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k: v for k, v in result.items() if k not in ('architecture', 'walkable')}, ensure_ascii=False))
    print('walkable changes:', result['walkable']['changed'], 'unclassified architecture:', len(result['architecture']['unclassified']))
