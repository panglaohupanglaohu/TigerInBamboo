/**
 * 物件工坊的能力代码。作用对象是「物件布局」：每个可编辑物件的位置、朝向、大小（object-edits.js 的增量）。
 *   layout 行：{ id, kind, name, x, z, r（占地半径）, edit:{dx,dy,dz,ry,s,hidden}, locked（你手工改过 → 默认不碰）}
 *   match(layout, params) → [{ id, count, reason }]    run(layout, params) → { edits: { id: 绝对增量 }, touched: [id] }
 * 纯数据，在物件改造 Worker 里执行；related 是学习库里方法相近的视频（目录里的节点）。
 * 作用范围：在实景里选中物件后，范围外的行带 outOfScope，能力只改范围内的物件（范围外的当障碍）。
 */
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return ((h >>> 0) % 100000) / 100000; };
const KIND = { 'plane-tree': '悬铃树', cypress: '柏树', hollyhock: '蜀葵花丛' };
const kindName = (k) => KIND[k] || k;
export const posOf = (row, e = row.edit) => [row.x + (e.dx || 0), row.z + (e.dz || 0)];
export const radiusOf = (row, e = row.edit) => row.r * (e.s ?? 1);
export function overlaps(layout, edits = {}, factor = 0.8, involving = null) {
  const live = layout.filter((r) => !(edits[r.id] || r.edit).hidden); let n = 0; const pairs = [];
  for (let i = 0; i < live.length; i++) for (let j = i + 1; j < live.length; j++) {
    const a = live[i], b = live[j], ea = edits[a.id] || a.edit, eb = edits[b.id] || b.edit, [ax, az] = posOf(a, ea), [bx, bz] = posOf(b, eb);
    if (involving && !involving(a) && !involving(b)) continue;
    if (Math.hypot(ax - bx, az - bz) < (radiusOf(a, ea) + radiusOf(b, eb)) * factor) { n++; if (pairs.length < 50) pairs.push([a.id, b.id]); }
  }
  return { count: n, pairs };
}
const groups = (layout, p) => { const g = new Map(); for (const r of layout) if (!r.edit.hidden && !r.outOfScope && (p.includeEdited || !r.locked)) { if (!g.has(r.kind)) g.set(r.kind, []); g.get(r.kind).push(r); } return [...g].filter(([, rows]) => rows.length >= (layout.some((r) => r.outOfScope) ? 1 : 3)); };

