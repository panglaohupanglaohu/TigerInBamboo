/** 784847588893814785 "Content-agnostic algorithm for placing tiles ... a Sudoku-solver
 * on steroids"; 784847933686575104 "would work for squares or voxels too";
 * 787319655648100352 "Now in 3D"; 784848286272327680 "You can fill it with anything".
 * REACode/tileplace tile sets are ported as pure label data and solved by the shared
 * polygon WFC on a layered lattice over the real World grid: each (cell, level) has
 * the cell's horizontal half-edges plus up/down. Solutions are committed as built
 * voxels in one transaction; the bounded trace gives the piece-by-piece assembly
 * order and the still-undecided candidate "ghosts". Tile weights drive the shared
 * solver's weighted Shannon entropy + weighted option order (weighted:true, default;
 * weighted:false falls back to the r53 seeded first-choice preference). Not ported:
 * the label-count bitmask optimisation, original art/capsule contents.
 */
import { solveWFC, findWFCConflicts } from '../core/wfc.js';
import { MAX_LEVEL } from '../core/world.js';

export const TILESET_FORT = {
  joins: ['A|D', 'W|D'],
  base: [
    { name: 'air', faces: ['A', 'A', 'A', 'A', 'A', 'A'], weight: 3 }, { name: 'block', faces: ['S', 'S', 'S', 'S', 'S', 'S'], weight: 9 },
    { name: 'wall', faces: ['W', 'W', 'W', 'W', 'R', 'S'], weight: 7 }, { name: 'door', faces: ['D', 'W', 'W', 'W', 'R', 'S'], weight: 1 },
    { name: 'floor', faces: ['W', 'W', 'W', 'W', 'R', 'A'], weight: 5 }, { name: 'pillar', faces: ['W', 'W', 'W', 'W', 'S', 'S'], weight: 3 },
    { name: 'window', faces: ['A', 'W', 'W', 'W', 'R', 'S'], weight: 2 }, { name: 'ledge', faces: ['R', 'R', 'R', 'R', 'A', 'S'], weight: 1 },
  ],
};
export const TILESET_RUIN = {
  joins: ['A|W', 'A|R'],
  base: [
    { name: 'air', faces: ['A', 'A', 'A', 'A', 'A', 'A'], weight: 6 }, { name: 'rubble', faces: ['R', 'R', 'R', 'R', 'R', 'S'], weight: 3 },
    { name: 'wall', faces: ['W', 'W', 'W', 'W', 'A', 'S'], weight: 3 }, { name: 'arch', faces: ['A', 'W', 'W', 'W', 'A', 'S'], weight: 1 },
  ],
};
/** Expand a 4-side base tile onto an n-sided cell: uniform sides -> 1 variant,
 * one odd side -> n rotations. Other patterns are square-only. */
export function expandTiles(tileset, n) {
  const out = [];
  for (const t of tileset.base) {
    const sides = t.faces.slice(0, 4), up = t.faces[4], down = t.faces[5], uniq = [...new Set(sides)];
    const mk = (id, s) => out.push({ id, name: t.name, weight: t.weight ?? 1, solid: t.name !== 'air', edges: [...s.map(label => ({ label, v: 0 })), { label: up, v: 1, solid: t.name !== 'air' }, { label: down, v: -1, solid: t.name !== 'air' }] });
    if (uniq.length === 1) mk(`${t.name}/${n}`, Array(n).fill(sides[0]));
    else {
      const odd = uniq.find(l => sides.filter(x => x === l).length === 1), rest = uniq.find(l => l !== odd);
      if (odd !== undefined && uniq.length === 2) for (let k = 0; k < n; k++) mk(`${t.name}/${n}@${k}`, Array.from({ length: n }, (_, i) => i === k ? odd : rest));
      else if (n === 4) mk(`${t.name}/4`, sides);
    }
  }
  return out;
}
/** Labels decide adjacency; gravity (World commit requirement, not from the
 * original) forbids a solid piece resting on an air tile. */
