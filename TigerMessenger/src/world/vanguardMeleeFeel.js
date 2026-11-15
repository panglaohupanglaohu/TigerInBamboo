// 先锋重甲兵 · 激光刀近战手感（2026-11-10 用户：「重甲兵的格斗动作，你需要加强，能力库有，还未学习」）。
//
// 学的是能力库里 Bad North 近战那几条（REA 学习记录，均已逐帧核过）：
//   1022573208590057472 "The look and feel of the basic meat and potato melee combat is one of the things I'm most proud of in Bad North"
//     片中「手感」= ① 挨打的人被顶开一点 ② 每次命中朝背离攻击者方向喷一小串看得见的抛物线血滴，1 秒内落地 ③ 身上越打越红 ④ 尸体与血迹留下。
//   912691357440978945 "Long time no combat gifs"：成团接触、反复接触—分开，每次命中都有可读的停顿与飞溅。
//   984813819280191488 "…a proper stun state for the little ones"：小兵挨打要有僵直（停住、晃）。
//   903647529203634176 "Spears are so weird…"：出手前有蓄势、出手瞬间伸到目标身上，打中即停。
// 落到重甲兵（激光刀）上：
//   · 三段式时间线：蓄力（举刀后拉、拧腰、下蹲）→ 劈出（快，前跨一步、拧腰回）→ 收势回架。原来 0.25 s 一下摆完，没有蓄力、伤害在举刀那一帧就结算。
//   · 伤害改在刀落到目标的那一帧（k = 0.5）才结算，并卡帧 0.06 s（hitstop），读得出「这一刀砍中了」。
//   · 三种刀路轮换：竖劈 / 左→右横斩 / 右→左横斩，不再每刀一样。
//   · 刀光弧：劈出段画一道青白扇形残影（透明、不进渲染批）。
//   · 命中反馈：目标被沿刀向顶开 0.35 m（有盾 0.2 m）+ 一串血滴 / 激光火花朝背离攻击者方向抛出，落地即灭；砍在盾上只有火花。
import * as THREE from "three";

export const VANGUARD_MELEE = Object.freeze({
  duration: 0.42,      // 一刀总长（不含卡帧）
  windup: 0.35,        // 0–0.35 蓄力
  impact: 0.5,         // 刀落到目标
  recover: 0.62,       // 0.62 之后回架
  hitstop: 0.06,       // 命中卡帧
  lunge: 0.28,         // 前跨步（重甲兵局部单位）
  shove: 0.35,         // 目标被顶开（米）
  shoveShield: 0.2,
  styles: ["overhead", "slashLR", "slashRL"],
});

const GUARD = { x: -1.05, z: -0.18 };
// 每种刀路：蓄力姿态 → 收刀姿态（armR.rotation x/z，torso.rotation.y）
const POSE = {
  overhead: { up: { x: -2.75, z: -0.25, tw: -0.35 }, down: { x: 0.65, z: -0.1, tw: 0.4 } },
  slashLR: { up: { x: -1.55, z: -1.25, tw: -0.7 }, down: { x: -1.45, z: 0.95, tw: 0.75 } },
  slashRL: { up: { x: -1.55, z: 0.9, tw: 0.6 }, down: { x: -1.45, z: -1.3, tw: -0.7 } },
};
const ease = (a, b, k) => a + (b - a) * k;
const smooth = (k) => k * k * (3 - 2 * k);
const outQuint = (k) => 1 - Math.pow(1 - k, 5);

let _rng = 1;
const rnd = () => ((_rng = (_rng * 1664525 + 1013904223) >>> 0) / 4294967296);

