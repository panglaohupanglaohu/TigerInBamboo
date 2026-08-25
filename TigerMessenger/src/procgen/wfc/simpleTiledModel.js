// =====================================================================
// Simple Tiled Model — WFC 二维模块模型（V7-G4）
// 两种图适配器：
//   · rect-grid-2d：经典矩形网格；模块面以 N/E/S/W 为键，adjacency 可由
//     socket 编译派生，也可由调用方显式给出（显式优先，逐行覆盖）。
//   · half-edge-graph：不规则 n-gon 网格；方向 token = 共享边的
//     朝向/长度类别（he:o{朝向桶}:l{长度桶}），模块面以类别 token 为键。
// 边界由图适配器表达；rect 网格可用 boundary 声明四边允许集合
// （求解前转为 level-0 ban）；固定门口/道路/台面入口用 pins 表达。
// 核心层只返回数据，不依赖 Three.js。
// =====================================================================

import { compileVariants } from "./socketCompiler.js";
import { compileCompatibilityTable, compileTokenCompatibilityTable } from "./compatibilityTable.js";
import { solveWfc } from "./solver.js";
import { BitSet } from "../core/bitSet.js";
import { OPP2 } from "../graph/rectGrid2d.js";

/**
 * 创建二维 Simple Tiled 模型。
 * @param {object} opts
 * @param {object[]} [opts.prototypes] ModulePrototype（socket 派生 adjacency）
 * @param {Array<{id:string, weight?:number, tags?:string[]}>} [opts.tiles]
 *   显式 tile 输入（无 socket 展开，每 tile 恰一 variant，key=`{id}@r0`）
 * @param {Array<{a:string, direction:string, b:string, allow?:boolean}>} [opts.adjacency]
 *   显式 adjacency：a/b 为 variant key 或 tile/proto id（proto 级展开到全部
 *   variant）。direction ∈ N/E/S/W，反向自动补齐；allow:false 为显式禁配
 *   （双向清除）。与 socket 派生并存时显式优先：同一 (a,direction) 的
 *   allow 条目集合整行替换派生结果。
 * @param {Object<string,string[]>} [opts.boundary]
 *   rect 网格四边允许集合：{ N:[id...], E:[...], S:[...], W:[...] }，
 *   边界 cell 求解前 ban 掉不在集合内的候选（level-0，不随回溯撤销）。
 * @param {object} opts.graph rect-grid-2d 或 half-edge-graph 图适配器
 * @param {(geo:{key,dx,dy,length})=>string} [opts.classifyEdge]
 *   half-edge 模式的共享边 → 方向 token 分类器（缺省 defaultEdgeClass）
 */
export function createSimpleTiledModel({
  prototypes,
  tiles,
  adjacency,
  boundary,
  graph,
  compatibilityOptions,
  classifyEdge,
} = {}) {
  if (!graph || (graph.kind !== "rect-grid-2d" && graph.kind !== "half-edge-graph")) {
    throw new Error("SimpleTiledModel requires a rect-grid-2d or half-edge-graph graph");
  }
  if (graph.kind === "half-edge-graph") {
    if (boundary) throw new Error("SimpleTiledModel: boundary is only supported on rect-grid-2d");
    return createHalfEdgeSimpleTiledModel({ prototypes, graph, compatibilityOptions, classifyEdge });
  }

  let compiled;
  let table;
  if (Array.isArray(prototypes) && prototypes.length > 0) {
    compiled = compileVariants(prototypes);
    table = compileCompatibilityTable(compiled, compatibilityOptions);
  } else if (Array.isArray(tiles) && tiles.length > 0) {
    compiled = compileExplicitTiles(tiles);
    table = null;
  } else {
    throw new Error("SimpleTiledModel requires a non-empty prototypes or tiles array");
  }
  if (adjacency) {
    table = applyExplicitAdjacency(compiled, table, adjacency);
  }
  if (!table) throw new Error("SimpleTiledModel: explicit tiles require explicit adjacency");
  if (boundary) {
    for (const dir of Object.keys(boundary)) {
      if (!OPP2[dir]) throw new Error(`SimpleTiledModel: unknown boundary direction "${dir}"`);
      if (!Array.isArray(boundary[dir])) throw new Error(`SimpleTiledModel: boundary.${dir} must be an array`);
    }
  }
  return Object.freeze({
    kind: "simple-tiled-2d",
    graphKind: "rect-grid-2d",
    graph,
    compiled,
    table,
    boundary: boundary ? Object.freeze({ ...boundary }) : null,
    dimensions: { width: graph.width, height: graph.height },
  });
}

