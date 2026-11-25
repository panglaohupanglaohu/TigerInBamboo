// r56 C08 · 1768627849529893109「put this on a sphere」— 原片球面上是平滑的台地海岸 + 深色崖顶描线，
// 不是棱柱六边形。这里在共享 cornerPositions 的结果上做「按层边界平滑」：每一层 l 只取该层的
// 海岸/崖线（H≥l 与 H<l 之间的格边）上的角点，沿这条边界折线做单位球面上的 Laplacian（Taubin λ/μ，
// 防止整体缩水）；其余角点不动。网格仍由共享 planetMesh 生成（拓扑/World 不变），另给崖顶描线。
import { planetMesh } from './planet.js';

const norm = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/** 每层边界：返回 [{level, edges:[[a,b]], nbr: Map(corner→[corners])}] */
export function levelBoundaries(planet) {
  const { cells, H } = planet, maxH = Math.max(...H), out = [];
  for (let l = 1; l <= maxH; l++) {
    const edges = [], nbr = new Map();
    for (const c of cells) {
      if (H[c.id] < l) continue;
      for (let k = 0; k < c.ring.length; k++) {
        const o = c.nb[k]; if (o >= 0 && H[o] >= l) continue;
        const a = c.ring[k], b = c.ring[(k + 1) % c.ring.length];
        edges.push([a, b]);
        if (!nbr.has(a)) nbr.set(a, []); if (!nbr.has(b)) nbr.set(b, []);
        nbr.get(a).push(b); nbr.get(b).push(a);
      }
    }
    out.push({ level: l, edges, nbr });
  }
  return out;
}

/** 平滑海岸采样器：at 为共享 cornerPositions 结果；返回同签名 sampler(k,l) */
export function smoothCoastSampler(planet, at, { iters = 6, lambda = .5, mu = -.53 } = {}) {
  if (!(iters >= 0 && iters <= 100 && Number.isInteger(iters))) throw new RangeError('iters');
  const { R, L } = planet, B = levelBoundaries(planet), over = new Map();
  for (const { level: l, nbr } of B) {
    const r = R + l * L;
    let D = new Map([...nbr.keys()].map((k) => [k, at(k, l).map((x) => x / r)]));
    for (let it = 0; it < iters; it++) for (const f of [lambda, mu]) {
      const N = new Map();
      for (const [k, d] of D) {
        const ns = nbr.get(k); if (ns.length !== 2) { N.set(k, d); continue; }   // 只在简单边界折线上平滑；分叉点钉住
        const m = [0, 1, 2].map((i) => (D.get(ns[0])[i] + D.get(ns[1])[i]) / 2 - d[i]);
        N.set(k, norm([d[0] + f * m[0], d[1] + f * m[1], d[2] + f * m[2]]));
      }
      D = N;
    }
    for (const [k, d] of D) over.set(k + '@' + l, d.map((x) => x * r));
  }
  const s = (k, l) => over.get(k + '@' + l) || at(k, l);
  s.boundaries = B;
  return s;
}

/** 崖顶/海岸描线（每层边界在该层高度上，略抬一点） */
export function coastOutline(planet, at, { lift = .006 } = {}) {
  const pos = [];
  for (const { level: l, edges } of levelBoundaries(planet)) for (const [a, b] of edges) for (const p of [at(a, l), at(b, l)]) {
    const n = Math.hypot(...p); pos.push(...p.map((x) => x * (1 + lift / n)));
  }
  return pos;
}

/** 边界折线的平均转角（度）：越小越平滑 */
export function boundaryTurning(planet, at) {
  let sum = 0, n = 0;
  for (const { level: l, nbr } of levelBoundaries(planet)) for (const [k, ns] of nbr) {
    if (ns.length !== 2) continue;
    const p = at(k, l), a = at(ns[0], l), b = at(ns[1], l);
    const u = [0, 1, 2].map((i) => p[i] - a[i]), v = [0, 1, 2].map((i) => b[i] - p[i]);
    const c = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (Math.hypot(...u) * Math.hypot(...v) || 1);
    sum += Math.acos(Math.max(-1, Math.min(1, c))) * 180 / Math.PI; n++;
  }
  return n ? sum / n : 0;
}

/** planet.html?smoothcoast=1：用平滑采样器替换陆地几何，并加深色描线（默认关） */
export function installSmoothCoast({ THREE, demo }) {
  const ink = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0x2c3a35, transparent: true, opacity: .85 }));
  let lastLand = null, lastAt = null;
  const api = { info: null };
  const apply = () => {
    const land = demo.land, at0 = demo.at;
    if (!land || !at0 || (land === lastLand && at0 === lastAt)) return;
    lastLand = land; lastAt = at0;
    const s = smoothCoastSampler(demo.planet, at0), m = planetMesh(demo.planet, s);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(m.position, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(m.normal, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(m.color, 3));
    land.geometry.dispose(); land.geometry = g;
    ink.geometry.dispose(); ink.geometry = new THREE.BufferGeometry();
    ink.geometry.setAttribute('position', new THREE.Float32BufferAttribute(coastOutline(demo.planet, s), 3));
    api.info = { turningBefore: boundaryTurning(demo.planet, at0), turningAfter: boundaryTurning(demo.planet, s), levels: s.boundaries.length, edges: s.boundaries.reduce((n, b) => n + b.edges.length, 0) };
  };
  window.planetSmoothCoast = api;
  const tick = () => { apply(); if (demo.land && demo.land.parent === demo.world && ink.parent !== demo.world) demo.world.add(ink); requestAnimationFrame(tick); };
  tick();
  return api;
}
