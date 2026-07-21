// 寒梅归雁图 · 大雁智能体：雁形目躯体（AvianBodyBuilder 比例覆写：长颈/肥体/短尾/阔翼）
// 行为：归飞编队（V 字）→ 盘旋渐降 → 定翼进近 → 拉平扑翼减速 → 触水滑跑 → 游水/上岸 →
//       休息觅食 → 踏水助跑 → 离地爬升归队，循环不息；飞行时翼面展开、巡航收蹼、起降垂脚
import * as THREE from "../assets/vendor/three/three.module.js";
import { buildAvianBody } from "./bio/AvianBodyBuilder.js";
import { makeRandom, groundHeight, waterLevelAt, landField, shorePoint, waterPoint, POND, PLUM_TREE_POS } from "./environment-plum.js";

// 白额雁造型：灰褐羽、长颈、阔翼（比例经 shape 覆写，雉科默认不受影响）
const GOOSE_STYLE = {
  height: 1.05, // 归雁为画幅焦点，较实物夸大
  bodyColor: 0x8a7a5f,   // 背羽灰褐
  accentColor: 0xd9d2c2, // 腹羽浅
  neckColor: 0x5f5344,   // 颈深
  wingColor: 0x6f6150,
  tailColor: 0x3f372c,
  shape: {
    bodyScale: [0.16, 0.15, 0.30], bodyY: 0.26,
    neckPos: [0, 0.42, 0.26], neckR: 0.07, neckSausage: true, neckScale: [1, 1.9, 1.6],
    headR: 0.048, headPos: [0, 0.095, 0.05], // 长颈顶端独立头球，喙目皆附其上
    crestCount: 0,
    beakR: 0.02, beakLen: 0.1, beakColor: 0x2e2a26, beakPos: [0, 0.095, 0.105],
    eyePos: [0.035, 0.105, 0.075], eyeR: 0.013,
    wingScale: [0.04, 0.1, 0.26], wingPivot: [0.1, 0.3, 0.04], wingTipX: 0.04,
    tailPos: [0, 0.26, -0.3], tailLen: 0.2, tailW: 0.05, tailCount: 5,
    legH: 0.18, legR: 0.01, legX: 0.05, legZ: -0.05, legColor: 0x4a4038,
  },
};

const CIRCUIT_TIME = 38;  // 归飞盘旋时长（秒）
const GROUNDED_TIME = 42; // 游水/岸栖时长（秒）
const CIRCUIT_ALT = 13;   // 盘旋高度（归雁居画幅中心焦点区）
const lerpAngle = (a, b, t) => {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * Math.min(t, 1);
};

class Goose {
  constructor(scene, opts = {}) {
    const style = opts.scale && opts.scale !== 1
      ? { ...GOOSE_STYLE, height: GOOSE_STYLE.height * opts.scale }
      : GOOSE_STYLE;
    const { group, head, headBone, headGroup, wings, tail, legs } = buildAvianBody(style);
    this.group = group;
    this.head = head;            // 中段颈骨 (Neck_Lower)
    this.headBone = headBone;    // 颈顶骨 (Neck_Upper)
    this.headGroup = headGroup;  // 头部几何载体
    this.wings = wings;
    this.tail = tail;
    this.legs = legs;
    scene.add(group);

    this.rand = makeRandom(opts.seed ?? 1);
    this.state = opts.airborne ? "FORM" : "REST";
    this.yaw = this.rand() * Math.PI * 2;
    this.pitch = 0;
    this.roll = 0;
    this.speed = 0;
    this.flapPhase = this.rand() * 10;
    this.flapping = !opts.airborne ? false : true;
    this.timer = this.rand() * 6;
    this.target = new THREE.Vector3();
    this.walkTarget = null;
    this.slotIdx = opts.slotIdx ?? 0;
    this.sfx = opts.sfx || null;   // 起飞扑翼声（GooseSfx.flap）
    this._beat = false;            // 本帧是否完成一次振翅
    // 起降阶段标志：踏水助跑中 / 已拉平 / 已触水
    this._airborne = false;
    this._flare = false;
    this._touchdown = false;
  }

  get pos() { return this.group.position; }

  get stateLabel() {
    return {
      FORM: "归飞", LAND: "降落", SWIM: "游水",
      FORAGE: "觅食", REST: "栖止", TAKEOFF: "起飞",
    }[this.state] ?? this.state;
  }

