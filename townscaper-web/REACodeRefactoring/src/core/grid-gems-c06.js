/**
 * grid-gems-c06.js — 第 56 批 C06：1301816247479345152 "sprinkling the current generated grid with random patches of
 * hand crafted grid, like little gems to find and build your temples upon"。
 * 在主场景的生成网格上按种子随机撒几块手工模板补丁（radial 放射 / courtyard 环院 / block 方格 / rhombus 菱形），
 * 每块走共享 core/radial-patch.js fitTemplatePatch（原边界顶点共用、新格必凸、无翻折），互不重叠、不碰外圈。
 * 主场景 ?gems=N 打开（默认关：不改网格、存档兼容不受影响）。
 */
import { fitTemplatePatch } from './radial-patch.js';

export function sprinkleGems(grid, { count = 4, seed = 11, templates = ['courtyard', 'radial', 'block', 'rhombus'], radius = 2.6, margin = 3.2, maxTries = 60 } = {}) {
  if (!Number.isInteger(count) || count < 0 || count > 12) throw new RangeError('gem count 0..12');
  let s = seed >>> 0 || 1; const rnd = () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  const R = Math.max(...grid.cells.map((c) => Math.hypot(c.cx, c.cz)));
  let g = grid; const gems = [], rejected = [];
  for (let tries = 0; gems.length < count && tries < maxTries; tries++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (R - radius - margin), x = Math.cos(a) * d, z = Math.sin(a) * d;
    const template = templates[gems.length % templates.length];
    if (gems.some((q) => Math.hypot(q.x - x, q.z - z) < q.radius + radius + 1.2)) continue;
    try {
      const next = fitTemplatePatch(g, { template, x, z, radius, rings: 2, holeRadius: radius * .42, angle: rnd() * Math.PI });
      gems.push({ template, x: next.patch.x, z: next.patch.z, radius, cells: next.cells.length - next.sourceCellOf.filter((id) => id >= 0).length, tries: next.patch.tries });
      g = next;
    } catch (e) { if (!(e instanceof RangeError)) throw e; rejected.push({ template, x, z, reason: e.message }); }
  }
  g.gems = gems; g.gemRejected = rejected;
  return g;
}
