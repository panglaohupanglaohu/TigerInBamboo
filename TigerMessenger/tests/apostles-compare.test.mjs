// R32：十二门徒三套方案并排对照（src/system-workshop/apostles-compare.js）——清单 → 三套 × 四机位、当前方案标记、路径安全、相对 approved 变差项。
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { SCHEMES, VIEW_ORDER, buildComparison, schemeOfLook, schemeOfParam, surfaceLine, MANIFEST_PATH, PENDING_TITLE } from '../src/system-workshop/apostles-compare.js';

const manifest = () => ({ dir: 'artifacts/apostles-look-views-e2e/run-1', at: 1795500000000, looks: {
  approved: { views: VIEW_ORDER.map((v) => ({ view: v, file: `approved-${v}.png`, valid: true })), surface: { status: 'warn', totals: { transparentRock: 0, inverted: 3, openEdges: 40, plantBadShare: 0.02, foamUncoveredShare: 0.04 } } },
  soft: { views: [{ view: 'overview', file: 'soft-overview.png', valid: true }, { view: 'cliff-foot', file: 'soft-cliff-foot.png', valid: false }], surface: { status: 'warn', totals: { transparentRock: 0, inverted: 80, openEdges: 41, plantBadShare: 0.03, foamUncoveredShare: 0.05 } } },
  'soft+palette': { error: '游戏没连上' },
}, regressions: { soft: [{ id: 'inverted', name: '反面三角变多' }], 'soft+palette': [] } });

test('三套方案：approved / soft / soft+palette，网址参数写法对得上', () => {
  assert.deepEqual(SCHEMES.map((s) => [s.id, s.look]), [['approved', 'approved'], ['soft', 'soft'], ['soft+palette', 'soft,palette']]);
  assert.equal(schemeOfLook('approved'), 'approved'); assert.equal(schemeOfLook('palette+soft'), 'soft+palette'); assert.equal(schemeOfLook('latest+soft'), 'soft');
  assert.equal(schemeOfLook('latest'), null, '仅换库不是三套之一'); assert.equal(schemeOfLook('palette'), null); assert.equal(schemeOfParam('soft,palette'), 'soft+palette');
});
test('清单 → 每套四个机位；缺的标未拍，无效机位标出来；当前方案只标一个', () => {
  const m = buildComparison(manifest(), { current: 'soft' });
  assert.deepEqual(m.rows.map((r) => [r.id, r.shotCount, r.validCount, r.current]), [['approved', 4, 4, false], ['soft', 2, 1, true], ['soft+palette', 0, 0, false]]);
  assert.deepEqual(m.rows[0].shots.map((s) => s.src), VIEW_ORDER.map((v) => `artifacts/apostles-look-views-e2e/run-1/approved-${v}.png`));
  assert.equal(m.rows[1].shots.find((s) => s.view === 'cliff-foot').note, '机位无效（被岩体挡住或在水下）');
  assert.equal(m.rows[1].shots.find((s) => s.view === 'top').note, '未拍');
  assert.equal(m.rows[2].error, '游戏没连上'); assert.equal(m.pending, PENDING_TITLE);
});
test('检查一句话：变差项只对候选写，approved 不写', () => {
  const m = buildComparison(manifest());
  assert.match(surfaceLine(m.rows[1]), /比认可现状变差：反面三角变多/); assert.doesNotMatch(surfaceLine(m.rows[0]), /变差/);
  assert.match(surfaceLine(m.rows[2]), /没拍成/);
});
test('没有清单 / 清单坏了 / 路径想跳出 artifacts：不显示图，给出原因', () => {
  assert.match(buildComparison(null).note, /还没有对照截图/);
  for (const bad of [{ ...manifest(), dir: '../../etc' }, { ...manifest(), dir: '/tmp/x' }, { dir: 'artifacts/x' }]) assert.ok(buildComparison(bad).rows.every((r) => r.shotCount === 0));
  const m = manifest(); m.looks.approved.views[0].file = '../secret.png'; assert.equal(buildComparison(m).rows[0].shotCount, 3);
});
test('页面接线：对照区在十二门徒工坊里，清单路径与端到端脚本写的一致；待决定事项已登记', () => {
  const ws = fs.readFileSync(new URL('../src/system-workshop/apostles-terrain-workshop.js', import.meta.url), 'utf8');
  assert.ok(ws.includes("cmp.id = 'apostles-compare'") && ws.includes('dataset.switch') && ws.includes('switchLook(row.look)'));
  const e2e = fs.readFileSync(new URL('./apostles-look-views-browser.mjs', import.meta.url), 'utf8');
  assert.ok(e2e.includes('latest.json') && MANIFEST_PATH.endsWith('apostles-look-views-e2e/latest.json'));
  const pending = fs.readFileSync(new URL('../docs/PENDING_USER_DECISIONS.md', import.meta.url), 'utf8');
  assert.ok(pending.includes(PENDING_TITLE), 'PENDING_USER_DECISIONS.md 里要有「十二门徒采用哪套」');
});
