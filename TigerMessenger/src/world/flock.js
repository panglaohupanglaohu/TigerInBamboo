// =====================================================================
//  FlockManager · Boids 鸟群系统（低多边形手绘风群飞鸟群）
//  - Boids 三大定律：Separation 分离 / Alignment 对齐 / Cohesion 凝聚
//    （Reynolds 转向力：desired − velocity，每帧速度向量绝不随机、绝不直线）
//  - createLowPolyBird：五棱锥身体（头大身尖、向后收尖）+ 细长三角薄壳双翼，
//    身体与双翼严格调用 addOutline() 套手绘黑墨线
//  - 带随机相位差的正弦扑翅：rotation.z = ±sin(time * 12 + phaseOffset) * 0.6
//  - 球心重力锁：活动高度带锁死在表面上空 35–45，越界速度向量回弹
//  - 晶塔避障：过于靠近莫比斯水晶尖塔立即反转向量，绕塔身漩涡滑行
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline, INK_COLOR } from "../assets/toon.js";
import { sedateBirdRecord, tickBirdSedation, TRANQ_DURATION_BIRD } from "./tranquilizer.js";

// ---------- Boids 三大定律调参 ----------
const NEIGHBOR_RADIUS = 6; // 邻居感知半径（规格：6 单位内）
const NEIGHBOR_RADIUS_SQ = NEIGHBOR_RADIUS * NEIGHBOR_RADIUS;
const SEPARATION_RADIUS = 1.5; // 低于此距离产生反向排斥（规格：防穿模）
const SEPARATION_RADIUS_SQ = SEPARATION_RADIUS * SEPARATION_RADIUS;
const SEP_WEIGHT = 9.5; // 分离力权重（最强，保证绝不互相撞击）
const ALI_WEIGHT = 2.2; // 对齐力权重（统一风向，平滑转身）
const COH_WEIGHT = 1.5; // 凝聚力权重（抱团，忽开忽合）
const MAX_FORCE = 16; // 单帧转向加速度上限
const MIN_SPEED = 2.6; // 永不失速（低速兜底，保持灵动）
const MAX_SPEED = 6.4;
const HARD_PUSH_DIST = 0.72; // 积分后位置硬分离：绝对不穿模的最后兜底

// ---------- 球面边界 · 莫比斯高空安全区 ----------
const ALT_MIN = 35; // 活动带下界：表面上空高度（规格 radius 35）
const ALT_MAX = 45; // 活动带上界（规格 radius 45）
const BAND_SPRING = 0.38; // 球心重力锁：朝带心高度的弱弹簧
const BAND_EDGE = 3; // 接近带上下缘的软推区
const BAND_EDGE_FORCE = 2.4;
const BAND_HARD = 1.2; // 超出硬界 → 径向速度回弹
const HOME_RADIUS = 26; // 水平漫游半径（防飞出地图）
const HOME_WEIGHT = 0.55;
const WIND_WEIGHT = 0.55; // 峡谷顺风向导引（对齐力的"大方向"）

// ---------- 莫比斯晶塔避障 ----------
const AVOID_MARGIN = 2.6; // 避障缓冲带
const AVOID_FORCE = 26; // 逃离转向强度
const AVOID_RADIUS_K = 0.6; // 障碍有效半径系数（略收窄，允许鸟群穿缝隙）
const AVOID_FLIP_DIST = 0.9; // 距有效半径再近这么多 → 速度向量反向

// ---------- 扑翅（规格公式） ----------
const FLAP_SPEED = 12;
const FLAP_AMP = 0.6;

/** 消光橙 / 浅乳白 双色交替 */
const BIRD_COLORS = [0xe67e22, 0xf5ead2];

// ---------- 模块级临时向量（避免每帧分配） ----------
const _sep = new THREE.Vector3();
const _ali = new THREE.Vector3();
const _coh = new THREE.Vector3();
const _steer = new THREE.Vector3();
const _force = new THREE.Vector3();
const _diff = new THREE.Vector3();
const _home = new THREE.Vector3();
const _radial = new THREE.Vector3();
const _axisA = new THREE.Vector3();
const _rel = new THREE.Vector3();
const _closest = new THREE.Vector3();
const _away = new THREE.Vector3();
const _swirl = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _cross = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _corO = new THREE.Vector3();
const _corR = new THREE.Vector3();
const _corU = new THREE.Vector3();
const _corF = new THREE.Vector3();
const _corRel = new THREE.Vector3();

