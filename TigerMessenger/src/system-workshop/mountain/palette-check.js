/**
 * R27 山形配色候选的可量化检查（纯数据）：草坡面积够不够、偏不偏灰。
 * 候选两套：Bad North 夏季（palettes.js 1，取自 badnorth/theme.js BN_PAL.summer）与 Townscaper（palettes.js 2，取自 core/palette.js）。
 * 指标只看产出的材质号 / 烘焙明暗 / 配色表，不看能力参数：
 *   grassShare  草坡面积  自由陆地三角里材质为草坡（0）或草丛（5）的面积占比（按投影面积加权）
 *   greyShare   灰面占比  自由陆地三角里，烘焙明暗后的顶点色 HSV 饱和度 < 0.12 的面积占比（岩壁 / 碎石 / 雪 天生偏灰）
 *   grassSat    草坡饱和度 草坡三角烘焙后颜色的面积加权平均饱和度（草发灰 = 这个数低）
 * 判定线（写死，先定线后量数）：grassShare ≥ 0.45，greyShare ≤ 0.35，grassSat ≥ 0.18。
 */
import { PALETTES } from './palettes.js';
import { cellTris } from './ground.js?v=ground-r25';
export const PALETTE_CANDIDATES = [
  { id: 1, label: 'Bad North 夏季', source: 'townscaper-web/REACodeRefactoring/src/badnorth/theme.js BN_PAL.summer' },
  { id: 2, label: 'Townscaper', source: 'townscaper-web/REACodeRefactoring/src/core/palette.js' },
];
export const PALETTE_RULES = { grassMin: 0.45, greyMax: 0.35, grassSatMin: 0.18 };
export const saturation = ([r, g, b]) => { const mx = Math.max(r, g, b), mn = Math.min(r, g, b); return mx <= 1e-9 ? 0 : (mx - mn) / mx; };

export function paletteStats(field, plan, paletteId) {
  const pal = PALETTES[paletteId]; if (!pal) throw new RangeError('没有这套配色：' + paletteId);
  const n = plan.n, step = plan.step, h = plan.h, h0 = field.h, cls = field.cls, mat = plan.mat, shade = plan.shade;
  if (!Array.isArray(mat) || mat.length !== (n - 1) * (n - 1) * 2) throw new TypeError('山形计划缺少材质数组');
  let area = 0, grass = 0, grey = 0, gSat = 0;
  for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) cellTris(n, i, j).forEach((tri, k) => {
    if (!tri.every((q) => h[q] != null && h0[q] != null && h0[q] > 0.3 && cls[q] === 0)) return;
    const t = (j * (n - 1) + i) * 2 + k, a = step * step / 2, m = mat[t], s = shade?.[t] ?? 1, c = (pal[m] || pal[0]).map((v) => Math.min(1, v * s)), sat = saturation(c);
    area += a; if (sat < 0.12) grey += a; if (m === 0 || m === 5) { grass += a; gSat += sat * a; }
  });
  const r3 = (v) => Math.round(v * 1000) / 1000, grassShare = area ? grass / area : 0, greyShare = area ? grey / area : 0, grassSat = grass ? gSat / grass : 0;
  const checks = [
    { id: 'grass', name: '草坡面积够', status: grassShare >= PALETTE_RULES.grassMin ? 'pass' : 'fail', detail: `草坡 ${Math.round(grassShare * 100)}%（线 ≥ ${PALETTE_RULES.grassMin * 100}%）` },
    { id: 'grey', name: '不偏灰', status: greyShare <= PALETTE_RULES.greyMax && grassSat >= PALETTE_RULES.grassSatMin ? 'pass' : 'fail', detail: `灰面 ${Math.round(greyShare * 100)}%（线 ≤ ${PALETTE_RULES.greyMax * 100}%）· 草坡饱和度 ${grassSat.toFixed(2)}（线 ≥ ${PALETTE_RULES.grassSatMin}）` },
  ];
  return { palette: paletteId, grassShare: r3(grassShare), greyShare: r3(greyShare), grassSat: r3(grassSat), area: Math.round(area), checks, status: checks.every((c) => c.status === 'pass') ? 'pass' : 'fail' };
}
export const compareCandidates = (field, plan) => PALETTE_CANDIDATES.map((c) => ({ ...c, ...paletteStats(field, plan, c.id) }));
