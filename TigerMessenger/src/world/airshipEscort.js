// =====================================================================
//  AirshipEscortManager · 异星滑翔长翼鸟（Long-Wing Gliders）
//  莫比斯航空艇的生态护航队——与峡谷 Boids 小鸟完全不同的艺术区分：
//  - 飞艇动态尾流场吸引：速度向量叠加朝 airship.position 的磁力吸引，
//    像被磁铁吸住一样整齐、平滑、带强空气阻力感地尾随在飞艇后方与侧面
//  - 环绕伴飞结界：与飞艇距离锁在 6–15 单位的环形圆柱空间；
//    <6 排斥防撞气囊，>15 强凝聚力拉回
//  - 修长鹤身（4 棱锥 flatShading 沿 Z 极度拉长）+ 两级折叠超长双翼
//    （身体 → 内翼 → 外翼 层级嵌套，翼长 = 身体 1.3 倍）
//  - 低频大振幅滑翔：内翼 sin(t·3 + φ)·0.3，外翼 sin(t·3 + φ − 0.4)·0.4
//    两级链式延迟 → 外翼羽尖丝滑 S 形波浪
//  - 统一 MeshToonMaterial(flatShading) + 全套 addOutline() 手绘黑墨线
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline, INK_COLOR } from "../assets/toon.js";
import { avoidCrystalPillars } from "./flock.js";
import { sedateBirdRecord, tickBirdSedation, TRANQ_DURATION_BIRD } from "./tranquilizer.js";

// ---------- 尾流结界（环形圆柱空间） ----------
const RING_IN = 6; // 内环：<6 触发排斥，避免撞击气囊
const RING_OUT = 15; // 外环：>15 触发强大凝聚力拉回
const K_REPEL = 9.0; // 内环排斥强度
const K_PULL = 8.0; // 外环拉回强度
const BOOST_SPEED = 1.65; // 外环外加速追赶（尾随不掉队）
const RING_SOFT = 0.8; // 硬结界软边
const RING_HARD_K = 0.6; // 硬结界位置回压比例（强行约束）
const WAKE_WEIGHT = 1.9; // 尾流点（飞艇后方）吸引
const SWIRL_WEIGHT = 0.95; // 环绕飞艇的漩涡环飞（ORBIT 模式生效）
const K_AHEAD_PUSH = 2.4; // 不在艇头正前方逗留（ORBIT 模式生效）
const PLANE_WEIGHT = 0.35; // 压向飞艇赤道面 → 圆柱形分布

// ---------- 探路/环绕节奏状态机 ----------
const LEAD_SEC = 5.0; // LEAD：整群飞到艇头前方探路时长
const ORBIT_SEC = 8.0; // ORBIT：环绕伴飞时长
const LEAD_AHEAD = 10; // 艇头前方探路距离
const LEAD_RADIUS = 3.2; // 前方目标点散布半径（松散探路队形）
const LEAD_WEIGHT = 3.0; // 朝前方目标点的强吸引
const PLANE_SOFT = 4.2; // 垂直偏移软上限（不太低，避开登艇垂绳区）
const PLANE_HARD_PUSH = 2.0;

// ---------- 群体秩序 ----------
const SEP_RADIUS = 2.2; // 长翼展 → 分离半径大于峡谷小鸟
const SEP_RADIUS_SQ = SEP_RADIUS * SEP_RADIUS;
const SEP_WEIGHT = 6.5;
const ALI_RADIUS = 9; // 轻对齐：整齐护航感
const ALI_RADIUS_SQ = ALI_RADIUS * ALI_RADIUS;
const ALI_WEIGHT = 0.7;
const DRAG = 1.15; // 强空气阻力感（指数阻尼）
const MIN_SPEED = 1.4;
const MAX_SPEED = 5.2;
const MAX_FORCE = 14;
const HARD_PUSH_DIST = 1.1; // 积分后硬分离兜底

