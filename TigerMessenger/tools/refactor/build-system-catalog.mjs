#!/usr/bin/env node
/**
 * 系统工坊能力目录：把学习过的能力按「球系统 / 场景 / 物件」三层工坊的分区放进管线。
 *
 * 每个能力（以原帖视频 ID 为键）的执行状态，取能拿到的最好一档：
 *   code         REACodeRefactoring/src/capabilities 已有能力代码 → super agent 可直接执行
 *   refactored   重构版已实现（REACodeRefactoring learn 状态 done），待封装成能力代码
 *   partial      重构版部分实现
 *   original     只有重构前的 REACode 实现（8765 learn.html）→ 节点先占位，标明原版位置
 *   reference    只作学习参考
 * 重构版就绪后重跑本脚本，节点自动从 original 升级，管线位置不变。
 *
 * 用法：node tools/refactor/build-system-catalog.mjs <REACode 目录> <REACodeRefactoring 目录> [输出]
 */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [origDir = '../townscaper-web/REACode', refDir = '../townscaper-web/REACodeRefactoring', out = 'src/scene-authoring/catalog/system-catalog.json'] = process.argv.slice(2);
const load = (file) => { const w = {}; new Function('window', fs.readFileSync(file, 'utf8'))(w); return w; };
const orig = load(path.join(origDir, 'learn/data.js')).LEARN;
const refW = load(path.join(refDir, 'learn/data.js'));
const ref = refW.LEARN;
let refStatus = {};
try { refStatus = load(path.join(refDir, 'learn/refactoring-status.js')).REFACTOR_STATUS || {}; } catch {}
const { describeCapabilities } = await import(pathToFileURL(path.resolve(refDir, 'src/capabilities/registry.js')).href);
const codeCaps = describeCapabilities();

import { WORKSHOPS, buildCatalog } from '../../src/system-workshop/catalog-build.js';
export { WORKSHOPS };
const catalog = buildCatalog({ orig, ref, refStatus, codeCaps });
// 原版 REACode 的学习记录快照：浏览器里「扫描能力库」读不到 REACode 目录时用它（原版冻结不改，快照即可）
fs.writeFileSync(path.join(path.dirname(out), 'reacode-learn.json'), JSON.stringify({ generatedAt: new Date().toISOString(), source: 'REACode/learn/data.js', LEARN: orig }));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(catalog));
for (const w of catalog.workshops) console.log(w.name, w.domains.map((d) => `${d.name}:${d.counts.total}(代码${d.counts.code}/重构${d.counts.refactored}/部分${d.counts.partial}/原版${d.counts.original})`).join('  '));
console.log('共用工具', catalog.shared.length, '输出', out, (fs.statSync(out).size / 1024).toFixed(0) + 'KB');
