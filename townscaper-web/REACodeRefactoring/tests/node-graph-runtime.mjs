// 1724449858369568780：ScriptableObject bool → 节点组件链 → UI 位置。
// 判据：bool 翻转后 select 取对分支；lerpTowards 每帧最多走 speed*dt 且不冲过目标；
// compose2 拼出 (x, y)；sink 只在值变化时回调；求值按拓扑序；有环直接报错。
import assert from 'node:assert/strict';
import {
  NodeGraph, boolSource, constant, variable, select, lerpTowards, compose2, sink, multiply, buildToggleChain,
} from '../src/core/node-graph-runtime.js';

// 1. select：条件为真取 onTrue，假取 onFalse；输入换了下一次求值就变
const g1 = new NodeGraph();
let picked = null;
g1.add('cond', boolSource(false))
  .add('sel', select({ onTrue: -33.8, onFalse: -226.9 }))
  .add('watch', sink((v) => { picked = v; }))
  .link('cond:out', 'sel:condition')
  .link('sel:out', 'watch:in');
g1.evaluate(0);
assert.equal(g1.get('sel'), -226.9, '假分支');
g1.state('cond').value = true;
g1.evaluate(0);
assert.equal(g1.get('sel'), -33.8, '真分支');
assert.equal(picked, -33.8, 'sink 必须收到新值');

// 2. lerpTowards：每帧最多走 speed*dt，绝不冲过，最后正好停在目标上
const lerp = new NodeGraph();
lerp.add('t', variable(0)).add('l', lerpTowards({ speed: 20, initial: 226.9 })).link('t:out', 'l:target');
lerp.evaluate(0);
assert.equal(lerp.get('l'), 226.9, '初始值');
lerp.tick(0.1);
assert.ok(Math.abs(lerp.get('l') - 224.9) < 1e-9, `0.1s × speed 20 应该走 2，实际 ${lerp.get('l')}`);
lerp.tick(0.1);
assert.ok(Math.abs(lerp.get('l') - 222.9) < 1e-9);
// 一大步直接到目标，且不越过
lerp.tick(100);
assert.equal(lerp.get('l'), 0, '大步只能停在目标上，不能冲过去');
assert.equal(lerp.state('l').settled, true);
// 反向也一样
lerp.state('t').value = 5;
lerp.tick(0.05);
assert.equal(lerp.get('l'), 1, '+5 目标、speed 20、0.05s 应该走 1');
// dt=0 不动、负 dt 不倒着走
const before = lerp.get('l');
lerp.tick(0);
assert.equal(lerp.get('l'), before);
lerp.tick(-3);
assert.equal(lerp.get('l'), before, '负 dt 不能倒推');
assert.throws(() => lerpTowards({ speed: 0 }), /speed/);

// 3. compose2 + 拓扑序：sink 一定在上游之后求值
const g3 = new NodeGraph();
const log = [];
g3.add('src', variable(7))
  .add('k', multiply(3))
  .add('y', constant(11))
  .add('compose', compose2())
  .add('watch', sink((v) => log.push({ ...v })))
  .link('src:out', 'k:in')
  .link('k:out', 'compose:x')
  .link('y:out', 'compose:y')
  .link('compose:out', 'watch:in');
// 故意先连下游再连上游：拓扑序必须自己排好
const order = g3.order();
assert.ok(order.indexOf('k') < order.indexOf('compose'), 'k 必须在 compose 之前');
assert.ok(order.indexOf('compose') < order.indexOf('watch'), 'compose 必须在 watch 之前');
g3.evaluate(0);
assert.deepEqual(g3.get('compose'), { x: 21, y: 11 });
assert.deepEqual(log[0], { x: 21, y: 11 });

// 4. sink 只在值变化时触发
const calls = g3.state('watch').calls;
g3.evaluate(0);
assert.equal(g3.state('watch').calls, calls, '值没变不该再触发');
g3.state('src').value = 8;
g3.evaluate(0);
assert.equal(g3.state('watch').calls, calls + 1);
assert.deepEqual(log[log.length - 1], { x: 24, y: 11 });

// 5. 环路/自环/端口错都直接报错
const bad = new NodeGraph();
bad.add('a', multiply(2)).add('b', multiply(2));
bad.link('a:out', 'b:in');
bad.link('b:out', 'a:in');
assert.throws(() => bad.order(), /cycle/);
assert.throws(() => bad.evaluate(0), /cycle/);
const selfLoop = new NodeGraph();
selfLoop.add('a', multiply(2));
selfLoop.link('a:out', 'a:in');
assert.throws(() => selfLoop.order(), /self loop/);
const wrong = new NodeGraph();
wrong.add('a', constant(1)).add('b', multiply(2));
assert.throws(() => wrong.link('a:nope', 'b:in'), /no output/);
assert.throws(() => wrong.link('a:out', 'b:nope'), /no input/);
assert.throws(() => wrong.add('a', constant(1)), /duplicate/);
assert.throws(() => wrong.link('zzz:out', 'b:in'), /missing node/);

// 6. 完整链：按一下按钮，位置从 -226.9 滑到 -33.8，速度 20/s，约 9.7s 到位
const chain = buildToggleChain();
assert.equal(chain.position.y, -226.9, '初始在下面');
assert.equal(chain.position.x, -5);
// 9.655s 走 (226.9-33.8)=193.1 / 20 = 9.655s
for (let i = 0; i < 8; i++) chain.graph.tick(1);
chain.toggle();
assert.equal(chain.graph.get('select'), -33.8, '按下之后 select 立刻切到真分支');
for (let i = 0; i < 8; i++) chain.graph.tick(1);
assert.ok(Math.abs(chain.position.y - (-226.9 + 20 * 8)) < 1e-9, `8 秒 × speed 20 应该走 160，实际 ${chain.position.y}`);
assert.equal(chain.settled, false, '8 秒还没到位');
chain.graph.tick(2);
assert.equal(chain.position.y, -33.8, '到位后精确停在目标上');
assert.equal(chain.settled, true);
assert.equal(chain.position.x, -5, 'X 全程不变（截图里 In0 一直是 -5）');
// 再按一下回下面
chain.toggle();
assert.equal(chain.graph.get('select'), -226.9);
chain.graph.tick(100);
assert.equal(chain.position.y, -226.9);
assert.deepEqual(chain.moved.value, { x: -5, y: -226.9 }, 'sink 收到最后一次的位置');

// 7. 快照给 Inspector 用
const snap = chain.graph.snapshot();
assert.ok(snap.select && snap.lerp && snap.compose, 'snapshot 必须列出所有节点');
assert.equal(chain.graph.tickCount > 0, true);

console.log('node-graph-runtime PASS · select/lerp/compose/sink 全部按 Unity 那条链的语义走');
