/** 物件 · 验证（纯函数）：数值、改动范围、手工改动保留、位移预算、重叠不增加、不出界、隐藏数量不变。 */
import { overlaps, posOf } from './capabilities.js';
export function verifyObjects(layout, edits, { steps = [] } = {}) {
  const checks = [], add = (id, name, status, detail) => checks.push({ id, name, status, detail });
  const byId = new Map(layout.map((r) => [r.id, r])), ids = Object.keys(edits);
  const bad = ids.filter((id) => { const e = edits[id]; return !byId.has(id) || !['dx', 'dy', 'dz', 'ry', 's'].every((k) => Number.isFinite(e[k] ?? 0)) || e.s < 0.3 || e.s > 2.5; });
  add('values', '数值', bad.length ? 'fail' : 'pass', bad.length ? `${bad.length} 个物件的改动无效或超出编辑器范围（大小 30%–250%）` : `${ids.length} 个物件改动有效`);
  const outside = ids.filter((id) => byId.get(id)?.outOfScope);
  add('scope', '作用范围', outside.length ? 'fail' : 'pass', outside.length ? `${outside.length} 个范围外的物件被改动` : layout.some((r) => r.outOfScope) ? `只改了范围内的 ${ids.length} 个物件` : '整个场景');
  const allowEdited = steps.some((s) => s.params?.includeEdited);
  const lockedTouched = ids.filter((id) => byId.get(id)?.locked && !allowEdited);
  add('manual', '手工改动保留', lockedTouched.length ? 'fail' : 'pass', lockedTouched.length ? `${lockedTouched.length} 个你手工改过的物件被改动` : allowEdited ? '已明确允许改动手工改过的物件' : '手工改过的物件未动');
  const budget = Math.max(0.05, ...steps.map((s) => +s.params?.maxMove || 0)) + 1e-3;
  let maxMove = 0; for (const id of ids) { const r = byId.get(id); if (!r) continue; const [a, b] = posOf(r), [c, d] = posOf(r, edits[id]); maxMove = Math.max(maxMove, Math.hypot(a - c, b - d)); }
  add('move', '位移预算', maxMove > budget ? 'fail' : 'pass', `最大移动 ${maxMove.toFixed(2)}（上限 ${budget.toFixed(2)}）`);
  const o0 = overlaps(layout).count, o1 = overlaps(layout, edits).count;
  add('overlap', '占地重叠', o1 > o0 ? (o1 > o0 * 1.2 + 1 ? 'fail' : 'warn') : 'pass', `${o0} 对 → ${o1} 对`);
  const xs = layout.map((r) => posOf(r)), minX = Math.min(...xs.map((p) => p[0])) - 1, maxX = Math.max(...xs.map((p) => p[0])) + 1, minZ = Math.min(...xs.map((p) => p[1])) - 1, maxZ = Math.max(...xs.map((p) => p[1])) + 1;
  const out = ids.filter((id) => { const r = byId.get(id); if (!r) return false; const [x, z] = posOf(r, edits[id]); return x < minX || x > maxX || z < minZ || z > maxZ; });
  add('bounds', '不出场景', out.length ? 'fail' : 'pass', out.length ? `${out.length} 个物件移出原分布范围` : '都在原分布范围内');
  const hid = ids.filter((id) => !!edits[id].hidden !== !!byId.get(id)?.edit.hidden);
  add('hidden', '显示 / 隐藏', hid.length ? 'fail' : 'pass', hid.length ? `${hid.length} 个物件的隐藏状态被改` : '未改变');
  const status = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';
  return { status, checks, summary: checks.map((c) => `${c.name}${c.status === 'pass' ? '✓' : c.status === 'warn' ? '!' : '✗'}`).join(' '), changed: ids };
}
