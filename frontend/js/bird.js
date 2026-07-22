// 鸟类通用智能体：感知驱动的状态机（觅食 → 饮水 → 惊飞 → 栖止 → 归飞）
// 躯体可为程序化模型或图转 3D 的 GLB；行为骨架（对应《Artificial Fishes》
// 的 fear/thirst 内驱力与 evasive action）不随模型改变。
import * as THREE from "../assets/vendor/three/three.module.js";
import { groundHeight, streamCurve, distToStream } from "./environment.js";
import { loadGLB, normalizeModel, hasModel } from "./assets.js";
import { buildAvianBody } from "./bio/AvianBodyBuilder.js";

const PHEASANT_CLEARINGS = [
  { x: -30, z: -18, r: 7.5 },
  { x: 24, z: -30, r: 8.5 },
  { x: 31, z: 17, r: 8.0 },
  { x: -27, z: 27, r: 7.0 },
  { x: 12, z: 34, r: 6.5 },
];

export function randomPheasantSpot({
  rng = Math.random,
  minStreamDistance = 8.0,
  avoid = null,
  minAvoidDistance = 14.0,
} = {}) {
  for (let tries = 0; tries < 80; tries++) {
    const c = PHEASANT_CLEARINGS[Math.floor(rng() * PHEASANT_CLEARINGS.length)];
    const a = rng() * Math.PI * 2;
    const r = Math.sqrt(rng()) * c.r;
    const x = c.x + Math.cos(a) * r;
    const z = c.z + Math.sin(a) * r;
    if (Math.abs(x) > 38 || Math.abs(z) > 38) continue;
    if (distToStream(x, z) < minStreamDistance) continue;
    if (avoid && Math.hypot(x - avoid.x, z - avoid.z) < minAvoidDistance) continue;
    return new THREE.Vector3(x, groundHeight(x, z), z);
  }
  const fallback = PHEASANT_CLEARINGS.find((c) => {
    if (distToStream(c.x, c.z) < minStreamDistance) return false;
    return !avoid || Math.hypot(c.x - avoid.x, c.z - avoid.z) >= minAvoidDistance;
  }) || PHEASANT_CLEARINGS[0];
  return new THREE.Vector3(fallback.x, groundHeight(fallback.x, fallback.z), fallback.z);
}

export function randomPheasantPerchSpot(forage, {
  rng = Math.random,
  minStreamDistance = 8.0,
} = {}) {
  for (let tries = 0; tries < 40; tries++) {
    const a = rng() * Math.PI * 2;
    const r = 5 + rng() * 7;
    const x = forage.x + Math.cos(a) * r;
    const z = forage.z + Math.sin(a) * r;
    if (Math.abs(x) > 38 || Math.abs(z) > 38) continue;
    if (distToStream(x, z) < minStreamDistance) continue;
    return new THREE.Vector3(x, groundHeight(x, z), z);
  }
  return randomPheasantSpot({ rng, minStreamDistance });
}

export const BIRD_STATE = {
  FORAGE: "觅食", DRINK: "去饮水", DRINKING: "饮水",
  ALERT: "警觉", RUN: "奔逃", FLEE: "惊飞", PERCH: "栖止", RETURN: "归飞", CAUGHT: "被获",
};
const S = BIRD_STATE;

export class BirdAgent {
  /**
   * opts:
   *  name        面板显示名
   *  modelUrl    GLB 路径（缺省则程序化躯体）
   *  targetHeight/modelYaw  GLB 归一化参数
   *  forage/perch  觅食点 / 避险点 [x, z]
   *  flightArc   飞行抛物线高度
   *  walkSpeed   踱步速度
   */
  constructor(scene, config, opts = {}) {
    this.scene = scene;
    this.config = config;
    this.opts = Object.assign(
      {
        name: "锦鸡", modelUrl: null, targetHeight: 0.5, modelYaw: 0,
        forage: [6.5, -4.5], perch: [-8.5, 3.5],
        flightArc: 3.2, walkSpeed: 0.5,
      },
      opts
    );
    this.group = new THREE.Group();
    this.state = S.FORAGE;
    this.stateLabel = S.FORAGE;

    this.forageSpot = new THREE.Vector3(this.opts.forage[0], 0, this.opts.forage[1]);
    this.perchSpot = new THREE.Vector3(this.opts.perch[0], 0, this.opts.perch[1]);
    // 饮水点：溪涧曲线上距觅食点最近的岸沿
    let best = null, bd = Infinity;
    for (let i = 0; i <= 60; i++) {
      const p = streamCurve.getPointAt(i / 60);
      const d = p.distanceTo(this.forageSpot);
      if (d < bd) { bd = d; best = p.clone(); }
    }
    const toBank = new THREE.Vector3().subVectors(this.forageSpot, best).setY(0).normalize();
    this.drinkSpot = best.clone().addScaledVector(toBank, 1.05);

    this.pos = this.forageSpot.clone();
    this._target = this.forageSpot.clone();
    this._walkTimer = 0;
    this._drinkClock = 6 + Math.random() * 8;
    this._perchLeft = 0;
    this._flight = null;
    this._peck = 0;

    this.proceduralParts = [];
    this.isGlb = false;
    this._buildProcedural();
    if (this.opts.modelUrl) this._attachGLB(this.opts.modelUrl);
    scene.add(this.group);
  }