/** 刀光弧几何（局部：肩高、身前）。竖劈 = 竖直扇面；横斩 = 水平扇面。 */
function makeTrail(style) {
  const vert = style === "overhead";
  const g = new THREE.RingGeometry(0.35, 1.05, 18, 1, vert ? Math.PI * 0.05 : Math.PI * 0.15, Math.PI * 0.75);
  const mat = new THREE.MeshBasicMaterial({ color: 0xbff8ff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
  const m = new THREE.Mesh(g, mat);
  m.userData.transientFx = true; m.raycast = () => {}; m.frustumCulled = false; m.renderOrder = 8;
  if (vert) { m.rotation.y = Math.PI / 2; m.position.set(-0.21, 1.05, 0.15); }           // 右肩前竖直扇面
  else { m.rotation.x = -Math.PI / 2; m.rotation.z = style === "slashLR" ? Math.PI : 0; m.position.set(0, 1.0, 0.1); }   // 腰高水平扇面
  m.visible = false;
  return m;
}

/** 火花 / 血滴粒子池（挂在 squadRoot 的父节点下，世界坐标）。 */
function sprayPool(squadRoot) {
  let pool = squadRoot.userData._meleeSpray;
  if (pool) return pool;
  const N = 240, geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(new Float32Array(N * 3), 3));
  geo.setDrawRange(0, 0);
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ size: 0.16, vertexColors: true, transparent: true, depthWrite: false, toneMapped: false }));
  pts.name = "vanguard-melee-spray"; pts.frustumCulled = false; pts.userData.transientFx = true; pts.raycast = () => {};
  (squadRoot.parent || squadRoot).add(pts);
  pool = squadRoot.userData._meleeSpray = { pts, list: [] };
  return pool;
}
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _up = new THREE.Vector3(), _side = new THREE.Vector3();

/** 命中：顶开目标 + 喷一串（朝背离攻击者方向的抛物线） */
export function meleeImpactFeel(squadRoot, tr, target, { shield = false, wounded = false, noShove = false } = {}) {
  tr.getWorldPosition(_a); target.getWorldPosition(_b);
  _up.copy(_b).normalize();
  _d.copy(_b).sub(_a); _d.addScaledVector(_up, -_d.dot(_up)); if (_d.lengthSq() < 1e-8) _d.set(1, 0, 0).addScaledVector(_up, -_up.x); _d.normalize();
  // ① 顶开（贴回球面，保持半径）
  const push = shield ? VANGUARD_MELEE.shove * (VANGUARD_MELEE.shoveShield / VANGUARD_MELEE.shove) : VANGUARD_MELEE.shove;
  if (target.parent && !noShove) {
    const r = _b.length(), w = _b.clone().addScaledVector(_d, push).setLength(r);
    target.position.copy(target.parent.worldToLocal(w));
    target.userData.meleeStaggerT = 0.3;   // 僵直（给调用方 / 动画读）
  }
  // ② 喷溅：胸口高度起，朝 _d 抛出
  const pool = sprayPool(squadRoot), origin = _b.clone().addScaledVector(_up, 1.1);
  _side.crossVectors(_up, _d).normalize();
  const n = shield ? 10 : wounded ? 14 : 9;
  for (let i = 0; i < n; i++) {
    const blood = !shield && i % 2 === 0;
    const sp = blood ? 1.6 + rnd() * 1.6 : 2.4 + rnd() * 2.6;
    const v = _d.clone().multiplyScalar(sp).addScaledVector(_side, (rnd() - 0.5) * sp * 0.9).addScaledVector(_up, 1.0 + rnd() * 1.8);
    pool.list.push({ p: origin.clone(), v, t: 0, life: blood ? 0.9 : 0.35 + rnd() * 0.2, col: blood ? [0.62, 0.06, 0.05] : shield ? [1.0, 0.7, 0.3] : [0.75, 0.97, 1.0], up: _up.clone() });
  }
  if (pool.list.length > 240) pool.list.splice(0, pool.list.length - 240);
}

export function stepVanguardMeleeSpray(squadRoot, dt) {
  const pool = squadRoot.userData._meleeSpray; if (!pool) return;
  const pos = pool.pts.geometry.attributes.position, col = pool.pts.geometry.attributes.color;
  let n = 0;
  for (const s of pool.list) {
    s.t += dt; if (s.t > s.life) continue;
    s.v.addScaledVector(s.up, -9.8 * dt); s.p.addScaledVector(s.v, dt);
    const fade = 1 - s.t / s.life;
    pos.setXYZ(n, s.p.x, s.p.y, s.p.z); col.setXYZ(n, s.col[0] * (0.5 + 0.5 * fade), s.col[1] * (0.5 + 0.5 * fade), s.col[2] * (0.5 + 0.5 * fade)); n++;
  }
  pool.list = pool.list.filter((s) => s.t <= s.life);
  // 世界坐标写进父节点局部（父节点多半是 scene，矩阵为单位阵）
  const parent = pool.pts.parent;
  if (parent && !parent.matrixWorld.equals(new THREE.Matrix4())) {
    const inv = parent.matrixWorld.clone().invert();
    for (let i = 0; i < n; i++) { _a.fromBufferAttribute(pos, i).applyMatrix4(inv); pos.setXYZ(i, _a.x, _a.y, _a.z); }
  }
  pool.pts.geometry.setDrawRange(0, n); pos.needsUpdate = true; col.needsUpdate = true;
}

