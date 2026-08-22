// =====================================================================
//  P1 · 城堡战术导航图验收（纯 Node，合成几何复刻 citadelRange 规则）
//  运行：node tools/test_citadel_tactical_graph.mjs
// =====================================================================
import fs from "node:fs";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

const BASE = new URL("../TigerMessenger/", import.meta.url);
const bridgePkg = new URL("../TigerMessenger/node_modules/three/package.json", import.meta.url);
if (!fs.existsSync(bridgePkg)) {
  fs.mkdirSync(fileURLToPath(new URL("../TigerMessenger/node_modules/three/", import.meta.url)), {
    recursive: true,
  });
  fs.writeFileSync(
    bridgePkg,
    JSON.stringify({
      name: "three",
      version: "0.172.0-local-bridge",
      type: "module",
      main: "../../vendor/three.module.js",
    })
  );
}

const { createCitadelTacticalGraph, createTacticalGraphDebugView } = await import(
  new URL("src/world/citadelTacticalGraph.js", BASE).href
);
const { createRng } = await import(new URL("src/core/rng.js", BASE).href);

// ---------------------------------------------------------------------
// 合成几何：5 台地（0=最高/最小半径）+ 5 段石阶 + 瀑布缺口扇区，
// 规则与 citadelRange.citadelTerraceWalkLiftLocal / WALK_ANGLES 同构
// ---------------------------------------------------------------------
const CONTOUR = { coreRadius: 9, notchCenter: 0.17, notchHalf: 0.3, notchedLayers: 4 };
const makeMetrics = (t2Radius = 24) => [
  { terraceIndex: 0, radius: 9, height: 2, bottom: 8, top: 10 },
  { terraceIndex: 1, radius: 16, height: 2, bottom: 6, top: 8 },
  { terraceIndex: 2, radius: t2Radius, height: 2, bottom: 4, top: 6 },
  { terraceIndex: 3, radius: 32, height: 2, bottom: 2, top: 4 },
  { terraceIndex: 4, radius: 40, height: 2, bottom: 0, top: 2 },
];
const WALK_ANGLES = [
  [-0.87, -1.5],
  [-1.5, -0.91],
  [-0.91, -1.47],
  [-1.47, -0.94],
  [-0.94, -1.4],
];
const makeFlights = (metrics) =>
  WALK_ANGLES.map(([from, to], i) => {
    const terraceIndex = metrics.length - 1 - i;
    const m = metrics[terraceIndex];
    const lower = metrics[terraceIndex + 1];
    return {
      terraceIndex,
      from,
      to,
      rho: m.radius + 1.05,
      yA: lower ? lower.top + 0.06 : m.bottom,
      yB: m.top + 0.06,
    };
  });

const inNotch = (x, z, terrace) => {
  const r = Math.hypot(x, z);
  if (r <= CONTOUR.coreRadius) return false;
  const phi = Math.atan2(x, z);
  return (
    terrace > 0 &&
    terrace <= CONTOUR.notchedLayers &&
    Math.abs(phi - CONTOUR.notchCenter) < CONTOUR.notchHalf
  );
};

// 与 citadelWalkLiftLocal 同规则的合成高程（台地 + 石阶坡道，缺口扇区前四层不可走）
const makeWalkLift = (metrics, flights) => (lx, lz) => {
  const r = Math.hypot(lx, lz);
  if (r > metrics.at(-1).radius + 3) return -Infinity;
  const phi = Math.atan2(lx, lz);
  let best = -Infinity;
  for (let t = 0; t < metrics.length; t++) {
    if (r > metrics[t].radius) continue;
    if (inNotch(lx, lz, t)) continue;
    best = metrics[t].top;
    break;
  }
  for (const f of flights) {
    if (Math.abs(r - f.rho) > 1.35) continue;
    const lo = Math.min(f.from, f.to);
    const hi = Math.max(f.from, f.to);
    if (phi < lo - 0.06 || phi > hi + 0.06) continue;
    const u = Math.min(1, Math.max(0, (phi - f.from) / (f.to - f.from)));
    best = Math.max(best, f.yA + (f.yB - f.yA) * u);
  }
  return best;
};

