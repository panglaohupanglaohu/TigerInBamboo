// =====================================================================
//  月亮湖：月牙形湖面（浅水可涉 / 深水阻挡）+ 环湖小径
//  + 涟漪 / 涉水水花 / 廉价水下倒影剪影
//  选址 (4, -1)：小虎→阿竹、驿站→远方两条主线动线在此交汇，逼出绕湖小径
// =====================================================================
import * as THREE from "three";
import { toonMat } from "../assets/toon.js";
import { flatToWorld, quatYToDir, latLonToDir, flatXZToLatLon } from "./sphereMath.js";
import { PLANET_RADIUS } from "./planet.js";
import { canyonOffsetDir } from "./canyon.js";
import { WORLD_SCALE } from "./worldScale.js";

export const LAKE = {
  x: 4 * WORLD_SCALE,
  z: -1 * WORLD_SCALE, // 主岛低洼处（平面设计坐标）
  rOuter: 3.5, // 湖缘（浅水界）
  rDeep: 1.6, // 深水界（阻挡；圆心在月牙实体一侧）
  deepDX: -0.5,
  deepDZ: -0.2, // 深水圆心相对湖心的偏移（避开月牙缺口）
  waterY: 0.78, // 水面抬升（主岛台面 0.6 之上 → 涉水深度 ~0.18）
  pathInner: 3.8,
  pathOuter: 4.7, // 环湖小径带宽
  wadeFactor: 0.55, // 涉水减速系数
};

/**
 * 修船厂码头落点（平面坐标，与 messengerIsland / 电车避障共用）
 * 栈桥中心在环湖小径南外侧；clearR 含渔船/吊车/桩柱
 */
export const HARBOR = {
  x: LAKE.x + 5.4 * WORLD_SCALE, // LAKE.x + 5.4
  z: LAKE.z - 2.6 * WORLD_SCALE, // LAKE.z - 2.6
  yaw: 0.85,
  /** 轨道/建筑净空半径（勿穿模） */
  clearR: 6.5,
};

// 背侧大湖（GREAT_LAKE / createGreatLake / updateGreatLakeWade）已删除：
// 原址距电车轨道仅 4.0，正压在叹息之门前方的框景视线上；
// 峡谷内现只保留一个带白鲸的湖（见 world/citySeaLake.js）。

const _dir = new THREE.Vector3();
const _up = new THREE.Vector3();
const _d = new THREE.Vector3();
const _local = new THREE.Vector3();
const _quatInv = new THREE.Quaternion();

/**
 * 造湖：月牙浅水盘 + 深水暗色圆 + 环湖小径带 + 涟漪/倒影/水花池。
 * @returns {{ group, deepCollider, centerWorld, rOuter, surfaceR, ripples, splashes, reflect }}
 */
