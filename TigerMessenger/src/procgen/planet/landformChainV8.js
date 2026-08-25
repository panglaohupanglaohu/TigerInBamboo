// ============================================================================
// Oskar-style continuous landform chain.
//
// Generation owns topology, landform semantics and navigation anchors.  The
// renderer is deliberately not involved here.  The chain is an opt-in V8
// snapshot feature so legacy worlds can be rolled back without deleting their
// callers or changing their hashes.
// ============================================================================

const EPSILON = 1e-6;

export const LANDFORM_CHAIN_VERSION = "landformChainV1";

export const LANDFORM_CHAIN_V8 = Object.freeze([
  Object.freeze({ id: "highland-citadel", chainOrder: 0, landformClass: "volcanic-snow-massif", elevationBand: [0.62, 1], geology: "kilimanjaro-volcanic-massif", soil: "volcanic-ash", waterRole: "glacial-runoff", transitionIn: "none", transitionOut: "ash-slope-to-rift-shoulder", profile: "highland-snow-massif" }),
  Object.freeze({ id: "triple-gate", chainOrder: 1, landformClass: "rift-shoulder-pass", elevationBand: [0.48, 0.72], geology: "rift-shoulder-fault", soil: "windblown-tuff", waterRole: "seasonal-gully", transitionIn: "ash-slope-to-rift-shoulder", transitionOut: "shoulder-to-escarpment", profile: "triple-gate-rift-shoulder" }),
  Object.freeze({ id: "crystal-canyon", chainOrder: 2, landformClass: "rift-escarpment", elevationBand: [0.18, 0.56], geology: "east-african-rift", soil: "basalt-and-alluvium", waterRole: "canyon-stream", transitionIn: "shoulder-to-escarpment", transitionOut: "escarpment-to-delta", profile: "crystal-rift-canyon" }),
  Object.freeze({ id: "swamp-lake", chainOrder: 3, landformClass: "rift-long-lake", elevationBand: [0.05, 0.28], geology: "rift-lake-basin", soil: "lacustrine-mud", waterRole: "closed-lake-basin", transitionIn: "escarpment-to-delta", transitionOut: "lake-sediment-to-volcanic-hills", profile: "swamp-rift-lake" }),
  Object.freeze({ id: "bookshop-town", chainOrder: 4, landformClass: "auckland-volcanic-hills", elevationBand: [0.20, 0.48], geology: "auckland-volcanic-field", soil: "tuff-and-basalt", waterRole: "coastal-estuary", transitionIn: "lake-sediment-to-volcanic-hills", transitionOut: "volcanic-hills-to-alluvial-plain", profile: "bookshop-auckland-hills" }),
  Object.freeze({ id: "saihoji-moss-garden", chainOrder: 5, landformClass: "japanese-alluvial-plain", elevationBand: [0.12, 0.24], geology: "river-fan-and-floodplain", soil: "humus-and-alluvium", waterRole: "plain-stream", transitionIn: "volcanic-hills-to-alluvial-plain", transitionOut: "none", profile: "saihoji-plain" }),
]);

export const LANDFORM_TRANSITIONS_V8 = Object.freeze({
  "ash-slope-to-rift-shoulder": Object.freeze({ maxElevationDelta: 0.28, sockets: ["ash", "ridge", "saddle"] }),
  "shoulder-to-escarpment": Object.freeze({ maxElevationDelta: 0.34, sockets: ["ridge", "cliff", "canyon"] }),
  "escarpment-to-delta": Object.freeze({ maxElevationDelta: 0.34, sockets: ["canyon", "valley", "wetland"] }),
  "lake-sediment-to-volcanic-hills": Object.freeze({ maxElevationDelta: 0.30, sockets: ["wetland", "lake", "land"] }),
  "volcanic-hills-to-alluvial-plain": Object.freeze({ maxElevationDelta: 0.24, sockets: ["land", "plain", "stream"] }),
});

const DEFAULT_ANCHOR = Object.freeze([0.15, 0.83, -0.54]);
const DEFAULT_TERMINAL = Object.freeze([0.58, 0.35, 0.73]);

function normalize(v) {
  const length = Math.hypot(...v) || 1;
  return v.map((value) => value / length);
}

function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }

export function angularDistance(a, b) {
  return Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
}

