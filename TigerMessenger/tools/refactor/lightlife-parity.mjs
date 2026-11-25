// 原版当裁判 · 光照 / 大纹理 / 体素图（Guide §1.4 创新 1、§10 R61–R70 的 R63–R64）：把 lightlife/parity.js 的对照结果写进 catalog/parity/，
// 供九级成熟度 ④ 与补学队列使用。原版 REACode 只读 import，不改；原版 lighting.js 要 'three'，这里先把它指到 TigerMessenger/vendor/three.module.js。
// 用法（按 §5.2 规矩在 TigerMessenger 目录里跑；输出路径按仓库根算，不随当前目录漂）：
//   cd TigerMessenger && $NODE tools/refactor/lightlife-parity.mjs            写文件
//   cd TigerMessenger && $NODE tools/refactor/lightlife-parity.mjs --stdout   只打印摘要
// 写出（src/scene-authoring/catalog/parity/）：lighting.json、megatex.json、town.json（完整对照）、
//   light.voxel-ao.json、light.bounce.json、light.megatex.json、scene.town-graph.json（capability 字段 = 能力 ID，④ 的证据）、lightlife-demand.json（缺口 → 补学队列）。
import fs from 'node:fs'; import path from 'node:path'; import { register } from 'node:module'; import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url)), TM = path.resolve(here, '../..'), workspace = path.resolve(TM, '..');
export const PARITY_DIR = 'TigerMessenger/src/scene-authoring/catalog/parity';
const GENERATOR = 'TigerMessenger/tools/refactor/lightlife-parity.mjs';
const THREE_URL = pathToFileURL(path.join(TM, 'vendor/three.module.js')).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return{url:${JSON.stringify(THREE_URL)},shortCircuit:true};return n(s,c);}`));

const ORIG = path.join(workspace, 'townscaper-web/REACode/src'), LIB = path.join(workspace, 'townscaper-web/REACodeRefactoring/src');
const imp = (p) => import(pathToFileURL(p).href);
export async function loadParityModules() {
  const [lighting, town, megatex, light, mega, tg, bake, world, spatial, palette, voxels, parity] = await Promise.all([
    imp(path.join(ORIG, 'lighting.js')), imp(path.join(ORIG, 'town.js')), imp(path.join(ORIG, 'megatex.js')),
    imp(path.join(LIB, 'light/voxel-light.js')), imp(path.join(LIB, 'light/mega-atlas.js')), imp(path.join(LIB, 'core/town-graph.js')),
    imp(path.join(LIB, 'light/bake.js')), imp(path.join(LIB, 'core/world.js')), imp(path.join(LIB, 'core/spatial.js')), imp(path.join(LIB, 'core/palette.js')),
    imp(path.join(TM, 'src/system-workshop/lightlife/scene-voxels.js')), imp(path.join(TM, 'src/system-workshop/lightlife/parity.js')),
  ]);
  return { mods: { O: { lighting, town, megatex }, G: { light, mega, town: tg }, R: { bake, world, spatial, palette }, grid: voxels.squareGrid }, parity };
}
export async function buildLightLifeParityFiles({ now = new Date() } = {}) {
  const { mods, parity } = await loadParityModules(), docs = parity.runLightLifeParity(mods), generatedAt = now.toISOString(), files = {};
  for (const [key, doc] of Object.entries(docs)) files[`${PARITY_DIR}/${key}.json`] = { capability: key, generatedAt, generator: GENERATOR, ...doc };
  for (const [id, key] of Object.entries(parity.PARITY_CAPABILITIES)) {
    const doc = docs[key];
    files[`${PARITY_DIR}/${id}.json`] = { capability: id, verdict: doc.verdict, line: doc.line, generatedAt, generator: GENERATOR,
      basis: `本能力在光影与生命管线里真实调用 ${parity.GRAFT_FILES[key]}（meta.modules）；这份是它对原版 ${parity.ORIGINAL_FILES[key]} 的对照登记，完整内容见 ${key}.json。`,
      see: `${PARITY_DIR}/${key}.json`, sameCriteriaEqual: doc.sameCriteriaEqual, original: doc.original, refactored: doc.refactored, inputs: doc.inputs, gaps: doc.gaps, diffs: doc.diffs };
  }
  files[`${PARITY_DIR}/lightlife-demand.json`] = parity.parityDemand(docs);
  return { docs, files };
}
export async function writeLightLifeParity({ root = workspace, now = new Date() } = {}) {
  const { docs, files } = await buildLightLifeParityFiles({ now });
  fs.mkdirSync(path.join(root, PARITY_DIR), { recursive: true });
  for (const [rel, body] of Object.entries(files)) fs.writeFileSync(path.join(root, rel), JSON.stringify(body, null, 1) + '\n');
  return { docs, written: Object.keys(files) };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--stdout')) {
    const { docs } = await buildLightLifeParityFiles();
    for (const [k, d] of Object.entries(docs)) console.log(`${k}：${d.verdict}（同判据${d.sameCriteriaEqual ? '一致' : '不一致'}，缺口 ${d.gaps}，差异 ${d.diffs.length}）\n  ` + d.diffs.map((x) => `${x.kind} ${x.id}`).join('\n  '));
  } else {
    const { docs, written } = await writeLightLifeParity();
    console.log(Object.entries(docs).map(([k, d]) => `${k} ${d.verdict}（同判据${d.sameCriteriaEqual ? '一致' : '不一致'}，缺口 ${d.gaps}）`).join('；') + '\n写入：\n  ' + written.join('\n  '));
  }
}
