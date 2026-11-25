// R63–R64 原版当裁判（Guide §1.4 创新 1）：光照 / 大纹理 / 体素图三个嫁接，同判据下必须与原版逐值相同；与重构库原有模块的差异逐条登记。
// 原版 lighting.js 要 'three'：tools/refactor/lightlife-parity.mjs 在 import 时把它指到 TigerMessenger/vendor/three.module.js。
// 运行（仓库根目录）：$NODE --test TigerMessenger/tests/lightlife-parity.test.mjs
import test from 'node:test'; import assert from 'node:assert/strict';
import { loadParityModules, buildLightLifeParityFiles, PARITY_DIR } from '../tools/refactor/lightlife-parity.mjs';
import { PARITY_VERDICTS } from '../../townscaper-web/REACodeRefactoring/src/core/capability-maturity.js';
const { mods, parity } = await loadParityModules();

test('光照：同判据（同参数、同小镇）嫁接 voxel-light.js 与原版 lighting.js 单跳、多跳顶点色逐值相同', () => {
  const r = parity.lightingParity(mods);
  assert.equal(r.cases.field.occIdentical, true);
  assert.equal(r.cases.singleBounce.graft.maxAbs, 0); assert.equal(r.cases.multiBounce.graft.maxAbs, 0);
  assert.ok(r.cases.multiBounce.vsSingle.maxAbs > 0, '多跳应当改变了颜色');
  assert.ok(r.cases.singleBounce.library.pearson > 0.9, '重构库 bake.js 与原版高度相关（同一套数学）');
  assert.equal(r.sameCriteriaEqual, true, JSON.stringify(r.diffs.filter((d) => d.kind === 'gap')));
});

test('大纹理：货架排布下 mega-atlas.js 的整套量法与原版 megatex.js 逐值相同；增量图集的差异登记为 design', () => {
  const r = parity.megatexParity(mods);
  for (const k of Object.keys(r.cases)) { assert.deepEqual(r.cases[k].shelf, r.cases[k].original, k); assert.equal(r.cases[k].mipOwnerSame, true, k); }
  assert.equal(r.sameCriteriaEqual, true, JSON.stringify(r.diffs.filter((d) => d.kind === 'gap')));
  assert.ok(r.diffs.every((d) => d.kind === 'design' && d.note));
});

test('体素图：同一串编辑之后 town-graph.js 的 Town 与原版 Town 柱子 / 区域图相同；对账别名（pointInQuad / buildCellIndex / PALETTES）成立', () => {
  const r = parity.townParity(mods);
  assert.equal(r.cases.columns.same, true); assert.equal(r.cases.regions.same, true);
  assert.equal(r.cases.aliases.pointInQuad.same, r.cases.aliases.pointInQuad.samples);
  assert.equal(r.cases.aliases.buildCellIndex.bothFind, r.cases.aliases.buildCellIndex.samples);
  assert.equal(r.cases.aliases.palettesSame, true);
  assert.ok(r.diffs.some((d) => d.id === 'town.library.TERRAIN' && d.kind === 'design'), '同名不同物的 TERRAIN 必须登记');
  assert.equal(r.sameCriteriaEqual, true, JSON.stringify(r.diffs.filter((d) => d.kind === 'gap')));
});

test('登记文件：三份完整对照 + 四个能力各一份（capability = 能力 ID，verdict 合法）+ 需求行；同输入两次结论相同', async () => {
  const now = new Date('2026-11-23T00:00:00Z'), a = await buildLightLifeParityFiles({ now }), b = await buildLightLifeParityFiles({ now });
  for (const id of ['light.voxel-ao', 'light.bounce', 'light.megatex', 'scene.town-graph', 'lighting', 'megatex', 'town']) {
    const f = a.files[`${PARITY_DIR}/${id}.json`]; assert.ok(f, id); assert.equal(f.capability, id); assert.ok(PARITY_VERDICTS.includes(f.verdict), id);
    assert.ok(f.original.every((p) => p.startsWith('townscaper-web/REACode/')), id);
  }
  assert.ok(Array.isArray(a.files[`${PARITY_DIR}/lightlife-demand.json`]));
  assert.deepEqual(JSON.parse(JSON.stringify(a.files)), JSON.parse(JSON.stringify(b.files)));
});
