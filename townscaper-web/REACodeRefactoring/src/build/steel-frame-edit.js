/** 1189902695303458816「钢架编辑」残差收口（机制层；r204 补学批）。
 * 原片（296帧 0–295 全核，sheet00–02 + review-observations.json）：
 *   f0–21   低层庭院与绿色楼体编辑，抬高局部房屋；
 *   f22–37  移除高屋下方楼层 → 深色钢架腿与横梁显露；
 *   f38–169 两座高屋悬空，继续搭建/移除上部并绕转看斜撑与跨接；
 *   f170–295 上部体量/屋顶多次改变，长钢柱、横梁、斜撑与庭院互连，柱子落更低体块屋面。
 * 语义：钢架不是单独摆放的构件，是体素状态的导出几何——任何一次楼层编辑让某段楼体
 * 变成「悬空段」（本层建筑、下一层空、无对边拱支撑），它底下的长钢柱 + 横梁/斜撑就显露；
 * 补回楼板（悬空消失）骨架即藏。几何规则（落点=共享角格最高实心层、曲柄腿落屋面、
 * 簇约束求解系杆层、Y 撑、接头、爬梯）全部复用 steel-r56.emitSteelFrame——本文件用记录式
 * writer 把同一套产出收成线段清单，不第二遍重写算法，也不冒充原版 378 模块 WFC。
 *
 * 本文件补的三层（纯函数、确定性、Node/浏览器通用）：
 *   ① collectSteelJobs / steelFramePlan  当前体素态下的钢架模块清单：job 判定与
 *     buildings.js underside 同口径（runBottom = 建筑层且下层空；方格对边邻居在下层
 *     都实心 → 拱不入钢架；三角格没有对边 → 恒钢架）。
 *   ② planSteelReveal  「编辑/移除楼层」显露判定的纯预览：编辑先在暂存列上整组验证，
 *     逐条推进并逐步 diff 出显露/隐藏的杆件清单——哪些动作露、露多少
 *     （reveal / hide / mixed / none + 按杆件类计数）。不碰原 World。
 *   ③ commitSteelReveal / withdrawSteelReveal  整组事务：commitModulePatch（fit，
 *     mapping=被编辑列）先过 socket 边界收集 + 周围 WFC 补网 + stale-version 校验——
 *     任一失败原 World 原样返回；再原子写体素（先在暂存列全量验证）；
 *     withdrawModulePatch 按回执快照整组撤回，钢架随体素藏回。
 *     边界如实：fit 事务层不写模块格体素（placeModuleVolume 只增不减、tileColumn 跳过
 *     模块格），楼层增减写在本层原子段；撤回仍由事务回执快照保证——快照先于一切写入，
 *     fit 恢复 = 字段整列还原（含本层写入与非模块格 tileColumn 写入）。
 *   · frameCollisions  碰撞清单口径审计：杆件是否穿过实心体素内部；命中时报告是否压到
 *     「可走面」（顶面岩石列，与 module-patch-commit 的 columnState 同口径）。
 * 残差边界：原版 378 模块 WFC 目录逐件选钢架未复原（作者手工资产不在仓内）；
 *   本仓长柱/系杆为本地离散规则等价——与 1257213678056857600 条目同口径的既定边界。
 *   WFC 求解式钢架（layerGrid / layeredJointCatalog 可承接）属后续可选工作，不是本项缺口。
 */
import { MAX_LEVEL } from '../core/world.js';
import { pointInQuad } from '../core/spatial.js';
import { commitModulePatch, withdrawModulePatch } from './module-patch-commit.js';
import { emitSteelFrame } from './steel-r56.js';

const FIELDS = ['solid', 'rock', 'color', 'river'];
/* emitSteelFrame 的杆件半径即语义（steel-r56.js 顶部常量）：0.045 柱/曲柄腿、0.035 楼板下头梁、
 * 0.032 系杆横杆、0.022 Y 形/头部斜撑、0.014 爬梯侧轨、0.009 梯档。 */
const KIND_BY_R = [[0.045, 'column'], [0.035, 'beam'], [0.032, 'tie'], [0.022, 'brace'], [0.014, 'ladder-rail'], [0.009, 'ladder-rung']];
const kindOf = (r) => KIND_BY_R.find(([v]) => Math.abs(v - r) < 1e-4)?.[1] ?? 'other';

/**
 * 与 buildings.js underside 同口径的钢架 job 收集：
 * 本层是建筑（实心且非岩石）、lv>1、下一层空（runBottom），且该段不是拱——
 * 方格有一组对边邻居在 lv-1 都实心 → 拱，不入钢架；三角格没有对边 → 恒钢架。
 * @returns {{c:Cell, lv:number}[]} 按 cells 序、lv 升序
 */