  /** 翅膀：扑翼（下扑快、回抬慢）/ 减速扑翼 / 滑翔 / 收拢；飞行时翼面 morph 展开
      角度约定（翼根为轴，几何沿 -y 伸展）：0=垂贴体侧，π/2=水平展开 */
  _wings(dt, mode) {
    let targetZ = 0.35; // 收拢：垂贴体侧微张
    let spread = 0;     // 翼展目标（0=收拢，1=全展）
    this._beat = false; // 本帧是否完成一次振翅（用于起飞扑翼声）
    if (mode === "flap") {
      // 有力扑翼：相位加弯，下扑段角速度大、回抬段缓（似真雁振翅）
      const prevBeat = Math.floor(this.flapPhase / (Math.PI * 2));
      this.flapPhase += dt * 13;
      this._beat = Math.floor(this.flapPhase / (Math.PI * 2)) > prevBeat; // 跨过一个周期 = 一拍
      const p = this.flapPhase % (Math.PI * 2);
      const warped = p - 0.45 * Math.sin(p);
      targetZ = 1.5 + Math.sin(warped) * 0.75; // 下出 0.75 ~ 上扬 2.25
      spread = 1;
    } else if (mode === "brake") {
      // 降落减速：高频小幅扑翼
      this.flapPhase += dt * 22;
      targetZ = 1.4 + Math.sin(this.flapPhase) * 0.35;
      spread = 1;
    } else if (mode === "glide") {
      targetZ = 1.6 + Math.sin(this.flapPhase * 0.1) * 0.05; // 近水平定翼微张
      spread = 1;
    }
    for (const w of this.wings) {
      const want = w.side * targetZ;
      w.pivot.rotation.z += (want - w.pivot.rotation.z) * Math.min(dt * 8, 1);
      // 翼展 morph：飞时翼面沿展向伸长（雁翼展约为体长 1.5 倍），栖时收回贴体
      // （几何根部已钉在 pivot 原点，scale 只向翼尖侧伸展）
      if (w.mesh) {
        const sy = 1 + spread * 2.4;
        const sz = 1 + spread * 0.5;
        w.mesh.scale.y += (sy - w.mesh.scale.y) * Math.min(dt * 4, 1);
        w.mesh.scale.z += (sz - w.mesh.scale.z) * Math.min(dt * 4, 1);
      }
    }
    // 起飞时每完成一拍振翅，发出"扑楞"扑翼声
    if (this._beat && this.state === "TAKEOFF" && this.sfx) {
      this.sfx.flap(this._airborne ? 1.1 : 0.85);
    }
  }

  /** 双腿：起降垂脚（dangle）/ 巡航收蹼（tuck）/ 立地游水（stand） */
  _legs(dt, mode) {
    const want = mode === "dangle" ? -0.5 : mode === "tuck" ? 0.9 : 0;
    for (const leg of this.legs ?? []) {
      leg.rotation.x += (want - leg.rotation.x) * Math.min(dt * 5, 1);
    }
  }