function clampLen(v, max) {
  const l = v.length();
  if (l > max) v.multiplyScalar(max / l);
  return v;
}

/**
 * 莫比斯晶塔柱体避障（峡谷鸟群 / 航空艇伴飞鸟群共用）：
 * 对每根塔柱轴段取最近点 → 施加逃离转向；过于贴近时立即反转速度向量，
 * 叠加切向漩涡让鸟群绕阳台栏杆 / 高架桥缝隙滑行闪烁过去。
 * @param {THREE.Vector3} pos 当前位置（只读）
 * @param {THREE.Vector3} vel 速度向量（贴近时会被反向/加漩涡）
 * @param {THREE.Vector3} force 力累积器（逃离转向写入）
 * @param {{ dir: THREE.Vector3, root: number, h: number, r: number }[]} obstacles
 * @param {THREE.Vector3} radialDir 当前位置的球面径向单位向量
 */
export function avoidCrystalPillars(pos, vel, force, obstacles, radialDir) {
  for (const o of obstacles) {
    const effR = o.r * AVOID_RADIUS_K;
    // 塔柱轴段：A = dir·root → B = dir·(root+h)
    _axisA.copy(o.dir).multiplyScalar(o.root);
    const tAlong = THREE.MathUtils.clamp(_rel.copy(pos).sub(_axisA).dot(o.dir), 0, o.h);
    _closest.copy(o.dir).multiplyScalar(o.root + tAlong);
    _away.copy(pos).sub(_closest);
    const dist = _away.length();
    const safe = effR + AVOID_MARGIN;
    if (dist >= safe || dist < 1e-6) continue;
    _away.divideScalar(dist);
    force.addScaledVector(_away, (1 - dist / safe) * AVOID_FORCE);
    if (dist < effR + AVOID_FLIP_DIST) {
      // 过于靠近：速度向量立即反向 + 切向漩涡，绕塔身滑行
      const vn = vel.dot(_away);
      if (vn < 0) vel.addScaledVector(_away, -vn * 1.9);
      _swirl.crossVectors(radialDir, _away);
      if (_swirl.lengthSq() > 1e-8) vel.addScaledVector(_swirl.normalize(), 2.4);
    }
  }
}

// ---------------------------------------------------------------------------
//  低多边形手绘小鸟
//  局部约定：前进 = +Z（与 Object3D.lookAt 一致），上 = +Y，左翼 = +X。
//  翼展沿 X 轴 → 绕 Z 轴的 rotation.z 正好驱动翼尖上下扑打。
// ---------------------------------------------------------------------------

/** 细长三角翼（Shape 挤出成薄壳，法线完整，反向壳描边才能外扩出墨线） */
function makeWingGeometry(side /* 1 = 左翼(+X)，-1 = 右翼(-X) */) {
  const s = new THREE.Shape();
  s.moveTo(0.06 * side, 0.3); // 翼根前缘
  s.lineTo(0.06 * side, -0.44); // 翼根后缘
  s.lineTo(1.06 * side, -0.05); // 翼尖（微后掠）
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.024, bevelEnabled: false });
  geo.rotateX(Math.PI / 2); // 挤出方向 +Z → −Y；弦向 Y → +Z（朝前）
  geo.translate(0, 0.012, 0); // 厚度居中
  geo.computeVertexNormals();
  return geo;
}

function createBirdGeometries() {
  // 身体：极扁五棱锥，锥尖 = 尾（向后收尖），宽底 = 头（头大），前进 +Z
  const body = new THREE.ConeGeometry(0.3, 0.95, 5);
  body.rotateX(-Math.PI / 2); // 锥尖 +Y → −Z
  const wingL = makeWingGeometry(1);
  const wingR = makeWingGeometry(-1);
  return { body, wingL, wingR };
}