export function collectSteelJobs(world) {
  const jobs = [];
  for (const c of world.cells) {
    const h = world.top(c);
    for (let lv = 2; lv <= h; lv++) {
      if (!world.isBuilt(c, lv) || world.isSolid(c, lv - 1)) continue;
      const below = lv - 1;
      const arch = c.n === 4 && [0, 1].some((i) => {
        const a = world.neighbor(c, i), b = world.neighbor(c, i + 2);
        return a !== null && b !== null && world.isSolid(a, below) && world.isSolid(b, below);
      });
      if (!arch) jobs.push({ c, lv });
    }
  }
  return jobs;
}

/** 记录式 writer：emitSteelFrame 只调 beam / box / at；K 三个色标只是透传标识。 */
function steelRecorder() {
  const segments = [], boxes = [];
  const w = {
    at() {}, c: (v) => v,
    beam(a, b, r, _col, shade) { segments.push({ kind: kindOf(r), a: [...a], b: [...b], r, shade }); },
    box(x, y, z, sx, sy, sz, _col, shade) { boxes.push({ kind: sy > 0.08 ? 'pad' : 'joint', p: [x, y, z], s: [sx, sy, sz], shade }); },
  };
  return { w, segments, boxes };
}

/**
 * 当前体素态的钢架模块清单。jobs 缺省 = collectSteelJobs（与渲染管线同口径）。
 * 返回 { jobs, legs, bays, clusters, ladders, posts, segments, boxes, stats }：
 *  segments = 每根杆件 {kind: column|beam|tie|brace|ladder-*, a,b,r}；boxes = 接头箍/红色垫块；
 *  stats   = {columns, ties, braces, joints, cranks, ladders}（emitSteelFrame 同源统计）。
 */
export function steelFramePlan(world, { L = 0.5, crank, maxGap, jobs = null } = {}) {
  const list = jobs ?? collectSteelJobs(world);
  const { w, segments, boxes } = steelRecorder();
  const posts = [];
  const st = emitSteelFrame(w, world, list, {
    L, K: { steel: 'steel', band: 'band', rail: 'rail' }, posts,
    ...(crank !== undefined ? { crank } : {}), ...(maxGap !== undefined ? { maxGap } : {}),
  });
  return {
    jobs: list, legs: st.legs, bays: st.bays, clusters: st.clusters, ladders: st.ladders, posts, segments, boxes,
    stats: { columns: st.legs.length, ties: st.ties, braces: st.braces, joints: st.joints, cranks: st.cranks, ladders: st.ladders.length },
  };
}

/* ---- 杆件身份：无向线段，端点排序 + 1e-4 取整（同一体素态 → 同一组键，可逐步 diff） ---- */
const r4 = (v) => Math.round(v * 1e4) / 1e4;
export function segmentKey(s) {
  const a = s.a.map(r4).join(','), b = s.b.map(r4).join(',');
  return s.kind + '|' + (a < b ? a + '-' + b : b + '-' + a);
}
const boxKey = (b) => b.kind + '|' + b.p.map(r4).join(',') + '|' + b.s.map(r4).join(',');
const planKeys = (p) => [...p.segments.map(segmentKey), ...p.boxes.map(boxKey)];

/** 两份计划的多重集 diff：revealed = after 新增杆件键，hidden = before 有 after 无。 */
export function planDiff(before, after) {
  const count = (list) => { const m = new Map(); for (const k of list) m.set(k, (m.get(k) ?? 0) + 1); return m; };
  const A = count(planKeys(before)), B = count(planKeys(after));
  const revealed = [], hidden = [];
  for (const [k, n] of B) for (let i = n - (A.get(k) ?? 0); i > 0; i--) revealed.push(k);
  for (const [k, n] of A) for (let i = n - (B.get(k) ?? 0); i > 0; i--) hidden.push(k);
  const byKind = (list) => { const m = {}; for (const k of list) { const t = k.split('|')[0]; m[t] = (m[t] ?? 0) + 1; } return m; };
  return { revealed, hidden, revealedByKind: byKind(revealed), hiddenByKind: byKind(hidden) };
}

/* ---- 楼层编辑 = 体素位写。一条编辑步 = 一组原子位写（复合动作用 ops 打包，如抬高=先移后加）。
 * 位写语义同 World.setSolid(cell,lv,on)（非岩石）：on=true 置位；off 清位；岩石位一律清。 */