  /**
   * 大雁长颈流体运动学（科学建模 · S 型曲线 + 探头顿挫）
   * 复用与锦鸡一致的双颈骨相位差对冲 + 幂次顿挫正弦(pow3) + 视线锁定补偿；
   * 大雁颈更长，幅值略放大，呈现在世界空间中的生物顿挫探头。
   * mode: 'walk' 踱步顿挫 | 'peck' 点首觅食 | 'preen' 理羽 | 'level' 平视(飞行/游水)
   */
  _head(dt, mode) {
    const n1 = this.head, n2 = this.headBone, hg = this.headGroup;
    const k = Math.min(dt * 9, 1);
    const setR = (o, x, y) => { o.rotation.x += (x - o.rotation.x) * k; o.rotation.y += (y - o.rotation.y) * k; };
    if (mode === "walk") {
      // 🦢 行走探头顿挫公式（大雁步伐频率稍缓于锦鸡）
      const tick = this.time * 4.6;
      const step = Math.sin(tick);
      const jerk = Math.pow(Math.sin(tick), 3.0);
      const jerkC = Math.pow(Math.cos(tick), 3.0);
      const n1x = 0.18 + jerk * 0.30;            // 颈根前压
      const n1y = step * 0.10;
      const n2x = -0.30 - Math.pow(Math.sin(tick - 0.4), 3.0) * 0.42; // 反向对冲 → S 型长颈
      const n2y = -Math.sin(tick - 0.4) * 0.10;
      n1.rotation.x += (n1x - n1.rotation.x) * k;
      n1.rotation.y += (n1y - n1.rotation.y) * k;
      n2.rotation.x += (n2x - n2.rotation.x) * k;
      n2.rotation.y += (n2y - n2.rotation.y) * k;
      if (hg) { hg.rotation.x += (-(n1x + n2x) + 0.05 + jerkC * 0.07 - hg.rotation.x) * k; hg.rotation.y += (-(n1y + n2y) - hg.rotation.y) * k; } // 视线锁定
    } else if (mode === "peck") {
      // 停下频频点首（颈根为主，叠加视线补偿）
      const px = Math.sin(this.time * 6) > 0 ? 0.95 : 0.15;
      n1.rotation.x += (px - n1.rotation.x) * k;
      n2.rotation.x += (-0.2 - n2.rotation.x) * k;
      if (hg) { hg.rotation.x += (-(px - 0.2) + 0.1 - hg.rotation.x) * k; }
    } else if (mode === "preen") {
      n1.rotation.y += (Math.sin(this.time * 1.8) * 1.2 - n1.rotation.y) * k;
      n1.rotation.x += (0.5 + Math.sin(this.time * 3) * 0.2 - n1.rotation.x) * k;
      n2.rotation.x += (-0.2 - n2.rotation.x) * k;
      if (hg) hg.rotation.x += (-(n1.rotation.x + n2.rotation.x) - hg.rotation.x) * k;
    } else { // level：平视微呼吸 S 摆（飞行/游水）
      const br = Math.sin(this.time * 1.5) * 0.05;
      setR(n1, br, 0); setR(n2, -br * 0.8, 0);
      if (hg) hg.rotation.x += (-br * 0.2 - hg.rotation.x) * k;
    }
  }

  _applyAttitude(dt) {
    this.group.rotation.set(this.pitch, this.yaw, this.roll, "YXZ");
  }

  /** 岸边踱步目标：多取候选择最干者；全湿（梅环湾）则退回梅根北侧干地 */
  _walkSpot(range = 5) {
    let best = null, bestL = -Infinity;
    for (let k = 0; k < 4; k++) {
      const x = this.pos.x + (this.rand() - 0.5) * range;
      const z = this.pos.z + (this.rand() - 0.5) * range;
      const L = landField(x, z);
      if (L > bestL) { bestL = L; best = { x, z }; }
    }
    if (bestL < 0.15) {
      const sp = shorePoint(best.x, best.z);
      const dx = sp.x - POND.cx, dz = sp.z - POND.cz;
      const l = Math.hypot(dx, dz) || 1;
      best = { x: sp.x + (dx / l) * 1.2, z: sp.z + (dz / l) * 1.2 };
      if (landField(best.x, best.z) < 0.15) {
        best = { x: PLUM_TREE_POS.x + (this.rand() - 0.5) * 2, z: PLUM_TREE_POS.z + 1.5 + this.rand() };
      }
    }
    return new THREE.Vector3(best.x, 0, best.z);
  }

  update(dt, time, flock) {
    this.time = time;
    this.timer -= dt;
    switch (this.state) {
      case "FORM": this._updateForm(dt, flock); break;
      case "LAND": this._updateLand(dt); break;
      case "SWIM": this._updateSwim(dt); break;
      case "FORAGE": this._updateForage(dt); break;
      case "REST": this._updateRest(dt); break;
      case "TAKEOFF": this._updateTakeoff(dt); break;
    }
    this._applyAttitude(dt);
  }

  // —— 归飞：跟随编队槽位 ——
  _updateForm(dt, flock) {
    const slot = flock.slotPos(this.slotIdx);
    const to = slot.clone().sub(this.pos);
    const dist = to.length();
    const dir = to.normalize();
    this.speed = THREE.MathUtils.clamp(dist * 1.6, 3.2, 7.5);
    this.pos.addScaledVector(dir, this.speed * dt);
    const wantYaw = Math.atan2(dir.x, dir.z);
    const dy = wantYaw - this.yaw;
    this.yaw = lerpAngle(this.yaw, wantYaw, dt * 3.5);
    this.roll = THREE.MathUtils.clamp(dy * 1.6, -0.45, 0.45);
    this.pitch = THREE.MathUtils.clamp(-dir.y * 0.7, -0.35, 0.3);
    this.flapping = dist > 2.2 || dir.y > 0.08 || (this.time + this.slotIdx) % 5 < 2.6;
    this._wings(dt, this.flapping ? "flap" : "glide");
    this._legs(dt, "tuck"); // 巡航收蹼于尾下
    this._head(dt, "level");
  }

