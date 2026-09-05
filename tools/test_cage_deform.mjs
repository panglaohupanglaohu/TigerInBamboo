// =====================================================================
// C10 笼形变形：方格恒等；已知四边形双线性
// 用法：node tools/test_cage_deform.mjs
// =====================================================================
import assert from "node:assert/strict";

const SRC = new URL("../TigerMessenger/src/", import.meta.url);
const {
  bilinearXZ, cageMapUnit, squareCellCorners, cellCageCorners, cornerCageCorners,
} = await import(new URL("world/citadel/cageDeform.js", SRC).href);

const CS = 2;
const GS = 25;
const ix = 12;
const iz = 12;
const sq = squareCellCorners(ix, iz, CS, GS);
const half = (GS - 1) / 2;
const cx = (ix - half) * CS;
const cz = (iz - half) * CS;
assert.equal(sq[0][0], cx - CS / 2);
assert.equal(sq[3][0], cx + CS / 2);

const mid = bilinearXZ(sq[0], sq[1], sq[2], sq[3], 0.5, 0.5);
assert.ok(Math.abs(mid[0] - cx) < 1e-9);
assert.ok(Math.abs(mid[1] - cz) < 1e-9);

const p = cageMapUnit(0.25, 0.5, 0.25, sq, 0, 4);
assert.ok(Math.abs(p[0] - (sq[0][0] + 0.25 * CS)) < 1e-9);
assert.ok(Math.abs(p[1] - 2) < 1e-9);
assert.ok(Math.abs(p[2] - (sq[0][1] + 0.25 * CS)) < 1e-9);
console.log("✓ 方格双线性恒等");

const trap = [[0, 0], [4, 0], [1, 2], [3, 2]];
const c = bilinearXZ(trap[0], trap[1], trap[2], trap[3], 0.5, 0.5);
assert.ok(Math.abs(c[0] - 2) < 1e-9);
assert.ok(Math.abs(c[1] - 1) < 1e-9);
console.log("✓ 梯形重心 (2,1)");

const corners = cornerCageCorners(12, 12, { cellSize: CS, gridSize: GS });
const o = cageMapUnit(0, 0, 0, corners, 1, 3);
assert.ok(Math.abs(o[0] - (11 - half) * CS) < 1e-9);
assert.ok(Math.abs(o[1] - 1) < 1e-9);
console.log("✓ 角柱 (0,0,0) = 格 (gx-1,gz-1) 中心");

const same = cellCageCorners(5, 7, { cellSize: CS, gridSize: GS });
assert.deepEqual(same, squareCellCorners(5, 7, CS, GS));
console.log("✅ test_cage_deform");
