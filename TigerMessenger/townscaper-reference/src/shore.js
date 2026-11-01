/**
 * shore.js — the water's edge, built from what Oskar Stålberg said about it.
 *
 *   1991101097818403263  "It's based on a looping vertex shader. The data is
 *     baked at generation-time. Each vert has an in-direction, an
 *     out-direction and a time offset."
 *   1991101097818403263 (reply)  "There is no main ocean mesh!" / "Waves do
 *     bounce ... this technique is the first time I've managed to capture both
 *     the incoming and outgoing part of the wave"
 *   1849732997945110651  "the shoreline is shown in yellow. A pushed out and
 *     smoothed shoreline is shown in blue. The waves travel from the blue line
 *     to the yellow (and back a little)."
 *   1849730611964973481  "Instead of trying to make the waves roll in and out
 *     inside one shader pass, I'm creating loads of overlapping waves that
 *     each go through their own cycle"
 *   1215644531221311488  "(Also, the wave skirt stretches further this time)"
 *
 * So, per shoreline loop:
 *   - the yellow line is the quay foot (where the stone meets the water),
 *   - the blue line is that loop pushed out to a fixed distance — measured on
 *     a distance field so bays don't fold — then smoothed along the loop,
 *   - K wave ribbons follow the loop. Every vertex stores its yellow point,
 *     its blue point and a time offset; the vertex shader walks it from blue
 *     to yellow and back a little, on its own clock. Nothing is simulated.
 *   - a static skirt (bright rim at the stone + pale halo) sits under them.
 */

import * as THREE from 'three';
import { pointInQuad } from './town.js';

const hash01 = (n) => {
  let x = Math.imul((n | 0) ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
};

/** Land = columns that touch the water (solid at level 1). */
function isLand(town, cell) { return cell !== null && town.isSolid(cell, 1); }

/** Chain the outward-facing boundary edges of the land into closed loops. */
function traceLoops(town, grid) {
  const cells = grid.cells;
  const out = new Map(); // start vertex id -> [segments]
  for (const cell of cells) {
    if (!isLand(town, cell)) continue;
    for (let i = 0; i < 4; i++) {
      const nid = cell.edgeNeighbors[i];
      const nb = nid >= 0 ? cells[nid] : null;
      if (isLand(town, nb)) continue;
      const a = cell.pts[i], b = cell.pts[(i + 1) % 4];
      let nx = -(b.z - a.z), nz = b.x - a.x;
      const l = Math.hypot(nx, nz) || 1;
      nx /= l; nz /= l;
      if (nx * ((a.x + b.x) / 2 - cell.cx) + nz * ((a.z + b.z) / 2 - cell.cz) < 0) { nx = -nx; nz = -nz; }
      const seg = { a, b, nx, nz, used: false };
      const list = out.get(a.id);
      if (list) list.push(seg); else out.set(a.id, [seg]);
    }
  }
  const loops = [];
  for (const list of out.values()) {
    for (const start of list) {
      if (start.used) continue;
      const loop = [];
      let cur = start;
      let guard = 0;
      while (cur && !cur.used && guard++ < 200000) {
        cur.used = true;
        loop.push(cur);
        const next = out.get(cur.b.id);
        cur = next ? next.find((s) => !s.used) ?? next[0] : null;
      }
      if (cur === start && loop.length >= 3) loops.push(loop);
    }
  }
  return loops;
}

/** Chamfer distance to land, rasterised from the real quads. */
function distanceField(town, grid, index, res = 0.07, pad = 2.5) {
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const c of grid.cells) {
    if (!isLand(town, c)) continue;
    for (const p of c.pts) {
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minZ = Math.min(minZ, p.z); maxZ = Math.max(maxZ, p.z);
    }
  }
  if (!Number.isFinite(minX)) return null;
  minX -= pad; minZ -= pad; maxX += pad; maxZ += pad;
  const W = Math.ceil((maxX - minX) / res) + 1;
  const H = Math.ceil((maxZ - minZ) / res) + 1;
  const d = new Float32Array(W * H).fill(1e9);
  for (const c of grid.cells) {
    if (!isLand(town, c)) continue;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of c.pts) { x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); z0 = Math.min(z0, p.z); z1 = Math.max(z1, p.z); }
    for (let j = Math.floor((z0 - minZ) / res); j <= Math.ceil((z1 - minZ) / res); j++) {
      for (let i = Math.floor((x0 - minX) / res); i <= Math.ceil((x1 - minX) / res); i++) {
        if (i < 0 || j < 0 || i >= W || j >= H) continue;
        if (pointInQuad(c.pts, minX + i * res, minZ + j * res)) d[j * W + i] = 0;
      }
    }
  }
  const S = Math.SQRT2;
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const k = j * W + i; let v = d[k]; if (v === 0) continue;
    if (i > 0) v = Math.min(v, d[k - 1] + 1);
    if (j > 0) v = Math.min(v, d[k - W] + 1);
    if (i > 0 && j > 0) v = Math.min(v, d[k - W - 1] + S);
    if (i < W - 1 && j > 0) v = Math.min(v, d[k - W + 1] + S);
    d[k] = v;
  }
  for (let j = H - 1; j >= 0; j--) for (let i = W - 1; i >= 0; i--) {
    const k = j * W + i; let v = d[k]; if (v === 0) continue;
    if (i < W - 1) v = Math.min(v, d[k + 1] + 1);
    if (j < H - 1) v = Math.min(v, d[k + W] + 1);
    if (i < W - 1 && j < H - 1) v = Math.min(v, d[k + W + 1] + S);
    if (i > 0 && j < H - 1) v = Math.min(v, d[k + W - 1] + S);
    d[k] = v;
  }
  for (let k = 0; k < d.length; k++) d[k] *= res;
  const sample = (x, z) => {
    const fi = (x - minX) / res, fj = (z - minZ) / res;
    if (fi < 0 || fj < 0 || fi >= W - 1 || fj >= H - 1) return 99;
    const i = fi | 0, j = fj | 0, tx = fi - i, tz = fj - j, o = j * W + i;
    return (d[o] * (1 - tx) + d[o + 1] * tx) * (1 - tz) + (d[o + W] * (1 - tx) + d[o + W + 1] * tx) * tz;
  };
  /** walk from (x,z) along n until the field reads `target` */
  const march = (x, z, nx, nz, target, max = 3) => {
    let hi = 0;
    const step = res * 0.7;
    while (hi < max && sample(x + nx * hi, z + nz * hi) < target) hi += step;
    let lo = Math.max(0, hi - step);
    for (let it = 0; it < 10; it++) {
      const m = (lo + hi) / 2;
      if (sample(x + nx * m, z + nz * m) < target) lo = m; else hi = m;
    }
    return (lo + hi) / 2;
  };
  return { sample, march };
}