  // —— 降落：定翼滑翔进近 → 拉平高频扑翼减速 → 触水滑跑 → 游水 ——
  _updateLand(dt) {
    const to = this.target.clone().sub(this.pos);
    const dist = to.length();
    const dir = to.normalize();
    const wl = waterLevelAt() + 0.04;
    this.yaw = lerpAngle(this.yaw, Math.atan2(dir.x, dir.z), dt * 2.5);
    this.roll *= 1 - Math.min(dt * 3, 1);
    if (!this._flare && dist > 8) {
      // 进近：定翼滑翔，对准落点渐降
      this.speed = THREE.MathUtils.clamp(dist * 0.9, 2.2, 5.5);
      this.pos.addScaledVector(dir, this.speed * dt);
      this.pitch = THREE.MathUtils.clamp(-dir.y * 0.6, -0.3, 0.25);
      this._wings(dt, "glide");
      this._legs(dt, "dangle");
    } else if (!this._touchdown) {
      // 拉平：昂首减速、高频小幅扑翼、双脚下垂备触水
      this._flare = true;
      this.speed = Math.max(this.speed - dt * 2.6, 1.4);
      this.pos.addScaledVector(dir, this.speed * dt);
      this.pos.y += (wl + 0.35 - this.pos.y) * Math.min(dt * 2.2, 1);
      this.pitch += (-0.32 - this.pitch) * Math.min(dt * 4, 1);
      this._wings(dt, "brake");
      this._legs(dt, "dangle");
      if (dist < 2.2 || (this.pos.y <= wl + 0.4 && this.speed <= 1.6)) this._touchdown = true;
    } else {
      // 触水：脚蹼滑水减速，扬翅渐收，停定入游
      this.speed = Math.max(this.speed - dt * 2.2, 0);
      this.pos.addScaledVector(dir, this.speed * dt);
      this.pos.y += (wl - this.pos.y) * Math.min(dt * 5, 1);
      this.pitch += (-0.12 - this.pitch) * Math.min(dt * 3, 1);
      this._wings(dt, this.speed > 0.6 ? "brake" : "glide");
      this._legs(dt, "dangle");
      if (this.speed < 0.25) {
        this.pos.y = wl;
        this.state = "SWIM";
        this.timer = 6 + this.rand() * 8;
        this.speed = 0;
        this._flare = this._touchdown = false;
        this.returnToTree = false; // 新一轮游水，清除上轮遗留的回梅标记
      }
    }
    this._head(dt, "level");
  }