/**
 * 开一刀：记目标，换刀路；伤害在 impact 那一帧由 stepVanguardSwing 回调结算。
 */
/** 刀光弧：按刀路与时间线点亮（tactics 与 updateVanguardCombat 共用）。 */
export function setVanguardTrail(tr, style, k) {
  const u = tr.userData;
  if (!u._trails) { u._trails = {}; for (const st of VANGUARD_MELEE.styles) { const m = makeTrail(st); tr.add(m); u._trails[st] = m; } }
  for (const [st, m] of Object.entries(u._trails)) {
    const on = k != null && st === style && k > VANGUARD_MELEE.windup && k < 0.8;
    m.visible = on;
    if (on) m.material.opacity = 0.75 * Math.max(0, 1 - Math.abs(k - VANGUARD_MELEE.impact) / 0.3);
  }
}
/** 下一种刀路（竖劈 → 左横 → 右横 轮换） */
export function nextVanguardStyle(tr) {
  const u = tr.userData; u._combo = ((u._combo ?? -1) + 1) % VANGUARD_MELEE.styles.length;
  return (u._swingStyle = VANGUARD_MELEE.styles[u._combo]);
}
export function beginVanguardSwing(tr, target) {
  const u = tr.userData;
  nextVanguardStyle(tr);
  u._swingAnim = 0; u._swingTarget = target; u._swingImpacted = false; u._hitstop = 0;
}

/**
 * 每帧推进刀的姿态；到 impact 帧调用 onImpact(target)（返回 {shield, wounded}），并卡帧。
 * 无刀时回架。返回本帧是否出手结算。
 */
export function stepVanguardSwing(squadRoot, tr, dt, onImpact) {
  const u = tr.userData, P = u.parts || {};
  const armR = P.armR, torso = P.torso, fig = P.fig, legL = P.legL, legR = P.legR;
  let impacted = false;
  const anim = u._swingAnim;
  if (anim !== undefined && anim < 1) {
    if (u._hitstop > 0) { u._hitstop -= dt; }    // 卡帧：姿态停在砍中那一下
    else u._swingAnim = Math.min(1, anim + dt / VANGUARD_MELEE.duration);
    const k = u._swingAnim, pose = POSE[u._swingStyle] || POSE.overhead;
    let ax, az, tw, lunge;
    if (k < VANGUARD_MELEE.windup) {                       // 蓄力：慢起
      const e = smooth(k / VANGUARD_MELEE.windup);
      ax = ease(GUARD.x, pose.up.x, e); az = ease(GUARD.z, pose.up.z, e); tw = ease(0, pose.up.tw, e); lunge = -0.06 * e;
    } else if (k < VANGUARD_MELEE.recover) {               // 劈出：快落（outQuint）
      const e = outQuint((k - VANGUARD_MELEE.windup) / (VANGUARD_MELEE.recover - VANGUARD_MELEE.windup));
      ax = ease(pose.up.x, pose.down.x, e); az = ease(pose.up.z, pose.down.z, e); tw = ease(pose.up.tw, pose.down.tw, e); lunge = ease(-0.06, VANGUARD_MELEE.lunge, e);
    } else {                                                // 收势回架
      const e = smooth((k - VANGUARD_MELEE.recover) / (1 - VANGUARD_MELEE.recover));
      ax = ease(pose.down.x, GUARD.x, e); az = ease(pose.down.z, GUARD.z, e); tw = ease(pose.down.tw, 0, e); lunge = ease(VANGUARD_MELEE.lunge, 0, e);
    }
    if (armR) { armR.rotation.x = ax; armR.rotation.z = az; }
    if (torso) torso.rotation.y = tw;
    if (fig) { fig.position.z = lunge; fig.position.y = -0.08 * Math.sin(Math.min(1, k / VANGUARD_MELEE.recover) * Math.PI); }   // 前跨 + 下沉
    if (legL) legL.rotation.x = -0.9 * Math.max(0, lunge);   // 左腿前弓
    if (legR) legR.rotation.x = 0.6 * Math.max(0, lunge);    // 右腿后蹬
    // 刀光：劈出段亮，砍中后 0.15 内淡掉
    setVanguardTrail(tr, u._swingStyle, k);
    if (!u._swingImpacted && k >= VANGUARD_MELEE.impact) {
      u._swingImpacted = true; impacted = true;
      const target = u._swingTarget;
      if (target?.parent && !target.userData?.dead) {
        const r = onImpact?.(target) || {};
        if (r.landed !== false) { meleeImpactFeel(squadRoot, tr, target, r); u._hitstop = VANGUARD_MELEE.hitstop; }
      }
    }
  } else {
    if (armR) { armR.rotation.x += (GUARD.x - armR.rotation.x) * Math.min(1, dt * 8); armR.rotation.z += (GUARD.z - armR.rotation.z) * Math.min(1, dt * 8); }
    if (torso) torso.rotation.y += (0 - torso.rotation.y) * Math.min(1, dt * 6);
    if (fig) { fig.position.z += (0 - fig.position.z) * Math.min(1, dt * 8); fig.position.y += (0 - fig.position.y) * Math.min(1, dt * 8); }
    setVanguardTrail(tr, null, null);
  }
  return impacted;
}