  async _attachGLB(url) {
    try {
      if (!(await hasModel(url))) return; // 尚未生成，保留程序化躯体
      const raw = await loadGLB(url);
      const model = normalizeModel(raw, {
        targetHeight: this.opts.targetHeight,
        yaw: this.opts.modelYaw,
      });
      this.modelRoot = new THREE.Group();
      this.modelRoot.add(model);
      this.group.add(this.modelRoot);
      for (const p of this.proceduralParts) p.visible = false;
      this.isGlb = true;
    } catch (err) {
      console.warn(`${this.opts.name} GLB 加载失败，保留程序化模型：`, err);
    }
  }

  // ---------- 程序化躯体（红腹锦鸡；GLB 缺失时的兜底） ----------
  _buildProcedural() {
    // 红腹锦鸡（Chrysolophus pictus）雄鸟繁殖羽：朱红胸腹、金丝冠、橙底黑纹披肩、
    // 翠绿上背、朱红腰腹、钴蓝肩斑、黄褐黑斑横尾 —— 取靓丽配色；lab 自定义鸟
    // 传入 bodyColor 时走通用简洁羽色，不套锦鸡斑纹
    const PHEASANT_PLUMAGE = {
      height: 0.42,
      bodyColor: 0xe02a12,      // 胸腹朱红
      accentColor: 0xffc61a,    // 金
      neckColor: 0xf0a018,      // 颈侧金橙（披肩覆于其上）
      crestColor: 0xffd21f,     // 金丝冠
      wingColor: 0x9a6226,      // 翼面赤褐
      tailColor: 0x1c140d,      // 尾羽黑色横斑
      tailBaseColor: 0xd9a648,  // 尾羽黄褐地
      backColor: 0x12a34f,      // 上背翠绿
      rumpColor: 0xe8451c,      // 腰及尾上覆羽朱红偏橙
      wingPatchColor: 0x2456d8, // 肩斑钴蓝
      capeColor: 0xf07818,      // 披肩橙黄
      capeEdgeColor: 0x14100c,  // 披肩黑色扇贝纹
      shape: { crestCount: 7, tailLen: 0.68, tailW: 0.055, tailCount: 7, legColor: 0xe0b53a },
    };
    const params = this.opts.bodyColor != null
      ? {
          height: 0.42,
          bodyColor: this.opts.bodyColor,
          accentColor: this.opts.accentColor ?? 0xd9a520,
          neckColor: this.opts.neckColor ?? 0x1f5f3f,
          crestColor: this.opts.crestColor ?? 0xe3b93a,
        }
      : PHEASANT_PLUMAGE;
    const built = buildAvianBody(params);
    this.group.add(built.group);
    this.body = built.group.children[0];
    this.head = built.head;            // 中段颈骨 (Neck_Lower)
    this.headBone = built.headBone;    // 颈顶骨 (Neck_Upper)
    this.headGroup = built.headGroup;  // 头部几何载体（挂在颈顶骨下）
    this.headLock = this.opts?.headLock ?? 0.28; // 头随颈倾摆比例（视线锁定降级）
    this.spine = built.spine;          // 胸腔锚骨 (Spine_Chest)
    this.wings = built.wings;
    this.tail = built.tail;
    this.proceduralParts = built.parts;
  }