/** 显式 tile → variant 表（无旋转展开；稳定 key 排序冻结 index） */
function compileExplicitTiles(tiles) {
  const seen = new Set();
  const variants = [];
  for (const tile of tiles) {
    if (!tile || typeof tile.id !== "string" || !tile.id) throw new Error("explicit tile requires an id");
    const weight = tile.weight ?? 1;
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
      throw new Error(`explicit tile ${tile.id}: weight must be finite > 0`);
    }
    const key = `${tile.id}@r0`;
    if (seen.has(key)) throw new Error(`explicit tile duplicate id: ${tile.id}`);
    seen.add(key);
    variants.push({
      key,
      protoId: tile.id,
      transformName: "r0",
      mirror: false,
      faces: {},
      weight,
      tags: tile.tags ?? [],
      rules: {},
      signature: tile.id,
    });
  }
  variants.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const frozen = variants.map((v, i) => Object.freeze({ ...v, index: i }));
  return {
    variants: frozen,
    variantIndex: new Map(frozen.map((v, i) => [v.key, i])),
    equivalence: [],
    stats: { prototypes: tiles.length, variants: frozen.length, deduped: 0 },
  };
}

/** 显式 adjacency：整行替换（显式优先）→ 反向补齐 → 显式禁配清除。 */
function applyExplicitAdjacency(compiled, table, adjacency) {
  if (!Array.isArray(adjacency) || adjacency.length === 0) {
    throw new Error("explicit adjacency must be a non-empty array");
  }
  const n = compiled.variants.length;
  const directions = ["N", "E", "S", "W"];
  const compatible = {};
  for (const dir of directions) {
    compatible[dir] = new Array(n);
    for (let i = 0; i < n; i++) {
      compatible[dir][i] = table ? table.compatible[dir][i].clone() : new BitSet(n, false);
    }
  }
  const resolve = (ref) => {
    if (typeof ref !== "string") throw new Error("explicit adjacency endpoints must be strings");
    if (compiled.variantIndex.has(ref)) return [compiled.variantIndex.get(ref)];
    const out = [];
    compiled.variants.forEach((v, i) => {
      if (v.protoId === ref) out.push(i);
    });
    if (out.length === 0) throw new Error(`explicit adjacency: unknown tile/variant "${ref}"`);
    return out;
  };
  const flat = [];
  for (const entry of adjacency) {
    const dir = entry.direction ?? entry.dir;
    if (!OPP2[dir]) throw new Error(`explicit adjacency: unknown direction "${dir}"`);
    for (const a of resolve(entry.a)) {
      for (const b of resolve(entry.b)) {
        flat.push({ a, b, dir, allow: entry.allow !== false });
      }
    }
  }
  // pass 1：同一 (a,direction) 的 allow 条目整行替换（显式优先于 socket 派生）
  const rows = new Map();
  for (const e of flat) {
    if (!e.allow) continue;
    const key = `${e.a}|${e.dir}`;
    if (!rows.has(key)) rows.set(key, new Set());
    rows.get(key).add(e.b);
  }
  for (const [key, bs] of rows) {
    const [a, dir] = key.split("|");
    const row = new BitSet(n, false);
    for (const b of bs) row.set(b);
    compatible[dir][Number(a)] = row;
  }
  // pass 2：反向补齐（AC 要求双向一致）
  for (const e of flat) {
    if (e.allow) compatible[OPP2[e.dir]][e.b].set(e.a);
  }
  // pass 3：显式禁配最后应用（双向清除，优先于一切 allow）
  for (const e of flat) {
    if (!e.allow) {
      compatible[e.dir][e.a].clear(e.b);
      compatible[OPP2[e.dir]][e.b].clear(e.a);
    }
  }
  return {
    directions,
    compatible,
    deadVariants: [],
    isCompatible(a, direction, b) {
      return compatible[direction][a].has(b);
    },
    neighborsOf(variantIndex, direction) {
      return compatible[direction][variantIndex];
    },
  };
}

/**
 * HalfEdgeGraph SimpleTiled 模型：方向 token = 共享边朝向/长度类别。
 * 模块 faces 以类别 token 为键（每个 prototype 恰一个 variant，
 * 不规则网格不做旋转展开）；每条共享边实例的方向 token 别名到其类别行。
 */
