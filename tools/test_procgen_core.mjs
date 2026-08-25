// V7-G1：Procgen Core 测试（BitSet / StableRng / Heap / Trail / 图适配器 / 静态扫描）
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const BASE = fileURLToPath(new URL("../TigerMessenger/", import.meta.url));
const { BitSet, bitSetOf, popcount32, ntz32 } = await import(
  new URL("src/procgen/core/bitSet.js", "file://" + BASE).href
);
const { StableRng, createStableRng } = await import(
  new URL("src/procgen/core/stableRng.js", "file://" + BASE).href
);
const { VersionedMinHeap } = await import(
  new URL("src/procgen/core/priorityQueue.js", "file://" + BASE).href
);
const { Trail, ChoicePoint } = await import(new URL("src/procgen/core/trail.js", "file://" + BASE).href);
const { TraceRingBuffer, Diagnostics, EventLog } = await import(
  new URL("src/procgen/core/diagnostics.js", "file://" + BASE).href
);
const { createRectGrid2D } = await import(new URL("src/procgen/graph/rectGrid2d.js", "file://" + BASE).href);
const { createVoxelGrid3D } = await import(new URL("src/procgen/graph/voxelGrid3d.js", "file://" + BASE).href);
const { createHalfEdgeGraph, buildCrossIds } = await import(
  new URL("src/procgen/graph/halfEdgeGraph.js", "file://" + BASE).href
);
const { GOLDEN_SEEDS, RNG_STREAMS, schemaVersionStamp } = await import(
  new URL("src/procgen/core/schema.js", "file://" + BASE).href
);

let passed = 0;
const ok = (msg) => {
  passed++;
  console.log(`  ✓ ${msg}`);
};

// ---------- BitSet ----------
{
  for (const size of [1, 31, 32, 33, 63, 64, 65]) {
    const full = new BitSet(size, true);
    assert.equal(full.popcount(), size, `full popcount size=${size}`);
    assert.equal(full.firstSetBit(), 0);
    const empty = new BitSet(size, false);
    assert.equal(empty.popcount(), 0, `empty popcount size=${size}`);
    assert.equal(empty.firstSetBit(), -1);
    // 逐位置位/清除
    const bs = new BitSet(size, false);
    for (let i = 0; i < size; i++) bs.set(i);
    assert.equal(bs.popcount(), size, `set-all popcount size=${size}`);
    for (let i = 0; i < size; i++) bs.clear(i);
    assert.equal(bs.popcount(), 0, `clear-all popcount size=${size}`);
    // 越界 has 返回 false 而非崩溃
    assert.equal(bs.has(size), false);
    assert.equal(bs.has(-1), false);
  }
  ok("BitSet 末 word mask：size 1/31/32/33/63/64/65 全部正确");
}
{
  const a = bitSetOf(100, [0, 5, 31, 32, 63, 64, 99]);
  const b = bitSetOf(100, [5, 32, 50, 64]);
  const and = a.clone().andInto(b);
  assert.deepEqual(and.toArray(), [5, 32, 64]);
  const or = a.clone().orInto(b);
  assert.deepEqual(or.toArray(), [0, 5, 31, 32, 50, 63, 64, 99]);
  const andNot = a.clone().andNotInto(b);
  assert.deepEqual(andNot.toArray(), [0, 31, 63, 99]);
  assert.ok(a.intersects(b));
  const c = bitSetOf(100, [7, 8]);
  assert.ok(!a.intersects(c));
  const d = a.clone();
  assert.ok(d.equals(a));
  d.clear(0);
  assert.ok(!d.equals(a));
  ok("BitSet andInto/orInto/andNotInto/equals/intersects");
}
{
  const bs = bitSetOf(70, [3, 17, 33, 69]);
  const order = [];
  bs.forEachSetBit((b) => order.push(b));
  assert.deepEqual(order, [3, 17, 33, 69]);
  assert.equal(popcount32(0b1011), 3);
  assert.equal(popcount32(0xffffffff), 32);
  assert.equal(ntz32(0b1000), 3);
  assert.equal(ntz32(1), 0);
  ok("BitSet forEachSetBit 升序稳定迭代 + popcount32/ntz32");
}
{
  // 慢速 oracle property test：≥10,000 组随机运算
  const rng = new StableRng(20260822);
  const SIZES = [1, 17, 31, 32, 33, 63, 64, 65, 97];
  let ops = 0;
  for (let iter = 0; iter < 10000; iter++) {
    const size = SIZES[Math.floor(rng.next() * SIZES.length)];
    const a = new BitSet(size, false);
    const b = new BitSet(size, false);
    const oracleA = new Set();
    const oracleB = new Set();
    const mutations = 1 + Math.floor(rng.next() * 8);
    for (let m = 0; m < mutations; m++) {
      if (rng.chance(0.5)) {
        const bit = Math.floor(rng.next() * size);
        a.set(bit);
        oracleA.add(bit);
      } else {
        const bit = Math.floor(rng.next() * size);
        b.set(bit);
        oracleB.add(bit);
      }
      if (rng.chance(0.3)) {
        const bit = Math.floor(rng.next() * size);
        a.clear(bit);
        oracleA.delete(bit);
      }
    }
    const op = ["and", "or", "andNot", "intersects", "equals", "popcount", "first", "iterate"][Math.floor(rng.next() * 8)];
    ops++;
    switch (op) {
      case "and": {
        const r = a.clone().andInto(b);
        const expected = [...oracleA].filter((x) => oracleB.has(x)).sort((x, y) => x - y);
        assert.deepEqual(r.toArray(), expected);
        break;
      }
      case "or": {
        const r = a.clone().orInto(b);
        const expected = [...new Set([...oracleA, ...oracleB])].sort((x, y) => x - y);
        assert.deepEqual(r.toArray(), expected);
        break;
      }
      case "andNot": {
        const r = a.clone().andNotInto(b);
        const expected = [...oracleA].filter((x) => !oracleB.has(x)).sort((x, y) => x - y);
        assert.deepEqual(r.toArray(), expected);
        break;
      }
      case "intersects": {
        const expected = [...oracleA].some((x) => oracleB.has(x));
        assert.equal(a.intersects(b), expected);
        break;
      }
      case "equals": {
        const b2 = b.clone();
        assert.equal(a.equals(b2), oracleA.size === oracleB.size && [...oracleA].every((x) => oracleB.has(x)));
        break;
      }
      case "popcount": {
        assert.equal(a.popcount(), oracleA.size);
        break;
      }
      case "first": {
        const sorted = [...oracleA].sort((x, y) => x - y);
        assert.equal(a.firstSetBit(), sorted.length ? sorted[0] : -1);
        break;
      }
      case "iterate": {
        const seen = [];
        a.forEachSetBit((x) => seen.push(x));
        assert.deepEqual(seen, [...oracleA].sort((x, y) => x - y));
        break;
      }
    }
  }
  ok(`BitSet 慢速 Set<number> oracle property test：${ops} 组随机运算全对`);
}

