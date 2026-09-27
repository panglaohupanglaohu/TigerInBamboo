"""Exact non-coplanar surface intersection refinement of conservative Kun contacts.

Input is an explicit Godot geometry capture, never a fabricated/approximated model.
Coplanar, degenerate and possible containment cases are reported as uncertain.
No Blender/Godot process is launched. Dependencies: numpy.
"""
import argparse
import hashlib
import json
from pathlib import Path

import numpy as np

EPS = 1e-7
MAX_POINTS = 64


def triangles(faces):
    a = np.asarray(faces, dtype=np.float64)
    if a.size % 9:
        raise ValueError("Faces must contain complete triangles")
    a = a.reshape(-1, 3, 3)
    if not np.isfinite(a).all():
        raise ValueError("Nonfinite geometry")
    return a


def transformed(faces, matrix):
    # Godot basis columns, then origin, exported as a 4x4 column-major matrix.
    m = np.asarray(matrix, dtype=np.float64).reshape(4, 4, order="F")
    if not np.allclose(m[3], [0, 0, 0, 1], atol=EPS):
        raise ValueError("Expected affine column-major 4x4 matrix")
    return faces @ m[:3, :3].T + m[:3, 3]


def bounds(t):
    return t.min(axis=(0, 1)), t.max(axis=(0, 1))


def overlap(a, b):
    return np.all(a[0] <= b[1] + EPS) and np.all(b[0] <= a[1] + EPS)


def contains(a, b):
    return bool(np.all(a[0] <= b[0] + EPS) and np.all(a[1] >= b[1] - EPS))


def segment_hits(start, end, tri):
    """Double-sided Moller-Trumbore; endpoint/edge contacts count as contact."""
    direction = end - start
    e1 = tri[:, 1] - tri[:, 0]
    e2 = tri[:, 2] - tri[:, 0]
    p = np.cross(direction, e2)
    det = np.einsum("ij,ij->i", e1, p)
    scale = np.linalg.norm(direction, axis=1)*np.linalg.norm(e1, axis=1)*np.linalg.norm(e2, axis=1)
    valid = np.abs(det) > EPS*np.maximum(scale, 1e-15)
    inv = np.zeros_like(det)
    np.divide(1.0, det, out=inv, where=valid)
    delta = start-tri[:, 0]
    u = np.einsum("ij,ij->i", delta, p)*inv
    q = np.cross(delta, e1)
    v = np.einsum("ij,ij->i", direction, q)*inv
    t = np.einsum("ij,ij->i", e2, q)*inv
    valid &= (u >= -EPS) & (v >= -EPS) & (u+v <= 1+EPS) & (t >= -EPS) & (t <= 1+EPS)
    return valid, start+direction*t[:, None]


