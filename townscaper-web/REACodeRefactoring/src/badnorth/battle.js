import { narrowCells, leftLaneTarget } from '../world/traffic.js';
/**
 * battle.js — Bad North 的玩法层：维京长船登陆、守军小队、近战 / 弓箭、血、尸体、箭粘在船上。
 *
 * 依据（官网 + 视频）：
 *   badnorth.com "real-time tactics roguelite … defend your idyllic island kingdom against a horde of Viking
 *     invaders … take full tactical advantage of the unique shape of each island"
 *   官网 summer1 / dawn1 截图：蓝衣小队举旗站在台地上；红衣维京人坐长船、船舷一排橙色圆盾，拖白色尾迹靠岸；
 *     打完仗滩上一片血、尸体倒在地上。
 *   946660607008403456 "making blood, corpses and arrows stick to boats"：船上的箭、血、尸体跟着船一起走。
 *   959530111187013632（画面）：选中小队时出现目标圈 + 虚线路径，小队沿台阶走过去。
 *   886199305522085890 "Dotted lines to mark narrow passages"；880853661936734211 窄道里"左行"会车。
 *   984813819280191488 "Blood soaking as a health indicator"：受伤的单位身上的红色越来越多。
 *
 * 玩法：
 *   · 一波波长船从海上开来，在沙滩边靠岸，维京人下船，沿导航图（world/navgraph.js）走向最近的小屋；
 *     在小屋边站够 4 秒，小屋着火（失守）。
 *   · 守军三队（两队步兵 + 一队弓手）。点小队选中 → 时间变慢（Bad North 的标志）→ 点地面下令移动。空格暂停。
 *   · 近战：相邻就互砍；弓手 4.5 格内向维京人射箭（抛物线），射空的箭插在地上，射到船上就粘在船上随船走。
 *   · 死亡：倒地成尸体，地上留一摊血；死在船上的尸体和血跟着船。
 */

import * as THREE from 'three';
import { buildNav } from '../world/navgraph.js';
import { buildFlowField } from './flowfield.js';

/**
 * 弹道查找表（987267068495003648 "live tweak the cost function of my projectile trajectory lookup tables"）：
 * 预先对 (水平距离, 高差) 的网格，在一排出射角里找能打到、且代价最小的那一个（代价 = 飞行时间 + 落角偏离 45° 的惩罚）；
 * 射箭时查表得到出射角和速度，按真实抛物线飞。画面里是一扇扇抛物线 + Inspector 里的 Cost Function。
 */
const G = 6, LUT = (() => {
  const t = new Map();
  for (let d = 0; d <= 60; d++) for (let h = -30; h <= 30; h++) {
    const dx = d * 0.1, dy = h * 0.1;
    let best = null;
    for (let a = 10; a <= 80; a += 2) {
      const th = (a * Math.PI) / 180, c = Math.cos(th), den = 2 * c * c * (dx * Math.tan(th) - dy);
      if (den <= 0 || dx < 0.05) continue;
      const v = Math.sqrt((G * dx * dx) / den);
      if (v > 9) continue;
      const time = dx / (v * c), vyEnd = v * Math.sin(th) - G * time, impact = Math.atan2(-vyEnd, v * c);
      const cost = time + 0.6 * Math.abs(impact - Math.PI / 4);
      if (!best || cost < best.cost) best = { cost, th, v, time };
    }
    t.set(d * 100 + h, best);
  }
  return t;
})();
const lookupShot = (dx, dy) => LUT.get(Math.min(60, Math.round(dx * 10)) * 100 + Math.max(-30, Math.min(30, Math.round(dy * 10))));

const MAX = 260;
const TEAM = { DEF: 0, VIK: 1 };
const COL = { def: new THREE.Color('#3f5f8f'), defArcher: new THREE.Color('#4d6fa0'), vik: new THREE.Color('#8e3b3b'), cream: new THREE.Color('#e8dcc0'), shieldV: new THREE.Color('#f0a35e'), shieldD: new THREE.Color('#d9e2ec'), corpse: new THREE.Color('#5a4048') };
const FLAG = ['#7fc6e0', '#f0a35e', '#9be0c8'];