function createHalfEdgeSimpleTiledModel({ prototypes, graph, compatibilityOptions, classifyEdge }) {
  if (!Array.isArray(prototypes) || prototypes.length === 0) {
    throw new Error("SimpleTiledModel(half-edge) requires a non-empty prototypes array");
  }
  const classify = classifyEdge || defaultEdgeClass;
  const edgeClasses = {}; // 类别 token → [共享边 key]（provenance）
  for (const edge of graph.allEdges()) {
    if (edge.owners.length < 2) continue; // 边界边无邻居，不参与传播
    const token = classify(graph.edgeGeometryOf(edge.key));
    if (typeof token !== "string" || !token) throw new Error("classifyEdge must return a non-empty token");
    (edgeClasses[token] ||= []).push(edge.key);
  }
  const tokens = Object.keys(edgeClasses).sort();
  if (tokens.length === 0) throw new Error("SimpleTiledModel(half-edge): graph has no shared edges");

  const seen = new Set();
  const variants = [];
  for (const proto of prototypes) {
    if (!proto || typeof proto.id !== "string" || !proto.id) throw new Error("half-edge prototype requires an id");
    const weight = proto.weight ?? 1;
    if (typeof weight !== "number" || !Number.isFinite(weight) || weight <= 0) {
      throw new Error(`half-edge prototype ${proto.id}: weight must be finite > 0`);
    }
    if (!proto.faces || typeof proto.faces !== "object" || Object.keys(proto.faces).length === 0) {
      throw new Error(`half-edge prototype ${proto.id}: faces must be keyed by edge-class tokens`);
    }
    if (seen.has(proto.id)) throw new Error(`half-edge prototype duplicate id: ${proto.id}`);
    seen.add(proto.id);
    variants.push({
      key: proto.id,
      protoId: proto.id,
      transformName: "r0",
      mirror: false,
      faces: proto.faces,
      weight,
      tags: proto.tags ?? [],
      rules: proto.rules ?? {},
      signature: proto.id,
    });
  }
  variants.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
  const frozen = variants.map((v, i) => Object.freeze({ ...v, index: i }));
  const compiled = {
    variants: frozen,
    variantIndex: new Map(frozen.map((v, i) => [v.key, i])),
    equivalence: [],
    stats: { prototypes: prototypes.length, variants: frozen.length, deduped: 0 },
  };
  const table = compileTokenCompatibilityTable(frozen, tokens, compatibilityOptions);
  // 每条共享边实例的方向 token（"e:{min}:{max}"）别名到其类别兼容行
  const edgeTokenClass = {}; // "e:a:b" → 类别 token
  for (const [token, keys] of Object.entries(edgeClasses)) {
    for (const key of keys) {
      const edgeToken = `e:${key.replace("|", ":")}`;
      edgeTokenClass[edgeToken] = token;
      table.compatible[edgeToken] = table.compatible[token];
    }
  }
  return Object.freeze({
    kind: "simple-tiled-2d",
    graphKind: "half-edge-graph",
    graph,
    compiled,
    table,
    boundary: null,
    edgeClasses: Object.freeze(edgeClasses),
    edgeTokenClass: Object.freeze(edgeTokenClass),
  });
}

/**
 * 缺省共享边分类器：朝向量化到 orientBins 桶（无向边折到 [0,π)），
 * 长度按 lengthStep 量化。token = "he:o{朝向桶}:l{长度桶}"。
 */
export function defaultEdgeClass({ dx, dy, length }, { orientBins = 4, lengthStep = 0.5 } = {}) {
  let angle = Math.atan2(dy, dx) % Math.PI;
  if (angle < 0) angle += Math.PI;
  const o = Math.round(angle / (Math.PI / orientBins)) % orientBins;
  const l = Math.max(0, Math.round(length / lengthStep));
  return `he:o${o}:l${l}`;
}

/** 边界允许集合 → level-0 bans（rect 网格；N=y0 / S=yMax / W=x0 / E=xMax） */
function deriveBoundaryBans(model) {
  const { graph, compiled, boundary } = model;
  const bans = [];
  const onBorder = {
    N: (x, y) => y === 0,
    S: (x, y) => y === graph.height - 1,
    W: (x) => x === 0,
    E: (x) => x === graph.width - 1,
  };
  for (const [dir, allowed] of Object.entries(boundary)) {
    const isAllowed = (v) => allowed.includes(v.protoId) || allowed.includes(v.key);
    for (let y = 0; y < graph.height; y++) {
      for (let x = 0; x < graph.width; x++) {
        if (!onBorder[dir](x, y)) continue;
        for (const v of compiled.variants) {
          if (!isAllowed(v)) bans.push({ cell: `r:${x}:${y}`, variant: v.index, reason: `boundary:${dir}` });
        }
      }
    }
  }
  return bans;
}

/** 便捷求解器：模型构建和 solveWfc 保持分离，便于 Inspector/Worker 复用。 */
export function solveSimpleTiled({ model, seed, pins = [], bans = [], ...options } = {}) {
  if (!model || model.kind !== "simple-tiled-2d") throw new Error("solveSimpleTiled requires a SimpleTiledModel");
  const boundaryBans = model.boundary ? deriveBoundaryBans(model) : [];
  return solveWfc({
    graph: model.graph,
    compiled: model.compiled,
    table: model.table,
    seed,
    pins,
    bans: [...bans, ...boundaryBans],
    ...options,
  });
}

/** 将局部坐标 pin 转成 solver 使用的稳定 cell id。 */
export function pin2D(model, x, y, variant, source = "pin-2d") {
  if (!Number.isInteger(x) || !Number.isInteger(y)) throw new Error("pin2D coordinates must be integers");
  if (x < 0 || x >= model.graph.width || y < 0 || y >= model.graph.height) {
    throw new Error(`pin2D out of bounds: ${x},${y}`);
  }
  return { cell: `r:${x}:${y}`, variant, source };
}

/** 输出可渲染层消费的 key 网格；不泄漏 WaveState。 */
export function assignmentGrid(model, result) {
  if (!result?.ok) return null;
  const out = Array.from({ length: model.graph.height }, () => Array(model.graph.width));
  for (let y = 0; y < model.graph.height; y++) {
    for (let x = 0; x < model.graph.width; x++) {
      out[y][x] = result.assignmentByCellId[`r:${x}:${y}`];
    }
  }
  return out;
}
