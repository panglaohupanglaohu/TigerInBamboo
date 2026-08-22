// =====================================================================
//  P1 · 城堡战术导航图（高山城堡攻防 V2）
//
//  数据源（全部由调用方注入，核心逻辑不依赖 three，Node 可直接测）：
//   - metrics:  citadelRange.citadelWalkMetrics()  台地度量（0=最高/最小半径）
//   - flights:  citadelRange.citadelWalkFlights()  台地间折返石阶
//   - walkLift: citadelRange.citadelWalkLiftLocal  可行走高程真源（视觉=碰撞）
//   - contour:  { coreRadius, notchCenter, notchHalf, notchedLayers } 瀑布缺口
//   - gates:    城堡城门/门口锚点 [{terraceIndex, x, z}]
//   - extras:   瀑布攀爬点 / 港口 / 广场 / 木马落地点
//
//  能力：稳定节点 ID · walk/stairs/ladder/waterfall-climb/door 边元数据 ·
//        分层 A*（台地区域图 → 区内细寻路）· 空间占位 · 窄道容量 ·
//        短期节点预约 · 受阻重寻路 · 按台地增量重建 · 调试可视化
// =====================================================================
import * as THREE from "three";

const RING_SPACING = 2.2; // 台面环带径向/弧向采样间距（世界单位）
const STAIR_STEP = 1.5; // 石阶路径采样间距
const NODE_LINK_DIST = 3.4; // 同层节点互联最大距离
const EDGE_DANGER = { walk: 0, stairs: 0.15, door: 0.2, ladder: 0.5, "waterfall-climb": 0.65 };

let _uid = 0;

function nodeId(kind, parts) {
  return `${kind}:${parts.join("-")}`;
}

/** 小二叉堆（A* 开放列表） */
function makeHeap() {
  const items = [];
  const keys = [];
  const swap = (i, j) => {
    [items[i], items[j]] = [items[j], items[i]];
    [keys[i], keys[j]] = [keys[j], keys[i]];
  };
  return {
    get size() {
      return items.length;
    },
    push(key, item) {
      let i = items.length;
      items.push(item);
      keys.push(key);
      while (i > 0) {
        const p = (i - 1) >> 1;
        if (keys[p] <= keys[i]) break;
        swap(p, i);
        i = p;
      }
    },
    pop() {
      const top = items[0];
      const last = items.pop();
      const lastKey = keys.pop();
      if (items.length) {
        items[0] = last;
        keys[0] = lastKey;
        let i = 0;
        for (;;) {
          const l = i * 2 + 1;
          const r = l + 1;
          let m = i;
          if (l < items.length && keys[l] < keys[m]) m = l;
          if (r < items.length && keys[r] < keys[m]) m = r;
          if (m === i) break;
          swap(m, i);
          i = m;
        }
      }
      return top;
    },
  };
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);

/**
 * @param {object} opts
 * @param {Array} opts.metrics  台地度量 [{terraceIndex, radius, height, bottom, top}]
 * @param {Array} opts.flights  石阶 [{terraceIndex, from, to, rho, yA, yB}]
 * @param {(lx:number, lz:number)=>number} opts.walkLift  可行走高程（局部系，-Infinity=不可走）
 * @param {object} [opts.contour] 瀑布缺口参数
 * @param {Array}  [opts.gates]   城门/门口 [{terraceIndex, x, z, width?}]
 * @param {object} [opts.extras]  { waterfalls:[{x,z,terraceIndex,drop}], harbor:{x,z}, plaza:{x,z}, trojanDrops:[{x,z}] }
 * @param {(x:number, z:number, terraceIndex:number)=>boolean} [opts.isBlocked] 建筑占格等禁行谓词
 */
