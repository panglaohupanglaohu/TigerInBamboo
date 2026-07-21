// 竹林：碗口粗的翠竹，雪压竹梢；虎身经过时被挤开、回弹
// 物理：每根竹是 Cannon 刚体（Box 近似），底部 PointToPoint 球铰锚定，
// 回正与风摆由每帧施加的扭矩驱动，虎的碰撞由物理世界解算
import * as THREE from "../assets/vendor/three/three.module.js";
import * as CANNON from "../assets/vendor/cannon-es.js";
import * as BufferGeometryUtils from "../assets/vendor/three/jsm/utils/BufferGeometryUtils.js";
import { makeRandom, groundHeight, distToStream } from "./environment.js";
import { GROUP } from "./physics.js";

const RESTORE_K = 3.0;     // 回正角速度增益（rad/s 每 rad 倾角）
const BLEND = 0.2;         // 每帧向目标角速度的混合比（碰撞冲量保留 80%）

export class BambooGrove {
  constructor(scene, config, patrolCurve, physics) {
    this.scene = scene;
    this.config = config;
    this.physics = physics;
    this.bamboos = [];
    this.time = 0;
    this.onDisturb = null; // 竹被挤扰回调（由 main.js 挂：沙沙声 + 落雪）
    this._generate(patrolCurve);
    this._initSnowBurst();
  }

