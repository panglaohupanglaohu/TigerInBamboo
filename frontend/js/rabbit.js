// 雪兔智能体：行为层（小半径随机蹦跳、驻足竖耳）
// 身体由生物生成管线构建：数据仓库 LAGOMORPHA → SALTATORIAL 骨骼 → 程序化蒙皮 → 双跃驱动
// 体型小，不设物理刚体（不推竹）；耳/绒尾等外观件挂骨骼随动
import * as THREE from "three";
import { groundHeight, streamQuery } from "./environment.js";
import { BIOLOGICAL_TAXONOMY } from "./bio/BiologicalTaxonomyRegistry.js";
import { BioEntityMesh } from "./bio/BioEntityMesh.js";

const CREAM = 0xf5f0e6;   // 耳内/绒尾
const PINK = 0xc98a8a;    // 鼻
const DARK = 0x1a1410;    // 眼

export class Rabbit {
  constructor(scene, config, grove) {
    this.scene = scene;
    this.config = config;
    this._grove = grove;               // 竹林环游的目标来源
    this.state = "IDLE";
    this.stateLabel = "驻足";
    this._timer = 2 + Math.random() * 2;   // 状态倒计时
    this._target = null;               // 当前蹦跳目标点
    this._heading = Math.random() * Math.PI * 2;
    this._movingCur = 0;
    this._gaitCyc = 0;
    this.home = new THREE.Vector3(-1, 0, 4); // 溪涧东岸的活动中心（环游不离家太远）

    // 生物生成管线：架构自动识别 SALTATORIAL，编译灰兔毛与跳跃骨骼
    const family = BIOLOGICAL_TAXONOMY.LAGOMORPHA.LEPORIDAE;
    const species = family.LEPUS.TIMIDUS;
    this.entity = new BioEntityMesh(family, species);
    this.group = this.entity;
    this.group.position.set(this.home.x, groundHeight(this.home.x, this.home.z), this.home.z);
    this._buildDetails();
    scene.add(this.group);
  }

  /** 环游目标：优先取活动半径内的随机竹竿（逐竹蹦跳即"竹林环游"）；竹稀则绕家转，避开水线 */
  _pickTarget() {
    const R = this.config.rabbit?.roamRadius ?? 6;
    const home = this.home;
    const cands = (this._grove?.bamboos ?? []).filter(
      (b) => Math.hypot(b.x - home.x, b.z - home.z) < R
    );
    if (cands.length) {
      const b = cands[(Math.random() * cands.length) | 0];
      return new THREE.Vector3(b.x + (Math.random() - 0.5) * 1.2, 0, b.z + (Math.random() - 0.5) * 1.2);
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = R * (0.4 + Math.random() * 0.6);
      const x = home.x + Math.cos(a) * r, z = home.z + Math.sin(a) * r;
      const q = streamQuery(x, z);
      if (q.d > q.halfW + 1.2) return new THREE.Vector3(x, 0, z);
    }
    return home.clone();
  }

