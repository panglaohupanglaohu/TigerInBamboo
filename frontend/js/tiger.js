// 猛虎智能体：行为层（巡游路径、驻足状态机、物理刚体、缠竹尾）
// 身体由生物生成管线构建：数据仓库 → 骨骼装配 → 程序化蒙皮 → 状态机驱动
// 斑纹（拟狩野山乐《竹虎图》的斑斓）以顶点色注入；物理为 Cannon kinematic 刚体
import * as THREE from "three";
import * as CANNON from "cannon-es";
import { groundHeight } from "./environment.js";
import { GROUP } from "./physics.js";
import { BIOLOGICAL_TAXONOMY } from "./bio/BiologicalTaxonomyRegistry.js";
import { BioEntityMesh } from "./bio/BioEntityMesh.js";

const ORANGE = new THREE.Color(0xd27a24);
const ORANGE_DEEP = new THREE.Color(0xb5621a);
const DARK = new THREE.Color(0x1d140d);
const CREAM = new THREE.Color(0xf2e8d5);

// 虎斑绘制：沿体长波浪斑纹 + 腹底留白（画谱"斑斓"意）；腿管画环纹、爪尖留白
// 腿管位置与 ProceduralSkinGenerator._legDefs 一致（虎 dimensions 导出值）
const LEG_REGIONS = [
  { x: -0.26, z: 0.65 }, { x: 0.26, z: 0.65 },
  { x: -0.27, z: -0.65 }, { x: 0.27, z: -0.65 },
];
function legRegionAt(x, z, y) {
  if (y > 1.01) return false;
  for (const L of LEG_REGIONS) {
    if (Math.hypot(x - L.x, z - L.z) < 0.16) return true;
  }
  return false;
}

function paintTiger(geo, { freq = 14, belly = 0.7, contrast = 1 } = {}) {
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (legRegionAt(x, z, y)) {
      // 腿管：橙底环纹（沿 y），爪尖留白
      const ring = Math.sin(y * 22 + Math.sin(Math.atan2(z, x) * 4) * 0.8);
      const shade = THREE.MathUtils.clamp(0.45 + y * 0.4, 0, 1);
      c.copy(ORANGE_DEEP).lerp(ORANGE, shade);
      if (y < 0.14) c.copy(CREAM);
      else if (ring > 0.35) c.lerp(DARK, THREE.MathUtils.smoothstep(ring, 0.35, 0.9) * 0.7 * contrast);
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      continue;
    }
    const along = z;
    const across = Math.atan2(x, y + 1e-4);
    const w1 = Math.sin(along * freq + Math.sin(across * 3 + along * 0.7) * 1.3);
    const w2 = Math.sin(across * 7 + along * 2.3); // 断续：虎纹不成环、节节垂落
    const wave = w1 + w2 * 0.4;
    const shade = THREE.MathUtils.clamp(0.5 + y * 0.5, 0, 1);
    c.copy(ORANGE_DEEP).lerp(ORANGE, shade);
    if (y < belly) {
      c.copy(CREAM); // 腹底与下颌留白
    } else if (wave > 0.2) {
      const k = THREE.MathUtils.smoothstep(wave, 0.2, 0.85) * contrast;
      c.lerp(DARK, Math.min(k, 1));
    }
    colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
}