/**
 * 实时拼接的极简低多边形小鸟：
 * 五棱锥身体 + 左右三角薄翼，全部 addOutline() 手绘黑墨线。
 * @param {number} [color] 消光橙 / 浅乳白
 * @param {{ body: THREE.BufferGeometry, wingL: THREE.BufferGeometry, wingR: THREE.BufferGeometry }} [geos]
 *   共享几何体（FlockManager 内部传入，避免 18 份重复）
 */
export function createLowPolyBird(color = BIRD_COLORS[0], geos = createBirdGeometries()) {
  const bird = new THREE.Group();
  bird.name = "flock-bird";
  const mat = toonMat(color); // 2 阶梯 Cel = 干净消光

  const body = new THREE.Mesh(geos.body, mat);
  body.scale.set(0.8, 0.5, 1); // 极扁
  addOutline(body, 0.015, INK_COLOR, 0.04);
  bird.add(body);

  const wingL = new THREE.Mesh(geos.wingL, mat);
  const wingR = new THREE.Mesh(geos.wingR, mat);
  addOutline(wingL, 0.015, INK_COLOR, 0.04);
  addOutline(wingR, 0.015, INK_COLOR, 0.04);

  // model 子层承载侧倾（banking）：外层 Group 的四元数只管朝向，互不污染
  const model = new THREE.Group();
  model.add(body, wingL, wingR);
  bird.add(model);

  bird.userData.model = model;
  bird.userData.wingL = wingL;
  bird.userData.wingR = wingR;
  return bird;
}

// ---------------------------------------------------------------------------
//  FlockManager
// ---------------------------------------------------------------------------

export class FlockManager {
  /**
   * @param {THREE.Scene} scene
   * @param {{
   *   count?: number,
   *   planetRadius?: number,
   *   centerDir?: THREE.Vector3,          // 活动中心（单位球面方向）
   *   windDir?: THREE.Vector3,            // 顺风大方向（缺省 = centerDir 的纬线切向）
   *   obstacles?: { dir: THREE.Vector3, root: number, h: number, r: number }[],
   *   altMin?: number, altMax?: number,   // 表面上空活动高度带（默认 35–45）
   *   homeRadius?: number,                // 家域漫游半径（默认 26；楼顶空域等小场景调小）
   *   homeWeight?: number,                // 家域回拉弹簧强度（默认 0.5；小空域调大收紧）
   * }?} opts
   */
  constructor(scene, opts = {}) {
    const {
      count = 18,
      planetRadius = 40,
      centerDir = new THREE.Vector3(0, 1, 0),
      windDir = null,
      obstacles = [],
      altMin = ALT_MIN,
      altMax = ALT_MAX,
      homeRadius = HOME_RADIUS,
      homeWeight = HOME_WEIGHT,
    } = opts;
    this.homeRadius = homeRadius;
    this.homeWeight = homeWeight;
    /** @type {null | {
     *   origin: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3, forward: THREE.Vector3,
     *   halfWidth: number, halfLength: number, yMin: number, yMax: number,
     *   cloudCeilY?: number
     * }} */
    this.corridor = null;

    this.scene = scene;
    this.R = planetRadius;
    this.rMin = planetRadius + altMin;
    this.rMax = planetRadius + altMax;
    this.rMid = (this.rMin + this.rMax) / 2;

    const center = centerDir.clone().normalize();
    this.centerDir = center;
    this.home = center.clone().multiplyScalar(this.rMid);
    // 顺风 = 活动中心处的纬线切向（沿大峡谷吹）
    this.wind =
      windDir && windDir.lengthSq() > 1e-8
        ? windDir.clone().normalize()
        : new THREE.Vector3(0, 1, 0).cross(center).normalize();
    // 晶塔障碍柱：{ dir, root, h, r }
    this.obstacles = obstacles.map((o) => ({
      dir: o.dir.clone().normalize(),
      root: o.root,
      h: o.h,
      r: o.r,
    }));

    this.geos = createBirdGeometries();
    this.root = new THREE.Group();
    this.root.name = "flock-root";
    scene.add(this.root);

    /** @type {{ group: THREE.Group, wingL: THREE.Mesh, wingR: THREE.Mesh, vel: THREE.Vector3, phaseOffset: number, maxSpeed: number, bank: number, prevTan: THREE.Vector3 }[]} */
    this.birds = [];
    for (let i = 0; i < count; i++) {
      const bird = createLowPolyBird(BIRD_COLORS[i % BIRD_COLORS.length], this.geos);
      bird.scale.setScalar(0.85 + Math.random() * 0.4);
      this.root.add(bird);

      this.birds.push({
        group: bird,
        model: bird.userData.model,
        wingL: bird.userData.wingL,
        wingR: bird.userData.wingR,
        vel: new THREE.Vector3(),
        phaseOffset: Math.random() * Math.PI * 2, // 随机相位偏置：扑翅参差有灵气
        maxSpeed: MAX_SPEED * (0.9 + Math.random() * 0.25),
        bank: 0,
        prevTan: new THREE.Vector3(1, 0, 0),
      });
    }
    // 出生散布到家域
    this._scatterNearHome();
  }

