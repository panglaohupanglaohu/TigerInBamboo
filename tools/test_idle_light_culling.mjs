// =====================================================================
// 空闲灯剔除验收（2026-09-02）：
//   · intensity≈0 的点光/聚光被置 visible=false（移出 Three 光照 uniform 数组）；
//   · 强度回升后还原；
//   · 迟滞：阈值附近抖动不得反复开关（否则触发材质重编译风暴）；
//   · 不得还原「非本模块熄灭」的灯。
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

const THREE = await import(new URL("vendor/three.module.js", BASE).href);
const { createIdleLightCulling } = await import(
  new URL("src/render/lighting/idleLightCulling.js", BASE).href
);

const scene = new THREE.Scene();
const lamp = new THREE.PointLight(0xffffff, 0, 10, 2); // 白天：强度 0
const torch = new THREE.PointLight(0xffaa00, 1.2, 8, 2); // 常亮
const spot = new THREE.SpotLight(0x99ffee, 0, 200);
const manuallyHidden = new THREE.PointLight(0xff0000, 2.0, 5, 2);
manuallyHidden.visible = false; // 别人主动隐藏的灯
scene.add(lamp, torch, spot, manuallyHidden);

const culling = createIdleLightCulling({ scene, interval: 0 });

// 1. 强度 0 的灯被熄灭；常亮的不动
culling.update(1);
assert.equal(lamp.visible, false, "强度 0 的灯应被熄灭");
assert.equal(spot.visible, false, "强度 0 的聚光应被熄灭");
assert.equal(torch.visible, true, "常亮灯不得被熄灭");
assert.equal(culling.activeCount, 1, "仅 1 盏活跃");

// 2. 不得擅自点亮「别人隐藏的灯」
assert.equal(manuallyHidden.visible, false, "非本模块熄灭的灯不得被点亮");

// 3. 强度回升 → 还原
lamp.intensity = 0.9;
culling.update(1);
assert.equal(lamp.visible, true, "强度回升后应还原");

// 4. 迟滞：落在 offBelow 与 onAbove 之间时不得反复开关
lamp.intensity = 0.0015; // < offBelow(0.002) → 熄
culling.update(1);
assert.equal(lamp.visible, false, "低于 offBelow 应熄灭");
lamp.intensity = 0.01; // 在 0.002~0.02 之间 → 保持熄灭（迟滞带）
culling.update(1);
assert.equal(lamp.visible, false, "迟滞带内不得点亮，避免编译风暴");
lamp.intensity = 0.05; // > onAbove → 点亮
culling.update(1);
assert.equal(lamp.visible, true, "高于 onAbove 才点亮");

// 5. dispose 还原本模块熄灭的灯，且不动别人的
spot.intensity = 0;
culling.update(1);
assert.equal(spot.visible, false);
culling.dispose();
assert.equal(spot.visible, true, "dispose 应还原本模块熄灭的灯");
assert.equal(manuallyHidden.visible, false, "dispose 不得点亮别人隐藏的灯");

console.log("test_idle_light_culling: ok");
