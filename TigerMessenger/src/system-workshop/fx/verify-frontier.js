/**
 * 表现层 · 解锁前沿四条线的独立验证（R37–R39）。只拿 site + plan 重算，不信改造 Worker 的中间结果：
 *   火      点火处真在格网上、点火时刻不倒退；按 fire-coupling 重算 0.18s / 0.39s 火光并检查曲线单调；爆燃团张数复算
 *   走廊    用同一组选项独立重跑 planHallway，板的切分必须一致；板不重叠、覆盖整面墙；门在墙内
 *   沉积    不用改造侧的邻格索引，暴力重数崖面；每条层带按 bandType 重查岩性、层带首尾相接盖满崖高
 *   弹道    解析表：用 v / 仰角 / 时间按抛体公式独立求落点；烘表：看折线终点；弹道顶点不低于两端
 * 每条带 metric（数值 / 阈值 / 方向）的检查会被夜间重建收集，换算成补学队列的「指标差距分」（Guide §1.4 创新 5）。
 */
import { fireLight, smokeSizeMul, burstPlan } from '../../../../townscaper-web/REACodeRefactoring/src/life/fire-coupling.js';
import { planHallway } from '../../../../townscaper-web/REACodeRefactoring/src/core/doodle-hallway-layout.js';
import { bandType, BAND_SLOTS } from '../../../../townscaper-web/REACodeRefactoring/src/core/sediment-bands-c09.js';
import { sedimentOffset } from '../../../../townscaper-web/REACodeRefactoring/src/core/sediment.js';
import { PROJECTILE_GRAVITY } from '../../../../townscaper-web/REACodeRefactoring/src/core/ballistic-table.js';

const near = (a, b, e = 1e-3) => Math.abs(a - b) <= e;
const cellAt = (grid, x, z) => grid.find((c) => near(c[0], x) && near(c[1], z));