// ---------- 低频滑翔扑打（规格公式） ----------
const FLAP_SPEED = 3; // 低频：数秒一个宽幅周期
const FLAP_INNER_AMP = 0.3; // 内翼基座：大振幅低频
const FLAP_OUTER_AMP = 0.4; // 外翼尖端：振幅加大
const FLAP_LAG = 0.4; // 外翼相位延迟 → 链式鞭打 S 形波浪

/** 浅青灰 / 珍珠白 双色交替（粉紫黄昏结界下与橙红飞艇撞色） */
const GLIDER_COLORS = [0xeceff1, 0xf6f1e7];

// ---------- 模块级临时向量 ----------
const _shipPos = new THREE.Vector3();
const _shipUp = new THREE.Vector3();
const _instVel = new THREE.Vector3();
const _wake = new THREE.Vector3();
const _offset = new THREE.Vector3();
const _force = new THREE.Vector3();
const _steer = new THREE.Vector3();
const _sep = new THREE.Vector3();
const _ali = new THREE.Vector3();
const _diff = new THREE.Vector3();
const _swirl = new THREE.Vector3();
const _radial = new THREE.Vector3();
const _up = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _cross = new THREE.Vector3();
const _origin = new THREE.Vector3();
const _shipFwd = new THREE.Vector3(); // 飞艇切向前进方向
const _leadPoint = new THREE.Vector3(); // LEAD 模式前方目标点
const _m4 = new THREE.Matrix4();
const _q = new THREE.Quaternion();

function clampLen(v, max) {
  const l = v.length();
  if (l > max) v.multiplyScalar(max / l);
  return v;
}

// ---------------------------------------------------------------------------
//  异星滑翔长翼鸟 · createLongWingGlider
//  局部约定：前进 = +Z，上 = +Y，左翼 = +X（与峡谷小鸟一致）。
//  层级：bird → model(侧倾) → 躯干 + 内翼组 → 外翼组（两级折叠）
// ---------------------------------------------------------------------------

/** 内翼：修长的 tapered 四边形薄壳（翼展 0.9） */
function makeInnerWingGeometry(side /* 1 = 左, -1 = 右 */) {
  const s = new THREE.Shape();
  s.moveTo(0.04 * side, 0.19); // 翼根前缘
  s.lineTo(0.04 * side, -0.17); // 翼根后缘
  s.lineTo(0.94 * side, -0.07); // 翼尖后缘（收窄）
  s.lineTo(0.94 * side, 0.09); // 翼尖前缘
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.022, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.011, 0);
  geo.computeVertexNormals();
  return geo;
}

/** 外翼：尖削三角薄壳（翼展 1.05，相对内翼关节的局部坐标） */
function makeOuterWingGeometry(side) {
  const s = new THREE.Shape();
  s.moveTo(0, 0.09); // 关节前缘（与内翼尖缘衔接）
  s.lineTo(0, -0.07); // 关节后缘
  s.lineTo(1.05 * side, -0.015); // 羽尖（微后掠）
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth: 0.018, bevelEnabled: false });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, 0.009, 0);
  geo.computeVertexNormals();
  return geo;
}

/** 修长躯干：4 棱锥沿 Z 非等比极度拉长；细长锥尖 = 头喙，引领飞行 */
function makeTorsoGeometry() {
  const geo = new THREE.ConeGeometry(0.26, 1.5, 4); // radialSegments: 4 → 刚劲切面
  geo.rotateX(Math.PI / 2); // 锥尖 → +Z（头，朝飞行方向），基座 → −Z（尾）
  return geo;
}

function createGliderGeometries() {
  return {
    torso: makeTorsoGeometry(),
    innerL: makeInnerWingGeometry(1),
    innerR: makeInnerWingGeometry(-1),
    outerL: makeOuterWingGeometry(1),
    outerR: makeOuterWingGeometry(-1),
  };
}

/**
 * 实时拼接的异星滑翔长翼鸟：
 * 体量约为峡谷小鸟 1.5 倍长；躯干 + 内翼 + 外翼全部 addOutline() 黑墨线。
 * @param {number} [color] 浅青灰 / 珍珠白
 * @param {ReturnType<typeof createGliderGeometries>} [geos] 共享几何体
 */
