// =====================================================================
//  V6-G8 调试层 → Three 场景叠图（渲染接线半区）
//  前半区是纯逻辑（禁止 import Three.js / DOM，Node 单测可覆盖）：
//    - planLayerGeometry：层快照 data → 图元计划（points / segments / empty）
//    - buildRuntimeWfcSource：运行时实时构建 V7 WFC 波函数源
//      （迁移真实 catalog → 硬路由 pin → AC 传播闭包，非伪造数据）
//  后半区 createG8DebugOverlay 通过参数注入 THREE，生成 LineSegments /
//  Points 叠图：depthTest 关闭、半透明、renderOrder 靠后，挂场景根。
//  零开销契约：setLayers([]) / 未启用时 root 不入场景，update() 直接返回。
// =====================================================================

import {
  V6_G8_LAYER_IDS,
  createG8DebugSession,
} from "./v6G8Layers.js";
import { exportLayer } from "./v6G8Export.js";
import { parseTownCellId, DELTA } from "../../world/citadel/constraintSolver.js";
import { migrateCatalogModules } from "../../procgen/wfc/migrateCatalog.js";
import { compileVariants } from "../../procgen/wfc/socketCompiler.js";
import { compileCompatibilityTable } from "../../procgen/wfc/compatibilityTable.js";
import { WaveState } from "../../procgen/wfc/waveState.js";
import { createPropagator, createPropagateStats } from "../../procgen/wfc/propagator.js";
import { BitSet } from "../../procgen/core/bitSet.js";
import { Trail } from "../../procgen/core/trail.js";

// 当前有几何可视化的层；其余层 setLayers 也接受，但产出空叠图 + note 说明
export const G8_OVERLAY_SUPPORTED = Object.freeze([
  "wfc-entropy",
  "hard-route",
  "shadow-frustum",
  "local-light-budget",
]);

// 动态层：每 0.5s 节流重取快照重建（shadow 拟合 / 灯预算选择随相机变）
const DYNAMIC_LAYERS = new Set(["shadow-frustum", "local-light-budget"]);
const REFRESH_INTERVAL = 0.5;

// ---------------------------------------------------------------------
//  纯逻辑：颜色与坐标
// ---------------------------------------------------------------------

/** 热力色 0..1 → [r,g,b]（蓝→青→绿→黄→红，叠图高对比） */
export function heatColor(t) {
  const k = Math.max(0, Math.min(1, Number.isFinite(t) ? t : 0));
  // 四段折线：蓝(0,0.2,1) → 青(0,0.9,0.9) → 黄(1,0.85,0.1) → 红(1,0.15,0.05)
  if (k < 1 / 3) {
    const u = k * 3;
    return [0, 0.2 + 0.7 * u, 1 - 0.1 * u];
  }
  if (k < 2 / 3) {
    const u = k * 3 - 1;
    return [u, 0.9 - 0.05 * u, 0.9 - 0.8 * u];
  }
  const u = k * 3 - 2;
  return [1, 0.85 - 0.7 * u, 0.1 - 0.05 * u];
}

/**
 * town cell → 圣城局部坐标。
 * 优先取 topo 四角顶点均值（含骨架扰动的真实落位）；
 * 顶点缺失时按 blueprint.grid 规范网格 + 台地 baseY 兜底。
 * ctx: { cornerOf(cellId)→{x,y,z}|null, grid:{size,cellSize,cellHeight}, baseYs:number[] }
 */
export function townCellLocal(id, ctx = {}) {
  const p = parseTownCellId(id);
  if (!p) return null;
  const corner = ctx.cornerOf?.(p.id);
  if (corner) return { x: corner.x, y: corner.y + 0.42, z: corner.z }; // 微抬离面，防 z-fight 感
  const g = ctx.grid;
  if (!g) return null;
  const c = (g.size - 1) / 2;
  const baseY = ctx.baseYs?.[p.t] ?? 0;
  return {
    x: (p.ix - c) * g.cellSize,
    y: baseY + (p.iy + 0.5) * g.cellHeight + 0.42,
    z: (p.iz - c) * g.cellSize,
  };
}