  /**
   * 迁移家域：用于把峡谷/城周鸟群整群搬到新地标（如叹息之门城头）。
   * @param {THREE.Vector3} centerDir 单位球面方向
   * @param {{
   *   altMin?: number, altMax?: number,
   *   windDir?: THREE.Vector3|null,
   *   homeRadius?: number, homeWeight?: number,
   *   obstacles?: { dir: THREE.Vector3, root: number, h: number, r: number }[],
   *   corridor?: {
   *     origin: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3, forward: THREE.Vector3,
   *     halfWidth: number, halfLength: number, yMin: number, yMax: number, cloudCeilY?: number
   *   }|null,
   *   respawn?: boolean,
   * }} [opts]
   */
  setHome(centerDir, opts = {}) {
    if (!centerDir || centerDir.lengthSq() < 1e-10) return this;
    const center = centerDir.clone().normalize();
    this.centerDir = center;
    if (Number.isFinite(opts.altMin) || Number.isFinite(opts.altMax)) {
      const a0 = Number.isFinite(opts.altMin) ? opts.altMin : this.rMin - this.R;
      const a1 = Number.isFinite(opts.altMax) ? opts.altMax : this.rMax - this.R;
      this.rMin = this.R + Math.min(a0, a1);
      this.rMax = this.R + Math.max(a0, a1);
      this.rMid = (this.rMin + this.rMax) / 2;
    }
    this.home.copy(center).multiplyScalar(this.rMid);
    if (opts.windDir && opts.windDir.lengthSq() > 1e-8) {
      this.wind.copy(opts.windDir).normalize();
    } else {
      this.wind.set(0, 1, 0).cross(center);
      if (this.wind.lengthSq() < 1e-8) this.wind.set(1, 0, 0).cross(center);
      this.wind.normalize();
    }
    if (Number.isFinite(opts.homeRadius)) this.homeRadius = opts.homeRadius;
    if (Number.isFinite(opts.homeWeight)) this.homeWeight = opts.homeWeight;
    if (Array.isArray(opts.obstacles)) {
      this.obstacles = opts.obstacles.map((o) => ({
        dir: o.dir.clone().normalize(),
        root: o.root,
        h: o.h,
        r: o.r,
      }));
    }
    if (opts.corridor !== undefined) {
      this.setCorridor(opts.corridor);
    }
    if (opts.respawn !== false) this._scatterNearHome();
    return this;
  }

