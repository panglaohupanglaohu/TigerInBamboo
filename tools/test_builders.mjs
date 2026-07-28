// 从 wall-workspace.js 原样抽取函数，真实运行新构建器并导出散点
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

const names = process.argv[2] ? [process.argv[2]] : [
  "createFishMorphologyModel",
  "createInsectMorphologyModel",
  "createQuadrupedMorphologyModel",
  "createTerrainMorphologyModel",
  "createReedMorphologyModel",
  "createPlumMorphologyModel",
  "createVineMorphologyModel",
];

const code = [
  extract("seededRandom"),
  extract("angleDistance"),
  extract("addCylinderBetween"),
  extract("normalizeProceduralRoot"),
  extract("createCurvedPetalGeometry"),
  ...names.map(extract),
].join("\n");

const build = new Function("THREE", "state", "clamp", `${code}; return { ${names.map((n) => `${n.replace("create", "").replace("MorphologyModel", "")}: ${n}`).join(", ")} };`);
const builders = build(THREE, state, clamp);

const plans = {
  Fish: { components: [{ type: "fishBody", length: 0.4, height: 0.14, width: 0.05 }, { type: "tailFin", length: 0.14, height: 0.12 }, { type: "dorsalFin", length: 0.14, height: 0.06 }, { type: "pectoralFin", count: 2, length: 0.08, height: 0.05 }] },
  Insect: { components: [{ type: "insectBody", length: 0.16, radius: 0.02 }, { type: "antenna", count: 2, length: 0.08 }, { type: "insectWing", role: "fore-wings", count: 2, length: 0.2, width: 0.12 }, { type: "insectWing", role: "hind-wings", count: 2, length: 0.14, width: 0.09 }] },
  Quadruped: { components: [{ type: "torso", length: 0.42, height: 0.18, width: 0.14 }, { type: "headNeck", radius: 0.075, neckLength: 0.08 }, { type: "legJointed", count: 4, radius: 0.022, height: 0.2 }, { type: "tail", radius: 0.014, length: 0.26 }] },
  Terrain: { components: [{ type: "peakCluster", count: 3, radius: 0.16, height: 0.4 }, { type: "rockMass", count: 2, radius: 0.1 }] },
  Reed: { components: [{ type: "reedStem", count: 5, radius: 0.012, height: 0.95 }, { type: "linearLeaf", count: 14, length: 0.36, width: 0.025 }, { type: "plume", count: 3, radius: 0.035, height: 0.18 }] },
  Plum: { components: [{ type: "gnarledBranch", radius: 0.022, length: 0.5 }, { type: "twig", count: 4, radius: 0.008, length: 0.14 }, { type: "blossom", count: 6, radius: 0.035, petals: 5 }] },
  Vine: { components: [{ type: "curvedVine", radius: 0.018, length: 0.92 }, { type: "leaf", count: 10, length: 0.18, width: 0.05 }, { type: "hangingPetals", count: 12, length: 0.09, width: 0.035 }] },
};

const all = {};
for (const [name, builder] of Object.entries(builders)) {
  const root = builder(plans[name] || {}, { id: name.toLowerCase(), label: name }, { id: "local-1" });
  root.updateMatrixWorld(true);
  const pts = [];
  const v = new THREE.Vector3();
  let meshes = 0;
  root.traverse((n) => {
    if (!n.isMesh) return;
    meshes++;
    const pos = n.geometry.getAttribute("position");
    if (n.geometry.type === "CylinderGeometry" || n.geometry.type === "ConeGeometry") {
      const height = n.geometry.parameters.height;
      for (let k = 0; k <= 8; k++) {
        v.set(0, (k / 8 - 0.5) * height, 0).applyMatrix4(n.matrixWorld);
        pts.push([+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)]);
      }
      return;
    }
    const step = Math.max(1, Math.floor(pos.count / 300));
    for (let i = 0; i < pos.count; i += step) {
      v.fromBufferAttribute(pos, i).applyMatrix4(n.matrixWorld);
      pts.push([+v.x.toFixed(4), +v.y.toFixed(4), +v.z.toFixed(4)]);
    }
  });
  all[name] = { pts, meshes };
  console.log(`${name}: meshes=${meshes} points=${pts.length}`);
}
fs.writeFileSync(new URL("./out/builders_points.json", import.meta.url), JSON.stringify(all));