export function verifyFrontier(site, plan, ran, add) {
  const grid = site.grid;
  if (ran.has('fx.fire')) {
    const f = plan.fire;
    if (!f?.sources?.length) add('fire-sources', '点火处', 'fail', '计划里没有点火处', ['fx.fire']);
    else {
      const onGrid = f.sources.every((s) => { const c = cellAt(grid, s.x, s.z); return c && c[2] === s.lv && (!s.house || c[3]); });
      const mono = f.sources.every((s, i) => !i || s.t0 >= f.sources[i - 1].t0);
      add('fire-sources', '点火处在格网上', onGrid && mono ? 'pass' : 'fail', `${f.sources.length} 处 · ${onGrid ? '都在格网上' : '有点火处不在格网上'} · 点火时刻${mono ? '依次' : '倒退'}`, ['fx.fire']);
      const a = fireLight(0.18), b = fireLight(0.39), curveOk = (f.curve || []).every((c, i, arr) => !i || (c[1] <= arr[i - 1][1] + 1e-9 && c[2] >= arr[i - 1][2] - 1e-9)) && (f.curve || []).length > 10;
      const sameSm = (f.curve || []).slice(0, 12).every((c) => near(c[2], smokeSizeMul(c[0]), 2e-4));
      add('fire-curve', '火光衰减与烟放大', near(a, f.at018) && near(b, f.at039) && curveOk && sameSm ? (b <= 0.35 ? 'pass' : 'warn') : 'fail',
        `0.18s ${a.toFixed(3)}（计划 ${f.at018}）· 0.39s ${b.toFixed(3)}（计划 ${f.at039}）· 曲线${curveOk ? '单调' : '不单调'}`, ['fx.fire'],
        { name: '0.39s 火光残留', value: +b.toFixed(4), threshold: 0.35, direction: 'max', unit: '相对峰值' });
      const bp = burstPlan();
      add('fire-burst', '爆燃团分层', f.burst?.total === bp.total && f.burst?.layers === bp.layers.length ? 'pass' : 'warn', `${f.burst?.total ?? 0} 张 / ${f.burst?.layers ?? 0} 层（复算 ${bp.total} / ${bp.layers.length}）`, ['fx.fire']);
    }
  }
  if (ran.has('fx.hallway')) {
    const h = plan.hallway;
    if (!h?.panels?.length) add('hallway-plan', '走廊版式', 'fail', '计划里没有走廊板', ['fx.hallway']);
    else {
      let same = false; try { const p = planHallway(h.options); same = p.panels.length === h.panels.length && p.panels.every((q, i) => near(q.s0, h.panels[i].s0) && near(q.s1, h.panels[i].s1)); } catch { same = false; }
      add('hallway-plan', '版式可独立复算', same ? 'pass' : 'fail', `${h.panels.length} 块板 · 独立重算${same ? '一致' : '不一致'}`, ['fx.hallway']);
      const ps = [...h.panels].sort((a, b) => a.s0 - b.s0), overlap = ps.some((q, i) => i && q.s0 < ps[i - 1].s1 - 1e-6);
      const span = ps.length && near(ps[0].s0, 0, 1e-2) && near(ps.at(-1).s1, h.S, 1e-2), cov = (ps.reduce((s, q) => s + (q.s1 - q.s0), 0) + (h.stripWidth || 0)) / (h.S || 1);
      const doorIn = !h.door || (h.door.s0 > 0 && h.door.s1 < h.S);
      add('hallway-cover', '板覆盖整面墙', !overlap && span && doorIn ? (cov >= 0.98 ? 'pass' : 'warn') : 'fail', `覆盖 ${(cov * 100).toFixed(1)}% · ${overlap ? '有重叠' : '无重叠'} · 门${doorIn ? '在墙内' : '出界'}`, ['fx.hallway'],
        { name: '走廊板覆盖率', value: +cov.toFixed(4), threshold: 0.98, direction: 'min', unit: '比例' });
      const c = cellAt(grid, h.host?.x, h.host?.z);
      add('hallway-host', '样板落点', c ? 'pass' : 'fail', c ? `格 (${h.host.x}, ${h.host.z}) · ${h.host.lv} 层` : '落点不在格网上', ['fx.hallway']);
    }
  }
  if (ran.has('fx.sediment')) {
    const s = plan.sediment;
    if (!s?.faces?.length) add('sediment-faces', '崖面', 'warn', '计划里没有崖面（舞台可能没有高崖）', ['fx.sediment']);
    else {
      // 暴力重数：两格中心距 ≤ 1.25 × 格距（= 2 × half）且落差 ≥ minDrop
      const sp = Number.isFinite(s.spacing) ? s.spacing : s.half * 2; let total = 0;
      for (let i = 0; i < grid.length; i++) for (let j = 0; j < grid.length; j++) { if (i === j) continue; const d = Math.hypot(grid[i][0] - grid[j][0], grid[i][1] - grid[j][1]); if (d > 1e-9 && d <= sp * 1.25 && grid[i][2] - grid[j][2] >= s.minDrop) total++; }
      add('sediment-faces', '崖面可独立重数', total === s.total ? 'pass' : 'fail', `计划 ${s.total} 面 · 暴力重数 ${total} 面`, ['fx.sediment']);
      let bad = 0, gaps = 0;
      for (const f of s.faces.slice(0, 200)) {
        const shear = s.bend ? sedimentOffset(f.x, f.z, s.amplitude) : 0;
        if (!near(f.bands[0]?.[1], f.y0) || !near(f.bands.at(-1)?.[2], f.y1)) gaps++;
        f.bands.forEach((b, i) => { if (i && !near(b[1], f.bands[i - 1][2])) gaps++; const k = Math.floor(((b[1] + b[2]) / 2 + shear) / s.period * BAND_SLOTS); if (bandType(k) !== b[0]) bad++; });
      }
      add('sediment-bands', '层带岩性与首尾', !bad && !gaps ? 'pass' : 'fail', `岩性不符 ${bad} 条 · 断缝 ${gaps} 处（抽查 ${Math.min(200, s.faces.length)} 面）`, ['fx.sediment']);
      const cv = s.stats?.widthCv ?? 0;
      add('sediment-variety', '层带宽窄相间', cv >= 0.3 ? 'pass' : 'warn', `带宽变异系数 ${cv}（≥ 0.3 才不是均匀斑马纹）`, ['fx.sediment'],
        { name: '层带宽度变异系数', value: cv, threshold: 0.3, direction: 'min', unit: '' });
    }
  }
  if (ran.has('fx.projectiles')) {
    const p = plan.projectiles;
    if (!p?.shots?.length) add('projectile-hit', '弹道', 'warn', '计划里没有弹道（射程内没有岸边落点）', ['fx.projectiles']);
    else {
      const u = p.unit || 1; let worst = 0, arcBad = 0, endBad = 0;
      for (const s of p.shots) {
        let miss;
        if (p.table === 'analytic') {
          // 抛体公式独立求 T = time 时的位置（格单位），与目标比
          const ay = s.a[1] / u, by = s.b[1] / u, y = ay + s.v * Math.sin(s.th) * s.time - 0.5 * PROJECTILE_GRAVITY * s.time * s.time;
          const hx = s.v * Math.cos(s.th) * s.time, dx = Math.hypot(s.b[0] - s.a[0], s.b[2] - s.a[2]) / u;
          miss = Math.hypot(y - by, hx - dx);
        } else { const e = s.path.at(-1); miss = Math.hypot(e[0] - s.b[0], e[1] - s.b[1], e[2] - s.b[2]) / u; }
        worst = Math.max(worst, miss);
        if (Math.max(...s.path.map((q) => q[1])) < Math.max(s.a[1], s.b[1]) - 1e-6) arcBad++;
        const c = grid[s.to]; if (!c || !near(c[0], s.b[0]) || !near(c[1], s.b[2])) endBad++;
      }
      add('projectile-hit', '落点命中', endBad ? 'fail' : worst <= 0.06 ? 'pass' : 'fail', `${p.shots.length} 支 · 最大偏差 ${worst.toFixed(4)} 格（限 0.06）· 落点不在岸格 ${endBad}`, ['fx.projectiles'],
        { name: '弹道最大落点偏差', value: +worst.toFixed(4), threshold: 0.06, direction: 'max', unit: '格' });
      add('projectile-arc', '弹道是弧', arcBad ? 'fail' : 'pass', arcBad ? `${arcBad} 条弹道顶点低于端点` : '每条弹道顶点都不低于两端', ['fx.projectiles']);
    }
  }
}
