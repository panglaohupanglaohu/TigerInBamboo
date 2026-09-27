import * as THREE from 'three';
import {toonMat, addOutline} from '../../assets/toon.js';
import {mergeStaticGroup} from '../geometryMerge.js';
import {citadelCoastalFrame, inCitadelTramTunnel} from './coastalTramRoute.js';

// Holy-city coastal tram structures (target: artifacts/pipeline/citadel-coastal-tram-target/target-r01.png).
// Replaces the generic 2 m steel pylons on the citadel leg with stone piers and
// semicircular arches, adds stone parapets, lamps and two quay stations.
// Castle-local window of the citadel leg (x/z in metres, near hemisphere only).
const WINDOW = {minX: -145, maxX: 140, minZ: 20, maxZ: 140, minY: -45};
// Stations in castle-local x/z; platforms sit on the seaward side of the double track.
// exit: drop-tested walkable landing (castle-local x/z, altitude above sea).
export const COASTAL_TRAM_STATIONS = Object.freeze([
  {id: 'new-city', name: '新城站', x: -1, z: 44.2, length: 9, exit: {x: 9, z: 46, h: 7.6}},
  {id: 'old-town', name: '旧城站', x: -25, z: 33.5, length: 18, exit: {x: -31, z: 29.5, h: 1.2}, stairsTo: {x: -31, z: 29.5}},
]);
const STATION_RADIUS = 20;
const PIER_SPACING = 9;
const DECK_HALF = 1.75;   // matches the 3.35 m tram deck
const _inv = new THREE.Matrix4();

export function inCitadelCoastalWindow(worldPoint) {
  _inv.copy(citadelCoastalFrame()).invert();
  const l = worldPoint.clone().applyMatrix4(_inv);
  return l.y > WINDOW.minY && l.x > WINDOW.minX && l.x < WINDOW.maxX && l.z > WINDOW.minZ && l.z < WINDOW.maxZ && !inCitadelTramTunnel(worldPoint);
}

function frameAt(curve, t) {
  const p = curve.getPointAt(t), fwd = curve.getTangentAt(t).normalize();
  const up = p.clone().normalize();
  const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
  fwd.crossVectors(right, up).normalize();
  return {p, fwd, up, right};
}
function orient(mesh, f) {
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(f.right, f.up, f.fwd));
}
function block(parent, geo, mat, f, along = 0, lateral = 0, radial = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.copy(f.p).addScaledVector(f.fwd, along).addScaledVector(f.right, lateral).addScaledVector(f.up, radial);
  orient(m, f);
  m.castShadow = true; m.receiveShadow = true;
  parent.add(m);
  return m;
}

/**
 * @param {THREE.Group} group tram system group
 * @param {THREE.Curve} curve shared centre curve
 * @param {number} R planet radius
 * @param {(dir:THREE.Vector3,R:number)=>number} groundRadiusAt real ground/seabed radius
 */