export class Tiger {
  constructor(scene, config, physics) {
    this.scene = scene;
    this.config = config;
    this.state = "巡游";
    this.pathT = 0;
    this._speedCur = 0;
    this._gaitCyc = 0;
    this._pauseTimer = (config.tiger.pauseInterval ?? 16) * (0.9 + Math.random() * 0.5); // 首次驻足计时
    this._pauseLeft = 0;
    this._buildPath();

    // —— 生物生成管线：数据仓库 → 骨骼装配 → 程序化蒙皮 → 聚合实体 ——
    const family = BIOLOGICAL_TAXONOMY.CARNIVORA.FELIDAE;
    const species = structuredClone(family.PANTHERA.TIGRIS);
    // 配置页皮毛参数注入渲染配置
    species.rendering.furLayers = config.tiger.furLayers ?? species.rendering.furLayers;
    species.rendering.furLength = species.rendering.furLength * (config.tiger.furLength ?? 1);
    this.entity = new BioEntityMesh(family, species, {
      paintGeometry: (geo) => paintTiger(geo, { contrast: config.tiger.stripeContrast }),
    });
    this.group = this.entity; // 兼容旧接口：group 即实体
    this._buildHeadDetails();
    scene.add(this.group);

    // —— 足迹：步态落地时留下爪印，离虎 5 米外消逝 ——
    this._prints = [];
    this._printGroup = new THREE.Group();
    scene.add(this._printGroup);
    this._prevPhases = [0, 0, 0, 0];

    // —— Cannon 刚体：躯干双球近似，kinematic 由路径驱动 ——
    if (physics) {
      this.body = new CANNON.Body({
        type: CANNON.Body.KINEMATIC,
        collisionFilterGroup: GROUP.TIGER,
        collisionFilterMask: GROUP.BAMBOO | GROUP.GROUND | GROUP.ROCK,
      });
      this.body.addShape(new CANNON.Sphere(0.42), new CANNON.Vec3(0, 1.0, 0.5));
      this.body.addShape(new CANNON.Sphere(0.4), new CANNON.Vec3(0, 1.0, -0.5));
      physics.addBody(this.body);
      this._physics = physics;
      const p0 = this.path.getPointAt(0);
      this.body.position.set(p0.x, groundHeight(p0.x, p0.z), p0.z);
    }
  }