  /** 落雪粒子池：竹被挤扰时竹顶积雪簌落（固定池，循环复用） */
  _initSnowBurst() {
    const MAX = 900;
    this._sb = {
      max: MAX, head: 0,
      pos: new Float32Array(MAX * 3),
      vel: new Float32Array(MAX * 3),
      life: new Float32Array(MAX),
    };
    this._sb.pos.fill(-999); // 死粒子藏到地下
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(this._sb.pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0xf4f7f4, size: 0.07, transparent: true, opacity: 0.95,
      sizeAttenuation: true, depthWrite: false,
    });
    this._sbPoints = new THREE.Points(geo, mat);
    this._sbPoints.frustumCulled = false;
    this.scene.add(this._sbPoints);
  }

  /** 竹顶积雪簌落：在 (x,y,z) 处爆发一团缓降雪粒 */
  spawnSnowBurst(x, y, z, strength = 1) {
    const sb = this._sb;
    const n = Math.round(25 + strength * 55);
    for (let i = 0; i < n; i++) {
      const idx = sb.head = (sb.head + 1) % sb.max;
      sb.pos[idx * 3] = x + (Math.random() - 0.5) * 0.7;
      sb.pos[idx * 3 + 1] = y + Math.random() * 0.35;
      sb.pos[idx * 3 + 2] = z + (Math.random() - 0.5) * 0.7;
      sb.vel[idx * 3] = (Math.random() - 0.5) * 0.9;
      sb.vel[idx * 3 + 1] = -0.15 - Math.random() * 0.6;
      sb.vel[idx * 3 + 2] = (Math.random() - 0.5) * 0.9;
      sb.life[idx] = 1.4 + Math.random() * 0.9;
    }
  }

  /** 每帧推进落雪：缓降 + 横向散 + 到点隐匿 */
  updateSnowBurst(dt) {
    const sb = this._sb;
    for (let i = 0; i < sb.max; i++) {
      if (sb.life[i] <= 0) continue;
      sb.life[i] -= dt;
      sb.vel[i * 3 + 1] -= 2.2 * dt; // 轻重力（雪粒蓬松缓降）
      sb.pos[i * 3] += sb.vel[i * 3] * dt;
      sb.pos[i * 3 + 1] += sb.vel[i * 3 + 1] * dt;
      sb.pos[i * 3 + 2] += sb.vel[i * 3 + 2] * dt;
      if (sb.life[i] <= 0) sb.pos[i * 3 + 1] = -999;
    }
    this._sbPoints.geometry.attributes.position.needsUpdate = true;
  }

  _generate(patrolCurve) {
    const rand = makeRandom(2024);
    const count = this.config.scene.bambooCount;
    const placed = [];
    let guard = 0;
    while (placed.length < count && guard++ < count * 60) {
      let x, z;
      const r = rand();
      if (r < 0.62) {
        // 沿溪涧两岸成簇
        const zc = -42 + rand() * 84;
        const side = rand() > 0.5 ? 1 : -1;
        x = nearestStreamX(zc) + side * (2.6 + rand() * 9);
        z = zc + (rand() - 0.5) * 4;
      } else {
        // 散生
        x = (rand() - 0.5) * 76;
        z = (rand() - 0.5) * 76;
      }
      if (distToStream(x, z) < 2.3) continue;                 // 不长在河床里
      if (Math.abs(x) > 40 || Math.abs(z) > 40) continue;
      let ok = true;
      for (const q of placed) {
        const dx = q.x - x, dz = q.z - z;
        if (dx * dx + dz * dz < 1.1 * 1.1) { ok = false; break; }
      }
      if (!ok) continue;
      placed.push({ x, z });
    }

    for (const { x, z } of placed) {
      this.bamboos.push(this._buildOne(x, z, rand));
    }

    // 小竹：每 3 棵大竹构成的三角形，随机取一顶角，在其旁生一小竹
    // 粗 = 大竹 1/4，高 = 大竹 2~3 个节间高，出地面第 2 节起即生叶
    for (let i = 0; i + 2 < placed.length; i += 3) {
      const k = Math.floor(rand() * 3);
      const corner = placed[i + k];
      const parent = this.bamboos[i + k];
      const ang = rand() * Math.PI * 2;
      const d = 0.55 + rand() * 0.4; // 贴着母竹，又不与竹身重叠
      const sx = corner.x + Math.cos(ang) * d;
      const sz = corner.z + Math.sin(ang) * d;
      if (distToStream(sx, sz) < 2.3) continue;
      if (Math.abs(sx) > 40 || Math.abs(sz) > 40) continue;
      this.bamboos.push(this._buildOne(sx, sz, rand, {
        small: true,
        height: (2 + rand()) * parent.segH,
        radius: parent.radius / 4,
      }));
    }

    // 大山石旁的几丛小竹（石竹相依；坐标与 environment.js 的大山石组对应）
    const ROCK_GROUPS = [[-21, -27], [17, 21]];
    for (const [rx, rz] of ROCK_GROUPS) {
      for (let c = 0; c < 2; c++) { // 每组石 2 丛
        const ca = rand() * Math.PI * 2;
        const cd = 3.2 + rand() * 1.6;
        const cx = rx + Math.cos(ca) * cd;
        const cz = rz + Math.sin(ca) * cd;
        if (distToStream(cx, cz) < 2.3 || Math.abs(cx) > 40 || Math.abs(cz) > 40) continue;
        const n = 3 + Math.floor(rand() * 3); // 一丛 3~5 棵
        for (let i = 0; i < n; i++) {
          const a = rand() * Math.PI * 2;
          const d = rand() * 0.8;
          const bx = cx + Math.cos(a) * d, bz = cz + Math.sin(a) * d;
          if (distToStream(bx, bz) < 2.3) continue;
          this.bamboos.push(this._buildOne(bx, bz, rand, {
            small: true,
            height: 2.2 + rand() * 1.2,
            radius: 0.024 + rand() * 0.008,
          }));
        }
      }
    }
  }

  _buildOne(x, z, rand, opts = {}) {
    const small = !!opts.small;
    const height = opts.height ?? (7.5 + rand() * 4.5);  // 大竹 8~12 米
    const radius = opts.radius ?? (0.09 + rand() * 0.05); // 大竹碗口粗；小竹 = 大竹 1/4
    const group = new THREE.Group();
    const baseY = groundHeight(x, z);
    group.position.set(x, baseY, z);

    // 竹身：节间逐段略收分，节疤凸起 —— 合并为单一几何体（顶点色）
    const parts = [];
    const segCount = Math.max(2, Math.floor(height / (small ? 0.55 : 1.1))); // 小竹节间短
    const segH = height / segCount;
    const green = new THREE.Color().setHSL(0.33 + rand() * 0.03, 0.38, 0.32 + rand() * 0.08);
    const ringColor = new THREE.Color(0x2c4a2e);
    const snowColor = new THREE.Color(0xf5f8f5);
    for (let i = 0; i < segCount; i++) {
      const t0 = i / segCount, t1 = (i + 1) / segCount;
      const r0 = radius * (1 - t0 * 0.35), r1 = radius * (1 - t1 * 0.35);
      const seg = new THREE.CylinderGeometry(r1, r0, segH * 0.96, 7);
      seg.translate(0, segH * (i + 0.5), 0);
      paint(seg, green);
      parts.push(seg);
      const ring = new THREE.TorusGeometry(r0 * 1.06, radius * 0.16, 5, 10);
      ring.rotateX(Math.PI / 2);
      ring.translate(0, segH * i, 0);
      paint(ring, ringColor);
      parts.push(ring);
    }
    // 梢头不另做圆雪球——雪改在叶上（见下 snowGeos，顺叶方向、随机覆盖）

    const stalkGeo = BufferGeometryUtils.mergeGeometries(parts);
    const stalk = new THREE.Mesh(stalkGeo, bambooMaterial());
    stalk.castShadow = true;
    group.add(stalk);

    // 枝叶：分形三层 —— 干生枝、枝生杈、杈生叶；自竹节向天斜出，层层缩小（叶小于枝）
    // 大竹取上部 4 节生叶；小竹自出地面第 2 节起，节节生叶；叶上随机覆雪（顺叶方向）
    const twigGeos = [], leafGeos = [], snowGeos = [];
    const bScale = Math.min(Math.max(height / 9, 0.25), 1.35); // 枝叶尺寸随竹高
    const nodeYs = small
      ? Array.from({ length: Math.max(segCount - 1, 0) }, (_, i) => segH * (i + 2))
      : [0.6, 0.72, 0.84, 0.95].map((t) => segH * Math.max(1, Math.round(t * segCount)));
    for (const nodeY of nodeYs) {
      const nBr = 1 + Math.floor(rand() * 2);
      for (let i = 0; i < nBr; i++) {
        const m = new THREE.Matrix4()
          .makeTranslation(0, nodeY, 0)
          .multiply(new THREE.Matrix4().makeRotationY(rand() * Math.PI * 2))
          .multiply(new THREE.Matrix4().makeRotationZ(0.55 + rand() * 0.45)); // 向天斜出
        emitBranch(rand, 0, m, twigGeos, leafGeos, snowGeos, bScale);
      }
    }
    const twigMesh = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(twigGeos), twigMaterial());
    twigMesh.castShadow = true;
    group.add(twigMesh);
    const leafMesh = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(leafGeos), leafMaterial());
    leafMesh.castShadow = true;
    group.add(leafMesh);
    if (snowGeos.length) {
      const snowMesh = new THREE.Mesh(BufferGeometryUtils.mergeGeometries(snowGeos), snowMaterial());
      snowMesh.castShadow = true;
      group.add(snowMesh);
    }

    // 初始微倾
    group.rotation.x = (rand() - 0.5) * 0.06;
    group.rotation.z = (rand() - 0.5) * 0.06;
    this.scene.add(group);

    // —— Cannon 刚体：竹竿一个 Box（质心居中），底部竹脚 PointToPoint 球铰 ——
    const mass = small ? 2 : 8;
    const body = new CANNON.Body({
      mass,
      type: CANNON.Body.DYNAMIC,
      collisionFilterGroup: GROUP.BAMBOO,
      collisionFilterMask: GROUP.TIGER | GROUP.GROUND,
    });
    body.addShape(new CANNON.Box(new CANNON.Vec3(radius, height / 2, radius)));
    body.position.set(x, baseY + height / 2, z); // 质心在半竿高
    body.quaternion.setFromEuler(group.rotation.x, 0, group.rotation.z);
    this.physics.addBody(body);
    // 底部球铰：竹脚固定在地面锚点，杆身可绕之摆动
    const anchor = new CANNON.Body({ mass: 0, collisionFilterGroup: 0, collisionFilterMask: 0 });
    anchor.position.set(x, baseY, z);
    this.physics.addBody(anchor);
    const hinge = new CANNON.PointToPointConstraint(
      body, new CANNON.Vec3(0, -height / 2, 0), // 竹脚
      anchor, new CANNON.Vec3(0, 0, 0)
    );
    this.physics.world.addConstraint(hinge);

    return {
      group, leafMesh, x, z, baseY, radius, height, segH,
      body, anchor, hinge,
      phase: rand() * Math.PI * 2,         // 风摆相位
    };
  }

  /** 距某点最近的竹子（供虎尾缠绕查询） */
  nearestTo(pos, maxDist = 2.2) {
    let best = null, bestD = maxDist;
    for (const b of this.bamboos) {
      const dx = b.x - pos.x, dz = b.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best ? { bamboo: best, dist: bestD } : null;
  }

  update(dt, tigerPos) {
    this.time += dt;
    const { wind, windDirection } = this.config.weather;
    const dirRad = (windDirection * Math.PI) / 180;
    const dirX = Math.sin(dirRad), dirZ = Math.cos(dirRad); // 与降水同一风向
    const stiffness = this.config.bamboo?.stiffness ?? RESTORE_K;
    const swayAmp = this.config.bamboo?.sway ?? 1;
    const up = new CANNON.Vec3(0, 1, 0);
    const axis = new CANNON.Vec3(), target = new CANNON.Vec3(), windT = new CANNON.Vec3();
    for (const b of this.bamboos) {
      // —— 回正：速度级 PD（朝向×竖直 = 回正轴，仿真验证 K=3 稳定且撞后回弹）——
      b.body.quaternion.vmult(up, axis);
      axis.cross(up, target);
      target.scale(stiffness, target);
      // —— 风摆：叠加一个沿风向的倾侧角速度，随时间呼吸 ——
      const sway = wind * 0.25 * swayAmp * Math.sin(this.time * 1.1 + b.phase);
      windT.set(sway * dirZ, 0, -sway * dirX); // rotation.x 倾向 +Z，rotation.z 倾向 −X
      target.vadd(windT, target);
      // 向目标角速度混合：碰撞冲量（虎的推挤）保留在角速度里，自然回弹
      b.body.angularVelocity.lerp(target, BLEND, b.body.angularVelocity);
      b.body.wakeUp();
      // —— 扰动检测：角速度冲尖（虎挤过）→ 触发沙沙声与落雪（每竹 0.8s 冷却） ——
      b._disturbCd = Math.max(0, (b._disturbCd ?? 0) - dt);
      const av = b.body.angularVelocity.length();
      if (av > 0.7 && b._disturbCd <= 0) {
        b._disturbCd = 0.8;
        this.onDisturb?.(b, Math.min(av / 3, 1));
      }
    }
  }

  /** 物理步进后调用：把刚体位姿同步到可视组（注意刚体原点在竿中心，可视组原点在竹脚） */
  syncFromPhysics() {
    const off = new THREE.Vector3();
    for (const b of this.bamboos) {
      off.set(0, -b.height / 2, 0).applyQuaternion(b.group.quaternion.copy(b.body.quaternion));
      b.group.position.set(b.body.position.x + off.x, b.body.position.y + off.y, b.body.position.z + off.z);
    }
  }
}

