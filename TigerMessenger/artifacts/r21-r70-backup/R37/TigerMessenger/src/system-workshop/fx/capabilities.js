/**
 * 表现层管线 · 能力库（Worker 安全：纯数据）。输入 site = battle.probe 的舞台采样：
 *   { scene:{id,label}, land, maxLevel, houses, scale, gridRadius, grid:[[x,z,lv,house],…] }
 * 每个能力真实 import 调用能力线对应的库模块（meta.sources），方法出处标 meta.ideas。
 *   fx.campaign   岛屿分区与前线   —— campaign/campaign.js groupRegions + core/campaign-graph.js + core/frontier.js
 *   fx.camera     环绕镜头路径     —— core/camera-motion.js（角速度上限 / 涂抹长度）
 *   fx.wake       船尾迹           —— core/wake-sampling.js（Kelvin 19.47° V 形）
 *   fx.ornament   界面装饰面板     —— core/mirror-uv.js + core/ornament-field.js squiggleSdf
 *   fx.replay     管线回放图       —— core/node-graph-runtime.js NodeGraph 拓扑执行
 */
import { groupRegions } from '../../../../townscaper-web/REACodeRefactoring/src/campaign/campaign.js';
import { campaignGraph } from '../../../../townscaper-web/REACodeRefactoring/src/core/campaign-graph.js';
import { buildFrontier } from '../../../../townscaper-web/REACodeRefactoring/src/core/frontier.js';
import { cameraAngularSpeed, smearLengthPx } from '../../../../townscaper-web/REACodeRefactoring/src/core/camera-motion.js';
import { advanceWake, KELVIN } from '../../../../townscaper-web/REACodeRefactoring/src/core/wake-sampling.js';
import { mirrorUV } from '../../../../townscaper-web/REACodeRefactoring/src/core/mirror-uv.js';
import { squiggleSdf } from '../../../../townscaper-web/REACodeRefactoring/src/core/ornament-field.js';
import { NodeGraph, constant } from '../../../../townscaper-web/REACodeRefactoring/src/core/node-graph-runtime.js';
export const FX_CAPABILITIES_VERSION = 1;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const LIB = 'townscaper-web/REACodeRefactoring/';
const need = (site) => { if (!site?.grid?.length) throw Error('采样里没有舞台格网'); return site; };
const cells = (site, cap = 512) => { const g = need(site).grid; const k = Math.max(1, Math.ceil(g.length / cap)), out = []; for (let i = 0; i < g.length; i += k) out.push(g[i]); return out; };
const centroid = (g) => { let x = 0, z = 0; for (const c of g) { x += c[0]; z += c[1]; } return [x / g.length, z / g.length]; };

export const fxCampaign = {
  meta: { id: 'fx.campaign', name: '岛屿分区与前线', domain: 'fx', line: 'campaign',
    does: '把舞台格网变成战役图：Delaunay+近邻连边、按连通性分区、在靠海一侧算一条有净空的前线。',
    keywords: ['战役', '岛屿图', '分区', '前线', 'bad north'], sources: [LIB + 'src/campaign/campaign.js', LIB + 'src/core/campaign-graph.js', LIB + 'src/core/frontier.js'], ideas: [],
    params: { zones: { label: '分区数', min: 2, max: 6, step: 1, default: 3 }, clearance: { label: '前线净空（格）', min: 0.2, max: 3, step: 0.1, default: 1 }, side: { label: '前线位置（0–1 从海侧算）', min: 0.05, max: 0.5, step: 0.05, default: 0.25 } } },
  match(site) { const g = need(site).grid; return g.length >= 8 ? [{ id: 'site', cells: [], score: g.length, reason: `${g.length} 个舞台格可分区` }] : []; },
  run(site, { params }) {
    const g = cells(site), nodes = g.map((c) => ({ x: c[0], y: c[1], r: (site.scale || 5) * 0.55 }));
    const { nb } = campaignGraph(nodes);
    const zones = groupRegions(nodes.map((_, i) => i), nb, params.zones);
    const zs = zones instanceof Map ? zones : new Map(zones);
    const minY = Math.min(...nodes.map((n) => n.y)), maxY = Math.max(...nodes.map((n) => n.y));
    const pos = minY + (maxY - minY) * params.side, pad = (site.scale || 5) * params.clearance;
    const front = buildFrontier(nodes, { position: pos, padding: pad * 2, clearance: pad * 0.5, roundness: 0.25 });
    const zoneOf = nodes.map((_, i) => zs.get(i) ?? i);
    site.plan.campaign = { nodes: g, zones: zoneOf, frontier: front.ok ? front.path.map((p) => [+p.x.toFixed(2), +p.y.toFixed(2)]) : [], frontierOk: front.ok, reason: front.reason, nbEdges: nb.reduce((a, b) => a + b.length, 0) >> 1 };
    const zc = new Set(zoneOf).size;
    return { applied: ['site'], changed: [`图 ${nodes.length} 点 · 分区 ${zc} · 前线${front.ok ? ` ${front.path.length} 点` : ' 未连通（' + front.reason + '）'}`] };
  },
};

