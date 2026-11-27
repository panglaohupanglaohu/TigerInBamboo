// R62 多种子分布面板接线（创新 6）：tier-workshop 按登记表 opt-in 挂面板；Worker / 面板 / 登记表引同一版本；面板不写 localStorage。
// 运行（仓库根目录）：$NODE --test TigerMessenger/tests/seed-report-panel.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
import { seedPanelDecision } from '../src/system-workshop/seed-report-panel.js';
const read = (p) => fs.readFileSync(new URL(p, import.meta.url), 'utf8');

test('要不要挂：登记了才挂；山形 auto 不挂（R28 自带）；体素场景层挂但写 NOT_RUN；显式给就挂', () => {
  for (const k of ['battle', 'fx', 'lightlife', 'gscene', 'object', 'planet', 'apostles-terrain', 'relief', 'building']) assert.equal(seedPanelDecision({ key: k }).mount, true, k);
  assert.equal(seedPanelDecision({ key: 'mountain' }).mount, false);
  assert.equal(seedPanelDecision({ key: 'mountain', explicit: true }).mount, true);
  assert.match(seedPanelDecision({ key: 'scene' }).reason, /NOT_RUN/);
});

test('tier-workshop：seedReport 默认 auto，按 storageKey || tier 找登记；面板放在侧栏「来源详情」之前', () => {
  const s = read('../src/system-workshop/tier-workshop.js');
  assert.match(s, /seedReport = 'auto' \}\) \{/);
  assert.match(s, /import\('\.\/seed-report-panel\.js\?v=seeds-r63'\)/);
  assert.match(s, /key: so\.layer \|\| storageKey \|\| tier/);
  assert.match(s, /side\.insertBefore\(p\.root, detail\)/);
});

test('同一模块同一版本号：面板 / Worker / 登记表都引 seed-report.js?v=seeds-r61、seed-layers.js?v=seeds-r61；Worker 用 seeds-r62', () => {
  const panel = read('../src/system-workshop/seed-report-panel.js'), worker = read('../src/system-workshop/seed-report-worker.js'), layers = read('../src/system-workshop/seed-layers.js');
  for (const s of [panel, worker]) { assert.match(s, /seed-layers\.js\?v=seeds-r61/); assert.match(s, /seed-report\.js\?v=seeds-r61/); }
  assert.match(layers, /seed-report\.js\?v=seeds-r61/);
  assert.match(panel, /seed-report-worker\.js\?v=seeds-r62/);
  assert.doesNotMatch(panel, /localStorage/); assert.doesNotMatch(worker, /localStorage/);
});

test('登记表里各层模块的版本号与主线程其他引用方（worker-adapters.js / 各 verify-worker）现在用的一致（避免两份模块实例；现读不写死）', () => {
  const layers = read('../src/system-workshop/seed-layers.js'), adapters = read('../src/pipeline-engine/worker-adapters.js');
  const vOf = (src, mod) => [...src.matchAll(new RegExp(mod.replace(/[./-]/g, (c) => '\\' + c) + '\\?v=([\\w.-]+)', 'g'))].map((m) => m[1]);
  for (const mod of ['battle/capabilities.js', 'fx/capabilities.js', 'apostles-terrain/capabilities.js', 'gscene/capabilities.js', 'object/capabilities.js', 'planet/capabilities.js']) {
    const want = new Set(vOf(adapters, '/' + mod)), got = new Set(vOf(layers, './' + mod));
    assert.equal(got.size, 1, mod); assert.ok(want.has([...got][0]), `${mod}：seed-layers ${[...got]} ≠ worker-adapters ${[...want]}`);
  }
  for (const dir of ['battle', 'fx', 'apostles-terrain', 'gscene', 'planet']) {
    const w = read(`../src/system-workshop/${dir}/verify-worker.js`), want = vOf(w, './verify.js'), got = vOf(layers, `./${dir}/verify.js`);
    assert.deepEqual([...new Set(got)], [...new Set(want)], dir);
  }
});
