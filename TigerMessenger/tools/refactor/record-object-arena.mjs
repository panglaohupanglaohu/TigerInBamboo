// ⑦ 擂台登记：object.* 4 个能力逐个在固定物件布局考场上 match→run，实测量：
//   targets   match 目标数
//   edits     run 产出的 edit 条目数（edits 是 绝对增量 字典）
//   maxDelta  单物件最大参数位移（dx/dz/ry/s 的最大绝对增量）
//   determinism 同参数重跑 edits 是否逐位一致（variant 域按 ID 取种子，应全等）
// 判定规则写死：targets≥1 且 edits≥1 且重跑逐位一致为「擂过」。
// 每能力一份 catalog/arena/<id>.json 指针文件指向共享表 object.json。
// 运行（仓库根目录）：$NODE TigerMessenger/tools/refactor/record-object-arena.mjs
import fs from 'node:fs';
import { OBJECT_CAPABILITIES } from '../../src/system-workshop/object/capabilities.js';

// 固定布局考场：4 棵悬铃树排成不等距一列（path-spacing）、4 棵柏树同大同向（scale/yaw-variety）、
// 2 丛蜀葵互相压住（spacing-relax）、1 棵锁定树（锁定不动作障碍）。
const r0 = { dx: 0, dy: 0, dz: 0, ry: 0, s: 1, hidden: false };
const L = [
  { id: 't1', kind: 'plane-tree', name: '悬铃树 1', x: 0, z: 0, r: 1, edit: { ...r0 }, locked: false },
  { id: 't2', kind: 'plane-tree', name: '悬铃树 2', x: 2.2, z: 0.3, r: 1, edit: { ...r0 }, locked: false },
  { id: 't3', kind: 'plane-tree', name: '悬铃树 3', x: 3.1, z: -0.2, r: 1, edit: { ...r0 }, locked: true },
  { id: 't4', kind: 'plane-tree', name: '悬铃树 4', x: 6.4, z: 0.1, r: 1, edit: { ...r0 }, locked: false },
  { id: 'c1', kind: 'cypress', name: '柏树 1', x: 10, z: 0, r: .6, edit: { ...r0 }, locked: false },
  { id: 'c2', kind: 'cypress', name: '柏树 2', x: 11.5, z: 0.2, r: .6, edit: { ...r0 }, locked: false },
  { id: 'c3', kind: 'cypress', name: '柏树 3', x: 13, z: -0.1, r: .6, edit: { ...r0 }, locked: false },
  { id: 'c4', kind: 'cypress', name: '柏树 4', x: 14.5, z: 0.15, r: .6, edit: { ...r0 }, locked: false },
  { id: 'h1', kind: 'hollyhock', name: '蜀葵 1', x: 20, z: 0, r: .8, edit: { ...r0 }, locked: false },
  { id: 'h2', kind: 'hollyhock', name: '蜀葵 2', x: 20.9, z: 0.2, r: .8, edit: { ...r0 }, locked: false },
];
const defaultParams = (cap) => Object.fromEntries(Object.entries(cap.meta.params ?? {}).map(([k, d]) => [k, d.default]));
const day = new Date().toISOString().slice(0, 10);

const results = [];
for (const cap of OBJECT_CAPABILITIES) {
  const p = defaultParams(cap);
  const targets = cap.match(L, p);
  const t0 = Date.now();
  const a = cap.run(L, p), b = cap.run(L, p);
  const edits = a.edits ?? {};
  const same = JSON.stringify(a.edits) === JSON.stringify(b.edits);
  const deltas = [];
  for (const [id, e] of Object.entries(edits)) {
    const base = L.find((r) => r.id === id).edit;
    deltas.push(Math.max(Math.abs((e.dx ?? 0) - (base.dx ?? 0)), Math.abs((e.dz ?? 0) - (base.dz ?? 0)), Math.abs(((e.ry ?? 0) - (base.ry ?? 0)) * 10), Math.abs(((e.s ?? 1) - (base.s ?? 1)) * 10)));
  }
  const entry = {
    id: cap.meta.id, name: cap.meta.name, domain: cap.meta.domain,
    targets: targets.length, edits: Object.keys(edits).length,
    maxDelta: +(Math.max(0, ...deltas)).toFixed(4), deterministic: same, ms: Date.now() - t0,
    lockedTouched: Object.keys(edits).filter((id) => L.find((r) => r.id === id).locked),
  };
  entry.pass = targets.length >= 1 && entry.edits >= 1 && same && !entry.lockedTouched.length;
  entry.verdict = entry.pass ? '擂过' : '未过';
  results.push(entry);
}

const reg = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  arena: { fixture: `布局 ${L.length} 物件（4 悬铃树含 1 锁定 + 4 柏树 + 2 互压蜀葵）`, runner: 'TigerMessenger/tools/refactor/record-object-arena.mjs（实算）' },
  judge: '规则写死：match targets≥1 且 edits≥1 且同参数重跑逐位一致且锁定物件未被改动为「擂过」。',
  results,
  counts: { caps: results.length, passed: results.filter((r) => r.pass).length },
};
const outDir = new URL('../../src/scene-authoring/catalog/arena/', import.meta.url);
fs.writeFileSync(new URL('object.json', outDir), JSON.stringify(reg, null, 1) + '\n');
for (const r of results) {
  const doc = {
    capability: r.id, line: 'tools', schemaVersion: 1, pass: r.pass,
    basis: '本能力在固定布局考场（object.json）真实跑过 match→run，成绩见共享表——判定规则写在表头，不手改。',
    see: 'TigerMessenger/src/scene-authoring/catalog/arena/object.json#' + r.id,
    runner: 'TigerMessenger/tools/refactor/record-object-arena.mjs（实算）',
    test: 'TigerMessenger/tests/object-gscene-browser.mjs',
    arena: { fixture: `${L.length} 物件布局` },
    result: { verdict: r.verdict, targets: r.targets, edits: r.edits, maxDelta: r.maxDelta, deterministic: r.deterministic, lockedTouched: r.lockedTouched, ms: r.ms },
    recordedAt: day,
  };
  fs.writeFileSync(new URL(`${r.id}.json`, outDir), JSON.stringify(doc, null, 1) + '\n');
}
console.log(`object arena: ${reg.counts.passed}/${reg.counts.caps} 擂过`);
for (const r of results) console.log(` ${r.id}: ${r.verdict} targets=${r.targets} edits=${r.edits} maxDelta=${r.maxDelta} det=${r.deterministic} locked=${r.lockedTouched.length}`);