  /** 头部细节：眼（带眼睑）/鼻/嘴/须/立耳，挂在 Head 骨上随骨骼运动 */
  _buildHeadDetails() {
    const head = this.entity.boneMap.get("Head");
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x140f08, roughness: 0.25 });
    const lidMat = new THREE.MeshStandardMaterial({ color: 0xb5621a, roughness: 0.85 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x241a10, roughness: 0.85 });
    const creamMat = new THREE.MeshStandardMaterial({ color: 0xf2e8d5, roughness: 0.9 });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10), eyeMat);
      eye.position.set(s * 0.115, 0.07, 0.1);
      head.add(eye);
      // 眼睑：上半球盖，内低外高（不怒自威）
      const lid = new THREE.Mesh(
        new THREE.SphereGeometry(0.038, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.55),
        lidMat
      );
      lid.position.set(s * 0.115, 0.078, 0.1);
      lid.rotation.set(-0.35, 0, s * 0.18);
      head.add(lid);
      // 立耳：小而圆，竖直微外张，背黑前白（虎耳"白心"特征）
      const ear = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), darkMat);
      ear.scale.set(0.9, 1.3, 0.5);
      ear.position.set(s * 0.135, 0.21, -0.04);
      ear.rotation.set(-0.08, 0, s * -0.12);
      head.add(ear);
      const earInner = new THREE.Mesh(new THREE.SphereGeometry(0.026, 8, 6), creamMat);
      earInner.scale.set(0.9, 1.2, 0.4);
      earInner.position.set(s * 0.133, 0.2, 0.005);
      earInner.rotation.copy(ear.rotation);
      head.add(earInner);
      // 虎须：每侧三根，自吻侧扇出
      for (let w = 0; w < 3; w++) {
        const whisker = new THREE.Mesh(
          new THREE.CylinderGeometry(0.0012, 0.0008, 0.17, 3),
          creamMat
        );
        whisker.position.set(s * 0.1, -0.035 - w * 0.013, 0.27);
        whisker.rotation.z = -s * (Math.PI / 2 - 0.12);
        whisker.rotation.y = s * (0.1 + w * 0.12);
        head.add(whisker);
      }
    }
    const nose = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.035, 0.035),
      new THREE.MeshStandardMaterial({ color: 0x7a3b33, roughness: 0.6 })
    );
    nose.position.set(0, -0.02, 0.3);
    head.add(nose);
    // 嘴：鼻下唇线 + 口吻横线（近看有神态）
    const lipLine = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.05, 0.012), darkMat);
    lipLine.position.set(0, -0.07, 0.29);
    head.add(lipLine);
    const mouthLine = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.009, 0.012), darkMat);
    mouthLine.position.set(0, -0.095, 0.265);
    head.add(mouthLine);
  }

  _buildPath() {
    const r = this.config.tiger.patrolRadius;
    const pts = [
      [-16, -8], [-8, 2], [-1, 9], [6, 12], [12, 5], [11, -6], [3, -13], [-8, -14],
    ].map(([x, z]) => new THREE.Vector3(x * r, 0, z * r));
    this.path = new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.6);
    this.pathLength = this.path.getLength();
  }

  /** 每帧：grove 可为 null；传入了才做缠尾 */
  update(dt, time, grove) {
    const cfg = this.config.tiger;
    const baseSpeed = 1.15 * cfg.speed;

    // —— 行为层：巡游 / 驻足观望（内驱力计时器） ——
    let targetSpeed = baseSpeed;
    if (this._pauseLeft > 0) {
      this._pauseLeft -= dt;
      targetSpeed = 0;
      this.state = "驻足";
    } else {
      this._pauseTimer -= dt;
      if (this._pauseTimer <= 0) {
        this._pauseLeft = cfg.pauseDuration ?? 2.4;
        this._pauseTimer = (cfg.pauseInterval ?? 16) * (0.8 + Math.random() * 0.6);
      }
      this.state = "巡游";
    }
    this._speedCur += (targetSpeed - this._speedCur) * Math.min(dt * 3, 1);
    const moving = THREE.MathUtils.clamp(this._speedCur / baseSpeed, 0, 1);

    // —— 运动层：沿巡游路径 ——
    this.pathT = (this.pathT + (this._speedCur * dt) / this.pathLength) % 1;
    const p = this.path.getPointAt(this.pathT);
    const tan = this.path.getTangentAt(this.pathT);
    const y = groundHeight(p.x, p.z);
    const ahead = this.path.getPointAt((this.pathT + 0.01) % 1);
    const slope = (groundHeight(ahead.x, ahead.z) - y) * 0.8;

    this.group.position.set(p.x, y, p.z);
    const targetYaw = Math.atan2(tan.x, tan.z);
    this.group.rotation.y += shortestAngle(this.group.rotation.y, targetYaw) * Math.min(dt * 4, 1);
    this.group.rotation.x = THREE.MathUtils.lerp(this.group.rotation.x, THREE.MathUtils.clamp(slope, -0.2, 0.2), 0.1);

    // 物理刚体随动：kinematic 体需要速度量才能正确推挤竹竿（限速防脉冲）
    if (this.body) {
      const bp = this.body.position;
      const inv = 1 / Math.max(dt, 1e-4);
      const vx = THREE.MathUtils.clamp((p.x - bp.x) * inv, -4, 4);
      const vz = THREE.MathUtils.clamp((p.z - bp.z) * inv, -4, 4);
      this.body.velocity.set(vx, 0, vz);
      bp.set(p.x, y, p.z);
      this.body.quaternion.setFromEuler(0, this.group.rotation.y, 0);
    }

    // —— 骨骼动画（状态机驱动器） ——
    this._gaitCyc = (this._gaitCyc + (this._speedCur / 1.25) * dt) % 1;
    // 状态映射：行进→WALK；驻足→IDLE；驻足偶发咆哮→ROAR
    const roar = this.state === "驻足" && Math.sin(time * 0.8) > 0.85;
    const bioState = moving > 0.25 ? "WALK" : roar ? "ROAR" : "IDLE";
    this.entity.setBehaviorState(bioState);
    this.entity.tick({ time, dt, gait: this._gaitCyc, moving });

    // —— 足迹：落地瞬间留印，5 米外消逝 ——
    this._updatePrints(moving);

    // —— 尾：缠竹叠加（在驱动器默认摆动之上） ——
    this._updateTailCurl(dt, grove);
  }

  /** 足迹：四腿进入支撑期（爪落地）时在爪位留下爪印；距虎超 5 米即移除 */
  _updatePrints(moving) {
    const feet = [
      { bone: "FLFoot", phase: 0.25 }, { bone: "FRFoot", phase: 0.75 },
      { bone: "BLFoot", phase: 0.0 }, { bone: "BRFoot", phase: 0.5 },
    ];
    const SWING = 0.35;
    feet.forEach((f, i) => {
      const p = ((this._gaitCyc + f.phase) % 1 + 1) % 1;
      const prev = this._prevPhases[i];
      // 摆动期→支撑期的沿 = 落地
      if (moving > 0.3 && prev < SWING && p >= SWING) this._dropPrint(f.bone);
      this._prevPhases[i] = p;
    });
    // 消逝：距虎 5 米外移除
    const tp = this.group.position;
    for (let i = this._prints.length - 1; i >= 0; i--) {
      const pr = this._prints[i];
      if (pr.position.distanceTo(tp) > 5) {
        this._printGroup.remove(pr);
        pr.geometry.dispose();
        pr.material.dispose();
        this._prints.splice(i, 1);
      }
    }
  }

  _dropPrint(boneName) {
    const foot = this.entity.boneMap.get(boneName);
    if (!foot) return;
    const w = new THREE.Vector3();
    foot.getWorldPosition(w);
    const geo = new THREE.CircleGeometry(0.085, 10);
    geo.scale(0.85, 1.35, 1); // 椭圆爪印
    const mat = new THREE.MeshBasicMaterial({
      color: 0x5a5348, transparent: true, opacity: 0.42, depthWrite: false,
    });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = -this.group.rotation.y; // 顺虎行进方向
    m.position.set(w.x, groundHeight(w.x, w.z) + 0.015, w.z);
    m.renderOrder = 1;
    this._printGroup.add(m);
    this._prints.push(m);
    // 上限 60 枚，先进先出
    while (this._prints.length > 60) {
      const old = this._prints.shift();
      this._printGroup.remove(old);
      old.geometry.dispose();
      old.material.dispose();
    }
  }

  /** 缠竹尾：虎身侧后有竹时，尾中后段卷向竹竿（配置 tiger.tailCurl 可开关） */
  _updateTailCurl(dt, grove) {
    const B = this.entity.boneMap;
    let curl = null;
    if (grove && this.config.tiger.tailCurl) {
      const maxDist = this.config.tiger.tailCurlDistance ?? 1.75;
      const hit = grove.nearestTo(this.group.position, maxDist);
      if (hit) {
        const b = hit.bamboo;
        const local = this.group.worldToLocal(new THREE.Vector3(b.x, b.baseY, b.z));
        if (local.z < 0.3 && local.z > -2.2 && Math.abs(local.x) < 1.4) {
          curl = { w: THREE.MathUtils.smoothstep(maxDist - hit.dist, 0, 0.9), side: Math.sign(local.x) || 1 };
        }
      }
    }
    this._curlW = THREE.MathUtils.lerp(this._curlW ?? 0, curl ? curl.w : 0, Math.min(dt * 5, 1));
    const w = this._curlW;
    if (curl) this._lastCurlSide = curl.side;
    const side = curl ? curl.side : this._lastCurlSide;
    if (w > 0.02 && side) {
      // 缠卷幅度自尾根到尾梢递进（五节链）
      const amps = [0.4, 0.9, 1.5, 2.0, 2.4];
      for (let i = 1; i <= 5; i++) {
        const T = B.get(`Tail${i}`);
        if (!T) break;
        T.rotation.y = THREE.MathUtils.lerp(T.rotation.y, side * amps[i - 1], w * Math.min(i * 0.4, 1));
      }
    }
  }
}

function shortestAngle(from, to) {
  let d = (to - from) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