  // —— 游水：缓行换向；或先游到梅树一侧近岸，再上岸回梅根乘凉 ——
  _updateSwim(dt) {
    if (this.timer <= 0) {
      if (this.returnToTree || this.rand() < 0.5) {
        this.returnToTree = true;
        const tp = this._nearTreeWater();
        this.target.set(tp.x, waterLevelAt(), tp.z);
        this.timer = 25;
      } else {
        const wp = waterPoint(this.pos.x + (this.rand() - 0.5) * 24, this.pos.z + (this.rand() - 0.5) * 24);
        this.target.set(wp.x, waterLevelAt(), wp.z);
        this.timer = 6 + this.rand() * 8;
      }
    }
    const to = this.target.clone().sub(this.pos); to.y = 0;
    const dist = to.length();
    if (dist > 0.3) {
      const dir = to.normalize();
      this.speed = 0.5;
      this.pos.addScaledVector(dir, this.speed * dt);
      this.yaw = lerpAngle(this.yaw, Math.atan2(dir.x, dir.z), dt * 1.6);
    } else {
      this.speed = 0;
      if (this.returnToTree && landField(this.pos.x, this.pos.z) < -1) {
        // 未抵岸却被冲散（深水中）：重新指派近岸水点，不上岸
        this.returnToTree = false;
        const wp = waterPoint(this.pos.x + (this.rand() - 0.5) * 16, this.pos.z + (this.rand() - 0.5) * 16);
        this.target.set(wp.x, waterLevelAt(), wp.z);
        this.timer = 8;
      } else if (this.returnToTree) { // 已到近岸浅水：上岸踱至梅根
        this.returnToTree = false;
        let x = PLUM_TREE_POS.x + (this.rand() - 0.5) * 7, z = PLUM_TREE_POS.z + 0.6 + this.rand() * 2.4;
        if (landField(x, z) < 0.15) {
          const sp = shorePoint(x, z);
          const dx = sp.x - POND.cx, dz = sp.z - POND.cz;
          const l = Math.hypot(dx, dz) || 1;
          x = sp.x + (dx / l) * 0.9; z = sp.z + (dz / l) * 0.9;
          if (landField(x, z) < 0.15) { x = PLUM_TREE_POS.x; z = PLUM_TREE_POS.z + 1.5; } // 环湾内退回梅根北
        }
        this.walkTarget = new THREE.Vector3(x, 0, z);
        this.state = "FORAGE";
        this.timer = 24;
      }
    }
    this.pos.y = waterLevelAt() + 0.04 + Math.sin(this.time * 2 + this.slotIdx) * 0.015;
    this.pitch = 0; this.roll *= 1 - Math.min(dt * 3, 1);
    this._wings(dt, "fold");
    this._legs(dt, "stand");
    this._head(dt, Math.sin(this.time * 0.5 + this.slotIdx * 2) > 0.75 ? "peck" : "level");
  }

  /** 梅树一侧水线点（e≈1.0，足尖及岸即上岸） */
  _nearTreeWater() {
    const sp = shorePoint(PLUM_TREE_POS.x + (this.rand() - 0.5) * 10, PLUM_TREE_POS.z);
    const k = 1.0 / 1.06; // 岸点 e=1.06，沿射线内缩至水线 e=1.0
    return { x: POND.cx + (sp.x - POND.cx) * k, z: POND.cz + (sp.z - POND.cz) * k };
  }

  // —— 觅食：岸边踱步啄食 ——
  _updateForage(dt) {
    if (!this.walkTarget) this.walkTarget = new THREE.Vector3(this.pos.x, 0, this.pos.z);
    const to = this.walkTarget.clone().sub(this.pos); to.y = 0;
    const dist = to.length();
    if (dist > 0.25) {
      const dir = to.normalize();
      this.speed = 0.55;
      this.pos.addScaledVector(dir, this.speed * dt);
      this.yaw = lerpAngle(this.yaw, Math.atan2(dir.x, dir.z), dt * 2.5);
      this._head(dt, "walk"); // 踱步 S 型长颈探头顿挫
    } else {
      this.speed = 0;
      this._head(dt, "peck");
      if (this.timer <= 0) {
        if (this.rand() < 0.35) { this.state = "REST"; this.timer = 8 + this.rand() * 10; }
        else {
          this.walkTarget = this._walkSpot(5);
          this.timer = 6 + this.rand() * 8;
        }
      }
    }
    this.pos.y = groundHeight(this.pos.x, this.pos.z);
    this.pitch = 0; this.roll *= 1 - Math.min(dt * 3, 1);
    this._wings(dt, "fold");
    this._legs(dt, "stand");
  }

  // —— 栖止：立定或理羽 ——
  _updateRest(dt) {
    this.speed = 0;
    this.pos.y = groundHeight(this.pos.x, this.pos.z);
    this._wings(dt, "fold");
    this._legs(dt, "stand");
    this._head(dt, Math.sin(this.time * 0.4 + this.slotIdx * 3) > 0.55 ? "preen" : "level");
    if (this.timer <= 0) {
      this.state = "FORAGE";
      this.walkTarget = this._walkSpot(4);
      this.timer = 8 + this.rand() * 8;
    }
  }

