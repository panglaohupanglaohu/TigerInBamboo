// =====================================================================
//  云团生命周期系统 · Lifecycle Clouds（赤道 · 确定性龙卷风版）
//
//  主人最新指令：
//   1) 龙卷风**必须发生**——不再随机概率。合并出的每朵大云，停留片刻后
//      **必定**被一朵可见的龙卷风收走：吸入 → 高速旋转 → 甩出 3 朵小白云。
//   2) **清理赤道云彩布局**——云团整齐排在赤道面成一圈；旧的赤道风暴云墙
//      已在 main.js 移除，避免双层云堆叠。
//   3) 细腻度：云球细分提到 detail 4（≈3 倍面数）。
//   4) 甩出的小云颜色 = 最初的白云颜色（纯白，不再提亮）。
//   5) 数量守恒：3 小云 → 合并 1 大云 → 龙卷风 → 甩出 3 小云，循环往复。
//
//  龙卷风形态（自拟）：上宽下窄的旋涡漏斗，沿"天→地"（外径向→球心）
//  方向伸展，快速自转 + 轻微摇摆，水墨勾边，吸入时从云团位置向下扎出。
// =====================================================================
import * as THREE from "three";
import { addOutline, INK_COLOR } from "../assets/toon.js";
import { weldIcosahedron, deformBlob, getCloudGradient } from "./equatorialClouds.js";

/* ---------------- 生命周期参数 ---------------- */
const BASE_VOLUME = 6; // 小云团体积（= 云球数量）
const MERGE_GROUP = 3; // 几朵小云合并成一朵大云
const BIG_VOLUME = BASE_VOLUME * MERGE_GROUP; // 大云体积 = 原来的 3 倍
const MERGE_DIST = 8.0; // 小云中心距小于此 → 判定可合并
const MERGE_CD_SEC = 3.0; // 甩出的小云合并冷却（先散开再聚合）
const BIG_HOLD_SEC = 2.6; // 大云成型后漂移多久，龙卷风必至
const MAX_SPEED = 3.2; // 云团漂移限速
const LIFE_DETAIL = 4; // 云球细分（≈3 倍面数，更细腻）

/* ---------------- 龙卷风时长 ---------------- */
const TOR_COLLECT_SEC = 1.15; // 吸入大云
const TOR_SPIN_SEC = 1.35; // 高速旋转蓄力
const TOR_DISSIPATE_SEC = 0.7; // 漏斗消散

/* ---------------- 色彩：与最初的白云一致 ---------------- */
const CLOUD_LIT = 0xfdf5e6; // 受光面：暖白
const CLOUD_COOL = 0xaecbe8; // 背光面：清爽冷蓝灰

/* ---------------- 布局 ---------------- */
const BLOB_BASE_R = 1.12; // 单颗云球基准半径
const OUTLINE_THICK = 0.02;
const OUTLINE_DRY = 0.06;

const _tmpDir = new THREE.Vector3();
const _tmpA = new THREE.Vector3();
const _tmpB = new THREE.Vector3();
const _tmpC = new THREE.Vector3();

/* =====================================================================
 *  材质：白基底 + 逐切面受光（保留 uTint 通道，但本系统恒为纯白）
 * ===================================================================== */
function makeLifecycleCloudMaterial() {
  const mat = new THREE.MeshToonMaterial({
    color: 0xffffff,
    gradientMap: getCloudGradient(),
  });
  mat.flatShading = true;
  mat.needsUpdate = true;
  mat.customProgramCacheKey = () => "lifecycle-cloud";
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uSunDir = { value: new THREE.Vector3(0.5, 0.8, 0.3) };
    shader.uniforms.uLit = { value: new THREE.Color(CLOUD_LIT) };
    shader.uniforms.uCool = { value: new THREE.Color(CLOUD_COOL) };
    shader.uniforms.uTint = { value: new THREE.Color(1, 1, 1) };
    mat.userData.shader = shader;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        `uniform vec3 uSunDir;
uniform vec3 uLit;
uniform vec3 uCool;
uniform vec3 uTint;
void main() {`
      )
      .replace(
        "#include <normal_fragment_begin>",
        `#include <normal_fragment_begin>
  vec3 lcSun = normalize((viewMatrix * vec4(uSunDir, 0.0)).xyz);
  float lcNdL = dot(normal, lcSun);
  vec3 lcCol = mix(uCool, uLit, smoothstep(-0.32, 0.46, lcNdL));
  diffuseColor.rgb = lcCol * uTint;`
      );
  };
  return mat;
}

