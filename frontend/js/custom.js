// 自定义物种智能体：物种实验室（lab.html）产出的物种进入漫游场景
// 数据驱动：形体/解剖/渲染/步态全来自物种记录；
// 行为 = 环境漫游 + 关系矩阵互动（遇虎惊逃 / 互利亲近 / 临水而饮 / 雪地打滑）。
// 适配器(adapter)解耦具体场景：传入地面高度、水域查询、家、漫游点、他者、雪滑等。
import * as THREE from "../assets/vendor/three/three.module.js";
import { BioEntityMesh } from "./bio/BioEntityMesh.js";
import { BirdAgent } from "./bird.js";

/** 读取用户在实验室保存的物种记录；无保存则返回 null（场景不生成） */
export async function loadSavedSpecies() {
  try {
    const res = await fetch("api/species");
    if (res.ok) {
      const data = await res.json();
      if (data?.species) return data.species;
    }
  } catch (_) { /* 离线回退 */ }
  try {
    const raw = localStorage.getItem("living-classical-art-species");
    if (raw) return JSON.parse(raw);
  } catch (_) { /* ignore */ }
  return null;
}

// 肉食营养级（用于判定「掠食者 vs 猎物」关系方向）
const ANIMALIVOROUS = new Set(["carnivore", "piscivore", "insectivore"]);

export class CustomAgent {
  /**
   * @param {THREE.Scene} scene
   * @param {Object} record  物种记录（同 lab 存档结构）
   * @param {Object} adapter 场景适配器：
   *   groundHeight(x,z), isWater(x,z), waterLevel, snowSlick(x,z),
   *   home(Vector3), wanders([{x,z}]), waterPoint?()->Vector3,
   *   getOther?()->Vector3|null, who('tiger'|'goose'),
   *   avesForage?[x,z], avesPerch?[x,z]
   * @param {Object} opts  { pheasant }
   */
  constructor(scene, record, adapter, opts = {}) {
    this.record = record;
    this.adapter = adapter;
    this.cnName = record.cnName || "自定义物种";
    this.behavior = record.behavior || {};
    this.semantics = record.semantics || {};
    this.state = "IDLE";
    this.stateLabel = "驻足";
    this.saltatorial = record.anatomyType === "SALTATORIAL";
    this.home = adapter.home.clone();
    this._seed = Math.random() * 10;

    // 禽类：托管给锦鸡行为状态机（觅食/饮水/惊飞/栖止/归飞），躯体配色取物种记录
    if (record.anatomyType === "AVES") {
      this._bird = new BirdAgent(scene, {
        pheasant: opts.pheasant ?? {
          enabled: true, fleeDistance: 6, returnDistance: 14, drinkInterval: 25, perchTime: 4,
        },
      }, {
        name: this.cnName,
        bodyColor: record.rendering?.baseColor,
        forage: adapter.avesForage ?? [this.home.x, this.home.z],
        perch: adapter.avesPerch ?? [this.home.x, this.home.z + 3.5],
      });
      this.group = this._bird.group;
      const hs = (record.dimensions?.height ?? 0.42) / 0.42;
      if (Math.abs(hs - 1) > 0.05) this.group.scale.setScalar(hs);
      return;
    }

    this._timer = 2 + Math.random() * 2;
    this._target = null;
    this._heading = Math.random() * Math.PI * 2;
    this._movingCur = 0;
    this._gaitCyc = 0;
    this._fleeing = 0;

    const family = { anatomyType: record.anatomyType };
    this.entity = new BioEntityMesh(family, structuredClone(record));
    this.group = this.entity;
    this.group.position.set(this.home.x, adapter.groundHeight(this.home.x, this.home.z), this.home.z);
    this._buildDetails();
    scene.add(this.group);
  }

