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
import {parseLearningDeclaration} from '../../src/scene-authoring/learning-declaration.js';
import {scanCodeLibrary} from './scan-code-library.mjs';
import {describeObjectCapabilities} from '../../src/system-workshop/object/capabilities.js';
import {describeGsceneCapabilities} from '../../src/system-workshop/gscene/capabilities.js';
import {buildCodeCatalog} from '../../src/system-workshop/code-library-catalog.js';

const [origDir = '../townscaper-web/REACode', refDir = '../townscaper-web/REACodeRefactoring', out = 'src/scene-authoring/catalog/system-catalog.json'] = process.argv.slice(2);
const load = file => {const name=file.endsWith('refactoring-status.js')?'REFACTOR_STATUS':'LEARN';return {[name]:parseLearningDeclaration(fs.readFileSync(file,'utf8'),name)};};
const orig = load(path.join(origDir, 'learn/data.js')).LEARN;
const refW = load(path.join(refDir, 'learn/data.js'));
const ref = refW.LEARN;
let refStatus = {};
try { refStatus = load(path.join(refDir, 'learn/refactoring-status.js')).REFACTOR_STATUS || {}; } catch {}
const { describeCapabilities } = await import(pathToFileURL(path.resolve(refDir, 'src/capabilities/registry.js')).href);
const codeCaps = describeCapabilities();

import { WORKSHOPS, buildCatalog } from '../../src/system-workshop/catalog-build.js';
export { WORKSHOPS };
const manifest=await scanCodeLibrary();
const catalog = buildCodeCatalog(manifest,{learningCatalog:buildCatalog({ orig, ref, refStatus, codeCaps }),codeCaps,executionAdapters:[...describeObjectCapabilities(),...describeGsceneCapabilities()]});
fs.writeFileSync(path.join(path.dirname(out),'refactored-code-library.json'),JSON.stringify(manifest));
fs.writeFileSync(path.join(refDir,'capability-library.json'),JSON.stringify({schemaVersion:2,generatedAt:manifest.generatedAt,snapshotId:manifest.snapshotId,counts:manifest.counts,modules:catalog.modules,combinations:catalog.combinations,evolution:catalog.evolution}));
// 原版 REACode 的学习记录快照：浏览器里「扫描能力库」读不到 REACode 目录时用它（原版冻结不改，快照即可）
fs.writeFileSync(path.join(path.dirname(out), 'reacode-learn.json'), JSON.stringify({ generatedAt: new Date().toISOString(), source: 'REACode/learn/data.js', LEARN: orig }));
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(catalog));
console.log(JSON.stringify({sourceModules:catalog.modules.length,combinations:catalog.combinations.length,counts:manifest.counts,out},null,2));