  // ---------- 行为层 ----------
  update(dt, time, tigerPos) {
    this._dt = dt;
    const cfg = this.config.pheasant;
    if (!cfg.enabled) { this.group.visible = false; return; }

    // 被获：坠地 → 隐匿 → 延时重生回觅食点（被叼中则由虎口携带，跳过落地逻辑）
    if (this.state === S.CAUGHT) {
      if (this.carried) {
        // 叼运中：位置由虎口头骨携带；计时兜底防卡死
        this._respawn -= dt;
        if (this._respawn <= 0) { // 理论上虎会先放下；兜底直接重生
          this.carried = false;
          this._pickRespawnSpot(tigerPos);
          this.pos.copy(this.forageSpot);
          this.group.position.copy(this.forageSpot);
          this.group.rotation.set(0, 0, 0);
          this.group.scale.setScalar(1);
          this.group.visible = true;
          this.state = S.FORAGE;
        }
        this.stateLabel = this.state;
        return;
      }
      const ground = groundHeight(this.pos.x, this.pos.z);
      this.pos.y = Math.max(ground, this.pos.y - dt * 5);
      this.group.position.copy(this.pos);
      this._respawn -= dt;
      if (this._dropped > 0) { // 献获放下：横陈片刻后隐匿
        this._dropped -= dt;
        if (this._dropped <= 0) this.group.visible = false;
      } else if (this._respawn < (cfg.respawnDelay ?? 20) - 0.8) this.group.visible = false;
      if (this._respawn <= 0) {
        this._pickRespawnSpot(tigerPos);
        this.pos.copy(this.forageSpot);
        this.group.visible = true;
        this.state = S.FORAGE;
        this._walkTimer = 0;
      }
      this.stateLabel = this.state;
      return;
    }
    this.group.visible = true;

    const tigerDist = tigerPos
      ? Math.hypot(tigerPos.x - this.pos.x, tigerPos.z - this.pos.z)
      : Infinity;

    // 感知层：fear 分级 —— 远警觉（冻结观察）、近奔逃、奔逃后惊飞
    if (![S.RUN, S.FLEE, S.PERCH, S.RETURN].includes(this.state)) {
      if (tigerDist < cfg.fleeDistance) {
        this.state = S.RUN;
        this._runLeft = cfg.runDuration ?? 1.2;
      } else if (tigerDist < (cfg.alertDistance ?? 10)) {
        if (this.state !== S.ALERT) { this._prevState = this.state; this.state = S.ALERT; }
      } else if (this.state === S.ALERT) {
        this.state = this._prevState && this._prevState !== S.ALERT ? this._prevState : S.FORAGE;
      }
    }

    switch (this.state) {
      case S.ALERT: this._alert(dt, time, tigerPos); break;
      case S.RUN: this._run(dt, time, tigerPos); break;
      case S.FORAGE: this._forage(dt, time); break;
      case S.DRINK: this._gotoDrink(dt); break;
      case S.DRINKING: this._drinking(dt, time); break;
      case S.FLEE: case S.RETURN: this._fly(dt, time); break;
      case S.PERCH: {
        this._perchLeft -= dt;
        this._idlePose(time);
        if (this._perchLeft <= 0 && tigerDist > cfg.returnDistance) {
          this._takeOff(this.forageSpot, S.RETURN);
        }
        break;
      }
    }

    if (this.state !== S.FLEE && this.state !== S.RETURN) {
      this.pos.y = groundHeight(this.pos.x, this.pos.z);
    }
    this.group.position.copy(this.pos);
    this.stateLabel = this.state;
  }

  /** 被虎飞扑捕获：坠地 → 隐匿 → 延时重生 */
  _caught() {
    if (this.state === S.CAUGHT) return;
    this.state = S.CAUGHT;
    this._respawn = this.config.pheasant.respawnDelay ?? 20;
    this.group.visible = true;
  }

  /** 被叼起：挂到虎的头骨上（口中），保持可见、垂死下垂 */
  _carriedBy(headBone) {
    if (this.state === S.CAUGHT && this.carried) return;
    this.state = S.CAUGHT;
    this.carried = true;
    this._respawn = this.config.pheasant.respawnDelay ?? 20;
    headBone.add(this.group);
    this.group.position.set(0, -0.07, 0.34); // 叼在口中
    this.group.rotation.set(0.5, 0, 1.25);   // 垂坠姿态
    this.group.scale.setScalar(0.85);
    this.group.visible = true;
  }

  /** 被放下（献于母前）：交还场景、落地横陈，片刻后隐匿重生 */
  _dropAt(scene, worldPos) {
    scene.add(this.group);
    this.group.position.copy(worldPos);
    this.group.rotation.set(0, 0, 1.4);
    this.group.scale.setScalar(1);
    this.pos.copy(worldPos);
    this.carried = false;
    this._dropped = 1.2;
  }

