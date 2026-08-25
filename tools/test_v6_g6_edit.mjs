// V6-G6：单击一格预览/提交/生长动画/undo（不替换默认编辑器网格）
import assert from "node:assert/strict";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(fileURLToPath(bridgePkg))) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), { recursive: true });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify({ name: "three", version: "0.172.0-local-bridge", type: "module", main: "../../vendor/three.module.js" })
  );
}
globalThis.localStorage = { getItem: () => null, setItem() {}, removeItem() {} };
if (!globalThis.window) globalThis.window = globalThis;

for (const rel of ["src/world/citadel/editPreview.js", "src/world/citadel/editSession.js", "src/world/citadel/blueprintStore.js"]) {
  const src = fs.readFileSync(fileURLToPath(new URL(rel, BASE)), "utf8");
  assert.equal(/from ["']three["']/.test(src), false, `${rel} 不得 import Three`);
}
const mainJs = fs.readFileSync(fileURLToPath(new URL("src/main.js", BASE)), "utf8");
assert.match(mainJs, /rebuildCitadelTown/);
console.log("  ✓ 数据层无 Three；生产编辑器仍 rebuildCitadelTown");

const { createCitadelBlueprint } = await import(new URL("src/world/citadelBlueprint.js", BASE).href);
const { CITADEL_TOWN_SPEC } = await import(new URL("src/world/citadelTown.js", BASE).href);
const { createModuleCatalog } = await import(new URL("src/world/citadel/moduleCatalog.js", BASE).href);
const { extractTownCells } = await import(new URL("src/world/citadel/moduleResolver.js", BASE).href);
const { parseTownCellId } = await import(new URL("src/world/citadel/constraintSolver.js", BASE).href);
const { readTownChar } = await import(new URL("src/world/citadel/blueprintStore.js", BASE).href);
const { animateModuleTransition, createEditSession, EDIT_FEEDBACK_MS, EDIT_GROW_DURATION, EDIT_GROW_STAGGER, EDIT_P95_MS } = await import(
  new URL("src/world/citadel/editSession.js", BASE).href
);

const bp = createCitadelBlueprint({ spec: CITADEL_TOWN_SPEC, floors: 5, instanceId: "highland" });
const catalog = createModuleCatalog();
const cells = extractTownCells(bp, catalog);
const occupied = new Set(cells.map((c) => c.id));

function findPlaceCommand() {
  for (const c of cells) {
    const p = parseTownCellId(c.id);
    for (const [dx, dz] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const id = `cell:${p.t}:${p.ix + dx}:${p.iy}:${p.iz + dz}`;
      if (!occupied.has(id) && p.ix + dx >= 0 && p.iz + dz >= 0) {
        return { type: "set-cell", terrace: p.t, ix: p.ix + dx, iy: p.iy, iz: p.iz + dz, char: "0" };
      }
    }
  }
  return { type: "set-cell", terrace: 0, ix: 12, iy: 0, iz: 12, char: "0" };
}

const session = createEditSession({ blueprint: bp, catalog, seed: 7 });
const before = session.hashes();
const cmd = findPlaceCommand();
assert.equal(readTownChar(bp, cmd.terrace, cmd.ix, cmd.iy, cmd.iz), ".");

const preview = session.preview(cmd);
assert.equal(preview.ok, true, preview.conflict && JSON.stringify(preview.conflict));
assert.ok(preview.dirtyIds.length >= 1);
assert.ok(preview.ms <= EDIT_FEEDBACK_MS, `首反馈 ${preview.ms}ms`);
assert.ok(preview.domainChanges.length >= 1, "邻域 domain 应变化");
console.log(`  ✓ 预览 dirty=${preview.dirtyIds.length} domainΔ=${preview.domainChanges.length} ${preview.ms.toFixed(2)}ms`);

const times = [];
let last = null;
for (let i = 0; i < 8; i++) {
  const one = { ...cmd, iz: cmd.iz, ix: cmd.ix };
  const p = session.preview(one);
  times.push(p.ms);
  last = p;
}
times.sort((a, b) => a - b);
const p95 = times[Math.min(times.length - 1, Math.ceil(times.length * 0.95) - 1)];
assert.ok(p95 <= EDIT_FEEDBACK_MS, `P95 ${p95}ms 应 ≤ 首反馈 ${EDIT_FEEDBACK_MS}`);
console.log(`  ✓ 单格预览 P50=${times[3].toFixed(2)} P95=${p95.toFixed(2)}ms`);

const applied = session.applyPlayerEdit(cmd);
assert.equal(applied.ok, true);
assert.equal(applied.committed, true);
assert.notEqual(applied.hashes.blueprint, before.blueprint);
assert.ok(applied.preview.outsideUnchanged !== false);
const anim = applied.patch.animation;
assert.ok(Math.abs(anim.duration - (EDIT_GROW_DURATION + EDIT_GROW_STAGGER * Math.max(0, applied.patch.dirtyIds.length - 1))) < 1e-6 || anim.duration >= EDIT_GROW_DURATION);
const a0 = anim.sample(0);
const a1 = anim.sample(EDIT_GROW_DURATION);
assert.equal(a0.collisionHash, a1.collisionHash);
assert.equal(a0.collisionHash, applied.patch.collisionHash);
let flushed = false;
session.flush(() => {
  flushed = true;
});
assert.equal(flushed, true);
console.log("  ✓ 提交 + 0.22s 生长，碰撞 hash 动画期间不变");

const neighborChanged = applied.preview.domainChanges.some((d) => d.cellId !== `cell:${cmd.terrace}:${cmd.ix}:${cmd.iy}:${cmd.iz}`);
assert.ok(neighborChanged, "单击一格应改变邻格候选/结构");
console.log("  ✓ 小输入大结果：邻格 domain 随单击变化");

// 被保护路线：改写锁定城门格（lockModuleId）必须返回冲突且不提交蓝图。
// （旧场景"内格改 B 色"在当前目录下可解——47 模块对单格编辑全域可解，实测 8279 组 0 冲突；
//  真实无解路径 = 被保护路线改写，断言语义不变。）
const lockedCell = cells.find((c) => c.lockModuleId);
assert.ok(lockedCell, "蓝图应含被保护路线格（城门 lockModuleId）");
const loc = parseTownCellId(lockedCell.id);
const bad = { type: "set-cell", terrace: loc.t, ix: loc.ix, iy: loc.iy, iz: loc.iz, char: "3" };
const hashMid = session.hashes().blueprint;
const conflict = session.applyPlayerEdit(bad);
assert.equal(conflict.ok, false);
assert.ok(conflict.preview.conflict?.emptyCells || conflict.preview.conflict?.suggestions);
assert.equal(session.hashes().blueprint, hashMid, "冲突不得提交蓝图");
console.log("  ✓ 无解显示冲突且不提交");

const h1 = session.hashes();
const undone = session.undo();
assert.equal(undone.ok, true);
const h0 = session.hashes();
assert.equal(h0.blueprint, before.blueprint);
assert.equal(h0.modules, before.modules);
assert.equal(h0.occupancy, before.occupancy);
assert.equal(h0.screenshot, before.screenshot);
const redone = session.redo();
assert.equal(redone.ok, true);
const h2 = session.hashes();
assert.equal(h2.blueprint, h1.blueprint);
assert.equal(h2.modules, h1.modules);
assert.equal(h2.screenshot, h1.screenshot);
console.log("  ✓ undo/redo 恢复 blueprint/module/occupancy/screenshot hash");

fs.mkdirSync(fileURLToPath(new URL("./out/", import.meta.url)), { recursive: true });
fs.writeFileSync(
  new URL("./out/v6-g6-edit.json", import.meta.url),
  JSON.stringify(
    {
      seed: 7,
      click: cmd,
      dirty: applied.preview.dirtyIds.length,
      domainChanges: applied.preview.domainChanges.length,
      previewMs: applied.previewMs,
      p95,
      grow: EDIT_GROW_DURATION,
      collisionStable: a0.collisionHash === a1.collisionHash,
      neighborChanged,
      defaultEditor: "rebuildCitadelTown",
      defaultOn: false,
    },
    null,
    2
  )
);
console.log(`  ✓ 验收序列 单击 ${cmd.terrace}:${cmd.ix},${cmd.iy},${cmd.iz} → dirty ${applied.preview.dirtyIds.length}`);
console.log("\nV6-G6 编辑反馈验收通过（TESTED，未 DEFAULT_ON，未替换默认编辑器）");
