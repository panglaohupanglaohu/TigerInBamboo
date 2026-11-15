/**
 * node-graph-runtime.js — 节点式数据绑定（Unity ScriptableObject 节点组件那一套的网页等价物）。
 *
 * 1724449858369568780 的编辑器截图里读得出来整条链：
 *   按钮 → 一个 bool 资产（ScriptableObject）→ FloatSelectNode（On False -226.9 / On True -33.8）
 *        → FloatLerpTowardsNode（Speed 20，朝目标慢慢逼近，没有回弹）
 *        → Vector2ComposeNode（X 取 -5、Y 取上面的输出）
 *        → Vector2EventNode 的 UnityEvent → RectTransform.anchoredPosition
 * 于是"按一下按钮，一块 UI 从下面滑到上面"，中间每一站的数值都在 Inspector 里实时显示。
 *
 * 这里把这条链抽成一个通用的小运行时，只保留真正起作用的部分：
 *   - 端口（input/output）+ 有向连边；求值按拓扑序，不按连边顺序；
 *   - 有状态的节点（lerpTowards）每帧 tick(dt) 推进，值不打回起点，也不冲过目标；
 *   - sink 只在值真的变了才回调（对应 UnityEvent 的 OnValueChanged）；
 *   - 环路直接抛错——节点图不能自激。
 *
 * 没有 ES 模块副作用，纯函数式构造，浏览器与 node 都能直接用。
 */

class RuntimeNode {
  constructor(runtime, id, def) {
    this.runtime = runtime;
    this.id = id;
    this.inputs = def.inputs || [];
    this.outputs = def.outputs || [];
    this.eval = def.eval;
    this.state = def.state ?? null;
    this.kind = def.kind || 'node';
    this.type = def.type || this.kind;
    this.params = { ...(def.params || {}) };
    this.out = Object.create(null);
    this.in = Object.create(null);
    for (const k of this.inputs) this.in[k] = def.defaults?.[k] ?? 0;
    for (const k of this.outputs) this.out[k] = def.defaults?.[k] ?? 0;
  }
}

export class NodeGraph {
  constructor() {
    this.nodes = new Map();
    this.edges = [];
    this.tickCount = 0;
  }

  add(id, def) {
    if (this.nodes.has(id)) throw new RangeError(`duplicate node id ${id}`);
    if (!id || typeof id !== 'string') throw new TypeError('node id must be a string');
    const n = new RuntimeNode(this, id, def);
    this.nodes.set(id, n);
    return this;
  }

  /** link('button:out', 'select:cond') */
  link(from, to) {
    const [fromId, fromPort] = split(from);
    const [toId, toPort] = split(to);
    const a = this.nodes.get(fromId), b = this.nodes.get(toId);
    if (!a) throw new RangeError(`missing node ${fromId}`);
    if (!b) throw new RangeError(`missing node ${toId}`);
    if (!a.outputs.includes(fromPort)) throw new RangeError(`${fromId} has no output ${fromPort}`);
    if (!b.inputs.includes(toPort)) throw new RangeError(`${toId} has no input ${toPort}`);
    this.edges.push({ fromId, fromPort, toId, toPort });
    return this;
  }

  /** 拓扑序；有环直接抛错。 */
  order() {
    const indeg = new Map();
    const out = new Map();
    for (const id of this.nodes.keys()) { indeg.set(id, 0); out.set(id, []); }
    for (const e of this.edges) {
      if (e.fromId === e.toId) throw new RangeError(`self loop on ${e.fromId}`);
      indeg.set(e.toId, indeg.get(e.toId) + 1);
      out.get(e.fromId).push(e.toId);
    }
    const queue = [...this.nodes.keys()].filter((id) => indeg.get(id) === 0);
    const seq = [];
    while (queue.length) {
      const id = queue.shift();
      seq.push(id);
      for (const nxt of out.get(id)) {
        indeg.set(nxt, indeg.get(nxt) - 1);
        if (indeg.get(nxt) === 0) queue.push(nxt);
      }
    }
    if (seq.length !== this.nodes.size) throw new RangeError('node graph has a cycle');
    return seq;
  }

  /** 按拓扑序求值：上游先算完，下游再取它的 out（不能先统一搬一遍，那样拿到的是上一帧的值）。 */
  evaluate(dt = 0) {
    const seq = this.order();
    const incoming = new Map();
    for (const e of this.edges) {
      if (!incoming.has(e.toId)) incoming.set(e.toId, []);
      incoming.get(e.toId).push(e);
    }
    for (const id of seq) {
      const n = this.nodes.get(id);
      for (const e of incoming.get(id) || []) {
        n.in[e.toPort] = this.nodes.get(e.fromId).out[e.fromPort];
      }
      const res = n.eval(n.in, n.state, dt, n);
      if (res && typeof res === 'object') {
        for (const k of Object.keys(res)) if (n.outputs.includes(k)) n.out[k] = res[k];
      }
    }
    return this;
  }