export class Battle {
  constructor(view) {
    this.view = view;
    this.L = view.levelHeight;
    this.group = new THREE.Group();
    view.scene.add(this.group);
    const mk = (geo, color) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), MAX); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3); m.castShadow = true; m.frustumCulled = false; m.count = 0; this.group.add(m); return m; };
    const body = new THREE.CylinderGeometry(0.035, 0.055, 0.12, 7); body.translate(0, 0.06, 0);
    const head = new THREE.SphereGeometry(0.035, 8, 6); head.translate(0, 0.145, 0);
    const shield = new THREE.CylinderGeometry(0.04, 0.04, 0.01, 10); shield.rotateX(Math.PI / 2); shield.translate(0, 0.07, 0.05);
    this.mBody = mk(body); this.mHead = mk(head); this.mShield = mk(shield);
    // 皮肤空间的血迹（999185422403055616 "the splatter on the face follows the actual motion of the head"）：
    // 血斑按物体空间坐标的噪声画，所以跟着身体动；每个单位一个 aSoak（0…1），越大斑越多（血浸透 = 血量）。
    this.aSoak = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    this.mBody.geometry.setAttribute('aSoak', this.aSoak);
    this.mBody.material.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSoak;\nvarying float vSoak;\nvarying vec3 vObj;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSoak = aSoak; vObj = position;');
      sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSoak;\nvarying vec3 vObj;')
        .replace('#include <color_fragment>', '#include <color_fragment>\nfloat bn = fract(sin(dot(floor(vObj * 55.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);\nfloat bl = step(bn, vSoak * 0.85) * step(vObj.y, 0.05 + vSoak * 0.12);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.06, 0.08), bl);');
    };
    // 长矛（903647529203634176）：只给矛兵队画，斜向前伸
    const spear = new THREE.BoxGeometry(0.006, 0.006, 0.36); spear.translate(0, 0, 0.12); spear.rotateX(-0.25); spear.translate(0.03, 0.1, 0);
    this.mSpear = mk(spear);
    this.drops = [];   // 飞溅的血滴
    // 血：贴地的扁圆（累积，不消失 —— 环境叙事）
    const splat = new THREE.CircleGeometry(1, 9); splat.rotateX(-Math.PI / 2);
    this.blood = new THREE.InstancedMesh(splat, new THREE.MeshBasicMaterial({ color: '#8e1f24', transparent: true, opacity: 0.78, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 600);
    this.blood.count = 0; this.blood.frustumCulled = false; this.blood.renderOrder = 5;
    this.group.add(this.blood);
    // 箭：细长条
    const arrow = new THREE.BoxGeometry(0.008, 0.008, 0.16);
    this.arrowGeo = arrow;
    this.arrowMat = new THREE.MeshBasicMaterial({ color: '#efe6d4' });
    // 选中圈 + 目标虚线
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthTest: false }));
    this.ring.renderOrder = 30; this.ring.visible = false; this.group.add(this.ring);
    this.path = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#ffffff', size: 5, sizeAttenuation: false, depthTest: false }));
    this.path.renderOrder = 30; this.group.add(this.path);
    this.hud = document.createElement('div');
    this.hud.style.cssText = 'position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:5;background:rgba(255,255,255,.88);color:#1d2f36;border-radius:10px;padding:6px 12px;font:13px/1.4 -apple-system,system-ui,"PingFang SC",sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.15);pointer-events:none;display:none;white-space:nowrap';
    document.body.appendChild(this.hud);
    this.flowLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.85, depthTest: false }));
    this.flowLines.renderOrder = 29; this.flowLines.frustumCulled = false; this.group.add(this.flowLines);
    this.running = false;
  }

  /* ------------------------------------------------------------ 开局 */
  start(world) {
    this.stop();
    this.world = world;
    this.running = true;
    this.t = 0; this.scale = 1; this.paused = false; this.wave = 0; this.nextWave = 3; this.selected = null;
    this.units = []; this.squads = []; this.boats = []; this.arrows = []; this.houses = [];
    this.blood.count = 0;
    this.navCache = new Map();
    const cells = world.cells, L = this.L;
    // 小屋（island.js 记下的）
    for (const c of world.bnHouses || []) this.houses.push({ cell: c, burn: 0, lost: false, door: this.#walkNeighbor(c) });
    // 守军三队，站在小屋旁边的台地上
    const spots = this.houses.map((h) => h.door).filter(Boolean);
    for (let s = 0; s < 3; s++) {
      const at = spots[s % Math.max(1, spots.length)] || cells.find((c) => world.top(c) >= 2);
      if (!at) break;
      const squad = { id: s, archer: s === 2, pike: s === 1, flag: this.#flag(FLAG[s]), goal: at, members: [], alive: true };
      squad.flag.userData.fid = s;
      for (let k = 0; k < 8; k++) this.#spawn(TEAM.DEF, at, squad, k);
      this.squads.push(squad);
    }
    this.view.effects.fireSources = [];
    if (this.view.smoke) this.view.smoke.sources = [];
    this.hud.style.display = 'block';
    this.#hud();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    for (const sq of this.squads) this.group.remove(sq.flag, sq.flag.userData.cloth);
    for (const b of this.boats) this.group.remove(b.mesh);
    for (const a of this.arrows) a.mesh.parent?.remove(a.mesh);
    this.mBody.count = this.mHead.count = this.mShield.count = this.mSpear.count = 0;
    if (this.view.smoke) this.view.smoke.sources = [];
    this.blood.count = 0;
    this.ring.visible = false;
    this.path.geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    this.hud.style.display = 'none';
    this.view.effects.fireSources = this.view.worldMesh.chimneys || [];
  }

  /* ------------------------------------------------------------ 工具 */
  #walkNeighbor(c) {
    const w = this.world;
    for (const id of c.edgeNeighbors) { if (id < 0) continue; const o = w.cells[id]; if (w.top(o) > 0 && w.top(o) === w.ground(o)) return o; }
    return null;
  }
  #nav(goal) {
    let n = this.navCache.get(goal.id);
    if (!n) { n = buildNav(this.world, { start: goal }); this.navCache.set(goal.id, n); }
    return n;
  }
  #cellAt(x, z) { return this.view.index.cellAt(x, z); }
  #groundY(x, z) { const c = this.#cellAt(x, z); return c ? this.world.top(c) * this.L : 0; }
  /**
   * 军旗（926890207298899969 "I build a custom mesh for the flag using a bezier curve along virtual wind particles"；
   * 926834721392340992 "I built a wind system to get them flapping just right"）：
   * 旗杆顶放出 3 个"虚拟风粒子"，每个跟着前一个走、再被风吹；旗面 = 这 4 个点的三次贝塞尔曲线，
   * 竖着拉出旗面高度，做成一条带子网格。小队走动时旗子自然拖在后面，停下时随风飘。
   */
  #flag(color) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 5), new THREE.MeshBasicMaterial({ color: '#6e5443' })); pole.position.y = 0.3;
    const SEG = 10;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    const cloth = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide }));
    cloth.frustumCulled = false;
    g.add(pole);
    this.group.add(g, cloth);
    g.userData = { cloth, SEG, parts: null };
    return g;
  }
  #updateFlag(f, dt) {
    const { cloth, SEG } = f.userData;
    const top = new THREE.Vector3(f.position.x, f.position.y + 0.58, f.position.z);
    const LEN = 0.075;   // 粒子间距
    if (!f.userData.parts) f.userData.parts = [0, 1, 2].map((i) => top.clone().add(new THREE.Vector3(LEN * (i + 1), 0, 0)));
    const P = f.userData.parts;
    const t = this.t;
    // 风：取共享风场在旗杆顶的值（926834721392340992 "I built a wind system to get them flapping just right"），再叠一点阵风
    const base = this.view.atmosphere?.sample ? this.view.atmosphere.sample(top.x, top.y, top.z) : new THREE.Vector3(1, 0, 0.35);
    const wind = new THREE.Vector3(base.x, 0, base.z).normalize().multiplyScalar(0.9 + 0.5 * Math.sin(t * 0.8 + (f.userData.fid || 0)));
    let prev = top;
    for (let i = 0; i < 3; i++) {
      const p = P[i];
      // 风 + 一点下垂 + 随相位抖动（飘）
      p.addScaledVector(wind, dt * 0.35);
      p.y += (Math.sin(t * 7 + i * 1.7 + (f.userData.fid || 0)) * 0.05 - 0.02) * dt;
      // 距离约束：跟着前一个点
      const d = p.clone().sub(prev), l = d.length() || 1e-6;
      p.copy(prev).addScaledVector(d, LEN / l);
      prev = p;
    }
    const pos = cloth.geometry.attributes.position;
    const H = 0.15;
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG, v = 1 - u;
      const b = top.clone().multiplyScalar(v * v * v)
        .addScaledVector(P[0], 3 * v * v * u).addScaledVector(P[1], 3 * v * u * u).addScaledVector(P[2], u * u * u);
      pos.setXYZ(i * 2, b.x, b.y, b.z);
      pos.setXYZ(i * 2 + 1, b.x, b.y - H * (1 - 0.25 * u), b.z);   // 旗尾稍窄
    }
    pos.needsUpdate = true;
  }
  #spawn(team, cell, squad, k, pos = null) {
    const a = (k / 8) * Math.PI * 2, r = 0.12 + (k % 2) * 0.1;
    const u = { team, squad, k, hp: team === TEAM.DEF ? 3 : 2, max: team === TEAM.DEF ? 3 : 2, x: (pos?.x ?? cell.cx) + Math.cos(a) * r, z: (pos?.z ?? cell.cz) + Math.sin(a) * r, y: 0, cd: Math.random(), dead: false, onBoat: null, face: 0, soak: 0 };
    u.y = pos?.y ?? this.#groundY(u.x, u.z);
    this.units.push(u);
    if (squad) squad.members.push(u);
    return u;
  }
  #bleed(x, y, z, s, boat = null) {
    if (this.blood.count >= 600) return;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.006, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6), new THREE.Vector3(s, 1, s * (0.6 + Math.random() * 0.6)));
    if (boat) { boat.stains.push({ m, i: this.blood.count }); }
    this.blood.setMatrixAt(this.blood.count++, m);
    this.blood.instanceMatrix.needsUpdate = true;
  }

  /* ------------------------------------------------------------ 维京长船 */
  #launchWave() {
    const w = this.world, cells = w.cells;
    this.wave++;
    // 靠岸点：沙滩 / 低台（≤2 层）且挨着海
    const landings = cells.filter((c) => { const t = w.top(c); return t >= 1 && t <= 2 && t === w.ground(c) && c.edgeNeighbors.some((id) => id >= 0 && w.top(cells[id]) === 0); });
    if (!landings.length) return;
    const land = landings[(Math.random() * landings.length) | 0];
    const sea = cells[land.edgeNeighbors.find((id) => id >= 0 && w.top(cells[id]) === 0)];
    const dx = sea.cx - land.cx, dz = sea.cz - land.cz, dl = Math.hypot(dx, dz) || 1;
    const dir = [dx / dl, dz / dl];
    const stop = [sea.cx + dir[0] * 0.25, sea.cz + dir[1] * 0.25];
    const from = [stop[0] + dir[0] * 14, stop[1] + dir[1] * 14];
    const mesh = this.#longship();
    this.group.add(mesh);
    const boat = { mesh, from, stop, dir, t: 0, state: 'in', land, crew: [], stains: [], trail: [] };
    const n = 6 + Math.min(6, this.wave * 2);
    for (let k = 0; k < n; k++) { const u = this.#spawn(TEAM.VIK, land, null, k, { x: from[0], z: from[1], y: 0.05 }); u.onBoat = boat; u.seat = k; boat.crew.push(u); }
    this.boats.push(boat);
  }
  #longship() {
    const g = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(-0.55, 0); s.quadraticCurveTo(0, -0.14, 0.55, 0); s.lineTo(0.64, 0.16); s.quadraticCurveTo(0, 0.03, -0.64, 0.16); s.closePath();
    const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false }).translate(0, 0, -0.1), new THREE.MeshStandardMaterial({ color: '#6a4a52', roughness: 0.9, flatShading: true }));
    g.add(hull);
    // 船舷一排橙色圆盾（截图）
    for (let i = -3; i <= 3; i++) for (const side of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.CircleGeometry(0.045, 10), new THREE.MeshBasicMaterial({ color: '#f0a35e', side: THREE.DoubleSide }));
      sh.position.set(i * 0.13, 0.07, side * 0.105); g.add(sh);
    }
    g.userData.wake = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#ffffff', size: 3, sizeAttenuation: false, transparent: true, opacity: 0.9 }));
    this.group.add(g.userData.wake);
    return g;
  }

  /* ------------------------------------------------------------ 输入 */
  /** 返回 true = 这次点击被战斗层吃掉了（不当建造） */
  onPointer(hit) {
    if (!this.running || !hit?.cell) return false;
    const c = hit.cell;
    // 点到小队附近 → 选中
    let best = null, bd = 0.6;
    for (const sq of this.squads) {
      if (!sq.alive) continue;
      const [x, z] = this.#centroid(sq);
      const d = Math.hypot(x - hit.point.x, z - hit.point.z);
      if (d < bd) { bd = d; best = sq; }
    }
    if (best) { this.selected = best; this.scale = 0.15; this.#hud(); return true; }
    if (this.selected) {
      const w = this.world;
      let goal = c;
      if (!(w.top(goal) > 0 && w.top(goal) === w.ground(goal))) goal = this.#walkNeighbor(goal) || goal;
      if (!Number.isFinite(this.#nav(goal).tree.time[this.#cellAt(...this.#centroid(this.selected))?.id ?? -1])) { this.#hud('那里走不过去'); return true; }
      this.selected.goal = goal;
      this.#drawPath(this.selected, goal);
      this.selected = null; this.scale = 1; this.#hud();
      return true;
    }
    return true;   // Bad North 场景里点击不建造
  }
  togglePause() { this.paused = !this.paused; this.#hud(); }
  #centroid(sq) {
    const a = sq.members.filter((u) => !u.dead);
    if (!a.length) return [0, 0];
    return [a.reduce((s, u) => s + u.x, 0) / a.length, a.reduce((s, u) => s + u.z, 0) / a.length];
  }
  #drawPath(sq, goal) {
    const nav = this.#nav(goal);
    let c = this.#cellAt(...this.#centroid(sq));
    const pts = [];
    for (let k = 0; c && k < 80; k++) {
      pts.push(c.cx, nav.hgt[c.id] * this.L + 0.05, c.cz);
      const p = nav.tree.parent[c.id];
      if (p < 0) break;
      const n = this.world.cells[p];
      for (let s = 1; s < 4; s++) pts.push(c.cx + (n.cx - c.cx) * s / 4, (nav.hgt[c.id] + (nav.hgt[p] - nav.hgt[c.id]) * s / 4) * this.L + 0.05, c.cz + (n.cz - c.cz) * s / 4);
      c = n;
    }
    this.path.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.pathT = 2.5;
  }
  #hud(msg) {
    const alive = this.squads.filter((s) => s.alive).length;
    const lost = this.houses.filter((h) => h.lost).length;
    const vik = this.units.filter((u) => u.team === TEAM.VIK && !u.dead).length;
    this.hud.textContent = msg || `第 ${this.wave} 波 · 维京人 ${vik} · 守军 ${alive} 队 · 小屋 ${this.houses.length - lost}/${this.houses.length}` +
      (this.paused ? ' · 已暂停（空格继续）' : this.selected ? ' · 已选中，点地面下令（时间变慢）' : ' · 点小队选中 · 空格暂停');
  }

  /* ------------------------------------------------------------ 每帧 */
  update(dtReal) {
    if (!this.running) return;
    const dt = this.paused ? 0 : Math.min(0.05, dtReal) * this.scale;
    this.t += dt;
    this._dt = Math.max(dt, 0.004);
    const w = this.world, L = this.L;
    if (this.t > this.nextWave) { this.#launchWave(); this.nextWave = this.t + 26; this.#hud(); }
    // 长船
    for (const b of this.boats) {
      if (b.state === 'in') {
        b.t = Math.min(1, b.t + dt / 9);
        const e = 1 - (1 - b.t) * (1 - b.t);
        b.x = b.from[0] + (b.stop[0] - b.from[0]) * e; b.z = b.from[1] + (b.stop[1] - b.from[1]) * e;
        if (b.t >= 1) { b.state = 'unload'; b.wait = 0; }
      } else if (b.state === 'unload') {
        b.wait += dt;
        for (const u of b.crew) if (u.onBoat && !u.dead && b.wait > 0.3 + u.seat * 0.25) { u.onBoat = null; u.x = b.land.cx + (Math.random() - 0.5) * 0.3; u.z = b.land.cz + (Math.random() - 0.5) * 0.3; }
        if (b.crew.every((u) => !u.onBoat || u.dead) && b.wait > 4) { b.state = 'out'; b.t = 0; }
      } else {
        b.t += dt / 14;
        b.x = b.stop[0] + b.dir[0] * b.t * 16; b.z = b.stop[1] + b.dir[1] * b.t * 16;
      }
      const ang = Math.atan2(b.dir[1], b.dir[0]) + (b.state === 'out' ? 0 : Math.PI);
      const bob = Math.sin(this.t * 2 + b.from[0]) * 0.01;
      b.mesh.position.set(b.x, 0.02 + bob, b.z);
      b.mesh.rotation.set(0, -ang, Math.sin(this.t * 1.5) * 0.03);
      b.mesh.updateMatrixWorld();
      // 尾迹：船尾撒白点，慢慢散开（901469409579061248）
      if (b.state !== 'unload' && Math.random() < 0.9) b.trail.push({ x: b.x - Math.cos(-b.mesh.rotation.y) * 0.55, z: b.z - Math.sin(-b.mesh.rotation.y) * 0.55, a: 0, s: Math.random() < 0.5 ? 1 : -1 });
      for (const p of b.trail) { p.a += dt; const px = -Math.sin(-b.mesh.rotation.y) * p.s, pz = Math.cos(-b.mesh.rotation.y) * p.s; p.x += px * dt * 0.12; p.z += pz * dt * 0.12; }
      b.trail = b.trail.filter((p) => p.a < 4).slice(-260);
      b.mesh.userData.wake.geometry.setAttribute('position', new THREE.Float32BufferAttribute(b.trail.flatMap((p) => [p.x, 0.02, p.z]), 3));
      // 粘在船上的血：跟着船移动
      for (const st of b.stains) { const m = b.mesh.matrixWorld.clone().multiply(st.local ?? (st.local = new THREE.Matrix4().copy(b.mesh.matrixWorld).invert().multiply(st.m))); this.blood.setMatrixAt(st.i, m); }
      if (b.stains.length) this.blood.instanceMatrix.needsUpdate = true;
    }
    this.boats = this.boats.filter((b) => { if (b.state === 'out' && b.t > 1.2) { this.group.remove(b.mesh, b.mesh.userData.wake); for (const st of b.stains) this.blood.setMatrixAt(st.i, new THREE.Matrix4().makeScale(0, 0, 0)); return false; } return true; });

    // 流场（972829402873716737 / 901842167508992000）：每 0.25 秒按"守军"重算一次；维京人用它找最近的守军 + 兵种
    this.flowT = (this.flowT || 0) - dt;
    if (this.flowT <= 0 || !this.flowDef) {
      this.flowT = 0.25;
      const nav = this.#nav(this.houses[0]?.door || w.cells.find((c) => w.top(c) > 0));
      const srcs = this.units.filter((u) => u.team === TEAM.DEF && !u.dead).map((u) => ({ unit: u, cell: this.#cellAt(u.x, u.z), type: u.squad.archer ? '弓手' : u.squad.pike ? '矛兵' : '步兵', squad: u.squad.id }));
      this.flowDef = buildFlowField(w, nav, srcs);
      this.#drawFlow();
    }
    // 单位
    const alive = this.units.filter((u) => !u.dead);
    for (const u of alive) {
      if (u.fall) { this.#fallStep(u, dt); continue; }
      if (u.onBoat) {
        const b = u.onBoat, row = (u.seat % 7) - 3, side = u.seat % 2 ? 1 : -1;
        const lx = row * 0.12, lz = side * 0.04;
        const ca = Math.cos(-b.mesh.rotation.y), sa = Math.sin(-b.mesh.rotation.y);
        u.x = b.mesh.position.x + lx * ca - lz * sa; u.z = b.mesh.position.z + lx * sa + lz * ca; u.y = b.mesh.position.y + 0.03;
        continue;
      }
      u.cd -= dt;
      // 最近的敌人
      let foe = null, fd = 1e9;
      for (const v of alive) { if (v.team === u.team || v.onBoat && u.team === TEAM.VIK) continue; const d = Math.hypot(v.x - u.x, v.z - u.z); if (d < fd) { fd = d; foe = v; } }
      const archer = u.squad?.archer;
      const reach = u.squad?.pike ? 0.44 : 0.28;   // 矛兵够得更远，先出手（903647529203634176）
      if (foe && fd < reach) {
        u.face = Math.atan2(foe.x - u.x, foe.z - u.z);
        if (u.cd <= 0) { u.cd = 0.9 + Math.random() * 0.3; this.#hit(foe, u); }
        continue;
      }
      if (archer && foe && foe.team === TEAM.VIK && fd < 4.5 && u.cd <= 0) {
        u.cd = 1.6 + Math.random() * 0.6;
        this.#shoot(u, foe);
      }
      // 走：守军走向小队目标，维京人走向最近的小屋（站在门口）
      let goal = null;
      if (u.team === TEAM.DEF) goal = u.squad.goal;
      else {
        const open = this.houses.filter((h) => !h.lost && h.door);
        // 流场：最近的守军在 1.6 以内就顺着流向扑过去（数据继承告诉我们那是什么兵种：维京人绕开矛兵的正面）
        const f = this.flowDef?.at(this.#cellAt(u.x, u.z));
        if (f && f.dist < 1.6) goal = f.source.type === '矛兵' && f.dist > 0.6 ? null : f.source.cell;
        if (foe && fd < 1.2 && foe.team === TEAM.DEF) goal = goal || this.#cellAt(foe.x, foe.z);
        if (!goal && open.length) goal = open.reduce((a, h) => (Math.hypot(h.door.cx - u.x, h.door.cz - u.z) < Math.hypot(a.door.cx - u.x, a.door.cz - u.z) ? h : a)).door;
      }
      if (!goal) continue;
      const here = this.#cellAt(u.x, u.z);
      let tx = goal.cx, tz = goal.cz;
      if (here && here !== goal) {
        const nav = this.#nav(goal), p = nav.tree.parent[here.id];
        if (p >= 0) {
          const next=w.cells[p]; tx=next.cx; tz=next.cz;
          // 880853661936734211: use a stable left lane in narrow passages.
          if (this._trafficVersion !== w.version) { this._traffic=narrowCells(w,nav); this._trafficVersion=w.version; }
          if (this._traffic[here.id] || this._traffic[next.id]) { const lane=leftLaneTarget(here,next);tx=lane.x;tz=lane.z; }
        }
      }
      // 编队偏移：同一小队在目标格周围围一圈
      const off = u.team === TEAM.DEF ? 0.16 : 0.12;
      const near = here === goal;
      if (near) { const a = (u.k / 8) * Math.PI * 2; tx += Math.cos(a) * off * (1 + (u.k % 2)); tz += Math.sin(a) * off * (1 + (u.k % 2)); }
      const dx = tx - u.x, dz = tz - u.z, d = Math.hypot(dx, dz);
      const speed = u.team === TEAM.DEF ? 0.9 : 0.75;
      if (d > 0.02) {
        const s = Math.min(d, speed * dt) / d;
        // Local overlap separation supplements the stable lane target above.
        let lx = 0, lz = 0;
        for (const v of alive) { if (v === u || v.onBoat) continue; const ex = u.x - v.x, ez = u.z - v.z, e = Math.hypot(ex, ez); if (e < 0.09 && e > 1e-4) { lx += ex / e * (0.09 - e); lz += ez / e * (0.09 - e); } }
        u.x += dx * s + lx * 0.5; u.z += dz * s + lz * 0.5;
        u.face = Math.atan2(dx, dz);
      }
      const gy = this.#groundY(u.x, u.z);
      u.y += (gy - u.y) * Math.min(1, dt * 10);
    }
    // 小屋：维京人在门口站够 4 秒 → 着火
    for (const h of this.houses) {
      if (h.lost || !h.door) continue;
      const vikNear = alive.some((u) => u.team === TEAM.VIK && !u.onBoat && Math.hypot(u.x - h.door.cx, u.z - h.door.cz) < 0.5);
      const defNear = alive.some((u) => u.team === TEAM.DEF && Math.hypot(u.x - h.door.cx, u.z - h.door.cz) < 0.7);
      h.burn = vikNear && !defNear ? h.burn + dt : Math.max(0, h.burn - dt * 0.5);
      if (h.burn > 4) {
        h.lost = true;
        const c = h.cell, y = (w.top(c) + 0.6) * L;
        this.view.effects.fireSources.push({ x: c.cx, y, z: c.cz }, { x: c.cx + 0.1, y, z: c.cz - 0.08 });
        this.view.effects.showFire = true;
        this.view.smoke?.sources.push({ x: c.cx, y: y + 0.1, z: c.cz });   // 着火的小屋冒黑烟（1015140880666300416）
        this.#hud();
      }
    }
    // 箭
    for (const a of this.arrows) {
      if (a.stuck) continue;
      a.t += dt / a.dur;
      const t = Math.min(1, a.t);
      const x = a.from[0] + (a.to[0] - a.from[0]) * t, z = a.from[2] + (a.to[2] - a.from[2]) * t;
      const T = t * a.dur, vx0 = a.shot.v * Math.cos(a.shot.th), vy0 = a.shot.v * Math.sin(a.shot.th);
      const y = a.from[1] + vy0 * T - 0.5 * G * T * T;
      const dirx = (a.to[0] - a.from[0]), dirz = (a.to[2] - a.from[2]), dl = Math.hypot(dirx, dirz) || 1;
      a.mesh.position.set(x, y, z);
      a.mesh.lookAt(x + dirx / dl * vx0, y + (vy0 - G * T), z + dirz / dl * vx0);
      if (t >= 1) {
        a.stuck = true;
        const tg = a.target;
        if (!tg.dead && Math.hypot(tg.x - x, tg.z - z) < 0.18) { this.#hit(tg, null); a.mesh.visible = false; }
        else {
          // 射空：落在船上 → 粘在船上随船走（946660607008403456）；否则插在地上
          const boat = this.boats.find((b) => Math.hypot(b.mesh.position.x - x, b.mesh.position.z - z) < 0.6);
          if (boat) { boat.mesh.attach(a.mesh); }
          else a.mesh.position.y = Math.max(a.mesh.position.y, this.#groundY(x, z) + 0.04);
        }
      }
    }
    if (this.arrows.length > 160) { const old = this.arrows.shift(); old.mesh.parent?.remove(old.mesh); }
    // 小队全灭
    for (const sq of this.squads) if (sq.alive && sq.members.every((u) => u.dead)) { sq.alive = false; sq.flag.visible = false; sq.flag.userData.cloth.visible = false; if (this.selected === sq) { this.selected = null; this.scale = 1; } this.#hud(); }
    // 血滴：抛物线落地 → 一小摊血
    for (const d of this.drops) { d.vy -= 5 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; const gy = this.#groundY(d.x, d.z); if (d.y <= gy) { d.done = true; this.#bleed(d.x, gy, d.z, 0.02 + Math.random() * 0.02); } }
    this.drops = this.drops.filter((d) => !d.done);
    this.#draw();
    if (this.pathT > 0) { this.pathT -= dtReal; this.path.material.opacity = Math.min(1, this.pathT); this.path.material.transparent = true; if (this.pathT <= 0) this.path.geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3)); }
    if ((this._hudT = (this._hudT || 0) + dtReal) > 0.5) { this._hudT = 0; this.#hud(); }
  }

  /** 流场调试（902069261304287232 数据继承可视化）：每格到父格画一段，颜色 = 继承来的源（哪支守军） */
  #drawFlow() {
    const on = !!this.view.flowDebug;
    this.flowLines.visible = on;
    if (!on || !this.flowDef) return;
    const F = this.flowDef, cells = this.world.cells, L = this.L, pos = [], col = [];
    const C = [[0.15, 0.55, 1.0], [1.0, 0.45, 0.1], [0.15, 0.85, 0.35]];
    for (let id = 0; id < cells.length; id++) {
      const p = F.parent[id];
      if (p < 0 || F.src[id] < 0) continue;
      const a = cells[id], b = cells[p], k = C[F.sources[F.src[id]].squad % 3];
      const fade = Math.max(0.6, 1 - F.dist[id] / 10);
      pos.push(a.cx, this.world.top(a) * L + 0.04, a.cz, b.cx, this.world.top(b) * L + 0.04, b.cz);
      col.push(...k.map((x) => x * fade), ...k.map((x) => x * fade));
    }
    this.flowLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.flowLines.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  }

  /**
   * 挨打：扣血、后退一点、喷几滴血（1022573208590057472 / 912691357440978945 "the look and feel of the basic meat and
   * potato melee combat"）；站在崖边的会被打下去（870296307889573889 "Units can now get knocked off ledges"）。
   */
  #hit(v, by) {
    if (by && !v.onBoat && !v.dead) {
      const dx = v.x - by.x, dz = v.z - by.z, d = Math.hypot(dx, dz) || 1, nx = dx / d, nz = dz / d;
      v.x += nx * 0.05; v.z += nz * 0.05;
      for (let k = 0; k < 4; k++) this.drops.push({ x: v.x, y: v.y + 0.12, z: v.z, vx: nx * (0.4 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.4, vy: 0.6 + Math.random() * 0.5, vz: nz * (0.4 + Math.random() * 0.6) + (Math.random() - 0.5) * 0.4 });
      // 崖边：往后一步就比脚下低 ≥ 2 层 → 被打下去
      const here = this.#cellAt(v.x, v.z), there = this.#cellAt(v.x + nx * 0.3, v.z + nz * 0.3);
      const w = this.world;
      if (here && (!there || w.top(there) <= w.top(here) - 2) && Math.random() < 0.6) {
        v.fall = { vx: nx * 0.9, vz: nz * 0.9, vy: 0.9, from: w.top(here) };
      }
    }
    v.hp--;
    v.soak = 1 - v.hp / v.max;   // 血浸透 = 血量指示（984813819280191488）
    this.#bleed(v.x, v.y, v.z, 0.04 + Math.random() * 0.03, v.onBoat);
    if (v.hp <= 0 && !v.dead) {
      v.dead = true;
      this.#bleed(v.x, v.y, v.z, 0.1 + Math.random() * 0.06, v.onBoat);
      v.corpseRot = Math.random() * 6;
    }
  }
  #fallStep(u, dt) {
    const f = u.fall;
    f.vy -= 6 * dt;
    u.x += f.vx * dt; u.z += f.vz * dt; u.y += f.vy * dt;
    const c = this.#cellAt(u.x, u.z);
    const gy = c ? this.world.top(c) * this.L : -0.3;
    if (u.y <= gy && f.vy < 0) {
      u.y = Math.max(gy, -0.05);
      const drop = f.from - (c ? this.world.top(c) : 0);
      u.fall = null;
      if (!c || drop >= 3) { if (!u.dead) { u.dead = true; u.corpseRot = Math.random() * 6; this.#bleed(u.x, u.y, u.z, 0.12); } }
      else if (drop >= 2 && !u.dead) this.#hit(u, null);
    }
  }

  #shoot(u, foe) {
    const m = new THREE.Mesh(this.arrowGeo, this.arrowMat);
    this.group.add(m);
    const lead = 0.25;
    const to = [foe.x + (Math.random() - 0.5) * lead, foe.y + 0.08, foe.z + (Math.random() - 0.5) * lead];
    const from = [u.x, u.y + 0.15, u.z];
    const dist = Math.hypot(to[0] - from[0], to[2] - from[2]);
    const shot = lookupShot(dist, to[1] - from[1]);
    if (!shot) { this.group.remove(m); return; }   // 查表没有解：够不着
    this.arrows.push({ mesh: m, from, to, t: 0, dur: shot.time, shot, target: foe, stuck: false });
  }

  #draw() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), e = new THREE.Euler();
    const col = new THREE.Color();
    let n = 0, nSpear = 0;
    for (const u of this.units) {
      if (n >= MAX) break;
      if (u.dead && this.view.goreOff) continue;
      if (u.dead) {
        // 尸体：躺倒；死在船上的跟着船
        if (u.onBoat) { const b = u.onBoat; const ca = Math.cos(-b.mesh.rotation.y), sa = Math.sin(-b.mesh.rotation.y), lx = ((u.seat % 7) - 3) * 0.12; u.x = b.mesh.position.x + lx * ca; u.z = b.mesh.position.z + lx * sa; u.y = b.mesh.position.y + 0.03; }
        e.set(Math.PI / 2, u.corpseRot, 0);
        col.copy(u.team === TEAM.DEF ? COL.def : COL.vik).lerp(COL.corpse, 0.45);
      } else {
        e.set(0, u.face, 0);
        col.copy(u.team === TEAM.DEF ? (u.squad?.archer ? COL.defArcher : COL.def) : COL.vik);
        // 血量改由皮肤空间的血斑表达（aSoak），整体只略微发红
        col.lerp(new THREE.Color('#9e1f24'), u.soak * 0.15);
      }
      q.setFromEuler(e);
      m.compose(p.set(u.x, u.y + (u.dead ? 0.05 : 0), u.z), q, s);
      this.mBody.setMatrixAt(n, m); this.mBody.setColorAt(n, col);
      this.aSoak.setX(n, u.dead ? 0.9 : u.soak);
      this.mHead.setMatrixAt(n, m); this.mHead.setColorAt(n, u.team === TEAM.DEF ? COL.shieldD : COL.cream);
      this.mShield.setMatrixAt(n, m); this.mShield.setColorAt(n, u.team === TEAM.DEF ? COL.shieldD : COL.shieldV);
      if (u.squad?.pike && !u.dead) { this.mSpear.setMatrixAt(nSpear, m); this.mSpear.setColorAt(nSpear, COL.cream); nSpear++; }
      n++;
    }
    this.mSpear.count = nSpear; this.mSpear.instanceMatrix.needsUpdate = true; if (this.mSpear.instanceColor) this.mSpear.instanceColor.needsUpdate = true;
    this.aSoak.needsUpdate = true;
    // 关掉血腥（999191760944418817）：不画血、不留尸体
    const gore = !this.view.goreOff;
    this.blood.visible = gore;
    for (const mm of [this.mBody, this.mHead, this.mShield]) { mm.count = n; mm.instanceMatrix.needsUpdate = true; if (mm.instanceColor) mm.instanceColor.needsUpdate = true; }
    // 旗子跟着小队
    for (const sq of this.squads) {
      if (!sq.alive) continue;
      const [x, z] = this.#centroid(sq);
      sq.flag.position.set(x, this.#groundY(x, z), z);
      this.#updateFlag(sq.flag, this._dt || 0.016);
    }
    if (this.selected) { const [x, z] = this.#centroid(this.selected); this.ring.visible = true; this.ring.position.set(x, this.#groundY(x, z) + 0.03, z); }
    else this.ring.visible = false;
  }
}
