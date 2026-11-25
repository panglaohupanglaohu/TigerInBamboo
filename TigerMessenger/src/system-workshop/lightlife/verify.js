/**
 * 光影与生命管线 · 独立验证（验证 Worker 用，纯数据）。不信改造 Worker 的输出：从 site 重新建体素空间、重新算一遍再比。
 * 每一项都会在结果被破坏时判失败（tests/lightlife-pipeline.test.mjs 逐项破坏）：
 *   values   遮蔽 / 反弹网格形状与数值范围          persist  不写存档 / 不设默认（plan.persist 恒 false）
 *   ao       重建占用场，抽 80 个格心层心点复算遮蔽，差 > 0.002 判失败
 *   aoSane   开阔顶面压暗 ≤ 20% 通过、≤ 35% 提醒、更多 = 把天空也压黑了（漏光的反面），判失败；凹角应比开阔处暗
 *   town     重算区域图摘要，块数 / 楼 / 走道不一致判失败
 *   plateau  台地诊断复算：同高片片数 / 陆地格数 / 阶差边数不一致判失败
 *   megatex  反查正确率（有垫边时应 100%）、放不下的面、串色
 *   plants   本场景登记的图集 hash 必须就是全场景共用的那一张
 *   wind     风线上每一点都不在实心里              smoke  烟团不低于烟源、绘制顺序是全部烟团的一个排列
 *   animals  最后一帧每只都在陆地（非建筑、非海）格上
 *   契约 · …  preserves 并集经 contract-verify.js 生成的通用检查（R52）
 */
import { buildVoxelField } from '../../../../townscaper-web/REACodeRefactoring/src/light/voxel-light.js';
import { Town, regionSummary } from '../../../../townscaper-web/REACodeRefactoring/src/core/town-graph.js';
import { plateauRuns, stepDropArea } from '../../../../townscaper-web/REACodeRefactoring/src/core/terrace-profile.js';
import { worldFromSite, SEA } from './scene-voxels.js?v=light-r65';
import { sharedPlantAtlas } from './plant-atlas.js?v=light-r67';
import { probesOf } from './life.js?v=light-r69';
import { contractOf } from '../contracts.js?v=contract-r1';
import { verifyPreserves, preservesOfSteps } from '../contract-verify.js?v=contract-r1';
import { LIGHTLIFE_CAPABILITIES } from './capabilities.js?v=light-r65';

