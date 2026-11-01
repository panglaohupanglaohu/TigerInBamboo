/**
 * waves.js — shore waves, rebuilt from two 2024-10-25 notes.
 *
 *   1849732997945110651: "Here, the shoreline is shown in yellow. A pushed out
 *   and smoothed shoreline is shown in blue. The waves travel from the blue
 *   line to the yellow (and back a little). There is also a global water mask
 *   texture that adds extra foam around rocks and stuff."
 *
 *   1849730611964973481: "Instead of trying to make the waves roll in and out
 *   inside one shader pass, I'm creating loads of overlapping waves that each go
 *   through their own cycle."
 *
 * The first note changes the geometry, the second changes the shader.
 *
 * Geometry: the band is NOT a set of per-cell quads. The boundary edges are
 * chained into closed loops, the loops are Chaikin-smoothed, and the outer edge
 * is that smoothed loop pushed outward. The ribbon between the two loops is what
 * waves run across. Per-cell quads (my first attempt) leave a scalloped inner
 * edge and hard facets — that is exactly the "row of plates" look the reference
 * does not have.
 *
 * Shader: three cycles are evaluated at once with staggered phase, so crests
 * overlap instead of the whole band pulsing as one clock.
 */

import * as THREE from 'three';
import { buildShoreDistance } from './shorefield.js';

function hash01(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

const key = (p) => `${Math.round(p.x * 512)},${Math.round(p.z * 512)}`;

/**
 * Chain boundary edges into closed loops (in world XZ).
 * Returns arrays of {x, z, nx, nz} where n is the outward normal.
 */
function traceShoreline(town, grid) {
  const segs = new Map();     // start key -> segment
  const cells = grid.cells;

  for (const cell of cells) {
    if (town.top(cell) === 0) continue;
    for (let i = 0; i < 4; i++) {
      const nid = cell.edgeNeighbors[i];
      const nb = nid >= 0 ? cells[nid] : null;
      if (nb && town.top(nb) > 0) continue;

      const a = cell.pts[i];
      const b = cell.pts[(i + 1) % 4];
      let nx = -(b.z - a.z);
      let nz = b.x - a.x;
      const nl = Math.hypot(nx, nz) || 1;
      nx /= nl;
      nz /= nl;
      const mx = (a.x + b.x) / 2 - cell.cx;
      const mz = (a.z + b.z) / 2 - cell.cz;
      if (nx * mx + nz * mz < 0) { nx = -nx; nz = -nz; }

      const k = key(a);
      if (!segs.has(k)) segs.set(k, { a, b, nx, nz, used: false });
    }
  }

  const loops = [];
  for (const start of segs.values()) {
    if (start.used) continue;
    const loop = [];
    let cur = start;
    let guard = 0;
    while (cur && !cur.used && guard++ < 100000) {
      cur.used = true;
      loop.push({ x: cur.a.x, z: cur.a.z, nx: cur.nx, nz: cur.nz });
      cur = segs.get(key(cur.b));
    }
    // a walk that runs into a dead end (a gap in the boundary, a degenerate
    // cell) must be dropped: closing it would draw a sliver right across the
    // scene, which is exactly the long dark shard that showed up once
    const closed = cur !== undefined && key(cur.a) === key(start.a);
    if (closed && loop.length >= 3) loops.push(loop);
  }
  return loops;
}

/** Closed Chaikin subdivision: cuts corners, which is what "smoothed" means here. */
function chaikin(loop, iterations = 2) {
  let pts = loop;
  for (let it = 0; it < iterations; it++) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      out.push({ x: p.x * 0.75 + q.x * 0.25, z: p.z * 0.75 + q.z * 0.25, nx: p.nx, nz: p.nz });
      out.push({ x: p.x * 0.25 + q.x * 0.75, z: p.z * 0.25 + q.z * 0.75, nx: q.nx, nz: q.nz });
    }
    pts = out;
  }
  return pts;
}

/**
 * Ribbon between the shore loop (inner) and the pushed-out smoothed loop (outer).
 */