function chaikin(pts, iterations) {
  let p = pts;
  for (let it = 0; it < iterations; it++) {
    const o = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length];
      const mixp = (t) => {
        let nx = a.nx * (1 - t) + b.nx * t, nz = a.nz * (1 - t) + b.nz * t;
        const l = Math.hypot(nx, nz) || 1;
        return { x: a.x * (1 - t) + b.x * t, z: a.z * (1 - t) + b.z * t, nx: nx / l, nz: nz / l };
      };
      o.push(mixp(0.25), mixp(0.75));
    }
    p = o;
  }
  return p;
}

/**
 * @returns {{skirt: THREE.BufferGeometry, waves: THREE.BufferGeometry}}
 */
export function buildShore(town, grid, index, { posts = [], reach = 0.7, waves = 2, foot = 0.075 } = {}) {
  const loops = traceLoops(town, grid);
  const field = distanceField(town, grid, index);

  // skirt: rim + halo (alpha, colour-mix) ; waves: per-vertex shore/sea/phase
  const sPos = [], sA = [], sIdx = [];
  const yLine = [], bLine = [];   // debug: the yellow and blue lines of 1849732997945110651
  const wShore = [], wSea = [], wPhase = [], wRow = [], wIdx = [];
  let sv = 0, wv = 0;

  for (const loop of loops) {
    if (!field) break;
    // loop vertices with averaged outward normals
    const raw = loop.map((seg, i) => {
      const prev = loop[(i + loop.length - 1) % loop.length];
      let nx = seg.nx + prev.nx, nz = seg.nz + prev.nz;
      const l = Math.hypot(nx, nz) || 1;
      return { x: seg.a.x, z: seg.a.z, nx: nx / l, nz: nz / l };
    });
    const pts = chaikin(raw, 2);
    const N = pts.length;
    if (N < 6) continue;

    // yellow line: the quay foot. blue line: pushed out on the field, smoothed.
    const shore = pts.map((p) => ({ x: p.x + p.nx * foot, z: p.z + p.nz * foot }));
    let sea = pts.map((p, i) => {
      const d = field.march(shore[i].x, shore[i].z, p.nx, p.nz, reach + foot, reach * 3);
      return { x: shore[i].x + p.nx * d, z: shore[i].z + p.nz * d };
    });
    for (let pass = 0; pass < 6; pass++) {
      sea = sea.map((p, i) => {
        const a = sea[(i + N - 1) % N], b = sea[(i + 1) % N];
        return { x: p.x * 0.5 + (a.x + b.x) * 0.25, z: p.z * 0.5 + (a.z + b.z) * 0.25 };
      });
    }

    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      yLine.push(shore[i].x, 0.03, shore[i].z, shore[j].x, 0.03, shore[j].z);
      bLine.push(sea[i].x, 0.03, sea[i].z, sea[j].x, 0.03, sea[j].z);
    }

    // arc length for the travelling time offset
    const arc = new Float32Array(N);
    for (let i = 1; i < N; i++) arc[i] = arc[i - 1] + Math.hypot(shore[i].x - shore[i - 1].x, shore[i].z - shore[i - 1].z);
    const seed = hash01(N * 7919 + Math.round(shore[0].x * 100));

    // ---- static skirt: [rim inner, rim outer, halo outer]
    const base = sv;
    for (let i = 0; i < N; i++) {
      const s = shore[i], b = sea[i];
      const dx = b.x - s.x, dz = b.z - s.z;
      sPos.push(s.x - dx * 0.06, 0.006, s.z - dz * 0.06); sA.push(0.95);
      sPos.push(s.x + dx * 0.12, 0.006, s.z + dz * 0.12); sA.push(0.0);
      sPos.push(s.x + dx * 0.04, 0.004, s.z + dz * 0.04); sA.push(-0.42);   // halo: negative = tint
      sPos.push(s.x + dx * 1.35, 0.004, s.z + dz * 1.35); sA.push(-0.0);
      sv += 4;
    }
    for (let i = 0; i < N; i++) {
      const j = (i + 1) % N;
      const a = base + i * 4, b = base + j * 4;
      sIdx.push(a, a + 1, b, b, a + 1, b + 1);          // rim
      sIdx.push(a + 2, a + 3, b + 2, b + 2, a + 3, b + 3); // halo
    }

    // ---- K overlapping wave ribbons, each with its own clock
    for (let k = 0; k < waves; k++) {
      const wb = wv;
      const ks = seed * 10 + k * 1.7;
      for (let i = 0; i < N; i++) {
        const s = arc[i];
        // smooth along the shore so crests arrive at an angle, never in lockstep
        const phase = k / waves + 0.14 * Math.sin(s * 0.7 + ks) + 0.05 * Math.sin(s * 1.9 + ks * 2.1);
        for (let row = 0; row < 2; row++) {
          wShore.push(shore[i].x, shore[i].z);
          wSea.push(sea[i].x, sea[i].z);
          wPhase.push(phase);
          wRow.push(row);
          wv++;
        }
      }
      for (let i = 0; i < N; i++) {
        const j = (i + 1) % N;
        const a = wb + i * 2, b = wb + j * 2;
        wIdx.push(a, a + 1, b, b, a + 1, b + 1);
      }
    }
  }

  // foam rings around steel legs standing in the sea
  for (const p of posts) {
    const base = sv;
    const R = 12;
    for (let i = 0; i < R; i++) {
      const a = (i / R) * Math.PI * 2;
      const c = Math.cos(a), s = Math.sin(a);
      sPos.push(p.x + c * 0.025, 0.006, p.z + s * 0.025); sA.push(0.9);
      sPos.push(p.x + c * 0.075, 0.006, p.z + s * 0.075); sA.push(0.0);
      sv += 2;
    }
    for (let i = 0; i < R; i++) {
      const a = base + i * 2, b = base + ((i + 1) % R) * 2;
      sIdx.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }

  const skirt = new THREE.BufferGeometry();
  skirt.setAttribute('position', new THREE.Float32BufferAttribute(sPos, 3));
  skirt.setAttribute('aA', new THREE.Float32BufferAttribute(sA, 1));
  skirt.setIndex(sIdx);
  skirt.computeBoundingSphere();

  const wavesGeo = new THREE.BufferGeometry();
  // `position` is only used for culling bounds; the shader rebuilds the point
  const wPos = new Float32Array(wv * 3);
  for (let i = 0; i < wv; i++) { wPos[i * 3] = wShore[i * 2]; wPos[i * 3 + 1] = 0.01; wPos[i * 3 + 2] = wShore[i * 2 + 1]; }
  wavesGeo.setAttribute('position', new THREE.BufferAttribute(wPos, 3));
  wavesGeo.setAttribute('aShore', new THREE.Float32BufferAttribute(wShore, 2));
  wavesGeo.setAttribute('aSea', new THREE.Float32BufferAttribute(wSea, 2));
  wavesGeo.setAttribute('aPhase', new THREE.Float32BufferAttribute(wPhase, 1));
  wavesGeo.setAttribute('aRow', new THREE.Float32BufferAttribute(wRow, 1));
  wavesGeo.setIndex(wIdx);
  wavesGeo.computeBoundingSphere();
  if (wavesGeo.boundingSphere) wavesGeo.boundingSphere.radius += 2;

  const lines = (arr) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
    return g;
  };
  return { skirt, waves: wavesGeo, shoreLine: lines(yLine), seaLine: lines(bLine) };
}