export function addCitadelCoastalTramStructures(group, curve, R, groundRadiusAt) {
  const stone = toonMat(0xd9ceb6, {flatShading: true});
  const stoneDark = toonMat(0xb9ad94, {flatShading: true});
  const cap = toonMat(0xefe6d2, {flatShading: true});
  const canopy = toonMat(0x2f56a8, {flatShading: true});
  const iron = toonMat(0x3a3f47, {flatShading: true});
  const lamp = toonMat(0xffd98a, {emissive: 0xffc15a, emissiveIntensity: 0.9});
  const root = new THREE.Group(); root.name = 'citadel-coastal-tram-structures';
  const L = curve.getLength(), N = Math.ceil(L / 1.5);
  // Collect the citadel-window samples as one or more contiguous runs.
  const runs = []; let run = null;
  for (let i = 0; i <= N; i++) {
    const t = (i / N) % 1, p = curve.getPointAt(t);
    if (inCitadelCoastalWindow(p)) { if (!run) runs.push(run = []); run.push(t); } else run = null;
  }
  const clearance = (f) => f.p.length() - groundRadiusAt(f.up, R);
  const pierGeo = new THREE.BoxGeometry(DECK_HALF * 2 + .5, 1, 1.5);
  const footGeo = new THREE.BoxGeometry(DECK_HALF * 2 + 1.1, .7, 2.2);
  const parapetGeo = new THREE.BoxGeometry(.32, .75, 1.55);
  const fasciaGeo = new THREE.BoxGeometry(.28, 1.0, 1.55);
  const postGeo = new THREE.CylinderGeometry(.07, .09, 3.2, 6);
  const globeGeo = new THREE.SphereGeometry(.2, 8, 6);
  for (const ts of runs) {
    if (ts.length < 4) continue;
    const t0 = ts[0], span = ((ts[ts.length - 1] - t0 + 1) % 1) || 1e-6, runLen = span * L;
    const at = (s) => (t0 + (s / runLen) * span) % 1;   // arc length within run -> curve t
    // Deck fascia + parapets every 1.5 m.
    for (let s = 0; s < runLen; s += 1.5) {
      const f = frameAt(curve, at(s));
      if (clearance(f) < .6) continue;
      for (const side of [-1, 1]) {
        block(root, fasciaGeo, stoneDark, f, 0, side * (DECK_HALF + .12), -.65);
        block(root, parapetGeo, cap, f, 0, side * (DECK_HALF + .12), .3);
      }
    }
    // Arcade: each span is one extruded masonry panel (piers + spandrel + round arch).
    const spans = [];
    for (let s0 = 0; s0 + 2 < runLen; s0 += PIER_SPACING) spans.push([s0, Math.min(runLen, s0 + PIER_SPACING)]);
    for (const [a, b] of spans) {
      const pa = curve.getPointAt(at(a)), pb = curve.getPointAt(at(b));
      const center = pa.clone().add(pb).multiplyScalar(.5), up = center.clone().normalize();
      const fwd = pb.clone().sub(pa); fwd.addScaledVector(up, -fwd.dot(up));
      const S = fwd.length(); if (S < 1.5) continue; fwd.normalize();
      const right = new THREE.Vector3().crossVectors(up, fwd).normalize();
      const clearMid = center.length() - groundRadiusAt(up, R);
      if (clearMid < .6) continue;
      const footA = groundRadiusAt(pa.clone().normalize(), R), footB = groundRadiusAt(pb.clone().normalize(), R);
      const bottom = Math.min(footA, footB) - center.length() - .6;
      const topA = pa.clone().sub(center).dot(up) - .3, topB = pb.clone().sub(center).dot(up) - .3;
      const topMid = Math.min(topA, topB), half = S / 2 + .06;
      const shape = new THREE.Shape();
      shape.moveTo(-half, bottom); shape.lineTo(-half, topA); shape.lineTo(half, topB); shape.lineTo(half, bottom);
      const crown = 1.0, pierHalf = .85;
      let r = half - pierHalf, spring = topMid - crown - r;
      if (spring < bottom + .8) { r = Math.min(r, topMid - crown - bottom - .8); spring = bottom + .8; }
      if (r > 1.2) {
        shape.lineTo(r, bottom); shape.lineTo(r, spring);
        shape.absarc(0, spring, r, 0, Math.PI, false);
        shape.lineTo(-r, bottom);
      }
      shape.lineTo(-half, bottom);
      const g = new THREE.ExtrudeGeometry(shape, {depth: DECK_HALF * 2 + .5, bevelEnabled: false, curveSegments: 14});
      g.translate(0, 0, -(DECK_HALF * 2 + .5) / 2);
      const m = new THREE.Mesh(g, stone);
      m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fwd, up, right.clone().negate()));
      m.position.copy(center); m.castShadow = true; m.receiveShadow = true; root.add(m);
      // Pier plinth / cutwater at the span start.
      const fa = frameAt(curve, at(a));
      if (fa.p.length() - footA > 1.5) block(root, footGeo, stoneDark, fa, 0, 0, -(fa.p.length() - footA) + .2);
    }
    // Lamps every 12 m on alternating sides.
    let side = 1;
    for (let s = 6; s < runLen; s += 12) {
      const f = frameAt(curve, at(s));
      if (clearance(f) < .6) continue;
      block(root, postGeo, iron, f, 0, side * (DECK_HALF + .12), 2.2);
      block(root, globeGeo, lamp, f, 0, side * (DECK_HALF + .12), 3.9);
      side = -side;
    }
  }
  // Stations: seaward platform slab, blue canopies, lamp posts.
  const frame = citadelCoastalFrame();
  for (const st of COASTAL_TRAM_STATIONS) {
    const target = new THREE.Vector3(st.x, 0, st.z).applyMatrix4(frame).normalize();
    let best = 0, bestD = Infinity;
    for (let i = 0; i < 2000; i++) { const d = curve.getPointAt(i / 2000).clone().normalize().distanceTo(target); if (d < bestD) { bestD = d; best = i / 2000; } }
    const g = new THREE.Group(); g.name = 'citadel-tram-station-' + st.id;
    const f0 = frameAt(curve, best);
    const exitW = new THREE.Vector3(st.exit.x, 0, st.exit.z).applyMatrix4(frame).normalize().multiplyScalar(R + st.exit.h);
    const land = exitW.clone().sub(f0.p).dot(f0.right) > 0 ? 1 : -1;   // platform faces the town exit
    for (let s = -st.length / 2; s <= st.length / 2; s += 1.5) {
      const f = frameAt(curve, (best + s / L + 1) % 1);
      block(g, new THREE.BoxGeometry(3.2, .5, 1.6), cap, f, 0, land * (DECK_HALF + 1.8), -.1);
      block(g, new THREE.BoxGeometry(.3, .9, 1.6), stoneDark, f, 0, land * (DECK_HALF + 3.35), .35);
    }
    for (let s = -st.length / 2 + 3; s <= st.length / 2 - 3; s += 6) {
      const f = frameAt(curve, (best + s / L + 1) % 1);
      block(g, new THREE.CylinderGeometry(.1, .1, 3, 6), iron, f, 0, land * (DECK_HALF + 3.0), 1.65);
      const roof = block(g, new THREE.ConeGeometry(2.6, 1.1, 4), canopy, f, 0, land * (DECK_HALF + 1.9), 3.6);
      roof.rotateY(Math.PI / 4);
      block(g, globeGeo, lamp, f, 0, land * (DECK_HALF + 3.0), 3.0);
    }
    if (st.stairsTo) {
      // Straight flight from the platform's town edge down to the exit square.
      const fs = frameAt(curve, (best + (st.length / 2 - 1) / L + 1) % 1);
      const top = fs.p.clone().addScaledVector(fs.right, land * (DECK_HALF + 3.9)).addScaledVector(fs.up, .15);
      const drop = top.length() - (R + st.exit.h - .8), steps = Math.max(4, Math.ceil(drop / .22));
      const dir = fs.fwd.clone().multiplyScalar(-1), tread = .34;
      for (let k = 0; k < steps; k++) {
        const c = top.clone().addScaledVector(dir, (k + .5) * tread).addScaledVector(fs.up, -(k + .5) * drop / steps - .3);
        const m = new THREE.Mesh(new THREE.BoxGeometry(1.8, .6, tread + .02), cap);
        m.position.copy(c); m.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(fs.right, fs.up, fs.fwd));
        m.castShadow = true; g.add(m);
      }
    }
    g.userData.station = st;
    root.add(g);
  }
  const meshes = []; root.traverse((o) => { if (o.isMesh && o.material !== lamp) meshes.push(o); });
  for (const o of meshes) addOutline(o, 0.01);
  group.add(root);
  try { mergeStaticGroup(root); } catch (e) { console.warn('citadel coastal tram merge skipped', e); }
  return root;
}

/**
 * Holy-city leg: riders may only leave at a station. Returns null outside the
 * citadel leg, {blocked} between stations, or {exit, station} near one.
 */
export function citadelTramAlight(tramWorld, R) {
  if (!tramWorld || !inCitadelCoastalWindow(tramWorld)) return null;
  const frame = citadelCoastalFrame(), inv = frame.clone().invert();
  const l = tramWorld.clone().applyMatrix4(inv);
  for (const st of COASTAL_TRAM_STATIONS) {
    if (Math.hypot(l.x - st.x, l.z - st.z) > STATION_RADIUS) continue;
    const exit = new THREE.Vector3(st.exit.x, 0, st.exit.z).applyMatrix4(frame).normalize().multiplyScalar(R + st.exit.h);
    return {exit, station: st};
  }
  return {blocked: true, stations: COASTAL_TRAM_STATIONS.map((st) => st.name)};
}
