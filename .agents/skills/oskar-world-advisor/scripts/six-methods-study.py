"""Self-authored mechanism exercises, NOT Oskar source or runtime acceptance.

Hex river CSP uses observe/propagate/backtrack, with DFS frontier preference;
then terrain heights use BFS ordering. Global river connectivity is checked
separately. Shader checks are mathematical contracts, not rendered validation.
"""
import importlib.util
import itertools
import json
import math
import random
from collections import deque
from pathlib import Path

DIR = [(1, 0), (0, 1), (-1, 1), (-1, 0), (0, -1), (1, -1)]


def hex_graph(radius):
    cells = [(q, r) for q in range(-radius, radius + 1)
             for r in range(-radius, radius + 1) if abs(q + r) <= radius]
    index = {c: i for i, c in enumerate(cells)}
    graph = [{d: index[q + a, r + b] for d, (a, b) in enumerate(DIR)
              if (q + a, r + b) in index} for q, r in cells]
    return cells, graph


def rotate(mask, steps):
    steps %= 6
    return ((mask << steps) | (mask >> (6 - steps))) & 63


def propagate(domains, graph):
    queue = deque(range(len(graph)))
    while queue:
        a = queue.popleft()
        if not domains[a]:
            return False
        for d, b in graph[a].items():
            possible = {(m >> d) & 1 for m in domains[a]}
            allowed = {n for n in domains[b] if ((n >> ((d + 3) % 6)) & 1) in possible}
            if allowed != domains[b]:
                domains[b] = allowed
                if not allowed:
                    return False
                queue.append(b)
    return True


def connected_solution(masks, graph, source, sink):
    seen, pending = set(), [source]
    while pending:
        a = pending.pop()
        if a in seen:
            continue
        seen.add(a)
        pending += [b for d, b in graph[a].items() if masks[a] & (1 << d)]
    return sink in seen and seen == {i for i, m in enumerate(masks) if m}


def river_exercise():
    cells, graph = hex_graph(2)
    source, sink = cells.index((-2, 0)), cells.index((2, 0))
    domains = []
    for i, edges in enumerate(graph):
        if i in (source, sink):
            domains.append({1 << d for d in edges})
        else:
            domains.append({0} | {(1 << a) | (1 << b) for a, b in itertools.combinations(edges, 2)})
    rng, stats = random.Random(176969), {'observations': 0, 'backtracks': 0}

    def solve(dom, frontier):
        if stats['observations'] > 100000:
            raise RuntimeError('Budget exhausted, not solved')
        if not propagate(dom, graph):
            return None
        remaining = [i for i, options in enumerate(dom) if len(options) > 1]
        if not remaining:
            result = [next(iter(s)) for s in dom]
            return result if connected_solution(result, graph, source, sink) else None
        stack = list(frontier)
        while stack and len(dom[stack[-1]]) == 1:
            stack.pop()
        cell = stack.pop() if stack else min(remaining, key=lambda i: (len(dom[i]), i))
        choices = sorted(dom[cell]); rng.shuffle(choices)
        choices.sort(key=lambda m: m == 0)  # Try river continuation before empty land.
        for mask in choices:
            stats['observations'] += 1
            candidate = [s.copy() for s in dom]
            candidate[cell] = {mask}
            follow = [b for d, b in graph[cell].items() if mask & (1 << d)]
            result = solve(candidate, stack + follow)
            if result is not None:
                return result
            stats['backtracks'] += 1
        return None

    masks = solve(domains, [source])
    assert masks is not None
    assert connected_solution(masks, graph, source, sink)
    for a, edges in enumerate(graph):
        assert bin(masks[a]).count('1') == (1 if a in (source, sink) else 2 if masks[a] else 0)
        for d, b in edges.items():
            assert bool(masks[a] & (1 << d)) == bool(masks[b] & (1 << ((d + 3) % 6)))
    # Observe terrain outward in BFS distance from already resolved river.
    distance = {i: 0 for i, m in enumerate(masks) if m}
    queue = deque(distance)
    while queue:
        a = queue.popleft()
        for b in graph[a].values():
            if b not in distance:
                distance[b] = distance[a] + 1
                queue.append(b)
    height_domains = [{0} if masks[i] else set(range(4)) for i in range(len(graph))]

    def height_propagation():
        changed = True
        while changed:
            changed = False
            for a, edges in enumerate(graph):
                for b in edges.values():
                    allowed = {h for h in height_domains[b] if any(abs(h - x) <= 1 for x in height_domains[a])}
                    assert allowed
                    if allowed != height_domains[b]:
                        height_domains[b] = allowed; changed = True

    height_propagation()
    for i in sorted(distance, key=lambda i: (distance[i], i)):
        height_domains[i] = {max(height_domains[i])}
        height_propagation()
    heights = [next(iter(s)) for s in height_domains]
    assert all(abs(heights[a] - heights[b]) <= 1 for a in range(len(graph)) for b in graph[a].values())
    # Deliberately mismatch one edge: AC propagation must reject it.
    a = source; d, b = next(iter(graph[a].items()))
    bad = [{0} for _ in graph]; bad[a] = {1 << d}; bad[b] = {0}
    assert not propagate(bad, graph)
    return {'cells': cells, 'river_masks': masks, 'heights': heights,
            'source': source, 'sink': sink, 'river_cells': sum(bool(m) for m in masks),
            **stats, 'checks': 'reciprocal ports, source-outlet connectivity, no isolated cycles, mismatch rejection, height step <=1'}