export function normalizeSteelEdits(world, edits) {
  if (!Array.isArray(edits) || !edits.length) return { ok: false, reason: 'edits', detail: '至少一条编辑步' };
  const steps = [];
  for (const raw of edits) {
    const ops = raw?.ops ?? (raw && typeof raw === 'object' && (raw.cell !== undefined || raw.cellId !== undefined) ? [raw] : null);
    if (!Array.isArray(ops) || !ops.length) return { ok: false, reason: 'edit', detail: '编辑步缺 ops' };
    const out = [];
    for (const op of ops) {
      const id = typeof op.cell === 'object' && op.cell !== null ? op.cell.id : (op.cell ?? op.cellId);
      const levels = Array.isArray(op.level) ? op.level : [op.level ?? op.lv];
      if (!Number.isInteger(id) || id < 0 || id >= world.cells.length) return { ok: false, reason: 'edit', detail: 'cell 越界' };
      if (typeof op.on !== 'boolean') return { ok: false, reason: 'edit', detail: 'on 需布尔' };
      if (op.color !== undefined && (!Number.isInteger(op.color) || op.color < -1 || op.color > 30)) return { ok: false, reason: 'edit', detail: 'color 越界（v5 调色板 0..30，-1=未上色）' };
      for (const lv of levels) {
        if (!Number.isInteger(lv) || lv < 1 || lv > MAX_LEVEL) return { ok: false, reason: 'edit', detail: 'level 越界（1..' + MAX_LEVEL + '）' };
        out.push({ cell: id, level: lv, on: op.on, ...(op.color !== undefined ? { color: op.color } : {}) });
      }
    }
    steps.push({ label: raw.label ?? null, ops: out });
  }
  return { ok: true, steps };
}

/** 暂存视图：字段整列切片（原 World 位不动），方法走原型；regions 缓存作废按新位重算。 */
export function stagedWorld(world) {
  const v = Object.create(world);
  for (const k of FIELDS) v[k] = world[k].slice();
  v._regions = null; v._regionsVersion = -1;
  return v;
}

/** 把已校验的编辑步写进一个视图（stagedWorld 或真 World）。返回位写条数。 */
export function applySteelEdits(view, steps) {
  let writes = 0;
  for (const step of steps) for (const op of step.ops) {
    const bit = 1 << (op.level - 1);
    view.solid[op.cell] = op.on ? view.solid[op.cell] | bit : view.solid[op.cell] & ~bit;
    view.rock[op.cell] &= ~bit;                       // setSolid 非岩石语义：编辑层永远不是岩石
    if (op.on && op.color !== undefined) view.color[op.cell] = op.color;
    writes++;
  }
  return writes;
}

/**
 * 「编辑/移除楼层」显露判定的纯预览：不碰原 World。
 * 逐条编辑步在暂存列上推进，每步与上一步的钢架计划 diff：
 *   kind = reveal（只增）/ hide（只减）/ mixed / none；
 *   revealedByKind / hiddenByKind = 按杆件类的「露多少」；
 *   jobs = 该步之后的悬空段数。
 * 返回 {ok, before, after, steps, revealed, hidden, revealedByKind, hiddenByKind}；
 * 校验失败 {ok:false, reason}（World 未动）。
 */
export function planSteelReveal(world, edits, { L = 0.5, crank, maxGap } = {}) {
  const norm = normalizeSteelEdits(world, edits);
  if (!norm.ok) return norm;
  const staged = stagedWorld(world);
  const before = steelFramePlan(world, { L, crank, maxGap });
  const steps = [];
  let prev = before;
  for (const step of norm.steps) {
    applySteelEdits(staged, [step]);
    const cur = steelFramePlan(staged, { L, crank, maxGap });
    const d = planDiff(prev, cur);
    const kind = d.revealed.length && d.hidden.length ? 'mixed' : d.revealed.length ? 'reveal' : d.hidden.length ? 'hide' : 'none';
    steps.push({ label: step.label, ops: step.ops, kind, jobs: cur.jobs.length, ...d });
    prev = cur;
  }
  const total = planDiff(before, prev);
  return { ok: true, before, after: prev, steps, ...total };
}

/* ---- 碰撞清单口径审计 ---------------------------------------------------- */
const topIsRock = (world, c) => { const t = world.top(c); return t > 0 && !!world.isRock(c, t); };
/**
 * 杆件是否穿过实心体素内部（与 module-patch-commit columnState 同口径报告可走面）。
 * 杆件端点贴支撑面是常态（柱脚落屋面/码头顶、梁端接柱），只查线段严格内部；
 * 采样点在格边界上时对每个包含它的格都查（边界歧义宁多查不漏查）。
 * @returns [{segment, cell, level, y, walkable}]；walkable = 顶面岩石（可走面被压）。
 */
