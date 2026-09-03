// =====================================================================
// 苔地季相染色验收（E3）：
//   · 苔地按世界位置纬度染色（冬青灰 / 秋暖褐 / 夏翠绿 / 春鲜嫩）；
//   · seasonBandsV1=false 时完全回落基准色（回滚路径干净）；
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(bridgePkg, JSON.stringify({
    name: "three", version: "0.172.0-local-bridge", type: "module",
    main: "../../vendor/three.module.js",
  }));
}
globalThis.window = {
  innerWidth: 1280, innerHeight: 720,
  addEventListener() {}, removeEventListener() {}, requestAnimationFrame() {},
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
};
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { buildImpastoMossyGround } = await import(new URL("src/world/mossyGround.js", BASE).href);
const { FEATURES, applyUrlOverrides } = await import(new URL("src/core/params.js", BASE).href);
const { latLonToDir } = await import(new URL("src/world/sphereMath.js", BASE).href);

// 1. 正常季相开启状态下：不同纬度的苔地色板不同
FEATURES.seasonBandsV1 = true;
const northDir = latLonToDir(56, 0, new THREE.Vector3()); // 苔庭纬度（冬季）
const southDir = latLonToDir(-24, 0, new THREE.Vector3()); // 水晶城纬度（夏季）

const gNorth = buildImpastoMossyGround({ dir: northDir, planetRadius: 160, size: 20 });
const gSouth = buildImpastoMossyGround({ dir: southDir, planetRadius: 160, size: 20 });

assert.notEqual(gNorth.userData.palette.emerald, gSouth.userData.palette.emerald, "南北不同纬度苔地色板应有季相差异");

// 2. 回滚测试：关闭季相开关后，恢复原始基色
FEATURES.seasonBandsV1 = false;
const gNorthRaw = buildImpastoMossyGround({ dir: northDir, planetRadius: 160, size: 20 });
const gSouthRaw = buildImpastoMossyGround({ dir: southDir, planetRadius: 160, size: 20 });

assert.equal(gNorthRaw.userData.palette.emerald, gSouthRaw.userData.palette.emerald, "关闭季相后所有苔地使用统一基色");

// 3. 复位
FEATURES.seasonBandsV1 = true;

console.log("test_mossy_ground_season: ok");
