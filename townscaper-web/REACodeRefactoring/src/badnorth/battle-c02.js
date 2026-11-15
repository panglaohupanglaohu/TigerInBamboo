/**
 * 第 56 批 C02：Bad North 特效 B + 生命 / 导航 / 水 —— Battle 扩展（全部默认关）。
 * 打开：URL `?c02=bloodShape,scorch,...`（或 `?c02=all`），或运行时 `battle.c02.set(name, on)`。
 *
 *   bloodShape  912691357440978945 血泊不规则：分叉 / 带卫星滴的程序化血斑贴图 + 新血泊旁 2–3 片卫星斑往外渗开（错开起始、边长边外移）
 *   scorch      912691357440978945 失守小屋留焦痕：屋周一圈焦黑斑（不规则贴图）+ 余烬火星上飘
 *   dmgKick     903647529203634176 伤害飘字沿受击方向甩出 + 阻尼抖动；击杀 "+10" 独立上浮更快（damage-numbers.kickDamageNumber / stepDamageKick）
 *   flowGrid    902069261304287232 流场调试底下铺格网线框（每格轮廓，四边形加对角线；只画陆地格）
 *   flowFaces   901842167508992000 流场调试每格圆角格面按源着色（兵种 / 队伍）+ 色卡图例；不可走格不上色
 *   tumble      870296307889573889 落崖翻滚姿态（绕水平轴转）+ 落地扬尘 / 落水水花 + 摔下存活者从躺倒爬起
 *   wakes       901469409579061248 战斗长船用 core/wake-sampling.makeWakeParticles 的 Kelvin 舷侧泡沫 + 船头喷溅（靠岸减速自然停发）
 *   navmesh     816748103193817088 导航面调试：共享 World 分层图自动生成的导航面（navMeshFromLayeredGraph）黑线 + 红顶点
 *   rain        959530111187013632 雨景：斜落雨丝 + 岛上空深色雨云团 + 水面 / 地面溅点（配合 theme rain）
 *   swingArc    820977247083528192 挥砍白色弧形拖影（扫掠中按 a0→当前角铺扇带，直砍时补一条短弧）
 *   footprint   821321422140309504 小队地面白色外轮廓（成员凸包 + 中心辐条 + 角点小方块，squad-footprint.js）
 *   passageWorld 886199305522085890 窄道点线改世界尺寸（点径 = 点距 / 2，近景不再显疏），远景按 4px 下限
 * battle.js 只加挂钩：import / 构造 / start / stop / #hit 末尾 onHit / g3.afterDraw 之后 afterDraw。
 */
import * as THREE from 'three';
import { kickDamageNumber, stepDamageKick } from './damage-numbers.js';
import { makeWakeParticles } from '../core/wake-sampling.js';
import { navMeshFromLayeredGraph } from '../world/navmesh-flow.js';
import { footprint } from './squad-footprint.js';

export const C02_FLAGS = ['bloodShape', 'scorch', 'dmgKick', 'flowGrid', 'flowFaces', 'tumble', 'wakes', 'navmesh', 'rain', 'swingArc', 'footprint', 'passageWorld'];
// 与 battle.js #drawFlow 同一套色（图例 / 格面要和线一致）
const C_UNIT = [[0.15, 0.55, 1.0], [1.0, 0.45, 0.1], [0.15, 0.85, 0.35], [0.95, 0.3, 0.85], [0.95, 0.9, 0.2], [0.3, 0.9, 0.9]];
const C_TYPE = [[0.95, 0.35, 0.75], [0.72, 0.95, 0.2], [0.2, 0.85, 1.0]];
const TYPES = ['步兵', '矛兵', '弓手'];

/** 不规则血斑 / 焦痕的 alpha 图：主圆 + 外凸瓣 + 卫星滴，边缘按角度噪声起伏（seed 固定，可复现）。 */
export function splatAlpha(size = 64, { seed = 3, lobes = 7, satellites = 6, rough = 0.22 } = {}) {
  let s = seed >>> 0; const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const amp = Array.from({ length: lobes }, () => rnd() * rough), ph = Array.from({ length: lobes }, () => rnd() * 6.283);
  const sats = Array.from({ length: satellites }, () => { const a = rnd() * 6.283, r = 0.62 + rnd() * 0.3; return [Math.cos(a) * r, Math.sin(a) * r, 0.05 + rnd() * 0.09]; });
  const a = new Uint8Array(size * size);
  for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
    const x = (i + 0.5) / size * 2 - 1, y = (j + 0.5) / size * 2 - 1, r = Math.hypot(x, y), t = Math.atan2(y, x);
    let edge = 0.52; for (let k = 0; k < lobes; k++) edge += amp[k] * Math.sin(t * (k + 2) + ph[k]) * (k < 3 ? 1 : 0.5);
    let v = Math.min(1, Math.max(0, (edge - r) * 14));
    for (const [sx, sy, sr] of sats) v = Math.max(v, Math.min(1, Math.max(0, (sr - Math.hypot(x - sx, y - sy)) * 40)));
    a[j * size + i] = (v * 255) | 0;
  }
  return a;
}
function alphaTexture(alpha, size) {
  const d = new Uint8Array(size * size * 4);
  for (let i = 0; i < size * size; i++) { d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = 255; d[i * 4 + 3] = alpha[i]; }
  const t = new THREE.DataTexture(d, size, size, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.LinearFilter; t.needsUpdate = true; return t;
}

/** 落崖翻滚：绕水平轴（垂直于下落水平方向）转 angle，枢轴在身体中段。返回实例矩阵。 */
export function tumbleMatrix(u, angle, out = new THREE.Matrix4()) {
  const bs = u.bodyScale ?? 1, vx = u.fall?.vx ?? u._tumbleDir?.[0] ?? 1, vz = u.fall?.vz ?? u._tumbleDir?.[1] ?? 0, l = Math.hypot(vx, vz) || 1;
  const axis = new THREE.Vector3(vz / l, 0, -vx / l), pivot = 0.07 * bs;
  const base = new THREE.Matrix4().compose(new THREE.Vector3(), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, u.face ?? 0, 0)), new THREE.Vector3().setScalar(bs));
  const rot = new THREE.Matrix4().makeRotationAxis(axis, angle);
  out.makeTranslation(u.x, u.y + pivot, u.z).multiply(rot).multiply(new THREE.Matrix4().makeTranslation(0, -pivot, 0)).multiply(base);
  return out;
}

