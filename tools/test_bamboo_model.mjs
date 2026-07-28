// 从 wall-workspace.js 原样抽取函数，真实运行 createBambooMorphologyModel 并导出散点
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
  extract("angleDistance"),
  extract("addCylinderBetween"),
  extract("normalizeProceduralRoot"),
  extract("createCurvedPetalGeometry"),
  extract("createBambooMorphologyModel"),
].join("\n");

const build = new Function("THREE", "state", "clamp", `${code}; return createBambooMorphologyModel;`);
const createBamboo = build(THREE, state, clamp);

// 后端物象库 bamboo 方案的真实部件参数
const plan = {
  components: [
    { type: "culm", role: "vertical-stem", count: 2, radius: 0.026, height: 1.05, nodes: 7 },
    { type: "nodeRing", role: "bamboo-nodes", count: 14, radius: 0.03, height: 0.01 },
    { type: "twig", role: "lateral-branch", count: 5, radius: 0.01, length: 0.24 },
    { type: "lanceolateLeaf", role: "leaf-cluster", count: 16, length: 0.18, width: 0.035, thickness: 0.004 },
  ],
};
const root = createBamboo(plan, { id: "bamboo", label: "竹" }, { id: "local-1" });
root.updateMatrixWorld(true);

const pts = [];
const cols = [];
const v = new THREE.Vector3();
root.traverse((n) => {
  if (!n.isMesh) return;
  const color = n.material.color ? [n.material.color.r, n.material.color.g, n.material.color.b] : [0.5, 0.5, 0.5];
  if (n.geometry.type === "CylinderGeometry") {
    const height = n.geometry.parameters.height;
    for (let k = 0; k <= 10; k++) {
      v.set(0, (k / 10 - 0.5) * height, 0).applyMatrix4(n.matrixWorld);
      pts.push([+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)]);
      cols.push(color);
    }
    return;
  }
  const pos = n.geometry.getAttribute("position");
  for (let i = 0; i < pos.count; i += 1) {
    v.fromBufferAttribute(pos, i).applyMatrix4(n.matrixWorld);
    pts.push([+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)]);
    cols.push(color);
  }
});
fs.writeFileSync(new URL("./out/bamboo_model_points.json", import.meta.url), JSON.stringify({ pts, cols }));
let meshes = 0;
root.traverse((n) => n.isMesh && meshes++);
console.log("meshes:", meshes, "points:", pts.length);