// ---------------------------------------------------------------------
//  纯逻辑：层 → 图元计划
//  返回 { kind:"points", space, positions:[x,y,z...], colors:[r,g,b...] }
//      | { kind:"segments", space, positions:[x,y,z...]（成对端点） }
//      | { kind:"empty", note }
//  space: "citadel"（圣城局部，由接线层做 localToWorld）| "world"
// ---------------------------------------------------------------------

/** wfc-entropy：每 cell 一个热力色点（熵按 min..max 归一） */
function planWfcEntropy(data, ctx) {
  const cells = data?.cells;
  if (!cells?.length) {
    return { kind: "empty", note: "wfc-entropy 无 cells：运行时无 live wave（buildRuntimeWfcSource 未构建或失败）" };
  }
  const lo = Number.isFinite(data.min) ? data.min : 0;
  const hi = Number.isFinite(data.max) && data.max > lo ? data.max : lo + 1;
  const positions = [];
  const colors = [];
  let skipped = 0;
  for (const c of cells) {
    if (!Number.isFinite(c.entropy)) continue; // 已坍缩/空域不参赛（与数据层一致）
    const p = townCellLocal(c.id, ctx);
    if (!p) {
      skipped++;
      continue;
    }
    positions.push(p.x, p.y, p.z);
    colors.push(...heatColor((c.entropy - lo) / (hi - lo)));
  }
  if (!positions.length) {
    return { kind: "empty", note: `wfc-entropy 全部 cell 已坍缩或坐标不可解析（skipped=${skipped}）` };
  }
  return { kind: "points", space: "citadel", positions, colors };
}

/** hard-route：相邻路线格连成折线网（同层台地、|Δix|+|Δiz|=1） */
function planHardRoute(data, ctx) {
  const ids = [...(data?.routeCells || []), ...(data?.lockedRoutes || [])];
  if (!ids.length) return { kind: "empty", note: "hard-route 无 routeCells（v4 town 缺失或无锁定路线）" };
  const set = new Set(ids.map((id) => parseTownCellId(id)?.id).filter(Boolean));
  const positions = [];
  let dropped = 0;
  const push = (a, b) => {
    const pa = townCellLocal(a, ctx);
    const pb = townCellLocal(b, ctx);
    if (!pa || !pb) {
      dropped++;
      return;
    }
    positions.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
  };
  for (const id of set) {
    const p = parseTownCellId(id);
    // 只往 E/S 两个方向连，避免重复边
    for (const dir of ["E", "S"]) {
      const d = DELTA[dir];
      const nid = `cell:${p.t}:${p.ix + d[0]}:${p.iy + d[1]}:${p.iz + d[2]}`;
      if (set.has(nid)) push(id, nid);
    }
  }
  if (!positions.length) {
    return { kind: "empty", note: `hard-route 路线格互不相邻（dropped=${dropped}）` };
  }
  return { kind: "segments", space: "citadel", positions };
}

/** shadow-frustum：正交阴影视锥 12 边线框。
 *  截面/近远取自 camera bounds（真实读数）；沿光轴的绝对位置以 fit.center
 *  居中（dist = (near+far)/2）——sun 到 center 的真实距离未入快照，注释存证。 */
