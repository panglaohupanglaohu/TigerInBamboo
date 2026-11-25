/**
 * 第 55 批 G3：导航 / 战斗组的 Battle 扩展（全部默认关；URL 参数或 battle.g3.set(name, on) 打开）。
 *   finePortals    格内精细门户 + 形变侧壁（cheesenav / holenav / voxelnav，world/fine-portals.js）
 *   continuousFlow 面内连续流向 + 鞍点守卫（flowfield，world/navmesh-flow.js guardedFlowAt）
 *   standards      竖旗横杆 + 金饰盾纹（squadbanner，badnorth/squad-standard.js），替换 Bezier 飘带旗
 *   meleeFx        旋转武器扫掠 + 盾推力 + 3D 接触遮挡（combatfx，core/melee-sweep.js）
 *   ladders        梯子模式：寻路避开薄悬平台 + 攀爬动画（terraceladder）；view 打开 woodladders 时自动跟随
 *   shadowFit      影子贴合形变后的实际地面（blobshadow；射线采样渲染网格拟合平面）
 *   commands       俏皮指令条 + 单一 Move 目标 + 地面标记（uikit，core/playful-layout.js）
 * battle.js 只有几处一行挂钩（构造 / start / stop / #draw 之后 / 近战出手 / 扫掠推进 / 下令），其余都在这里。
 */
import * as THREE from 'three';
import { buildStandardMesh, orientStandard, ShieldFaces } from './squad-standard.js';
import { beginSweep, stepSweep, shieldBlock } from '../core/melee-sweep.js';
import { layoutList, colorFor, hueFor, GLYPHS } from '../core/playful-layout.js';

export const G3_FLAGS = ['finePortals', 'continuousFlow', 'standards', 'meleeFx', 'ladders', 'shadowFit', 'commands'];
const COMMANDS = [{ key: 'move', label: '移动', glyph: 'wand' }, { key: 'hold', label: '原地坚守', glyph: 'grid' }, { key: 'retreat', label: '退回小屋', glyph: 'hammer' }];