export const OBJECT_CAPABILITIES = [
  { meta: { id: 'object.scale-variety', domain: 'variant', name: '同类尺寸变化', does: '同一种物件（如一排悬铃树）给出稳定的大小差异，不再一模一样。按物件 ID 取种子，重跑结果不变。',
      keywords: ['大小', '尺寸', '变化', '多样', '一样', '单调', '自然', 'scale'], related: ['1580158269267406849', '847717312912211970'],
      params: { amount: { label: '变化幅度', min: 0.05, max: 0.35, step: 0.05, default: 0.15 }, includeEdited: { label: '包含手工改过的', type: 'bool', default: false } } },
    match: (L, p) => groups(L, p).map(([k, rows]) => ({ id: k, count: rows.length, reason: `${kindName(k)} ${rows.length} 个，${new Set(rows.map((r) => r.edit.s.toFixed(2))).size === 1 ? '大小完全一样' : '大小已有差异'}` })),
    run: (L, p) => { const edits = {}; for (const [, rows] of groups(L, p)) for (const r of rows) edits[r.id] = { ...r.edit, s: +(1 + p.amount * (hash(r.id + ':s') * 2 - 1)).toFixed(3) }; return { edits }; } },
  { meta: { id: 'object.yaw-variety', domain: 'variant', name: '朝向变化', does: '同类物件随机转一个稳定的角度，避免同一张脸朝同一方向。',
      keywords: ['朝向', '旋转', '角度', '变化', '多样', '单调', 'rotate'], related: ['1580158269267406849'],
      params: { degrees: { label: '最大角度', min: 10, max: 180, step: 10, default: 90 }, includeEdited: { label: '包含手工改过的', type: 'bool', default: false } } },
    match: (L, p) => groups(L, p).map(([k, rows]) => ({ id: k, count: rows.length, reason: `${kindName(k)} ${rows.length} 个，${rows.filter((r) => r.edit.ry).length} 个转过角度` })),
    run: (L, p) => { const edits = {}; for (const [, rows] of groups(L, p)) for (const r of rows) edits[r.id] = { ...r.edit, ry: +(r.edit.ry + (hash(r.id + ':r') - 0.5) * 2 * p.degrees * Math.PI / 180).toFixed(4) }; return { edits }; } },
  { meta: { id: 'object.spacing-relax', domain: 'placement', name: '间距松弛', does: '占地互相压住的物件沿水平面轻推开（每个最多移动设定距离），手工改过的物件不动、当作障碍。',
      keywords: ['间距', '拥挤', '重叠', '挤', '分开', '疏', '松', 'spacing', 'overlap'], related: ['797844857821732864', '1764958522398146667'],
      params: { maxMove: { label: '最大移动', min: 0.05, max: 1, step: 0.05, default: 0.35 }, includeEdited: { label: '包含手工改过的', type: 'bool', default: false } } },
    match: (L) => { const o = overlaps(L, {}, 0.8, L.some((r) => r.outOfScope) ? (r) => !r.outOfScope : null); return o.count ? [{ id: 'overlap', count: o.count, reason: `${o.count} 对物件占地互相压住（中心距 < 两者半径和的 80%）` }] : []; },
    run: (L, p) => {
      const pos = new Map(L.map((r) => [r.id, posOf(r)])), start = new Map([...pos].map(([k, v]) => [k, [...v]]));
      const movable = (r) => !r.edit.hidden && !r.outOfScope && (p.includeEdited || !r.locked);
      for (let it = 0; it < 24; it++) for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) {
        const a = L[i], b = L[j]; if (a.edit.hidden || b.edit.hidden) continue;
        const pa = pos.get(a.id), pb = pos.get(b.id), want = (radiusOf(a) + radiusOf(b)) * 0.82;
        let dx = pb[0] - pa[0], dz = pb[1] - pa[1], d = Math.hypot(dx, dz); if (d >= want) continue;
        if (d < 1e-6) { dx = hash(a.id + b.id) - 0.5; dz = 0.5 - hash(b.id + a.id); d = Math.hypot(dx, dz); }
        const push = (want - d) / 2, ma = movable(a), mb = movable(b); if (!ma && !mb) continue;
        const ka = ma ? (mb ? 1 : 2) : 0, kb = mb ? (ma ? 1 : 2) : 0;
        pa[0] -= dx / d * push * ka; pa[1] -= dz / d * push * ka; pb[0] += dx / d * push * kb; pb[1] += dz / d * push * kb;
        for (const [r, q] of [[a, pa], [b, pb]]) { const s = start.get(r.id), m = Math.hypot(q[0] - s[0], q[1] - s[1]); if (m > p.maxMove) { q[0] = s[0] + (q[0] - s[0]) * p.maxMove / m; q[1] = s[1] + (q[1] - s[1]) * p.maxMove / m; } }
      }
      const edits = {};
      for (const r of L) { const q = pos.get(r.id), s = start.get(r.id); if (Math.hypot(q[0] - s[0], q[1] - s[1]) > 1e-4) edits[r.id] = { ...r.edit, dx: +(q[0] - r.x).toFixed(4), dz: +(q[1] - r.z).toFixed(4) }; }
      return { edits };
    } },
];
export const describeObjectCapabilities = () => OBJECT_CAPABILITIES.map((c) => ({ ...c.meta, tier: 'object', kind2: 'edit' }));
export function paramsFor(cap, given = {}) { const o = {}; for (const [k, d] of Object.entries(cap.meta.params)) o[k] = d.type === 'bool' ? !!(given[k] ?? d.default) : Math.max(d.min, Math.min(d.max, Number(given[k] ?? d.default))); return o; }
export function matchObjects(layout) { return OBJECT_CAPABILITIES.map((c) => { const t = c.match(layout, paramsFor(c)); return { id: c.meta.id, count: t.reduce((a, x) => a + x.count, 0), targets: t }; }); }
/** 按顺序执行；后一步看到前一步的结果 */
export function runObjectPlan(layout, steps) {
  let L = layout.map((r) => ({ ...r, edit: { ...r.edit } })); const all = {}, report = [];
  for (const s of steps) {
    const cap = OBJECT_CAPABILITIES.find((c) => c.meta.id === s.id); if (!cap) { report.push({ id: s.id, status: 'missing' }); continue; }
    const params = paramsFor(cap, s.params), { edits } = cap.run(L, params), ids = Object.keys(edits);
    for (const id of ids) all[id] = edits[id];
    L = L.map((r) => (edits[r.id] ? { ...r, edit: edits[r.id] } : r));
    report.push({ id: s.id, status: ids.length ? 'applied' : 'no-target', params, count: ids.length, focus: ids.slice(0, 40) });
  }
  return { edits: all, report };
}
