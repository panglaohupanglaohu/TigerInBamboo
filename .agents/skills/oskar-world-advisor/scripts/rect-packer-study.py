"""Independent learning exercise, NOT Oskar's code or a game collision system.

Same brute-force candidates, linear vs binary spatial-tree broad phase.
Uses padded axis-aligned rectangles in 2D; touching padded edges is legal.
Run with Python 3. No external packages, file writes or network.
"""
import json
import random
import time


def overlaps(a, b):
    return a[0] < b[2] and a[2] > b[0] and a[1] < b[3] and a[3] > b[1]


def inside(a, b):
    return a[0] >= b[0] and a[1] >= b[1] and a[2] <= b[2] and a[3] <= b[3]


class Node:
    def __init__(self, bounds, depth=0):
        self.bounds, self.depth, self.items, self.children = bounds, depth, [], None

    def insert(self, rect):
        if not inside(rect, self.bounds):
            raise ValueError('Out of bounds')
        if self.children:
            for child in self.children:
                if inside(rect, child.bounds):
                    child.insert(rect)
                    return
        self.items.append(rect)
        if not self.children and len(self.items) > 8 and self.depth < 10:
            x0, y0, x1, y1 = self.bounds
            if x1 - x0 >= y1 - y0:
                m = (x0 + x1) / 2
                halves = ((x0, y0, m, y1), (m, y0, x1, y1))
            else:
                m = (y0 + y1) / 2
                halves = ((x0, y0, x1, m), (x0, m, x1, y1))
            self.children = [Node(b, self.depth + 1) for b in halves]
            old, self.items = self.items, []
            for item in old:
                self.insert(item)

    def hit(self, rect, counts):
        counts['node_bounds_tests'] += 1
        if not overlaps(rect, self.bounds):
            return False
        for item in self.items:
            counts['item_tests'] += 1
            if overlaps(rect, item):
                return True
        return bool(self.children and any(c.hit(rect, counts) for c in self.children))


def run(seed=176495, number=128, attempts=180, size=1024, gutter=2):
    rng = random.Random(seed)
    tree, accepted = Node((0, 0, size, size)), []
    counts = {'item_tests': 0, 'node_bounds_tests': 0}
    linear_tests = candidates = 0
    started = time.perf_counter()
    for _ in range(number):
        width, height = rng.randint(12, 140), rng.randint(12, 140)
        for _ in range(attempts):
            # Padded extents reserve 2px between interiors. Search is deliberately
            # brute force; the spatial tree only accelerates collision queries.
            x = rng.randint(0, size - width - gutter)
            y = rng.randint(0, size - height - gutter)
            rect = (x, y, x + width + gutter, y + height + gutter)
            candidates += 1
            linear_hit = False
            for other in accepted:
                linear_tests += 1
                if overlaps(rect, other):
                    linear_hit = True
                    break
            tree_hit = tree.hit(rect, counts)
            assert tree_hit == linear_hit, (rect, tree_hit, linear_hit)
            if not tree_hit:
                tree.insert(rect)
                accepted.append(rect)
                break
    assert all(inside(r, (0, 0, size, size)) for r in accepted)
    assert all(not overlaps(r, s) for i, r in enumerate(accepted) for s in accepted[i + 1:])
    return {'seed': seed, 'requested': number, 'accepted': len(accepted),
            'candidate_attempts': candidates, 'linear_item_tests': linear_tests,
            'tree_item_tests': counts['item_tests'],
            'tree_node_bounds_tests': counts['node_bounds_tests'],
            'combined_validation_ms': round((time.perf_counter() - started) * 1000, 3),
            'rectangles': accepted}


def verify():
    # Split boundaries, parent-stored crossing rectangles, empty query and contact.
    assert not overlaps((0, 0, 2, 2), (2, 0, 4, 2))
    tree = Node((0, 0, 100, 100))
    examples = [(2 + n * 3, 2, 4 + n * 3, 4) for n in range(10)]
    examples += [(45, 20, 55, 90), (70, 70, 99, 99)]
    for r in examples:
        tree.insert(r)
    rng = random.Random(8)
    queries = [(49, 50, 51, 51), (50, 95, 51, 99), (4, 2, 5, 4)]
    for _ in range(1000):
        x, y = rng.randrange(100), rng.randrange(100)
        queries.append((x, y, x + 3, y + 7))
    for q in queries:
        assert tree.hit(q, {'item_tests': 0, 'node_bounds_tests': 0}) == any(overlaps(q, r) for r in examples)
    try:
        tree.insert((-1, 0, 1, 1))
    except ValueError:
        pass
    else:
        raise AssertionError('Out of bounds insertion accepted')
    result = run()
    assert result['rectangles'] == run()['rectangles'], 'Not deterministic'
    result.pop('rectangles')
    result['checks'] = 'query parity incl. split/crossing/contact; all placements bounded/nonoverlapping; deterministic seed'
    result['scope'] = 'Independent 2D exercise; combined validation timing is NOT a tree speedup benchmark'
    return result


if __name__ == '__main__':
    print(json.dumps(verify(), indent=2))