  /**
   * 门廊走廊：鸟只在三重门夹道内穿行（宽/高/沿轨长），并硬限云墙高度以下。
   * 坐标系与 abandonedGate seatRoot 一致：+X 右、+Y 上、+Z 前进。
   * @param {null | {
   *   origin: THREE.Vector3, right: THREE.Vector3, up: THREE.Vector3, forward: THREE.Vector3,
   *   halfWidth: number, halfLength: number, yMin: number, yMax: number, cloudCeilY?: number
   * }} corridor
   */
  setCorridor(corridor) {
    if (!corridor) {
      this.corridor = null;
      return this;
    }
    const yMin = Number(corridor.yMin) || 0;
    let yMax = Number(corridor.yMax) || 12;
    // 云墙底缘（默认 wallTop≈44）以下留安全距
    const cloudCeil =
      Number.isFinite(corridor.cloudCeilY) ? corridor.cloudCeilY : yMax;
    yMax = Math.min(yMax, cloudCeil - 0.5);
    this.corridor = {
      origin: corridor.origin.clone(),
      right: corridor.right.clone().normalize(),
      up: corridor.up.clone().normalize(),
      forward: corridor.forward.clone().normalize(),
      halfWidth: Math.max(0.8, Number(corridor.halfWidth) || 3),
      halfLength: Math.max(2, Number(corridor.halfLength) || 16),
      yMin,
      yMax: Math.max(yMin + 0.5, yMax),
      cloudCeilY: cloudCeil,
    };
    // 家域中心改到走廊中点高度
    const midY = (this.corridor.yMin + this.corridor.yMax) * 0.5;
    this.home
      .copy(this.corridor.origin)
      .addScaledVector(this.corridor.up, midY);
    // 高度带与走廊对齐（径向近似）
    const baseR = this.corridor.origin.length();
    this.rMin = baseR + this.corridor.yMin - 0.4;
    this.rMax = baseR + this.corridor.yMax + 0.4;
    this.rMid = (this.rMin + this.rMax) / 2;
    this.wind.copy(this.corridor.forward);
    return this;
  }

  /** 在当前 home / 走廊内散布，初速顺风 */
  _scatterNearHome() {
    const cor = this.corridor;
    if (cor) {
      for (let i = 0; i < this.birds.length; i++) {
        const b = this.birds[i];
        const lx = (Math.random() - 0.5) * 2 * cor.halfWidth * 0.75;
        const ly =
          cor.yMin +
          Math.random() * Math.max(0.2, cor.yMax - cor.yMin) * 0.9 +
          (cor.yMax - cor.yMin) * 0.05;
        // 沿轨：偏向前半，便于穿三重门
        const lz = (Math.random() - 0.5) * 2 * cor.halfLength * 0.85;
        b.group.position
          .copy(cor.origin)
          .addScaledVector(cor.right, lx)
          .addScaledVector(cor.up, ly)
          .addScaledVector(cor.forward, lz);
        b.vel
          .copy(this.wind)
          .multiplyScalar(2.8 + Math.random() * 1.8)
          .addScaledVector(cor.right, (Math.random() - 0.5) * 1.2)
          .addScaledVector(cor.up, (Math.random() - 0.5) * 0.6);
        b.prevTan.copy(b.vel);
        b.bank = 0;
      }
      return;
    }
    const center = this.centerDir;
    const t1 = new THREE.Vector3(0, 1, 0).cross(center);
    if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
    t1.normalize();
    const t2 = new THREE.Vector3().crossVectors(center, t1).normalize();
    const spread = Math.min(12, Math.max(4, this.homeRadius * 0.55));
    for (let i = 0; i < this.birds.length; i++) {
      const b = this.birds[i];
      b.group.position
        .copy(this.home)
        .addScaledVector(t1, (Math.random() - 0.5) * spread)
        .addScaledVector(t2, (Math.random() - 0.5) * spread)
        .addScaledVector(center, (Math.random() - 0.5) * (this.rMax - this.rMin) * 0.4);
      b.vel
        .copy(this.wind)
        .multiplyScalar(2.6 + Math.random() * 1.6)
        .addScaledVector(t1, (Math.random() - 0.5) * 2)
        .addScaledVector(t2, (Math.random() - 0.5) * 2);
      b.prevTan.copy(b.vel);
      b.bank = 0;
    }
  }