export const fxCamera = {
  meta: { id: 'fx.camera', name: '环绕镜头路径', domain: 'fx', line: 'camera',
    does: '绕舞台中心生成一条环绕镜头路径：采样点 + 每段角速度 + 涂抹长度，供镜头预览和之后接真实镜头。',
    keywords: ['镜头', '环绕', '轨道', '运镜', 'orbit'], sources: [LIB + 'src/core/camera-motion.js'], ideas: [],
    params: { laps: { label: '圈数', min: 0.25, max: 2, step: 0.25, default: 1 }, seconds: { label: '时长（秒）', min: 4, max: 30, step: 1, default: 12 }, maxSpeed: { label: '最大角速度（度/秒）', min: 10, max: 120, step: 5, default: 45 }, lift: { label: '镜头抬高（格）', min: 2, max: 12, step: 1, default: 6 } } },
  match(site) { const g = need(site).grid; return g.length >= 8 ? [{ id: 'site', cells: [], score: g.length, reason: '舞台中心可环绕' }] : []; },
  run(site, { params }) {
    const g = need(site).grid, [cx, cz] = centroid(g);
    let R = 0; for (const c of g) R = Math.max(R, Math.hypot(c[0] - cx, c[1] - cz)); R = Math.max(R * 1.4, 8);
    const top = Math.max(...g.map((c) => c[2])) * (site.unitHeight || 1.7), N = Math.max(24, Math.round(params.seconds * 8)), path = []; let worst = 0;
    for (let i = 0; i <= N; i++) {
      const t = i / N, yaw = t * params.laps * Math.PI * 2 - Math.PI * 0.5;
      const prev = path.at(-1), seg = i ? cameraAngularSpeed(yaw, 0.5, prev.yaw, 0.5, params.seconds / N) : 0;
      worst = Math.max(worst, seg);
      path.push({ x: +(cx + Math.cos(yaw) * R).toFixed(2), y: +(top + params.lift).toFixed(2), z: +(cz + Math.sin(yaw) * R).toFixed(2), yaw: +yaw.toFixed(3), degPerSec: +(seg * 180 / Math.PI).toFixed(1), smear: +smearLengthPx(seg, R, params.seconds / N).toFixed(1) });
    }
    site.plan.camera = { centre: [cx, cz], radius: +R.toFixed(2), seconds: params.seconds, maxSpeed: params.maxSpeed, worstDegPerSec: +(worst * 180 / Math.PI).toFixed(1), path };
    return { applied: ['site'], changed: [`环绕 ${params.laps} 圈 · ${path.length} 点 · 峰值 ${(worst * 180 / Math.PI).toFixed(0)}°/s（限 ${params.maxSpeed}）`] };
  },
};