function planShadowFrustum(data) {
  const cam = data?.camera;
  if (!cam || ![cam.left, cam.right, cam.top, cam.bottom, cam.near, cam.far].every(Number.isFinite)) {
    return { kind: "empty", note: "shadow-frustum 无 camera bounds（V5 未开启或未拟合）" };
  }
  const center = data.fit?.center || [0, 0, 0];
  const dir = data.fit?.sunDirection || [0, 1, 0];
  const dl = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const zAxis = [dir[0] / dl, dir[1] / dl, dir[2] / dl]; // target → sun
  // 构建光空间基：xAxis ⟂ zAxis，yAxis 正交补齐
  const up0 = Math.abs(zAxis[1]) > 0.99 ? [1, 0, 0] : [0, 1, 0];
  const xAxis = norm3(cross3(up0, zAxis));
  const yAxis = cross3(zAxis, xAxis);
  const dist = (cam.near + cam.far) / 2;
  // 光空间点 (x,y,z∈[-far,-near]) → 世界 = center + (dist+z)·zAxis + x·xAxis + y·yAxis
  const toWorld = (x, y, z) => [
    center[0] + (dist + z) * zAxis[0] + x * xAxis[0] + y * yAxis[0],
    center[1] + (dist + z) * zAxis[1] + x * xAxis[1] + y * yAxis[1],
    center[2] + (dist + z) * zAxis[2] + x * xAxis[2] + y * yAxis[2],
  ];
  const L = cam.left;
  const R = cam.right;
  const B = cam.bottom;
  const T = cam.top;
  const N = -cam.near;
  const F = -cam.far;
  const n = [toWorld(L, B, N), toWorld(R, B, N), toWorld(R, T, N), toWorld(L, T, N)];
  const f = [toWorld(L, B, F), toWorld(R, B, F), toWorld(R, T, F), toWorld(L, T, F)];
  const positions = [];
  const edge = (a, b) => positions.push(...a, ...b);
  for (let i = 0; i < 4; i++) {
    edge(n[i], n[(i + 1) % 4]); // 近平面环
    edge(f[i], f[(i + 1) % 4]); // 远平面环
    edge(n[i], f[i]); // 四条棱
  }
  return { kind: "segments", space: "world", positions };
}

/** local-light-budget：active 灯暖橙点 / 其余冷灰蓝点（世界坐标） */
function planLightBudget(data) {
  const entries = data?.entries;
  if (!entries?.length) return { kind: "empty", note: "local-light-budget 无 entries（registry 空或缺失）" };
  const activeIds = new Set((data.active || []).map((a) => a.lightId));
  const positions = [];
  const colors = [];
  for (const e of entries) {
    const p = e.position;
    if (!Array.isArray(p) || !p.every(Number.isFinite)) continue;
    positions.push(p[0], p[1], p[2]);
    // active=暖橙 [1,0.62,0.2]；inactive=冷灰蓝 [0.35,0.5,0.7]；无 active 信息时统一冷色
    if (data.active && activeIds.has(e.lightId)) colors.push(1, 0.62, 0.2);
    else colors.push(0.35, 0.5, 0.7);
  }
  if (!positions.length) return { kind: "empty", note: "local-light-budget 灯位均无 position" };
  const note = data.active ? null : "active=null（缺 camera/budget），全部按 inactive 着色";
  return { kind: "points", space: "world", positions, colors, note };
}

const PLANNERS = Object.freeze({
  "wfc-entropy": planWfcEntropy,
  "hard-route": planHardRoute,
  "shadow-frustum": planShadowFrustum,
  "local-light-budget": planLightBudget,
});

/** 单层图元计划；无几何支持的层返回 empty + note（数据源缺口不伪造） */
export function planLayerGeometry(id, data, ctx = {}) {
  const plan = PLANNERS[id];
  if (!plan) {
    return { kind: "empty", note: `${id} 暂无几何可视化（支持：${G8_OVERLAY_SUPPORTED.join("/")}）` };
  }
  return plan(data, ctx);
}

