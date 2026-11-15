// 第 61 轮新增：节点图序列化 / 反序列化（对应 1724449858369568780 的"图是资产，可存可载"）
import assert from 'node:assert/strict';
import { NodeGraph, NODE_REGISTRY, buildToggleChain, lerpTowards, sink } from '../src/core/node-graph-runtime.js';

let checks = 0;
const ok = (c, m) => { assert.ok(c, m); checks++; };

// ---------- 1. 往返：切→存→载，位置不跳回起点 ----------
const a = buildToggleChain();
a.set(true);
for (let i = 0; i < 60; i++) a.graph.tick(1 / 60);      // 走 1 秒，speed 20 → 应该已到 -33.8
const posBefore = { ...a.position };
const json = JSON.parse(JSON.stringify(a.graph.serialize()));
ok(json.version === 1, 'version = 1');
ok(json.nodes.length === 7, `7 个节点，实得 ${json.nodes.length}`);
ok(json.edges.length === 6, `6 条边，实得 ${json.edges.length}`);
ok(json.nodes.every((n) => typeof n.type === 'string' && n.params), '每个节点都有 type/params');

const b = NodeGraph.fromJSON(json);
ok(b.nodes.size === a.graph.nodes.size, '节点数一致');
ok(b.edges.length === a.graph.edges.length, '边数一致');
ok(JSON.stringify(b.order()) === JSON.stringify(a.graph.order()), '拓扑序一致');
b.evaluate(0);   // 载入后跑一帧（dt=0，不推进 lerp），把 state 里的当前值推到 out
ok(Math.abs(b.get('compose', 'out').y - posBefore.y) < 1e-9, `恢复后 y 不跳回起点（${b.get('compose', 'out').y} vs ${posBefore.y}）`);
ok(b.state('lerp').settled === a.graph.state('lerp').settled, `有状态节点的 settled 也被恢复（${b.state('lerp').settled}）`);

// 恢复后继续跑，两条链必须走出同样的轨迹
let same = true;
for (let i = 0; i < 90; i++) {
  a.graph.tick(1 / 60);
  b.tick(1 / 60);
  if (Math.abs(a.position.y - b.get('compose', 'out').y) > 1e-9) same = false;
}
ok(same, '恢复后 90 帧轨迹与原图逐帧一致');

// ---------- 2. 参数确实被存下来 ----------
const lerpNode = json.nodes.find((n) => n.id === 'lerp');
ok(lerpNode.type === 'lerpTowards' && lerpNode.params.speed === 20, `lerp 参数存了 speed=${lerpNode.params.speed}`);
const selectNode = json.nodes.find((n) => n.id === 'select');
ok(selectNode.params.onTrue === -33.8 && selectNode.params.onFalse === -226.9, 'select 的两个分支值都在');

// ---------- 3. includeState:false 时不带 state ----------
const bare = a.graph.serialize({ includeState: false });
ok(bare.nodes.every((n) => n.state === null), 'includeState:false → 全部 state 为 null');

// ---------- 4. 错误输入 ----------
assert.throws(() => NodeGraph.fromJSON(null), RangeError); checks++;
assert.throws(() => NodeGraph.fromJSON({ version: 2, nodes: [] }), RangeError); checks++;
assert.throws(() => NodeGraph.fromJSON({ version: 1, nodes: [{ id: 'x', type: 'nope', params: {} }] }), /unknown node type/); checks++;
assert.throws(() => NodeGraph.fromJSON({ version: 1, nodes: [{ id: '', type: 'constant' }] }), RangeError); checks++;
assert.throws(() => NodeGraph.fromJSON({
  version: 1,
  nodes: [{ id: 'c', type: 'constant', params: { value: 1 } }],
  edges: [{ fromId: 'c', fromPort: 'out', toId: 'missing', toPort: 'in' }],
}), /missing node/); checks++;

// ---------- 5. sink 回调不可序列化，载入时由 sinkFn 注入 ----------
const got = [];
const g2 = new NodeGraph();
g2.add('v', NODE_REGISTRY.variable({ value: 5 }));
g2.add('s', NODE_REGISTRY.sink({ epsilon: 0.1 }, (v) => got.push(v)));
g2.link('v:out', 's:in');
g2.tick(0);
const j2 = g2.serialize();
const g3 = NodeGraph.fromJSON(j2, { sinkFn: (v) => got.push(v * 2) });
g3.tick(0);
ok(got.length === 1, `载入后 sink 没重复触发（calls 计数从 state 恢复，实触发 ${got.length} 次）`);

// ---------- 6. sink 的 epsilon 被保留 ----------
ok(j2.nodes.find((n) => n.id === 's').params.epsilon === 0.1, 'sink 的 epsilon 存下来');
void lerpTowards; void sink;

// ---------- 7. 空图也能往返 ----------
const empty = new NodeGraph().serialize();
const g4 = NodeGraph.fromJSON(empty);
ok(g4.nodes.size === 0 && g4.edges.length === 0, '空图往返无异常');

console.log(`node-graph-serialize: ${checks} checks PASS`);