  /** 警觉：冻结立定、面向威胁、颈羽微张（危险未近则不逃） */
  _alert(dt, time, tigerPos) {
    if (tigerPos) {
      this.group.rotation.y = Math.atan2(tigerPos.x - this.pos.x, tigerPos.z - this.pos.z);
    }
    if (this.isGlb) this.modelRoot.rotation.x = -0.12;
    else this._neckKinematics(dt, time, "alert"); // 昂颈张望 + 视线锁定
    // 翼根微张欲起（小幅高频颤翅）
    for (const w of this.wings) w.pivot.rotation.z = w.side * (1.0 + Math.sin(time * 14) * 0.08);
  }

  /** 逃逸落点：背向虎远飞 ~14m（拉开距离），候选角度避开河床 */
  _escapeTarget(tigerPos) {
    const away = new THREE.Vector3().subVectors(this.pos, tigerPos).setY(0);
    const base = away.lengthSq() > 1e-6 ? Math.atan2(away.x, away.z) : Math.random() * Math.PI * 2;
    for (const off of [0, 0.7, -0.7, 1.4, -1.4]) {
      const a = base + off;
      const x = this.pos.x + Math.sin(a) * 14, z = this.pos.z + Math.cos(a) * 14;
      if (Math.abs(x) < 38 && Math.abs(z) < 38 && distToStream(x, z) > 2.3) {
        return new THREE.Vector3(x, 0, z);
      }
    }
    return this.perchSpot.clone();
  }

  /** 重生落点：随机落在远离溪涧的林缘/雪坡处（距虎 ≥14m）。
   *  同时按新觅食点重算饮水点，使重生后行为（饮水/避险）自然衔接。 */
  _pickRespawnSpot(tigerPos) {
    const spot = randomPheasantSpot({ avoid: tigerPos, minStreamDistance: 8.0 });
    this.forageSpot.copy(spot);
    this.perchSpot.copy(randomPheasantPerchSpot(spot, { minStreamDistance: 8.0 }));
    this._target.copy(this.forageSpot);
    // 重算饮水点：距新觅食点最近的溪岸
    let best = null, bd = Infinity;
    for (let i = 0; i <= 60; i++) {
      const p = streamCurve.getPointAt(i / 60);
      const d = p.distanceTo(this.forageSpot);
      if (d < bd) { bd = d; best = p.clone(); }
    }
    const toBank = new THREE.Vector3().subVectors(this.forageSpot, best).setY(0).normalize();
    this.drinkSpot = best.clone().addScaledVector(toBank, 1.05);
    this.drinkSpot.y = 0;
  }

  /** 奔逃：拍翅贴地疾窜（短时），随后向远处惊飞拉开距离 */
  _run(dt, time, tigerPos) {
    const cfg = this.config.pheasant;
    this._runLeft -= dt;
    if (tigerPos) {
      const away = new THREE.Vector3().subVectors(this.pos, tigerPos).setY(0);
      if (away.lengthSq() > 1e-6) this._target = this.pos.clone().add(away.normalize().multiplyScalar(3));
    }
    this._walkToward(dt, this.opts.walkSpeed * 2.8);
    const flap = Math.sin(time * 22) * 0.7;
    for (const w of this.wings) w.pivot.rotation.z = w.side * (1.4 + flap * 0.6); // 翼根为轴绕肩扑扇
    if (this.isGlb) this.modelRoot.rotation.x = 0.2;
    else this._neckKinematics(dt, time, "extend"); // 颈前伸减阻
    if (this._runLeft <= 0) this._takeOff(this._escapeTarget(tigerPos ?? this.pos), S.FLEE);
  }

  _forage(dt, time) {
    const cfg = this.config.pheasant;
    this._drinkClock += dt;
    this._walkTimer -= dt;
    if (this._drinkClock > cfg.drinkInterval) {
      this.state = S.DRINK;
      this._target.copy(this.drinkSpot);
      return;
    }
    if (this._walkTimer <= 0) {
      this._walkTimer = 1.5 + Math.random() * 2.5;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.6;
      this._target.set(this.forageSpot.x + Math.cos(a) * r, 0, this.forageSpot.z + Math.sin(a) * r);
      this._peck = Math.random() < 0.55 ? 0.9 : 0;
    }
    this._walkToward(dt, this.opts.walkSpeed);
    if (this._peck > 0) {
      // 停下啄食：颈以 rest 微呼吸，头部局部点头（叠加在视线锁定之上）
      this._peck -= dt;
      const k = Math.abs(Math.sin(time * 14));
      if (this.isGlb) this.modelRoot.rotation.x = k * 0.35;
      else { this._neckKinematics(dt, time, "rest"); if (this.headGroup) this.headGroup.rotation.x += k * 0.9; }
    } else {
      if (this.isGlb) this.modelRoot.rotation.x *= 0.9;
      else this._neckKinematics(dt, time, "walk"); // 踱步探头顿挫（S 型长颈 + 视线锁定）
    }
    this._idleWings();
  }

