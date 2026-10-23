import * as THREE from 'three';
import {GREG_INK_SHARED, GREG_LAKE_LINE_PROFILE, GREG_LAKE_PALETTE} from './swampGregVisuals.js';

// 湖沼"手绘式"墨线（2026-10-10 用户定的莫比斯克制原则）：
//   * 线属于物体，不从整帧画面里算：步道、台阶、码头、荷叶舟沿顶面的外缘画一条连续的线；
//     岩壁只挑几条最长的结构折线；人物/树干仍用各自的外轮廓壳（swampGregVisuals.js）。
//   * 近处约 1 像素，10 米外变细，20 米外不画（与 GREG_LAKE_LINE_PROFILE 同一套距离）。
//   * 水面以下一律不画（GREG_INK_SHARED.uWaterY），光束、粒子没有线。
//   * 线宽沿线长缓慢起伏，像笔压，不是机械等宽。
// ?swampHandInk=0 关闭。
const WATER_Y = 25.0;
const _v = new THREE.Vector3(), _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3();

export function createInkRibbonMaterial(widthPx = 1.0) {
  const m = new THREE.ShaderMaterial({
    name: 'swamp-hand-ink', transparent: true, depthWrite: false, toneMapped: false,
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    uniforms: {
      ink: {value: new THREE.Color(GREG_LAKE_PALETTE.ink)}, viewport: {value: new THREE.Vector2(1280, 720)},
      widthPx: {value: widthPx}, nearFar: {value: new THREE.Vector2(GREG_LAKE_LINE_PROFILE.fadeStart, GREG_LAKE_LINE_PROFILE.fadeEnd)},
      uSwInv: GREG_INK_SHARED.uSwInv, uWaterY: GREG_INK_SHARED.uWaterY,
    },
    vertexShader: `
      attribute vec3 aOther; attribute float aEnd; attribute float aSide; attribute float aS;
      uniform vec2 viewport; uniform float widthPx; uniform vec2 nearFar; uniform mat4 uSwInv;
      varying float vFade; varying float vLocalY;
      void main() {
        vec3 p0 = aEnd < .5 ? position : aOther, p1 = aEnd < .5 ? aOther : position;
        vec4 v0 = modelViewMatrix * vec4(p0, 1.), v1 = modelViewMatrix * vec4(p1, 1.);
        vec4 me = aEnd < .5 ? v0 : v1;
        vFade = 1. - smoothstep(nearFar.x, nearFar.y, length(me.xyz));
        vLocalY = (uSwInv * (modelMatrix * vec4(position, 1.))).y;
        vec4 c0 = projectionMatrix * v0, c1 = projectionMatrix * v1;
        if (c0.w <= 0.0 || c1.w <= 0.0) { vFade = 0.; gl_Position = vec4(2., 2., 2., 1.); return; }
        vec2 s0 = c0.xy / c0.w * viewport * .5, s1 = c1.xy / c1.w * viewport * .5;
        vec2 d = s1 - s0; float l = length(d); d = l > 1e-5 ? d / l : vec2(1., 0.);
        vec2 nrm = vec2(-d.y, d.x);
        // pen pressure: slow swell along the stroke
        float pen = .82 + .18 * sin(aS * 1.7 + sin(aS * .43) * 2.3) + .08 * sin(aS * 5.1);
        float w = widthPx * mix(.45, 1., vFade) * pen;
        vec4 clip = aEnd < .5 ? c0 : c1;
        vec2 off = nrm * aSide * w * .5 + d * (aEnd < .5 ? -1. : 1.) * w * .5;
        clip.xy += off / (viewport * .5) * clip.w;
        gl_Position = clip;
      }`,
    fragmentShader: `
      uniform vec3 ink; uniform float uWaterY;
      varying float vFade; varying float vLocalY;
      void main() {
        if (vFade < .02 || vLocalY < uWaterY) discard;
        gl_FragColor = vec4(ink, min(1., vFade * 1.4));
        #include <colorspace_fragment>
      }`,
  });
  return m;
}