export function labelCompatible(joins, { gravity = true } = {}) {
  const set = new Set(joins.flatMap(j => { const [a, b] = j.split('|'); return [a + '|' + b, b + '|' + a]; }));
  return (a, b) => {
    if (a.v + b.v !== 0 || !(a.label === b.label || set.has(a.label + '|' + b.label))) return false;
    if (gravity && a.v !== 0) { const lower = a.v === 1 ? a : b, upper = a.v === 1 ? b : a; if (lower.solid === false && upper.solid) return false; }
    return true;
  };
}
/** Layered lattice over real grid cells: id = index*H + (k-1); edges = horizontal..., up, down. */
export function layeredLattice(world, cellIds, H) {
  if (!Number.isInteger(H) || H < 1) throw new RangeError('lattice height');
  const index = new Map(cellIds.map((id, i) => [id, i])), cells = [];
  for (const [i, id] of cellIds.entries()) {
    const c = world.cells[id];
    for (let k = 1; k <= H; k++) {
      const edgeNeighbors = [], edgeTwins = [];
      for (let e = 0; e < c.n; e++) { const nb = c.edgeNeighbors[e], j = index.get(nb); if (j === undefined) { edgeNeighbors.push(-1); edgeTwins.push(-1); continue; } const b = world.cells[nb]; edgeNeighbors.push(j * H + k - 1); edgeTwins.push(c.edgeTwins?.[e] ?? b.edgeNeighbors.indexOf(id)); }
      edgeNeighbors.push(k < H ? i * H + k : -1, k > 1 ? i * H + k - 2 : -1); edgeTwins.push(k < H ? c.n + 1 : -1, k > 1 ? c.n : -1);
      cells.push({ id: i * H + k - 1, n: c.n + 2, edgeNeighbors, edgeTwins, cell: id, level: k });
    }
  }
  return { cells, H, cellIds };
}
/** Pick a connected patch of exposed cells at one ground height, empty above. */
export function assemblySite(world, { seed = 1, size = 12, height = 3 } = {}) {
  const ok = c => { const g = world.top(c); return g >= 1 && g + height <= MAX_LEVEL && !world.river[c.id] && world.ground(c) === g; };
  const cands = world.cells.filter(ok).sort((a, b) => ((Math.imul(a.id + 1, 2654435761) ^ seed) >>> 0) - ((Math.imul(b.id + 1, 2654435761) ^ seed) >>> 0));
  for (const start of cands) {
    const g = world.top(start), seen = new Set([start.id]), queue = [start];
    while (queue.length && seen.size < size) { const c = queue.shift(); for (const nb of c.edgeNeighbors) { const b = world.cells[nb]; if (nb >= 0 && !seen.has(nb) && ok(b) && world.top(b) === g && seen.size < size) { seen.add(nb); queue.push(b); } } }
    if (seen.size === size) return { cells: [...seen].sort((a, b) => a - b), ground: g, height };
  }
  return null;
}
export function solveAssembly(world, site, { tileset = TILESET_FORT, seed = 1, traceLimit = 256, weighted = true } = {}) {
  const lattice = layeredLattice(world, site.cells, site.height), tiles = [];
  for (const n of new Set(lattice.cells.map(c => c.n))) tiles.push(...expandTiles(tileset, n - 2));
  const compatible = labelCompatible(tileset.joins), allowed = {};
  for (const c of lattice.cells) allowed[c.id] = tiles.filter(t => t.edges.length === c.n && (c.level > 1 || t.edges.at(-1).label === 'S' || !t.solid) && (c.level < site.height || ['A', 'R'].includes(t.edges.at(-2).label))).map(t => t.id);
  // Original tile weights become seeded first-choice preferences (the shared solver has no weights).
  const preferred = {};
  if (!weighted) for (const c of lattice.cells) { const opts = allowed[c.id].map(id => tiles.find(t => t.id === id)), total = opts.reduce((s, t) => s + t.weight, 0); let h = (Math.imul(seed ^ 0x9e3779b9, 2654435761) ^ Math.imul(c.id + 1, 2246822519)) >>> 0; h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0; let x = (h / 4294967296) * total; for (const t of opts) { x -= t.weight; if (x <= 0) { preferred[c.id] = t.id; break; } } }
  const r = solveWFC(lattice, { tiles, seed, allowed, preferred, compatible, traceLimit, weighted, explain: true });
  const byId = new Map(tiles.map(t => [t.id, t]));
  const conflicts = r.ok ? findWFCConflicts(lattice, r.tiles, tiles, { compatible }) : [];
  // assembly playback from the real candidate trace: when each piece became fixed, and how many undecided solid candidates (ghosts) remained
  const steps = [], fixed = new Set();
  for (const f of r.trace ?? []) {
    const now = []; let ghosts = 0;
    for (const c of lattice.cells) { const d = f.domains[c.id]; if (d.length === 1 && !fixed.has(c.id)) { fixed.add(c.id); now.push(c.id); } if (d.length > 1 && d.some(id => byId.get(id).solid)) ghosts++; }
    // ghostCells: undecided cells that may still become solid, with their solid-candidate share (for the playback)
    const ghostCells = [];
    for (const c of lattice.cells) { const d = f.domains[c.id]; if (d.length > 1) { const sol = d.filter(id => byId.get(id).solid).length; if (sol) ghostCells.push([c.id, sol / d.length]); } }
    steps.push({ stage: f.stage, placed: now, ghosts, ghostCells });
  }
  // piece-by-piece order (r55): the explain records of the final branch are in propagation order, so the moment a
  // cell is pinned/decided or reduced to one candidate is its real fixing time — finer than the per-decision trace.
  const pieces = [], seen = new Set(), frameOf = d => { let f = 0; (r.trace ?? []).forEach((fr, i) => { if (fr.decisions < d) f = i; }); return f; };
  const fix = (id, d) => { if (seen.has(id)) return; seen.add(id); const t = byId.get(r.tiles?.[id]); if (t?.solid) pieces.push({ id, decisions: d, frame: frameOf(d), name: t.name }); };
  if (r.ok) { for (const c of lattice.cells) if (allowed[c.id].length === 1) fix(c.id, 0);
    for (const k of r.causes) if (k.kind === 'decision' || k.kind === 'pin' || k.left === 1) fix(k.cell, k.decisions);
    for (const c of lattice.cells) fix(c.id, r.decisions); }
  return { ...r, lattice, catalog: tiles, byId, conflicts, steps, pieces };
}
/** Commit solid tiles as built voxels; refuses if any target voxel is already occupied. */
export function commitAssembly(world, site, solved, { color = 0 } = {}) {
  if (!solved.ok || solved.conflicts.length) return { ok: false, reason: 'unsolved' };
  const writes = [];
  for (const c of solved.lattice.cells) { const t = solved.byId.get(solved.tiles[c.id]); if (!t.solid) continue; const cell = world.cells[c.cell], lv = site.ground + c.level; if (world.isSolid(cell, lv)) return { ok: false, reason: 'occupied' }; writes.push([cell, lv]); }
  for (const [cell, lv] of writes) { world.setSolid(cell, lv, true); world.color[cell.id] = color; }
  if (writes.length) world.touch?.();
  return { ok: true, voxels: writes.length };
}
/** 784847588893814785 assembly playback into the shared World: after steps[0..k] only the pieces fixed so far
 * are built (in the solver's real fixing order); later ones are cleared again, so scrubbing back and forth is
 * exact. by:'piece' replays the first k solid pieces in their real fixing order (solved.pieces). Site voxels must
 * start empty (same rule as commitAssembly). Returns {voxels, placed, ghostCells}. */