  _gotoDrink(dt) {
    if (this._walkToward(dt, this.opts.walkSpeed * 1.2) < 0.1) {
      this.state = S.DRINKING;
      this._dipLeft = 3;
      this._dipTimer = 0;
      const dir = new THREE.Vector3().subVectors(this.drinkSpot, this.forageSpot).setY(0);
      this.group.rotation.y = Math.atan2(-dir.x, -dir.z);
    }
    this._idleWings();
  }

  _drinking(dt, time) {
    this._dipTimer -= dt;
    if (this._dipTimer <= 0) {
      this._dipLeft -= 1;
      this._dipTimer = 1.0;
    }
    const ph = (this._dipTimer % 1.0) * Math.PI;
    if (this.isGlb) this.modelRoot.rotation.x = Math.sin(ph) * 0.5;
    else {
      this._neckKinematics(dt, time, "extend");
      if (this.headGroup) this.headGroup.rotation.x += Math.sin(ph) * 1.05; // 低头饮水
    }
    if (this._dipLeft <= 0) {
      this._drinkClock = 0;
      this.state = S.FORAGE;
      if (this.isGlb) this.modelRoot.rotation.x = 0;
      else this._neckKinematics(dt, time, "rest");
    }
  }

  _takeOff(target, state) {
    this.state = state;
    this._flight = {
      from: this.pos.clone(),
      to: new THREE.Vector3(target.x, groundHeight(target.x, target.z), target.z),
      t: 0,
      dur: Math.max(this.pos.distanceTo(target) / 6.5, 1.4),
    };
  }

  _fly(dt, time) {
    const f = this._flight;
    f.t += dt / f.dur;
    const t = Math.min(f.t, 1);
    this.pos.lerpVectors(f.from, f.to, t);
    this.pos.y = THREE.MathUtils.lerp(f.from.y, f.to.y, t) + Math.sin(t * Math.PI) * this.opts.flightArc;
    const dir = new THREE.Vector3().subVectors(f.to, f.from);
    this.group.rotation.y = Math.atan2(dir.x, dir.z);
    this.group.rotation.x = -0.25 + (t > 0.8 ? (t - 0.8) * 2 : 0);
    if (this.isGlb) {
      // 无翼骨可扑：滑翔 + 侧滚摆动
      this.modelRoot.rotation.z = Math.sin(time * 3.2) * 0.12;
      this.modelRoot.rotation.x = 0.18;
    } else {
      const flap = Math.sin(time * 26) * 0.95;
      for (const w of this.wings) w.pivot.rotation.z = w.side * (1.5 + flap * 0.6); // 翼根为轴绕肩扑扇
      this.tail.rotation.x = 0.35;
      this._neckKinematics(dt, time, "extend"); // 颈前伸减阻
    }
    if (f.t >= 1) {
      this.group.rotation.x = 0;
      if (this.isGlb) { this.modelRoot.rotation.z = 0; this.modelRoot.rotation.x = 0; }
      else this.tail.rotation.x = 0;
      if (this.state === S.FLEE) {
        this.state = S.PERCH;
        this._perchLeft = this.config.pheasant.perchTime;
      } else {
        this.state = S.FORAGE;
        this._walkTimer = 0;
      }
      this._flight = null;
    }
  }

  _idlePose(time) {
    if (this.isGlb) this.modelRoot.rotation.x = Math.sin(time * 2.2) * 0.03;
    else this._neckKinematics(this._dt || 0.016, time, "rest"); // 栖止微呼吸 S 摆
    this._idleWings();
  }