function cross3(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function norm3(v) {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}

// ---------------------------------------------------------------------
//  纯逻辑：运行时 WFC 源（真实迁移 catalog + 硬路由 pin + AC 传播闭包）
//  只做 pin + 传播，不做观察决策——叠图要看的是“约束传播后的熵场”，
//  不是再解一座城。垂直 U/D 边不走：旧 catalog 的 support/roof 垂直语义
//  非对称（verticalOk），与 V7 迁移后的 symmetric parity 不一致，强行走
//  会制造伪矛盾。
// ---------------------------------------------------------------------
export function buildRuntimeWfcSource(v4) {
  const cells = v4?.town?.cells;
  const modules = v4?.catalog?.modules;
  if (!cells?.length || !modules?.length) return null;
  try {
    const { prototypes } = migrateCatalogModules(modules);
    const compiled = compileVariants(prototypes);
    // onDeadVariant=report：迁移集可能有单向无邻的 variant，不在这里抛死
    const table = compileCompatibilityTable(compiled, { onDeadVariant: "report" });
    const variants = compiled.variants;

    // 图适配器：真实 town cell 集 + 水平邻接（方向 token 与 V6 DELTA 约定一致）
    const ids = [];
    const parsed = [];
    const indexOf = new Map();
    for (const c of cells) {
      const p = parseTownCellId(c.cellId || c.id);
      if (!p) continue;
      indexOf.set(p.id, ids.length);
      ids.push(p.id);
      parsed.push({ p, cell: c });
    }
    if (!ids.length) return null;
    const adjacency = parsed.map(({ p }) => {
      const out = [];
      for (const dir of ["N", "E", "S", "W"]) {
        const d = DELTA[dir];
        const j = indexOf.get(`cell:${p.t}:${p.ix + d[0]}:${p.iy + d[1]}:${p.iz + d[2]}`);
        if (j !== undefined) out.push({ to: j, direction: dir });
      }
      return out;
    });
    const graph = { cellCount: ids.length, cells: () => ids.map((id) => ({ id })), neighborsOf: (i) => adjacency[i] };

    const weights = new Float64Array(variants.map((v) => v.weight));
    const wlw = new Float64Array(variants.map((v) => v.weight * Math.log(v.weight)));
    const wave = new WaveState({ cellCount: ids.length, variantCount: variants.length, weights, weightLogWeights: wlw, cellIds: ids });
    const trail = new Trail();

    // 硬路由 pin：locked-route cell 锁到其模块 proto 的全部方向变体
    // （锁模块不锁朝向——朝向任意是真实语义，避免人为矛盾）
    const seedCells = [];
    for (let i = 0; i < parsed.length; i++) {
      const c = parsed[i].cell;
      const protoId = c.module?.id;
      if (c.reason !== "locked-route" || !protoId) continue;
      const mask = new BitSet(variants.length, false);
      let any = false;
      for (let v = 0; v < variants.length; v++) {
        if (variants[v].protoId === protoId) {
          mask.set(v);
          any = true;
        }
      }
      if (!any) continue;
      wave.intersectDomain(i, mask, trail, "pin:locked-route");
      seedCells.push(i);
    }

    const propagator = createPropagator({ graph, compatibleFor: (d) => table.compatible[d] });
    const stats = createPropagateStats();
    const res = propagator.propagateBitset(wave, seedCells, trail, { stats });
    return {
      wave,
      trail,
      stats,
      solved: v4.town.solver ?? null, // wfc-domain/propagation 的 v4 兜底源
      contradiction: Number.isInteger(res?.contradiction) ? ids[res.contradiction] : null,
    };
  } catch (err) {
    console.warn("[g8Debug] 运行时 WFC 源构建失败：", err?.message || err);
    return null;
  }
}

// ---------------------------------------------------------------------
//  Three 叠图工厂（注入 THREE，本文件不 import three，保持 Node 可测）
// ---------------------------------------------------------------------
export function createG8DebugOverlay({ THREE, scene, camera, getRuntime }) {
  const root = new THREE.Group();
  root.name = "g8-debug-overlay";
  root.renderOrder = 999;
  root.visible = false;
  const session = createG8DebugSession({ enabled: true });

  let layerIds = [];
  let wfcSource = null; // 惰性构建一次（城堡重建后不会自动失效，调 setLayers 重取）
  let refreshT = 0;
  const layerObjects = new Map(); // id → { object, dynamic, note }

  const disposeObject = (obj) => {
    obj.geometry?.dispose?.();
    obj.material?.dispose?.();
  };

  function clearAll() {
    for (const { object } of layerObjects.values()) {
      root.remove(object);
      disposeObject(object);
    }
    layerObjects.clear();
  }

  // 圣城局部 → 世界（叠图根挂场景，几何一律落世界坐标）
  function makeCtx(rt) {
    const citadel = rt?.citadel || null;
    if (citadel) citadel.updateWorldMatrix(true, false);
    const toWorld = (p) => {
      if (!citadel) return p;
      const v = new THREE.Vector3(p.x, p.y, p.z);
      citadel.localToWorld(v);
      return { x: v.x, y: v.y, z: v.z };
    };
    // topo 四角顶点均值（含骨架扰动的真实落位）
    let cornerMap = null;
    const vertices = rt?.v4?.topo?.halfEdge?.vertices;
    if (vertices) {
      cornerMap = new Map();
      for (const v of vertices) {
        if (!v.entityId) continue;
        let agg = cornerMap.get(v.entityId);
        if (!agg) cornerMap.set(v.entityId, (agg = { x: 0, y: 0, z: 0, n: 0 }));
        agg.x += v.x;
        agg.y += v.y;
        agg.z += v.z;
        agg.n++;
      }
      for (const agg of cornerMap.values()) {
        agg.x /= agg.n;
        agg.y /= agg.n;
        agg.z /= agg.n;
      }
    }
    const bp = citadel?.userData?.blueprint;
    return {
      cornerOf: (cellId) => cornerMap?.get(cellId) || null,
      grid: bp?.grid || null,
      baseYs: bp?.terrain?.baseYs || null,
      toWorld,
    };
  }

  function cameraSpec() {
    const p = camera.position;
    const f = new THREE.Vector3();
    camera.getWorldDirection(f);
    return { position: [p.x, p.y, p.z], forward: [f.x, f.y, f.z] };
  }

  function buildObject(id, plan, ctx) {
    let object = null;
    if (plan.kind === "points" || plan.kind === "segments") {
      const src = plan.space === "citadel" ? plan.positions : null;
      // citadel 局部坐标转世界
      const n = plan.positions.length / 3;
      const arr = new Float32Array(plan.positions.length);
      for (let i = 0; i < n; i++) {
        const p = { x: plan.positions[i * 3], y: plan.positions[i * 3 + 1], z: plan.positions[i * 3 + 2] };
        const w = src ? ctx.toWorld(p) : p;
        arr[i * 3] = w.x;
        arr[i * 3 + 1] = w.y;
        arr[i * 3 + 2] = w.z;
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute("position", new THREE.BufferAttribute(arr, 3));
      if (plan.kind === "points") {
        geo.setAttribute("color", new THREE.BufferAttribute(new Float32Array(plan.colors), 3));
        object = new THREE.Points(
          geo,
          new THREE.PointsMaterial({
            size: 0.85,
            vertexColors: true,
            transparent: true,
            opacity: 0.9,
            depthTest: false,
            depthWrite: false,
            sizeAttenuation: true,
          })
        );
      } else {
        const color = id === "hard-route" ? 0xffc93c : id === "shadow-frustum" ? 0x7fd4ff : 0xffffff;
        object = new THREE.LineSegments(
          geo,
          new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.85, depthTest: false, depthWrite: false })
        );
      }
      object.name = `g8:${id}`;
      object.renderOrder = 999;
      object.frustumCulled = false; // 叠图不做视锥剔除（线框跨幅大）
    }
    return object;
  }

  function rebuildLayer(id, rt, ctx) {
    const old = layerObjects.get(id);
    if (old) {
      root.remove(old.object);
      if (old.object) disposeObject(old.object);
      layerObjects.delete(id);
    }
    const opts = { camera: cameraSpec(), lightBudget: rt?.lightBudget ?? null };
    const sources = {
      v4: rt?.v4 ?? null,
      wfc: wfcSource, // 可能为 null：缺源层快照为 null 占位，叠图 empty+note
      agents: rt?.v4?.combat?.agents ?? null,
      lighting: { director: rt?.director ?? null, registry: rt?.registry ?? null },
      ao: { volume: rt?.aoVolume ?? null },
    };
    const layer = session.snapshotLayer(id, sources, opts);
    const plan = planLayerGeometry(id, layer?.data ?? null, ctx);
    const object = buildObject(id, plan, ctx);
    if (object) root.add(object);
    layerObjects.set(id, { object, dynamic: DYNAMIC_LAYERS.has(id), note: plan.note || null, kind: plan.kind, count: (plan.positions?.length || 0) / 3 });
  }

  function rebuildAll() {
    const rt = getRuntime?.() || null;
    // wfc-* 层被请求时才惰性构建运行时 WFC 源（一次性，不进生产路径）
    if (!wfcSource && layerIds.some((id) => id.startsWith("wfc-"))) {
      wfcSource = buildRuntimeWfcSource(rt?.v4);
    }
    const ctx = makeCtx(rt);
    for (const id of layerIds) rebuildLayer(id, rt, ctx);
  }

  const api = {
    root,
    /** 设置叠图层（逗号分隔已由调用方拆开）；空数组 = 关闭并从场景摘除 */
    setLayers(ids) {
      const valid = (Array.isArray(ids) ? ids : []).filter((id) => V6_G8_LAYER_IDS.includes(id));
      layerIds = valid;
      clearAll();
      if (!valid.length) {
        root.visible = false;
        root.removeFromParent();
        return api.getLayers();
      }
      if (!root.parent) scene.add(root);
      root.visible = true;
      rebuildAll();
      return api.getLayers();
    },
    getLayers: () => [...layerIds],
    listLayers: () => [...V6_G8_LAYER_IDS],
    /** 手动整体重建（城堡重建 / 想重取 WFC 源时调） */
    refresh({ rebuildWfc = false } = {}) {
      if (rebuildWfc) wfcSource = null;
      if (layerIds.length) rebuildAll();
    },
    /** 主循环钩子：节流重建动态层；未启用时零开销直接返回 */
    update(dt) {
      if (!layerIds.length || !root.parent) return;
      refreshT -= dt;
      if (refreshT > 0) return;
      refreshT = REFRESH_INTERVAL;
      const rt = getRuntime?.() || null;
      const ctx = makeCtx(rt);
      // 先快照 key 列表再重建：rebuildLayer 会 delete+set 同一个 key，
      // 直接迭代 Map 会把重排的 key 再次访问到（死循环）
      for (const id of [...layerObjects.keys()]) {
        if (layerObjects.get(id)?.dynamic) rebuildLayer(id, rt, ctx);
      }
    },
    /** 导出当前层快照 JSON 文本（复用 v6G8Export 契约） */
    exportJson(id) {
      if (!layerIds.includes(id)) return null;
      const rt = getRuntime?.() || null;
      const layer = session.snapshotLayer(id, {
        v4: rt?.v4 ?? null,
        wfc: wfcSource,
        agents: rt?.v4?.combat?.agents ?? null,
        lighting: { director: rt?.director ?? null, registry: rt?.registry ?? null },
        ao: { volume: rt?.aoVolume ?? null },
      }, { camera: cameraSpec(), lightBudget: rt?.lightBudget ?? null });
      return layer ? exportLayer(layer, "json").text : null;
    },
    /** 验收/e2e 读数：每层 kind/图元数/note */
    stats() {
      const out = {};
      for (const [id, meta] of layerObjects) {
        out[id] = { kind: meta.kind, count: meta.count, note: meta.note, inScene: !!meta.object && meta.object.parent === root };
      }
      return out;
    },
  };
  return api;
}
