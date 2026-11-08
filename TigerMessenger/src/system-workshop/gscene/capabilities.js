/**
 * 通用场景管线的能力代码：作用在场景的「材质色表」上（generic-scene.js 登记的材质）。
 * 书店镇、湖沼、苔庭……这些场景不是体素世界，体素能力用不上；这一层先接入风格与氛围：
 *   scene.palette-unify  风格统一：把散乱的颜色归并到 N 个主色（按使用次数加权聚类）
 *   scene.tone           整体色调：色相旋转 / 饱和度 / 明度（相当于场景调色）
 *   scene.style-pack     套用风格包：每种材质靠向风格包里最近的颜色（莫里斯色板）
 * 输入 materials: [{ id, name, base, color, uses }]，输出 { colors: { id: '#rrggbb' } }，纯数据，在 Worker 里跑。
 */
import morris from '../../style/packs/morris.js';

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
const rgb2hex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, '0')).join('');
function rgb2hsl([r, g, b]) { const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2; if (mx === mn) return [0, 0, l]; const d = mx - mn, s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn); const h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return [h / 6, s, l]; }
function hsl2rgb([h, s, l]) { if (!s) return [l, l, l]; const q = l < 0.5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; const f = (t) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; }; return [f(h + 1 / 3), f(h), f(h - 1 / 3)]; }
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export const helpers = { hex2rgb, rgb2hex, rgb2hsl, hsl2rgb, dist };
const PACKS = { morris: [...morris.town.walls, ...Object.values(morris.town.build)].filter((c) => /^#[0-9a-f]{6}$/i.test(c)) };

export const GSCENE_CAPABILITIES = [
  { meta: { id: 'scene.palette-unify', domain: 'style', name: '风格统一（主色归并）', does: '把场景里散乱的颜色按使用次数聚成几个主色，每种材质向所属主色靠拢；数量越少风格越统一。',
      keywords: ['统一', '风格', '颜色', '杂乱', '协调', '主色', '调色板', 'palette'], params: { colors: { label: '主色数', min: 3, max: 12, step: 1, default: 6 }, strength: { label: '靠拢程度', min: 0.1, max: 1, step: 0.05, default: 0.6 } } },
    match: (M) => M.length >= 4 ? [{ id: 'materials', count: M.length, reason: `${M.length} 种材质，${new Set(M.map((m) => m.color)).size} 种颜色` }] : [],
    run(M, p) {
      const pts = M.map((m) => ({ id: m.id, c: hex2rgb(m.color), w: Math.max(1, m.uses) }));
      const k = Math.min(p.colors, pts.length);
      // 确定性 k-means：按权重排序取初始中心，迭代 12 次
      let cent = [...pts].sort((a, b) => b.w - a.w || a.id.localeCompare(b.id)).slice(0, k).map((x) => x.c.slice());
      let lab = [];
      for (let it = 0; it < 12; it++) {
        lab = pts.map((x) => { let bi = 0, bd = 9; cent.forEach((c, i) => { const d = dist(x.c, c); if (d < bd) { bd = d; bi = i; } }); return bi; });
        cent = cent.map((c, i) => { const mem = pts.filter((_, j) => lab[j] === i); const W = mem.reduce((a, x) => a + x.w, 0); return W ? [0, 1, 2].map((d) => mem.reduce((a, x) => a + x.c[d] * x.w, 0) / W) : c; });
      }
      const colors = {}; pts.forEach((x, j) => { colors[x.id] = rgb2hex(mix(x.c, cent[lab[j]], p.strength)); });
      return { colors, note: `${k} 个主色：${cent.map(rgb2hex).join(' ')}` };
    } },
  { meta: { id: 'scene.tone', domain: 'atmosphere', name: '整体色调', does: '对场景所有材质做同一组调色：色相旋转、饱和度缩放、明度偏移（像给场景换一种时辰或情绪）。',
      keywords: ['色调', '氛围', '暖', '冷', '暗', '亮', '饱和', '黄昏', '清晨', 'tone', 'mood'], params: { hue: { label: '色相旋转°', min: -60, max: 60, step: 5, default: 10 }, sat: { label: '饱和度×', min: 0.4, max: 1.6, step: 0.05, default: 1.1 }, light: { label: '明度±', min: -0.2, max: 0.2, step: 0.02, default: 0 } } },
    match: (M) => M.length ? [{ id: 'materials', count: M.length, reason: `调整 ${M.length} 种材质的色调` }] : [],
    run(M, p) { const colors = {}; for (const m of M) { const [h, s, l] = rgb2hsl(hex2rgb(m.color)); colors[m.id] = rgb2hex(hsl2rgb([(h + p.hue / 360 + 1) % 1, Math.min(1, s * p.sat), Math.max(0, Math.min(1, l + p.light))])); } return { colors }; } },
  { meta: { id: 'scene.style-pack', domain: 'style', name: '套用风格包', does: '每种材质靠向风格包色板里最近的颜色（目前：莫里斯色板），把场景拉进同一个风格家族。',
      keywords: ['风格包', '莫里斯', '挂毯', '统一风格', '套用', 'morris', 'pack'], params: { strength: { label: '靠拢程度', min: 0.1, max: 1, step: 0.05, default: 0.5 } } },
    match: (M) => M.length ? [{ id: 'materials', count: M.length, reason: `莫里斯色板 ${PACKS.morris.length} 色` }] : [],
    run(M, p) { const pal = PACKS.morris.map(hex2rgb), colors = {}; for (const m of M) { const c = hex2rgb(m.color); let best = pal[0], bd = 9; for (const q of pal) { const d = dist(c, q); if (d < bd) { bd = d; best = q; } } colors[m.id] = rgb2hex(mix(c, best, p.strength)); } return { colors }; } },
];
export const describeGsceneCapabilities = () => GSCENE_CAPABILITIES.map((c) => ({ ...c.meta, tier: 'scene', kind2: 'style' }));
const paramsFor = (cap, given = {}) => { const o = {}; for (const [k, d] of Object.entries(cap.meta.params)) o[k] = Math.max(d.min, Math.min(d.max, Number(given[k] ?? d.default))); return o; };
export const matchGscene = (M) => GSCENE_CAPABILITIES.map((c) => { const t = c.match(M, paramsFor(c)); return { id: c.meta.id, count: t.reduce((a, x) => a + x.count, 0), targets: t }; });
export function runGscenePlan(M, steps) {
  let cur = M.map((m) => ({ ...m })); const report = [];
  for (const s of steps) {
    const cap = GSCENE_CAPABILITIES.find((c) => c.meta.id === s.id); if (!cap) { report.push({ id: s.id, status: 'missing' }); continue; }
    const params = paramsFor(cap, s.params), out = cap.run(cur, params);
    let n = 0; cur = cur.map((m) => { const c = out.colors[m.id]; if (c && c !== m.color) { n++; return { ...m, color: c }; } return m; });
    report.push({ id: s.id, status: n ? 'applied' : 'no-target', params, count: n, changed: out.note ? [out.note] : [] });
  }
  const colors = {}; for (const m of cur) if (m.color !== M.find((x) => x.id === m.id).color) colors[m.id] = m.color;
  return { colors, report, after: cur };
}
