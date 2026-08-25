// =====================================================================
//  第一层瀑布样片 Three 网格。不替换 citadelRange 生产地形。
// =====================================================================
import * as THREE from "three";
import { SEMANTIC_HEX } from "./terrainExtract.js";

export function buildTerrainSampleMesh(extract) {
  const group = new THREE.Group();
  group.name = "citadel-v6-terrain-sample";
  group.userData.kind = "citadel-v6-terrain-sample";
  const vMap = new Map((extract.vertices || []).map((v) => [v.id, v]));
  const mats = new Map();
  const mat = (hex) => {
    let m = mats.get(hex);
    if (!m) {
      m = new THREE.MeshStandardMaterial({ color: hex || "#a9b2ab", roughness: 0.92, metalness: 0, flatShading: true, side: THREE.DoubleSide });
      mats.set(hex, m);
    }
    return m;
  };
  for (const f of extract.faces || []) {
    const pts = (f.vertexIds || []).map((id) => vMap.get(id)).filter(Boolean);
    if (pts.length < 3) continue;
    const geo = new THREE.BufferGeometry();
    const pos = [];
    const nrm = [];
    const n = f.normal || { x: 0, y: 1, z: 0 };
    for (let i = 1; i < pts.length - 1; i++) {
      const tri = [pts[0], pts[i], pts[i + 1]];
      for (const p of tri) {
        pos.push(p.x, p.y, p.z);
        nrm.push(n.x, n.y, n.z);
      }
    }
    geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
    const mesh = new THREE.Mesh(geo, mat(SEMANTIC_HEX[f.semantic] || f.color));
    mesh.name = `terrain-${f.semantic}`;
    mesh.userData.semantic = f.semantic;
    mesh.receiveShadow = true;
    group.add(mesh);
  }
  group.userData.stats = { faces: extract.faces?.length || 0, hash: extract.hash };
  return group;
}