/* =====================================================================
 *  云团（Group + N 颗形变云球）
 * ===================================================================== */
function layoutBlobs(cloud) {
  for (const b of cloud.blobs) {
    cloud.group.remove(b);
    b.geometry.dispose();
  }
  cloud.blobs.length = 0;

  const n = cloud.volume;
  const packR = 1.4 + Math.cbrt(n) * 1.5;
  for (let i = 0; i < n; i++) {
    const r = BLOB_BASE_R * (0.75 + Math.random() * 0.6);
    const geo = weldIcosahedron(r, LIFE_DETAIL); // 细腻细分
    const blob = new THREE.Mesh(geo, cloud.material);
    const t = (i + 0.5) / n;
    const phi = Math.acos(1 - 2 * t);
    const theta = Math.PI * (1 + Math.sqrt(5)) * i;
    const rr = packR * (0.55 + Math.random() * 0.5);
    blob.position.set(
      rr * Math.sin(phi) * Math.cos(theta),
      rr * Math.cos(phi) * 0.72,
      rr * Math.sin(phi) * Math.sin(theta)
    );
    blob.scale.set(1, 0.6 + Math.random() * 0.3, 1);
    blob.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, 0);
    blob.userData.deform = {
      orig: geo.attributes.position.array.slice(),
      seed: Math.random() * 100,
      amp: 0.3 * (0.5 + r * 0.26),
      speed: 0.85 + Math.random() * 0.3,
    };
    addOutline(blob, OUTLINE_THICK, INK_COLOR, OUTLINE_DRY);
    cloud.group.add(blob);
    cloud.blobs.push(blob);
  }
}

function makeCloud(scene, pos, volume, opts = {}) {
  const group = new THREE.Group();
  group.position.copy(pos);
  const material = makeLifecycleCloudMaterial();
  const cloud = {
    group,
    material,
    blobs: [],
    volume,
    baseVolume: opts.baseVolume ?? volume,
    vel: new THREE.Vector3(),
    spinAxis: _tmpDir
      .set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5)
      .normalize()
      .clone(),
    spinSpeed: (Math.random() - 0.5) * 1.4,
    seed: Math.random() * 100,
    mergedAt: -999, // 上次合并成大云的时刻
    mergeCdUntil: -999, // 合并冷却
    claimed: false, // 是否已被某龙卷风锁定
    disposed: false,
  };
  layoutBlobs(cloud);
  scene.add(group);
  return cloud;
}

function disposeCloud(scene, cloud) {
  if (cloud.disposed) return;
  cloud.disposed = true;
  for (const b of cloud.blobs) {
    cloud.group.remove(b);
    b.geometry.dispose();
  }
  cloud.blobs.length = 0;
  scene.remove(cloud.group);
  cloud.material.dispose();
}

/* =====================================================================
 *  龙卷风（可见漏斗）：吸入大云 → 旋转 → 甩出 3 朵小白云
 * ===================================================================== */
function makeFunnelMaterial() {
  const mat = new THREE.MeshToonMaterial({
    color: 0xe9eef3,
    gradientMap: getCloudGradient(),
    transparent: true,
    opacity: 0.82,
    side: THREE.DoubleSide,
  });
  mat.flatShading = true;
  mat.needsUpdate = true;
  return mat;
}