  /** 推进一帧（dt 秒）。 */
  tick(dt = 0) {
    this.tickCount++;
    return this.evaluate(dt);
  }

  get(id, port = 'out') {
    const n = this.nodes.get(id);
    if (!n) throw new RangeError(`missing node ${id}`);
    return port in n.out ? n.out[port] : n.in[port];
  }

  /** 内部状态（有状态节点的当前值），给 Inspector 用。 */
  state(id) {
    const n = this.nodes.get(id);
    if (!n) throw new RangeError(`missing node ${id}`);
    return n.state;
  }

  /** 所有节点的 out 快照，页面把它摊在侧栏里。 */
  snapshot() {
    const out = {};
    for (const [id, n] of this.nodes) out[id] = { ...n.out };
    return out;
  }

  /**
   * 导出成纯 JSON：节点类型 + 参数 + 连线 + 有状态节点的当前值。
   * 对应原片里那张节点图是**可存可载的资产**（改完存盘，重开还是同一张）。
   */
  serialize({ includeState = true } = {}) {
    return {
      version: 1,
      nodes: [...this.nodes.values()].map((n) => ({
        id: n.id,
        type: n.type,
        params: { ...n.params },
        state: includeState && n.state != null ? JSON.parse(JSON.stringify(n.state)) : null,
      })),
      edges: this.edges.map((e) => ({ ...e })),
    };
  }

  /** 从 serialize() 的 JSON 重建整张图（含 lerp 的当前值，所以恢复后位置不会跳回起点）。 */
  static fromJSON(json, { registry = NODE_REGISTRY, sinkFn = () => {} } = {}) {
    if (!json || json.version !== 1 || !Array.isArray(json.nodes)) throw new RangeError('Invalid node graph json');
    const g = new NodeGraph();
    for (const n of json.nodes) {
      if (typeof n.id !== 'string' || !n.id) throw new RangeError('Invalid node id in json');
      const factory = registry[n.type];
      if (!factory) throw new RangeError(`unknown node type ${n.type}`);
      g.add(n.id, factory({ ...(n.params || {}) }, sinkFn));
      const node = g.nodes.get(n.id);
      if (n.state != null) node.state = JSON.parse(JSON.stringify(n.state));
    }
    for (const e of json.edges || []) g.link(`${e.fromId}:${e.fromPort}`, `${e.toId}:${e.toPort}`);
    return g;
  }
}

function split(port) {
  const i = port.indexOf(':');
  if (i <= 0) throw new RangeError(`port must look like node:port (${port})`);
  return [port.slice(0, i), port.slice(i + 1)];
}

/* ---- 节点工厂 ------------------------------------------------------------ */

/** bool 资产：按钮按一下就翻一次（ScriptableObject 的那个 bool）。 */
export function boolSource(initial = false) {
  return {
    kind: 'boolSource', type: 'boolSource', params: { initial: !!initial },
    inputs: [], outputs: ['out'], state: { value: !!initial },
    defaults: { out: !!initial },
    eval(_i, st) { return { out: st.value }; },
  };
}

export function constant(value = 0) {
  return {
    kind: 'constant', type: 'constant', params: { value },
    inputs: [], outputs: ['out'], defaults: { out: value }, eval: () => ({ out: value }),
  };
}

/** 可外部改值的源（测试/滑杆用）：graph.state(id).value = x */
export function variable(value = 0) {
  return {
    kind: 'variable', type: 'variable', params: { value },
    inputs: [], outputs: ['out'], state: { value }, defaults: { out: value },
    eval: (_i, st) => ({ out: st.value }),
  };
}

/** FloatSelectNode：条件为真取 onTrue，否则 onFalse。 */
export function select({ onTrue = 0, onFalse = 0 } = {}) {
  return {
    kind: 'select', type: 'select', params: { onTrue, onFalse },
    inputs: ['condition', 'onTrue', 'onFalse'], outputs: ['out'],
    defaults: { condition: false, onTrue, onFalse, out: onFalse },
    eval(i) { return { out: i.condition ? i.onTrue : i.onFalse }; },
  };
}

/**
 * FloatLerpTowardsNode：每个 tick 朝目标最多走 speed*dt，到了就停住（不冲过、不抖）。
 * speed 的单位是"每秒多少值"，跟截图里的 Speed 20 一致。
 */