// ---------- StableRng ----------
{
  const r1 = new StableRng(7);
  const s1 = [r1.next(), r1.next(), r1.next()];
  const r2 = new StableRng(7);
  const s2 = [r2.next(), r2.next(), r2.next()];
  assert.deepEqual(s1, s2);
  ok("StableRng 同 seed 同序列");
}
{
  const r = new StableRng(42);
  const stateAfter1 = r.exportState();
  r.next();
  r.next();
  const snapshot = r.exportState();
  const a = [r.next(), r.next()];
  r.restoreState(snapshot);
  const b = [r.next(), r.next()];
  assert.deepEqual(a, b);
  const r3 = StableRng.fromState(stateAfter1);
  assert.equal(r3.next(), new StableRng(42).next());
  // JSON 往返
  const r4 = StableRng.fromState(JSON.parse(JSON.stringify(snapshot)));
  assert.deepEqual([r4.next(), r4.next()], a);
  ok("StableRng exportState/restoreState/fromState JSON 往返一致");
}
{
  const master = new StableRng(99);
  const wfc1 = master.fork("wfc");
  const wfc2 = new StableRng(99).fork("wfc");
  const field = master.fork("field");
  assert.deepEqual([wfc1.next(), wfc1.next()], [wfc2.next(), wfc2.next()]);
  // 流间互不干扰：wfc 流耗尽不影响 field 流序列
  const field2 = new StableRng(99).fork("field");
  for (let i = 0; i < 10; i++) wfc1.next();
  assert.deepEqual([field.next(), field.next()], [field2.next(), field2.next()]);
  assert.deepEqual(GOLDEN_SEEDS, [1, 7, 42, 884]);
  assert.deepEqual(RNG_STREAMS, ["blueprint", "wfc", "repair", "field", "props", "combat"]);
  assert.equal(schemaVersionStamp(), "p1/w1/f1/m1");
  ok("StableRng fork 流隔离 + golden seeds/streams/schema 常量");
}

