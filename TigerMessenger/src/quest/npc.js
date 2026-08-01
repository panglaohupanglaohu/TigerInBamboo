// =====================================================================
//  NPC：六棱柱身体 + 光圈 / 光柱 / 标记球
// =====================================================================
import * as THREE from "three";

export function createNpc(scene, platforms, def, role) {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: def.color,
    roughness: 0.65,
    flatShading: true,
    emissive: def.color,
    emissiveIntensity: 0.15,
  });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.35, 0.9, 6), bodyMat);
  body.position.y = 0.55;
  body.castShadow = true;
  g.add(body);

  const head = new THREE.Mesh(
    new THREE.SphereGeometry(0.28, 8, 6),
    new THREE.MeshStandardMaterial({
      color: 0xf5d0b0,
      roughness: 0.7,
      flatShading: true,
    })
  );
  head.position.y = 1.2;
  head.castShadow = true;
  g.add(head);

  // 角色脚下光圈
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

  // 头顶光柱
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.06, 0.2, 2.2, 8, 1, true),
    new THREE.MeshBasicMaterial({
      color: def.color,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  beam.position.y = 2.0;
  g.add(beam);

  // 悬浮标记球
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

  // 贴到对应平台顶面
  let standY = def.pos[1];
  for (const p of platforms) {
    if (
      def.pos[0] >= p.min.x - 0.1 &&
      def.pos[0] <= p.max.x + 0.1 &&
      def.pos[2] >= p.min.z - 0.1 &&
      def.pos[2] <= p.max.z + 0.1
    ) {
      standY = p.max.y;
      break;
    }
  }

  g.position.set(def.pos[0], standY, def.pos[2]);
  g.userData = {
    role,
    name: def.name,
    color: def.color,
    ring,
    beam,
    orb,
    active: false,
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

// 激活 NPC 的标记动画
export function animateMarkers(npcGroups, t) {
  for (const g of npcGroups.values()) {
    if (!g.userData.orb.visible) continue;
    g.userData.orb.position.y = 2.35 + Math.sin(t * 2.5 + g.position.x) * 0.12;
    g.userData.orb.rotation.y += 0.02;
    g.userData.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
  }
}