// 沿 z 查溪涧中心 x（竹簇定位用，粗近似即可）
function nearestStreamX(z) {
  // 与 environment 的 STREAM_POINTS 同形的折线近似
  const pts = [[-7, -46], [4, -30], [-4, -14], [5, 1], [-3, 15], [4, 31], [-5, 46]];
  let best = 0, bd = Infinity;
  for (const [x, zz] of pts) {
    const d = Math.abs(zz - z);
    if (d < bd) { bd = d; best = x; }
  }
  return best;
}

// ---------- 分形枝叶 ----------
// 三层：枝(0) → 杈(1) → 梢(2)，末两层着叶；层层缩小、叶小于枝，一律向天仰起
const BRANCH_LEN = [0.95, 0.62, 0.42];
const BRANCH_RAD = [0.022, 0.014, 0.009];

function emitBranch(rand, level, base, twigGeos, leafGeos, snowGeos, scale = 1) {
  const len = BRANCH_LEN[level] * scale;
  const rad = BRANCH_RAD[level] * scale;
  const tg = new THREE.CylinderGeometry(rad * 0.7, rad, len, 5);
  tg.translate(0, len / 2, 0);
  tg.applyMatrix4(base);
  twigGeos.push(tg);

  if (level < 2) {
    // 子杈：着生于枝中上部，向外上方展（相对父枝仍朝天）
    const n = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) {
      const m = new THREE.Matrix4().copy(base)
        .multiply(new THREE.Matrix4().makeTranslation(0, len * (0.55 + rand() * 0.4), 0))
        .multiply(new THREE.Matrix4().makeRotationY(rand() * Math.PI * 2))
        .multiply(new THREE.Matrix4().makeRotationZ(0.45 + rand() * 0.5));
      emitBranch(rand, level + 1, m, twigGeos, leafGeos, snowGeos, scale);
    }
  }
  if (level >= 1) {
    // 叶：狭叶，叶根在梢、叶尖仰向天空；层级越深叶越小
    const nL = 2 + Math.floor(rand() * 3);
    for (let i = 0; i < nL; i++) {
      const s = (0.55 - level * 0.14) * (0.8 + rand() * 0.4) * scale;
      const m = new THREE.Matrix4().copy(base)
        .multiply(new THREE.Matrix4().makeTranslation(0, len * (0.7 + rand() * 0.3), 0))
        .multiply(new THREE.Matrix4().makeRotationY(rand() * Math.PI * 2))
        .multiply(new THREE.Matrix4().makeRotationZ(0.3 + rand() * 0.5))
        .multiply(new THREE.Matrix4().makeScale(s, s, s));
      const lg = leafGeoProto.clone();
      lg.applyMatrix4(m);
      leafGeos.push(lg);
      // 叶上积雪：随机约四成叶，顺叶方向覆一层薄雪（略小于叶、浮于叶面）
      if (rand() < 0.42) {
        const sg = snowLeafProto.clone();
        sg.applyMatrix4(m);
        snowGeos.push(sg);
      }
    }
  }
}