  // —— 起飞：踏水助跑（剧烈扑翼渐加速）→ 离地浅角爬升，脚先垂后收 ——
  _updateTakeoff(dt) {
    const toCenter = Math.atan2(POND.cx - this.pos.x, POND.cz - this.pos.z);
    this.yaw = lerpAngle(this.yaw, toCenter, dt * 2);
    const dir = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    if (!this._airborne) {
      // 踏水助跑：沿水面奔踏，昂首渐增，速度不足不起飞
      this.speed = Math.min(this.speed + dt * 3.2, 6.5);
      this.pos.addScaledVector(dir, this.speed * dt);
      const surf = Math.max(groundHeight(this.pos.x, this.pos.z), waterLevelAt()) + 0.04;
      this.pos.y = surf + Math.abs(Math.sin(this.time * 18)) * 0.05; // 脚蹼拍水颠动
      this.pitch += (-0.22 - this.speed * 0.02 - this.pitch) * Math.min(dt * 3, 1);
      this._wings(dt, "flap");
      this._legs(dt, "dangle");
      if (this.speed > 5.2) this._airborne = true;
    } else {
      // 离地爬升：深缓有力振翅，浅角渐升
      this.pos.addScaledVector(dir, this.speed * dt);
      this.pos.y += dt * 2.2;
      this.pitch += (-0.3 - this.pitch) * Math.min(dt * 3, 1);
      this._wings(dt, "flap");
      this._legs(dt, this.pos.y > waterLevelAt() + 3 ? "tuck" : "dangle");
      if (this.pos.y > waterLevelAt() + 6.5) {
        this.state = "FORM";
        this._airborne = false;
      }
    }
    this.roll *= 1 - Math.min(dt * 3, 1);
    this._head(dt, "level");
  }
}

export class GooseFlock {
  constructor(scene, config, env, sfx) {
    this.scene = scene;
    this.env = env;
    const P = config.plum ?? {};
    const nFly = Math.max(1, Math.round(P.flockGeese ?? 5));
    const nRest = Math.max(0, Math.round(P.restGeese ?? 3));
    const scale = P.gooseScale ?? 1.0;
    this.sfx = sfx || null;
    this.circuitTime = P.circuitTime ?? CIRCUIT_TIME;
    this.groundedTime = P.groundedTime ?? GROUNDED_TIME;
    this.circuitAlt = P.circuitAlt ?? CIRCUIT_ALT;
    this.geese = [];

    // 归飞雁群：初始已在空中盘旋（第 0 只为领头雁）
    this.theta = 0.6;
    this.mode = "circuit";
    this.modeT = 0;
    this.alt = this.circuitAlt;
    for (let i = 0; i < nFly; i++) {
      const g = new Goose(scene, { airborne: true, seed: 100 + i, slotIdx: i, scale, sfx: this.sfx });
      const a = this.theta - i * 0.16;
      const R = this._radius();
      g.pos.set(POND.cx + Math.cos(a) * R, this.alt - (i % 2) * 0.5, POND.cz + Math.sin(a) * R);
      g.yaw = a + Math.PI / 2;
      this.geese.push(g);
    }
    // 塘边休息雁群：栖于梅根近旁的入水缓坡（第三层），沿水线一字错落
    const T = PLUM_TREE_POS;
    const anchors = [
      [-4.2, 1.2], [2.6, 1.6], [-7.4, 2.0], [5.8, 2.4],
      [-10.6, 2.8], [8.8, 3.2], [-13.4, 3.6], [11.6, 4.0],
    ];
    for (let i = 0; i < nRest; i++) {
      const g = new Goose(scene, { airborne: false, seed: 200 + i, slotIdx: nFly + i, scale, sfx: this.sfx });
      const [dx, dz] = anchors[i % anchors.length];
      let x = T.x + dx + (g.rand() - 0.5) * 1.2;
      let z = T.z + dz + (g.rand() - 0.5) * 1.2;
      if (landField(x, z) < 0.15) { const sp = shorePoint(x, z); x = sp.x; z = sp.z; }
      g.pos.set(x, groundHeight(x, z), z);
      g.state = i % 2 ? "FORAGE" : "REST";
      g.walkTarget = new THREE.Vector3(x, 0, z);
      this.geese.push(g);
    }
    this.flyCount = nFly;
  }

  get leader() { return this.geese[0]; }

