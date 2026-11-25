/**
 * 地貌管线 · 独立验证（R46）。不相信改造 Worker 的输出：从 site（原采样）和 plan（候选）重新算，至少一条会在结果被破坏时判失败。
 *   硬检查（fail）：作用在本场景、不写存档 / 默认、步骤与计划一致、保护格（建筑 / 轨道及外扩 1 圈）一格不动、海陆不变、
 *                   填洼后没有排不出去的坑（有河谷时）、河格沿出口树不上坡、岩檐几何（檐下是空的、不在保护格上）、
 *                   梯子几何（梯脚落在下层台面、梯顶搭上层台沿、梯长 = √(落差² + run²)）、等高线全在格边上且与复算一致。
 *   提示（warn）：竖崖占比超过 12%（高山圣城同一阈值）、最大可走连通片低于 60%。
 */
import { protectRing } from '../../../../townscaper-web/REACodeRefactoring/src/terrain/overhang-terrain.js';
import { drainShare } from '../../../../townscaper-web/REACodeRefactoring/src/terrain/river-valley.js';
import { contourSegs, rowsOf } from '../../../../townscaper-web/REACodeRefactoring/src/terrain/island-passes.js';
import { walkComponents } from '../../../../townscaper-web/REACodeRefactoring/src/terrain/terrace-ladder.js';
import { RELIEF_ORDER } from './capabilities.js';
import { reliefMetrics, pitIds } from '../terrain/arena-generic.js';

const land = (v) => Number.isFinite(v) && v > 0;
const row = (id, name, passed, detail, level = passed ? 'pass' : 'fail') => ({ id, name, passed, status: level, detail });

