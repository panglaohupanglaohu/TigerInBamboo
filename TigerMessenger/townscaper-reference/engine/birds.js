/**
 * Birds.
 *
 * Reference (2020-03-31): "Better Birdies: more bird shaped / only has outlines
 * when sitting / shuffle about more / has reflections / flowier flight"
 *
 * Frame-by-frame, at 4× (the crop is the only way to see this — the birds are
 * about 20px tall in the source):
 *
 *   perched  A *solid* body: a fat ellipsoid, a small round head lifted at the
 *            front, a flat fan tail, and two wings folded against the flanks so
 *            they make a shoulder bump. A single thin dark line traces the whole
 *            silhouette. It squats — front low, tail up.
 *
 *   flying   A bent ribbon, NOT a symmetric V. One wing rides high and the other
 *            dips, so from the side it reads as a hook / seagull banked in a
 *            turn. No outline: against the sky the contrast is already there.
 *
 * The previous version used one flat symmetric chevron for both states and
 * faked the outline by darkening the perched copies. That is why it looked like
 * a dart: no volume, no tail, no head, and "outline" achieved by turning the
 * bird grey. Two separate geometries and a real inverted-hull rim fix it.
 */

import * as THREE from 'three';
import { smoothTerrainNormals } from './normalsmooth.js';

const LEVEL = 0.42;

/** Concatenate non-indexed position arrays. Small helper, no addons needed. */
function mergePositions(geometries) {
  const parts = geometries.map((g) => {
    const flat = g.index ? g.toNonIndexed() : g;
    return flat.getAttribute('position').array;
  });
  const total = parts.reduce((n, a) => n + a.length, 0);
  const buf = new Float32Array(total);
  let offset = 0;
  for (const a of parts) {
    buf.set(a, offset);
    offset += a.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(buf, 3));
  out.computeVertexNormals();
  return out;
}

/** A squatting pigeon: flat body, lifted head, fan tail, wings folded in. */
function perchedGeometry() {
  const body = new THREE.IcosahedronGeometry(0.041, 1);
  body.scale(1.0, 0.76, 1.75);
  body.translate(0, 0.050, 0.004);

  const head = new THREE.IcosahedronGeometry(0.024, 1);
  head.scale(1.0, 1.0, 1.1);
  head.translate(0, 0.078, 0.062);

  // tail: a flat fan tipped up — most of the perched silhouette is this
  const tail = new THREE.IcosahedronGeometry(0.024, 1);
  tail.scale(1.35, 0.20, 1.85);
  tail.rotateX(-0.30);
  tail.translate(0, 0.058, -0.076);

  // folded wings: thin slabs hugging the flanks
  const wingL = new THREE.IcosahedronGeometry(0.029, 1);
  wingL.scale(0.26, 0.92, 1.30);
  wingL.rotateZ(0.14);
  wingL.translate(-0.038, 0.052, -0.006);
  const wingR = wingL.clone();
  wingR.scale(-1, 1, 1);
  wingR.translate(0.076, 0, 0);

  const geo = mergePositions([body, head, tail, wingL, wingR]);
  // Radii here are bird-sized, not voxel-sized: 0.03 spans the gaps between
  // body/head/tail, and blend 1 keeps no hard edges (a bird has none).
  smoothTerrainNormals(geo, { radius: 0.03, blend: 1.0, hardLo: 0.95, hardHi: 1.0 });
  return geo;
}

/**
 * A banked bird: two wings on different heights, each bent in two segments so
 * the silhouette hooks instead of forming a flat V.
 */
function flyingGeometry() {
  const v = [];
  const tri = (a, b, c) => v.push(...a, ...b, ...c);

  // high wing (left), rising and swept back
  const shoulderL = [0, 0.006, 0.016];
  const elbowL = [-0.085, 0.052, -0.012];
  const tipL = [-0.150, 0.086, -0.085];
  tri(shoulderL, elbowL, tipL);
  tri(shoulderL, tipL, [-0.060, 0.030, -0.070]);

  // low wing (right), dipping and swept back
  const shoulderR = [0, 0.006, 0.016];
  const elbowR = [0.085, -0.014, -0.012];
  const tipR = [0.148, -0.048, -0.082];
  tri(shoulderR, tipR, elbowR);
  tri(shoulderR, [0.058, 0.004, -0.072], tipR);

  // slim body running back from the shoulders
  tri([0, 0.006, 0.016], [0.016, 0.004, -0.010], [0, 0.004, -0.078]);
  tri([0, 0.006, 0.016], [0, 0.004, -0.078], [-0.016, 0.004, -0.010]);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  g.computeVertexNormals();
  smoothTerrainNormals(g, { radius: 0.03, blend: 1.0, hardLo: 0.95, hardHi: 1.0 });
  return g;
}

