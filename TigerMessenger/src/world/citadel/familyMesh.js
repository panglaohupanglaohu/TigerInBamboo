// =====================================================================
//  单簇样片 Three 网格。不替换全城 presentationMesh（等主人确认）。
// =====================================================================
import * as THREE from "three";
import { frameToWorld } from "./moduleFrame.js";

export function buildClusterSampleMesh(sample) {
  const group = new THREE.Group();
  group.name = "citadel-v6-cluster-sample";
  group.userData.kind = "citadel-v6-cluster-sample";
  const mats = new Map();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const mat = (hex) => {
    let m = mats.get(hex);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: hex || "#cccccc", roughness: 0.88, metalness: 0, flatShading: true });
      mats.set(hex, m);
    }
    return m;
  };
  for (const s of sample.solids || []) {
    if (!s.frame) continue;
    const a = frameToWorld(s.frame, s.u0, s.v0, s.h0);
    const b = frameToWorld(s.frame, s.u1, s.v1, s.h1);
    const mesh = new THREE.Mesh(box, mat(s.material));
    mesh.position.set((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, (a.z + b.z) * 0.5);
    mesh.scale.set(Math.max(0.02, Math.abs(b.x - a.x)), Math.max(0.02, Math.abs(b.y - a.y)), Math.max(0.02, Math.abs(b.z - a.z)));
    mesh.name = s.kind === "inset-opening" ? "sample-opening" : `sample-${s.semantic}`;
    mesh.userData.semantic = s.semantic;
    mesh.userData.inset = s.inset;
    mesh.userData.cutout = s.cutout;
    mesh.castShadow = true;
    group.add(mesh);
  }
  group.userData.stats = { solids: group.children.length, cells: sample.cellCount, props: sample.placed?.length || 0 };
  return group;
}