export function verifyRelief(site, plan, { steps = [], scene = null } = {}) {
  const checks = [];
  if (!site?.n || !plan?.h) return { status: 'fail', checks: [row('input', '有采样和计划', false, '缺 site 或 plan')] };
  const n = site.n, N = n * n, h = plan.h.map((v) => (v == null ? NaN : v)), base = site.h.map((v) => (land(v) ? v : NaN));
  checks.push(row('scene', '作用在本场景', !scene || plan.scene === scene, `计划 ${plan.scene || '—'} · 当前 ${scene || '—'}`));
  checks.push(row('persist', '不写存档 / 不改默认', plan.persist === false, 'plan.persist = ' + plan.persist));
  const want = RELIEF_ORDER.filter((id) => steps.some((s) => s.id === id) && (plan.applied || []).includes(id));
  checks.push(row('steps', '步骤与计划一致', JSON.stringify(want) === JSON.stringify(plan.applied || []) && (plan.applied || []).every((id) => steps.some((s) => s.id === id)), `计划 ${(plan.applied || []).join(' → ') || '（空）'}`));
  checks.push(row('size', '高度场大小', plan.h.length === N && plan.n === n, `${plan.h.length} / ${N}`));
  // 保护格
  const p = new Uint8Array(N); for (let k = 0; k < N; k++) if (site.cls?.[k]) p[k] = 1;
  const lock = protectRing(n, p, 1); let moved = 0, worst = 0;
  for (let k = 0; k < N; k++) if (lock[k] && land(base[k])) { const d = Math.abs((h[k] || 0) - base[k]); if (d > 1e-3) { moved++; worst = Math.max(worst, d); } }
  checks.push(row('protect', '建筑 / 轨道及外扩 1 圈不动', moved === 0, moved ? `${moved} 格被改，最多 ${worst.toFixed(2)} m` : `保护格 ${lock.reduce((s, v) => s + v, 0)} 个，全部原样`));
  let coast = 0; for (let k = 0; k < N; k++) if (land(base[k]) !== land(h[k])) coast++;
  checks.push(row('coast', '海陆不变（海岸线）', coast === 0, coast ? `${coast} 格海陆变了` : '海陆格一致'));
  // 河谷
  if (plan.valley) {
    // 保护格（建筑 / 轨道及外扩 1 圈）一格不动是硬保证：环内原始微坑（< 一层的洼地）管线无权抬，
    // 「没坑」只考可改陆地——锁定格里的坑如实写进 detail，不算失败。
    const pits = pitIds(h, n).filter((id) => !lock[id]).length, lockedPits = pitIds(h, n).length - pits, share = drainShare(h, n);
    checks.push(row('drain', '可改陆地填洼后没有排不出去的坑', pits === 0, `可改区会被再次抬起的格 ${pits} · 保护环内原始微坑 ${lockedPits}（不可改） · 排水率 ${(share * 100).toFixed(1)}%`));
    let up = 0; const riv = new Set(plan.valley.river);
    for (const id of plan.valley.river) { const i = id % n, j = (id - i) / n; let lower = false; for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a < 0 || b < 0 || a >= n || b >= n) { lower = true; break; } const q = b * n + a; if (!land(h[q]) || h[q] <= h[id] + 1e-6) { lower = true; break; } } if (!lower) up++; }
    checks.push(row('river', '河格都有不上坡的去处', up === 0 && riv.size === plan.valley.river.length, up ? `${up} 个河格四邻都比它高` : `河格 ${riv.size} 个`));
  }
  // 岩檐
  if (plan.lips?.length) {
    let bad = 0;
    for (const l of plan.lips) {
      const k = l.j * n + l.i, kb = (l.j + l.dj) * n + (l.i + l.di), under = land(h[kb]) ? h[kb] : 0;
      if (lock[k] || lock[kb] || Math.abs(h[k] - l.top) > 1e-3 || !(l.bottom > under + 0.5) || !(l.top > l.bottom) || !(l.reach > 0 && l.reach < 1)) bad++;
    }
    checks.push(row('lips', '岩檐：檐下是空的、不在保护格上', bad === 0, bad ? `${bad} / ${plan.lips.length} 块岩檐几何不对` : `${plan.lips.length} 块岩檐`));
  }
  // 梯子
  if (plan.ladders?.length) {
    let bad = 0;
    for (const l of plan.ladders) {
      const drop = h[l.b] - h[l.a];
      if (Math.abs(l.low - h[l.a]) > 1e-3 || Math.abs(l.high - h[l.b]) > 1e-3 || Math.abs(l.drop - drop) > 1e-2 || Math.abs(l.L - Math.hypot(drop, l.run)) > 1e-2 || l.footErr > 1e-9 || l.lipDist > 1e-9 || site.cls?.[l.a] || site.cls?.[l.b]) bad++;
    }
    checks.push(row('ladders', '梯子：梯脚在下层台面、梯顶搭上层台沿、梯长 = √(H²+run²)', bad === 0, bad ? `${bad} / ${plan.ladders.length} 把不对` : `${plan.ladders.length} 把`));
  }
  // 等高线
  if (plan.contours) {
    const segs = contourSegs(rowsOf(h, n, 0), { WATER: 0, STEP: plan.contours.step }), onGrid = plan.contours.segs.every((s) => s.slice(0, 4).every(Number.isInteger));
    checks.push(row('contours', '等高线在格边上且与复算一致', onGrid && segs.length === plan.contours.segs.length, `复算 ${segs.length} 段 · 计划 ${plan.contours.segs.length} 段`));
  }
  // 指标（提示）
  const m = reliefMetrics({ n, cell: site.cell || 3, h, base, cls: site.cls, lips: plan.lips, ladders: plan.ladders });
  checks.push(row('cliff-share', '竖崖占比 ≤ 12%', m.cliff <= 0.12, `竖崖（> 62°）${(m.cliff * 100).toFixed(1)}% · 中等坡 ${(m.midSlope * 100).toFixed(1)}%`, m.cliff <= 0.12 ? 'pass' : 'warn'));
  const blocked = Uint8Array.from(site.cls || [], (c) => (c ? 1 : 0)), w = walkComponents(h, n, { cell: site.cell || 3, walkSlope: 35, blocked, links: (plan.ladders || []).map((l) => [l.a, l.b]) });
  checks.push(row('reach', '最大可走连通片 ≥ 60%', w.share >= 0.6, `最大连通片 ${(w.share * 100).toFixed(1)}%（${w.components} 片）`, w.share >= 0.6 ? 'pass' : 'warn'));
  const status = checks.some((c) => c.status === 'fail') ? 'fail' : checks.some((c) => c.status === 'warn') ? 'warn' : 'pass';
  const summary = checks.map((c) => `${c.name}${c.status === 'fail' ? '✗' : c.status === 'warn' ? '!' : '✓'}`).join(' ');
  return { status, checks, metrics: m, summary };
}