export function createCitadelTacticalGraph(opts) {
  /** @type {Map<string, {id:string,kind:string,terrace:number|null,pos:{x,y,z},region:string}>} */
  const nodes = new Map();
  /** @type {Map<string, {id:string,a:string,b:string,type:string,length:number,width:number,slope:number,rise:number,capacity:number,danger:number,bidirectional:boolean}>} */
  const edges = new Map();
  const adjacency = new Map(); // nodeId → edgeId[]
  const regionOf = new Map(); // nodeId → region
  const regionNodes = new Map(); // region → nodeId[]

  // 占位与预约（P1：空间占位 / 窄道容量 / 短期预约）
  const occupants = new Map(); // agentId → nodeId
  const nodeOccupant = new Map(); // nodeId → agentId
  const reservations = new Map(); // nodeId → Map(agentId → expireAt)
  let clock = 0;

  const contour = opts.contour || { coreRadius: 9, notchCenter: 0.17, notchHalf: 0.3, notchedLayers: 4 };

  // ----------------------------------------------------------------- 建图
  function addNode(kind, terrace, pos, id = null) {
    const nid = id || nodeId(kind, [terrace ?? "x", _uid++]);
    const region = terrace == null ? kind : `terrace:${terrace}`;
    const node = { id: nid, kind, terrace, pos: { x: pos.x, y: pos.y, z: pos.z }, region };
    nodes.set(nid, node);
    if (!regionNodes.has(region)) regionNodes.set(region, []);
    regionNodes.get(region).push(nid);
    adjacency.set(nid, []);
    return node;
  }

  function addEdge(aId, bId, type, meta = {}) {
    const a = nodes.get(aId);
    const b = nodes.get(bId);
    if (!a || !b) return null;
    const id = `${type}:${aId}→${bId}`;
    if (edges.has(id)) return edges.get(id);
    const length = dist(a.pos, b.pos);
    const rise = Math.abs(a.pos.y - b.pos.y);
    const edge = {
      id,
      a: aId,
      b: bId,
      type,
      length,
      width: meta.width ?? 2.0,
      slope: length > 1e-6 ? rise / length : 0,
      rise,
      capacity: meta.capacity ?? Math.max(1, Math.floor((meta.width ?? 2.0) / 0.9)),
      danger: meta.danger ?? EDGE_DANGER[type] ?? 0,
      bidirectional: meta.bidirectional !== false,
    };
    edges.set(id, edge);
    adjacency.get(aId).push(id);
    if (edge.bidirectional) adjacency.get(bId).push(id);
    return edge;
  }

  function removeNode(nid) {
    for (const eid of adjacency.get(nid) || []) {
      const e = edges.get(eid);
      if (!e) continue;
      edges.delete(eid);
      const other = e.a === nid ? e.b : e.a;
      const list = adjacency.get(other);
      if (list) {
        const i = list.indexOf(eid);
        if (i >= 0) list.splice(i, 1);
      }
    }
    adjacency.delete(nid);
    const node = nodes.get(nid);
    if (node) {
      const rn = regionNodes.get(node.region);
      if (rn) {
        const i = rn.indexOf(nid);
        if (i >= 0) rn.splice(i, 1);
      }
    }
    nodes.delete(nid);
    reservations.delete(nid);
    nodeOccupant.delete(nid);
    for (const [agent, n] of occupants) if (n === nid) occupants.delete(agent);
  }

  const inNotch = (x, z, terrace) => {
    const r = Math.hypot(x, z);
    if (r <= contour.coreRadius) return false;
    const phi = Math.atan2(x, z);
    return (
      terrace > 0 &&
      terrace <= contour.notchedLayers &&
      Math.abs(phi - contour.notchCenter) < contour.notchHalf
    );
  };

  const walkable = (x, z, terrace) => {
    if (inNotch(x, z, terrace)) return false;
    if (opts.isBlocked && opts.isBlocked(x, z, terrace)) return false;
    return Number.isFinite(opts.walkLift(x, z));
  };

  /** 单台地环带采样：径向环 × 弧向段，剔除缺口/占格/不可走 */
  function buildTerraceNodes(metrics, terrace) {
    const m = metrics[terrace];
    // metrics 0=最高/最小半径：台地 t 的可走环带 = 外缘 metrics[t].radius
    // 到内缘 metrics[t-1].radius（更高一层台地的 footprint）；t=0 顶台地为圆盘
    const upper = metrics[terrace - 1] || null;
    const rOut = m.radius - 0.9;
    const rIn = upper ? upper.radius + 1.2 : 0;
    if (rOut <= rIn) {
      // 顶台地近似圆盘：单环 + 中心点
      const rMid = Math.max(1.5, rOut * 0.55);
      const segs = Math.max(6, Math.round((Math.PI * 2 * rMid) / RING_SPACING));
      for (let s = 0; s < segs; s++) {
        const phi = (s / segs) * Math.PI * 2;
        const x = Math.sin(phi) * rMid;
        const z = Math.cos(phi) * rMid;
        if (!walkable(x, z, terrace)) continue;
        addNode("ring", terrace, { x, y: opts.walkLift(x, z), z }, nodeId("t", [terrace, 0, s]));
      }
      if (walkable(0, 0, terrace)) {
        addNode("ring", terrace, { x: 0, y: opts.walkLift(0, 0), z: 0 }, nodeId("t", [terrace, 0, "c"]));
      }
      return;
    }
    const ringCount = Math.max(1, Math.round((rOut - rIn) / RING_SPACING));
    for (let ri = 0; ri < ringCount; ri++) {
      const r = rIn + ((ri + 0.5) / ringCount) * (rOut - rIn);
      const segs = Math.max(6, Math.round((Math.PI * 2 * r) / RING_SPACING));
      for (let s = 0; s < segs; s++) {
        const phi = (s / segs) * Math.PI * 2;
        const x = Math.sin(phi) * r;
        const z = Math.cos(phi) * r;
        if (!walkable(x, z, terrace)) continue;
        addNode("ring", terrace, { x, y: opts.walkLift(x, z), z }, nodeId("t", [terrace, ri, s]));
      }
    }
  }

  /** 台地内互联：弧向邻居 + 径向最近邻（k 最近 4，限距；跨缺口/占格的弦剔除） */
  function linkTerraceEdges(terrace) {
    const list = (regionNodes.get(`terrace:${terrace}`) || []).map((id) => nodes.get(id));
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      const near = [];
      for (let j = 0; j < list.length; j++) {
        if (i === j) continue;
        const b = list[j];
        const d = dist(a.pos, b.pos);
        if (d <= NODE_LINK_DIST) near.push([d, b]);
      }
      near.sort((p, q) => p[0] - q[0]);
      for (const [d, b] of near.slice(0, 4)) {
        if (a.id > b.id) continue;
        // 弦中点必须仍可走：防止横跨瀑布缺口/建筑占格拉出"空中直线"
        const mx = (a.pos.x + b.pos.x) / 2;
        const mz = (a.pos.z + b.pos.z) / 2;
        if (!walkable(mx, mz, terrace)) continue;
        addEdge(a.id, b.id, "walk", { width: Math.min(3, d * 0.8) });
      }
    }
  }

  /** 石阶：沿圆弧采样节点串，两端接最近台面节点 */
  function buildFlight(flight, index) {
    const m = opts.metrics[flight.terraceIndex];
    if (!m) return;
    const span = Math.abs(flight.to - flight.from) * flight.rho;
    const steps = Math.max(2, Math.ceil(span / STAIR_STEP));
    let prevId = null;
    const ends = [];
    for (let k = 0; k <= steps; k++) {
      const u = k / steps;
      const phi = flight.from + (flight.to - flight.from) * u;
      const x = Math.sin(phi) * flight.rho;
      const z = Math.cos(phi) * flight.rho;
      const y = opts.walkLift(x, z);
      const node = addNode(
        "stair",
        flight.terraceIndex,
        { x, y: Number.isFinite(y) ? y : flight.yA + (flight.yB - flight.yA) * u, z },
        nodeId("stair", [index, k])
      );
      if (prevId) {
        addEdge(prevId, node.id, "stairs", { width: 1.6, capacity: 1 });
      }
      prevId = node.id;
      if (k === 0 || k === steps) ends.push(node);
    }
    // 两端接入上下台面最近节点（合法台地切换只走 stairs 边）：
    // 顶端（k=steps, y=yB）必须接本层台地，底端（k=0, y=yA）接下一层台地——
    // 石阶贴着本层外壁下行，几何上最近的环点反而是下一层，不能用纯最近邻。
    ends.forEach((end, ei) => {
      const targetTerrace = ei === 1 ? flight.terraceIndex : flight.terraceIndex + 1;
      let best = null;
      let bestD = Infinity;
      for (const [, n] of nodes) {
        if (n.kind !== "ring" || n.terrace !== targetTerrace) continue;
        const d = dist(end.pos, n.pos);
        if (d < bestD) {
          bestD = d;
          best = n;
        }
      }
      if (best && bestD < NODE_LINK_DIST * 1.6) {
        // 端点接驳也算 stairs：台地切换只允许经 stairs/door/ladder/waterfall-climb
        addEdge(end.id, best.id, "stairs", { width: 1.6, capacity: 2 });
      }
    });
  }

  function nearestNode(pos, filter = null) {
    let best = null;
    let bestD = Infinity;
    for (const [, n] of nodes) {
      if (filter && !filter(n)) continue;
      const d = dist(pos, n.pos);
      if (d < bestD) {
        bestD = d;
        best = n;
      }
    }
    return best ? { node: best, dist: bestD } : null;
  }

  function buildGates(gates) {
    // gateIndex 用调用方传入的原始序号（增量重建过滤后仍保持 ID 稳定）
    gates.forEach((g) => {
      const i = g.gateIndex ?? 0;
      const y = opts.walkLift(g.x, g.z);
      const node = addNode(
        "gate",
        g.terraceIndex ?? null,
        { x: g.x, y: Number.isFinite(y) ? y : 0, z: g.z },
        nodeId("gate", [g.terraceIndex ?? "x", i])
      );
      const near = nearestNode(node.pos, (n) => n.kind === "ring" || n.kind === "stair");
      if (near) {
        addEdge(node.id, near.node.id, "door", {
          width: g.width ?? 1.2,
          capacity: 1,
        });
      }
    });
  }

  function buildExtras(extras) {
    if (!extras) return;
    (extras.waterfalls || []).forEach((w, i) => {
      const y = opts.walkLift(w.x, w.z);
      const node = addNode(
        "waterfall",
        w.terraceIndex ?? null,
        { x: w.x, y: Number.isFinite(y) ? y : 0, z: w.z },
        nodeId("wf", [i])
      );
      const near = nearestNode(node.pos, (n) => n.kind === "ring" || n.kind === "stair");
      if (near) {
        // 瀑布攀爬边：危险、单人、仅上行（从低到高单向）
        const upFirst = near.node.pos.y >= node.pos.y;
        addEdge(upFirst ? node.id : near.node.id, upFirst ? near.node.id : node.id, "waterfall-climb", {
          width: 1.0,
          capacity: 1,
          bidirectional: false,
        });
      }
    });
    for (const [key, label] of [
      ["harbor", "harbor"],
      ["plaza", "plaza"],
    ]) {
      const p = extras[key];
      if (!p) continue;
      const y = opts.walkLift(p.x, p.z);
      const node = addNode(label, null, { x: p.x, y: Number.isFinite(y) ? y : 0, z: p.z }, label);
      const near = nearestNode(node.pos, (n) => n.kind === "ring");
      if (near) addEdge(node.id, near.node.id, "walk", { width: 3, capacity: 4 });
    }
    (extras.trojanDrops || []).forEach((p, i) => {
      const y = opts.walkLift(p.x, p.z);
      const node = addNode(
        "trojan-drop",
        null,
        { x: p.x, y: Number.isFinite(y) ? y : 0, z: p.z },
        nodeId("drop", [i])
      );
      const near = nearestNode(node.pos, (n) => n.kind === "ring");
      if (near) addEdge(node.id, near.node.id, "walk", { width: 2, capacity: 2 });
    });
  }

  // ----------------------------------------------------------------- 重建
  let _signature = null;
  function signature(metrics, flights) {
    const tm = metrics.map((m) => `${m.radius.toFixed(3)}:${m.top.toFixed(3)}`).join("|");
    const fm = flights
      .map((f) => `${f.terraceIndex}:${f.from.toFixed(3)}:${f.to.toFixed(3)}:${f.rho.toFixed(3)}`)
      .join("|");
    return `${tm}#${fm}`;
  }

  function buildAll() {
    for (const nid of [...nodes.keys()]) removeNode(nid);
    opts.metrics.forEach((_, t) => buildTerraceNodes(opts.metrics, t));
    opts.metrics.forEach((_, t) => linkTerraceEdges(t));
    opts.flights.forEach((f, i) => buildFlight(f, i));
    buildGates((opts.gates || []).map((g, i) => ({ ...g, gateIndex: i })));
    buildExtras(opts.extras);
    _signature = signature(opts.metrics, opts.flights);
  }

  /**
   * 增量重建：只重建度量/石阶发生变化的台地（含其石阶与关联边），
   * 其余台地节点 ID 与路径保持不变。编辑器热重建后由调用方传入新数据。
   * @returns {number[]} 实际重建的台地
   */
  function rebuildChanged(newMetrics, newFlights) {
    const changed = [];
    for (let t = 0; t < newMetrics.length; t++) {
      const o = opts.metrics[t];
      const n = newMetrics[t];
      if (
        !o ||
        Math.abs(o.radius - n.radius) > 1e-6 ||
        Math.abs(o.top - n.top) > 1e-6 ||
        opts.flights.some(
          (f, i) =>
            f.terraceIndex === t &&
            newFlights[i] &&
            (Math.abs(f.from - newFlights[i].from) > 1e-6 ||
              Math.abs(f.to - newFlights[i].to) > 1e-6 ||
              Math.abs(f.rho - newFlights[i].rho) > 1e-6)
        )
      ) {
        changed.push(t);
      }
    }
    if (newMetrics.length !== opts.metrics.length || opts.flights.length !== newFlights.length) {
      buildAllWith(newMetrics, newFlights);
      return opts.metrics.map((_, t) => t);
    }
    if (!changed.length) return [];
    // 拆除变化台地的节点；石阶连接「本层 + 下一层」，触及变化台地的石阶一并重建
    const changedSet = new Set(changed);
    const flightsToRebuild = [];
    newFlights.forEach((f, i) => {
      if (changedSet.has(f.terraceIndex) || changedSet.has(f.terraceIndex + 1)) {
        flightsToRebuild.push(i);
      }
    });
    const flightSet = new Set(flightsToRebuild);
    for (const nid of [...nodes.keys()]) {
      const n = nodes.get(nid);
      if (n.terrace != null && changedSet.has(n.terrace)) {
        removeNode(nid);
      } else if (n.kind === "stair") {
        const fi = +n.id.split(":")[1].split("-")[0];
        if (flightSet.has(fi)) removeNode(nid);
      }
    }
    opts.metrics = newMetrics;
    opts.flights = newFlights;
    for (const t of changed) {
      buildTerraceNodes(opts.metrics, t);
      linkTerraceEdges(t);
    }
    for (const i of flightsToRebuild) buildFlight(opts.flights[i], i);
    // 门/瀑布等挂在变化台地上的附属节点一并重建
    for (const nid of [...nodes.keys()]) {
      const n = nodes.get(nid);
      if (
        (n.kind === "gate" || n.kind === "waterfall") &&
        n.terrace != null &&
        changed.includes(n.terrace)
      ) {
        removeNode(nid);
      }
    }
    buildGates(
      (opts.gates || [])
        .map((g, i) => ({ ...g, gateIndex: i }))
        .filter((g) => changed.includes(g.terraceIndex))
    );
    _signature = signature(opts.metrics, opts.flights);
    return changed;
  }

  function buildAllWith(metrics, flights) {
    opts.metrics = metrics;
    opts.flights = flights;
    buildAll();
  }

  // ----------------------------------------------------------------- 寻路
  /** 区域粗图：跨区域边（stairs/ladder/waterfall-climb/door 或不同 region 的 walk） */
  function coarsePath(fromRegion, toRegion) {
    if (fromRegion === toRegion) return [fromRegion];
    const prev = new Map();
    const cost = new Map([[fromRegion, 0]]);
    const heap = makeHeap();
    heap.push(0, fromRegion);
    const gateways = new Map(); // region → edgeId[]
    for (const [, e] of edges) {
      const ra = nodes.get(e.a)?.region;
      const rb = nodes.get(e.b)?.region;
      if (!ra || !rb || ra === rb) continue;
      if (!gateways.has(ra)) gateways.set(ra, []);
      gateways.get(ra).push(e);
      if (e.bidirectional) {
        if (!gateways.has(rb)) gateways.set(rb, []);
        gateways.get(rb).push(e);
      }
    }
    while (heap.size) {
      const region = heap.pop();
      if (region === toRegion) {
        const path = [region];
        let cur = region;
        while (prev.has(cur)) {
          cur = prev.get(cur);
          path.unshift(cur);
        }
        return path;
      }
      for (const e of gateways.get(region) || []) {
        const ra = nodes.get(e.a).region;
        const rb = nodes.get(e.b).region;
        const next = ra === region ? rb : ra;
        if (nodes.get(e.a).region !== region && !e.bidirectional && nodes.get(e.b).region !== region) continue;
        const c = cost.get(region) + e.length * (1 + e.danger);
        if (c < (cost.get(next) ?? Infinity)) {
          cost.set(next, c);
          prev.set(next, region);
          heap.push(c, next);
        }
      }
    }
    return null;
  }

  /**
   * 分层 A*：先区域粗路，再在路径区域内细寻路。
   * @param {string} fromId
   * @param {string} toId
   * @param {object} [opt] { agentId, avoid:Set<nodeId>, respectReservations=true }
   * @returns {string[]|null} 节点 ID 路径（含首尾）
   */
  function findPath(fromId, toId, opt = {}) {
    const from = nodes.get(fromId);
    const to = nodes.get(toId);
    if (!from || !to) return null;
    const regions = coarsePath(from.region, to.region);
    if (!regions) return null;
    const allowed = new Set(regions);
    const reservedByOther = (nid) => {
      if (opt.respectReservations === false || !opt.agentId) return false;
      const r = reservations.get(nid);
      if (!r) return false;
      for (const [agent, expiry] of r) {
        if (agent !== opt.agentId && expiry > clock) return true;
      }
      return false;
    };
    const open = makeHeap();
    const g = new Map([[fromId, 0]]);
    const prev = new Map();
    const h = (nid) => dist(nodes.get(nid).pos, to.pos);
    open.push(h(fromId), fromId);
    while (open.size) {
      const cur = open.pop();
      if (cur === toId) {
        const path = [cur];
        let c = cur;
        while (prev.has(c)) {
          c = prev.get(c);
          path.unshift(c);
        }
        if (opt.agentId) reservePath(opt.agentId, path);
        return path;
      }
      for (const eid of adjacency.get(cur) || []) {
        const e = edges.get(eid);
        if (!e) continue;
        const next = e.a === cur ? e.b : e.a;
        if (!e.bidirectional && e.a !== cur) continue; // 单向边只能顺行
        const nn = nodes.get(next);
        if (!allowed.has(nn.region)) continue;
        if (opt.avoid && opt.avoid.has(next)) continue;
        if (reservedByOther(next)) continue;
        // 窄道容量：同帧占位者超过容量视为不可通过（等待/重寻路由调用方决定）
        if (nodeOccupant.has(next) && nodeOccupant.get(next) !== opt.agentId) {
          const occ = [...nodeOccupant.entries()].filter(([n]) => n === next).length;
          if (occ >= e.capacity) continue;
        }
        const cost = e.length * (1 + e.danger * 2) * (2 / Math.max(0.5, e.width));
        const ng = g.get(cur) + cost;
        if (ng < (g.get(next) ?? Infinity)) {
          g.set(next, ng);
          prev.set(next, cur);
          open.push(ng + h(next), next);
        }
      }
    }
    return null;
  }

  /** 受阻重寻路：绕开指定节点集合再寻路 */
  function repath(fromId, toId, blockedIds, opt = {}) {
    return findPath(fromId, toId, { ...opt, avoid: new Set(blockedIds) });
  }

  // ------------------------------------------------------- 占位 / 预约
  function tick(dt = 1 / 60) {
    clock += dt;
    for (const [nid, rs] of reservations) {
      for (const [agent, expiry] of rs) {
        if (expiry <= clock) rs.delete(agent);
      }
      if (!rs.size) reservations.delete(nid);
    }
  }

  function occupy(agentId, nid) {
    const prev = occupants.get(agentId);
    if (prev && nodeOccupant.get(prev) === agentId) nodeOccupant.delete(prev);
    occupants.set(agentId, nid);
    if (nid) nodeOccupant.set(nid, agentId);
  }

  function releaseAgent(agentId) {
    const prev = occupants.get(agentId);
    if (prev && nodeOccupant.get(prev) === agentId) nodeOccupant.delete(prev);
    occupants.delete(agentId);
    for (const [, rs] of reservations) rs.delete(agentId);
  }

  function reservePath(agentId, path, ttl = 1.2) {
    for (const nid of path) {
      if (!reservations.has(nid)) reservations.set(nid, new Map());
      reservations.get(nid).set(agentId, clock + ttl);
    }
  }

  /** 动态攻城梯：搭建/拆除即局部增删节点与 ladder 边（不动台面图块） */
  function addLadder(id, base, top, capture = null) {
    const y0 = opts.walkLift(base.x, base.z);
    const y1 = opts.walkLift(top.x, top.z);
    const b = addNode("ladder-base", null, { x: base.x, y: Number.isFinite(y0) ? y0 : base.y ?? 0, z: base.z }, `lad:${id}:base`);
    const t = addNode("ladder-top", null, { x: top.x, y: Number.isFinite(y1) ? y1 : top.y ?? 0, z: top.z }, `lad:${id}:top`);
    addEdge(b.id, t.id, "ladder", { width: 0.9, capacity: 1, bidirectional: false });
    for (const n of [b, t]) {
      const near = nearestNode(n.pos, (x) => x.kind === "ring" || x.kind === "stair");
      if (near) addEdge(n.id, near.node.id, "walk", { width: 1.4, capacity: 2 });
    }
    if (capture) {
      const y2 = opts.walkLift(capture.x, capture.z);
      const c = addNode("ladder-capture", null, { x: capture.x, y: Number.isFinite(y2) ? y2 : capture.y ?? 0, z: capture.z }, `lad:${id}:cap`);
      addEdge(t.id, c.id, "walk", { width: 1.4, capacity: 2 });
    }
    return { base: b.id, top: t.id, capture: capture ? `lad:${id}:cap` : null };
  }

  function removeLadder(id) {
    for (const nid of [`lad:${id}:base`, `lad:${id}:top`, `lad:${id}:cap`]) {
      if (nodes.has(nid)) removeNode(nid);
    }
  }

  /** 城镇编辑（门口增删）后刷新门节点：全量重建 gate 节点，台面图块不动 */
  function refreshGates(newGates) {
    for (const nid of [...nodes.keys()]) {
      if (nodes.get(nid)?.kind === "gate") removeNode(nid);
    }
    opts.gates = newGates;
    buildGates(newGates.map((g, i) => ({ ...g, gateIndex: i })));
  }

  // ----------------------------------------------------------------- 导出
  buildAll();

  return {
    nodes,
    edges,
    adjacency,
    node: (id) => nodes.get(id) || null,
    edge: (id) => edges.get(id) || null,
    regionOf: (id) => nodes.get(id)?.region ?? null,
    regionNodes: (region) => (regionNodes.get(region) || []).slice(),
    findPath,
    repath,
    nearestNode: (pos, filter) => nearestNode(pos, filter),
    occupy,
    releaseAgent,
    reservePath,
    reservations,
    occupants,
    tick,
    rebuildChanged,
    rebuildAll: buildAll,
    signature: () => _signature,
    addLadder,
    removeLadder,
    stats() {
      const byType = {};
      for (const [, e] of edges) byType[e.type] = (byType[e.type] || 0) + 1;
      return { nodes: nodes.size, edges: edges.size, edgeTypes: byType, regions: regionNodes.size };
    },
  };
}

