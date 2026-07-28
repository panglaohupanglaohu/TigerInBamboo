// 从 wall-workspace.js 原样抽取函数，在 node 里真实运行 createPineMorphologyModel
import fs from "node:fs";
import * as THREE from "../frontend/assets/vendor/three/three.module.js";

const src = fs.readFileSync(new URL("../frontend/js/wall-workspace.js", import.meta.url), "utf8");

function extract(name) {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing ${name}`);
  let i = src.indexOf("{", start);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}") {
      depth--;
      if (depth === 0) return src.slice(start, j + 1);
    }
  }
  throw new Error(`unbalanced ${name}`);
}

const state = { envTint: null, palette: ["#645540"] };
const clamp = THREE.MathUtils.clamp;

const code = [
  extract("seededRandom"),
  extract("addCylinderBetween"),
  extract("normalizeProceduralRoot"),
  extract("createPineMorphologyModel"),
].join("\n");

const build = new Function("THREE", "state", "clamp", "seededRandom", `${code}; return createPineMorphologyModel;`);
const createPine = build(THREE, state, clamp, null);

// 用后端物象库 pine 方案的真实部件参数
const plan = {
  components: [
    { type: "woodyTrunk", role: "trunk", count: 1, radius: 0.055, height: 0.92 },
    { type: "branch", role: "woody-branches", count: 5, radius: 0.018, length: 0.42 },
    { type: "needleCluster", role: "foliage", count: 8, radius: 0.16, needles: 18 },
  ],
};
const subject = { id: "pine", label: "松" };
const layer = { id: "local-1" };
const root = createPine(plan, subject, layer);

root.updateMatrixWorld(true);
let meshes = 0;
let puffs = 0;
let cylinders = 0;
root.traverse((n) => {
  if (!n.isMesh) return;
  meshes++;
  if (n.geometry.type === "SphereGeometry") puffs++;
  if (n.geometry.type === "CylinderGeometry") cylinders++;
});
const box = new THREE.Box3().setFromObject(root);
const size = box.getSize(new THREE.Vector3());
console.log("meshes:", meshes, " puffs(needle puffs):", puffs, " cylinders(trunk/branch/needles):", cylinders);
console.log("bbox size:", size.toArray().map((v) => +v.toFixed(3)), " max dim:", Math.max(size.x, size.y, size.z).toFixed(3));
console.log("upright? y is longest:", size.y >= size.x && size.y >= size.z ? "no(can be bushy)" : `y=${size.y.toFixed(2)} x=${size.x.toFixed(2)} z=${size.z.toFixed(2)}`);
if (meshes < 50) throw new Error("too few parts — builder did not run as expected");
if (puffs < 4) throw new Error("needle puffs missing");
console.log("PASS");

// 导出顶点散点供 matplotlib 预览
const pts = [];
const cols = [];
const v = new THREE.Vector3();
root.traverse((n) => {
  if (!n.isMesh) return;
  const pos = n.geometry.getAttribute("position");
  const isBark = n.material.roughness > 0.9;
  const color = isBark ? [0.35, 0.25, 0.15] : [0.18, 0.32, 0.2];
  if (n.geometry.type === "CylinderGeometry") {
    // 沿柱体母线插值，避免仅靠两端顶点造成的稀疏断线
    const height = n.geometry.parameters.height;
    for (let k = 0; k <= 12; k++) {
      v.set(0, (k / 12 - 0.5) * height, 0).applyMatrix4(n.matrixWorld);
      pts.push([+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)]);
      cols.push(color);
    }
    return;
  }
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).applyMatrix4(n.matrixWorld);
    pts.push([+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)]);
    cols.push(color);
  }
});
fs.writeFileSync(new URL("./out/pine_model_points.json", import.meta.url), JSON.stringify({ pts, cols }));
console.log("points:", pts.length);