/** 上宽下窄的旋涡漏斗；局部 +Y = 漏斗轴向（宽口端）。 */
function makeFunnel() {
  const geo = new THREE.CylinderGeometry(4.4, 0.9, 13, 20, 6, true);
  geo.translate(0, -6.5, 0); // 宽口(上)在 y=0，窄口(下)在 y=-13
  const funnel = new THREE.Mesh(geo, makeFunnelMaterial());
  addOutline(funnel, 0.03, INK_COLOR, 0.05);
  return funnel;
}

/** 在大云位置生成一朵龙卷风。up = 该处"朝天"方向（外径向）。 */
function spawnTornado(system, bigCloud, t) {
  const pos = bigCloud.group.position.clone();
  const up = pos.clone().normalize(); // 赤道处即水平外径向；作为漏斗轴
  const group = new THREE.Group();
  group.position.copy(pos);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), up);
  const funnel = makeFunnel();
  funnel.scale.setScalar(0.01); // 从无形生长出来
  group.add(funnel);
  system.scene.add(group);

  const tornado = {
    group,
    funnel,
    up,
    target: bigCloud,
    origin: pos.clone(),
    state: "collect",
    stateT: 0,
    flungVolume: bigCloud.volume,
    disposed: false,
  };
  bigCloud.claimed = true; // 锁定，防止漂移/再合并
  system.tornadoes.push(tornado);
  return tornado;
}

function disposeTornado(system, tornado) {
  if ( tornado.disposed) return;
  tornado.disposed = true;
  tornado.funnel.geometry.dispose();
  tornado.funnel.material.dispose();
  system.scene.remove(tornado.group);
}

/** 甩出 MERGE_GROUP 朵小白云（体积均分），颜色 = 最初的白云。 */
function flingSmallClouds(system, tornado, t) {
  const n = MERGE_GROUP;
  const vol = Math.max(1, Math.floor(tornado.flungVolume / n));
  const up = tornado.up; // 径向（赤道处 y≈0）
  // 赤道面内的一组水平基：径向 + 切向（两者都无 y 分量）→ 甩出保持贴在赤道面
  const tangent = _tmpA.set(-up.z, 0, up.x);
  if (tangent.lengthSq() < 1e-6) tangent.set(1, 0, 0);
  tangent.normalize();
  const center = tornado.origin;

  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.7;
    // 甩出方向限定在赤道面内（水平），重新布置赤道云彩布局
    const dir = up
      .clone()
      .multiplyScalar(Math.cos(a))
      .addScaledVector(tangent, Math.sin(a));
    dir.y = 0; // 强制水平
    if (dir.lengthSq() < 1e-6) dir.set(1, 0, 0);
    dir.normalize();
    const pos = center.clone().addScaledVector(dir, 3 + Math.random() * 2);
    pos.y = (Math.random() - 0.5) * 1.2; // 贴赤道面微扰
    const small = makeCloud(system.scene, pos, vol, { baseVolume: BASE_VOLUME });
    // 甩出的小云 = 最初的白云色（纯白）；水平抛出，不再向上扬
    small.vel.copy(dir).multiplyScalar(3.0 + Math.random() * 1.8);
    small.mergeCdUntil = t + MERGE_CD_SEC;
    system.clouds.push(small);
  }
}