def wave(t, period=5, phase=0, outer=(0, 2), shore=(0, 0)):
    p = (t / period + phase) % 1
    # Project choice: closed trip outer->shore->slightly offshore->outer.
    # alpha vanishes at cycle seam; no normalization of opposite directions.
    travel = (1 - math.cos(2 * math.pi * p)) / 2
    point = tuple(a + (b - a) * travel for a, b in zip(outer, shore))
    return point, math.sin(math.pi * p) ** 2


def main():
    cells, graph = hex_graph(3)
    for a, edges in enumerate(graph):
        for d, b in edges.items():
            assert graph[b][(d + 3) % 6] == a
    assert len(graph[cells.index((0, 0))]) == 6
    assert all(rotate(m, 6) == m and rotate(rotate(m, 1), 5) == m for m in range(64))
    river = river_exercise()
    for k in range(301):
        a, alpha = wave(k / 30)
        b, beta = wave(k / 30 + 5)
        assert max(abs(x - y) for x, y in zip(a, b)) < 1e-10 and abs(alpha - beta) < 1e-10
    # Existing shader counterexample: normalize(mix([1,0,0],[-1,0,0],.5)).
    opposing_midpoint_length = math.sqrt(sum(((a + b) * .5) ** 2 for a, b in zip((1, 0, 0), (-1, 0, 0))))
    assert opposing_midpoint_length == 0
    # Illustrative angle selection is OUR design, not the author's atlas scheme.
    def view_pair(angle, count=12):
        f = (angle / (2 * math.pi) % 1) * count
        i = math.floor(f)
        return i, (i + 1) % count, f - i
    for n in range(361):
        i, j, w = view_pair(math.radians(n))
        assert 0 <= i < 12 and 0 <= j < 12 and 0 <= w < 1
    assert view_pair(0) == view_pair(2 * math.pi)
    # A facing light normal says nothing about an external occluder.
    facing = 1
    sun_visibility = 0
    old_normal_only = facing
    correct_shadow_masked = facing * sun_visibility
    assert old_normal_only > 0 and correct_shadow_masked == 0
    spec = importlib.util.spec_from_file_location('packer', Path(__file__).with_name('rect-packer-study.py'))
    packer = importlib.util.module_from_spec(spec); spec.loader.exec_module(packer)
    return {
        'scope': 'Self-authored CPU mechanism exercises only; no author source, rendering, performance or production acceptance',
        'triangle_hex': {'cells': len(cells), 'six_neighbor_reciprocity': True, 'six_rotations': True},
        'river_wfc': river,
        'shore_wave': {'periodic_samples': 301, 'opposing_direction_counterexample_length': opposing_midpoint_length},
        'tree_cloud_impostor': {'view_index_wrap_checks': 361, 'note': 'View interpolation is project exercise; author encoding unproven; not a GPU stability check'},
        'binary_tree_packer': packer.verify(),
        'inverted_hull': {'normal_only_does_not_encode_shadow': True, 'occluded_light_alpha': correct_shadow_masked,
                          'note': 'Mathematical masking counterexample, not a rendered hull or shadow-map test'}}


if __name__ == '__main__':
    print(json.dumps(main(), indent=2))