  /**
   * 走廊软约束 + 云墙硬顶：把鸟压回三重门夹道。
   * @param {THREE.Vector3} pos
   * @param {THREE.Vector3} vel
   * @param {THREE.Vector3} force
   */
  _applyCorridor(pos, vel, force) {
    const c = this.corridor;
    if (!c) return;
    _corRel.copy(pos).sub(c.origin);
    const lx = _corRel.dot(c.right);
    const ly = _corRel.dot(c.up);
    const lz = _corRel.dot(c.forward);

    const hw = c.halfWidth;
    const hl = c.halfLength;
    // 横向：超出夹道 → 强推回（双子塔之间）
    if (Math.abs(lx) > hw * 0.82) {
      const over = Math.abs(lx) - hw * 0.82;
      force.addScaledVector(c.right, -Math.sign(lx) * over * 14);
      const vr = vel.dot(c.right);
      if (vr * lx > 0) vel.addScaledVector(c.right, -vr * 0.85);
    }
    // 沿轨：门廊前后环回拉力
    if (Math.abs(lz) > hl * 0.9) {
      const over = Math.abs(lz) - hl * 0.9;
      force.addScaledVector(c.forward, -Math.sign(lz) * over * 8);
    }
    // 高度：券洞带内；接近云墙硬顶则强下压
    if (ly < c.yMin + 0.4) {
      force.addScaledVector(c.up, (c.yMin + 0.4 - ly) * 12);
    }
    if (ly > c.yMax - 0.5) {
      force.addScaledVector(c.up, -(ly - (c.yMax - 0.5)) * 18);
      const vu = vel.dot(c.up);
      if (vu > 0) vel.addScaledVector(c.up, -vu * 1.2);
    }
    // 云墙禁飞：本地 Y 或径向高度任一触顶都压下
    const cloudY = c.cloudCeilY ?? c.yMax;
    if (ly > cloudY - 1.2) {
      force.addScaledVector(c.up, -(ly - (cloudY - 1.2)) * 28);
      const vu = vel.dot(c.up);
      if (vu > 0) vel.addScaledVector(c.up, -vu * 1.6);
    }
  }

  /** 积分后硬夹在走廊盒内（绝不钻进云墙） */
  _clampToCorridor(pos, vel) {
    const c = this.corridor;
    if (!c) return;
    _corRel.copy(pos).sub(c.origin);
    let lx = _corRel.dot(c.right);
    let ly = _corRel.dot(c.up);
    let lz = _corRel.dot(c.forward);
    const cloudY = c.cloudCeilY ?? c.yMax;
    const yHi = Math.min(c.yMax, cloudY - 0.8);
    const nx = THREE.MathUtils.clamp(lx, -c.halfWidth, c.halfWidth);
    const ny = THREE.MathUtils.clamp(ly, c.yMin, yHi);
    const nz = THREE.MathUtils.clamp(lz, -c.halfLength, c.halfLength);
    if (nx !== lx || ny !== ly || nz !== lz) {
      pos
        .copy(c.origin)
        .addScaledVector(c.right, nx)
        .addScaledVector(c.up, ny)
        .addScaledVector(c.forward, nz);
      // 撞壁速度阻尼
      if (nx !== lx) {
        const vr = vel.dot(c.right);
        if (vr * lx > 0) vel.addScaledVector(c.right, -vr);
      }
      if (ny !== ly) {
        const vu = vel.dot(c.up);
        if ((ny <= c.yMin && vu < 0) || (ny >= yHi && vu > 0)) {
          vel.addScaledVector(c.up, -vu);
        }
      }
      if (nz !== lz) {
        const vf = vel.dot(c.forward);
        if (vf * lz > 0) vel.addScaledVector(c.forward, -vf * 0.5);
      }
    }
  }

  /**
   * 每帧驱动：Boids 三大定律 → 边界/避障 → 积分 → 硬分离 → 朝向/侧倾/扑翅
   * @param {number} dt
   * @param {number} t 全局时间（秒）
   */
  /**
   * 麻醉弹命中：坠落贴地，duration 秒后苏醒。
   * @returns {{ kind: 'object', object: THREE.Object3D, duration: number }|null}
   */
  sedateNearest(worldPos, radius = 2.4, duration = TRANQ_DURATION_BIRD) {
    if (!worldPos) return null;
    const r2 = radius * radius;
    let best = null;
    let bestD = r2;
    for (const b of this.birds) {
      if ((b.sedateT ?? 0) > 0) continue;
      const d = b.group.position.distanceToSquared(worldPos);
      if (d < bestD) {
        bestD = d;
        best = b;
      }
    }
    if (!best || !sedateBirdRecord(best, duration)) return null;
    return { kind: "object", object: best.group, duration };
  }