  /** 编队槽位：领头雁沿圆周，余者 V 字尾随两侧 */
  slotPos(i) {
    const R = this._radius();
    const cx = POND.cx, cz = POND.cz;
    const lx = cx + Math.cos(this.theta) * R;
    const lz = cz + Math.sin(this.theta) * R;
    if (i === 0) return new THREE.Vector3(lx, this.alt, lz);
    // 领头雁航向（切线方向）
    const hx = -Math.sin(this.theta), hz = Math.cos(this.theta);
    const rank = Math.ceil(i / 2), side = i % 2 === 1 ? 1 : -1;
    const back = rank * 1.9, lateral = side * rank * 1.6;
    return new THREE.Vector3(
      lx - hx * back + hz * lateral,
      this.alt - rank * 0.35,
      lz - hz * back - hx * lateral);
  }

  _radius() {
    // 盘旋渐收：18 → 12（居画幅中心焦点区）
    const t = Math.min(this.modeT / this.circuitTime, 1);
    return 18 - 6 * t;
  }

  /** 面板状态：归飞 X · 游水 X · 栖止 X */
  get stateLabel() {
    const c = { FORM: 0, LAND: 0, SWIM: 0, FORAGE: 0, REST: 0, TAKEOFF: 0 };
    for (const g of this.geese) c[g.state] = (c[g.state] ?? 0) + 1;
    const parts = [];
    if (c.FORM || c.TAKEOFF) parts.push(`归飞 ${c.FORM + c.TAKEOFF}`);
    if (c.LAND) parts.push(`降落 ${c.LAND}`);
    if (c.SWIM) parts.push(`游水 ${c.SWIM}`);
    const ashore = c.FORAGE + c.REST;
    if (ashore) parts.push(`栖止 ${ashore}`);
    return parts.join(" · ") || "—";
  }

  update(dt, time) {
    this.modeT += dt;
    const flyers = this.geese.slice(0, this.flyCount);

    if (this.mode === "circuit") {
      // 领头圆周：角速度随半径（航速约 5.2 m/s），高度 10 → 2.5 渐降
      const R = this._radius();
      this.theta += (5.2 / R) * dt;
      const t = Math.min(this.modeT / this.circuitTime, 1);
      this.alt = this.circuitAlt - (this.circuitAlt - 2.5) * t * t;
      if (this.modeT >= this.circuitTime) {
        // 依次指派水面落点（偏向梅树一侧水域），转入降落
        for (const g of flyers) {
          const wp = waterPoint(PLUM_TREE_POS.x + (g.rand() - 0.5) * 16, PLUM_TREE_POS.z + (g.rand() - 0.5) * 6);
          g.target.set(wp.x, waterLevelAt(), wp.z);
          g.state = "LAND";
        }
        this.mode = "landing";
      }
    } else if (this.mode === "landing") {
      if (flyers.every((g) => g.state === "SWIM" || g.state === "FORAGE" || g.state === "REST")) {
        this.mode = "grounded";
        this.modeT = 0;
      }
    } else if (this.mode === "grounded") {
      if (this.modeT >= this.groundedTime) {
        // 起飞归队：领头先行，余者错拍
        flyers.forEach((g, i) => {
          g._launchAt = time + i * 1.4;
        });
        this.mode = "launch";
      }
    } else if (this.mode === "launch") {
      // 集合归队：编队圆周缓转、高度渐升，先入队者盘旋等候
      this.alt = Math.min(this.alt + dt * 1.6, this.circuitAlt);
      this.theta += (5.2 / this._radius()) * dt;
      let allAir = true;
      for (const g of flyers) {
        if (g.state !== "FORM" && g.state !== "TAKEOFF" && time >= g._launchAt) g.state = "TAKEOFF";
        if (g.state !== "FORM") allAir = false;
      }
      if (allAir) {
        this.mode = "circuit";
        this.modeT = 0;
        this.alt = this.circuitAlt;
        // 以领头雁当前位置接续圆周
        const p = this.leader.pos;
        this.theta = Math.atan2(p.z - POND.cz, p.x - POND.cx);
      }
    }

    for (const g of this.geese) g.update(dt, time, this);

    // 涟漪：游水与近水降落者（最多 4 个）
    const swimmers = [];
    for (const g of this.geese) {
      if (g.state === "SWIM") swimmers.push({ x: g.pos.x, z: g.pos.z, strength: 0.8 });
      else if (g.state === "LAND" && g.pos.y < waterLevelAt() + 1.2) swimmers.push({ x: g.pos.x, z: g.pos.z, strength: 0.5 });
      if (swimmers.length >= 4) break;
    }
    this.env.updateSwimmers(swimmers);
  }
}
