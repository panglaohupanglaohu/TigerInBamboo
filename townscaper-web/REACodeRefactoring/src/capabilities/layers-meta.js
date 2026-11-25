/**
 * layers-meta.js — "显示层"能力的描述与匹配（纯数据，Worker 可用）。
 * 显示层不改体素：在场景里加一层会动的东西（灯室光束、体积浅水、烟）。真正的 three.js 实现在 layers.js（主线程）。
 */
import { top, topIsBuilt, isSolid } from './ops.js';

const coast = (w) => w.grid.cells.filter((c) => top(w, c.id) > 0 && c.edgeNeighbors.some((id) => id < 0 || top(w, id) === 0));

export const LAYER_CAPS = [
  {
    meta: { id: 'terrain.shrub-texture', layer: 'terrain', kind: '地形', name: '纯纹理灌木（台地边）', kind2: 'layer', layer3d: 'shrubtex',
      summary: '「100% texture, painted onto a fairly low poly mesh」：台地 / 崖顶边一条鲑橙灌木带，锯齿外缘、有的边断开、内侧一道小阴影；纯着色，不加几何、不改体素。',
      sources: ['1707490932017279035', '1707497006640365880', '1707490274425884929'], targets: '草 / 干草台地临更低陆地的边',
      ideas: ['townscaper-web/REACode/src/paintblotch.js'],   // 同帖：低模+大色斑笔触的原版实现
      keywords: ['灌木', '树丛', '边缘', '台地', '崖顶', '纹理', 'shrub', 'bush'], params: {} },
    match(w) {
      const rows = [];
      for (const c of w.grid.cells) { const t = top(w, c.id); if (t < 2 || topIsBuilt(w, c.id)) continue; const lower = c.edgeNeighbors.filter((id) => id >= 0 && top(w, id) >= 1 && top(w, id) < t).length; if (lower) rows.push(c.id); }
      return rows.length ? [{ id: 'shrubtex:all', cells: rows, focus: rows[0], score: rows.length, reason: `${rows.length} 格台地边临更低陆地，可画纹理灌木带` }] : [];
    },
  },
  {
    meta: { id: 'water.volume', layer: 'water', kind: '水', name: '体积浅水（SDF 叠层）', kind2: 'layer', layer3d: 'watervol',
      summary: '海岸距离场 + 6 张平面叠在水面上，岸边一圈圈会流动的浅滩等深线。不改体素。',
      sources: ['1758251637280268481'], targets: '整条岸线', keywords: ['水', '浅水', '岸', '等深线', '水面', '体积', 'water', 'shore'], params: {},
      ideas: ['townscaper-web/REACode/engine/watervol.js'] },   // 同帖：SDF 叠层浅水的原版实现
    match(w) { const c = coast(w); return c.length ? [{ id: 'watervol:all', cells: c.map((x) => x.id), focus: c[0].id, score: c.length, reason: `岸线 ${c.length} 格，可加浅滩等深线` }] : []; },
  },
  {
    meta: { id: 'build.lighthouse-light', layer: 'building', kind: '建筑', name: '灯塔灯室与光束', kind2: 'layer', layer3d: 'lighthouse',
      summary: '自动识别"海边、≥5 层、邻格都矮 2 层以上"的一格粗塔，加灯室、栏杆、红尖顶，夜里光束绕塔转。不改体素。',
      sources: ['1331905048801144836'], targets: '已有的海边细高塔', keywords: ['灯塔', '光束', '夜', 'lighthouse'], params: {} },
    match(w) {
      const out = [];
      for (const c of w.grid.cells) {
        const t = top(w, c.id);
        if (t < 5 || !topIsBuilt(w, c.id)) continue;
        let slim = true, sea = false;
        for (const id of c.edgeNeighbors) { const h = id >= 0 ? top(w, id) : 0; if (h > t - 2) slim = false; if (h === 0) sea = true; }
        if (slim && sea) out.push({ id: 'lantern:' + c.id, cells: [c.id], focus: c.id, score: t, reason: `塔 ${c.id}（${t} 层）临水且细高，加灯室` });
      }
      return out;
    },
  },
  {
    meta: { id: 'effects.smoke', layer: 'effects', kind: '烟', name: '特效层 · 烟（烟囱炊烟）', kind2: 'layer', layer3d: 'smoke',
      summary: '在建筑生成的烟囱口放烟：两遍画（黑描边 + 浅色），沿流向滚动噪声，越往上越模糊。不改体素。',
      sources: ['1015140880666300416', '1015142746372366336', '1015149712469524480', '1015151731804721152'], targets: '有屋顶的建筑',
      ideas: ['townscaper-web/REACode/src/smokefx.js'],   // 同帖：烟雾卡片的原版实现
      keywords: ['烟', '炊烟', '烟囱', '生活', 'smoke'], params: {} },
    match(w) { const r = w.grid.cells.filter((c) => topIsBuilt(w, c.id)); return r.length ? [{ id: 'smoke:all', cells: r.map((c) => c.id), focus: r[0].id, score: r.length, reason: `${r.length} 格建筑顶，烟囱口由建筑生成时决定` }] : []; },
  },
  {
    // 网格能力线的第一项可执行能力：不规则网格上的等值线与逐层区域边界（src/world/contour-overlay.js，纯显示）
    meta: { id: 'grid.contours', layer: 'world', kind: '世界', name: '网格等值线与层区域边界', kind2: 'layer', layer3d: 'contours',
      summary: '在不规则网格上画出陆地等值线，以及每个高度层沿格边的区域边界（同一片台地一个颜色）。用来看清网格、台地分层与连通区域；纯显示，不改体素。原片里的窗口裁剪与点击选中不在这一层。',
      sources: ['1120036868966502401'],
      ideas: ['townscaper-web/REACode/src/march.js'],   // 同帖：不规则网格 marching squares 的原版实现
      modules: ['src/world/contour-overlay.js', 'src/core/contour.js', 'src/core/region-boundary.js', 'src/core/region-ids.js'],
      targets: '整个场景的陆地格', keywords: ['网格', '等值线', '等高线', '分层', '区域', '边界', '台地', 'grid', 'contour'], params: {} },
    match(w) {
      const land = w.grid.cells.filter((c) => top(w, c.id) > 0); if (!land.length) return [];
      const levels = new Set(land.map((c) => top(w, c.id))).size;
      return [{ id: 'contours:all', cells: land.map((c) => c.id), focus: land[0].id, score: land.length, reason: `${land.length} 格陆地、${levels} 个高度层，可画等值线与层区域边界` }];
    },
  },
  {
    // 798580832906739712「dirt cheap ray marching…visibility when indoors」：
    // 三维空间开阔度诊断层——黄色射线扇出 + 整楼灰度场（楼内/洞道暗、露天亮）。只读 World，不改体素。
    meta: { id: 'world.openness', layer: 'world', kind: '世界', name: '三维空间开阔度（射线灰度场）', kind2: 'layer', layer3d: 'rayvis',
      summary: '从采样点向斐波那契方向做固定步长射线行进，平均命中距离即开阔度：黄线诊断扇 + 每个地面采样点一个灰点（被覆盖的室内/洞道暗、露天亮）。只读体素，不改 World。原片"用于室内可见度"的诊断形式，不是游戏 AI。',
      sources: ['798580832906739712'],
      ideas: ['townscaper-web/REACode/src/rayvis.js'],   // 同帖：廉价 ray marching 可见度的原版实现
      modules: ['src/core/space-visibility.js', 'src/world/space-visibility.js'],
      targets: '有被覆盖地面（楼内/洞道）或要查开阔度的陆地格', keywords: ['开阔度', '室内', '可见度', '视线', '射线', 'openness', 'visibility', 'indoor', 'ray'], params: {} },
    match(w) {
      const covered = [], open = [];
      for (const c of w.grid.cells) {
        const t = top(w, c.id); if (!t) continue;
        let indoor = false;
        for (let lv = 1; lv <= t; lv++) if (isSolid(w, c.id, lv) && isSolid(w, c.id, lv + 1)) { indoor = true; break; }   // 实心层上还有实心 → 这层地面被盖住
        (indoor ? covered : open).push(c.id);
      }
      if (!covered.length && !open.length) return [];
      return [{ id: 'rayvis:all', cells: covered.length ? covered : open, focus: covered[0] ?? open[0], score: covered.length || open.length,
        reason: covered.length ? `${covered.length} 格有被覆盖地面，烘三维开阔度灰度场（室内暗）` : `${open.length} 格陆地，烘三维开阔度灰度场` }];
    },
  },
];