export function frameCollisions(world, plan, { L = 0.5, eps = 1e-4 } = {}) {
  const cells = world.cells;
  const reach = new Array(cells.length);
  for (const c of cells) reach[c.id] = c.pts.reduce((r, p) => Math.max(r, Math.hypot(p.x - c.cx, p.z - c.cz)), 0);
  const hits = [];
  for (const s of plan.segments) {
    const len = Math.hypot(s.b[0] - s.a[0], s.b[1] - s.a[1], s.b[2] - s.a[2]);
    const n = Math.max(4, Math.ceil(len / (L * 0.2)));
    for (let k = 1; k < n; k++) {
      const t = k / n, x = s.a[0] + (s.b[0] - s.a[0]) * t, y = s.a[1] + (s.b[1] - s.a[1]) * t, z = s.a[2] + (s.b[2] - s.a[2]) * t;
      if (y <= eps) continue;
      const lv = Math.floor((y - eps) / L) + 1;                  // 严格内部才判：贴面不算穿
      const inY = y - (lv - 1) * L;
      if (lv < 1 || lv > MAX_LEVEL || inY < eps || L - inY < eps) continue;
      for (const c of cells) {
        if (Math.abs(c.cx - x) + Math.abs(c.cz - z) > reach[c.id] * 1.05 + eps) continue;
        if (!pointInQuad(c.pts, x, z) || !world.isSolid(c, lv)) continue;
        hits.push({ segment: s, cell: c.id, level: lv, y: +y.toFixed(4), walkable: topIsRock(world, c) });
      }
    }
  }
  return hits;
}

/**
 * 「编辑/移除楼层 → 钢架显露」的整组事务。
 *   Phase 0  编辑步在暂存列上全量校验（normalize + 位写预演），失败不动 World；
 *   Phase A  commitModulePatch(fit, mapping=被编辑列)：socket(part,edge,cell) 声明被编辑足迹
 *            对外的接口 → 周围 solveWithPrefab 补网 + findWFCConflicts 复核 + stale-version；
 *            任一失败原 World 原样返回（fit 失败不写盘）；
 *   Phase B  原子写体素（Phase 0 已验证的同一组位写）+ world.touch；
 *   回执     commit.receipt 的 fit 快照先于一切写入——withdrawModulePatch 整组撤回，
 *            楼层回来、钢架随之藏回。
 * spec：{tiles*, compatible, socket=0, seed, maxSteps, tileColumn, volume, expectedVersion, L, crank, maxGap}
 *   tiles/compatible/socket = 周围补网目录与接口判据（调用方目录语义，同 commitModulePatch）。
 * 返回 {ok:true, world, commit, receipt, reveal:{revealed,hidden,byKind,before,after}, edits}
 *    或 {ok:false, reason, detail?, commit?}（World 未动）。
 */
export function commitSteelReveal(world, edits, spec = {}) {
  const {
    tiles = null, compatible, socket = 0, seed = 1, maxSteps, tileColumn = null, volume = null,
    expectedVersion = world.version, L = 0.5, crank, maxGap,
  } = spec;
  const norm = normalizeSteelEdits(world, edits);
  if (!norm.ok) return norm;
  const probe = stagedWorld(world);                          // Phase 0：暂存列全量预演
  applySteelEdits(probe, norm.steps);
  const mapping = [...new Set(norm.steps.flatMap((s) => s.ops.map((o) => o.cell)))].sort((a, b) => a - b);
  const commit = commitModulePatch(world, {                  // Phase A：socket/WFC 事务层
    mapping, socket, tiles, compatible, seed, maxSteps, tileColumn, volume, expectedVersion,
  });
  if (!commit.ok) return { ok: false, reason: commit.reason, detail: commit.detail ?? null, commit };
  const before = steelFramePlan(world, { L, crank, maxGap });
  applySteelEdits(world, norm.steps);                        // Phase B：原子位写
  world.touch();
  const after = steelFramePlan(world, { L, crank, maxGap });
  return { ok: true, world, commit, receipt: commit.receipt, edits: norm.steps, reveal: { ...planDiff(before, after), before, after } };
}

/** 整组撤回 = 事务层回执恢复（含本层楼层位写与非模块格 tileColumn 写入）。 */
export const withdrawSteelReveal = withdrawModulePatch;