/**
 * 优化骨架（assets/vanguardOptimizedRig.js，Blender IK）用的刀路关键姿态：
 * 返回右手目标点 / 刀身轴（重甲兵局部，肩在 (-0.21,1.12,0)）+ 整身下沉 / 前倾 / 前跨 / 拧腰。
 * 和上面非优化骨架的三段时间线同一套 k（0 蓄力 → 0.35 劈出 → 0.62 收势 → 1 回架）。
 */
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const GUARD_RIG = { hand: V3(-0.34, 0.765, 0.22), axis: V3(0.02, -0.925, 0.38) };
const RIG = {
  overhead: { up: { hand: V3(-0.24, 1.58, -0.06), axis: V3(0, 0.74, -0.67), tw: -0.25 }, down: { hand: V3(-0.16, 0.74, 0.56), axis: V3(0.05, -0.55, 0.83), tw: 0.3 } },
  slashLR: { up: { hand: V3(-0.58, 1.16, 0.02), axis: V3(-0.86, 0.34, -0.38), tw: -0.55 }, down: { hand: V3(0.36, 1.0, 0.44), axis: V3(0.8, -0.15, 0.58), tw: 0.55 } },
  slashRL: { up: { hand: V3(0.22, 1.22, 0.3), axis: V3(0.86, 0.38, 0.33), tw: 0.5 }, down: { hand: V3(-0.6, 0.95, 0.36), axis: V3(-0.85, -0.2, 0.46), tw: -0.55 } },
};
export function meleeRigPose(style, k) {
  const R = RIG[style] || RIG.overhead, M = VANGUARD_MELEE;
  let a, b, e, drop, lean, lunge;
  if (k < M.windup) { e = smooth(k / M.windup); a = { ...GUARD_RIG, tw: 0 }; b = R.up; drop = -0.03 * e; lean = -0.08 * e; lunge = -0.05 * e; }
  else if (k < M.recover) { e = outQuint((k - M.windup) / (M.recover - M.windup)); a = R.up; b = R.down; drop = ease(-0.03, -0.07, e); lean = ease(-0.08, 0.16, e); lunge = ease(-0.05, M.lunge, e); }
  else { e = smooth((k - M.recover) / (1 - M.recover)); a = R.down; b = { ...GUARD_RIG, tw: 0 }; drop = ease(-0.07, 0, e); lean = ease(0.16, 0, e); lunge = ease(M.lunge, 0, e); }
  return {
    hand: a.hand.clone().lerp(b.hand, e), axis: a.axis.clone().lerp(b.axis, e).normalize(),
    twist: ease(a.tw, b.tw, e), drop, lean, lunge, bend: 0.08 + Math.max(0, lunge) * 0.9,
  };
}
