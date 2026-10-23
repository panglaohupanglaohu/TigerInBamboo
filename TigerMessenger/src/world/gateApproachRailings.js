import * as THREE from 'three';
// 2026-10-14 (user): "扶手别放在轨道上…把轨道上的扶手都放在两侧".
// The Blender gate site was authored for the retired legacy approach route. On the current twin
// track its trim handrails (4 tubes + 117 posts) and four kerb strips in the rock mesh lie across
// the rails. This pass removes exactly those pieces (the gate's own trim and the canyon rock are
// kept) and rebuilds the railings on both outer edges of the viaduct deck over the same stretch.
// ?gateRailings=0 disables. dispose() restores the original geometry.
export const GATE_APPROACH_RAILINGS_VERSION = 'gate-approach-side-railings-3';
// EDGE: side-mounted on the deck fascia (deck edge 4.075 from the centre); measured worst car-corner reach on the
// approach curves is 3.98 m from the centre (heavy flatcar 1.72 half-width + overhang), so the inner rail face sits at ~4.14.
const EDGE = 4.2, POST_EVERY = 4, STEP = .5, GATE_HALF_LEN = 25, GATE_HALF_W = 12, CELL = 4;

function splitComponents(pos) {
  const tris = pos.count / 3, par = new Int32Array(tris).map((_, i) => i);
  const find = x => { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
  const seen = new Map();
  for (let i = 0; i < pos.count; i++) {
    const k = Math.round(pos.getX(i) * 500) + ',' + Math.round(pos.getY(i) * 500) + ',' + Math.round(pos.getZ(i) * 500), t = (i / 3) | 0;
    if (seen.has(k)) { const a = find(seen.get(k)), b = find(t); if (a !== b) par[a] = b; } else seen.set(k, t);
  }
  const comps = new Map();
  for (let t = 0; t < tris; t++) { const r = find(t); (comps.get(r) || comps.set(r, []).get(r)).push(t); }
  return [...comps.values()].sort((a, b) => b.length - a.length);
}
function keepTriangles(mesh, keep) {
  const src = mesh.geometry, g = new THREE.BufferGeometry(); let n = 0; for (const k of keep) n += k;
  for (const [name, attr] of Object.entries(src.attributes)) {
    const s = attr.itemSize, out = new Float32Array(n * 3 * s); let o = 0;
    for (let t = 0; t < keep.length; t++) if (keep[t]) for (let j = 0; j < 3 * s; j++) out[o++] = attr.array[t * 3 * s + j];
    g.setAttribute(name, new THREE.Float32BufferAttribute(out, s));
  }
  g.computeBoundingSphere(); g.computeBoundingBox(); mesh.geometry = g;
}
function hashPoints(points) {
  const H = new Map(), key = (x, y, z) => x + ',' + y + ',' + z;
  points.forEach((p, i) => { const k = key(Math.floor(p.x / CELL), Math.floor(p.y / CELL), Math.floor(p.z / CELL)); (H.get(k) || H.set(k, []).get(k)).push(i); });
  return v => { let best = Infinity, b = -1; const cx = Math.floor(v.x / CELL), cy = Math.floor(v.y / CELL), cz = Math.floor(v.z / CELL);
    for (let a = -1; a <= 1; a++) for (let c = -1; c <= 1; c++) for (let d = -1; d <= 1; d++) { const l = H.get(key(cx + a, cy + c, cz + d)); if (l) for (const i of l) { const q = points[i].distanceToSquared(v); if (q < best) { best = q; b = i; } } }
    return b; };
}

export function installGateApproachRailings({ scene, gate, tramSystem }) {
  const report = { version: GATE_APPROACH_RAILINGS_VERSION, removedTrimPieces: 0, removedTrimTriangles: 0, removedKerbStrips: 0, removedKerbTriangles: 0, posts: 0, runs: [], applied: false };
  const off = () => ({ report, apply() { return report; }, dispose() {} });
  if (new URLSearchParams(globalThis.location?.search || '').get('gateRailings') === '0') { report.skipped = 'disabled'; return off(); }
  const site = gate?.getObjectByName?.('gate-canyon-site-blender'), trim = site?.getObjectByName('gate-site-GateSite_trim-solid'), rock = site?.getObjectByName('gate-site-GateSite_rock-solid');
  const red = tramSystem?.curves?.red, blue = tramSystem?.curves?.blue;
  if (!trim || !red || !blue) { report.skipped = 'missing:' + [!trim && 'trim', !red && 'red', !blue && 'blue'].filter(Boolean).join(','); return off(); }
  const t0 = performance.now();
  const N = Math.ceil(red.getLength() / STEP), redPts = Array.from({ length: N }, (_, i) => red.getPointAt(i / N));
  const BN = Math.ceil(blue.getLength() / STEP), bluePts = Array.from({ length: BN }, (_, i) => blue.getPointAt(i / BN));
  const nearRed = hashPoints(redPts), nearBlueIdx = hashPoints(bluePts);
  // track frame at the red sample nearest to a world point: centre between the tracks, up, across (red side +)
  const frameAt = i => { const r = redPts[i], b = bluePts[nearBlueIdx(r)] || r, centre = r.clone().add(b).multiplyScalar(.5), up = centre.clone().normalize(), across = r.clone().sub(b); across.addScaledVector(up, -across.dot(up)); if (across.lengthSq() < 1e-6) return null; across.normalize(); return { centre, up, across }; };
  const originals = [];

  // ---- 1a. trim: keep only the main trim piece; the rest are the legacy handrails and posts
  const trimPos = trim.geometry.attributes.position, trimComps = splitComponents(trimPos), trimKeep = new Uint8Array(trimPos.count / 3);
  for (const t of trimComps[0]) trimKeep[t] = 1;
  const legacyLocal = [];
  trim.updateWorldMatrix(true, false);
  for (const c of trimComps.slice(1)) {
    report.removedTrimPieces++; report.removedTrimTriangles += c.length;
    if (c.length >= 100) { const pts = []; for (let i = 0; i < c.length; i += 6) pts.push(new THREE.Vector3().fromBufferAttribute(trimPos, c[i] * 3)); legacyLocal.push(pts); }
  }
  if (!legacyLocal.length) { report.skipped = 'no-legacy-tubes'; return off(); }
  originals.push([trim, trim.geometry]); keepTriangles(trim, trimKeep);

  // ---- 1b. rock: drop long pieces lying on the deck inside the track envelope (old-route kerbs)
  if (rock) {
    rock.updateWorldMatrix(true, false);
    const rp = rock.geometry.attributes.position, comps = splitComponents(rp), keep = new Uint8Array(rp.count / 3).fill(1), v = new THREE.Vector3();
    for (const c of comps) {
      if (c.length < 100 || c.length > 3000) continue;
      let inside = 0, samples = 0; const step = Math.max(1, Math.floor(c.length / 40));
      for (let k = 0; k < c.length; k += step) {
        v.fromBufferAttribute(rp, c[k] * 3).applyMatrix4(rock.matrixWorld); samples++;
        const i = nearRed(v); if (i < 0) continue; const f = frameAt(i); if (!f) continue;
        const r = v.clone().sub(f.centre), lat = r.dot(f.across), h = r.dot(f.up);
        if (Math.abs(lat) < 3.3 && h > -.05 && h < 2.5) inside++;
      }
      if (inside >= samples * .3) { for (const t of c) keep[t] = 0; report.removedKerbStrips++; report.removedKerbTriangles += c.length; }
    }
    if (report.removedKerbStrips) { originals.push([rock, rock.geometry]); keepTriangles(rock, keep); }
  }
  report.cleanupMs = Math.round(performance.now() - t0);

  // ---- 2. rebuild along both deck edges
  const railMat = new THREE.MeshStandardMaterial({ color: 0x7d4f3f, roughness: .7, metalness: .25 });
  const postMat = new THREE.MeshStandardMaterial({ color: 0xa98b6c, roughness: .8, metalness: .15 });
  const postGeo = new THREE.BoxGeometry(.1, 1.4, .1).translate(0, .4, 0);
  let group = null;
  const disposeGroup = () => { if (!group) return; group.parent?.remove(group); group.traverse(o => { if (o.isMesh && o.geometry !== postGeo) o.geometry.dispose(); }); group = null; };

  function apply() {
    const ta = performance.now();
    disposeGroup(); group = new THREE.Group(); group.name = 'gate-approach-side-railings';
    report.runs = []; report.posts = 0;
    trim.updateWorldMatrix(true, false);
    const frame = gate.getObjectByName('gate-moebius-v10') || gate.userData?.seatRoot || gate;
    frame.updateWorldMatrix(true, false); const toFrame = frame.matrixWorld.clone().invert();
    // deck-top vertices of the viaduct near the gate, hashed for height lookup
    const gatePos = new THREE.Vector3().setFromMatrixPosition(frame.matrixWorld), deckPts = [], v = new THREE.Vector3();
    scene.traverse(o => { if (o.name !== 'moebius-city-viaduct') return; o.traverse(m => { if (!m.isMesh || m.geometry.attributes.position.count < 50 || m.material?.color?.getHex?.() !== 0x66717c) return; m.updateWorldMatrix(true, false); const p = m.geometry.attributes.position; for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); if (v.distanceTo(gatePos) < 220) deckPts.push(v.clone()); } }); });
    const nearDeck = hashPoints(deckPts);
    // track ranges covered by the legacy handrail tubes
    const ranges = legacyLocal.map(pts => { const idx = pts.map(p => nearRed(p.clone().applyMatrix4(trim.matrixWorld))).filter(i => i >= 0).sort((a, b) => a - b); return idx.length ? [idx[0], idx[idx.length - 1]] : null; }).filter(Boolean).sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of ranges) { const m = merged[merged.length - 1]; if (m && r[0] <= m[1] + 4) m[1] = Math.max(m[1], r[1]); else merged.push([...r]); }
    const postMatrices = [];
    for (const [i0, i1] of merged) {
      const lines = { '-1': [], '1': [] }, runs = { '-1': [], '1': [] };
      for (let i = i0; i <= i1; i++) {
        const f = frameAt(i);
        for (const s of [-1, 1]) {
          let base = null;
          if (f) {
            const p = f.centre.clone().addScaledVector(f.across, s * EDGE), lp = p.clone().applyMatrix4(toFrame);
            if (!(Math.abs(lp.z) < GATE_HALF_LEN && Math.abs(lp.x) < GATE_HALF_W)) {
              const d = nearDeck(p);
              if (d >= 0) { const q = deckPts[d], dz = q.clone().sub(p), h = dz.dot(f.up); if (dz.addScaledVector(f.up, -h).length() < 1.2 && Math.abs(h) < .8) base = p.addScaledVector(f.up, h); }
            }
          }
          if (base) lines[s].push({ base, up: f.up, i }); else if (lines[s].length) { runs[s].push(lines[s]); lines[s] = []; }
        }
      }
      for (const s of ['-1', '1']) {
        if (lines[s].length) runs[s].push(lines[s]);
        for (const run of runs[s]) {
          if (run.length < 4) continue;
          for (const y of [1.05, .55]) {
            const curve = new THREE.CatmullRomCurve3(run.map(q => q.base.clone().addScaledVector(q.up, y)));
            const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, run.length * 2), y > 1 ? .055 : .035, 6, false), railMat);
            tube.name = y > 1 ? 'gate-approach-handrail' : 'gate-approach-midrail'; tube.castShadow = true; group.add(tube);
          }
          run.forEach((q, k) => {
            if (k % POST_EVERY && k !== run.length - 1) return;
            const nxt = run[Math.min(run.length - 1, k + 1)].base, prv = run[Math.max(0, k - 1)].base, fwd = nxt.clone().sub(prv); fwd.addScaledVector(q.up, -fwd.dot(q.up)).normalize();
            const side = new THREE.Vector3().crossVectors(q.up, fwd).normalize();
            postMatrices.push(new THREE.Matrix4().makeBasis(side, q.up, fwd).setPosition(q.base));
          });
          report.runs.push({ side: +s, from: +(run[0].i / N).toFixed(4), to: +(run[run.length - 1].i / N).toFixed(4), length: +(run.length * STEP).toFixed(1) });
        }
      }
    }
    if (postMatrices.length) { const posts = new THREE.InstancedMesh(postGeo, postMat, postMatrices.length); postMatrices.forEach((m, i) => posts.setMatrixAt(i, m)); posts.name = 'gate-approach-railing-posts'; posts.castShadow = true; posts.computeBoundingSphere(); group.add(posts); report.posts = postMatrices.length; }
    scene.add(group); report.applied = true; report.applyMs = Math.round(performance.now() - ta);
    return report;
  }
  apply();
  return {
    report, apply,
    get group() { return group; },
    dispose() { disposeGroup(); for (const [mesh, geometry] of originals) { mesh.geometry.dispose(); mesh.geometry = geometry; } originals.length = 0; postGeo.dispose(); railMat.dispose(); postMat.dispose(); report.applied = false; },
  };
}