  update(dt, t) {
    if (!dt || dt <= 0) return;
    dt = Math.min(dt, 0.05);
    const n = this.birds.length;
    if (!n) return;

    const groundR = this.R + 0.45;

    for (let i = 0; i < n; i++) {
      const b = this.birds[i];
      // 麻醉中：坠落，跳过 Boids
      if (tickBirdSedation(b, dt, groundR)) continue;
      const pos = b.group.position;

      // ================= Boids 三大定律 =================
      _sep.set(0, 0, 0);
      _ali.set(0, 0, 0);
      _coh.set(0, 0, 0);
      let nNear = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const other = this.birds[j];
        const dSq = pos.distanceToSquared(other.group.position);
        if (dSq > NEIGHBOR_RADIUS_SQ || dSq < 1e-8) continue;
        // 对齐：邻居平均速度方向；凝聚：邻居几何中心
        _ali.add(other.vel);
        _coh.add(other.group.position);
        nNear++;
        // 分离：太近 → 反向排斥，越近越强（1/d 加权）
        if (dSq < SEPARATION_RADIUS_SQ) {
          const d = Math.sqrt(dSq);
          _sep.addScaledVector(
            _diff.copy(pos).sub(other.group.position).divideScalar(d),
            1 / Math.max(d, 0.08)
          );
        }
      }

      _force.set(0, 0, 0);

      // 1) Separation —— 避免穿模（最强）
      if (_sep.lengthSq() > 1e-8) {
        _steer.copy(_sep).normalize().multiplyScalar(b.maxSpeed).sub(b.vel);
        _force.addScaledVector(clampLen(_steer, MAX_FORCE), SEP_WEIGHT);
      }
      if (nNear > 0) {
        // 2) Alignment —— 统一风向，平滑转身
        if (_ali.lengthSq() > 1e-8) {
          _steer.copy(_ali).divideScalar(nNear).normalize().multiplyScalar(b.maxSpeed).sub(b.vel);
          _force.addScaledVector(clampLen(_steer, MAX_FORCE), ALI_WEIGHT);
        }
        // 3) Cohesion —— 向邻居质心吸引，抱团忽开忽合
        _steer.copy(_coh).divideScalar(nNear).sub(pos);
        if (_steer.lengthSq() > 1e-6) {
          _steer.normalize().multiplyScalar(b.maxSpeed * 0.85).sub(b.vel);
          _force.addScaledVector(clampLen(_steer, MAX_FORCE), COH_WEIGHT);
        }
      }

      // 顺峡谷风：给对齐一个恒定的"大方向"
      _force.addScaledVector(this.wind, WIND_WEIGHT);

      // 家域回拉：防飞出地图；越远弹簧越陡，防个别鸟被避障反弹甩远
      _home.copy(this.home).sub(pos);
      const homeDist = _home.length();
      if (homeDist > this.homeRadius) {
        const over = homeDist - this.homeRadius;
        _force.addScaledVector(
          _home.normalize(),
          over * this.homeWeight * (1 + over * 0.08)
        );
      }

      // ================= 球心重力锁 · 高度带 =================
      const r = pos.length();
      _radial.copy(pos).divideScalar(Math.max(r, 1e-6));
      _force.addScaledVector(_radial, (this.rMid - r) * BAND_SPRING);
      if (r > this.rMax - BAND_EDGE) {
        _force.addScaledVector(_radial, -(r - (this.rMax - BAND_EDGE)) * BAND_EDGE_FORCE);
      } else if (r < this.rMin + BAND_EDGE) {
        _force.addScaledVector(_radial, (this.rMin + BAND_EDGE - r) * BAND_EDGE_FORCE);
      }

      // ================= 莫比斯晶塔避障（共享逻辑） =================
      avoidCrystalPillars(pos, b.vel, _force, this.obstacles, _radial);

      // ================= 三重门走廊 / 云墙禁飞 =================
      this._applyCorridor(pos, b.vel, _force);

      // ================= 积分 + 限速 =================
      b.vel.addScaledVector(_force, dt);
      const sp = b.vel.length();
      if (sp > b.maxSpeed) b.vel.multiplyScalar(b.maxSpeed / sp);
      else if (sp < MIN_SPEED) {
        if (sp > 1e-5) b.vel.multiplyScalar(MIN_SPEED / sp);
        else b.vel.copy(this.wind).multiplyScalar(MIN_SPEED);
      }
      pos.addScaledVector(b.vel, dt);

      // 越界回弹：超出高度带硬界 → 径向速度反向（带阻尼）
      const r2 = pos.length();
      if (r2 > this.rMax + BAND_HARD || r2 < this.rMin - BAND_HARD) {
        _radial.copy(pos).divideScalar(Math.max(r2, 1e-6));
        const vr = b.vel.dot(_radial);
        if ((r2 > this.rMax && vr > 0) || (r2 < this.rMin && vr < 0)) {
          b.vel.addScaledVector(_radial, -vr * 1.6);
        }
        pos.copy(_radial).multiplyScalar(
          THREE.MathUtils.clamp(r2, this.rMin - BAND_HARD, this.rMax + BAND_HARD)
        );
        // 回弹阻尼可能跌破失速线 → 立即补回最低速度
        const sp2 = b.vel.length();
        if (sp2 < MIN_SPEED && sp2 > 1e-5) b.vel.multiplyScalar(MIN_SPEED / sp2);
      }
      // 走廊硬夹：绝不钻进云墙 / 双子塔墙体
      this._clampToCorridor(pos, b.vel);
    }