// ---------- VersionedMinHeap ----------
{
  const heap = new VersionedMinHeap();
  heap.push("c3", 5.0, 1);
  heap.push("c1", 1.5, 1);
  heap.push("c2", 3.0, 1);
  heap.push("c4", 1.5, 1); // 同 priority：插入序稳定
  const out1 = heap.popValid(1);
  assert.equal(out1.cellId, "c1"); // 1.5 先插入
  const out2 = heap.popValid(1);
  assert.equal(out2.cellId, "c4"); // 同 priority 第二个
  const out3 = heap.popValid(1);
  assert.equal(out3.cellId, "c2");
  const out4 = heap.popValid(1);
  assert.equal(out4.cellId, "c3");
  assert.equal(heap.popValid(1), null);
  ok("VersionedMinHeap priority → 插入序稳定 tie-break");
}
{
  // 陈旧 entry 丢弃：version 落后的项被跳过且不影响确定性
  const heap = new VersionedMinHeap();
  heap.push("stale", 0.1, 1); // 旧版本（小 priority，本应先出）
  heap.push("fresh", 2.0, 5);
  const out = heap.popValid(4); // 当前 wave version=4
  assert.equal(out.cellId, "fresh"); // stale(v1<4) 被丢弃
  assert.equal(heap.popValid(4), null);
  ok("VersionedMinHeap 陈旧 entry 版本戳丢弃");
}

// ---------- Trail ----------
{
  const trail = new Trail();
  const cells = new Map(); // cellId -> { sumW, count }
  const seedCell = (id, sumW, count) => cells.set(id, { sumW, count });
  seedCell("a", 10, 10);
  seedCell("b", 8, 8);
  trail.enterLevel();
  trail.push("a", 3, { prevSumW: 10, prevSumWLogW: 20, prevCount: 10 }, "observation");
  cells.set("a", { sumW: 7, count: 9 });
  trail.push("a", 5, { prevSumW: 7, prevSumWLogW: 14, prevCount: 9 }, "neighbor-support");
  cells.set("a", { sumW: 2, count: 8 });
  trail.push("b", 1, { prevSumW: 8, prevSumWLogW: 16, prevCount: 8 }, "backtrack");
  cells.set("b", { sumW: 7, count: 7 });
  const cp = new ChoicePoint("a", 0, 10, { seed: 1, state: 1 });
  // 回滚到 choice point
  trail.undoTo(cp.trailOffset, (cellId, variant, undoInfo) => {
    const c = cells.get(cellId);
    c.sumW = undoInfo.prevSumW;
    c.count = undoInfo.prevCount;
  });
  assert.equal(cells.get("a").sumW, 10);
  assert.equal(cells.get("a").count, 10);
  assert.equal(cells.get("b").sumW, 8);
  assert.equal(cells.get("b").count, 8);
  assert.equal(trail.length, 0);
  ok("Trail 回放式回滚：聚合量完全恢复，不复制 wave");
}

// ---------- Diagnostics ----------
{
  const ring = new TraceRingBuffer(3);
  ring.push("a").push("b").push("c").push("d"); // 覆盖 a
  assert.deepEqual(ring.toArray(), ["b", "c", "d"]);
  const diag = new Diagnostics({ enabled: false });
  diag.record("x", { foo: 1 });
  assert.equal(diag.trace.toArray().length, 0); // 关闭时零记录
  diag.count("bans");
  diag.count("bans");
  assert.equal(diag.getCounter("bans"), 2);
  const log = new EventLog(4);
  log.log("e1").log("e2").log("e3").log("e4").log("e5");
  assert.deepEqual(log.tail(2), ["e4", "e5"]);
  ok("TraceRingBuffer 覆盖最旧 + Diagnostics 生产关闭零开销 + EventLog 限长");
}

// ---------- RectGrid2D ----------
{
  const grid = createRectGrid2D({ width: 3, height: 3 });
  assert.equal(grid.cellCount, 9);
  assert.equal(grid.cellId(4), "r:1:1");
  assert.equal(grid.indexOfId("r:2:0"), 2);
  const v = grid.validate();
  assert.ok(v.ok, v.errors.join(","));
  // 非周期：角格只有 2 个邻居
  assert.equal(grid.neighborsOf(0).length, 2); // r:0:0 → E + S
  assert.ok(grid.neighborsOf(0).every((e) => ["E", "S"].includes(e.direction)));
  // 周期 x：角格 x 回绕
  const pgrid = createRectGrid2D({ width: 3, height: 3, boundary: "periodic-x" });
  assert.equal(pgrid.neighborsOf(0).length, 3); // E + S + W(回绕到 x=2)
  const wEdge = pgrid.neighborsOf(0).find((e) => e.direction === "W");
  assert.equal(pgrid.cellId(wEdge.to), "r:2:0");
  assert.ok(pgrid.validate().ok);
  // 双周期
  const bgrid = createRectGrid2D({ width: 2, height: 2, boundary: "periodic-both" });
  assert.equal(bgrid.neighborsOf(0).length, 4);
  assert.ok(bgrid.validate().ok);
  ok("RectGrid2D 非周期/单轴周期/双周期 + 稳定 ID + 邻接自检");
}