  /** 外观件：眼睛贴头骨；SALTATORIAL 补长耳 */
  _buildDetails() {
    const B = this.entity.boneMap;
    const w = this.record.dimensions?.width ?? 0.3;
    const head = B.get("Head");
    if (head) {
      const eyeMat = new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 0.3 });
      for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(w * 0.06, 10, 8), eyeMat);
        eye.position.set(s * w * 0.14, w * 0.04, w * 0.09);
        head.add(eye);
      }
    }
    if (this.saltatorial) {
      const earLen = this.record.anatomicalRef?.earLength ?? 0.12;
      const furMat = new THREE.MeshStandardMaterial({
        color: this.record.rendering?.baseColor ?? 0xd3d3d3, roughness: 0.75,
      });
      for (const key of ["Ear_L", "Ear_R"]) {
        const bone = B.get(key);
        if (!bone) continue;
        const s = key === "Ear_L" ? -1 : 1;
        const outer = new THREE.Mesh(new THREE.SphereGeometry(earLen * 0.24, 10, 8), furMat);
        outer.scale.set(0.55, earLen / (earLen * 0.48), 0.28);
        outer.position.set(0, earLen * 0.45, 0);
        outer.rotation.z = -s * 0.08;
        bone.add(outer);
      }
    }
  }

  /** 漫游目标：优先家周 9m 内漫游点（竹竿/梅干），其次临水而饮，最后随机干燥点 */
  _pickTarget() {
    const R = 9;
    const home = this.home;
    const wanders = (this.adapter.wanders || []).filter(
      (p) => Math.hypot(p.x - home.x, p.z - home.z) < R
    );
    // 亲水且环境有水面：按概率去水边（临水而饮）
    const wantWater = (this.behavior.foraging ?? 0.5) > 0.6 && (this.behavior.affinity ?? 0.6) > 0.55;
    if (wantWater && this.adapter.waterPoint && Math.random() < 0.45) {
      const p = this.adapter.waterPoint();
      if (p) return p.clone();
    }
    if (wanders.length) {
      const p = wanders[(Math.random() * wanders.length) | 0];
      return new THREE.Vector3(p.x + (Math.random() - 0.5) * 1.4, 0, p.z + (Math.random() - 0.5) * 1.4);
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = R * (0.4 + Math.random() * 0.6);
      const x = home.x + Math.cos(a) * r, z = home.z + Math.sin(a) * r;
      if (!this.adapter.isWater(x, z)) return new THREE.Vector3(x, 0, z);
    }
    return home.clone();
  }

  /** 每帧：禽类走锦鸡状态机；其余为关系互动优先，否则环境漫游 */
  update(dt, time, otherAgent) {
    if (this._bird) {
      if (this.record.enabled === false) { this._bird.group.visible = false; return; }
      this._bird.group.visible = true;
      const other = this.adapter.getOther?.() ?? otherAgent?.group?.position ?? null;
      this._bird.update(dt, time, other);
      this.stateLabel = this._bird.stateLabel;
      return;
    }
    if (this.record.enabled === false) { this.group.visible = false; return; }
    this.group.visible = true;
    const gp = this.group.position;
    const adapter = this.adapter;
    const other = adapter.getOther?.() ?? otherAgent?.group?.position ?? null;

    // —— 关系矩阵：与「他者」（虎 / 雁群）的互动 ——
    const relList = this.record.relations || [];
    const rel = relList.find((r) => r.target === adapter.who) || relList.find((r) => r.target === "tiger");
    const td = other ? gp.distanceTo(other) : Infinity;
    const strength = rel?.strength ?? 0.5;
    this._fleeing = Math.max(0, this._fleeing - dt);

    const b = this.behavior;
    const bold = b.boldness ?? 0.5;                 // 胆量越大，惊逃阈值越远 → 越不畏他者
    const isPredator = ANIMALIVOROUS.has(this.semantics.diet);

    if (rel?.type === "predator-prey") {
      if (isPredator) {
        // 掠食者：向猎物（他者）潜近
        if (td < 20) { this._target = other.clone(); this.state = "WALK"; this.stateLabel = "潜近"; this._timer = 2; }
      } else if (td < (3 + strength * 6) * (0.6 + 0.4 * (1 - bold))) {
        // 猎物：背向他者全力惊逃
        const away = new THREE.Vector3().subVectors(gp, other).setY(0).normalize();
        this._target = gp.clone().addScaledVector(away, 6);
        this.state = "WALK"; this.stateLabel = "惊逃"; this._fleeing = 1.2; this._timer = 2;
      }
    } else if (rel?.type === "mutualism" && td > 5 && td < 16) {
      this._target = other.clone(); this.state = "WALK"; this.stateLabel = "亲近"; this._timer = 2;
    } else if (this._fleeing > 0) {
      this.state = "WALK";
    } else {
      // —— 漫游状态机：驻足 ↔ 行走向目标（由活跃度调制）——
      this._timer -= dt;
      const activity = b.activity ?? 0.6;
      const idleMin = 1.5 + (1 - activity) * 3;
      if (this.state === "WALK") {
        const arrived = this._target &&
          Math.hypot(this._target.x - gp.x, this._target.z - gp.z) < 0.5;
        if (arrived || this._timer <= 0) {
          this.state = "IDLE"; this._timer = idleMin + Math.random() * 2; this._target = null;
        }
      } else if (this._timer <= 0) {
        this.state = "WALK"; this._timer = 3 + (1 - activity) * 3 + Math.random() * 2;
        this._target = this._pickTarget();
      }
      this.stateLabel = this.state === "WALK" ? (this.saltatorial ? "蹦跳" : "漫游") : "驻足";
    }

    if (this._target) {
      if (Math.hypot(gp.x - this.home.x, gp.z - this.home.z) > 14) this._target = this.home.clone();
      this._heading = Math.atan2(this._target.x - gp.x, this._target.z - gp.z);
    }

    const targetMoving = this.state === "WALK" ? 1 : 0;
    this._movingCur += (targetMoving - this._movingCur) * Math.min(dt * 4, 1);
    const moving = this._movingCur;
    const g = this.record.gait ?? {};
    const fleeing = this._fleeing > 0;

    // 雪面打滑：位置相关滑度 → 转向漂移 + 降速（视觉打滑由控制器负责）
    const slip = adapter.snowSlick ? adapter.snowSlick(gp.x, gp.z) : 0;
    const onSnow = slip > 0.3;
    const drift = onSnow ? Math.sin(time * 7 + this._seed) * slip * 0.6 : 0;
    this._heading += drift * dt;
    const activity = b.activity ?? 0.6;
    const speed = (this.saltatorial ? 0.75 : 0.9) * (fleeing ? 1.9 : 1) *
      (0.7 + activity * 0.6) * (onSnow ? (1 - slip * 0.3) : 1);

    // 朝向平滑转向
    const yawErr = Math.atan2(
      Math.sin(this._heading - this.group.rotation.y), Math.cos(this._heading - this.group.rotation.y)
    );
    this.group.rotation.y += yawErr * Math.min(dt * 5, 1);

    if (this.saltatorial) {
      // 跳跃行：蹬地冲量段才有位移（一窜一窜），腾空抛物线
      this._gaitCyc = (this._gaitCyc + ((g.freq ?? 1) * speed / 0.45) * dt * Math.max(moving, 0.01)) % 1;
      const push = Math.max(0, Math.sin(this._gaitCyc * Math.PI * 2));
      const v = speed * push * moving;
      gp.x += Math.sin(this.group.rotation.y) * v * dt * 4;
      gp.z += Math.cos(this.group.rotation.y) * v * dt * 4;
      gp.y = adapter.groundHeight(gp.x, gp.z) + push * 0.09 * moving;
    } else {
      // 趾行/蹄行：匀速推进
      this._gaitCyc = (this._gaitCyc + ((g.freq ?? 1) * speed / 1.1) * dt * Math.max(moving, 0.01)) % 1;
      const v = speed * moving;
      gp.x += Math.sin(this.group.rotation.y) * v * dt;
      gp.z += Math.cos(this.group.rotation.y) * v * dt;
      gp.y = adapter.groundHeight(gp.x, gp.z);
    }

    this.entity.setBehaviorState(moving > 0.3 ? "WALK" : "IDLE");
    const tickCtx = {
      time, dt, gait: this._gaitCyc, moving,
      gaitAmp: g.swing ?? 1, spineAmp: g.spine ?? 1, tailAmp: g.tail ?? 1,
      crouch: onSnow ? Math.min(0.8, slip) : 0,   // 雪地：膝外展压低（与控制器 crouch 分支呼应）
      env: {
        isSnow: onSnow, slick: slip,
        isWater: adapter.isWater(gp.x, gp.z), waterLevel: adapter.waterLevel,
      },
    };
    // 跳跃行：蹬地冲量相位驱动 _hop 分支（腾空抛物线）
    if (this.saltatorial) tickCtx.leap = Math.max(0, Math.sin(this._gaitCyc * Math.PI * 2));
    this.entity.tick(tickCtx);
  }
}
