// 原版当裁判 · 导航（Guide §1.4 创新 1、§9 D 组 R33）：把 nav-parity 的对照结果写进 catalog/parity/，供九级成熟度 ④ 与补学队列使用。
// 用法（按 §5.2 规矩在 TigerMessenger 目录里跑；输出路径按仓库根算，不随当前目录漂）：
//   cd TigerMessenger && $NODE tools/refactor/nav-parity.mjs            写文件
//   cd TigerMessenger && $NODE tools/refactor/nav-parity.mjs --stdout   只打印摘要
// 写出：
//   src/scene-authoring/catalog/parity/navigation.json             完整对照（每座岛、每种口径、每条差异）
//   src/scene-authoring/catalog/parity/<能力ID>.json               每个真实调用 layerednav / battle-navigation 的导航能力一份（capability 字段 = 能力 ID，④ 的证据）
//   src/scene-authoring/catalog/parity/navigation-demand.json      缺口 → 补学队列需求行（export-learn-queue 会自动读 catalog/parity/*-demand.json）
// 原版 REACode 只读 import，不改。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runNavParity, parityDemand, NAV_PARITY_CAPABILITIES } from '../../src/system-workshop/battle/nav-parity.js';

const workspace = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
export const PARITY_DIR = 'TigerMessenger/src/scene-authoring/catalog/parity';
const GENERATOR = 'TigerMessenger/tools/refactor/nav-parity.mjs';
const safeId = (id) => String(id).replace(/[^\w.-]/g, '_');

export function buildNavParityFiles({ now = new Date() } = {}) {
  const doc = runNavParity(), generatedAt = now.toISOString();
  const main = { capability: 'navigation', generatedAt, generator: GENERATOR, ...doc };
  const files = { [`${PARITY_DIR}/navigation.json`]: main, [`${PARITY_DIR}/navigation-demand.json`]: parityDemand(doc) };
  for (const id of NAV_PARITY_CAPABILITIES) files[`${PARITY_DIR}/${safeId(id)}.json`] = {
    capability: id, verdict: doc.verdict, line: 'navigation', generatedAt, generator: GENERATOR,
    basis: '本能力在 Worker 与实景里真实调用 vendor 副本的 layerednav / battle-navigation（meta.modules）；这份是这两份模块对原版 cheesenav / holenav 的对照登记，完整内容见 navigation.json。',
    see: `${PARITY_DIR}/navigation.json`, sameCriteriaEqual: doc.sameCriteriaEqual, original: doc.original, refactored: doc.refactored, inputs: doc.inputs, gaps: doc.gaps, diffs: doc.diffs,
  };
  return { doc, files };
}
export function writeNavParity({ root = workspace, now = new Date() } = {}) {
  const { doc, files } = buildNavParityFiles({ now });
  fs.mkdirSync(path.join(root, PARITY_DIR), { recursive: true });
  for (const [rel, body] of Object.entries(files)) fs.writeFileSync(path.join(root, rel), JSON.stringify(body, null, 1) + '\n');
  return { doc, written: Object.keys(files) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--stdout')) {
    const { doc } = buildNavParityFiles();
    console.log(JSON.stringify({ verdict: doc.verdict, sameCriteriaEqual: doc.sameCriteriaEqual, gaps: doc.gaps, diffs: doc.diffs.map((d) => `${d.kind} ${d.id}: ${d.original} → ${d.refactored}`), cases: doc.cases.map((c) => ({ id: c.id, original: c.original, same: c.sameCriteria, battle: c.battleCriteria, routes: c.routes || null })) }, null, 1));
  } else {
    const { doc, written } = writeNavParity();
    console.log(`对照结论 ${doc.verdict}（同判据${doc.sameCriteriaEqual ? '一致' : '不一致'}，缺口 ${doc.gaps} 条，差异 ${doc.diffs.length} 处）；写入：\n  ` + written.join('\n  '));
  }
}