def inspect(a, b):
    ba, bb = bounds(a), bounds(b)
    if not overlap(ba, bb):
        return {"status": "clear", "broad_pairs": 0, "intersecting_triangle_pairs": 0,
                "contact_points": [], "uncertain_reasons": []}
    amin, amax = a.min(axis=1), a.max(axis=1)
    bmin, bmax = b.min(axis=1), b.max(axis=1)
    broad_count = crossings = coplanar_count = degenerate_count = 0
    points = set()
    # Bounded pair matrices: actual candidates are few, but never allocate an
    # unbounded all-mesh triangle Cartesian product.
    for offset in range(0, len(a), 128):
        for other in range(0, len(b), 2048):
            mask = np.all(amin[offset:offset+128, None] <= bmax[None, other:other+2048]+EPS, axis=2)
            mask &= np.all(bmin[None, other:other+2048] <= amax[offset:offset+128, None]+EPS, axis=2)
            ai, bi = np.nonzero(mask)
            if not len(ai):
                continue
            broad_count += len(ai)
            aa, bt = a[ai+offset], b[bi+other]
            na = np.cross(aa[:, 1]-aa[:, 0], aa[:, 2]-aa[:, 0])
            nb = np.cross(bt[:, 1]-bt[:, 0], bt[:, 2]-bt[:, 0])
            la, lb = np.linalg.norm(na, axis=1), np.linalg.norm(nb, axis=1)
            degenerate = (la < EPS**2) | (lb < EPS**2)
            degenerate_count += int(degenerate.sum())
            parallel = np.linalg.norm(np.cross(na, nb), axis=1) <= EPS*la*lb
            distance = np.abs(np.einsum("ij,ij->i", bt[:, 0]-aa[:, 0], na))
            coplanar = parallel & (distance <= EPS*la) & ~degenerate
            coplanar_count += int(coplanar.sum())
            hit_pair = np.zeros(len(ai), dtype=bool)
            for source, target in [(aa, bt), (bt, aa)]:
                for edge in range(3):
                    hit, locations = segment_hits(source[:, edge], source[:, (edge+1) % 3], target)
                    hit &= ~coplanar & ~degenerate
                    hit_pair |= hit
                    if len(points) < MAX_POINTS:
                        for p in locations[hit]:
                            points.add(tuple(np.round(p, 7)))
                            if len(points) >= MAX_POINTS:
                                break
            crossings += int(hit_pair.sum())
    uncertain = []
    if coplanar_count:
        uncertain.append("coplanar_triangle_pairs_require_2d_refinement")
    if degenerate_count:
        uncertain.append("degenerate_triangle_pairs")
    # Disjoint surfaces can still bound enclosed solids. Imported meshes are
    # not guaranteed watertight, so never claim volume separation in this case.
    containment = contains(ba, bb) or contains(bb, ba)
    if containment and crossings == 0:
        uncertain.append("possible_complete_containment_not_resolved")
    return {"status": "surface_contact" if crossings else ("uncertain" if uncertain else "clear"),
            "broad_pairs": broad_count, "intersecting_triangle_pairs": crossings,
            "coplanar_candidate_pairs": coplanar_count, "degenerate_candidate_pairs": degenerate_count,
            "contact_points": [list(p) for p in sorted(points)],
            "contact_points_capped": len(points) >= MAX_POINTS, "uncertain_reasons": uncertain}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("input", nargs="?", default="/tmp/tigermessenger-kun-contact-geometry.json")
    parser.add_argument("--output", default=str(Path(__file__).resolve().parents[2]/"artifacts/pipeline/saihoji-target-integration/kun-exact-contacts.json"))
    args = parser.parse_args()
    raw = Path(args.input).read_bytes()
    data = json.loads(raw)
    trees = {}
    for tree in data["trees"]:
        t = triangles(tree["faces"])
        if len(t): trees.setdefault(str(tree["seed"]), []).append((tree["id"], t, bounds(t)))
    models = {key: {m["name"]: triangles(m["faces"]) for m in meshes} for key, meshes in data["models"].items()}
    rows = []
    for case in data["cases"]:
        model = models[f'{case["role"]}:{case["pose"]}']
        seen = set()
        for candidate in case["candidate_meshes"]:
            name = candidate["mesh"]
            if name in seen: continue
            seen.add(name)
            base = {k: case[k] for k in ["id", "role", "pose", "yaw_degrees"]}
            base.update(mesh=name)
            if name not in model or not len(model[name]):
                rows.append(dict(base, status="uncertain", uncertain_reasons=["missing_or_empty_geometry"]))
                continue
            a = transformed(model[name], case["matrix"])
            actor_bounds = bounds(a)
            checked = 0
            # The coarse capture recorded only the first matching seed. Check
            # every tree here to avoid treating that truncated seed as scope.
            for seed, meshes in trees.items():
                for tree_id, b, tree_bounds in meshes:
                    if not overlap(actor_bounds, tree_bounds): continue
                    checked += 1
                    rows.append(dict(base, pine_seed=seed, tree_id=tree_id, **inspect(a, b)))
            if not checked:
                rows.append(dict(base, status="clear", uncertain_reasons=[], reason="no_tree_3d_bounds_overlap"))
    counts = {status: sum(r["status"] == status for r in rows) for status in ["clear", "surface_contact", "uncertain"]}
    result = {"audit_completed": True,"layout_sha256":data.get("layout_sha256"),"cover_sha256":data.get("cover_sha256"), "input_sha256": hashlib.sha256(raw).hexdigest(),
              "coordinates": "all meshes transformed into input tree coordinate frame; contact points use same frame",
              "method": "true triangle AABB broad phase and bidirectional vectorized triangle-edge segment intersections; double-sided, endpoints included",
              "limits": "surface contacts can be touching or crossing, not penetration-depth proof; coplanar/degenerate and complete-containment candidates are uncertain; only supplied coarse candidate cases/meshes/poses/orientations, but every tree is checked regardless of coarse first-match seed; no clearance claim for other cases or animation sweeps",
              "epsilon": EPS, "input_cases": len(data["cases"]), "pair_counts": counts,
              "cases_with_surface_contact": sorted({r["id"] for r in rows if r["status"] == "surface_contact"}),
              "uncertain_rows_including_contact": sum(bool(r["uncertain_reasons"]) for r in rows), "rows": rows}
    Path(args.output).write_text(json.dumps(result, ensure_ascii=False, indent=2))
    print(json.dumps({"output":args.output,"input_cases":len(data["cases"]),"pair_counts":counts,"contact_slots":result["cases_with_surface_contact"]},ensure_ascii=False))


if __name__ == "__main__": main()
