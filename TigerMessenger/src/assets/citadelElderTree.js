// =====================================================================
//  高山圣城 · 参天树（独立地貌对象）
//  底部局部 Y=0；低多边形树干、五条主枝、八团云冠，全网格墨线描边。
// =====================================================================
import * as THREE from "three";
import { toonMat, addOutline } from "./toon.js";

function part(geometry, material, name, outline = 0.035) {
  const object = new THREE.Mesh(geometry, material);
  object.name = name;
  object.castShadow = true;
  object.receiveShadow = true;
  addOutline(object, outline, 0x1c2523, 0);
  return object;
}

function addLimb(parent, from, to, bottom, top, material, name) {
  const direction = to.clone().sub(from);
  const limb = part(
    new THREE.CylinderGeometry(top, bottom, direction.length(), 7),
    material,
    name
  );
  limb.position.copy(from).add(to).multiplyScalar(0.5);
  limb.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.normalize()
  );
  parent.add(limb);
  return limb;
}

/** @returns {THREE.Group} bottom at local Y=0 */
export function createCitadelElderTree(opts = {}) {
  const bark = toonMat(0x57462f, { flatShading: true });
  const leaf = toonMat(0x385e3e, { flatShading: true });
  const leafLight = toonMat(0x6f8b55, { flatShading: true });
  const tree = new THREE.Group();
  tree.name = "citadel-elder-tree";

  addLimb(tree, new THREE.Vector3(), new THREE.Vector3(-0.45, 15.5, 0.35),
    1.45, 0.72, bark, "citadel-elder-tree-trunk");
  addLimb(tree, new THREE.Vector3(-0.45, 14.2, 0.35), new THREE.Vector3(-1.2, 24.2, -0.4),
    0.76, 0.34, bark, "citadel-elder-tree-trunk");

  const branches = [
    [[-0.2, 10.2, 0.2], [-6.4, 17.7, 0.8], 0.6, 0.2],
    [[-0.4, 12.4, 0.1], [5.9, 19.6, -1.4], 0.58, 0.19],
    [[-0.7, 15.4, 0.0], [-5.0, 22.3, 3.4], 0.48, 0.16],
    [[-0.8, 16.8, -0.1], [4.5, 23.7, 2.8], 0.46, 0.15],
    [[-1.0, 19.8, -0.25], [-1.6, 27.0, -0.8], 0.38, 0.12],
  ];
  for (const [from, to, bottom, top] of branches) {
    addLimb(tree, new THREE.Vector3(...from), new THREE.Vector3(...to), bottom, top,
      bark, "citadel-elder-tree-branch");
  }

  const crowns = [
    [-6.2, 18.2, 0.8, 3.7, 1.2, 0.85], [-4.0, 21.2, 2.7, 3.4, 1.15, 0.9],
    [5.5, 20.1, -1.2, 4.0, 1.25, 0.88], [4.0, 23.3, 2.5, 3.35, 1.1, 0.92],
    [-1.8, 26.2, -0.6, 4.1, 1.05, 0.95], [1.7, 25.0, -1.0, 3.35, 1.1, 0.86],
    [-3.4, 23.6, -2.2, 3.15, 1.2, 0.82], [0.2, 28.2, 0.5, 3.25, 1.0, 0.92],
  ];
  crowns.forEach(([x, y, z, radius, sx, sy], index) => {
    const crown = part(
      new THREE.SphereGeometry(radius, 9, 6),
      index % 3 === 0 ? leafLight : leaf,
      "citadel-elder-tree-crown",
      0.028
    );
    crown.position.set(x, y, z);
    crown.scale.set(sx, sy, 1 + (index % 2) * 0.12);
    tree.add(crown);
  });

  const scale = Number.isFinite(opts.scale) ? opts.scale : 0.45;
  tree.scale.setScalar(scale);
  tree.userData.kind = "citadelElderTree";
  tree.userData.assetType = "citadelElderTree";
  tree.userData.collideRadius = 7 * scale;
  tree.userData.height = 31.5 * scale;
  tree.userData.seed = opts.seed ?? 0;
  return tree;
}