// ---------- VoxelGrid3D ----------
{
  const grid = createVoxelGrid3D({ width: 2, height: 2, depth: 2 });
  assert.equal(grid.cellCount, 8);
  assert.equal(grid.cellId(0), "v:0:0:0");
  assert.equal(grid.indexOfId("v:1:1:1"), 7);
  // 角体素 (0,0,0)：E + U + S = 3 个邻居（N/W/D 越界）
  assert.equal(grid.neighborsOf(0).length, 3);
  const dirs = grid.neighborsOf(0).map((e) => e.direction).sort();
  assert.deepEqual(dirs, ["E", "S", "U"]);
  assert.ok(grid.validate().ok);
  // y 永不周期：周期 x 下 (0,0,0) 有 4 邻居（E/S/U/W 回绕）
  const pgrid = createVoxelGrid3D({ width: 2, height: 2, depth: 2, boundary: "periodic-x" });
  assert.equal(pgrid.neighborsOf(0).length, 4);
  assert.ok(pgrid.validate().ok);
  // 顶层体素无 U 邻居
  const topIndex = pgrid.indexOfId("v:0:1:0");
  assert.ok(!pgrid.neighborsOf(topIndex).some((e) => e.direction === "U"));
  ok("VoxelGrid3D 六向邻接 + 有限高度 y 永不周期 + 稳定 ID");
}

// ---------- HalfEdgeGraph ----------
{
  // 2×2 四边形网格（共享边）
  const faces = [
    { id: "f:tl", verts: ["a", "b", "e", "d"] },
    { id: "f:tr", verts: ["b", "c", "f", "e"] },
    { id: "f:bl", verts: ["d", "e", "h", "g"] },
    { id: "f:br", verts: ["e", "f", "i", "h"] },
  ].map((f) => ({ id: f.id, length: 4, 0: f.verts[0], 1: f.verts[1], 2: f.verts[2], 3: f.verts[3] }));
  // 转成数组形式
  const faceArrays = [
    ["a", "b", "e", "d"],
    ["b", "c", "f", "e"],
    ["d", "e", "h", "g"],
    ["e", "f", "i", "h"],
  ];
  const graph = createHalfEdgeGraph({ faces: faceArrays });
  assert.equal(graph.cellCount, 4);
  assert.equal(graph.cellId(0), "f:0");
  // tl 与 tr 共享边 b-e；tl 与 bl 共享边 d-e；tl 与 br 共享边 e（对角点，不共享）
  const tlNeighbors = graph.neighborsOf(0).map((e) => graph.cellId(e.to)).sort();
  assert.deepEqual(tlNeighbors, ["f:1", "f:2"]); // tr, bl（br 只共点不共边）
  const v = graph.validate();
  assert.ok(v.ok, v.errors.join(","));
  // 方向 token 稳定：同一条边两侧看到的 direction 相同
  const tlToTr = graph.neighborsOf(0).find((e) => e.to === 1);
  const trToTl = graph.neighborsOf(1).find((e) => e.to === 0);
  assert.equal(tlToTr.direction, trToTl.direction);
  assert.match(tlToTr.direction, /^e:[be]:[be]$|^e:b:e$/); // key = b|e → "e:b:e"
  // 主/对偶交叉 ID
  const cross = buildCrossIds(graph);
  assert.equal(cross.faceToDualVertex.get("f:0"), "d:f:0");
  assert.equal(cross.vertexToDualFace.get("d:f:0"), "f:0");
  // 非流形报错
  assert.throws(
    () => createHalfEdgeGraph({ faces: [["a", "b", "c"], ["a", "b", "c"], ["a", "b", "c"]] }),
    /non-manifold/
  );
  ok("HalfEdgeGraph 共享边方向 token + 主/对偶稳定 ID + 非流形检测");
}

// ---------- 静态扫描：procgen core/wfc 禁止 Three.js / DOM ----------
{
  const forbidden = [
    /\bfrom\s+["']three["']/,
    /\bimport\s*\*\s*as\s+THREE\b/,
    /\bdocument\b/,
    /\bwindow\b/,
    /\blocalStorage\b/,
    /\brequestAnimationFrame\b/,
  ];
  const roots = ["src/procgen/core", "src/procgen/graph", "src/procgen/wfc", "src/procgen/fixtures"];
  const violations = [];
  for (const root of roots) {
    const dir = path.join(BASE, root);
    for (const file of fs.readdirSync(dir)) {
      if (!file.endsWith(".js")) continue;
      const text = fs.readFileSync(path.join(dir, file), "utf8");
      for (const re of forbidden) {
        if (re.test(text)) violations.push(`${root}/${file}: ${re}`);
      }
    }
  }
  assert.deepEqual(violations, [], `procgen 纯数据层禁止 Three.js/DOM：${violations.join("; ")}`);
  ok(`静态扫描：${roots.length} 个目录 0 违规（禁 Three.js/DOM）`);
}

console.log(`\n全部通过：${passed} 项断言（V7-G1 core）`);