  /**
   * 鸟类长颈流体运动学（科学建模 · S 型曲线 + 探头顿挫）
   * 双颈骨相位差对冲 + 幂次顿挫正弦(pow3) + 视线锁定补偿，呈现在世界空间中
   * 「推进期颈后缩锁视线、锁定迈步期颈前探爆发」的非线性生物顿挫。
   * @param {string} mode 'walk' 踱步顿挫 | 'alert' 昂颈张望 | 'extend' 前伸(奔逃/惊飞) | 'rest' 微呼吸
   */
  _neckKinematics(dt, time, mode = "rest") {
    if (this.isGlb) return; // GLB 模型无独立颈骨，跳过（沿用 modelRoot 整体俯仰）
    const n1 = this.head, n2 = this.headBone, hg = this.headGroup;
    const k = Math.min(dt * 9, 1); // 平滑趋近，避免阶跃跳变
    const setR = (o, x, y) => {
      o.rotation.x += (x - o.rotation.x) * k;
      o.rotation.y += (y - o.rotation.y) * k;
    };
    const L = this.headLock ?? 0.28;            // 头随颈倾摆比例（视线锁定降级）
    const lock = (x) => x * (1 - L);
    if (mode === "walk") {
      // 🦢 行走探头顿挫公式：高频步伐 + 幂次(pow3)让波形在过零处停顿、过渡时爆发
      const tick = time * 5.5;                          // 鸟类步伐频率较快
      const step = Math.sin(tick);
      const jerk = Math.pow(Math.sin(tick), 3.0);        // 顿挫正弦（停顿→爆发）
      const jerkC = Math.pow(Math.cos(tick), 3.0);
      // 颈根(Neck_Lower)：向前下方压低并随步微摆
      const n1x = 0.15 + jerk * 0.25;
      const n1y = step * 0.08;
      // 颈顶(Neck_Upper)：带时间差(-0.4)反向对冲 → 形成 S 型天鹅颈（绝杀公式）
      const n2x = -0.25 - Math.pow(Math.sin(tick - 0.4), 3.0) * 0.35;
      const n2y = -Math.sin(tick - 0.4) * 0.08;
      n1.rotation.x += (n1x - n1.rotation.x) * k;
      n1.rotation.y += (n1y - n1.rotation.y) * k;
      n2.rotation.x += (n2x - n2.rotation.x) * k;
      n2.rotation.y += (n2y - n2.rotation.y) * k;
      // 头随颈尖一起运动：视线锁定补偿按 headLock 衰减，头保留大部分颈倾摆（不再世界静止，消除脱节）
      if (hg) { hg.rotation.x += (lock(-(n1x + n2x)) + 0.05 + jerkC * 0.06 - hg.rotation.x) * k; hg.rotation.y += (lock(-(n1y + n2y)) - hg.rotation.y) * k; }
    } else if (mode === "alert") {
      // 警觉：长颈笔直高昂，头高频小幅张望（神经质）
      const look = Math.sin(time * 8.0) * 0.4 * (Math.cos(time * 2.0) > 0.3 ? 1 : 0);
      setR(n1, -0.1, 0);
      setR(n2, -0.05, look);
      if (hg) { hg.rotation.x += (0 - hg.rotation.x) * k; hg.rotation.y += (-look - hg.rotation.y) * k; }
    } else if (mode === "extend") {
      // 奔逃/惊飞：颈前伸成直线减阻，头死盯前方
      setR(n1, 0.3, 0);
      setR(n2, -0.3, 0);
      if (hg) { hg.rotation.x += (0 - hg.rotation.x) * k; hg.rotation.y += (0 - hg.rotation.y) * k; }
    } else { // rest：微呼吸 S 摆
      const br = Math.sin(time * 1.5) * 0.05;
      setR(n1, br, 0);
      setR(n2, -br * 0.8, 0);
      if (hg) { hg.rotation.x += (lock(-br * 0.2) - hg.rotation.x) * k; hg.rotation.y += (0 - hg.rotation.y) * k; }
    }
  }

  _idleWings() {
    if (this.isGlb) return;
    for (const w of this.wings) w.pivot.rotation.z *= 0.85;
  }

  _walkToward(dt, speed) {
    const dir = new THREE.Vector3().subVectors(this._target, this.pos).setY(0);
    const d = dir.length();
    if (d > 1e-4) {
      dir.normalize();
      this.pos.addScaledVector(dir, Math.min(speed * dt, d));
      const targetYaw = Math.atan2(dir.x, dir.z);
      let dy = (targetYaw - this.group.rotation.y) % (Math.PI * 2);
      if (dy > Math.PI) dy -= Math.PI * 2;
      if (dy < -Math.PI) dy += Math.PI * 2;
      this.group.rotation.y += dy * Math.min(dt * 6, 1);
      this.pos.y += Math.abs(Math.sin(performance.now() * 0.012)) * 0.01;
    }
    return d;
  }
}