export function createMoonLake(scene, planetRadius = PLANET_RADIUS) {
  const g = new THREE.Group();

  // 定位到主岛台面（月牙平面贴台面法线）
  const { lat, lon } = flatXZToLatLon(LAKE.x, LAKE.z, planetRadius);
  latLonToDir(lat, lon, _dir);
  const topR = planetRadius + LAKE.waterY;
  g.position.copy(_dir).multiplyScalar(topR);
  g.quaternion.copy(quatYToDir(_dir, new THREE.Quaternion()));

  // 月牙浅水：外圆 - 偏心内圆（缺口）
  const shape = new THREE.Shape();
  shape.absarc(0, 0, LAKE.rOuter, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(1.1, 0.7, LAKE.rOuter * 0.72, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const waterGeo = new THREE.ShapeGeometry(shape, 28);
  const water = new THREE.Mesh(
    waterGeo,
    toonMat(0x4a7a8a, { transparent: true, opacity: 0.82, side: THREE.DoubleSide })
  );
  water.rotation.x = -Math.PI / 2;
  water.receiveShadow = true;
  g.add(water);

  // 廉价倒影：水下翻转的暗色月牙剪影（岸/天倒映感）
  const reflect = new THREE.Mesh(
    waterGeo.clone(),
    new THREE.MeshBasicMaterial({
      color: 0x2a3a38,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  reflect.rotation.x = -Math.PI / 2;
  reflect.position.y = -0.04;
  reflect.scale.set(0.92, 1, 0.92); // 略缩小像透视收缩
  g.add(reflect);

  // 深水：墨青暗色圆（视觉标识阻挡区）
  const deep = new THREE.Mesh(
    new THREE.CircleGeometry(LAKE.rDeep, 20),
    toonMat(0x2e5568, { transparent: true, opacity: 0.9, side: THREE.DoubleSide })
  );
  deep.rotation.x = -Math.PI / 2;
  deep.position.set(LAKE.deepDX, 0.02, LAKE.deepDZ);
  g.add(deep);

  // 环湖小径：沙色环带（绕湖动线的视觉引导）
  const path = new THREE.Mesh(
    new THREE.RingGeometry(LAKE.pathInner, LAKE.pathOuter, 36, 1),
    toonMat(0xcbb896, { side: THREE.DoubleSide })
  );
  path.rotation.x = -Math.PI / 2;
  path.position.y = -0.13; // 略低于水面、高于台面
  path.receiveShadow = true;
  g.add(path);

  // 涟漪环：3 个同心扩散环，相位错开
  const ripples = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.15, 0.22, 28),
      new THREE.MeshBasicMaterial({
        color: 0xd8e8e4,
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(-0.4 + i * 0.35, 0.03, -0.2 + (i % 2) * 0.3);
    ring.userData = { phase: i * 1.7, speed: 0.55 + i * 0.08, maxR: 1.6 + i * 0.25 };
    g.add(ring);
    ripples.push(ring);
  }

  // 涉水水花粒子池（复用小球）
  const splashes = [];
  for (let i = 0; i < 14; i++) {
    const p = new THREE.Mesh(
      new THREE.SphereGeometry(0.04, 5, 4),
      new THREE.MeshBasicMaterial({
        color: 0xe8f2f0,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      })
    );
    p.visible = false;
    p.userData = { life: 0, maxLife: 0, vx: 0, vy: 0, vz: 0 };
    g.add(p);
    splashes.push(p);
  }

  scene.add(g);

  // 深水碰撞体（世界坐标，切向阻挡与资产同一套）
  const deepWorld = flatToWorld(LAKE.x + LAKE.deepDX, 0.6, LAKE.z + LAKE.deepDZ, planetRadius);
  return {
    group: g,
    deepCollider: { position: deepWorld.clone(), radius: LAKE.rDeep },
    centerWorld: flatToWorld(LAKE.x, 0.6, LAKE.z, planetRadius).clone(),
    rOuter: LAKE.rOuter,
    surfaceR: planetRadius + 0.6,
    ripples,
    splashes,
    reflect,
    _splashCooldown: 0,
  };
}

/**
 * 涉水判定：玩家在主岛台面高度、且切向进入湖缘内 → 减速（写 player.wadeFactor）。
 * 深水区由碰撞体直接阻挡，到不了。
 * 若已在大湖涉水，取更小 factor。
 */
export function updateLakeWade(player, lake) {
  let factor = player.wadeFactor || 1;
  if (factor > LAKE.wadeFactor) factor = 1; // 本帧由大湖写过则保留较小值
  const r = player.position.length();
  if (Math.abs(r - lake.surfaceR) < 0.6) {
    _up.copy(player.position).normalize();
    _d.copy(player.position).sub(lake.centerWorld);
    _d.addScaledVector(_up, -_d.dot(_up)); // 切向距离
    if (_d.length() < lake.rOuter) factor = Math.min(factor, LAKE.wadeFactor);
  }
  player.wadeFactor = factor;
}

/**
 * 湖面动效：涟漪扩散 + 涉水水花 + 倒影微呼吸。
 * 在主循环每帧调用（updateLakeWade 之后）。
 */
export function updateLakeFx(lake, player, t, dt) {
  if (!lake) return;

  // 涟漪：scale 从 0.3→maxR，opacity 先升后降
  if (lake.ripples) {
    for (const ring of lake.ripples) {
      const ud = ring.userData;
      const u = ((t * ud.speed + ud.phase) % 2.8) / 2.8; // 0..1
      const sc = 0.35 + u * ud.maxR;
      ring.scale.set(sc, sc, sc);
      const fade = u < 0.15 ? u / 0.15 : 1 - (u - 0.15) / 0.85;
      ring.material.opacity = Math.max(0, fade) * 0.35;
    }
  }

  // 倒影微呼吸
  if (lake.reflect && lake.reflect.material) {
    lake.reflect.material.opacity = 0.18 + 0.06 * (0.5 + 0.5 * Math.sin(t * 0.7));
  }

  // 涉水水花：在浅水且移动时从池中取粒子
  const wading = (player.wadeFactor || 1) < 0.99;
  if (lake.splashes) {
    // 推进已有粒子
    for (const p of lake.splashes) {
      const ud = p.userData;
      if (ud.life <= 0) {
        p.visible = false;
        continue;
      }
      ud.life -= dt;
      p.position.x += ud.vx * dt;
      p.position.y += ud.vy * dt;
      p.position.z += ud.vz * dt;
      ud.vy -= 2.8 * dt; // 轻重力（湖局部 Y 为法线）
      const k = Math.max(0, ud.life / ud.maxLife);
      p.material.opacity = k * 0.55;
      p.scale.setScalar(0.6 + (1 - k) * 0.8);
      if (ud.life <= 0) p.visible = false;
    }

    if (wading) {
      // 玩家世界坐标 → 湖局部
      _quatInv.copy(lake.group.quaternion).invert();
      _local.copy(player.position).sub(lake.group.position).applyQuaternion(_quatInv);
      // 速度大小（世界）
      const spd = player.velocity ? player.velocity.length() : 0;
      lake._splashCooldown = (lake._splashCooldown || 0) - dt;
      if (spd > 0.6 && lake._splashCooldown <= 0) {
        lake._splashCooldown = 0.07;
        // 取一个闲置粒子
        const p = lake.splashes.find((s) => s.userData.life <= 0);
        if (p) {
          const ud = p.userData;
          ud.maxLife = 0.35 + Math.random() * 0.25;
          ud.life = ud.maxLife;
          p.position.set(
            _local.x + (Math.random() - 0.5) * 0.25,
            0.05 + Math.random() * 0.05,
            _local.z + (Math.random() - 0.5) * 0.25
          );
          ud.vx = (Math.random() - 0.5) * 1.2;
          ud.vy = 0.8 + Math.random() * 1.1;
          ud.vz = (Math.random() - 0.5) * 1.2;
          p.visible = true;
          p.material.opacity = 0.5;
          p.scale.setScalar(1);
        }
      }
    }
  }
}
