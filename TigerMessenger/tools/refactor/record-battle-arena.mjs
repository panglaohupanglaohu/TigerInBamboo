// ⑦ 擂台登记：battle.* 6 个能力逐个在 nav-lab 演示岛考场上 match→run，实测量：
//   targets   match 目标数
//   applied   run 的 applied 条目
//   planKeys  run 后 site.plan 新增键（含 navigation 子键）
// 判定规则写死：targets≥1 且 applied≥1 且 site.plan 真新增内容为「擂过」。
// 每能力一份 catalog/arena/<id>.json 指针文件指向共享表 battle.json。
// 运行（仓库根目录）：$NODE TigerMessenger/tools/refactor/record-battle-arena.mjs
import fs from 'node:fs';
import { BATTLE_CAPABILITIES } from '../../src/system-workshop/battle/capabilities.js';
import { demoSite, demoNavSample } from '../../src/system-workshop/battle/nav-lab.js';

// 考场 = nav-lab 演示岛（实景网格同款：海→滩→2层台地，台地中央一道带洞道的高墙）。
const defaultParams = (cap) => Object.fromEntries(Object.entries(cap.meta.params ?? {}).map(([k, d]) => [k, d.default]));
const day = new Date().toISOString().slice(0, 10);

const results = [];
for (const cap of BATTLE_CAPABILITIES) {
  const site = demoSite(demoNavSample());
  let targets = [], error = null;
  try { targets = cap.match(site); } catch (e) { error = e.message; }
  const t0 = Date.now();
  let out = null;
  try { out = cap.run(site, { params: defaultParams(cap) }); } catch (e) { error = e.message; }
  const planKeys = [], plan = site.plan ?? {};
  for (const [k, v] of Object.entries(plan)) planKeys.push(typeof v === 'object' && v ? `${k}{${Object.keys(v).join(',')}}` : k);
  const entry = {
    id: cap.meta.id, name: cap.meta.name, domain: cap.meta.domain,
    targets: targets.length, applied: out?.applied?.length ?? 0,
    planKeys, changed: (out?.changed ?? []).length, ms: Date.now() - t0, error,
  };
  entry.pass = !error && targets.length >= 1 && entry.applied >= 1 && planKeys.length >= 1;
  entry.verdict = entry.pass ? '擂过' : '未过';
  results.push(entry);
}

const reg = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  arena: { fixture: 'nav-lab 演示岛（台地岛 + 洞道墙 nav 采样，网格=实景同款 buildQuadGrid）', runner: 'TigerMessenger/tools/refactor/record-battle-arena.mjs（实算）' },
  judge: '规则写死：match targets≥1 且 run applied≥1 且 site.plan 新增至少一键为「擂过」。',
  results,
  counts: { caps: results.length, passed: results.filter((r) => r.pass).length },
};
const outDir = new URL('../../src/scene-authoring/catalog/arena/', import.meta.url);
fs.writeFileSync(new URL('battle.json', outDir), JSON.stringify(reg, null, 1) + '\n');
for (const r of results) {
  const doc = {
    capability: r.id, line: 'battle', schemaVersion: 1, pass: r.pass,
    basis: '本能力在 nav-lab 演示岛考场（battle.json）真实跑过 match→run，成绩见共享表——判定规则写在表头，不手改。',
    see: 'TigerMessenger/src/scene-authoring/catalog/arena/battle.json#' + r.id,
    runner: 'TigerMessenger/tools/refactor/record-battle-arena.mjs（实算）',
    test: 'TigerMessenger/tests/workshops-browser.mjs（battle 工坊实景段）',
    arena: { fixture: 'nav-lab 演示岛' },
    result: { verdict: r.verdict, targets: r.targets, applied: r.applied, planKeys: r.planKeys, changed: r.changed, error: r.error, ms: r.ms },
    recordedAt: day,
  };
  fs.writeFileSync(new URL(`${r.id}.json`, outDir), JSON.stringify(doc, null, 1) + '\n');
}
console.log(`battle arena: ${reg.counts.passed}/${reg.counts.caps} 擂过`);
for (const r of results) console.log(` ${r.id}: ${r.verdict} targets=${r.targets} applied=${r.applied} plan=[${r.planKeys}]${r.error ? ' ERR:' + r.error.slice(0, 60) : ''}`);