/** 每帧推进所有龙卷风的状态机。 */
function updateTornadoes(system, dt, t) {
  for (const tor of system.tornadoes) {
    if (tor.disposed) continue;
    tor.stateT += dt;
    const funnel = tor.funnel;

    if (tor.state === "collect") {
      // 漏斗生长 + 吸入大云（缩小、上提、急旋）
      const k = Math.min(1, tor.stateT / TOR_COLLECT_SEC);
      funnel.scale.setScalar(0.01 + k * 0.99);
      funnel.rotation.y += dt * (6 + k * 10);
      const big = tor.target;
      if (big && !big.disposed) {
        big.group.position.lerp(tor.origin, Math.min(1, dt * 4));
        const s = Math.max(0.05, 1 - k * 0.95);
        big.group.scale.setScalar(s);
        big.group.rotateOnWorldAxis(tor.up, dt * 10);
      }
      if (tor.stateT >= TOR_COLLECT_SEC) {
        if (tor.target && !tor.target.disposed) disposeCloud(system.scene, tor.target);
        tor.state = "spin";
        tor.stateT = 0;
      }
    } else if (tor.state === "spin") {
      // 高速旋转蓄力
      funnel.rotation.y += dt * 16;
      const pulse = 1 + Math.sin(tor.stateT * 14) * 0.05;
      funnel.scale.setScalar(pulse);
      if (tor.stateT >= TOR_SPIN_SEC) {
        flingSmallClouds(system, tor, t); // 甩出 3 朵小白云
        tor.state = "dissipate";
        tor.stateT = 0;
      }
    } else if (tor.state === "dissipate") {
      const k = Math.min(1, tor.stateT / TOR_DISSIPATE_SEC);
      funnel.scale.setScalar(Math.max(0.01, 1 - k));
      funnel.rotation.y += dt * (16 - k * 12);
      if (tor.stateT >= TOR_DISSIPATE_SEC) {
        disposeTornado(system, tor);
      }
    }
  }
  system.tornadoes = system.tornadoes.filter((x) => !x.disposed);
}

/* =====================================================================
 *  系统入口
 * ===================================================================== */

/**
 * 在赤道面部署一圈有生命周期的云团（整齐排布）。
 * @param {THREE.Scene} scene
 * @param {{ planetRadius?: number, count?: number, bandRadius?: number }} [opts]
 */
export function createLifecycleClouds(scene, opts = {}) {
  const {
    planetRadius = 40,
    count = 12,
    bandRadius = planetRadius + 22,
  } = opts;

  const system = {
    scene,
    planetRadius,
    bandRadius,
    clouds: [],
    tornadoes: [],
    time: 0,
  };

  // 按 MERGE_GROUP 朵一组，均匀排布在赤道面（y=0）成圈
  const groupsN = Math.ceil(count / MERGE_GROUP);
  for (let g = 0; g < groupsN; g++) {
    const baseA = (g / groupsN) * Math.PI * 2;
    const radial = new THREE.Vector3(Math.cos(baseA), 0, Math.sin(baseA));
    const tangent = new THREE.Vector3(-Math.sin(baseA), 0, Math.cos(baseA));
    const center = radial.clone().multiplyScalar(bandRadius);
    const members = Math.min(MERGE_GROUP, count - g * MERGE_GROUP);
    for (let m = 0; m < members; m++) {
      const off = (m - (members - 1) / 2) * 3.2;
      const pos = center
        .clone()
        .addScaledVector(tangent, off + (Math.random() - 0.5))
        .addScaledVector(radial, (Math.random() - 0.5) * 2);
      pos.y = (Math.random() - 0.5) * 2; // 赤道面上下微扰
      const cloud = makeCloud(scene, pos, BASE_VOLUME, { baseVolume: BASE_VOLUME });
      cloud.vel.copy(tangent).multiplyScalar(0.5 + Math.random() * 0.8);
      system.clouds.push(cloud);
    }
  }
  return system;
}

/** 合并：MERGE_GROUP 朵近距小云 → 一朵大云（体积相加）。 */
function mergeClouds(system, members, t) {
  const center = new THREE.Vector3();
  let vol = 0;
  for (const c of members) {
    center.add(c.group.position);
    vol += c.volume;
    disposeCloud(system.scene, c);
  }
  center.divideScalar(members.length);
  const merged = makeCloud(system.scene, center, vol, { baseVolume: vol });
  merged.mergedAt = t;
  merged.spinSpeed = (Math.random() - 0.5) * 2.2;
  system.clouds = system.clouds.filter((c) => !c.disposed);
  system.clouds.push(merged);
  return merged;
}

/**
 * 每帧驱动。
 * @param {ReturnType<typeof createLifecycleClouds>} system
 * @param {number} dt
 * @param {number} t 全局时间（秒）
 * @param {THREE.DirectionalLight} [sun]
 */