export const fxWake = {
  meta: { id: 'fx.wake', name: '船尾迹', domain: 'fx', line: 'water-effects',
    does: '沿一条横穿舞台的航线模拟船尾泡沫：两侧喷口外推形成 Kelvin 尾迹，折线带可画进候选图。',
    keywords: ['尾迹', '船', '水面', '泡沫', 'kelvin'], sources: [LIB + 'src/core/wake-sampling.js'], ideas: [],
    params: { seconds: { label: '航行时长（秒）', min: 2, max: 20, step: 1, default: 8 }, speed: { label: '船速（格/秒）', min: 1, max: 8, step: 0.5, default: 3 }, spread: { label: '泡沫外推速度', min: 0.05, max: 0.5, step: 0.02, default: 0.18 }, max: { label: '泡沫上限', min: 40, max: 400, step: 10, default: 200 } } },
  match(site) { const g = need(site).grid; return g.length >= 8 ? [{ id: 'site', cells: [], score: g.length, reason: '舞台边缘有水面可航行' }] : []; },
  run(site, { params }) {
    const g = need(site).grid, [cx, cz] = centroid(g);
    let R = 0; for (const c of g) R = Math.max(R, Math.hypot(c[0] - cx, c[1] - cz)); R += (site.scale || 5) * 3;
    const state = { trail: [], acc: 0, lastPose: null };
    const shipV = params.speed * (site.scale || 5), L = shipV * params.seconds, x0 = cx - R, z0 = cz + R * 0.35, x1 = cx + R, z1 = cz - R * 0.1;
    const dx = x1 - x0, dz = z1 - z0, len = Math.hypot(dx, dz) || 1, N = Math.ceil(params.seconds / 0.06);
    for (let i = 1; i <= N; i++) { const t = (i * 0.06) / params.seconds, px = x0 + dx * Math.min(1, t * L / len), pz = z0 + dz * Math.min(1, t * L / len); advanceWake(state, { x: px, z: pz, dx: dx / len, dz: dz / len }, 0.06, { interval: 0.06, spread: params.spread, max: params.max }); }
    const pts = state.trail.map((p) => ({ l: [+p.l[0].toFixed(2), +p.l[1].toFixed(2)], r: [+p.r[0].toFixed(2), +p.r[1].toFixed(2)], age: +p.age.toFixed(2) }));
    const halfAngle = +(Math.atan(params.spread / shipV) * 180 / Math.PI).toFixed(2);
    site.plan.wake = { kelvin: KELVIN, halfAngle, shipV: +shipV.toFixed(2), spread: params.spread, points: pts, track: [[x0, z0], [x1, z1]] };
    return { applied: ['site'], changed: [`尾迹 ${pts.length} 片泡沫 · 半角 ${halfAngle}°（Kelvin 上限 ${KELVIN}°）`] };
  },
};

export const fxOrnament = {
  meta: { id: 'fx.ornament', name: '界面装饰面板', domain: 'fx', line: 'ui-decoration',
    does: '给候选图加一块装饰面板：镜像 UV 折边确定每格朝向，再用抖动线段 SDF 画一条手绘感曲线。',
    keywords: ['界面', '装饰', '镜像', 'sdf', '曲线'], sources: [LIB + 'src/core/mirror-uv.js', LIB + 'src/core/ornament-field.js'], ideas: [],
    params: { size: { label: '面板尺寸（格）', min: 16, max: 96, step: 8, default: 48 }, tile: { label: '镜像砖块（格）', min: 8, max: 48, step: 4, default: 16 }, wobble: { label: '抖动幅度', min: 0, max: 0.03, step: 0.005, default: 0.01 }, segs: { label: '曲线段数', min: 4, max: 24, step: 1, default: 10 } } },
  match(site) { const g = need(site).grid; return g.length >= 8 ? [{ id: 'site', cells: [], score: g.length, reason: '可生成装饰面板' }] : []; },
  run(site, { params }) {
    const { size, tile } = params, segs = [];
    for (let i = 0; i < params.segs; i++) { const a = (i / params.segs) * Math.PI, r = 0.22 + 0.05 * Math.sin(i * 2.3); segs.push({ x0: Math.cos(a) * r, y0: Math.sin(a) * r, x1: Math.cos(a + Math.PI / params.segs) * r, y1: Math.sin(a + Math.PI / params.segs) * r, r: 0.012 }); }
    const field = new Float32Array(size * size), uv = new Uint8Array(size * size);
    for (let j = 0; j < size; j++) for (let i = 0; i < size; i++) {
      const [u, v] = mirrorUV(i, j, size, size, { tileSize: tile }); uv[j * size + i] = Math.round(u * 15) * 16 + Math.round(v * 15);
      field[j * size + i] = squiggleSdf(segs, (i / size - 0.5) * 1.2, (j / size - 0.5) * 1.2, { amp: params.wobble }).d;
    }
    site.plan.ornament = { size, tile, segs: params.segs, field: [...field].map((v) => +v.toFixed(3)), uv: [...uv] };
    return { applied: ['site'], changed: [`面板 ${size}² · 砖块 ${tile} · 曲线 ${params.segs} 段`] };
  },
};

