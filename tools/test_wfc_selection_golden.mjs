// =====================================================================
// G-06 · WFC 选型层 golden（2026-09-04 重写）
//
// 原来这里试图证明「WFC 无约束时输出 == 哈希路径输出」。那条不成立，也没意义：
//   · WFC 的观察是加权随机，本来就不会等于哈希；
//   · C5 之后域已经不是「8 个装饰家族」而是「体块角色」，两边根本不同构。
// 真正该冻的是这三条：
//   1) 解可回放：把一个解全部钉回去，换 seed 也必须逐格一致（pins 生效）
//   2) 确定性：同 seed 同 hash，换 seed 必换 hash（seed 真的进了随机流）
//   3) 真实布局 100 seed 零失败（约束不至于把正常城市解死）
// 运行：node tools/test_wfc_selection_golden.mjs
// =====================================================================
import assert from "node:assert/strict";

const SRC = new URL("../TigerMessenger/src/", import.meta.url);
const town = await import(new URL("world/citadelTown.js", SRC).href);
const { solveTownSelection } = await import(new URL("world/citadel/wfcTownSelection.js", SRC).href);

const layout = town.normalizeCitadelTerraceLayout(town.HIGHLAND_TOWNSCAPER_TOWN_SPEC, 12);
const grid = town.levelsToGrid(layout.levels ?? layout.terraces?.[0]?.levels ?? layout);
assert.ok(grid.size >= 900, `highland cells ${grid.size} < 900`);

const A = solveTownSelection({ grid, seed: 1 });
assert.ok(A.ok, `base solve failed: ${A.failure?.reason} @${A.failure?.cell}`);

// 1) 回放
const pins = Object.entries(A.byCell).map(([cell, c]) => ({ cell, variant: c.key }));
const replay = solveTownSelection({ grid, seed: 12345, pins });
assert.ok(replay.ok, `replay failed: ${replay.failure?.reason}`);
let matched = 0;
for (const [id] of grid) if (replay.byCell[id]?.key === A.byCell[id].key) matched++;
assert.equal(matched, grid.size, `replay ${matched}/${grid.size}`);

// 2) 确定性
assert.equal(solveTownSelection({ grid, seed: 1 }).hash, A.hash, "同 seed 出了不同 hash");
assert.notEqual(solveTownSelection({ grid, seed: 2 }).hash, A.hash, "换 seed 竟然同 hash");

// 3) 可解性
let fails = 0;
for (let s = 1; s <= 100; s++) if (!solveTownSelection({ grid, seed: s }).ok) fails++;
assert.equal(fails, 0, `100 seed 里 ${fails} 次无解`);

console.log(`✅ test_wfc_selection_golden（${grid.size} 格 · 回放 ${matched}/${grid.size} · hash ${A.hash} · 100 seed 零失败）`);