export function lerpTowards({ speed = 20, initial = 0 } = {}) {
  if (!(speed > 0)) throw new RangeError('speed must be > 0');
  return {
    kind: 'lerpTowards', type: 'lerpTowards', params: { speed, initial },
    inputs: ['target'], outputs: ['out'], state: { value: initial, settled: false },
    defaults: { target: initial, out: initial },
    eval(i, st, dt) {
      const target = Number(i.target);
      const step = speed * Math.max(0, dt);
      const delta = target - st.value;
      if (Math.abs(delta) <= step) st.value = target;
      else st.value += Math.sign(delta) * step;
      st.settled = st.value === target;
      return { out: st.value };
    },
  };
}

/** Vector2ComposeNode：把两个标量拼成 {x,y}。 */
export function compose2({ x = 0, y = 0 } = {}) {
  return {
    kind: 'compose2', type: 'compose2', params: { x, y },
    inputs: ['x', 'y'], outputs: ['out'],
    defaults: { x, y, out: { x, y } },
    eval(i) { return { out: { x: i.x, y: i.y } }; },
  };
}

/** Vector2EventNode 的 sink：值真变了才回调（UnityEvent 只在改变时发）。 */
export function sink(fn, { epsilon = 0 } = {}) {
  return {
    kind: 'sink', type: 'sink', params: { epsilon },
    inputs: ['in'], outputs: [], state: { calls: 0, last: undefined },
    eval(i, st) {
      const v = i.in;
      // 上一次的值放 state（不是闭包）——这样序列化能带上，载入后不会把"没变"误判成"变了"
      const prev = st.last;
      const changed = prev === undefined
        ? true
        : typeof v === 'object' && v !== null
          ? Math.abs(v.x - prev.x) > epsilon || Math.abs(v.y - prev.y) > epsilon
          : Math.abs(v - prev) > epsilon;
      if (changed) { st.last = typeof v === 'object' && v ? { ...v } : v; st.calls++; fn(v); }
      return null;
    },
  };
}

export function multiply(k = 1) {
  return {
    kind: 'multiply', type: 'multiply', params: { k },
    inputs: ['in'], outputs: ['out'], defaults: { in: 0, out: 0 }, eval: (i) => ({ out: i.in * k }),
  };
}

export function addConstant(k = 0) {
  return {
    kind: 'addConstant', type: 'addConstant', params: { k },
    inputs: ['in'], outputs: ['out'], defaults: { in: 0, out: 0 }, eval: (i) => ({ out: i.in + k }),
  };
}

/* ---- 序列化注册表 -------------------------------------------------------- */

/**
 * 类型名 → 工厂。sink 需要运行期回调（不可序列化），由 fromJSON 的 sinkFn 注入。
 * 加新节点类型时**必须**同时在工厂里写 type/params 并在这里登记，否则存量 JSON 载不回来。
 */
export const NODE_REGISTRY = {
  boolSource: (p) => boolSource(p.initial),
  constant: (p) => constant(p.value),
  variable: (p) => variable(p.value),
  select: (p) => select(p),
  lerpTowards: (p) => lerpTowards(p),
  compose2: (p) => compose2(p),
  sink: (p, fn) => sink(fn || (() => {}), { epsilon: p.epsilon || 0 }),
  multiply: (p) => multiply(p.k),
  addConstant: (p) => addConstant(p.k),
};

/**
 * 截图里那条完整链：bool → select → lerpTowards → compose2 → sink。
 * 返回 { graph, toggle(), values() }，页面和测试都用它。
 */
export function buildToggleChain({ onFalse = -226.9, onTrue = -33.8, speed = 20, x = -5, initial = -226.9 } = {}) {
  let graph = new NodeGraph();
  const bool = boolSource(false);
  const moved = { value: null };
  graph
    .add('button', bool)
    .add('falseValue', constant(onFalse))
    .add('trueValue', constant(onTrue))
    .add('select', select({ onTrue, onFalse }))
    .add('lerp', lerpTowards({ speed, initial }))
    .add('compose', compose2({ x, y: initial }))
    .add('sink', sink((v) => { moved.value = v; }))
    .link('button:out', 'select:condition')
    .link('trueValue:out', 'select:onTrue')
    .link('falseValue:out', 'select:onFalse')
    .link('select:out', 'lerp:target')
    .link('lerp:out', 'compose:y')
    .link('compose:out', 'sink:in');
  graph.evaluate(0);
  return {
    get graph() { return graph; },
    moved,
    /** 载入 serialize() 出来的 JSON，整张图换掉（页面"载入"按钮用） */
    load(json, opts) { graph = NodeGraph.fromJSON(json, opts); graph.tick(0); return graph; },
    toggle() { graph.state('button').value = !graph.state('button').value; graph.tick(0); return graph.state('button').value; },
    set(on) { graph.state('button').value = !!on; graph.tick(0); return graph.state('button').value; },
    get position() { return graph.get('compose', 'out'); },
    get settled() { return graph.state('lerp').settled; },
  };
}