/** polylines (arrays of Vector3 in the parent's local space) -> one ribbon mesh */
export function buildInkRibbon(polylines, material, name = 'swamp-hand-ink') {
  const pos = [], oth = [], end = [], side = [], arc = [], idx = [];
  let base = 0;
  for (const line of polylines) {
    let s = 0;
    for (let i = 0; i + 1 < line.length; i++) {
      const a = line[i], b = line[i + 1], len = a.distanceTo(b);
      if (len < 1e-5) continue;
      for (const [e, sd] of [[0, -1], [0, 1], [1, -1], [1, 1]]) {
        const me = e ? b : a, other = e ? a : b;
        pos.push(me.x, me.y, me.z); oth.push(other.x, other.y, other.z); end.push(e); side.push(sd); arc.push(e ? s + len : s);
      }
      idx.push(base, base + 2, base + 1, base + 1, base + 2, base + 3); base += 4; s += len;
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('aOther', new THREE.Float32BufferAttribute(oth, 3));
  g.setAttribute('aEnd', new THREE.Float32BufferAttribute(end, 1));
  g.setAttribute('aSide', new THREE.Float32BufferAttribute(side, 1));
  g.setAttribute('aS', new THREE.Float32BufferAttribute(arc, 1));
  g.setIndex(idx); g.computeBoundingSphere();
  const mesh = new THREE.Mesh(g, material);
  mesh.name = name; mesh.userData.isOutline = true; mesh.raycast = () => {}; mesh.renderOrder = 2;
  const vp = new THREE.Vector4();
  mesh.onBeforeRender = (renderer) => { renderer.getCurrentViewport(vp); material.uniforms.viewport.value.set(Math.max(1, vp.z), Math.max(1, vp.w)); };
  return mesh;
}

/** chain undirected edges (pairs of keys) into polylines */
function chain(edges, pts) {
  const adj = new Map();
  const add = (k, e) => { if (!adj.has(k)) adj.set(k, []); adj.get(k).push(e); };
  edges.forEach((e, i) => { add(e[0], i); add(e[1], i); });
  const used = new Uint8Array(edges.length), lines = [];
  const walk = (start, ei) => {
    const out = [start]; let cur = start, e = ei;
    while (e !== undefined && !used[e]) {
      used[e] = 1; const [p, q] = edges[e]; cur = p === cur ? q : p; out.push(cur);
      e = (adj.get(cur) || []).find(x => !used[x]);
    }
    return out;
  };
  // start from ends (degree 1) first, then loops
  for (const [k, list] of adj) if (list.length === 1 && !used[list[0]]) lines.push(walk(k, list[0]));
  edges.forEach((e, i) => { if (!used[i]) lines.push(walk(e[0], i)); });
  return lines.map(l => l.map(k => pts.get(k)));
}
const key = v => `${Math.round(v.x * 500)},${Math.round(v.y * 500)},${Math.round(v.z * 500)}`;
const lineLength = l => { let s = 0; for (let i = 1; i < l.length; i++) s += l[i - 1].distanceTo(l[i]); return s; };

/** top-face outer edges of a mesh, in the mesh's own space (instances baked in). upLocal: inner up in mesh space */
export function topEdgeLines(mesh, upInMesh, {minUp = .55, lift = .012, minLength = .6, twoSided = false} = {}) {
  const g = mesh.geometry, p = g.attributes.position, ix = g.index, tri = ix ? ix.count / 3 : p.count / 3;
  const counts = mesh.isInstancedMesh ? mesh.count : 1, M = new THREE.Matrix4(), out = [];
  for (let inst = 0; inst < counts; inst++) {
    if (mesh.isInstancedMesh) mesh.getMatrixAt(inst, M); else M.identity();
    const pts = new Map(), use = new Map();
    for (let t = 0; t < tri; t++) {
      const i0 = ix ? ix.getX(t * 3) : t * 3, i1 = ix ? ix.getX(t * 3 + 1) : t * 3 + 1, i2 = ix ? ix.getX(t * 3 + 2) : t * 3 + 2;
      _a.fromBufferAttribute(p, i0).applyMatrix4(M); _b.fromBufferAttribute(p, i1).applyMatrix4(M); _c.fromBufferAttribute(p, i2).applyMatrix4(M);
      _n.subVectors(_b, _a).cross(_v.subVectors(_c, _a)); const area = _n.length(); if (area < 1e-9) continue; _n.divideScalar(area);
      const up = _n.dot(upInMesh); if ((twoSided ? Math.abs(up) : up) < minUp) continue;// open (double-sided) leaves count either way up
      const ks = [_a, _b, _c].map(v => { const k = key(v); if (!pts.has(k)) pts.set(k, v.clone().addScaledVector(upInMesh, lift)); return k; });
      for (const [x, y] of [[0, 1], [1, 2], [2, 0]]) { const ek = ks[x] < ks[y] ? ks[x] + '|' + ks[y] : ks[y] + '|' + ks[x]; use.set(ek, (use.get(ek) || 0) + 1); }
    }
    const edges = []; for (const [ek, n] of use) if (n === 1) edges.push(ek.split('|'));
    for (const l of chain(edges, pts)) if (lineLength(l) >= minLength) out.push(l);
  }
  return out;
}

/** a few long structural creases of a rock mesh (sharp folds), longest first */
export function creaseLines(mesh, {angle = 55, keep = 12, minLength = 2.5} = {}) {
  const g = mesh.geometry, p = g.attributes.position, ix = g.index, tri = ix ? ix.count / 3 : p.count / 3;
  const pts = new Map(), faces = new Map(), cos = Math.cos(angle * Math.PI / 180);
  for (let t = 0; t < tri; t++) {
    const id = [0, 1, 2].map(j => ix ? ix.getX(t * 3 + j) : t * 3 + j);
    _a.fromBufferAttribute(p, id[0]); _b.fromBufferAttribute(p, id[1]); _c.fromBufferAttribute(p, id[2]);
    _n.subVectors(_b, _a).cross(_v.subVectors(_c, _a)); const area = _n.length(); if (area < 1e-9) continue; _n.divideScalar(area);
    const ks = [_a, _b, _c].map(v => { const k = key(v); if (!pts.has(k)) pts.set(k, v.clone()); return k; });
    for (const [x, y] of [[0, 1], [1, 2], [2, 0]]) { const ek = ks[x] < ks[y] ? ks[x] + '|' + ks[y] : ks[y] + '|' + ks[x]; if (!faces.has(ek)) faces.set(ek, []); faces.get(ek).push(_n.clone()); }
  }
  const edges = []; for (const [ek, ns] of faces) if (ns.length === 2 && ns[0].dot(ns[1]) < cos) edges.push(ek.split('|'));
  const lines = chain(edges, pts).filter(l => lineLength(l) >= minLength).sort((u, w) => lineLength(w) - lineLength(u));
  return lines.slice(0, keep);
}

export function installSwampHandInk({swamp, enabled = new URLSearchParams(globalThis.location?.search || '').get('swampHandInk') !== '0'} = {}) {
  const report = {enabled, version: 1, walkMeshes: 0, walkLines: 0, boatCups: 0, rockLines: 0, ribbons: 0};
  if (!enabled || !swamp) return {report, update() {}};
  const inner = swamp.userData?.inner || swamp;
  inner.updateWorldMatrix(true, true);
  const sync = () => { GREG_INK_SHARED.uSwInv.value.copy(inner.matrixWorld).invert(); GREG_INK_SHARED.uWaterY.value = WATER_Y - .02; };
  sync();
  const upIn = (mesh) => { // inner +Y expressed in the mesh's local frame
    const q = new THREE.Quaternion(); mesh.updateWorldMatrix(true, false);
    const mi = new THREE.Matrix4().copy(mesh.matrixWorld).invert().multiply(inner.matrixWorld);
    return new THREE.Vector3(0, 1, 0).transformDirection(mi).normalize();
  };
  const walkMat = createInkRibbonMaterial(1.0), boatMat = createInkRibbonMaterial(1.0), rockMat = createInkRibbonMaterial(.9);
  const u = inner.userData;
  const walk = new Set([...(u.gregCoralRim?.walkMeshes || []), ...(u.gregSpatialPlan?.walkMeshes || []), ...(u.tigerWalkSurfaces || []),
    ...(u.gregShoreDock?.walkMeshes || []), ...(u.swampEntranceBridge?.walkMeshes || [])].filter(m => m?.isMesh && m.geometry?.attributes?.position));
  for (const m of walk) {
    const lines = topEdgeLines(m, upIn(m), {minLength: 1.0});
    if (!lines.length) continue;
    m.add(buildInkRibbon(lines, walkMat, 'swamp-hand-ink-walk')); report.walkMeshes++; report.walkLines += lines.length; report.ribbons++;
  }
  inner.traverse(o => {
    if (o.name !== 'swamp-flower-boat-cup' || !o.isMesh) return;
    const lines = topEdgeLines(o, new THREE.Vector3(0, 1, 0), {minUp: .2, lift: .02, minLength: 1.5, twoSided: true});
    if (lines.length) { o.add(buildInkRibbon(lines, boatMat, 'swamp-hand-ink-leaf')); report.boatCups++; report.ribbons++; }
  });
  for (const name of ['greg-natural-cliff-rock', 'swamp-sinkhole-wall']) {
    const m = inner.getObjectByName(name); if (!m?.isMesh) continue;
    const lines = creaseLines(m, {keep: name === 'swamp-sinkhole-wall' ? 8 : 12});
    if (lines.length) { m.add(buildInkRibbon(lines, rockMat, 'swamp-hand-ink-rock')); report.rockLines += lines.length; report.ribbons++; }
  }
  return {report, update: sync};
}