export function createLongWingGlider(color = GLIDER_COLORS[0], geos = createGliderGeometries()) {
  const bird = new THREE.Group();
  bird.name = "long-wing-glider";
  const mat = toonMat(color, { flatShading: true }); // 消光硬边 Cel

  // ---------- 修长躯干 ----------
  const torso = new THREE.Mesh(geos.torso, mat);
  torso.scale.set(0.8, 0.55, 1.3); // 沿 Z 非等比极度拉长
  addOutline(torso, 0.017, INK_COLOR, 0.05);

  const model = new THREE.Group(); // 侧倾层（不污染朝向四元数）
  model.add(torso);

  // ---------- 两级折叠长翼（身体 → 内翼 → 外翼） ----------
  function buildWing(side, innerGeo, outerGeo) {
    const inner = new THREE.Group(); // 内翼基座（低频大振幅）
    inner.position.set(0.14 * side, 0.02, 0.3); // 肩部：躯干前段
    const innerMesh = new THREE.Mesh(innerGeo, mat);
    addOutline(innerMesh, 0.017, INK_COLOR, 0.05);
    inner.add(innerMesh);

    const outer = new THREE.Group(); // 外翼尖端（相位延迟鞭打）
    outer.position.set(0.9 * side, 0, 0); // 内翼尖关节
    const outerMesh = new THREE.Mesh(outerGeo, mat);
    addOutline(outerMesh, 0.017, INK_COLOR, 0.05);
    outer.add(outerMesh);

    inner.add(outer);
    return { inner, outer };
  }
  const wingL = buildWing(1, geos.innerL, geos.outerL);
  const wingR = buildWing(-1, geos.innerR, geos.outerR);
  model.add(wingL.inner, wingR.inner);

  bird.add(model);
  bird.userData = {
    model,
    innerL: wingL.inner,
    outerL: wingL.outer,
    innerR: wingR.inner,
    outerR: wingR.outer,
  };
  return bird;
}

// ---------------------------------------------------------------------------
//  AirshipEscortManager
// ---------------------------------------------------------------------------

export class AirshipEscortManager {
  /**
   * @param {THREE.Scene} scene
   * @param {THREE.Object3D} airship 莫比斯航空艇（createMoebiusAirship 产物）
   * @param {{
   *   count?: number,
   *   obstacles?: { dir: THREE.Vector3, root: number, h: number, r: number }[],
   * }?} opts
   */
  constructor(scene, airship, opts = {}) {
    const { count = 9, obstacles = [] } = opts;

    this.scene = scene;
    this.airship = airship;
    this.obstacles = obstacles.map((o) => ({
      dir: o.dir.clone().normalize(),
      root: o.root,
      h: o.h,
      r: o.r,
    }));

    this.geos = createGliderGeometries();
    this.root = new THREE.Group();
    this.root.name = "airship-escort-root";
    scene.add(this.root);

    this._prevShipPos = new THREE.Vector3();
    this._shipVel = new THREE.Vector3();
    this._trailDir = new THREE.Vector3(0, 0, 1); // 尾迹方向兜底
    this._mode = "lead"; // 行为状态机：先飞到艇头前方探路
    this._modeT = 0;
    airship.getWorldPosition(this._prevShipPos);

    // 出生：飞艇四周 8–12 单位环带、近赤道面散布
    const shipR = Math.max(this._prevShipPos.length(), 1);
    const up = _shipUp.copy(this._prevShipPos).divideScalar(shipR);
    const t1 = new THREE.Vector3(0, 1, 0).cross(up);
    if (t1.lengthSq() < 1e-6) t1.set(1, 0, 0);
    t1.normalize();
    const t2 = new THREE.Vector3().crossVectors(up, t1).normalize();

    /** @type {{ group: THREE.Group, model: THREE.Group, innerL: THREE.Group, outerL: THREE.Group, innerR: THREE.Group, outerR: THREE.Group, vel: THREE.Vector3, phaseOffset: number, maxSpeed: number, bank: number, prevTan: THREE.Vector3 }[]} */
    this.birds = [];
    for (let i = 0; i < count; i++) {
      const bird = createLongWingGlider(GLIDER_COLORS[i % GLIDER_COLORS.length], this.geos);
      bird.scale.setScalar(0.9 + Math.random() * 0.25);
      const ang = (i / count) * Math.PI * 2 + Math.random() * 0.6;
      const d = 8 + Math.random() * 4;
      bird.position
        .copy(this._prevShipPos)
        .addScaledVector(t1, Math.cos(ang) * d)
        .addScaledVector(t2, Math.sin(ang) * d * 0.4);
      this.root.add(bird);

      const vel = new THREE.Vector3()
        .crossVectors(up, bird.position.clone().sub(this._prevShipPos))
        .normalize()
        .multiplyScalar(1.8 + Math.random());

      this.birds.push({
        group: bird,
        model: bird.userData.model,
        innerL: bird.userData.innerL,
        outerL: bird.userData.outerL,
        innerR: bird.userData.innerR,
        outerR: bird.userData.outerR,
        vel,
        phaseOffset: Math.random() * Math.PI * 2, // 随机相位偏置
        maxSpeed: MAX_SPEED * (0.9 + Math.random() * 0.2),
        bank: 0,
        prevTan: vel.clone(),
      });
    }
  }

