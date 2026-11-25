// R41 / R49：地貌管线面板（pipeline.html 场景管线页 #relief-workshop）——纯逻辑（直达网址、俯视缩略图、证据表）+ 页面接线 + 待你决定登记。
// 运行：cd /Users/panglaohu/Downloads/TigerInBamboo && $NODE --test TigerMessenger/tests/relief-panel.test.mjs
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { directEntry, thumbPixels, evidenceRows, RELIEF_IDS } from '../src/system-workshop/relief/panel-model.js';
import { RELIEF_ORDER, runPlan } from '../src/system-workshop/relief/capabilities.js';
import { arenaSite } from '../src/system-workshop/terrain/arena-generic.js';

const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('直达网址：?relief=old-port / moss / arena / 1；别的值一律不认（不切到未知场景）', () => {
  assert.deepEqual(directEntry('?relief=old-port'), { scene: 'old-port', mode: 'game' });
  assert.deepEqual(directEntry('?relief=moss'), { scene: 'moss', mode: 'game' });
  assert.deepEqual(directEntry('?relief=arena'), { scene: 'arena', mode: 'arena' });
  assert.deepEqual(directEntry('?relief=1'), { scene: 'old-port', mode: 'game' });
  assert.equal(directEntry('?relief=citadel'), null); assert.equal(directEntry('?x=1'), null); assert.equal(directEntry(''), null);
});
test('缩略图：尺寸 = n × scale，候选图画出河 / 岩檐 / 梯子 / 等高线（和原样图不同），只读不改采样', () => {
  const s = arenaSite(), before = structuredClone(s); runPlan(s, RELIEF_ORDER.map((id) => ({ id })));
  const a = thumbPixels(arenaSite(), null, { scale: 2 }), b = thumbPixels(s, s.plan, { scale: 2 });
  assert.equal(a.width, s.n * 2); assert.equal(a.data.length, a.width * a.height * 4);
  let diff = 0; for (let i = 0; i < a.data.length; i += 4) if (a.data[i] !== b.data[i] || a.data[i + 2] !== b.data[i + 2]) diff++;
  assert.ok(diff > 100, '候选图要看得出变化');
  const has = (img, rgb) => { for (let i = 0; i < img.data.length; i += 4) if (img.data[i] === rgb[0] && img.data[i + 1] === rgb[1] && img.data[i + 2] === rgb[2]) return true; return false; };
  assert.ok(has(b, [70, 130, 175]), '河'); assert.ok(has(b, [214, 178, 60]), '等高线'); assert.ok(has(b, [40, 34, 28]), '岩檐'); assert.ok(has(b, [150, 92, 40]), '梯子');
  const { plan, ...rest } = s; assert.deepEqual(rest, before);
});
test('证据表：没有登记 / 已登记待实算 / 已实算 三种状态分得清，④ ⑦ 只在实算后算达到', () => {
  const rows = evidenceRows({ 'relief.soft': { verdict: null, diffs: [] }, 'relief.cliff': { verdict: 'equivalent', diffs: [] } }, { 'relief.soft': { pass: null }, 'relief.cliff': { pass: true, beat: 'relief.soft' }, 'relief.valley': { pass: false, judge: { why: '没赢：x' } } });
  const by = Object.fromEntries(rows.map((r) => [r.id, r]));
  assert.deepEqual(rows.map((r) => r.id), RELIEF_IDS);
  assert.equal(by['relief.soft'].parity, 'registered'); assert.equal(by['relief.soft'].level4, false);
  assert.equal(by['relief.cliff'].parity, 'measured'); assert.equal(by['relief.cliff'].level4, true); assert.equal(by['relief.cliff'].level7, true);
  assert.equal(by['relief.valley'].arena, 'lost'); assert.equal(by['relief.overhang'].parity, 'missing');
});
test('页面接线：pipeline.html 有面板、studio.js 挂载、自带样式在场景管线页显示、直达页签时让位、面板里有对照 / 擂台 / 实景三块', () => {
  const html = read('../pipeline.html'), studio = read('../src/scene-authoring/studio.js'), css = read('../src/system-workshop/relief.css'), ws = read('../src/system-workshop/relief-workshop.js');
  assert.ok(html.includes('<div id="relief-workshop" class="tier-pane" aria-label="地貌管线"></div>'));
  assert.ok(studio.includes("mountReliefWorkshop({host:$('relief-workshop')"));
  assert.match(css, /body\[data-tier=scene\] #relief-workshop\{display:block/); assert.match(css, /body\[data-layer-focus\] #relief-workshop\{display:none!important\}/);
  assert.match(css, /#relief-workshop \.tier-side\[data-tier=relief\]\{display:block\}/, 'tier-side 默认是隐藏的，本面板要放出来');
  for (const id of ['relief-input', 'relief-thumbs', 'relief-scene', 'relief-evidence', 'relief-evidence-table', 'relief-run-parity', 'relief-run-arena']) assert.ok(ws.includes(`'${id}'`) || ws.includes(`= '${id}'`), id);
  assert.ok(ws.includes("relief.css?v=relief-r1") && ws.includes("tier-workshop.js?v=preload-r1"), '和其他工坊同一份 tier-workshop 模块实例');
  assert.ok(!/localStorage\.setItem\((?!CAND_KEY)/.test(ws), '面板只写候选记录 tm.relief.candidate.v1');
  assert.ok(ws.includes("const CAND_KEY = 'tm.relief.candidate.v1'"));
});
test('待你决定：PENDING 里登记了 P-R49-01（选项、怎么看对照、不动时的现状）', () => {
  const p = read('../docs/PENDING_USER_DECISIONS.md'), i = p.indexOf('## P-R49-01');
  assert.ok(i > 0); const block = p.slice(i, p.indexOf('\n## ', i + 5) > 0 ? p.indexOf('\n## ', i + 5) : undefined);
  for (const k of ['**编号**', '**轮次**', '**要你决定什么**', '**选项**', '**怎么看对照**', '**不动时的现状**']) assert.ok(block.includes(k), k);
  assert.ok(block.includes('?relief=old-port'));
});