export function buildShoreWaves(town, grid, {
  width = 0.62,        // how far the band reaches offshore, world units
  rings = 6,
  smoothPasses = 2,
  y = 0.018,
  cycles = 3,
} = {}) {
  const pos = [];
  const aIn = [];
  const aOut = [];
  const aPhase = [];
  const aAlpha = [];
  const index = [];

  const loops = traceShoreline(town, grid);
  // Distance to land, used to place every ring at a true radius. Offsetting
  // along normals (the previous version) folds over itself inside bays.
  const field = buildShoreDistance(town, grid, { res: 0.14 });
  let vert = 0;

  for (const raw of loops) {
    const inner = chaikin(raw, smoothPasses);
    if (inner.length < 4) continue;

    const vBase = vert;
    const n = inner.length;

    for (let r = 0; r <= rings; r++) {
      const t = r / rings;                 // 0 = at the sand, 1 = offshore
      for (let i = 0; i < n; i++) {
        const a = inner[i];
        const target = width * t;
        // how far to walk so the field reads `target`, measured, not assumed
        const travel = target <= 0 ? 0 : field.march(a.x, a.z, a.nx, a.nz, target, width * 1.4);
        const x = a.x + a.nx * travel;
        const z = a.z + a.nz * travel;

        // in-direction points at the sand, out-direction points offshore
        const ix = -a.nx;
        const iz = -a.nz;

        // phase falls off with distance, so the crest travels shoreward;
        // the hash keeps neighbouring vertices from firing together
        const jitter = hash01(i * 733 + r * 37) * 0.35;
        const phase = (0.5 * t + jitter) % 1;

        // alpha: strong at the sand, gone offshore; ragged by hash
        const grain = 0.55 + 0.45 * hash01(i * 977 + r * 131);
        const alpha = Math.pow(1 - t, 0.85) * grain;

        pos.push(x, y, z);
        aIn.push(ix, 0, iz);
        aOut.push(a.nx, 0, a.nz);
        aPhase.push(phase);
        aAlpha.push(alpha);
        vert++;
      }
    }

    for (let r = 0; r < rings; r++) {
      for (let i = 0; i < n; i++) {
        const i0 = vBase + r * n + i;
        const i1 = vBase + r * n + ((i + 1) % n);
        const i2 = i0 + n;
        const i3 = i1 + n;
        index.push(i0, i2, i1, i1, i2, i3);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geometry.setAttribute('aIn', new THREE.Float32BufferAttribute(aIn, 3));
  geometry.setAttribute('aOut', new THREE.Float32BufferAttribute(aOut, 3));
  geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(aPhase, 1));
  geometry.setAttribute('aAlpha', new THREE.Float32BufferAttribute(aAlpha, 1));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  geometry.userData.cycles = cycles;
  return geometry;
}

/**
 * Material. `cycles` overlapping waves, each with its own slot in the loop —
 * the second note's point. Displacement comes from the leading cycle so the
 * surface does not jitter; alpha is the sum of all crests, which is what makes
 * the foam read as several waves passing through each other.
 */
export function makeShoreWaveMaterial({
  colour = '#f6fdfe',
  period = 3.4,
  inAmp = 0.22,
  outAmp = 0.1,
  lift = 0.05,
  cycles = 3,
} = {}) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uPeriod: { value: period },
      uIn: { value: inAmp },
      uOut: { value: outAmp },
      uLift: { value: lift },
      uCycles: { value: cycles },
      uColour: { value: new THREE.Color(colour).convertSRGBToLinear() },
    },
    vertexShader: /* glsl */ `
      attribute vec3 aIn;
      attribute vec3 aOut;
      attribute float aPhase;
      attribute float aAlpha;

      uniform float uTime;
      uniform float uPeriod;
      uniform float uIn;
      uniform float uOut;
      uniform float uLift;
      uniform float uCycles;

      varying float vAlpha;

      void main() {
        // leading cycle drives the geometry
        float t0 = fract(uTime / uPeriod + aPhase);
        float rise = sin(t0 * 3.14159265);

        vec3 p = position;
        p += aIn * (uIn * rise);
        p += aOut * (uOut * (1.0 - rise));
        p.y += uLift * rise * rise;

        // every cycle contributes its crest; overlapping waves, not one pulse
        float crest = 0.0;
        for (int c = 0; c < 3; c++) {
          if (float(c) >= uCycles) break;
          float t = fract(uTime / uPeriod + aPhase + float(c) / uCycles);
          float r = sin(t * 3.14159265);
          crest += smoothstep(0.55, 0.95, r);
        }
        crest /= max(uCycles, 1.0);

        float grain = 0.75 + 0.25 * aAlpha;
        vAlpha = clamp(aAlpha * (0.22 * rise + 1.35 * crest) * grain, 0.0, 1.0);

        gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uColour;
      varying float vAlpha;
      void main() {
        if (vAlpha <= 0.004) discard;
        gl_FragColor = vec4(uColour, vAlpha);
        #include <colorspace_fragment>
      }`,
  });
}

/**
 * Dynamic ocean (1849730611964973481 / 1991103578011029507): two crossing sine
 * trains, tiny amplitude, normal tilted by the analytic gradient so the water
 * picks up slow moving glints without drawing attention.
 */
export function makeOceanWaves(material, { amp = 0.034, period = 8.0, timeRef } = {}) {
  material.userData.waveUniforms = {
    uTime: timeRef ?? { value: 0 },
    uAmp: { value: amp },
    uPeriod: { value: period },
  };
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = material.userData.waveUniforms.uTime;
    shader.uniforms.uAmp = material.userData.waveUniforms.uAmp;
    shader.uniforms.uPeriod = material.userData.waveUniforms.uPeriod;

    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime;
        uniform float uAmp;
        uniform float uPeriod;`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        {
          float ph = uTime / uPeriod * 6.2831853;
          float ax = position.x * 1.7 + ph;
          float ay = position.y * 1.45 - ph * 0.75;
          float dWx = 1.7 * cos(ax) * cos(ay);
          float dWy = -1.45 * sin(ax) * sin(ay);
          objectNormal.x -= dWx * uAmp * 1.6;
          objectNormal.y -= dWy * uAmp * 1.6;
          objectNormal = normalize(objectNormal);
        }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float ph2 = uTime / uPeriod * 6.2831853;
        float w = sin(position.x * 1.7 + ph2) * cos(position.y * 1.45 - ph2 * 0.75);
        float w2 = sin((position.x + position.y) * 0.7 - ph2 * 0.5);
        transformed.z += (w * 0.65 + w2 * 0.35) * uAmp;`);
  };
  material.needsUpdate = true;
}
