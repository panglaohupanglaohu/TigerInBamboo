import * as THREE from 'three';
import {createSwampLivingPathConstraints} from './swampGregLivingPaths.js';
// 湖沼目标图：坑缘一圈 6–8 朵巨大的红橙色花，花瓣向外翻开，花心发黄白光。
// Greg 团队·异星生态（Patric Fallon）：花是坑缘植被带的"灯"，从湖心往上看给坑口画一圈暖色节奏；
// 有机通行（Niklas Åkerblad）：每朵花的整株包络（叶+花瓣半径、花高）都过 createSwampLivingPathConstraints
// 的步道净宽/头部净空/虎道/既有树根/船鲸水道检查，不过就沿坑缘挪位或缩小，再不过就不种；台阶口 0.5±0.4 rad 不种。
// 花瓣/花心/垫叶合并为一个顶点色网格，花心光晕为一个加色广告牌网格 = 2 次绘制。?swampRimFlowers=0 关闭。
const flag = k => new URLSearchParams(globalThis.location?.search || '').get(k) !== '0';
const ENTRANCE = .5;
const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
function rng(seed) { let s = seed >>> 0 || 1; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

function makeRimGround(inner, rimY) {
  const targets = [];
  inner.traverse(o => { if (o.isMesh && o.visible && /coral-rim-rock|natural-cliff-rock|swamp-sinkhole-wall|rim-ground|swamp-ground/.test(o.name)) targets.push(o); });
  const rc = new THREE.Raycaster(), o = new THREE.Vector3(), d = new THREE.Vector3(), p = new THREE.Vector3();
  const at = (x, z) => {
    o.set(x, rimY + 12, z); inner.localToWorld(o); d.set(x, rimY - 12, z); inner.localToWorld(d); d.sub(o).normalize(); rc.set(o, d);
    for (const hit of rc.intersectObjects(targets, false)) { p.copy(hit.point); inner.worldToLocal(p); if (Math.abs(p.y - rimY) < 2.5) return p.y; }
    return null;
  };
  return at;
}
// 沿径向由里往外找坑缘内沿：第一个落在坑缘顶面（rimY±2.5）的半径
function findLip(groundAt, a) {
  for (let r = 29; r <= 38; r += .4) if (groundAt(Math.cos(a) * r, Math.sin(a) * r) != null) return r;
  return 34.5;
}

// 一片花瓣/叶：u 沿长度，v 横向；θ(u) 控制先上扬再外翻
function petal(out, M, {L, W, lift, fall, cup, base, col0, col1, colEdge}) {
  const U = 6, V = 4, start = out.pos.length / 3, P = new THREE.Vector3(), c = new THREE.Color();
  for (let i = 0; i <= U; i++) {
    const u = i / U, th = lift - fall * u;
    const r = base + L * u * Math.cos(th * .8), h = L * u * Math.sin(th) * (1 - .35 * u);
    const w = W * .5 * Math.pow(Math.sin(Math.PI * (.12 + .88 * u)), .75) * (u > .9 ? (1 - u) * 6 + .4 : 1);
    for (let k = 0; k <= V; k++) {
      const v = k / V * 2 - 1;
      P.set(r, h + cup * W * v * v * Math.sin(Math.PI * u), v * w).applyMatrix4(M);
      out.pos.push(P.x, P.y, P.z);
      c.copy(col0).lerp(col1, Math.pow(u, .9)).lerp(colEdge, Math.abs(v) ** 3 * .45 * u);
      out.col.push(c.r, c.g, c.b);
    }
  }
  for (let i = 0; i < U; i++) for (let k = 0; k < V; k++) {
    const a = start + i * (V + 1) + k, b = a + 1, a2 = a + V + 1, b2 = a2 + 1;
    out.idx.push(a, a2, b, b, a2, b2);
  }
}
function blob(out, M, radius, height, color, seg = 8) { // 低多边圆顶（花心）
  const start = out.pos.length / 3, P = new THREE.Vector3(), c = new THREE.Color(color);
  P.set(0, height, 0).applyMatrix4(M); out.pos.push(P.x, P.y, P.z); out.col.push(c.r, c.g, c.b);
  const c2 = c.clone().offsetHSL(0, 0, -.12);
  for (let k = 0; k < seg; k++) { const a = k / seg * Math.PI * 2; P.set(Math.cos(a) * radius, height * .35, Math.sin(a) * radius).applyMatrix4(M); out.pos.push(P.x, P.y, P.z); out.col.push(c2.r, c2.g, c2.b); }
  for (let k = 0; k < seg; k++) out.idx.push(start, start + 1 + (k + 1) % seg, start + 1 + k);
}

const GLOW_VERT = /* glsl */`
attribute vec2 aCorner; attribute float aSize; attribute float aSeed; uniform float uTime; uniform float uMaxNdc;
varying vec2 vC; varying float vSeed;
void main(){ vC=aCorner; vSeed=aSeed;
  vec4 mv=modelViewMatrix*vec4(position,1.0);
  vec4 cp=projectionMatrix*mv;
  float s=aSize*(1.0+0.07*sin(uTime*1.3+aSeed*6.28));
  // 屏幕上限：离镜头再近，光晕在屏幕上也不超过 uMaxNdc（半屏高的比例）
  float ndc=min(s*projectionMatrix[1][1]/max(-mv.z,0.001), uMaxNdc);
  cp.xy+=aCorner*vec2(ndc*projectionMatrix[0][0]/projectionMatrix[1][1], ndc)*cp.w;
  gl_Position=cp; }`;
const GLOW_FRAG = /* glsl */`
uniform vec3 uCore; uniform vec3 uHalo; uniform float uOpacity; varying vec2 vC; varying float vSeed;
void main(){ float d=length(vC); if(d>1.0) discard;
  float core=1.0-smoothstep(0.0,0.35,d), halo=pow(1.0-d,2.2);
  gl_FragColor=vec4(mix(uHalo,uCore,core)*(core*0.8+halo*0.35)*uOpacity,1.0); }`;

export function installSwampRimFlowers({swamp, enabled = flag('swampRimFlowers'), angles = [1.2, 1.8, 2.4, 3.3, 3.9, 4.5, 5.1, 5.7], seed = 8821, scale = 1.3, maxGlowNdc = .075} = {}) {
  const report = {enabled, version: 1, flowers: [], skipped: [], triangles: 0, drawCalls: 0};
  const inner = swamp?.userData?.inner || swamp;
  if (!enabled || !inner?.isObject3D) return {report, update() {}};
  (swamp.parent || swamp).updateWorldMatrix(true, true);
  const rimY = inner.userData.groundY ?? 40;
  const guard = createSwampLivingPathConstraints(inner);
  const groundAt = makeRimGround(inner, rimY);
  const rnd = rng(seed);
  const out = {pos: [], col: [], idx: []}, glow = {pos: [], corner: [], size: [], seed: [], idx: []};
  const C = {deep: new THREE.Color(0xc23a45), mid: new THREE.Color(0xf0623f), tip: new THREE.Color(0xff9a6a), edge: new THREE.Color(0xffc9a0),
    innerA: new THREE.Color(0xff7448), innerB: new THREE.Color(0xffc387), core: 0xfff2b8, stamen: 0xffd86a,
    leafA: new THREE.Color(0x2f7a62), leafB: new THREE.Color(0x58a07a), leafEdge: new THREE.Color(0x7dbb8a)};
  for (const a0 of angles) {
    if (Math.abs(angDiff(a0, ENTRANCE)) < .4 + .12) { report.skipped.push({angle: a0, reason: 'entrance'}); continue; }
    let pick = null;
    // 第 2 轮（组长）：花立在坑缘内沿、探向湖面；整体约放大 1.3 倍，挡路就缩小
    search: for (const sc of [scale, scale * .85, scale * .7, scale * .55]) for (const da of [0, .1, -.1, .2, -.2]) {
      const a = a0 + da; if (Math.abs(angDiff(a, ENTRANCE)) < .52) continue;
      const lip = findLip(groundAt, a);
      for (const dr of [.7, 1.5, 2.5, 3.6]) {
      const r = +(lip + dr * Math.min(1, sc)).toFixed(2);
      const x = Math.cos(a) * r, z = Math.sin(a) * r, y = groundAt(x, z) ?? rimY;
      const env = {position: [x, y, z], radius: 3.9 * sc, height: 3.4 * sc};
      const res = guard ? guard.inspectPlant(env) : {allowed: true, reasons: []};
      if (res.allowed) { pick = {a, r, x, y, z, sc, lip}; break search; }
      }
    }
    if (!pick) { report.skipped.push({angle: a0, reason: 'no-clear-spot'}); continue; }
    const s = pick.sc * (.9 + rnd() * .1), yaw = rnd() * Math.PI * 2;
    // 花面略朝湖心倾，坑缘下方/湖面上方的镜头能看到花心
    const inward = new THREE.Vector3(-Math.cos(pick.a), 0, -Math.sin(pick.a));
    const tilt = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0).cross(inward).normalize(), .34);
    const Mf = new THREE.Matrix4().compose(new THREE.Vector3(pick.x, pick.y, pick.z), tilt, new THREE.Vector3(s, s, s));
    const rot = n => new THREE.Matrix4().makeRotationY(n);
    for (let i = 0; i < 5; i++) // 垫叶：贴地的宽绿叶，花像从植被带里长出来
      petal(out, Mf.clone().multiply(rot(yaw + i * 1.257 + rnd() * .3)), {L: 3.9, W: 1.9, lift: .32, fall: .55, cup: .12, base: .3, col0: C.leafA, col1: C.leafB, colEdge: C.leafEdge});
    const Mh = Mf.clone().multiply(new THREE.Matrix4().makeTranslation(0, .55, 0));
    for (let i = 0; i < 8; i++) // 外层 8 瓣：上扬后向外翻
      petal(out, Mh.clone().multiply(rot(yaw + i * Math.PI / 4)), {L: 3.3, W: 1.65, lift: .95, fall: 1.25, cup: .16, base: .35, col0: C.deep, col1: C.tip, colEdge: C.edge});
    for (let i = 0; i < 6; i++) // 内层 6 瓣：更直立更亮
      petal(out, Mh.clone().multiply(rot(yaw + .26 + i * Math.PI / 3)), {L: 1.7, W: 1.05, lift: 1.25, fall: .9, cup: .1, base: .25, col0: C.innerA, col1: C.innerB, colEdge: C.edge});
    blob(out, Mh, .62, .55, C.core);
    for (let i = 0; i < 9; i++) { // 花蕊：细尖
      const Ms = Mh.clone().multiply(rot(i * .698 + yaw)).multiply(new THREE.Matrix4().makeTranslation(.32, .3, 0));
      petal(out, Ms, {L: .75, W: .14, lift: 1.25, fall: .4, cup: 0, base: 0, col0: new THREE.Color(C.stamen), col1: new THREE.Color(0xfff6d0), colEdge: new THREE.Color(0xffffff)});
    }
    const gc = new THREE.Vector3(0, 1.0, 0).applyMatrix4(Mh), gi = glow.pos.length / 3, gs = rnd();
    for (const [cx, cy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { glow.pos.push(gc.x, gc.y, gc.z); glow.corner.push(cx, cy); glow.size.push(1.15 * s); glow.seed.push(gs); }
    glow.idx.push(gi, gi + 1, gi + 2, gi + 2, gi + 1, gi + 3);
    report.flowers.push({angle: +pick.a.toFixed(3), radius: pick.r, lip: +pick.lip.toFixed(2), y: +pick.y.toFixed(2), scale: +s.toFixed(2), spread: +(3.9 * s).toFixed(2)});
  }
  if (!report.flowers.length) return {report, update() {}};
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(out.pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(out.col, 3));
  geo.setIndex(out.idx); geo.computeBoundingSphere();
  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({color: 0xffffff, vertexColors: true, side: THREE.DoubleSide, fog: false}));
  mesh.name = 'swamp-rim-giant-flowers'; mesh.raycast = () => {};
  inner.add(mesh);
  const gg = new THREE.BufferGeometry();
  gg.setAttribute('position', new THREE.Float32BufferAttribute(glow.pos, 3));
  gg.setAttribute('aCorner', new THREE.Float32BufferAttribute(glow.corner, 2));
  gg.setAttribute('aSize', new THREE.Float32BufferAttribute(glow.size, 1));
  gg.setAttribute('aSeed', new THREE.Float32BufferAttribute(glow.seed, 1));
  gg.setIndex(glow.idx); gg.computeBoundingSphere(); gg.boundingSphere.radius += 3;
  const uniforms = {uTime: {value: 0}, uMaxNdc: {value: maxGlowNdc}, uOpacity: {value: .42}, uCore: {value: new THREE.Color(0xfff6d6)}, uHalo: {value: new THREE.Color(0xffb35c)}};
  const glowMesh = new THREE.Mesh(gg, new THREE.ShaderMaterial({uniforms, vertexShader: GLOW_VERT, fragmentShader: GLOW_FRAG, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending}));
  glowMesh.name = 'swamp-rim-flower-glow'; glowMesh.renderOrder = 4; glowMesh.raycast = () => {};
  inner.add(glowMesh);
  report.triangles = out.idx.length / 3 + glow.idx.length / 3; report.drawCalls = 2;
  return {report, mesh, glowMesh, update(t) { uniforms.uTime.value = t; }};
}
