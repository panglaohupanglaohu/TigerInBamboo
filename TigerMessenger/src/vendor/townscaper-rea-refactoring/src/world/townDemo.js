/**
 * townDemo.js — a seeded town for the "◎" button and for first load.
 *
 * Built the way the reference clips show towns being built
 * (1197909675443916803, 1215642481162887168, 1238474550511308800):
 *   - a stone quay grown out over the water (level 1),
 *   - narrow rows of houses walked across it, so one-wide rows end in gables,
 *   - a few towers, a closed courtyard that turns into a backyard,
 *   - an arch between two houses and a house on steel legs in the water.
 * Walls get the palette colours; roofs stay terracotta (as in the game).
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Palette slots (PALETTES.town): 0 coral 1 butter 2 sage 3 blue 4 lilac
// 5 apricot 6 sand 7 cream 8 slate 9 deep coral 10 orange 11 straw 12 teal
// 13 sky 14 rose
const SCHEMES = [
  [0, 1, 3, 2, 7],
  [0, 7, 9, 1],
  [3, 13, 7, 1],
  [2, 12, 7, 11],
  [4, 14, 5, 7],
  [0, 3, 1, 2, 5, 13],
];

export function generateTown(town, seed = (Math.random() * 1e9) | 0, schemeIndex = -1) {
  const rnd = mulberry32(seed);
  const cells = town.grid.cells;
  town.reset();

  const near = (c) => Math.hypot(c.cx, c.cz);
  const neighbours = (cell) => cell.edgeNeighbors.filter((id) => id >= 0).map((id) => cells[id]);
  const centre = cells.reduce((best, c) => (near(c) < near(best) ? c : best), cells[0]);
  const pick = (arr) => arr[(rnd() * arr.length) | 0];
  const scheme = schemeIndex >= 0 ? SCHEMES[schemeIndex % SCHEMES.length] : pick(SCHEMES);
  const paint = (c) => { town.color[c.id] = pick(scheme); };

  // ---- 1. quay -------------------------------------------------------------
  const quay = new Set([centre.id]);
  const frontier = [centre];
  const target = 230;
  while (quay.size < target && frontier.length > 0) {
    const cell = frontier.splice((rnd() * frontier.length) | 0, 1)[0];
    for (const nb of neighbours(cell)) {
      if (quay.has(nb.id) || rnd() > 0.62) continue;
      quay.add(nb.id);
      frontier.push(nb);
      if (quay.size >= target) break;
    }
  }
  // fill single-cell bays so the coastline isn't moth-eaten
  for (const c of cells) {
    if (quay.has(c.id)) continue;
    if (neighbours(c).filter((nb) => quay.has(nb.id)).length >= 3) quay.add(c.id);
  }
  for (const id of quay) town.fill(cells[id], 1);
  let reserved = new Set();
  const onQuay = (c) => quay.has(c.id) && town.top(c) === 1 && !reserved.has(c.id);

  // ---- 2. a closed courtyard: a patch ringed by houses ---------------------
  {
    const inner = [...quay].map((id) => cells[id]).filter((c) => near(c) < 3.2 && neighbours(c).length === c.n);
    const core = pick(inner.length ? inner : [centre]);
    // 两圈：够大才铺得下花园小径（1290997501332525056）
    const patch = new Set([core.id, ...neighbours(core).map((c) => c.id)]);
    for (const id of [...patch]) for (const nb of neighbours(cells[id])) if (quay.has(nb.id) || near(nb) < 3.6) patch.add(nb.id);
    const ring = new Set();
    for (const id of patch) {
      const c = cells[id];
      for (const o of [...c.edgeNeighbors, ...c.cornerNeighbors]) if (o >= 0 && !patch.has(o)) ring.add(o);
    }
    for (const id of patch) { quay.add(id); town.fill(cells[id], 1); }
    reserved = patch;
    const ringColour = pick(scheme);
    for (const id of ring) {
      const c = cells[id];
      if (!quay.has(id)) { quay.add(id); }
      town.fill(c, 2 + (rnd() < 0.25 ? 1 : 0));
      town.color[id] = rnd() < 0.75 ? ringColour : pick(scheme);
    }
  }

  // ---- 3. rows of houses ------------------------------------------------------
  const rows = 16 + ((rnd() * 6) | 0);
  for (let r = 0; r < rows; r++) {
    const start = cells[pick([...quay])];
    if (!onQuay(start)) continue;
    const len = 2 + ((rnd() * 5) | 0);
    const height = rnd() < 0.6 ? 2 : 3;
    const colour = pick(scheme);
    let cur = start;
    let prev = null;
    for (let k = 0; k < len && cur; k++) {
      town.fill(cur, Math.max(town.top(cur), height));
      town.color[cur.id] = rnd() < 0.85 ? colour : pick(scheme);
      // keep going roughly straight: prefer the edge opposite the one we came in
      const opts = neighbours(cur).filter((nb) => onQuay(nb));
      let next = null;
      if (prev) {
        const inEdge = cur.edgeNeighbors.indexOf(prev.id);
        const straight = cur.n === 4 && inEdge >= 0 ? cur.edgeNeighbors[(inEdge + 2) % 4] : -1;
        if (straight >= 0 && onQuay(cells[straight]) && rnd() < 0.8) next = cells[straight];
      }
      if (!next && opts.length) next = pick(opts);
      prev = cur;
      cur = next;
    }
  }

  // ---- 4. towers ----------------------------------------------------------------
  const houses = cells.filter((c) => town.top(c) >= 2);
  for (let t = 0; t < 4 && houses.length; t++) {
    const c = pick(houses);
    town.fill(c, Math.min(7, town.top(c) + 2 + ((rnd() * 3) | 0)));
    paint(c);
  }

  // ---- 5. an arch: a cell between two houses, raised, with its middle punched --
  for (let tries = 0; tries < 200; tries++) {
    const c = cells[pick([...quay])];
    if (town.top(c) !== 1) continue;
    const e = c.edgeNeighbors;
    const axis = [0, 1].find((i) => e[i] >= 0 && e[i + 2] >= 0 && town.top(cells[e[i]]) >= 3 && town.top(cells[e[i + 2]]) >= 3);
    if (axis === undefined) continue;
    town.setSolid(c, 3, true);
    town.color[c.id] = town.color[e[axis]];
    break;
  }

  // ---- 6. a house on steel legs out in the water --------------------------
  {
    const shoreCells = cells.filter((c) => !quay.has(c.id) && neighbours(c).some((nb) => quay.has(nb.id)));
    const c = shoreCells.length ? pick(shoreCells) : null;
    if (c) {
      town.setSolid(c, 2, true);
      town.setSolid(c, 3, true);
      paint(c);
      const nb = neighbours(c).find((x) => !quay.has(x.id) && town.top(x) === 0);
      if (nb) { town.setSolid(nb, 3, true); town.color[nb.id] = town.color[c.id]; }
    }
  }

  // paint anything still bare
  for (const c of cells) if (town.top(c) >= 2 && town.color[c.id] < 0) paint(c);
  town.touch();
  return town;
}
