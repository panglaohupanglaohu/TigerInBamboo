// ⑦ 擂台登记：gscene 材质层能力逐个在固定 MATS 考场上 match→run，实测量：
//   targets   match 目标数
//   colors    run 产出的材质色数（全材质应有归位）
//   moved     实际发生位移的材质数（hex 欧氏距离 >0）
//   maxMove   单材质最大色移（0-255 制）
// 判定规则写死：targets≥1 且全部材质拿到色且 moved≥1 为「擂过」。
// 每能力一份 catalog/arena/<id>.json 指针文件指向共享表 gscene.json。
// 运行（仓库根目录）：$NODE TigerMessenger/tools/refactor/record-gscene-arena.mjs
import fs from 'node:fs';
import { GSCENE_CAPABILITIES, paramsFor } from '../../src/system-workshop/gscene/capabilities.js';

const MATS = [
  { id: 'a', color: '#c04030', uses: 12 }, { id: 'b', color: '#c04535', uses: 8 },
  { id: 'c', color: '#3050c0', uses: 10 }, { id: 'd', color: '#2f55b8', uses: 4 },
  { id: 'e', color: '#40a050', uses: 6 }, { id: 'f', color: '#45a555', uses: 3 },
  { id: 'g', color: '#b8382a', uses: 9 }, { id: 'h', color: '#3360cc', uses: 2 },
];
const hex2rgb = (x) => [1, 3, 5].map((i) => parseInt(x.slice(i, i + 2), 16));
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const day = new Date().toISOString().slice(0, 10);

const results = [];
for (const cap of GSCENE_CAPABILITIES) {
  const targets = cap.match(MATS, paramsFor(cap));
  const t0 = Date.now();
  const out = cap.run(MATS, paramsFor(cap));
  const colors = out.colors ?? {};
  const moves = MATS.map((m) => dist(hex2rgb(m.color), hex2rgb(colors[m.id] ?? m.color)));
  const entry = {
    id: cap.meta.id, name: cap.meta.name, domain: cap.meta.domain,
    targets: targets.length, colors: Object.keys(colors).length,
    moved: moves.filter((d) => d > 0).length, maxMove: +Math.max(0, ...moves).toFixed(2), ms: Date.now() - t0,
    note: out.note ?? null,
  };
  entry.pass = targets.length >= 1 && entry.colors === MATS.length && entry.moved >= 1;
  entry.verdict = entry.pass ? '擂过' : '未过';
  results.push(entry);
}

const reg = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  arena: { fixture: `MATS ${MATS.length} 材质（红系×2 蓝系×2 绿×1）`, runner: 'TigerMessenger/tools/refactor/record-gscene-arena.mjs（实算）' },
  judge: '规则写死：match targets≥1 且全部材质拿到归位色且 moved≥1 为「擂过」。',
  results,
  counts: { caps: results.length, passed: results.filter((r) => r.pass).length },
};
const outDir = new URL('../../src/scene-authoring/catalog/arena/', import.meta.url);
fs.writeFileSync(new URL('gscene.json', outDir), JSON.stringify(reg, null, 1) + '\n');
for (const r of results) {
  const doc = {
    capability: r.id, line: 'palette', schemaVersion: 1, pass: r.pass,
    basis: '本能力在固定 MATS 考场（gscene.json）真实跑过 match→run，成绩见共享表——判定规则写在表头，不手改。',
    see: 'TigerMessenger/src/scene-authoring/catalog/arena/gscene.json#' + r.id,
    runner: 'TigerMessenger/tools/refactor/record-gscene-arena.mjs（实算）',
    test: 'TigerMessenger/tests/workshop-caps.test.mjs',
    arena: { fixture: 'MATS×' + MATS.length },
    result: { verdict: r.verdict, targets: r.targets, colors: r.colors, moved: r.moved, maxMove: r.maxMove, ms: r.ms },
    recordedAt: day,
  };
  fs.writeFileSync(new URL(`${r.id}.json`, outDir), JSON.stringify(doc, null, 1) + '\n');
}
console.log(`gscene arena: ${reg.counts.passed}/${reg.counts.caps} 擂过`);
for (const r of results) console.log(` ${r.id}: ${r.verdict} targets=${r.targets} colors=${r.colors} moved=${r.moved} maxMove=${r.maxMove}`);