export const fxReplay = {
  meta: { id: 'fx.replay', name: '管线回放图', domain: 'fx', line: 'tools',
    does: '把这条管线当前步骤画成一张节点图并真实执行一遍：每步一个节点，输出该步状态，可存档成回放。',
    keywords: ['工具', '回放', '节点图', '存档', '管线'], sources: [LIB + 'src/core/node-graph-runtime.js'], ideas: [LIB + 'src/core/qa-replay.js'],
    params: { ticks: { label: '执行帧数', min: 1, max: 60, step: 1, default: 10 } } },
  match(site) { const g = need(site).grid; return g.length ? [{ id: 'site', cells: [], score: g.length, reason: '可为当前管线生成回放图' }] : []; },
  run(site, { params }) {
    const steps = site.pipelineSteps?.length ? site.pipelineSteps : ['scan'];
    const g = new NodeGraph();
    g.add('scan', constant(1));
    steps.forEach((s, i) => { const id = 's' + i; g.add(id, { inputs: ['in'], outputs: ['out'], defaults: { in: 0 }, eval: (n) => ({ out: (n.in.in || 0) + 1 }) }); g.link((i ? 's' + (i - 1) : 'scan') + ':out', id + ':in'); });
    const order = g.order(), trace = [];
    for (let k = 0; k < params.ticks; k++) { g.tick(1 / 60); trace.push(g.nodes.get('s' + (steps.length - 1))?.out.out ?? g.nodes.get('scan').out.out); }
    site.plan.replay = { nodes: order, edges: g.edges.length, ticks: params.ticks, trace: trace.slice(-4), stable: trace.at(-1) === trace.at(-2) };
    return { applied: ['site'], changed: [`图 ${order.length} 节点 ${g.edges.length} 边 · 执行 ${params.ticks} 帧`] };
  },
};

export const FX_CAPABILITIES = [fxCampaign, fxCamera, fxWake, fxOrnament, fxReplay];
const byId = new Map(FX_CAPABILITIES.map((c) => [c.meta.id, c]));
export function describeFxCapabilities() { return FX_CAPABILITIES.map(({ meta }) => ({ ...meta, params: meta.params || {}, executable: true })); }
const defaults = (meta, params = {}) => Object.fromEntries(Object.entries(meta.params || {}).map(([k, p]) => [k, clamp(+(params[k] ?? p.default), p.min ?? -Infinity, p.max ?? Infinity)]));
export function matchAll(site) { return FX_CAPABILITIES.map((cap) => { let rows = []; try { rows = cap.match(site); } catch (e) { return { id: cap.meta.id, error: e.message, count: 0, targets: [] }; } return { id: cap.meta.id, count: rows.length, targets: rows }; }); }
export function runPlan(site, steps, onStep = () => {}) {
  const report = []; site.plan = {}; const order = FX_CAPABILITIES.map((c) => c.meta.id), sorted = [...steps].sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id)); site.pipelineSteps = sorted.map((s) => s.id);
  for (const step of sorted) {
    const cap = byId.get(step.id); if (!cap) { report.push({ id: step.id, status: 'error', error: '能力库里没有这个能力' }); continue; }
    const params = defaults(cap.meta, step.params); onStep(step.id);
    const t0 = Date.now(), out = cap.run(site, { params });
    report.push({ id: step.id, line: cap.meta.line, status: out.applied.length ? 'applied' : 'no-target', applied: out.applied, changed: out.changed || [], ms: Date.now() - t0, params });
  }
  return report;
}
