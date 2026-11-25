// R48：地貌候选进游戏（旧港湾）——plan-mesh 纯数据网格 + 游戏侧 reliefCandidate.js / 桥接命令的静态接线。
//   游戏侧代码要 three 和实景，Node 里跑不了：这里只查纯数据部分和「只是候选」的保证（不写 localStorage / 存档、persist 必须 false、能拆回）。
//   实景行为由 tests/relief-oldport-browser.mjs 验（NOT_RUN 时不算过）。
// 运行：cd /Users/panglaohu/Downloads/TigerInBamboo && $NODE --test TigerMessenger/tests/relief-candidate.test.mjs
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { planMesh, meshStats } from '../src/system-workshop/relief/plan-mesh.js';
import { runPlan, RELIEF_ORDER } from '../src/system-workshop/relief/capabilities.js';
import { arenaSite } from '../src/system-workshop/terrain/arena-generic.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');
const planned = () => { const s = arenaSite(); runPlan(s, RELIEF_ORDER.map((id) => ({ id }))); return s; };

test('plan-mesh：高度面、岩檐盒子、梯子、等高线的数量对得上计划', () => {
  const s = planned(), m = planMesh(s.plan, { cls: s.cls }), st = meshStats(m);
  assert.ok(st.triangles > 1000); assert.equal(m.positions.length, st.triangles * 9); assert.equal(m.colors.length, m.positions.length);
  assert.equal(st.lips, s.plan.lips.length); assert.equal(m.lipPositions.length, s.plan.lips.length * 5 * 6 * 3, '每块岩檐 5 个面 × 2 三角');
  assert.equal(st.contourSegs, s.plan.contours.segs.length);
  assert.ok(st.ladderSegs >= s.plan.ladders.length * 2, '每把梯子至少两根梯梁');
  assert.ok(m.positions.every(Number.isFinite) && m.lipPositions.every(Number.isFinite));
});
test('plan-mesh：坐标 = 贴球图表米制坐标（x 东、y 高、z 北，原点在采样中心），和 mountainCandidate 的 i·step − half 一致', () => {
  const n = 5, h = new Array(n * n).fill(4), plan = { n, cell: 3, h, lips: [], ladders: [], valley: null, contours: null };
  const m = planMesh(plan, { lines: false }), xs = [], zs = [];
  for (let i = 0; i < m.positions.length; i += 3) { xs.push(m.positions[i]); zs.push(m.positions[i + 2]); assert.equal(m.positions[i + 1], 4); }
  assert.equal(Math.min(...xs), -6); assert.equal(Math.max(...xs), 6); assert.equal(Math.min(...zs), -6); assert.equal(Math.max(...zs), 6);
  assert.equal(m.triangles, 2 * (n - 1) * (n - 1));
});
test('plan-mesh：岩檐盒子顶 = 高格顶，底 = 檐底，底面压暗（悬垂看得见）', () => {
  const s = planned(), l = s.plan.lips[0], m = planMesh({ ...s.plan, lips: [l], ladders: [], contours: null }, { lines: false });
  const ys = []; for (let i = 1; i < m.lipPositions.length; i += 3) ys.push(m.lipPositions[i]);
  assert.ok(Math.abs(Math.max(...ys) - (l.top + 0.02)) < 1e-9); assert.ok(Math.abs(Math.min(...ys) - l.bottom) < 1e-9);
  const bottomFace = m.lipColors.slice(18, 21); assert.ok(bottomFace[0] < 0.35, '朝下的面要暗');
});
test('游戏侧只是候选：不写 localStorage / 存档，persist ≠ false 拒绝预览，能拆回，原地形只隐藏不删', () => {
  const src = read('../src/world/rea/reliefCandidate.js');
  assert.ok(!/localStorage|sessionStorage|indexedDB/.test(src), '游戏侧不许写本机存储');
  assert.ok(src.includes("plan.persist !== false"), 'persist 必须是 false 才预览');
  for (const fn of ['probeRelief', 'previewRelief', 'compareRelief', 'revertRelief', 'reliefState', 'reliefView']) assert.ok(new RegExp('export function ' + fn + '\\b').test(src), fn);
  assert.ok(/o\.visible = false; cur\.hidden\.push\(o\)/.test(src) && /for \(const o of cur\.hidden\) o\.visible = true/.test(src), '藏起来的原地形要能放回来');
  assert.ok(!/\.geometry\s*=|removeFromParent\(\)[^;]*hidden/.test(src.replace(/cur\.group\.removeFromParent\(\)/g, '')), '不改原地形网格');
  assert.ok(src.includes("'old-port': { half: 90, step: 3 }"), '旧港湾的采样范围');
});
test('场景 id 与游戏一致（old-port = 旧港湾、moss = 苔庭），桥接命令与游戏侧模块同一版本号（只加载一份模块）', () => {
  const main = read('../src/main.js'), bridge = read('../src/scene-authoring/pipeline-bridge.js');
  assert.ok(main.includes("batianTarget('old-port','旧港湾'") && main.includes("batianTarget('moss','苔庭'"));
  const vs = [...bridge.matchAll(/reliefCandidate\.js\?v=([\w-]+)'/g)].map((m) => m[1]);
  assert.equal(vs.length, 6); assert.ok(vs.every((v) => v === 'relief-r2'));
  assert.ok(read('../src/world/rea/reliefCandidate.js').includes("plan-mesh.js?v=relief-r1'"));
  assert.ok(!main.includes('reliefCandidate'), '没有接进游戏默认流程（不自动换地形）');
});