export class BattleC02 {
  constructor(battle) {
    this.b = battle; this.on = Object.fromEntries(C02_FLAGS.map((k) => [k, false]));
    const q = new URLSearchParams(globalThis.location?.search ?? '');
    const list = (q.get('c02') || '').split(',').filter(Boolean);
    for (const k of C02_FLAGS) if (list.includes('all') || list.includes(k)) this.on[k] = true;
    this.group = new THREE.Group(); battle.group.add(this.group);
    this.stats = { satellites: 0, scorched: 0, embers: 0, kicks: 0, killFast: 0, gridSegs: 0, faces: 0, tumbling: 0, maxTumbleDeg: 0, dust: 0, splashes: 0, gettingUp: 0, foam: 0, spray: 0, navEdges: 0, navVerts: 0, rainDrops: 0, splats: 0, clouds: 0, arcs: 0, footprints: 0, passagePx: 0 };
    // 血 / 焦痕贴图
    this.splatTex = alphaTexture(splatAlpha(64, { seed: 3 }), 64);
    this.scorchTex = alphaTexture(splatAlpha(64, { seed: 11, lobes: 9, satellites: 9, rough: 0.3 }), 64);
    this.satellites = [];
    // 焦痕
    const disc = new THREE.CircleGeometry(1, 16); disc.rotateX(-Math.PI / 2);
    this.scorch = new THREE.InstancedMesh(disc, new THREE.MeshBasicMaterial({ color: '#2a1d1c', map: this.scorchTex, transparent: true, opacity: 0.82, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 160);
    this.scorch.count = 0; this.scorch.frustumCulled = false; this.scorch.renderOrder = 5; this.group.add(this.scorch);
    this.embers = this.#points('#ffb347', 0.03, 400, true); this.emberList = [];
    // 扬尘 / 水花
    this.dust = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshBasicMaterial({ color: '#e6dccb', transparent: true, opacity: 0.6, depthWrite: false }), 240);
    this.dust.count = 0; this.dust.frustumCulled = false; this.dust.renderOrder = 6; this.group.add(this.dust); this.puffs = [];
    this.falling = new Set();
    // 流场底网 / 格面
    this.gridLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#9aa3ad', transparent: true, opacity: 0.55, depthTest: false }));
    this.gridLines.renderOrder = 27; this.gridLines.frustumCulled = false; this.gridLines.visible = false; this.group.add(this.gridLines);
    this.faces = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }));
    this.faces.renderOrder = 28; this.faces.frustumCulled = false; this.faces.visible = false; this.group.add(this.faces);
    this.legend = null; this._flowSeen = null;
    // 船迹
    this.wake = makeWakeParticles({ rate: 120, sprayRate: 9, life: 3.0, seed: 17 });
    this.foamPts = this.#sizedPoints(false); this.sprayPts = this.#sizedPoints(true);
    // 导航面
    this.navLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#141414', transparent: true, opacity: 0.8 }));
    this.navLines.frustumCulled = false; this.navLines.visible = false; this.navLines.renderOrder = 26; this.group.add(this.navLines);
    this.navDots = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#e0283c', size: 4, sizeAttenuation: false }));
    this.navDots.frustumCulled = false; this.navDots.visible = false; this.navDots.renderOrder = 26; this.group.add(this.navDots);
    this._navMesh = null;
    // 雨
    this.rainN = 1600; this.rainData = null;
    this.rainLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#eef0f2', transparent: true, opacity: 0.55, depthWrite: false }));
    this.rainLines.frustumCulled = false; this.rainLines.visible = false; this.rainLines.renderOrder = 9; this.group.add(this.rainLines);
    this.rainSplash = this.#points('#ffffff', 0.025, 300, false); this.splashList = [];
    this.clouds = new THREE.Group(); this.clouds.visible = false; this.group.add(this.clouds);
    // 挥砍弧
    this.arcMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ color: '#ffffff', vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
    this.arcMesh.frustumCulled = false; this.arcMesh.renderOrder = 8; this.group.add(this.arcMesh); this.transientArcs = [];
    // 小队轮廓
    this.fpLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: '#f4f8fa', transparent: true, opacity: 0.9, depthTest: false }));
    this.fpLines.frustumCulled = false; this.fpLines.renderOrder = 29; this.fpLines.visible = false; this.group.add(this.fpLines);
    this._passageSaved = null;
  }
  #points(color, size, max, additive) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(max * 3), 3)); g.setDrawRange(0, 0);
    const p = new THREE.Points(g, new THREE.PointsMaterial({ color, size, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, toneMapped: false }));
    p.frustumCulled = false; p.renderOrder = 9; p.userData.max = max; this.group.add(p); return p;
  }
  #sizedPoints(square) {
    const MAX = 1600, g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX * 3), 3));
    g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(MAX), 1));
    g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(MAX), 1));
    g.setDrawRange(0, 0);
    const m = new THREE.Points(g, new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      vertexShader: 'attribute float aA; attribute float aS; varying float vA; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = aS * 420.0 / max(.001, -mv.z); gl_Position = projectionMatrix * mv; }',
      fragmentShader: `varying float vA; void main(){ ${square ? '' : 'if (length(gl_PointCoord - .5) > .5) discard;'} gl_FragColor = vec4(1.0, 1.0, 1.0, vA); }`,
    }));
    m.frustumCulled = false; m.renderOrder = 6; m.userData.max = MAX; this.group.add(m); return m;
  }

  set(name, value) {
    if (!C02_FLAGS.includes(name)) throw new RangeError('unknown C02 flag ' + name);
    this.on[name] = !!value; this.#apply(); return this.on[name];
  }
  start() {
    this.satellites = []; this.scorch.count = 0; this.emberList = []; this.puffs = []; this.dust.count = 0; this.falling.clear();
    this.wake.foam.length = this.wake.spray.length = 0; this._navMesh = null; this._flowSeen = null; this.transientArcs = []; this.splashList = [];
    for (const k of Object.keys(this.stats)) this.stats[k] = 0;
    this.#apply();
  }
  stop() {
    this.scorch.count = 0; this.dust.count = 0; this.legend?.remove(); this.legend = null;
    for (const o of [this.gridLines, this.faces, this.navLines, this.navDots, this.rainLines, this.fpLines, this.clouds]) o.visible = false;
    for (const p of [this.embers, this.rainSplash, this.foamPts, this.sprayPts]) p.geometry.setDrawRange(0, 0);
    this.arcMesh.visible = false;
    this.#restoreBlood(); this.#restorePassage();
  }
  #apply() {
    const b = this.b;
    if (this.on.bloodShape) { const m = b.blood.material; if (m.map !== this.splatTex) { m.map = this.splatTex; m.alphaTest = 0.2; m.needsUpdate = true; } }
    else this.#restoreBlood();
    if (!this.on.flowGrid) this.gridLines.visible = false;
    if (!this.on.flowFaces) { this.faces.visible = false; this.legend?.remove(); this.legend = null; }
    this._flowSeen = null;
    if (!this.on.navmesh) { this.navLines.visible = this.navDots.visible = false; }
    this.rainLines.visible = this.clouds.visible = this.on.rain && b.running;
    if (!this.on.rain) this.rainSplash.geometry.setDrawRange(0, 0);
    if (!this.on.footprint) this.fpLines.visible = false;
    if (this.on.passageWorld) this.#worldPassage(); else this.#restorePassage();
    if (!this.on.wakes) { this.foamPts.geometry.setDrawRange(0, 0); this.sprayPts.geometry.setDrawRange(0, 0); }
  }
  #restoreBlood() { const m = this.b.blood.material; if (m.map === this.splatTex) { m.map = null; m.alphaTest = 0; m.needsUpdate = true; } }

  /* ------------------------------------------------------------ #hit 末尾 */
  onHit(v, by) {
    const b = this.b;
    if (this.on.dmgKick) {
      for (const p of b.damageNumbers) {
        if (p.age > 1e-9 || p.kx !== undefined) continue;
        const near = p.kind === 'kill' ? Math.hypot(p.x - v.x, p.z - v.z) < 0.6 : p.unitId === (v.uid ?? -1);
        if (!near) continue;
        if (p.kind === 'kill') this.stats.killFast++;
        if (by) { kickDamageNumber(p, v.x - by.x, v.z - by.z, { speed: p.kind === 'kill' ? 0.5 : 0.9 }); this.stats.kicks++; }
      }
    }
    if (this.on.swingArc && by && !by.sweep && !by.thrust && !by.squad?.archer && !by.squad?.pike) {
      // 820977247083528192 原片：直砍是**竖直面**里的一道月牙——从头后上方劈到身前下方（0000 / 0023 / 0024 帧），不是水平扇
      const dir = Math.atan2(v.x - by.x, v.z - by.z);
      this.transientArcs.push({ u: by, dir, a0: -0.35 * Math.PI, a1: 0.62 * Math.PI, reach: 0.2 * (by.bodyScale ?? 1), age: 0, life: 0.26, vertical: true });
    }
  }

  /* ------------------------------------------------------------ 每帧（g3.afterDraw 之后，LOD 之前） */
  afterDraw(dt) {
    const b = this.b; if (!b.running) return;
    if (this.on.bloodShape) this.#satellites(dt);
    if (this.on.scorch) this.#scorch(dt);
    if (this.on.dmgKick) this.#kick(dt);
    if (this.on.flowGrid || this.on.flowFaces) this.#flowOverlay();
    if (this.on.tumble) this.#tumble(dt);
    this.#puffs(dt);
    if (this.on.wakes) this.#wakes(dt);
    if (this.on.navmesh) this.#navmesh();
    if (this.on.rain) this.#rain(dt);
    this.#arcs(dt);
    if (this.on.footprint) this.#footprints();
    if (this.on.passageWorld) this.#passagePx();
  }

  /* -------------------------------------------- 912691：血泊不规则渗开 */
  #satellites(dt) {
    const b = this.b, m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (const g of b.poolGrow) {
      if (g._c02 || g.t > 0.05) continue;
      g._c02 = true;
      const n = 2 + (Math.random() < 0.5 ? 1 : 0);
      for (let k = 0; k < n && b.blood.count < 440; k++) {   // 给主血斑留够额度（总池 600）
        const a = Math.random() * 6.283, size = g.sx * (0.35 + Math.random() * 0.3);
        this.satellites.push({ i: b.blood.count++, x: g.x, y: g.y + 0.0005 * (k + 1), z: g.z, dx: Math.cos(a), dz: Math.sin(a), reach: g.sx * (0.7 + Math.random() * 0.5), size, rot: Math.random() * 6, t: 0, delay: 0.15 + k * 0.35 + Math.random() * 0.3, life: 2.2 + Math.random() });
        b.blood.setMatrixAt(b.blood.count - 1, m.makeScale(0, 0, 0));
        this.stats.satellites++;
      }
    }
    let dirty = false;
    for (const st of this.satellites) {
      if (st.done) continue;
      st.t += dt; const k = Math.max(0, Math.min(1, (st.t - st.delay) / st.life)), e = 1 - (1 - k) * (1 - k);
      // 边长边往外挪：前沿是一瓣一瓣鼓出去的，不是整圈等比放大
      const off = st.reach * (0.35 + 0.65 * e);
      m.compose(p.set(st.x + st.dx * off, st.y, st.z + st.dz * off), q.setFromAxisAngle(up, st.rot), s.set(st.size * Math.max(1e-4, e), 1, st.size * 0.8 * Math.max(1e-4, e)));
      b.blood.setMatrixAt(st.i, m); dirty = true;
      if (k >= 1) st.done = true;
    }
    if (dirty) b.blood.instanceMatrix.needsUpdate = true;
    this.satellites = this.satellites.filter((st) => !st.done || st.t < 1e9).slice(-300);
  }

  /* -------------------------------------------- 912691：焦痕 + 余烬 */
  #scorch(dt) {
    const b = this.b, w = b.world, L = b.L, m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (const h of b.houses) {
      if (!h.lost || h._scorch) continue;
      h._scorch = true; this.stats.scorched++;
      const c = h.cell, ring = [c, ...c.edgeNeighbors.filter((id) => id >= 0).map((id) => w.cells[id])];
      for (const o of ring) {
        if (this.scorch.count >= 160) break;
        const top = w.top(o); if (top <= 0) continue;
        const isHouse = o === c, y = (isHouse ? w.ground(c) : top) * L + 0.009;
        const mx = isHouse ? c.cx : (o.cx * 0.6 + c.cx * 0.4), mz = isHouse ? c.cz : (o.cz * 0.6 + c.cz * 0.4);
        if (!isHouse && top !== w.ground(c)) continue;   // 焦痕只铺在与屋基同高的地面
        const r = isHouse ? 0.62 : 0.32 + Math.random() * 0.12;
        m.compose(p.set(mx, y, mz), q.setFromAxisAngle(up, Math.random() * 6), s.set(r, 1, r * (0.8 + Math.random() * 0.3)));
        this.scorch.setMatrixAt(this.scorch.count++, m);
      }
      this.scorch.instanceMatrix.needsUpdate = true;
      // 屋顶也熏黑一点（顶层格的世界色不改，只记下来给余烬当源）
      h._emberY = (w.top(c) + 0.2) * L;
    }
    // 余烬：已失守的小屋持续往上冒火星，随风偏、闪烁、熄灭
    for (const h of b.houses) if (h._scorch && Math.random() < dt * 22) {
      const c = h.cell; this.emberList.push({ x: c.cx + (Math.random() - 0.5) * 0.4, y: h._emberY, z: c.cz + (Math.random() - 0.5) * 0.4, vx: (Math.random() - 0.3) * 0.12, vy: 0.25 + Math.random() * 0.3, vz: (Math.random() - 0.5) * 0.12, age: 0, life: 1 + Math.random() * 1.4 });
    }
    const P = this.embers.geometry.attributes.position; let n = 0;
    for (const e of this.emberList) { e.age += dt; e.x += e.vx * dt; e.y += e.vy * dt; e.z += e.vz * dt; e.vx += Math.sin(e.age * 6 + e.z) * 0.05 * dt; }
    this.emberList = this.emberList.filter((e) => e.age < e.life).slice(-this.embers.userData.max);
    for (const e of this.emberList) P.setXYZ(n++, e.x, e.y, e.z);
    P.needsUpdate = true; this.embers.geometry.setDrawRange(0, n); this.embers.material.opacity = 0.7 + 0.3 * Math.sin(b.t * 17);
    this.stats.embers = n;
  }

  /* -------------------------------------------- 903647：受击方向甩出 + 击杀上浮更快 */
  #kick(dt) {
    const b = this.b; stepDamageKick(b.damageNumbers, dt);
    // 本帧精灵已由 battle 摆好（快照 = list 倒序）；把抖动叠到同一个精灵上，避免慢一帧
    let j = 0;
    for (let i = b.damageNumbers.length - 1; i >= 0; i--) {
      const p = b.damageNumbers[i], sp = b.damageSprites[j++];
      if (!sp?.visible) continue;
      sp.position.set(p.x + (p.sx || 0) + (p.jx || 0), p.y, p.z + (p.jz || 0));
    }
  }

  /* -------------------------------------------- 902069 / 901842：底网 + 格面 + 图例 */
  #flowOverlay() {
    const b = this.b, on = !!b.view.flowDebug;
    this.gridLines.visible = on && this.on.flowGrid; this.faces.visible = on && this.on.flowFaces;
    if (this.legend) this.legend.style.display = on && this.on.flowFaces ? 'block' : 'none';
    if (!on || !b.flowDef || b.flowDef === this._flowSeen) return;
    this._flowSeen = b.flowDef;
    const w = b.world, L = b.L, F = b.flowDef;
    if (this.on.flowGrid && this._gridVersion !== w.version) {
      this._gridVersion = w.version;
      const pos = [];
      for (const c of w.cells) {
        const top = w.top(c); if (top <= 0) continue;
        const y = top * L + 0.022, P = c.pts;
        for (let i = 0; i < P.length; i++) { const a = P[i], q = P[(i + 1) % P.length]; pos.push(a.x, y, a.z, q.x, y, q.z); }
        if (P.length === 4) pos.push(P[0].x, y, P[0].z, P[2].x, y, P[2].z);   // 片中四边形格的对角线
      }
      this.gridLines.geometry.dispose(); this.gridLines.geometry = new THREE.BufferGeometry();
      this.gridLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      this.stats.gridSegs = pos.length / 6;
    }
    if (this.on.flowFaces) {
      const byType = (b.view.flowColorBy || 'unit') === 'type', squadIds = [...new Set(F.sources.map((s) => s.squad))];
      const color = (k) => byType ? C_TYPE[Math.max(0, TYPES.indexOf(F.sources[k]?.type))] : C_UNIT[Math.max(0, squadIds.indexOf(F.sources[k]?.squad)) % C_UNIT.length];
      const pos = [], col = []; let faces = 0;
      for (let id = 0; id < F.nodes.length; id++) {
        if (F.src[id] < 0 || !Number.isFinite(F.dist[id])) continue;   // 不可走 / 没被任何源覆盖的格不上色
        const n = F.nodes[id], c = n.cell; if (!c) continue;
        const k = color(F.src[id]), y = n.floor * L + 0.03, P = c.pts, cx = c.cx, cz = c.cz;
        // 圆角格面：向格心收 14%，每个角再切一刀（两个点），近似圆角
        const ring = [];
        for (let i = 0; i < P.length; i++) {
          const a = P[i], pa = P[(i + P.length - 1) % P.length], na = P[(i + 1) % P.length];
          const sx = cx + (a.x - cx) * 0.86, sz = cz + (a.z - cz) * 0.86;
          const t = 0.18;
          ring.push([sx + ((cx + (pa.x - cx) * 0.86) - sx) * t, sz + ((cz + (pa.z - cz) * 0.86) - sz) * t], [sx + ((cx + (na.x - cx) * 0.86) - sx) * t, sz + ((cz + (na.z - cz) * 0.86) - sz) * t]);
        }
        const fade = Math.max(0.55, 1 - F.dist[id] / 14);
        for (let i = 0; i < ring.length; i++) { const a = ring[i], q = ring[(i + 1) % ring.length]; pos.push(cx, y, cz, a[0], y, a[1], q[0], y, q[1]); for (let r = 0; r < 3; r++) col.push(k[0] * fade, k[1] * fade, k[2] * fade); }
        faces++;
      }
      this.faces.geometry.dispose(); this.faces.geometry = new THREE.BufferGeometry();
      this.faces.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      this.faces.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      this.stats.faces = faces;
      this.#legend(byType, squadIds, F);
    }
  }
  #legend(byType, squadIds, F) {
    if (typeof document === 'undefined' || !document.body) return;
    if (!this.legend) {
      this.legend = document.createElement('div');
      this.legend.style.cssText = 'position:fixed;right:16px;bottom:16px;z-index:6;background:rgba(20,24,30,.82);color:#eef;border-radius:8px;padding:8px 12px;font:12px/1.6 -apple-system,system-ui,"PingFang SC",sans-serif;pointer-events:none';
      document.body.appendChild(this.legend);
    }
    const hex = (k) => '#' + k.map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('');
    const rows = byType ? TYPES.map((t, i) => [hex(C_TYPE[i]), t + (F.sources.some((s) => s.type === t) ? '' : '（本场无）')])
      : squadIds.map((sq, i) => [hex(C_UNIT[i % C_UNIT.length]), '第 ' + (sq + 1) + ' 队']);
    this.legend.innerHTML = '<b>' + (byType ? '影响场 · 最近单位兵种' : '影响场 · 继承自哪支队伍') + '</b>' + rows.map(([c, t]) => `<div><span style="display:inline-block;width:12px;height:12px;border-radius:3px;margin-right:6px;vertical-align:-2px;background:${c}"></span>${t}</div>`).join('');
    this.legendRows = rows.length;
  }

  /* -------------------------------------------- 870296：翻滚 + 扬尘 + 爬起 */
  #instanceIndex() { const out = new Map(); let n = 0; for (const u of this.b.units) { if (n >= 260) break; if (u.dead && this.b.view.goreOff) continue; out.set(u, n++); } return out; }
  #tumble(dt) {
    const b = this.b, idx = this.#instanceIndex(), m = new THREE.Matrix4(); let tumbling = 0, up = 0; const now = new Set();
    for (const u of b.units) {
      if (u.fall) {
        now.add(u); tumbling++;
        u._tumble = (u._tumble || 0) + dt * (6 + 10 * Math.min(1, Math.abs(u.fall.vy)));
        u._tumbleDir = [u.fall.vx, u.fall.vz];
        this.stats.maxTumbleDeg = Math.max(this.stats.maxTumbleDeg, u._tumble * 180 / Math.PI);
        const i = idx.get(u); if (i !== undefined && !b.spriteBatch.enabled) { tumbleMatrix(u, u._tumble, m); for (const mesh of [b.mBody, b.mHead, b.mShield]) mesh.setMatrixAt(i, m); }
      } else if (this.falling.has(u)) {
        // 刚落地：扬尘（落水 = 白水花），活着的从躺倒慢慢爬起来
        this.#puff(u.x, u.drowned ? 0.02 : u.y, u.z, u.drowned ? 'splash' : 'dust');
        if (!u.dead) { u._getUp = 0.7; }
        u._tumble = 0;
      }
      if (!u.fall && u._getUp > 0 && !u.dead) {
        up++; u._getUp = Math.max(0, u._getUp - dt);
        const k = u._getUp / 0.7, i = idx.get(u);   // 1 = 躺平，0 = 站直
        if (i !== undefined && !b.spriteBatch.enabled) { tumbleMatrix(u, (Math.PI / 2) * k * k, m); for (const mesh of [b.mBody, b.mHead, b.mShield]) mesh.setMatrixAt(i, m); }
      }
    }
    this.falling = now;
    if (tumbling || up) for (const mesh of [b.mBody, b.mHead, b.mShield]) mesh.instanceMatrix.needsUpdate = true;
    this.stats.tumbling = tumbling; this.stats.gettingUp = up;
  }
  #puff(x, y, z, kind) {
    const n = kind === 'splash' ? 7 : 9;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * 6.283 + Math.random() * 0.5, sp = 0.25 + Math.random() * 0.25;
      this.puffs.push({ x, y: y + 0.02, z, vx: Math.cos(a) * sp, vy: kind === 'splash' ? 0.6 + Math.random() * 0.4 : 0.08 + Math.random() * 0.1, vz: Math.sin(a) * sp, age: 0, life: kind === 'splash' ? 0.5 : 0.8 + Math.random() * 0.4, r0: 0.025, r1: kind === 'splash' ? 0.03 : 0.085, kind });
    }
    if (kind === 'splash') this.stats.splashes++; else this.stats.dust++;
  }
  #puffs(dt) {
    if (!this.puffs.length) { if (this.dust.count) { this.dust.count = 0; } return; }
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(); let n = 0, op = 0;
    for (const d of this.puffs) {
      d.age += dt; d.x += d.vx * dt; d.z += d.vz * dt; d.y += d.vy * dt; d.vx *= Math.exp(-4 * dt); d.vz *= Math.exp(-4 * dt);
      if (d.kind === 'splash') d.vy -= 3 * dt;
    }
    this.puffs = this.puffs.filter((d) => d.age < d.life).slice(-240);
    for (const d of this.puffs) {
      const k = d.age / d.life, r = d.r0 + (d.r1 - d.r0) * Math.sqrt(k);
      m.compose(p.set(d.x, d.y, d.z), q, s.setScalar(r * (1 - 0.3 * k))); this.dust.setMatrixAt(n++, m); op += 1 - k;
    }
    this.dust.count = n; this.dust.instanceMatrix.needsUpdate = true;
    this.dust.material.opacity = Math.min(0.7, 0.25 + 0.5 * op / Math.max(1, n));
  }

  /* -------------------------------------------- 901469：战斗长船 Kelvin 泡沫 + 船头喷溅 */
  #wakes(dt) {
    const b = this.b, ships = [];
    for (const bt of b.boats) {
      const wm = bt.mesh.userData.wake; if (wm) wm.visible = false;   // 旧的白点尾迹让位
      const x = bt.mesh.position.x, z = bt.mesh.position.z, prev = bt._c02prev; bt._c02prev = [x, z];
      if (!prev || dt <= 0) continue;
      const vx = (x - prev[0]) / dt, vz = (z - prev[1]) / dt, sp = Math.hypot(vx, vz);
      if (sp < 0.02) continue;
      ships.push({ id: b.boats.indexOf(bt) + 100 * (b.wave || 0), x, z, dx: vx / sp, dz: vz / sp, speed: Math.min(sp, 3), len: 1.28, beam: 0.2 });
    }
    if (dt > 0) this.wake.step(Math.min(dt, 0.1), ships);
    const put = (pts, list, alpha, size, y) => {
      const g = pts.geometry, P = g.attributes.position.array, A = g.attributes.aA.array, S = g.attributes.aS.array, n = Math.min(pts.userData.max, list.length);
      for (let i = 0; i < n; i++) { const p = list[list.length - n + i]; P[i * 3] = p.x; P[i * 3 + 1] = y; P[i * 3 + 2] = p.z; A[i] = alpha(p); S[i] = size(p); }
      g.setDrawRange(0, n); for (const a of ['position', 'aA', 'aS']) g.attributes[a].needsUpdate = true;
      return n;
    };
    this.stats.foam = put(this.foamPts, this.wake.foam, (p) => Math.min(1, this.wake.alphaOf(p) * 1.4), (p) => p.size * 1.1, 0.032)   // 战斗镜头比环境船近 / 水色更亮：泡沫放大加亮才看得出白线;
    this.stats.spray = put(this.sprayPts, this.wake.spray, (p) => Math.pow(1 - p.age / p.life, 1.2) * 0.9, (p) => p.w * 0.8, 0.07);
  }

  /* -------------------------------------------- 816748：导航面调试 */
  #navmesh() {
    const b = this.b, nav = b.navigation; if (!nav?.graph) return;
    const mesh = nav.flowMesh || (nav.flowMesh = navMeshFromLayeredGraph(nav.graph, { levelHeight: b.L }));
    this.navLines.visible = this.navDots.visible = true;
    if (mesh === this._navMesh) return;
    this._navMesh = mesh;
    const pos = [], seen = new Set(), V = mesh.verts;
    for (const p of mesh.polys) for (let i = 0; i < p.vs.length; i++) {
      const a = p.vs[i], c = p.vs[(i + 1) % p.vs.length], key = a < c ? a + '_' + c : c + '_' + a;
      if (seen.has(key)) continue; seen.add(key);
      pos.push(V[a].x, V[a].y + 0.025, V[a].z, V[c].x, V[c].y + 0.025, V[c].z);
    }
    // 片中导航面是三角网：每个多边形按格心扇形三角化后再画内部边（细一档由同色线表达）
    for (const p of mesh.polys) if (p.vs.length > 3) { const y = V[p.vs[0]].y + 0.025; for (let i = 1; i < p.vs.length - 1; i++) { const v = V[p.vs[i + 1]]; if (i < p.vs.length - 2 || p.vs.length === 4) pos.push(V[p.vs[0]].x, y, V[p.vs[0]].z, v.x, y, v.z); if (p.vs.length === 4) break; } }
    const dots = []; for (const v of V) dots.push(v.x, v.y + 0.03, v.z);
    this.navLines.geometry.dispose(); this.navLines.geometry = new THREE.BufferGeometry(); this.navLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.navDots.geometry.dispose(); this.navDots.geometry = new THREE.BufferGeometry(); this.navDots.geometry.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3));
    this.stats.navEdges = pos.length / 6; this.stats.navVerts = V.length; this.stats.navPolys = mesh.polys.length; this.stats.navLinks = mesh.links?.length ?? 0;
  }

  /* -------------------------------------------- 959530：雨丝 + 雨云 + 溅点 */
  #rain(dt) {
    const b = this.b, w = b.world;
    this.rainLines.visible = this.clouds.visible = true;
    if (!this.rainData) {
      let cx = 0, cz = 0, n = 0; for (const c of w.cells) if (w.top(c) > 0) { cx += c.cx; cz += c.cz; n++; }
      this.rainCenter = n ? [cx / n, cz / n] : [0, 0];
      const R = 9, N = this.rainN, d = new Float32Array(N * 4);
      for (let i = 0; i < N; i++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * R; d[i * 4] = this.rainCenter[0] + Math.cos(a) * r; d[i * 4 + 1] = Math.random() * 6; d[i * 4 + 2] = this.rainCenter[1] + Math.sin(a) * r; d[i * 4 + 3] = 5 + Math.random() * 2; }
      this.rainData = d;
      this.rainLines.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 6), 3));
      // 雨云：岛上空几团深灰扁平积云（片中 0109 起一团黑云压在岛顶）
      const mat = new THREE.MeshStandardMaterial({ color: '#4a4a52', roughness: 1, flatShading: true });
      let s = 9; const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      for (let k = 0; k < 4; k++) {
        const g = new THREE.Group(), ax = this.rainCenter[0] + (rnd() - 0.5) * 6, az = this.rainCenter[1] + (rnd() - 0.5) * 6;
        for (let j = 0; j < 6; j++) { const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45 + rnd() * 0.4, 1), mat); m.position.set((rnd() - 0.5) * 1.6, (rnd() - 0.3) * 0.3, (rnd() - 0.5) * 1.0); m.scale.y = 0.7; g.add(m); }
        g.position.set(ax, 4.6 + rnd() * 0.8, az); g.userData.v = 0.08 + rnd() * 0.06; this.clouds.add(g);
      }
      this.stats.clouds = this.clouds.children.length;
    }
    const d = this.rainData, N = this.rainN, P = this.rainLines.geometry.attributes.position.array, wind = [0.9, 0.35];
    for (let i = 0; i < N; i++) {
      let x = d[i * 4], y = d[i * 4 + 1], z = d[i * 4 + 2]; const v = d[i * 4 + 3];
      y -= v * dt; x += wind[0] * dt; z += wind[1] * dt;
      const c = b.view.index.cellAt(x, z), gy = c ? w.top(c) * b.L : 0;
      if (y <= gy) {
        if (this.splashList.length < 300 && Math.random() < 0.25) this.splashList.push({ x, y: gy + 0.01, z, age: 0 });
        const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 9;
        x = this.rainCenter[0] + Math.cos(a) * r - wind[0] * 0.6; z = this.rainCenter[1] + Math.sin(a) * r - wind[1] * 0.6; y = 5.5 + Math.random() * 0.8;
      }
      d[i * 4] = x; d[i * 4 + 1] = y; d[i * 4 + 2] = z;
      const len = 0.16;   // 斜丝：沿下落速度方向拉长
      P[i * 6] = x; P[i * 6 + 1] = y; P[i * 6 + 2] = z; P[i * 6 + 3] = x - wind[0] / v * len; P[i * 6 + 4] = y + len; P[i * 6 + 5] = z - wind[1] / v * len;
    }
    this.rainLines.geometry.attributes.position.needsUpdate = true;
    for (const sp of this.splashList) sp.age += dt;
    this.splashList = this.splashList.filter((sp) => sp.age < 0.18);
    const SP = this.rainSplash.geometry.attributes.position; let n = 0; for (const sp of this.splashList) SP.setXYZ(n++, sp.x, sp.y, sp.z);
    SP.needsUpdate = true; this.rainSplash.geometry.setDrawRange(0, n);
    for (const g of this.clouds.children) { g.position.x += g.userData.v * dt; if (g.position.x > this.rainCenter[0] + 6) g.position.x -= 12; }
    this.stats.rainDrops = N; this.stats.splats = n;
  }

  /* -------------------------------------------- 820977：挥砍弧形拖影 */
  #arcs(dt) {
    const b = this.b, pos = [], col = [], SEG = 10;
    const fan = (u, a0, a1, reach, alpha, vdir = null) => {
      const bs = u.bodyScale ?? 1, y = u.y + (vdir == null ? 0.1 : 0.12) * bs, r0 = (vdir == null ? 0.05 : 0.09) * bs;
      for (let i = 0; i < SEG; i++) {
        const t0 = i / SEG, t1 = (i + 1) / SEG, A = a0 + (a1 - a0) * t0, B = a0 + (a1 - a0) * t1;
        // 拖影：越接近当前刀位越实（t→1），尾巴透明
        const al0 = alpha * t0 * t0, al1 = alpha * t1 * t1;
        // 水平扇（G3 扫掠）或竖直月牙（直砍：θ=0 在头顶正上方，正值往身前劈下）
        const p = vdir == null ? (a, r) => [u.x + Math.sin(a) * r, y + (r - r0) * 0.25, u.z + Math.cos(a) * r]
          : (a, r) => [u.x + Math.sin(vdir) * Math.sin(a) * r, y + Math.cos(a) * r, u.z + Math.cos(vdir) * Math.sin(a) * r];
        const A0 = p(A, r0), A1 = p(A, reach), B0 = p(B, r0), B1 = p(B, reach);
        pos.push(...A0, ...A1, ...B1, ...A0, ...B1, ...B0);
        col.push(al0 * 0.4, al0 * 0.4, al0 * 0.4, al0, al0, al0, al1, al1, al1, al0 * 0.4, al0 * 0.4, al0 * 0.4, al1, al1, al1, al1 * 0.4, al1 * 0.4, al1 * 0.4);
      }
    };
    let arcs = 0;
    if (this.on.swingArc) {
      for (const u of b.units) if (u.sweep && !u.dead) { fan(u, u.sweep.a0, u.sweep.angle, u.sweep.reach, 0.85); arcs++; }
      for (const a of this.transientArcs) { a.age += dt; const k = Math.min(1, a.age / (a.life * 0.6)); if (!a.u.dead) { fan(a.u, a.a0, a.a0 + (a.a1 - a.a0) * k, a.reach, 0.95 * (1 - Math.max(0, a.age - a.life * 0.6) / (a.life * 0.4)), a.vertical ? a.dir : null); arcs++; } }
      this.transientArcs = this.transientArcs.filter((a) => a.age < a.life);
    }
    // 颜色当 alpha 用：加色混合下黑 = 透明
    this.arcMesh.material.blending = THREE.AdditiveBlending;
    this.arcMesh.visible = pos.length > 0;
    if (pos.length || this._arcHad) {
      this.arcMesh.geometry.dispose(); this.arcMesh.geometry = new THREE.BufferGeometry();
      this.arcMesh.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      this.arcMesh.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    }
    this._arcHad = pos.length > 0; this.stats.arcs = Math.max(this.stats.arcs, arcs); this.stats.arcsNow = arcs;
  }

  /* -------------------------------------------- 821321：小队地面轮廓 */
  #footprints() {
    const b = this.b, pos = []; let n = 0;
    for (const sq of b.squads) {
      if (!sq.alive) continue;
      const men = sq.members.filter((u) => !u.dead && !u.onBoat); if (men.length < 3) continue;
      // 每人四周放 4 个点（身体半径外扩），凸包才包住人而不是穿过人心
      const pts = []; for (const u of men) for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + 0.4; pts.push([u.x + Math.cos(a) * 0.09, u.z + Math.sin(a) * 0.09]); }
      const fp = footprint(pts, { tick: 0.025 }); if (fp.degenerate) continue;
      const y = men.reduce((s, u) => s + u.y, 0) / men.length + 0.03;
      for (let i = 0; i < fp.ring.length; i++) { const a = fp.ring[i], c = fp.ring[(i + 1) % fp.ring.length]; pos.push(a[0], y, a[1], c[0], y, c[1]); }
      for (const t of fp.ticks) for (let i = 0; i < 4; i++) { const a = t[i], c = t[(i + 1) % 4]; pos.push(a[0], y, a[1], c[0], y, c[1]); }
      n++;
    }
    this.fpLines.visible = pos.length > 0;
    this.fpLines.geometry.dispose(); this.fpLines.geometry = new THREE.BufferGeometry(); this.fpLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.stats.footprints = n;
  }

  /* -------------------------------------------- 886199：窄道点线世界尺寸 */
  #worldPassage() {
    const m = this.b.passageDots.material; if (this._passageSaved) return;
    this._passageSaved = { size: m.size, att: m.sizeAttenuation };
    m.sizeAttenuation = true; m.size = 0.14; m.needsUpdate = true;   // 点距 0.28 的一半：点径:点距 = 1:2，任何距离都成立
  }
  #restorePassage() {
    const s = this._passageSaved; if (!s) return; const m = this.b.passageDots.material;
    m.size = s.size; m.sizeAttenuation = s.att; m.needsUpdate = true; this._passageSaved = null;
  }
  #passagePx() {
    // 远景下世界尺寸点会小到看不见：按相机距离把 size 下限钳到 4px（three 的 sizeAttenuation 公式：px = size · (H/2) / depth）
    const b = this.b, cam = b.view.camera, H = b.view.renderer?.domElement?.height ?? 900, m = b.passageDots.material;
    const target = b.world?.cells?.length ? b.passageDots.geometry.boundingSphere?.center : null;
    const depth = target ? cam.position.distanceTo(target) : 10, fovK = cam.isPerspectiveCamera ? 1 / Math.tan((cam.fov * Math.PI / 180) / 2) : 1;
    const px = 0.14 * (H / 2) * fovK / Math.max(0.1, depth);
    m.size = px < 4 ? 0.14 * 4 / px : 0.14;
    this.stats.passagePx = +Math.max(4, px).toFixed(2);
  }
}