function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBirds({ town, grid, houses = [], count = 18, seed = 1, groundAt = null, size = 1 } = {}) {
  const rng = mulberry(seed * 7919 + 13);

  const perchedGeo = perchedGeometry();
  const flyingGeo = flyingGeometry();

  const feather = new THREE.MeshLambertMaterial({
    color: '#f8f7f1',
    side: THREE.DoubleSide,
  });
  const perchedBody = new THREE.InstancedMesh(perchedGeo, feather, count);
  const flyingBody = new THREE.InstancedMesh(flyingGeo, feather, count);
  for (const m of [perchedBody, flyingBody]) {
    m.frustumCulled = false;
    m.castShadow = false;
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Deliberately NOT flagged overlayOnly. Hiding a mesh from the normal pass
    // while still drawing it in the colour pass makes the two disagree, and the
    // edge detector then traces the bird's whole body — which is where the
    // orange outline came from. Letting it into the normal pass means the engine
    // draws the thin contour the reference actually has.
  }
  perchedBody.renderOrder = 1;

  // Perch candidates: roofs first, then any tall ledge.
  const perches = [];
  for (const h of houses) if (h.cell) perches.push({ cell: h.cell, top: h.top, roof: true });
  if (perches.length === 0) {
    for (const cell of grid.cells) {
      const top = town.top(cell);
      if (top >= 4) perches.push({ cell, top, roof: false });
      if (perches.length > 18) break;
    }
  }

  const birds = [];
  for (let i = 0; i < count; i++) {
    const p = perches.length ? perches[i % perches.length] : null;
    birds.push({
      state: 'perched',
      timer: 2 + rng() * 6,
      perch: p,
      offX: (rng() - 0.5) * 0.30,
      offZ: (rng() - 0.5) * 0.30,
      yaw: rng() * Math.PI * 2,
      shuffle: rng() * 10,
      orbit: 10 + rng() * 6,
      phase: rng() * Math.PI * 2,
      speed: 0.18 + rng() * 0.22,
      height: 4.4 + rng() * 2.6,
      flap: rng() * 10,
      bank: rng() < 0.5 ? 1 : -1,
      pos: new THREE.Vector3(),
    });
  }

  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const up = new THREE.Vector3(0, 1, 0);
  const scale = new THREE.Vector3();
  const pos = new THREE.Vector3();

  return {
    group: (() => {
      const g = new THREE.Group();
      g.add(perchedBody, flyingBody);
      return g;
    })(),
    meshes: { perchedBody, flyingBody },
    update(dt, t) {
      let pn = 0;
      let fn = 0;

      for (let i = 0; i < birds.length; i++) {
        const b = birds[i];
        b.timer -= dt;
        if (b.timer <= 0) {
          b.state = b.state === 'perched' ? 'flying' : 'perched';
          b.timer = b.state === 'perched' ? 4 + rng() * 7 : 4 + rng() * 8;
          if (b.state === 'flying') {
            b.phase = Math.atan2(b.pos.z, b.pos.x) || rng() * Math.PI * 2;
            b.height = 4.2 + rng() * 3.2;
            b.orbit = 9.5 + rng() * 6.5;
          } else if (perches.length) {
            b.perch = perches[i % perches.length];
            b.offX = (rng() - 0.5) * 0.30;
            b.offZ = (rng() - 0.5) * 0.30;
          }
        }

        if (b.state === 'perched' && b.perch) {
          const { cell, top } = b.perch;
          // The roof height cannot be derived: a gable's crest depends on the
          // building's footprint, so "+0.70" was a guess that left birds
          // hovering over low roofs and buried in tall ones. When the caller can
          // supply a raycast against the real geometry, use it.
          const y = groundAt
            ? groundAt(cell) + 0.012
            : top * LEVEL + (b.perch.roof ? 0.70 : 0.02);
          const drift = Math.sin(t * 0.8 + b.shuffle) * 0.010;
          // shuffle: small steps plus an occasional head bob
          const step = Math.sin(t * 1.9 + b.shuffle) > 0.93 ? 0.28 : 0;
          const bob = Math.max(0, Math.sin(t * 3.4 + b.shuffle * 2)) * 0.10;

          pos.set(cell.cx + b.offX + drift, y, cell.cz + b.offZ);
          e.set(bob * 0.5, b.yaw + step, 0);
          q.setFromEuler(e);
          scale.setScalar(size);
          m.compose(pos, q, scale);
          perchedBody.setMatrixAt(pn, m);
          pn++;
        } else {
          const a = b.phase;
          const r = b.orbit + Math.sin(t * 0.5 + b.orbit) * 1.2;
          pos.set(Math.cos(a) * r, b.height + Math.sin(t * 1.6 + b.flap) * 0.22, Math.sin(a) * r * 0.85);

          // heading follows the orbit tangent; bank into the turn
          const yaw = -a + Math.PI / 2;
          const roll = b.bank * (0.30 + Math.sin(t * 0.7 + b.flap) * 0.10);
          e.set(0, yaw, roll, 'YXZ');
          q.setFromEuler(e);
          // flap: squash the ribbon vertically, which reads as wing beats
          const flap = 0.92 + 0.22 * Math.sin(t * 8.5 + b.flap);
          scale.set(size, flap * size, size);
          m.compose(pos, q, scale);
          flyingBody.setMatrixAt(fn, m);
          fn++;

          b.pos.copy(pos);
        }
      }

      perchedBody.count = pn;
      flyingBody.count = fn;
      perchedBody.instanceMatrix.needsUpdate = true;
      flyingBody.instanceMatrix.needsUpdate = true;
    },
    dispose() {
      perchedGeo.dispose();
      flyingGeo.dispose();
      feather.dispose();
    },
  };
}