const leafGeoProto = new THREE.PlaneGeometry(1.05, 0.15);
leafGeoProto.translate(0.55, 0, 0); // 叶根在轴心，叶尖朝 +X
const snowLeafProto = new THREE.PlaneGeometry(0.95, 0.19);
snowLeafProto.translate(0.52, 0, 0.022); // 贴叶面微微浮起，随叶同矩阵

let _twigMat = null;
function twigMaterial() {
  if (!_twigMat) {
    _twigMat = new THREE.MeshStandardMaterial({ color: 0x2c4a2e, roughness: 0.85 });
  }
  return _twigMat;
}

let _leafMat = null;
function leafMaterial() {
  if (!_leafMat) {
    _leafMat = new THREE.MeshStandardMaterial({
      color: 0x39663c, roughness: 0.85, side: THREE.DoubleSide,
      transparent: true, opacity: 0.95,
    });
  }
  return _leafMat;
}

let _snowMat = null;
function snowMaterial() {
  if (!_snowMat) {
    _snowMat = new THREE.MeshStandardMaterial({
      color: 0xf5f8f5, roughness: 1, side: THREE.DoubleSide,
    });
  }
  return _snowMat;
}

let _bambooMat = null;
function bambooMaterial() {
  if (!_bambooMat) {
    _bambooMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, metalness: 0.02 });
  }
  return _bambooMat;
}

function paint(geo, color) {
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    arr[i * 3] = color.r; arr[i * 3 + 1] = color.g; arr[i * 3 + 2] = color.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(arr, 3));
}