// ---------------------------------------------------------------------
//  调试可视化（P1）：节点球（按 kind 着色）、边线（按 type 着色）、
//  占位红闪、预约紫环、当前路径高亮。仅调试模式挂载。
// ---------------------------------------------------------------------
const DEBUG_NODE_COLORS = {
  ring: 0x66ccff,
  stair: 0xffcc66,
  gate: 0xff6666,
  waterfall: 0x66ffcc,
  harbor: 0xffff88,
  plaza: 0xffaaff,
  "trojan-drop": 0xffffff,
  "ladder-base": 0xdddddd,
  "ladder-top": 0xdddddd,
  "ladder-capture": 0xffdd88,
};
const DEBUG_EDGE_COLORS = {
  walk: 0x2e8b9a,
  stairs: 0xffaa33,
  door: 0xff5555,
  ladder: 0xdddddd,
  "waterfall-climb": 0x44ffbb,
};

/**
 * @param {object} graph createCitadelTacticalGraph 返回值
 * @param {(pos:{x,y,z})=>THREE.Vector3} toWorld 局部→世界坐标（如 castle.localToWorld）
 */
export function createTacticalGraphDebugView(graph, toWorld = (p) => new THREE.Vector3(p.x, p.y, p.z)) {
  const root = new THREE.Group();
  root.name = "tactical-graph-debug";
  const rebuild = () => {
    root.clear();
    const nodePts = [];
    const nodeColors = [];
    const c = new THREE.Color();
    for (const [, n] of graph.nodes) {
      const w = toWorld(n.pos);
      nodePts.push(w.x, w.y, w.z);
      c.setHex(DEBUG_NODE_COLORS[n.kind] ?? 0xffffff);
      nodeColors.push(c.r, c.g, c.b);
    }
    const ng = new THREE.BufferGeometry();
    ng.setAttribute("position", new THREE.Float32BufferAttribute(nodePts, 3));
    ng.setAttribute("color", new THREE.Float32BufferAttribute(nodeColors, 3));
    const pts = new THREE.Points(
      ng,
      new THREE.PointsMaterial({ size: 0.5, vertexColors: true, sizeAttenuation: true })
    );
    pts.name = "tg-nodes";
    root.add(pts);

    const linePts = [];
    const lineColors = [];
    for (const [, e] of graph.edges) {
      const a = graph.node(e.a);
      const b = graph.node(e.b);
      if (!a || !b) continue;
      const wa = toWorld(a.pos);
      const wb = toWorld(b.pos);
      linePts.push(wa.x, wa.y, wa.z, wb.x, wb.y, wb.z);
      c.setHex(DEBUG_EDGE_COLORS[e.type] ?? 0xffffff);
      lineColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute("position", new THREE.Float32BufferAttribute(linePts, 3));
    lg.setAttribute("color", new THREE.Float32BufferAttribute(lineColors, 3));
    const lines = new THREE.LineSegments(
      lg,
      new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.7 })
    );
    lines.name = "tg-edges";
    root.add(lines);
  };
  rebuild();
  return { root, rebuild };
}