const KNOWN = ['scene.town-graph', 'light.voxel-ao', 'light.bounce', 'light.megatex', 'life.plant-atlas', 'life.wind', 'life.smoke', 'life.animals', 'scene.plateau-diag'];
const fin = (a, lo, hi) => Array.isArray(a) && a.every((v) => Number.isFinite(v) && v >= lo && v <= hi);
export function verifyLightLife(site, plan, { steps = [] } = {}) {
  const checks = [], add = (id, name, status, detail, blame = []) => checks.push({ id, name, status, detail, blame });
  const ids = new Set(steps.map((s) => s.id));
  if (!site || !plan) { add('input', '输入', 'fail', '没有采样或没有候选'); return done(checks); }
  add('persist', '不写存档 / 不设默认', plan.persist === false ? 'pass' : 'fail', plan.persist === false ? '候选只在本次预览里' : 'plan.persist 不是 false');
  const unknown = (plan.steps || []).filter((s) => !KNOWN.includes(s));
  add('steps', '能力清单', unknown.length ? 'fail' : 'pass', unknown.length ? '不认识：' + unknown.join('、') : `${(plan.steps || []).length} 个能力`);
  const V = worldFromSite(site), n = V.n;
  if (plan.light) {
    const L = plan.light, size = n * n * L.Lv, okOcc = L.occ?.length === size && fin(L.occ, 0, 1.01), okTint = L.tint == null || (L.tint.length === size * 3 && fin(L.tint, 0, 1.6));
    add('values', '遮蔽 / 反弹网格', okOcc && okTint && L.n === n ? 'pass' : 'fail', `${n}×${n}×${L.Lv} 格 · 遮蔽 ${okOcc ? '有效' : '无效'} · 反弹 ${L.tint ? (okTint ? '有效' : '无效') : '未跑'}`, ['light.voxel-ao', 'light.bounce']);
    if (okOcc) {
      const f = buildVoxelField({ grid: V.grid, levelHeight: V.L, sets: [{ world: V.world, colorOf: V.colorOf }], res: V.step / 3, pad: V.step * 0.5, blurRadius: L.radius ?? 3, blurPasses: 2 });
      let bad = 0, worst = 0; const K = Math.min(80, size);
      for (let k = 0; k < K; k++) { const q = Math.floor((k * 2654435761) % size), lv = Math.floor(q / (n * n)), j = Math.floor((q % (n * n)) / n), i = q % n, c = V.grid.cells[j * n + i], d = Math.abs(f.sampleOcc(c.cx, (lv - 0.5) * V.L, c.cz) - L.occ[q]); worst = Math.max(worst, d); if (d > 0.002) bad++; }
      add('ao', '遮蔽复算', bad ? 'fail' : 'pass', `抽 ${K} 点，差 > 0.002 的 ${bad} 点（最大差 ${worst.toFixed(4)}）`, ['light.voxel-ao']);
    }
  } else if (ids.has('light.voxel-ao') || ids.has('light.bounce')) add('values', '遮蔽 / 反弹网格', 'fail', '执行了遮蔽 / 反弹但候选里没有网格', ['light.voxel-ao']);
  const ao = plan.metrics?.ao;
  if (ao) add('aoSane', '只压该压的地方', ao.open > 0.35 ? 'fail' : ao.open > 0.2 || ao.corner < ao.open ? 'warn' : 'pass', `开阔顶面 ${(ao.open * 100).toFixed(1)}% · 凹角 ${(ao.corner * 100).toFixed(1)}%（开阔 > 35% = 天空也被压黑）`, ['light.voxel-ao']);
  if (plan.town) {
    const s = regionSummary(new Town(V.grid, { world: V.world })), same = ['regions', 'buildings', 'walkways', 'largest'].every((k) => s[k] === plan.town[k]);
    add('town', '区域图复算', same ? 'pass' : 'fail', `块 ${s.regions} · 楼 ${s.buildings} · 走道 ${s.walkways}${same ? '' : `（候选写的是 ${plan.town.regions} / ${plan.town.buildings} / ${plan.town.walkways}）`}`, ['scene.town-graph']);
  }
  if (plan.plateau) {
    const q = plan.plateau, R = plateauRuns(V.world, { height: q.height || 'top' }), S = stepDropArea(V.world, { minStep: q.minStep ?? 2, height: q.height || 'top' });
    const same = R.count === q.runs && R.landCells === q.landCells && S.edges === q.steps?.edges && S.land === q.steps?.land;
    add('plateau', '台地诊断复算', same ? 'pass' : 'fail', `同高片 ${R.count} · ≥${q.minStep ?? 2} 层阶差边 ${S.edges}（陆地间 ${S.land}）${same ? '' : `（候选写的是 ${q.runs} / ${q.landCells} / ${q.steps?.edges} / ${q.steps?.land}）`}`, ['scene.plateau-diag']);
  }
  if (plan.megatex) {
    const m = plan.megatex, want = m.pad > 0 ? 0.999 : 0.95;
    add('megatex', '大纹理反查', !(m.exactRate >= want) ? 'fail' : m.fail || m.bleedRate > 0.1 ? 'warn' : 'pass', `${m.faces} 块面 · ${m.size}² · 反查 ${(m.exactRate * 100).toFixed(1)}% · 串色 ${(m.bleedRate * 100).toFixed(1)}%${m.fail ? ` · ${m.fail} 块放不下` : ''}`, ['light.megatex']);
  }
  if (plan.plants) {
    const A = sharedPlantAtlas(), same = plan.plants.atlasHash === A.hash && A.ok;
    add('plants', '植物图集全场景共用', !same ? 'fail' : plan.plants.instances && plan.plants.coverage < 0.5 ? 'warn' : 'pass', same ? `同一张图集 ${A.hash}（${A.slots.length} 种）· 本场景用 ${plan.plants.used.length} 种 · 认出 ${(plan.plants.coverage * 100).toFixed(1)}%` : `图集 hash ${plan.plants.atlasHash} ≠ 共用的 ${A.hash}`, ['life.plant-atlas']);
  }
  const P = probesOf(V);
  if (plan.wind) {
    let inside = 0, pts = 0; for (const line of plan.wind.lines || []) for (const p of line) { pts++; if (P.occupied(p[0], p[1], p[2])) inside++; }
    add('wind', '风不进实心', inside ? 'fail' : (plan.wind.lines || []).length ? 'pass' : 'warn', `${(plan.wind.lines || []).length} 条风线 ${pts} 点，进实心 ${inside} 点`, ['life.wind']);
  }
  if (plan.smoke) {
    const S = plan.smoke, low = S.puffs.filter((p) => p.y + 1e-6 < S.sources[p.src]?.y).length, perm = S.order.length === S.puffs.length && new Set(S.order).size === S.order.length && S.order.every((x) => S.puffs.some((p) => p.serial === x));
    add('smoke', '烟团与绘制顺序', low || !perm ? 'fail' : 'pass', `${S.sources.length} 个烟囱 · ${S.puffs.length} 个烟团 · 低于烟源 ${low} · 顺序${perm ? '完整' : '不完整'}`, ['life.smoke']);
  }
  if (plan.animals) {
    const last = plan.animals.frames?.at(-1) || [], off = last.filter(([x, , z]) => { const c = P.cellAt(x, z); return !c || !(site.h[c.id] > SEA) || site.kind?.[c.id] === 2; }).length;
    add('animals', '动物留在陆地', off ? 'fail' : plan.animals.agents ? 'pass' : 'warn', `${plan.animals.agents} 只，最后一帧不在陆地 ${off} 只`, ['life.animals']);
  }
  // 契约（R51 / R52）：本次执行的能力 preserves 并集 → 通用检查（不写存档、不碰湖上建筑……）
  const contracts = LIGHTLIFE_CAPABILITIES.map((c) => contractOf(c.meta, 'lightlife')), pres = preservesOfSteps(contracts, plan.steps || [...ids]);
  for (const c of verifyPreserves(pres.preserves, { sceneId: site.scene?.id || plan.scene }, { blameOf: pres.blameOf })) checks.push(c);
  return done(checks);
}
function done(checks) {
  const status = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';
  return { status, checks, summary: checks.map((c) => `${c.name}${c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✗'}`).join(' ') };
}
