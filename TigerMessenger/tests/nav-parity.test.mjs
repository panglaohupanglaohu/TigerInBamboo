// R33 原版当裁判（创新 1）第一例：原版 cheesenav / holenav 对重构版 layerednav / BattleNavigation（vendor 副本）。
// 运行：cd /Users/panglaohu/Downloads/TigerInBamboo && $NODE --test TigerMessenger/tests/nav-parity.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNavParity, parityDemand, cheeseCase, holesCase, cheeseWorld, PARITY_INPUTS, NAV_PARITY_CAPABILITIES, ORIGINAL_FILES } from '../src/system-workshop/battle/nav-parity.js';
import { carveCheese, selfCheck } from '../../townscaper-web/REACode/src/cheesenav.js';
import { PARITY_VERDICTS } from '../../townscaper-web/REACodeRefactoring/src/core/capability-maturity.js';
import { buildNavParityFiles, writeNavParity, PARITY_DIR } from '../tools/refactor/nav-parity.mjs';
import { parityDemandRows } from '../tools/refactor/export-learn-queue.mjs';
import { BATTLE_CAPABILITIES } from '../src/system-workshop/battle/capabilities.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('原版只读：两份原版文件在，对照里写明的就是它们', () => {
  for (const f of ORIGINAL_FILES) assert.ok(fs.existsSync(path.join(ROOT, f)), f);
  const doc = runNavParity();
  assert.deepEqual(doc.original, ORIGINAL_FILES);
  assert.ok(doc.refactored.every((f) => fs.existsSync(path.join(ROOT, f))));
});

test('奶酪：原版统计与原版自己的 selfCheck 对得上（换算没丢点）', () => {
  const c = cheeseCase();
  assert.equal(c.original.nodes, selfCheck({ ...PARITY_INPUTS.cheese }).navNodes);
  // 体素 → World 第 y+1 层：每列实心层数一致
  const ch = carveCheese({ ...PARITY_INPUTS.cheese }), env = cheeseWorld(ch);
  let a = 0, b = 0; for (const v of ch.solid) a += v; for (const c2 of env.world.cells) { let m = env.world.solid[c2.id]; while (m) { b += m & 1; m >>= 1; } }
  assert.equal(a, b);
  assert.ok(c.original.nodes > 50 && c.original.components >= 1);
});

test('同判据：两座岛上连通块数 / 最大块占比 / 被覆盖节点数完全一致', () => {
  const doc = runNavParity();
  for (const c of doc.cases) for (const m of ['nodes', 'components', 'largestShare', 'covered']) assert.equal(c.sameCriteria[m], c.original[m], `${c.id}.${m}`);
  assert.equal(doc.sameCriteriaEqual, true);
  assert.equal(doc.diffs.filter((d) => d.criteria === 'same').length, 0);
});

test('战役判据：可达性与门洞代价与原版一致，差异逐条登记', () => {
  const doc = runNavParity();
  assert.ok(PARITY_VERDICTS.includes(doc.verdict));
  const h = doc.cases.find((c) => c.id === 'holes');
  assert.equal(h.routes.reachMismatch, 0, '可达性应一致');
  assert.equal(h.routes.differ, 0, '门洞代价口径已对齐原版（目标格收费），路线代价应全等');
  assert.equal(h.routes.meanRatio, 1);
  assert.ok(!doc.diffs.some((d) => d.id === 'holes.routes.cost'), '门洞加价口径缺口已收口');
  for (const d of doc.diffs) assert.ok(d.id && d.case && d.metric && d.kind && d.note, JSON.stringify(d));
  assert.equal(doc.verdict, doc.diffs.length ? 'diff-registered' : 'equivalent');
});

test('确定性：同样输入两次结果逐字相同', () => {
  assert.equal(JSON.stringify(runNavParity()), JSON.stringify(runNavParity()));
  assert.equal(JSON.stringify(holesCase()), JSON.stringify(holesCase()));
});

test('登记文件：每个导航能力一份，④ 的校验规则（capability = 能力 ID、verdict 合法）都成立', () => {
  const { files, doc } = buildNavParityFiles({ now: new Date('2026-11-23T00:00:00Z') });
  const ids = BATTLE_CAPABILITIES.map((c) => c.meta.id).filter((id) => id.startsWith('battle.nav'));
  assert.deepEqual([...NAV_PARITY_CAPABILITIES].sort(), ids.sort(), '导航能力清单与能力表一致');
  for (const id of ['battle.navFinePortals', 'battle.navTraffic', 'battle.navFooting']) {
    const f = files[`${PARITY_DIR}/${id}.json`];
    assert.ok(f, id); assert.equal(f.capability, id); assert.ok(PARITY_VERDICTS.includes(f.verdict)); assert.equal(f.see, `${PARITY_DIR}/navigation.json`);
    const cap = BATTLE_CAPABILITIES.find((c) => c.meta.id === id);
    assert.ok(cap.meta.modules.some((m) => /battle-navigation|layerednav/.test(m)), id + ' 真实调用导航模块');
  }
  assert.equal(files[`${PARITY_DIR}/navigation.json`].capability, 'navigation');
  assert.equal(files[`${PARITY_DIR}/navigation.json`].gaps, doc.gaps);
});

test('缺口进补学队列：demand 行格式对、export-learn-queue 会读到', () => {
  const doc = runNavParity(), rows = parityDemand(doc);
  assert.equal(rows.length, doc.gaps, 'demand 行数 == 未决 gap 数（design 差异定案保留后不再出队）');
  for (const r of rows) { assert.ok(r.id.startsWith('parity:navigation:')); assert.ok(r.name && r.reason); assert.deepEqual(r.clips, ['906425294533394432', '797119718477991936']); }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nav-parity-'));
  try {
    const { written } = writeNavParity({ root: tmp });
    assert.ok(written.includes(`${PARITY_DIR}/navigation-demand.json`));
    const back = parityDemandRows(path.join(tmp, PARITY_DIR));
    assert.deepEqual(back.map((r) => r.id), rows.map((r) => r.id));
    assert.deepEqual(parityDemandRows(path.join(tmp, 'nope')), []);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
});

test('页面接线：战役侧栏挂导航块并现算对照', () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, 'TigerMessenger', f), 'utf8');
  assert.match(read('src/system-workshop/battle-workshop.js'), /mountNavPanel\(root/);
  assert.match(read('src/system-workshop/battle-workshop.js'), /navPanel\.onScan\(s\)/);
  assert.match(read('src/system-workshop/battle/nav-panel.js'), /runNavParity\(\)/);
  assert.match(read('src/system-workshop/battle/nav-panel.js'), /catalog\/parity\/navigation\.json/);
  assert.match(read('tools/refactor/export-learn-queue.mjs'), /parityDemandRows\(\)/);
});