  /** 外观件：长耳（挂 Ear_L/Ear_R 骨）、眼鼻、绒尾，随骨骼运动 */
  _buildDetails() {
    const B = this.entity.boneMap;
    const earLen = this.entity.species.anatomicalRef.earLength;
    const furMat = new THREE.MeshStandardMaterial({ color: 0xd3d3d3, roughness: 0.75 });
    const creamMat = new THREE.MeshStandardMaterial({ color: CREAM, roughness: 0.8 });
    const cast = (m) => { m.castShadow = true; return m; };

    // 长耳：外灰内粉的扁椭圆，耳根挂骨、耳梢向上（骨旋转即惯性摆动）
    for (const [key, s] of [["Ear_L", -1], ["Ear_R", 1]]) {
      const bone = B.get(key);
      const outer = cast(new THREE.Mesh(new THREE.SphereGeometry(earLen * 0.24, 10, 8), furMat));
      outer.scale.set(0.55, earLen / (earLen * 0.48), 0.28); // 高约 earLen
      outer.position.set(0, earLen * 0.45, 0);
      outer.rotation.z = -s * 0.08;
      bone.add(outer);
      const inner = new THREE.Mesh(new THREE.SphereGeometry(earLen * 0.15, 8, 6), creamMat);
      inner.scale.set(0.5, earLen / (earLen * 0.3) * 0.8, 0.2);
      inner.position.set(0, earLen * 0.42, earLen * 0.07);
      bone.add(inner);
    }

    // 眼（大而侧置）+ 粉鼻
    const head = B.get("Head");
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8),
        new THREE.MeshStandardMaterial({ color: DARK, roughness: 0.25 }));
      eye.position.set(s * 0.03, 0.008, 0.02);
      head.add(eye);
    }
    const nose = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.01, 0.012),
      new THREE.MeshStandardMaterial({ color: PINK, roughness: 0.6 }));
    nose.position.set(0, -0.005, 0.048);
    head.add(nose);

    // 绒尾：尾根小毛球
    const pom = cast(new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), creamMat));
    pom.position.set(0, 0.005, -0.01);
    B.get("Tail3").add(pom);
  }

  /** 每帧：驻足 ↔ 蹦跳向目标（竹林环游）；行进只发生在蹬地冲量段（一窜一窜）
   *  女儿（虎）靠近时，母亲驻足等候 */
  update(dt, time, tiger) {
    if (this.config.rabbit?.enabled === false) { this.group.visible = false; return; }

    // 虎近身 5m 内：母亲察觉动静，停下等候（不逃、不再起跳）
    const tigerNear = tiger && tiger.group.visible !== false &&
      tiger.group.position.distanceTo(this.group.position) < 5.0;
    if (tigerNear) {
      this._target = null;
      this.state = "IDLE";
      this._timer = Math.max(this._timer, 0.5);
    }

    this._timer -= dt;
    if (this.state === "WALK") {
      const arrived = this._target &&
        Math.hypot(this._target.x - this.group.position.x, this._target.z - this.group.position.z) < 0.45;
      if (arrived || this._timer <= 0) {
        this.state = "IDLE";
        this._timer = 1.5 + Math.random() * 2.5;
        this._target = null;
      }
    } else if (this._timer <= 0) {
      this.state = "WALK";
      this._timer = 3.5 + Math.random() * 2;
      this._target = this._pickTarget();
    }

    // 朝向目标点（越界保护：离家太远先回家）
    if (this._target) {
      const dh = Math.hypot(this.group.position.x - this.home.x, this.group.position.z - this.home.z);
      if (dh > (this.config.rabbit?.roamRadius ?? 6) * 1.8) {
        this._target = this.home.clone();
      }
      this._heading = Math.atan2(
        this._target.x - this.group.position.x, this._target.z - this.group.position.z
      );
    }

    const targetMoving = this.state === "WALK" ? 1 : 0;
    this._movingCur += (targetMoving - this._movingCur) * Math.min(dt * 4, 1);
    const moving = this._movingCur;

    // 步态相位推进：每周期一次腾跃，蹬地段才有水平位移
    const speed = this.config.rabbit?.speed ?? 0.7;
    this._gaitCyc = (this._gaitCyc + (speed / 0.45) * dt * Math.max(moving, 0.01)) % 1;
    const push = Math.max(0, Math.sin(this._gaitCyc * Math.PI * 2));
    const yaw = Math.atan2(
      Math.sin(this._heading - this.group.rotation.y), Math.cos(this._heading - this.group.rotation.y)
    );
    this.group.rotation.y += yaw * Math.min(dt * 5, 1);
    const v = speed * push * moving;
    this.group.position.x += Math.sin(this.group.rotation.y) * v * dt * 4;
    this.group.position.z += Math.cos(this.group.rotation.y) * v * dt * 4;
    // 地面贴合 + 腾空抛物线
    this.group.position.y =
      groundHeight(this.group.position.x, this.group.position.z) + push * 0.09 * moving;

    this.stateLabel = moving > 0.3 ? "蹦跳" : "驻足";
    this.entity.setBehaviorState(moving > 0.3 ? "WALK" : "IDLE");
    this.entity.tick({ time, dt, gait: this._gaitCyc, moving });
  }
}