export class BattleG3 {
  constructor(battle) {
    this.b = battle; this.on = Object.fromEntries(G3_FLAGS.map((k) => [k, false]));
    // continuousFlow 自第 115 轮起是主战斗的默认（battle.js 构造 BattleNavigation 时传 true）：
    // 这里继承 nav 的现值 —— g3 在 battle 构造期就建好（那时还没有 navigation），所以缺省按 true，
    // 否则 G3 一 start() 就把默认冲成 false（旧行为）。URL `?continuousFlow=0` 可强制关。
    this.on.continuousFlow = battle.navigation ? !!battle.navigation.continuousFlow : true;
    const q = new URLSearchParams(globalThis.location?.search ?? '');
    for (const k of G3_FLAGS) if (q.get(k) === '1') this.on[k] = true;
    if (q.get('continuousFlow') === '0') this.on.continuousFlow = false;
    this.group = new THREE.Group(); battle.group.add(this.group);
    this.shieldFaces = new ShieldFaces(260); this.group.add(this.shieldFaces.group);
    this.standards = new Map(); this.markers = new Map();
    // 扫掠的刃：一条细长板，跟着 sweep.angle 转（每个挥砍中的单位一片）
    this.blades = new THREE.InstancedMesh(new THREE.BoxGeometry(.012, .008, 1).translate(0, 0, .5), new THREE.MeshBasicMaterial({ color: '#f4efe6' }), 260);
    this.blades.count = 0; this.blades.frustumCulled = false; this.group.add(this.blades);
    this.stats = { sweeps: 0, sweepHits: 0, multiHits: 0, sweepBlockedByWall: 0, shieldBlocks: 0, shieldPushes: 0, climbing: 0, maxClimbing: 0, commands: 0, markers: 0, thinLadders: 0, fitted: 0 };
    this.panel = null;
  }
  set(name, value) {
    if (!G3_FLAGS.includes(name)) throw new RangeError('unknown G3 flag ' + name);
    this.on[name] = !!value; this.#apply(); return this.on[name];
  }
  start() { this.stats = { ...this.stats, sweeps: 0, sweepHits: 0, multiHits: 0, sweepBlockedByWall: 0, shieldBlocks: 0, shieldPushes: 0, commands: 0 }; this.#apply(); }
  stop() {
    for (const s of this.standards.values()) this.group.remove(s); this.standards.clear();
    for (const m of this.markers.values()) this.group.remove(m); this.markers.clear();
    this.shieldFaces.clear(); this.blades.count = 0; this.panel?.remove(); this.panel = null;
  }
  #apply() {
    const b = this.b, nav = b.navigation; if (!nav) return;
    nav.finePortals = this.on.finePortals; nav.continuousFlow = this.on.continuousFlow;
    const ladders = this.on.ladders || !!b.view.navLayer?.woodLadders;
    nav.ladderMode = ladders; nav.avoidThinLadders = ladders;
    if (b.unitShadows) { b.unitShadows.groundSampler = this.on.shadowFit ? this.#sampler() : null; if (this.on.shadowFit) b.unitShadows.enabled = true; }
    for (const u of b.units ?? []) u.hasShield = this.#shielded(u);
    for (const sq of b.squads ?? []) { const cloth = sq.flag?.userData?.cloth; if (sq.flag) sq.flag.visible = !this.on.standards; if (cloth) cloth.visible = !this.on.standards; }
    if (!this.on.standards) { for (const s of this.standards.values()) s.visible = false; this.shieldFaces.clear(); }
    if (!this.on.commands) { this.panel?.remove(); this.panel = null; for (const m of this.markers.values()) m.visible = false; }
  }

  /* ---------------------------------------------------------------- combatfx */
  /** 有盾：守军步兵（非弓非矛）+ 小个维京人；大个子双手斧没有盾。 */
  #shielded(u) { return this.on.meleeFx && !u.dead && (u.team === 1 ? !(u.bodyScale > 1.2 || u.kind === 'big') : !u.squad?.archer && !u.squad?.pike); }
  /** 近战出手。返回 true = 已由扫掠 / 盾接管（battle 不再直接 #hit）。 */
  melee(u, foe, alive) {
    if (!this.on.meleeFx) return false;
    const big = u.kind === 'big' || u.bodyScale > 1.2, infantry = u.team === 0 && !u.squad?.archer && !u.squad?.pike;
    if (big || infantry) {
      u.sweep = beginSweep(u, Math.atan2(foe.x - u.x, foe.z - u.z), { reach: big ? .42 : .3, arc: big ? Math.PI * 1.1 : Math.PI * .8, duration: big ? .34 : .24, side: (u.uid & 1) ? 1 : -1 });
      this.stats.sweeps++; return true;
    }
    return this.#struck(foe, u);
  }
  /** 扫掠推进一帧（battle 的 alive 循环里调用，挥砍中不走动）。 */
  stepSweep(u, alive, dt) {
    const b = this.b, sw = u.sweep;
    const hits = stepSweep(sw, alive, dt, { canHit: (v) => v.team !== u.team && !v.onBoat && !v.fall, clear: (a, c) => b.navigation.clearSegment(a, c, { step: .03 }), band: b.L * .6 });
    for (const v of hits) { this.stats.sweepHits++; this.#struck(v, u); }
    if (hits.length > 1) this.stats.multiHits++;
    u.face = sw.angle;
    if (sw.done) { if (sw.blockedAt !== null) this.stats.sweepBlockedByWall++; u.sweep = null; }
  }
  /** 一次打击落到 v 身上：先看盾；挡住 = 不掉血，攻击者被推开（可能被推下崖）。没挡住交回 battle.applyHit。 */
  #struck(v, by) {
    const b = this.b; v.hasShield = this.#shielded(v);
    const blk = shieldBlock(v, by, { now: b.t });
    if (!blk) { b.applyHit(v, by); return true; }
    this.stats.shieldBlocks++;
    v.face = Math.atan2(by.x - v.x, by.z - v.z);
    const nx = blk.nx, nz = blk.nz, tx = by.x + nx * blk.push, tz = by.z + nz * blk.push, plan = b.navigation.plan(by, b.navigation.unitNode(by)?.cell, by.navFloor);
    // 盾推力：攻击者沿推开方向退一步；脚下是 ≥2 层落差 → 走落崖那条路（与 battle #hit 同判据）
    const floor = by.navFloor ?? Math.round(by.y / b.L), below = b.navigation.supportBelow(tx, tz, by.y) / b.L;
    if (below <= floor - 2 || !b.navigation.index.cellAt(tx, tz)) by.fall = { vx: nx * 1.0, vz: nz * 1.0, vy: .2, from: floor };
    else if (!b.navigation.move(by, tx, tz, plan ? { ...plan, next: plan.from } : null)) { /* 背后是墙：推不动 */ } else this.stats.shieldPushes++;
    by.stunRemaining = Math.max(by.stunRemaining ?? 0, .35); by.sweep = null; by.thrust = null;
    return true;
  }

  /* ---------------------------------------------------------------- blobshadow */
  #sampler() {
    const b = this.b, ray = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), o = new THREE.Vector3(), cache = new Map();
    return (u, base, top) => {
      const surfaces = [b.view.mesh, b.view.navLayer?.stairs].filter((m) => m?.geometry?.attributes?.position);
      if (!surfaces.length) return null;
      const key = u.uid, prev = cache.get(key);
      if (prev && Math.hypot(prev.x - u.x, prev.z - u.z) < .015 && prev.version === b.world.version) return prev.fit;
      // 5 点射线：脚下 + 前后左右 r，取最接近期望高度（base..top）的那一层面——形变后的崖边 / 台阶在这里才是真的
      const r = .1 * (u.bodyScale ?? 1), pts = [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]], hitPts = [];
      for (const [dx, dz] of pts) {
        o.set(u.x + dx, top + .6, u.z + dz); ray.set(o, down); ray.far = 3;
        const hits = ray.intersectObjects(surfaces, false).filter((h) => h.point.y >= base - .3 && h.point.y <= top + .05);
        if (!hits.length) continue;
        const want = u.y, best = hits.reduce((a, h) => Math.abs(h.point.y - want) < Math.abs(a.point.y - want) ? h : a);
        hitPts.push([u.x + dx, best.point.y, u.z + dz]);
      }
      let fit = null;
      if (hitPts.length >= 3) {
        // 最小二乘平面 y = a·x + c·z + d（以单位为原点）
        let sxx = 0, sxz = 0, szz = 0, sx = 0, sz = 0, sy = 0, sxy = 0, szy = 0; const n = hitPts.length;
        for (const [x, y, z] of hitPts) { const X = x - u.x, Z = z - u.z; sxx += X * X; sxz += X * Z; szz += Z * Z; sx += X; sz += Z; sy += y; sxy += X * y; szy += Z * y; }
        const M = [[sxx, sxz, sx], [sxz, szz, sz], [sx, sz, n]], v = [sxy, szy, sy], det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
        const D = det(M);
        if (Math.abs(D) > 1e-12) {
          const col = (k) => M.map((row, i) => row.map((x, j) => j === k ? v[i] : x)), a = det(col(0)) / D, c = det(col(1)) / D, d = det(col(2)) / D;
          const slope = Math.hypot(a, c), deg = Math.atan(slope) * 180 / Math.PI;
          fit = { groundAt: (x, z) => Math.max(base - .02, Math.min(top + .02, a * (x - u.x) + c * (z - u.z) + d)), groundY: d, slope: slope > .05 ? { x: a / slope, z: c / slope, deg } : null, samples: n };
        }
      }
      cache.set(key, { x: u.x, z: u.z, version: b.world.version, fit }); if (fit) this.stats.fitted++;
      return fit;
    };
  }

  /* ---------------------------------------------------------------- 每帧（#draw 之后、LOD 之前） */
  afterDraw(dt) {
    const b = this.b; if (!b.running) return;
    const ladders = this.on.ladders || !!b.view.navLayer?.woodLadders;
    if (ladders !== b.navigation.ladderMode) this.#apply();
    this.#climbPose(ladders);
    this.#blades();
    if (this.on.standards) this.#drawStandards();
    if (this.on.commands) this.#commands();
  }
  /** 身体矩阵与 battle #draw 一致：位置 (x,y,z)，绕 Y 转 face，缩放 bodyScale。 */
  bodyMatrix(u) { return new THREE.Matrix4().compose(new THREE.Vector3(u.x, u.y, u.z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, u.face ?? 0, 0)), new THREE.Vector3().setScalar(u.bodyScale ?? 1)); }
  /** #draw 的实例顺序（与 battle 同一过滤），用于在 LOD 压实前改写个别实例。 */
  #instanceIndex() { const out = new Map(); let n = 0; for (const u of this.b.units) { if (n >= 260) break; if (u.dead && this.b.view.goreOff) continue; out.set(u, n++); } return out; }
  #climbPose(on) {
    const b = this.b, nav = b.navigation; let climbing = 0;
    if (!on) { this.stats.climbing = 0; return; }
    const idx = this.#instanceIndex(), m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (const u of b.units) {
      if (u.dead || u.onBoat || u.fall) { u.climb = null; continue; }
      const node = nav.unitNode(u), st = node && nav.stairAt(u.x, u.z, node);
      if (!st?.ladder) { u.climb = null; continue; }
      const L = st.ladder; u.climb = L; climbing++;
      const i = idx.get(u); if (i === undefined || b.spriteBatch.enabled) continue;
      // 面朝墙、身体前倾贴梯、按横档左右交替摆（手脚交替），脚高已由 footHeight 量化到横档
      const yaw = Math.atan2(L.wallX, L.wallZ), sway = Math.sin(L.progress * Math.PI * 2 * 6) * .22, bs = u.bodyScale ?? 1;
      e.set(-.18, yaw, sway, 'YXZ'); q.setFromEuler(e);
      m.compose(p.set(u.x - L.wallX * .02, u.y, u.z - L.wallZ * .02), q, s.setScalar(bs));
      for (const mesh of [b.mBody, b.mHead, b.mShield]) mesh.setMatrixAt(i, m);
      u.face = yaw;
    }
    for (const mesh of [b.mBody, b.mHead, b.mShield]) mesh.instanceMatrix.needsUpdate = true;
    this.stats.climbing = climbing; this.stats.maxClimbing = Math.max(this.stats.maxClimbing, climbing);
  }
  #blades() {
    let n = 0; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), s = new THREE.Vector3();
    if (this.on.meleeFx) for (const u of this.b.units) {
      if (!u.sweep || u.dead || n >= 260) continue;
      const bs = u.bodyScale ?? 1; e.set(0, u.sweep.angle, 0); q.setFromEuler(e);
      m.compose(p.set(u.x, u.y + .1 * bs, u.z), q, s.set(bs, bs, u.sweep.reach)); this.blades.setMatrixAt(n++, m);
    }
    this.blades.count = n; this.blades.instanceMatrix.needsUpdate = true;
  }
  #drawStandards() {
    const b = this.b, cam = b.view.camera, defenders = [];
    for (const sq of b.squads) {
      let g = this.standards.get(sq); if (!g) { g = buildStandardMesh(sq.id); this.standards.set(sq, g); this.group.add(g); }
      g.visible = sq.alive; if (sq.flag) sq.flag.visible = false; if (sq.flag?.userData?.cloth) sq.flag.userData.cloth.visible = false;
      if (!sq.alive) continue;
      const a = sq.members.filter((u) => !u.dead); if (!a.length) continue;
      const x = a.reduce((s, u) => s + u.x, 0) / a.length, z = a.reduce((s, u) => s + u.z, 0) / a.length, y = a.reduce((s, u) => s + u.y, 0) / a.length;
      g.position.set(x, y, z); g.updateMatrixWorld();
      const face = Math.atan2(a.reduce((s, u) => s + Math.sin(u.face ?? 0), 0), a.reduce((s, u) => s + Math.cos(u.face ?? 0), 0));
      g.userData.billboard = orientStandard(g, cam, { baseYaw: face, t: b.t });
      for (const u of a) if (!u.onBoat && !u.fall && !b.spriteBatch.enabled) defenders.push(u);
    }
    this.shieldFaces.update(defenders, (u) => this.bodyMatrix(u));
  }

  /* ---------------------------------------------------------------- uikit */
  #ensurePanel() {
    if (this.panel || typeof document === 'undefined' || !document.body?.appendChild) return this.panel;
    const el = document.createElement('div'); el.className = 'g3-commands';
    el.style.cssText = 'position:fixed;left:112px;top:50%;transform:translateY(-50%);z-index:6;pointer-events:auto;display:none;font:600 14px/1 system-ui,-apple-system,"PingFang SC",sans-serif';
    const L = layoutList(COMMANDS.map((c) => c.key), { size: 46, gap: 10, seed: 23, maxRot: 2.2, maxDx: 3, maxDy: 2 });
    L.items.forEach((it, i) => {
      const c = COMMANDS[i], col = colorFor(i, COMMANDS.length), btn = document.createElement('button');
      if (btn.dataset) btn.dataset.command = c.key; btn.title = c.label;
      btn.style.cssText = `position:absolute;left:${it.x}px;top:${it.y - L.items[0].y}px;width:${it.w + 82}px;height:${it.h}px;transform:translate(${it.dx}px,${it.dy}px) rotate(${it.rot}deg);background:${col.fill};border:3px solid ${col.edge};border-radius:10px;box-shadow:3px 3px 0 ${col.edge};color:#fff;display:flex;align-items:center;gap:8px;padding:0 10px;cursor:pointer`;
      btn.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" style="transform:rotate(${it.iconRot}deg)"><path d="${GLYPHS[c.glyph]}" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg><span>${c.label}</span>`;
      btn.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); this.command(c.key); });
      el.appendChild(btn);
    });
    el.style.height = (L.items.at(-1).y - L.items[0].y + 46) + 'px'; if (el.dataset) { el.dataset.overlaps = L.overlaps; el.dataset.maxRot = L.maxRotDeg.toFixed(2); }
    document.body.appendChild(el); this.panel = el; this.layout = L; return el;
  }
  #commands() {
    const b = this.b, el = this.#ensurePanel(); if (el) el.style.display = b.selected ? 'block' : 'none';
    // 地面标记：每队最多一个（单一 Move 目标），到了就收起
    let shown = 0;
    for (const sq of b.squads) {
      const mk = this.markers.get(sq); if (!mk) continue;
      const a = sq.members.filter((u) => !u.dead), arrived = a.length && a.every((u) => Math.hypot(u.x - mk.position.x, u.z - mk.position.z) < .55);
      if (!sq.alive || arrived && (mk.userData.age += b._dt ?? 0) > 1.2) mk.visible = false;
      if (mk.visible) { shown++; mk.rotation.y += (b._dt ?? 0) * .6; mk.children[1].position.y = .18 + Math.sin(b.t * 4) * .02; }
    }
    this.stats.markers = shown;
  }
  /** 下令（battle onPointer 下达 Move 之后调用，或指令条按钮）。单一目标：同队旧标记直接挪走，不叠第二个。 */
  onMove(sq, picked) {
    if (!this.on.commands || !sq || !picked) return;
    let mk = this.markers.get(sq);
    if (!mk) {
      mk = new THREE.Group();
      // 指令条同一套色相（hueFor），方形倾斜环 = 俏皮的地面标记
      const ring = new THREE.Mesh(new THREE.RingGeometry(.16, .22, 4, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(hueFor(sq.id % 3, 3) / 360, .55, .5), depthTest: false, transparent: true, opacity: .9 }));
      const pin = new THREE.Mesh(new THREE.ConeGeometry(.05, .14, 4).rotateX(Math.PI), new THREE.MeshBasicMaterial({ color: '#ffffff', depthTest: false }));
      ring.renderOrder = pin.renderOrder = 31; mk.add(ring, pin); this.group.add(mk); this.markers.set(sq, mk);
    }
    mk.position.set(picked.cell.cx, picked.floor * this.b.L + .03, picked.cell.cz); mk.rotation.set(0, .785 + (sq.id * .21), 0);
    mk.visible = true; mk.userData = { goal: picked.cell.id, floor: picked.floor, age: 0 };
    this.stats.commands++;
  }
  /** 指令条：move = 进入「点地面」状态（已选中即可）；hold = 原地坚守；retreat = 回最近的小屋门口。 */
  command(key) {
    const b = this.b, sq = b.selected; if (!sq) return false;
    const lead = sq.members.find((u) => !u.dead && !u.onBoat); if (!lead) return false;
    if (key === 'move') { b.hudMessage?.('点地面选目标'); return true; }
    let cell = null, floor = null;
    if (key === 'hold') { const n = b.navigation.unitNode(lead); if (n) { cell = n.cell; floor = n.floor; } }
    if (key === 'retreat') {
      let best = null; for (const h of b.houses) { if (h.lost || !h.door) continue; const p = b.navigation.plan(lead, h.door, b.world.top(h.door)); if (p && (!best || p.distance < best.d)) best = { d: p.distance, cell: h.door }; }
      if (best) { cell = best.cell; floor = b.world.top(best.cell); }
    }
    if (!cell) return false;
    sq.goal = cell; sq.goalFloor = floor; this.onMove(sq, { cell, floor });
    b.selected = null; b.scale = 1; this.stats.commands++;
    return true;
  }
}