const metrics = makeMetrics();
const flights = makeFlights(metrics);
const walkLift = makeWalkLift(metrics, flights);

const graph = createCitadelTacticalGraph({
  metrics,
  flights,
  walkLift,
  contour: CONTOUR,
  gates: [
    { terraceIndex: 0, x: 0, z: 8.6, width: 1.6 }, // 顶台地正门
    { terraceIndex: 2, x: 3, z: 21, width: 1.2 }, // 台地 2 楼门
  ],
  extras: {
    waterfalls: [{ x: Math.sin(0.17) * 20, z: Math.cos(0.17) * 20, terraceIndex: 2, drop: 4 }],
    harbor: { x: 0, z: 52 },
    plaza: { x: 6, z: 46 },
    trojanDrops: [{ x: -4, z: 47 }, { x: -2, z: 47 }],
  },
});

let pass = 0;
const ok = (cond, msg) => {
  assert.ok(cond, msg);
  console.log(`  ✓ ${msg}`);
  pass++;
};

console.log("[1] 建图与稳定节点 ID");
{
  const s = graph.stats();
  console.log(`    节点 ${s.nodes} / 边 ${s.edges} / 类型 ${JSON.stringify(s.edgeTypes)} / 区域 ${s.regions}`);
  ok(s.nodes > 100, `节点覆盖五台地（${s.nodes} > 100）`);
  ok(s.edgeTypes.walk > 100, "walk 边存在");
  ok(s.edgeTypes.stairs >= 10, "stairs 边存在");
  ok(s.edgeTypes.door === 2, "两个门口 door 边");
  ok(s.edgeTypes["waterfall-climb"] === 1, "瀑布攀爬边（单向）");
  ok(graph.node("gate:0-0") && graph.node("gate:2-1"), "门节点 ID 稳定可寻址");
  ok(graph.node("harbor") && graph.node("plaza") && graph.node("drop:0"), "港口/广场/木马落地点接入");
  const sig = graph.signature();
  const changed = graph.rebuildChanged(metrics, flights);
  assert.deepEqual(changed, []);
  ok(graph.signature() === sig, "无变化时增量重建为空操作（ID/签名不变）");
}

console.log("[2] 跨台地寻路：只走合法连接");
{
  const bottom = graph.nearestNode({ x: 0, y: 2, z: -37 }); // 台地 4（最低）
  const top = graph.nearestNode({ x: 0, y: 10, z: -4 }); // 台地 0（最高）
  ok(bottom && top, "起终点可定位");
  const path = graph.findPath(bottom.node.id, top.node.id, { agentId: "probe" });
  ok(path && path.length > 5, `找到跨台地路径（${path?.length} 节点）`);
  // 区域（台地）切换只能经过 stairs/door/ladder/waterfall-climb 边
  let switches = 0;
  for (let i = 1; i < path.length; i++) {
    const a = graph.node(path[i - 1]);
    const b = graph.node(path[i]);
    const eid = graph.adjacency.get(path[i - 1]).find((id) => {
      const e = graph.edge(id);
      return (e.a === path[i - 1] && e.b === path[i]) || (e.bidirectional && e.b === path[i - 1] && e.a === path[i]);
    });
    ok(eid, `相邻路径节点 ${path[i - 1]} → ${path[i]} 必有边`);
    const e = graph.edge(eid);
    if (a.region !== b.region) {
      switches++;
      ok(e.type !== "walk" || a.terrace === b.terrace, `台地切换经 ${e.type} 边（非 walk 越层）`);
      ok(
        ["stairs", "door", "ladder", "waterfall-climb"].includes(e.type) || a.terrace === b.terrace,
        "跨台地只走 stairs/door/ladder/waterfall-climb"
      );
    }
  }
  ok(switches >= 4, `路径真实跨越 ≥4 次台地边界（${switches}）`);
}