  /**
   * 每帧驱动：尾流场吸引 + 环形圆柱结界 → 秩序力 → 积分 → 朝向/侧倾 → 两级折叠滑翔
   * @param {number} dt
   * @param {number} t 全局时间（秒）
   */
  /**
   * 麻醉弹命中最近护航鸟
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

    // ---------- 飞艇运动状态（平滑速度 + 尾迹方向） ----------
    this.airship.getWorldPosition(_shipPos);
    _instVel.copy(_shipPos).sub(this._prevShipPos).divideScalar(dt);
    if (_instVel.length() > 30) _instVel.setLength(30); // 地图编辑器瞬移守卫
    this._shipVel.lerp(_instVel, Math.min(1, dt * 4));
    this._prevShipPos.copy(_shipPos);
    const shipSpeed = this._shipVel.length();
    if (shipSpeed > 0.4) this._trailDir.copy(this._shipVel).multiplyScalar(-1 / shipSpeed);
    // 尾流点：飞艇后方延伸（速度越快，尾流越长）
    _wake.copy(_shipPos).addScaledVector(this._trailDir, 3 + Math.min(6, shipSpeed * 0.9));
    const shipR = Math.max(_shipPos.length(), 1);
    _shipUp.copy(_shipPos).divideScalar(shipR);

    // ---------- 探路/环绕节奏状态机 ----------
    this._modeT += dt;
    const modeDur = this._mode === "lead" ? LEAD_SEC : ORBIT_SEC;
    if (this._modeT >= modeDur) {
      this._modeT = 0;
      this._mode = this._mode === "lead" ? "orbit" : "lead";
    }
    const leading = this._mode === "lead";
    // 飞艇切向前进方向（球面切线分量）
    _shipFwd
      .copy(this._shipVel)
      .addScaledVector(_shipUp, -this._shipVel.dot(_shipUp));
    if (_shipFwd.lengthSq() > 1e-6) _shipFwd.normalize();
    else _shipFwd.copy(this._trailDir).multiplyScalar(-1); // 静止 → 用尾迹反向
    // LEAD 前方目标点：艇头前方 + 松散散布（每帧基于当前艇位，队形随艇走）
    _leadPoint.copy(_shipPos).addScaledVector(_shipFwd, LEAD_AHEAD);
    // 让目标点也在赤道面附近，避免绕到艇顶/底部
    _leadPoint.addScaledVector(_shipUp, -_leadPoint.clone().sub(_shipPos).dot(_shipUp) * 0.6);

    const groundR = Math.max(_shipPos.length() - 8, 1);

    for (let i = 0; i < n; i++) {
      const b = this.birds[i];
      // 麻醉坠落
      if (tickBirdSedation(b, dt, groundR)) continue;
      const pos = b.group.position;
      _offset.copy(pos).sub(_shipPos);
      const d = _offset.length();

      _force.set(0, 0, 0);

      // ---------- 1) 飞艇动态尾流场吸引 ----------
      _steer.copy(_wake).sub(pos);
      if (_steer.lengthSq() > 1e-6) _force.addScaledVector(_steer.normalize(), WAKE_WEIGHT);

      // ---------- 2) 环绕伴飞结界：6–15 环形圆柱 ----------
      if (d > 1e-6) {
        if (d < RING_IN) {
          // 太近：排斥力，避免撞击气囊
          _force.addScaledVector(_offset, ((RING_IN - d) * K_REPEL) / d);
        } else if (d > RING_OUT) {
          // 太远：强大凝聚力拉回
          _force.addScaledVector(_offset, (-(d - RING_OUT) * K_PULL) / d);
        }
      }

      // ---------- 3) 圆柱分布：压向飞艇赤道面，不太低（避开垂绳） ----------
      const vert = _offset.dot(_shipUp);
      _force.addScaledVector(_shipUp, -vert * PLANE_WEIGHT);
      if (vert < -PLANE_SOFT) {
        _force.addScaledVector(_shipUp, (-PLANE_SOFT - vert) * PLANE_HARD_PUSH);
      } else if (vert > PLANE_SOFT) {
        _force.addScaledVector(_shipUp, -(vert - PLANE_SOFT) * PLANE_HARD_PUSH);
      }

      // ---------- 4) 尾随后方与侧面：不在艇头正前方逗留 ----------
      const behindness = _offset.dot(this._trailDir); // >0 = 在艇后方
      if (behindness < -3) {
        _force.addScaledVector(this._trailDir, (-3 - behindness) * K_AHEAD_PUSH);
      }

      // ---------- 5) 环绕伴飞漩涡（绕飞艇竖直轴环飞） ----------
      _swirl.crossVectors(_shipUp, _offset);
      if (_swirl.lengthSq() > 1e-6) _force.addScaledVector(_swirl.normalize(), SWIRL_WEIGHT);

      // ---------- 5b) 升降前馈：飞艇爬升/下降时同步径向速度，伴飞不脱队 ----------
      // 稳态下力/阻尼 = 飞艇径向速度（F = DRAG·v_climb 恰抵消指数阻尼）
      _force.addScaledVector(_shipUp, this._shipVel.dot(_shipUp) * DRAG);

      // ---------- 6) 群体秩序：分离（长翼不交叠）+ 轻对齐（整齐护航） ----------
      _sep.set(0, 0, 0);
      _ali.set(0, 0, 0);
      let nAli = 0;
      for (let j = 0; j < n; j++) {
        if (j === i) continue;
        const other = this.birds[j];
        const dSq = pos.distanceToSquared(other.group.position);
        if (dSq < SEP_RADIUS_SQ && dSq > 1e-8) {
          const dd = Math.sqrt(dSq);
          _sep.addScaledVector(
            _diff.copy(pos).sub(other.group.position).divideScalar(dd),
            1 / Math.max(dd, 0.1)
          );
        }
        if (dSq < ALI_RADIUS_SQ) {
          _ali.add(other.vel);
          nAli++;
        }
      }
      if (_sep.lengthSq() > 1e-8) {
        _steer.copy(_sep).normalize().multiplyScalar(b.maxSpeed).sub(b.vel);
        _force.addScaledVector(clampLen(_steer, MAX_FORCE), SEP_WEIGHT);
      }
      if (nAli > 0 && _ali.lengthSq() > 1e-8) {
        _steer.copy(_ali).divideScalar(nAli).normalize().multiplyScalar(b.maxSpeed).sub(b.vel);
        _force.addScaledVector(clampLen(_steer, MAX_FORCE), ALI_WEIGHT);
      }

      // ---------- 7) 晶塔避障（与峡谷鸟群共享） ----------
      _radial.copy(pos).normalize();
      avoidCrystalPillars(pos, b.vel, _force, this.obstacles, _radial);

      // ---------- 积分：强空气阻力阻尼 → 受力 → 限速 ----------
      b.vel.multiplyScalar(Math.exp(-DRAG * dt));
      b.vel.addScaledVector(_force, dt);
      // 外环外允许加速追赶（飞艇巡航不掉队）
      const cap = d > RING_OUT ? b.maxSpeed * BOOST_SPEED : b.maxSpeed;
      const sp = b.vel.length();
      if (sp > cap) b.vel.multiplyScalar(cap / sp);
      else if (sp < MIN_SPEED) {
        if (sp > 1e-5) b.vel.multiplyScalar(MIN_SPEED / sp);
        else b.vel.copy(this._trailDir).multiplyScalar(MIN_SPEED);
      }
      pos.addScaledVector(b.vel, dt);

      // ---------- 结界硬约束：强行压回 6–15 环带（软边内渐进回压，防抖） ----------
      _offset.copy(pos).sub(_shipPos);
      const d2 = _offset.length();
      if (d2 > RING_OUT + RING_SOFT) {
        pos.addScaledVector(_offset, (-(d2 - (RING_OUT + RING_SOFT)) / d2) * RING_HARD_K);
      } else if (d2 < RING_IN - 0.4 && d2 > 1e-6) {
        pos.addScaledVector(_offset, ((RING_IN - 0.4 - d2) / d2) * RING_HARD_K);
      }
    }

    // ---------- 硬分离兜底：长翼绝不交叠 ----------
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

    // ---------- 朝向 / 侧倾 / 两级折叠滑翔 ----------
    for (let i = 0; i < n; i++) {
      const b = this.birds[i];
      if ((b.sedateT ?? 0) > 0) continue;
      const pos = b.group.position;

      if (b.vel.lengthSq() > 0.04) {
        _up.copy(pos).normalize();
        _fwd.copy(b.vel).normalize();
        if (Math.abs(_fwd.dot(_up)) < 0.99) {
          _m4.lookAt(_fwd, _origin, _up); // +Z → 速度方向
          _q.setFromRotationMatrix(_m4);
          b.group.quaternion.slerp(_q, 1 - Math.exp(-4.5 * dt)); // 滑翔鸟转身更徐缓
        }
      }

      // 侧倾：转弯压坡，滑翔体态
      _up.copy(pos).normalize();
      _tan.copy(b.vel).addScaledVector(_up, -b.vel.dot(_up));
      const turnSign = _cross.crossVectors(b.prevTan, _tan).dot(_up);
      const bankTarget = THREE.MathUtils.clamp(
        (turnSign * 2.2) / (_tan.lengthSq() + 0.6),
        -0.45,
        0.45
      );
      b.bank += (bankTarget - b.bank) * Math.min(1, dt * 3.5);
      b.model.rotation.z = b.bank;
      b.prevTan.copy(_tan);

      // 两级折叠滑翔（规格公式）：内翼低频大振幅，外翼延迟鞭打
      const inner = Math.sin(t * FLAP_SPEED + b.phaseOffset) * FLAP_INNER_AMP;
      const outer = Math.sin(t * FLAP_SPEED + b.phaseOffset - FLAP_LAG) * FLAP_OUTER_AMP;
      b.innerL.rotation.z = inner;
      b.outerL.rotation.z = outer;
      b.innerR.rotation.z = -inner;
      b.outerR.rotation.z = -outer;
    }
  }

  dispose() {
    if (this.root.parent) this.root.parent.remove(this.root);
    this.root.traverse((o) => {
      // 描边材质为全局缓存，不可销毁；几何体由 this.geos 统一回收
      if (o.isMesh && !o.userData.isOutline) o.material.dispose();
    });
    this.geos.torso.dispose();
    this.geos.innerL.dispose();
    this.geos.innerR.dispose();
    this.geos.outerL.dispose();
    this.geos.outerR.dispose();
    this.birds.length = 0;
  }
}
