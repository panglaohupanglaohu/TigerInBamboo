// =====================================================================
// 窗必须属于墙模块（2026-09-03 主人定案）
//
// Townscaper/WFC 的核心不变量：窗是墙模块的一部分，墙变窗必变。
// 2026-08-24 的性能优化（404 逐窗 draw call → 2 个 InstancedMesh）把窗从
// 墙剥离、矩阵构建期烘死，破坏了这条不变量——删格/建格两个方向都会在
// 空中留下悬空窗。本测试钉住「不许再剥离」。
// =====================================================================
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { stripComments } from "./lib/stripComments.mjs";

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
const citadel = await import(new URL("src/world/odysseyCitadel.js", BASE).href);
const { rebuildCitadelWindowInstances, syncCitadelWindowInstances } = citadel;

// 1. 拆除：旧实例表被移除，原窗 mesh 恢复成正常可见网格
const castle = new THREE.Group();
const geometry = new THREE.PlaneGeometry(1, 1);
const win = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial());
win.name = "town-window";
win.visible = false;          // 旧优化把它藏了
win.raycast = () => {};       // 旧优化把它禁拾取了
castle.add(win);
const dark = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), 1);
const lit = new THREE.InstancedMesh(geometry, new THREE.MeshBasicMaterial(), 1);
castle.add(dark, lit);
castle.userData.windowInstances = { dark, lit, records: [{ mesh: win }] };

rebuildCitadelWindowInstances(castle);
assert.equal(castle.userData.windowInstances, null, "实例表必须拆除");
assert.equal(win.visible, true, "窗要恢复成正常可见网格");
assert.equal(dark.parent, null, "dark 实例网格要移出场景");
assert.equal(lit.parent, null, "lit 实例网格要移出场景");
assert.notEqual(win.raycast, undefined, "raycast 恢复为原型方法（可拾取）");

// 2. 幂等：再拆一次不报错
rebuildCitadelWindowInstances(castle);
assert.equal(castle.userData.windowInstances, null);

// 3. sync 变成空操作，不得重新造出实例表
syncCitadelWindowInstances(castle);
assert.equal(castle.userData.windowInstances, null, "sync 不得复活实例表");

// 4. 空输入不炸
rebuildCitadelWindowInstances(null);
syncCitadelWindowInstances({ userData: {} });

// 5. 源码守卫：不许再把窗打包成全城共享 InstancedMesh
const src = stripComments(fs.readFileSync(
  fileURLToPath(new URL("../TigerMessenger/src/world/odysseyCitadel.js", import.meta.url)), "utf8"));
assert.doesNotMatch(src, /new THREE\.InstancedMesh\([^)]*windows\[0\]/,
  "窗又被剥离成 InstancedMesh 了——墙变窗不变的老 bug 会复发");
assert.doesNotMatch(src, /citadel-window-instances-(dark|lit)/,
  "不得再创建全城共享窗实例网格");

// 6. 夜间亮灭仍然可用：逐窗材质切换路径必须还在
assert.match(src, /w\.material !== \(on \? lit : dark\)/,
  "夜间窗光的材质切换路径丢失");

console.log("✅ test_window_in_wall");