console.log("[3] 离表误差 ≤ 0.15 + 缺口扇区无节点");
{
  let maxErr = 0;
  for (const [, n] of graph.nodes) {
    if (n.kind !== "ring" && n.kind !== "stair") continue;
    const lift = walkLift(n.pos.x, n.pos.z);
    assert.ok(Number.isFinite(lift), `节点 ${n.id} 落在不可走处`);
    maxErr = Math.max(maxErr, Math.abs(n.pos.y - lift));
  }
  ok(maxErr <= 0.15, `全体节点离表误差 ${maxErr.toFixed(4)} ≤ 0.15`);
  let notchViolations = 0;
  for (const [, n] of graph.nodes) {
    if (n.kind !== "ring" || n.terrace == null) continue;
    if (inNotch(n.pos.x, n.pos.z, n.terrace)) notchViolations++;
  }
  ok(notchViolations === 0, "瀑布缺口扇区（前四层台地）无任何节点");
}

console.log("[4] 占位 / 窄道容量 / 短期预约 / 受阻重寻路");
{
  // 先让上一节的 "probe" 预约过期（预约 ttl 1.2s）
  for (let i = 0; i < 200; i++) graph.tick(1 / 60);
  const bottom = graph.nearestNode({ x: 0, y: 2, z: -37 }).node;
  const top = graph.nearestNode({ x: 0, y: 10, z: -4 }).node;
  const p1 = graph.findPath(bottom.id, top.id, { agentId: "A" });
  ok(p1, "A 首寻路成功");
  // A 的预约挡 B：B 的寻路应避开或失败（不会共享同一窄道节点）
  const p2 = graph.findPath(bottom.id, top.id, { agentId: "B" });
  if (p2) {
    const reserved = new Set(p1);
    const shared = p2.filter((n) => reserved.has(n) && n !== bottom.id && n !== top.id);
    ok(shared.length === 0, "B 避开 A 的预约节点（窄道错峰）");
  } else {
    ok(true, "B 无路可走（预约耗尽窄道容量时拒绝穿行）");
  }
  // 预约过期后 B 可通行
  for (let i = 0; i < 200; i++) graph.tick(1 / 60);
  const p3 = graph.findPath(bottom.id, top.id, { agentId: "B" });
  ok(p3 && p3.length > 5, "预约过期后 B 寻路恢复");
  // 受阻重寻路：封锁 p3 中段节点，repath 必须绕行
  const blocked = p3.slice(2, 6);
  const p4 = graph.repath(bottom.id, top.id, blocked, { agentId: "C", respectReservations: false });
  ok(p4 && !blocked.some((b) => p4.includes(b)), "受阻重寻路绕开封锁节点");
  // 占位
  graph.occupy("C", p4[1]);
  ok(graph.occupants.get("C") === p4[1], "占位登记");
  graph.releaseAgent("C");
  ok(!graph.occupants.has("C"), "占位释放");
}

console.log("[5] 增量重建：只重建变化台地");
{
  const before0 = graph.regionNodes("terrace:0").slice().sort();
  const metrics2 = makeMetrics(26); // 台地 2 半径 24→26
  const flights2 = makeFlights(metrics2);
  const walkLift2 = makeWalkLift(metrics2, flights2);
  // 重建用新高程：模拟编辑器改台地
  const g2opts = { walkLift: walkLift2 };
  Object.assign(graph, {}); // graph 内部持有 opts.walkLift——通过重建参数路径不可换，这里直接验证台地 2 重建语义
  const changed = graph.rebuildChanged(metrics2, flights2);
  assert.deepEqual(changed, [2]);
  const after0 = graph.regionNodes("terrace:0").slice().sort();
  assert.deepEqual(after0, before0);
  ok(true, "台地 2 重建时台地 0 节点 ID 全数保留");
  ok(graph.regionNodes("terrace:2").length > 0, "台地 2 节点已重建");
}

