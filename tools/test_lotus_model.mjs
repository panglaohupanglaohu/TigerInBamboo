// 从 wall-workspace.js 原样抽取函数，真实运行 createLotusMorphologyModel 并导出散点
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
  extract("morphologyMaterials"),
  extract("createLotusLeafGeometry"),
  extract("createCurvedPetalGeometry"),
  extract("addMorphologyWaterline"),
  extract("createLotusMorphologyModel"),
].join("\n");

const build = new Function("THREE", "state", "clamp", `${code}; return createLotusMorphologyModel;`);
const createLotus = build(THREE, state, clamp);

// 后端物象库 lotus 方案的真实部件参数
const plan = {
  components: [
    { type: "petiole", count: 2, radius: 0.018, height: 0.72, lean: 0.18 },
    { type: "lotusLeaf", count: 2, radiusX: 0.34, radiusY: 0.27, thickness: 0.018, dome: 0.045, veins: 12, notch: 0.16 },
    { type: "flowerStem", count: 1, radius: 0.014, height: 0.88, lean: -0.08 },
    { type: "petalLayer", role: "outer-petals", count: 9, length: 0.22, width: 0.07, thickness: 0.014, tilt: 0.65 },
    { type: "petalLayer", role: "middle-petals", count: 8, length: 0.18, width: 0.06, thickness: 0.012, tilt: 0.34 },
    { type: "petalLayer", role: "inner-petals", count: 7, length: 0.13, width: 0.045, thickness: 0.01, tilt: 0.1 },
    { type: "seedpod", count: 1, radius: 0.05, height: 0.035 },
  ],
};
const root = createLotus(plan, { id: "lotus", label: "莲花" }, { id: "local-1" });
root.updateMatrixWorld(true);

const pts = [];
const cols = [];
const v = new THREE.Vector3();
root.traverse((n) => {
  if (!n.isMesh) return;
  const rough = n.material.roughness ?? 0.8;
  const color = n.material.color ? [n.material.color.r, n.material.color.g, n.material.color.b] : [0.5, 0.5, 0.5];
  const pos = n.geometry.getAttribute("position");
  if (n.geometry.type === "CylinderGeometry") {
    const height = n.geometry.parameters.height;
    for (let k = 0; k <= 10; k++) {
      v.set(0, (k / 10 - 0.5) * height, 0).applyMatrix4(n.matrixWorld);
      pts.push([+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)]);
      cols.push(color);
    }
    return;
  }
  const step = Math.max(1, Math.floor(pos.count / 900));
  for (let i = 0; i < pos.count; i += step) {
    v.fromBufferAttribute(pos, i).applyMatrix4(n.matrixWorld);
    pts.push([+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)]);
    cols.push(color);
  }
});
fs.writeFileSync(new URL("./out/lotus_model_points.json", import.meta.url), JSON.stringify({ pts, cols }));
console.log("meshes:", (() => { let c = 0; root.traverse((n) => n.isMesh && c++); return c; })(), "points:", pts.length);
