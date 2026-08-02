// =====================================================================
//  NPC：六棱柱身体；贴球面平台
// =====================================================================
import * as THREE from "three";
import { flatToWorld, quatYToDir, surfaceNormal } from "../world/sphereMath.js";
import { PLANET_RADIUS } from "../world/planet.js";
import { findPlatformTopAtFlat } from "../world/platforms.js";
import { toonMat, addOutline, OUTLINE } from "../assets/toon.js";

const _dir = new THREE.Vector3();
const _quat = new THREE.Quaternion();

export function createNpc(scene, platforms, def, role) {
  const g = new THREE.Group();
  const bodyMat = toonMat(def.color, { emissive: def.color, emissiveIntensity: 0.15 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.9, 6), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  addOutline(body, OUTLINE.character);
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    toonMat(0xf5d0b0)
  );
  head.position.y = 1.2;
  head.castShadow = true;
  addOutline(head, OUTLINE.characterDetail);
  g.add(head);

  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.75, 24),
    new THREE.MeshBasicMaterial({
      color: def.color,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.05;
  g.add(ring);

  // 日系轻量顶标：短光柱（弱化夜景「光柱」感）
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.14, 1.2, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: def.color,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  beam.position.y = 1.85;
  g.add(beam);

  const orb = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.18, 0),
    new THREE.MeshStandardMaterial({
      color: def.color,
      emissive: def.color,
      emissiveIntensity: 0.9,
      roughness: 0.35,
      flatShading: true,
    })
  );
  orb.position.y = 2.35;
  g.add(orb);

  // 平面设计坐标 → 球面：优先落在匹配平台顶面高度
  const [fx, fy, fz] = def.pos;
  const plat = findPlatformTopAtFlat(platforms, fx, fz);
  const height = plat ? plat.flatPos[1] : fy;
  flatToWorld(fx, height, fz, PLANET_RADIUS, g.position);
  surfaceNormal(g.position, _dir);
  quatYToDir(_dir, _quat);
  g.quaternion.copy(_quat);

  g.userData = {
    role,
    name: def.name,
    color: def.color,
    ring,
    beam,
    orb,
    active: false,
    flatPos: [fx, fy, fz],
  };
  scene.add(g);
  return g;
}

export function setNpcMarker(group, on) {
  group.userData.active = on;
  group.userData.ring.visible = on;
  group.userData.beam.visible = on;
  group.userData.orb.visible = on;
}

export function animateMarkers(npcGroups, t) {
  for (const g of npcGroups.values()) {
    if (!g.userData.orb.visible) continue;
    g.userData.orb.position.y = 2.35 + Math.sin(t * 2.5 + g.position.x) * 0.12;
    g.userData.orb.rotation.y += 0.02;
    g.userData.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
  }
}