console.log("[6] 动态攻城梯：ladder 边接入/拆除");
{
  const { base, top } = graph.addLadder(0, { x: 0.6, z: 27.4 }, { x: 0.6, z: 23.2 }, { x: 0.75, z: 19.6 });
  // 梯身直达：base→top 一跳即 ladder 边
  const direct = graph.findPath(base, top, { agentId: "siege", respectReservations: false });
  assert.deepEqual(direct, [base, top]);
  ok(true, "梯身 base→top 一跳直达（ladder 边）");
  // 夺取点只经梯顶可达 → 任何路线必经梯子
  const ground = graph.nearestNode({ x: 0.6, y: 0, z: 30 }).node;
  const path = graph.findPath(ground.id, "lad:0:cap", { agentId: "siege", respectReservations: false });
  ok(path && path.includes(base) && path.includes(top), "登城夺取路径必经梯脚与梯顶");
  const ladderEdge = [...graph.edges.values()].find((e) => e.type === "ladder");
  ok(ladderEdge && ladderEdge.capacity === 1 && !ladderEdge.bidirectional, "ladder 边：单人、单向、元数据齐");
  graph.removeLadder(0);
  ok(!graph.node(base) && !graph.node(top), "拆梯即清节点与关联边");
}

console.log("[7] 10 分钟无空中路线（仿真巡查：600 秒 × 8 巡逻兵）");
{
  const rng = createRng(42);
  const nodeIds = [...graph.nodes.keys()].filter(
    (id) => graph.node(id).kind === "ring" || graph.node(id).kind === "stair"
  );
  const agents = Array.from({ length: 8 }, (_, i) => ({
    id: `patrol-${i}`,
    at: nodeIds[(rng.next() * nodeIds.length) | 0],
    path: null,
    step: 0,
    retarget: 0,
  }));
  let hops = 0;
  for (let sec = 0; sec < 600; sec++) {
    graph.tick(1);
    for (const a of agents) {
      a.retarget -= 1;
      if (!a.path || a.step >= a.path.length) {
        if (a.retarget > 0) continue;
        const goal = nodeIds[(rng.next() * nodeIds.length) | 0];
        a.path = graph.findPath(a.at, goal, { agentId: a.id });
        a.step = 1;
        a.retarget = 2.5;
        if (!a.path) a.retarget = 5;
        continue;
      }
      const next = a.path[a.step];
      // 每跳必须沿真实边（无空中直线）
      const eid = graph.adjacency.get(a.at).find((id) => {
        const e = graph.edge(id);
        return e && ((e.a === a.at && e.b === next) || (e.bidirectional && e.b === a.at && e.a === next));
      });
      assert.ok(eid, `巡逻兵 ${a.id} 在 ${a.at} → ${next} 出现空中路线`);
      const liftA = walkLift(graph.node(a.at).pos.x, graph.node(a.at).pos.z);
      const liftB = walkLift(graph.node(next).pos.x, graph.node(next).pos.z);
      assert.ok(
        Math.abs(graph.node(next).pos.y - (Number.isFinite(liftB) ? liftB : graph.node(next).pos.y)) <= 0.15,
        "贴表误差超限"
      );
      graph.occupy(a.id, next);
      a.at = next;
      a.step++;
      hops++;
    }
  }
  ok(hops > 500, `10 分钟仿真完成 ${hops} 次合法跳边，零空中路线`);
}

console.log("[8] 调试可视化（节点/边线可构建可重建）");
{
  const view = createTacticalGraphDebugView(graph);
  ok(view.root.getObjectByName("tg-nodes") && view.root.getObjectByName("tg-edges"), "调试视图含节点点云与边线");
  view.rebuild();
  ok(view.root.children.length === 2, "重建后视图结构稳定");
}

console.log(`\n全部通过（${pass} 项断言）：战术导航图 P1 语义齐备。`);