export function slerpUnit(a, b, t) {
  const start = normalize(a); const end = normalize(b);
  const cosine = Math.max(-1, Math.min(1, dot(start, end)));
  if (cosine > 0.9995) return normalize(start.map((value, index) => value * (1 - t) + end[index] * t));
  const theta = Math.acos(cosine);
  const sine = Math.sin(theta) || 1;
  const aWeight = Math.sin((1 - t) * theta) / sine;
  const bWeight = Math.sin(t * theta) / sine;
  return normalize(start.map((value, index) => value * aWeight + end[index] * bWeight));
}

function stableHash(value) {
  let hash = 2166136261;
  for (const character of JSON.stringify(value)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return `lfc${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function pinForNode(node, seed) {
  const pinCount = node.id === "highland-citadel" ? 5 : node.id === "crystal-canyon" ? 4 : 3;
  return Object.freeze({
    id: `${node.id}:landform-pin`,
    landmarkId: node.id,
    seed: seed >>> 0,
    count: pinCount,
    keepSurface: node.id === "highland-citadel" ? "horse:l1-basin" : node.id === "saihoji-moss-garden" ? "battlefield" : "landform-surface",
    transition: node.transitionOut,
  });
}

export function compileLandformChain({ anchor = DEFAULT_ANCHOR, terminal = DEFAULT_TERMINAL, seed = 1, baseEntries = [] } = {}) {
  const entries = new Map(baseEntries.map((entry) => [entry.id, entry]));
  // P0-3 (2026-08-24): adjacent section caps must touch/overlap so the main
  // landmass leaves no un-interpreted ocean notch between neighbours.  The
  // radius is derived from the actual slerp arc spacing (not a fixed 0.17),
  // so any future anchor/terminal pair keeps the guarantee.
  const directions = LANDFORM_CHAIN_V8.map((_, index) => slerpUnit(anchor, terminal, index / (LANDFORM_CHAIN_V8.length - 1)));
  const arcSteps = directions.map((direction, index) => {
    const prev = index > 0 ? angularDistance(directions[index - 1], direction) : 0;
    const next = index < directions.length - 1 ? angularDistance(direction, directions[index + 1]) : 0;
    return Math.max(prev, next);
  });
  const chain = LANDFORM_CHAIN_V8.map((definition, index) => {
    const entry = entries.get(definition.id) || {};
    const direction = directions[index];
    return Object.freeze({
      ...entry,
      ...definition,
      direction,
      angularRadius: Math.max(entry.angularRadius || 0.17, arcSteps[index] / 2 + 0.02),
      profile: definition.profile,
      chainVersion: LANDFORM_CHAIN_VERSION,
      hardPins: pinForNode(definition, seed),
      transitionBand: index === 0 ? null : LANDFORM_TRANSITIONS_V8[definition.transitionIn] || null,
    });
  });
  return Object.freeze(chain);
}

function componentForLandmark({ grid, assignment, landmark }) {
  if (!grid?.dual || !assignment) return null;
  const cells = grid.dual.cells();
  const nearest = cells.slice().sort((a, b) => angularDistance(grid.dual.directionOf(a.index), landmark.direction) - angularDistance(grid.dual.directionOf(b.index), landmark.direction) || a.index - b.index)[0];
  if (!nearest || (assignment.get(nearest.id)?.land ?? 0) <= 0.5) return null;
  const visited = new Set([nearest.id]); const queue = [nearest];
  while (queue.length) {
    const cell = queue.shift();
    for (const edge of grid.dual.neighborsOf(cell.index)) {
      const next = cells.find((candidate) => candidate.index === edge.to);
      if (next && !visited.has(next.id) && (assignment.get(next.id)?.land ?? 0) > 0.5) { visited.add(next.id); queue.push(next); }
    }
  }
  return visited;
}

export function validateChainCoverage({ chain = [], grid = null, assignment = null, explicitBays = [] } = {}) {
  const errors = [];
  const ordered = chain.slice().sort((a, b) => a.chainOrder - b.chainOrder);
  for (let index = 0; index < ordered.length; index++) {
    if (ordered[index].chainOrder !== index) errors.push(`chain-order:${ordered[index].id}`);
    if (!Array.isArray(ordered[index].direction) || Math.abs(Math.hypot(...ordered[index].direction) - 1) > 1e-5) errors.push(`direction:${ordered[index].id}`);
    if (index > 0) {
      const previous = ordered[index - 1];
      const gap = angularDistance(previous.direction, ordered[index].direction);
      const overlap = previous.angularRadius + ordered[index].angularRadius;
      const bay = explicitBays.some((candidate) => candidate.from === previous.id && candidate.to === ordered[index].id);
      // P0-3: an authored transition tag must not exempt an ocean notch — the
      // caps themselves have to touch (P0-3 radii guarantee this).  Bays are
      // the only legal gap between chain neighbours.
      if (gap > overlap && !bay) errors.push(`transition-gap:${previous.id}->${ordered[index].id}`);
    }
  }
  if (grid && assignment) {
    const components = ordered.map((landmark) => componentForLandmark({ grid, assignment, landmark }));
    const first = components.find(Boolean);
    if (!first) errors.push("chain-no-land-component");
    else if (components.some((component) => !component || [...component].some((id) => !first.has(id)))) errors.push("chain-not-one-land-component");
  }
  return { ok: errors.length === 0, errors, count: ordered.length };
}

export function validateElevationNarrative({ chain = [], sampleHeight = null } = {}) {
  const errors = [];
  const byId = new Map(chain.map((entry) => [entry.id, entry]));
  const requirements = [
    ["highland-citadel", "triple-gate", "highland>gate"],
    ["triple-gate", "crystal-canyon", "gate>canyon"],
    ["crystal-canyon", "swamp-lake", "canyon>lake"],
    ["bookshop-town", "swamp-lake", "bookshop>lake"],
    ["bookshop-town", "saihoji-moss-garden", "bookshop>saihoji"],
  ];
  for (const [high, low, label] of requirements) {
    const a = byId.get(high); const b = byId.get(low);
    if (!a || !b) { errors.push(`missing:${label}`); continue; }
    const ah = sampleHeight ? sampleHeight(a.direction, a) : a.elevationBand[1];
    const bh = sampleHeight ? sampleHeight(b.direction, b) : b.elevationBand[1];
    if (!(ah > bh + EPSILON)) errors.push(`elevation:${label}`);
  }
  return { ok: errors.length === 0, errors };
}

function tangentBasis(direction) {
  const ref = Math.abs(direction[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const u = normalize([
    ref[1] * direction[2] - ref[2] * direction[1],
    ref[2] * direction[0] - ref[0] * direction[2],
    ref[0] * direction[1] - ref[1] * direction[0],
  ]);
  return { u, v: normalize([
    direction[1] * u[2] - direction[2] * u[1],
    direction[2] * u[0] - direction[0] * u[2],
    direction[0] * u[1] - direction[1] * u[0],
  ]) };
}

function fibonacciDirections(count) {
  const result = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let index = 0; index < count; index++) {
    const y = 1 - (index + 0.5) * 2 / count;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = golden * index;
    result.push([Math.cos(theta) * radius, y, Math.sin(theta) * radius]);
  }
  return result;
}

function localDirections(center, angularRadius, count) {
  const { u, v } = tangentBasis(center);
  const result = [];
  for (let index = 0; index < count; index++) {
    const t = Math.sqrt((index + 0.5) / count) * angularRadius;
    const theta = index * Math.PI * (3 - Math.sqrt(5));
    result.push(normalize([
      center[0] + u[0] * Math.cos(theta) * t + v[0] * Math.sin(theta) * t,
      center[1] + u[1] * Math.cos(theta) * t + v[1] * Math.sin(theta) * t,
      center[2] + u[2] * Math.cos(theta) * t + v[2] * Math.sin(theta) * t,
    ]));
  }
  return result;
}

export function validateFinalElevationNarrative({ field, chain = [], globalProbeCount = 8192, localProbeCount = 256 } = {}) {
  const errors = [];
  if (!field?.heightAt) return { ok: false, errors: ["missing-final-field"] };
  const ordered = chain.slice().sort((a, b) => a.chainOrder - b.chainOrder);
  const highland = ordered.find((entry) => entry.id === "highland-citadel");
  if (!highland) return { ok: false, errors: ["missing:highland-citadel"] };
  const probes = fibonacciDirections(globalProbeCount);
  const local = new Map();
  for (const landmark of ordered) {
    const directions = localDirections(landmark.direction, landmark.angularRadius ?? 0.17, localProbeCount);
    local.set(landmark.id, directions.map((direction) => ({ direction, height: field.heightAt(direction) })));
    probes.push(...directions);
  }
  const owner = (direction) => ordered.reduce((best, candidate) => {
    const score = dot(direction, candidate.direction);
    return !best || score > best.score ? { id: candidate.id, score } : best;
  }, null)?.id || null;
  const ranked = probes.map((direction) => ({ direction, height: field.heightAt(direction), owner: owner(direction) })).sort((a, b) => b.height - a.height);
  const highlandSamples = local.get(highland.id) || [];
  const highlandMax = Math.max(...highlandSamples.map((sample) => sample.height), -Infinity);
  const outsideMax = Math.max(...ranked.filter((sample) => sample.owner !== highland.id).map((sample) => sample.height), -Infinity);
  if (!Number.isFinite(highlandMax) || !Number.isFinite(outsideMax)) errors.push("non-finite-elevation-probe");
  if (!(highlandMax > outsideMax + 0.35)) errors.push(`global-highland-margin:${(highlandMax - outsideMax).toFixed(3)}`);

  const prominentPeaks = [];
  for (const sample of highlandSamples.slice().sort((a, b) => b.height - a.height)) {
    if (prominentPeaks.some((peak) => angularDistance(peak.direction, sample.direction) < 0.045)) continue;
    if (sample.height < highlandMax - 3.2) continue;
    prominentPeaks.push(sample);
  }
  if (prominentPeaks.length < 3) errors.push(`highland-prominent-peaks:${prominentPeaks.length}`);

  const centerHeight = (id) => field.heightAt(ordered.find((entry) => entry.id === id)?.direction || [0, 1, 0]);
  const sequence = ["highland-citadel", "triple-gate", "crystal-canyon", "swamp-lake"];
  for (let index = 1; index < sequence.length; index++) {
    const previous = centerHeight(sequence[index - 1]);
    const current = centerHeight(sequence[index]);
    if (!(previous > current + EPSILON)) errors.push(`final-saddle:${sequence[index - 1]}>${sequence[index]}`);
  }
  if (!(centerHeight("bookshop-town") > centerHeight("swamp-lake") + EPSILON)) errors.push("final-saddle:bookshop>lake");
  if (!(centerHeight("bookshop-town") > centerHeight("saihoji-moss-garden") + EPSILON)) errors.push("final-saddle:bookshop>saihoji");
  return { ok: errors.length === 0, errors, probeCount: probes.length, highlandMax, outsideMax, highlandMargin: highlandMax - outsideMax, prominentPeaks: prominentPeaks.length };
}

export function landformChainHash(chain) {
  return stableHash(chain.map((entry) => ({ id: entry.id, chainOrder: entry.chainOrder, direction: entry.direction, profile: entry.profile, transitionIn: entry.transitionIn, transitionOut: entry.transitionOut })));
}

export function buildTransitionCollars(chain, { radius = 160 } = {}) {
  const ordered = chain.slice().sort((a, b) => a.chainOrder - b.chainOrder);
  return ordered.slice(1).map((to, index) => {
    const from = ordered[index];
    return Object.freeze({
      id: `${from.id}->${to.id}`,
      from: from.id,
      to: to.id,
      direction: slerpUnit(from.direction, to.direction, 0.5),
      angularRadius: Math.max(0.08, Math.min(0.24, (from.angularRadius + to.angularRadius) * 0.72)),
      // P0-1: no absolute elevation here.  The field composer interpolates
      // the two sections' real heights at the collar centre; a normalized
      // elevationBand value used to flatten every saddle to ~0.2-0.7 while
      // the section cores stood at 6-9.
      smoothness: Math.max(0.7, radius * 0.012),
      transition: to.transitionIn,
    });
  });
}

export function migrateLandformSnapshot(snapshot, { seed = snapshot?.seed || 1, anchor = DEFAULT_ANCHOR, terminal = DEFAULT_TERMINAL } = {}) {
  const migrated = structuredClone(snapshot || {});
  const legacyProfileAliases = { "saihoji-hills": "saihoji-plain", "bookshop-hill-chain": "bookshop-auckland-hills", "crystal-canyon": "crystal-rift-canyon", "highland-citadel": "highland-snow-massif" };
  migrated.landformChainVersion = LANDFORM_CHAIN_VERSION;
  migrated.landformChainHash = landformChainHash(compileLandformChain({ seed, anchor, terminal }));
  migrated.legacyProfileAliases = legacyProfileAliases;
  migrated.landmarkDirectionMigration = compileLandformChain({ seed, anchor, terminal }).map((entry) => ({ id: entry.id, direction: entry.direction }));
  return migrated;
}

export const DEFAULT_CHAIN_ANCHOR = DEFAULT_ANCHOR;
export const DEFAULT_CHAIN_TERMINAL = DEFAULT_TERMINAL;

// ---------------------------------------------------------------------
// 链邻接校验（2026-08-24 主人地质剖面线要求）：不只比中心点——
// 每对相邻 landmark 之间沿大圆弧采样，校验
//   1) 过渡带中点高度严格介于两端中心之间（剖面单调，无阶梯倒置）；
//   2) 弧线上无开阔海洋缝隙（深洋断点会把大陆切成贴图）；
//   3) 三重门鞍部严格介于高山台地与裂谷底之间（垭口语义）。
// =====================================================================
export function validateChainAdjacency({ field, chain = [], arcSamples = 24 } = {}) {
  const errors = [];
  if (!field?.heightAt) return { ok: false, errors: ["missing-final-field"] };
  const ordered = chain.slice().sort((a, b) => a.chainOrder - b.chainOrder);
  const pairs = [];
  for (let index = 1; index < ordered.length; index++) {
    const from = ordered[index - 1];
    const to = ordered[index];
    const hFrom = field.heightAt(from.direction);
    const hTo = field.heightAt(to.direction);
    const midDirection = slerpUnit(from.direction, to.direction, 0.5);
    const hMid = field.heightAt(midDirection);
    const lo = Math.min(hFrom, hTo);
    const hi = Math.max(hFrom, hTo);
    if (!(hMid > lo + 1e-6 && hMid < hi - 1e-6)) {
      errors.push(`adjacency-step:${from.id}->${to.id} mid=${hMid.toFixed(3)} 不在 [${lo.toFixed(3)}, ${hi.toFixed(3)}] 内`);
    }
    let deepest = Infinity;
    let deepestDirection = null;
    for (let s = 1; s < arcSamples - 1; s++) {
      const direction = slerpUnit(from.direction, to.direction, s / (arcSamples - 1));
      const h = field.heightAt(direction);
      if (h < deepest) { deepest = h; deepestDirection = direction; }
    }
    // P0-2: judge ocean gaps by the baked land semantic, not by a bare height
    // threshold.  Lake shores/wetlands are legal even below the sea line;
    // only "deep below shelf AND semantically water" counts as an open ocean
    // notch that would split the main landmass into disconnected patches.
    const shelfFloor = (field.seaLevel ?? 0) - 1.2;
    const landAtDeepest = deepestDirection && field.semanticAt ? field.semanticAt(deepestDirection).land : 1;
    if (!(deepest > shelfFloor || landAtDeepest >= 0.5)) {
      errors.push(`ocean-gap:${from.id}->${to.id} deepest=${deepest.toFixed(3)} land=${landAtDeepest.toFixed(2)}`);
    }
    pairs.push({ from: from.id, to: to.id, hFrom, hTo, hMid, deepest });
  }
  // 垭口契约：三重门鞍部严格介于高山台地与裂谷底之间
  const byId = new Map(ordered.map((entry) => [entry.id, entry]));
  const highland = byId.get("highland-citadel");
  const gate = byId.get("triple-gate");
  const canyon = byId.get("crystal-canyon");
  if (highland && gate && canyon) {
    const hHighland = field.heightAt(highland.direction);
    const hGate = field.heightAt(gate.direction);
    let canyonFloor = Infinity;
    for (const d of localDirections(canyon.direction, canyon.angularRadius ?? 0.14, 64)) {
      canyonFloor = Math.min(canyonFloor, field.heightAt(d));
    }
    if (!(hHighland > hGate + EPSILON && hGate > canyonFloor + EPSILON)) {
      errors.push(`saddle-not-between: highland=${hHighland.toFixed(3)} gate=${hGate.toFixed(3)} canyonFloor=${canyonFloor.toFixed(3)}`);
    }
    return { ok: errors.length === 0, errors, pairs, saddle: { highland: hHighland, gate: hGate, canyonFloor } };
  }
  return { ok: errors.length === 0, errors, pairs };
}