export function applyAssemblyPrefix(world, site, solved, k, { color = 0, by = 'step' } = {}) {
  if (!solved.ok || solved.conflicts.length) return { ok: false, reason: 'unsolved' };
  const placed = new Set();let upto;
  if (by === 'piece') { const n = Math.max(0, Math.min(solved.pieces.length, k | 0)); for (let i = 0; i < n; i++) placed.add(solved.pieces[i].id); upto = n ? solved.pieces[n - 1].frame : 0; }
  else { upto = Math.max(-1, Math.min(solved.steps.length - 1, k | 0)); for (let s = 0; s <= upto; s++) for (const id of solved.steps[s].placed) placed.add(id); }
  let voxels = 0;
  for (const c of solved.lattice.cells) {
    const cell = world.cells[c.cell], lv = site.ground + c.level, t = solved.byId.get(solved.tiles[c.id]);
    if (world.isRock?.(cell, lv)) return { ok: false, reason: 'occupied' };
    const on = t.solid && placed.has(c.id);
    world.setSolid(cell, lv, on); if (on) { world.color[cell.id] = color; voxels++; }
  }
  world.touch?.();
  return { ok: true, voxels, placed: [...placed], ghostCells: upto >= 0 ? solved.steps[upto].ghostCells : [] };
}