    // ================= 硬分离兜底：绝对不穿模 =================
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const pa = this.birds[i].group.position;
        const pb = this.birds[j].group.position;
        const dSq = pa.distanceToSquared(pb);
        if (dSq >= HARD_PUSH_DIST * HARD_PUSH_DIST || dSq < 1e-8) continue;
        const d = Math.sqrt(dSq);
        _diff.copy(pa).sub(pb).divideScalar(d);
        const push = (HARD_PUSH_DIST - d) * 0.5;
        pa.addScaledVector(_diff, push);
        pb.addScaledVector(_diff, -push);
      }
    }

    // ================= 朝向 / 侧倾 / 扑翅 =================
    for (let i = 0; i < n; i++) {
      const b = this.birds[i];
      if ((b.sedateT ?? 0) > 0) continue;
      const pos = b.group.position;

      // 朝向：沿速度方向平滑转向（up = 球面径向 = 本地天顶）
      // 鸟身体锥尖（头）在局部 -Z；Matrix4.lookAt 的 -Z 指向 (target - eye)，
      // 故 eye=原点、target=速度方向 → -Z 指向 _fwd，鸟头（尖处）朝前主飞。
      if (b.vel.lengthSq() > 0.09) {
        _up.copy(pos).normalize();
        _fwd.copy(b.vel).normalize();
        if (Math.abs(_fwd.dot(_up)) < 0.99) {
          _m4.lookAt(_origin, _fwd, _up); // 修正：鸟头(-Z) → 速度方向
          _q.setFromRotationMatrix(_m4);
          b.group.quaternion.slerp(_q, 1 - Math.exp(-6.5 * dt));
        }
      }

      // 侧倾：水平转弯时向弯内压坡度（更灵动）
      _up.copy(pos).normalize();
      _tan.copy(b.vel).addScaledVector(_up, -b.vel.dot(_up));
      const turnSign = _cross.crossVectors(b.prevTan, _tan).dot(_up);
      const bankTarget = THREE.MathUtils.clamp(
        (turnSign * 2.4) / (_tan.lengthSq() + 0.6),
        -0.55,
        0.55
      );
      b.bank += (bankTarget - b.bank) * Math.min(1, dt * 5);
      b.model.rotation.z = b.bank; // 侧倾只作用于 model 子层（绕前进轴）
      b.prevTan.copy(_tan);

      // 正弦双翼扑打：随机相位差，左右相反（规格公式）
      const flap = Math.sin(t * FLAP_SPEED + b.phaseOffset) * FLAP_AMP;
      b.wingL.rotation.z = flap;
      b.wingR.rotation.z = -flap;
    }
  }

  dispose() {
    if (this.root.parent) this.root.parent.remove(this.root);
    this.root.traverse((o) => {
      // 描边材质为全局缓存，不可销毁；几何体由 this.geos 统一回收
      if (o.isMesh && !o.userData.isOutline) o.material.dispose();
    });
    this.geos.body.dispose();
    this.geos.wingL.dispose();
    this.geos.wingR.dispose();
    this.birds.length = 0;
  }
}
