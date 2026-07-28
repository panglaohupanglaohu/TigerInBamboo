// 从 wall-workspace.js 原样抽取函数，真实运行 createAvianMorphologyModel 并导出散点
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

const state = { envTint: null, palette: ["#645540"], creatureColor: "#7a6a55" };
const clamp = THREE.MathUtils.clamp;

const code = [
  extract("seededRandom"),
  extract("angleDistance"),
  extract("addCylinderBetween"),
  extract("normalizeProceduralRoot"),
  extract("createCurvedPetalGeometry"),
  extract("createAvianMorphologyModel"),
].join("\n");

const build = new Function("THREE", "state", "clamp", `${code}; return createAvianMorphologyModel;`);
const createAvian = build(THREE, state, clamp);

// 后端物象库 bird 方案的真实部件参数
const plan = {
  components: [
    { type: "birdBody", count: 1, radiusX: 0.17, radiusY: 0.12, radiusZ: 0.1 },
    { type: "birdHead", count: 1, radius: 0.07, neckLength: 0.1 },
    { type: "beak", count: 1, length: 0.06, radius: 0.012 },
    { type: "wingPair", count: 1, span: 0.42, chord: 0.14, thickness: 0.008 },
    { type: "tailFan", count: 1, length: 0.16, width: 0.09, thickness: 0.006 },
    { type: "birdLeg", count: 2, radius: 0.006, height: 0.12 },
  ],
};
const root = createAvian(plan, { id: "biology-manual-avian", kind: "avian", label: "画中禽鸟" }, { id: "local-1" });
root.updateMatrixWorld(true);

const pts = [];
const cols = [];
const v = new THREE.Vector3();
root.traverse((n) => {
  if (!n.isMesh) return;
  const color = n.material.color ? [n.material.color.r, n.material.color.g, n.material.color.b] : [0.5, 0.5, 0.5];
  if (n.geometry.type === "CylinderGeometry" || n.geometry.type === "ConeGeometry") {
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
fs.writeFileSync(new URL("./out/avian_model_points.json", import.meta.url), JSON.stringify({ pts, cols }));
let meshes = 0;
root.traverse((n) => n.isMesh && meshes++);
console.log("meshes:", meshes, "points:", pts.length);
