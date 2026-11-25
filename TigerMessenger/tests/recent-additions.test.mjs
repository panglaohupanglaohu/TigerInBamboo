// R24「最近新增」栏：纯逻辑（recent-additions.js）+ 页面接线静态检查。只用 demo.* 假 ID。浏览器端到端见 recent-additions-browser.mjs。
import { test } from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { buildRecentAdditions, scenesFor, targetFor, experienceOf, BASIS_LABEL } from '../src/system-workshop/recent-additions.js';

const read = (p) => fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const maturity = { rows: [
  { id: 'demo.old', name: '旧能力', layer: 'voxel', line: 'terrain', lineName: '地形', level: 3, label: 'L3', added: { date: '2026-11-01', basis: 'workshop-log' } },
  { id: 'demo.battle', name: '战役能力', layer: 'battle', line: 'combat', lineName: '战斗', level: 6, label: 'L6（缺 ④）', missing: [4], added: { date: '2026-11-20', basis: 'workshop-log' } },
  { id: 'demo.mtime', name: '只有修改时间', layer: 'mountain', line: 'terrain', lineName: '地形', level: 5, label: 'L5（缺 ④）', added: { date: '2026-11-22', basis: 'file-mtime' } },
  { id: 'demo.fx', name: '表现层能力', layer: 'fx', line: 'camera', lineName: '镜头', level: 6, label: 'L6（缺 ④）', added: { date: '2026-11-21', basis: 'meta' } },
] };

test('recent: 按加入日期倒序，限制条数，带能力线 / 场景 / 级别 / 日期依据', () => {
  const r = buildRecentAdditions({ maturity, limit: 3 });
  assert.equal(r.source, 'maturity'); assert.equal(r.total, 4);
  assert.deepEqual(r.rows.map((x) => x.id), ['demo.mtime', 'demo.fx', 'demo.battle']);
  const b = r.rows.find((x) => x.id === 'demo.battle');
  assert.equal(b.lineName, '战斗'); assert.equal(b.levelLabel, 'L6（缺 ④）'); assert.equal(b.level, 6);
  assert.equal(b.basisLabel, BASIS_LABEL['workshop-log']); assert.deepEqual(b.scenes.map((s) => s.id), ['apostles', 'moss', 'citadel', 'bookshop']);
  assert.equal(b.target.hash, '#battle'); assert.match(r.note, /上限/, '有 file-mtime 的要提示只是上限');
});

test('recent: 本机首次执行只能把「上限」类日期往前提，不覆盖日志 / meta 给的日期', () => {
  const exp = [
    { at: Date.parse('2026-11-10T08:00:00Z'), capabilityId: 'demo.mtime', outcome: 'previewed', verify: 'pass', steps: [] },
    { at: Date.parse('2026-11-05T08:00:00Z'), outcome: 'previewed', verify: 'fail', steps: [{ id: 'demo.battle' }] },
    { at: Date.parse('2026-11-23T08:00:00Z'), outcome: 'committed', steps: [{ id: 'demo.battle' }] },
  ];
  const r = buildRecentAdditions({ maturity, experienceRows: exp, limit: 10 });
  const m = r.all.find((x) => x.id === 'demo.mtime'), b = r.all.find((x) => x.id === 'demo.battle');
  assert.equal(m.date, '2026-11-10'); assert.equal(m.basis, 'experience-first-run'); assert.equal(m.runs, 1); assert.equal(m.passed, 1);
  assert.equal(b.date, '2026-11-20', '日志日期不被本机执行改写'); assert.equal(b.basis, 'workshop-log'); assert.equal(b.runs, 1); assert.equal(b.committed, 1);
  const e = experienceOf('demo.none', exp); assert.deepEqual([e.runs, e.firstAt, e.lastAt], [0, null, null]);
});

test('recent: 没有成熟度数据时降级 —— 只列页面已登记的能力，日期未知、未评级，不编日期', () => {
  const r = buildRecentAdditions({ maturity: null, live: [{ id: 'demo.a', name: 'A', layer: 'gscene' }, { id: 'demo.b', name: 'B', layer: 'planet' }] });
  assert.equal(r.source, 'live-only'); assert.equal(r.total, 2); assert.match(r.note, /成熟度数据未生成/);
  for (const x of r.rows) { assert.equal(x.date, null); assert.equal(x.basis, 'unknown'); assert.equal(x.level, null); assert.equal(x.levelLabel, '未评级'); }
  const live = buildRecentAdditions({ maturity, live: [{ id: 'demo.new', name: '页面新登记', layer: 'object' }], limit: 10 });
  assert.equal(live.total, 5); assert.equal(live.all.at(-1).id, 'demo.new', '没日期的排最后');
});

test('recent: 点一行去哪 —— 直达层用 R21 页签，其余去对应工坊并切到能跑的场景', () => {
  assert.deepEqual([targetFor('battle').tab, targetFor('battle').hash, targetFor('battle').focus], ['battle-focus-tab', '#battle', 'battle']);
  assert.deepEqual([targetFor('mountain').tab, targetFor('mountain').hash], ['mountain-focus-tab', '#mountain']);
  assert.deepEqual([targetFor('fx').tab, targetFor('fx').hash], ['fx-focus-tab', '#fx']);
  assert.deepEqual([targetFor('gscene').tab, targetFor('gscene').scene], ['scene-workshop-tab', 'bookshop']);
  assert.deepEqual([targetFor('voxel').tab, targetFor('voxel').scene], ['scene-workshop-tab', 'morris-lake']);
  assert.equal(targetFor('planet').tab, 'planet-workshop-tab'); assert.equal(targetFor('object').tab, 'object-workshop-tab');
  assert.equal(targetFor('???').tab, 'scene-workshop-tab');
  assert.deepEqual(scenesFor('mountain').map((s) => s.label), ['高山圣城']); assert.deepEqual(scenesFor('nope'), []);
});

test('recent 页面接线：pipeline.html 有栏位，studio.js 读成熟度与经验并按目标跳转，版本号已加', () => {
  const html = read('pipeline.html');
  assert.match(html, /<section id="recent-additions"[^>]*aria-label="最近新增"/);
  assert.ok(html.indexOf('id="recent-additions"') < html.indexOf('class="pipe-region"'), '栏位在管线区上方，进页面就看得见');
  assert.ok(!/studio\.js\?v=(lineage-r8|maturity-r9)"/.test(html), 'studio.js 版本号要加');
  const studio = read('src/scene-authoring/studio.js');
  assert.match(studio, /recent-additions\.js\?v=recent-r1/); assert.match(studio, /buildRecentAdditions\(/); assert.match(studio, /readExperienceRows\(\)/);
  assert.match(studio, /catalog\/capability-maturity\.json/); assert.match(studio, /function goRecent/); assert.match(studio, /\$\(t\.tab\)\?\.click\(\)/);
  assert.match(read('src/scene-authoring/studio.css'), /\.recent-item\{/);
  assert.match(read('tools/scene-authoring/test_workshops.py'), /'recent-additions'/);
});