export function makeSkirtMaterial(waterTint) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uFoam: { value: new THREE.Color('#f7fbfa') }, uTint: { value: waterTint } },
    vertexShader: /* glsl */ `
      attribute float aA;
      varying float vA;
      void main() { vA = aA; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uFoam;
      uniform vec3 uTint;
      varying float vA;
      void main() {
        // positive: foam rim; negative: the pale halo ("the skirt stretches further")
        if (vA >= 0.0) gl_FragColor = vec4(uFoam, vA * vA);
        else gl_FragColor = vec4(uTint, -vA);
        #include <colorspace_fragment>
      }`,
  });
}

/**
 * Looping vertex shader. t walks 0..1 on the vertex's own clock:
 *   0 .. tIn   the wave runs in from the blue line to the yellow line,
 *              accelerating and narrowing as it shoals;
 *   tIn .. 1   it bounces back a little and dissolves.
 * Because the wave is invisible at both ends of the loop, the wrap is seamless.
 */
export function makeWaveMaterial({ period = 4.6 } = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uPeriod: { value: period },
      uFoam: { value: new THREE.Color('#fbfeff') },
    },
    vertexShader: /* glsl */ `
      attribute vec2 aShore;
      attribute vec2 aSea;
      attribute float aPhase;
      attribute float aRow;
      uniform float uTime;
      uniform float uPeriod;
      varying float vA;
      void main() {
        float t = fract(uTime / uPeriod + aPhase);
        const float tIn = 0.68;
        float f;      // 1 = at the blue line, 0 = on the stones
        float a;
        if (t < tIn) {
          float u = t / tIn;
          f = 1.0 - u * u * (3.0 - 2.0 * u) * (0.6 + 0.4 * u);
          a = smoothstep(0.05, 0.55, u) * (0.12 + 0.78 * u * u);
        } else {
          float u = (t - tIn) / (1.0 - tIn);
          f = 0.22 * sin(u * 1.5707963);
          a = 0.85 * (1.0 - u) * (1.0 - u);
        }
        vec2 dir = aSea - aShore;
        float len = max(length(dir), 1e-4);
        // ribbon width: broad offshore, a thin lip when it hits the stone
        float w = mix(0.07, 0.24, f) / len;
        float g = clamp(f + aRow * w, 0.0, 1.15);
        vec2 p = aShore + dir * g;
        vA = a * (1.0 - aRow) * 0.62;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(p.x, 0.012 + 0.004 * (1.0 - f), p.y, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uFoam;
      varying float vA;
      void main() {
        if (vA < 0.004) discard;
        gl_FragColor = vec4(uFoam, vA);
        #include <colorspace_fragment>
      }`,
  });
}