export function updateLifecycleClouds(system, dt, t, sun) {
  if (!system) return;
  dt = Math.min(dt, 0.05);
  system.time = t;
  const clouds = system.clouds;

  /* ---------- 单朵云：形变 / 旋转 / 漂移（被龙卷风锁定的除外） ---------- */
  for (const c of clouds) {
    if (c.disposed || c.claimed) continue;

    const sh = c.material.userData.shader;
    if (sh && sun) sh.uniforms.uSunDir.value.copy(sun.position).normalize();

    for (const b of c.blobs) deformBlob(b, t + c.seed);

    c.group.rotateOnAxis(c.spinAxis, c.spinSpeed * dt);
    c.group.position.addScaledVector(c.vel, dt);

    // 径向箍制：保持在赤道云带轨道半径附近
    const r = c.group.position.length();
    _tmpB.copy(c.group.position).divideScalar(Math.max(r, 1e-4));
    c.vel.addScaledVector(_tmpB, (system.bandRadius - r) * 0.3 * dt);
    // 拉回赤道面（y=0）：更强的弹簧 + 垂直阻尼，防止偏离赤道面
    c.vel.y += -c.group.position.y * 0.9 * dt;
    c.vel.y *= Math.exp(-0.4 * dt);
    // 限速
    const sp = c.vel.length();
    if (sp > MAX_SPEED) c.vel.multiplyScalar(MAX_SPEED / sp);

    // 轻微颤抖（震动裹挟感）
    c.group.position.y += Math.sin(t * 1.7 + c.seed) * 0.3 * dt * 2;
  }

  /* ---------- 相互吸引（裹挟）：仅小云之间 ---------- */
  for (let i = 0; i < clouds.length; i++) {
    const a = clouds[i];
    if (a.disposed || a.claimed || a.volume !== BASE_VOLUME) continue;
    for (let j = i + 1; j < clouds.length; j++) {
      const b = clouds[j];
      if (b.disposed || b.claimed || b.volume !== BASE_VOLUME) continue;
      const d = a.group.position.distanceTo(b.group.position);
      if (d > 2.5 && d < 22) {
        const pull = (0.6 / Math.max(d, 3)) * dt * 7;
        _tmpA.copy(b.group.position).sub(a.group.position).normalize();
        a.vel.addScaledVector(_tmpA, pull);
        b.vel.addScaledVector(_tmpA, -pull);
      }
    }
  }

  /* ---------- 合并判定：MERGE_GROUP 朵近距小云 → 大云 ---------- */
  const smalls = clouds.filter(
    (c) => !c.disposed && !c.claimed && c.volume === BASE_VOLUME && t > c.mergeCdUntil
  );
  for (let i = 0; i < smalls.length; i++) {
    const seedCloud = smalls[i];
    if (seedCloud.disposed) continue;
    const near = [];
    for (let j = 0; j < smalls.length; j++) {
      if (j === i || smalls[j].disposed) continue;
      const d = seedCloud.group.position.distanceTo(smalls[j].group.position);
      if (d < MERGE_DIST) near.push({ c: smalls[j], d });
    }
    near.sort((p, q) => p.d - q.d);
    if (near.length >= MERGE_GROUP - 1) {
      mergeClouds(system, [seedCloud, ...near.slice(0, MERGE_GROUP - 1).map((x) => x.c)], t);
      break; // 一帧最多合并一组
    }
  }

  /* ---------- 龙卷风【必定发生】：每朵成型大云停留片刻后必被收走 ---------- */
  for (const c of system.clouds) {
    if (c.disposed || c.claimed) continue;
    if (c.volume >= BIG_VOLUME && t - c.mergedAt > BIG_HOLD_SEC) {
      // 检查是否已有龙卷风锁定它（防重复）
      const alreadyClaimed = system.tornadoes.some((tor) => tor.target === c);
      if (!alreadyClaimed) spawnTornado(system, c, t);
    }
  }

  /* ---------- 推进所有龙卷风 ---------- */
  updateTornadoes(system, dt, t);

  /* ---------- 清理已消散的云 ---------- */
  system.clouds = system.clouds.filter((c) => !c.disposed);
}
