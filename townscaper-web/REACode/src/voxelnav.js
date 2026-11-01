/**
 * voxelnav.js — 三维体素上的导航：不止"站在最高面"，还要能从**拱洞里穿过去**。
 *
 * 原文（x.com/OskSta/status/906425294533394432, 2017-09-09）：
 *
 *   "It's like navigating a Swiss cheese"
 *
 * 画面（24 帧，440²）：一座紫色的城堡由几片高大厚板拼成，板上有**拱形洞口**；
 * 几十个白色小人沿着墙顶走、也**从洞里穿到另一侧**；后段一行人停在一小块平台上。
 *
 * 另一条同题的（x.com/OskSta/status/797119718477991936, 2016-11-11，"got some basic
 * navigation going"）是它一年前的版本：白模一块块拼起来，几个红/绿小点在楼体里
 * 上下穿行 —— 同样不是"贴地爬行"，而是"在体素里找能站的格子"。
 *
 * 为什么需要单独的模块：我们现有的 `src/navgraph.js` 是**每格一个高度**的二维图
 * （4 邻接 + 台阶差），它在"墙上有洞"这种结构上直接失效 —— 洞口那一格的高度是
 * 墙顶，于是"洞里能走"这件事在数据上根本不存在。这里改成在**体素体积**上找可站
 * 节点：(x,y,z) 空、且下方是实心；水平 4 邻接、竖直 ±1 级台阶。于是同一根柱子里
 * 可以有好几层节点，拱洞就是 y 较低的那一层。
 */

/**
 * @param {(x:number,y:number,z:number)=>boolean} solid 体素是否实心
 * @param {{nx:number, ny:number, nz:number}} dims
 * @returns {{
 *   nodes:number[], ids:Int32Array, neighbors:(id:number)=>number[],
 *   bfs:(start:number)=>{dist:Int32Array, prev:Int32Array},
 *   path:(a:number,b:number)=>number[],
 *   stats:()=>object, componentOf:(id:number)=>number
 * }}
 */
export function buildVoxelNav(solid, { nx, ny, nz }) {
  const key = (x, y, z) => (y * nz + z) * nx + x;
  const ids = new Int32Array(nx * ny * nz).fill(-1);
  const nodes = [];               // { x,y,z,key }

  // --- 可站节点：空气 + 脚下实心（y=0 视为地面层，脚踩地基） ---
  for (let y = 0; y < ny; y++) {
    for (let z = 0; z < nz; z++) {
      for (let x = 0; x < nx; x++) {
        if (solid(x, y, z)) continue;
        const stand = y === 0 ? true : solid(x, y - 1, z);
        if (!stand) continue;
        ids[key(x, y, z)] = nodes.length;
        nodes.push({ x, y, z, k: key(x, y, z) });
      }
    }
  }

  const at = (x, y, z) => {
    if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) return -1;
    return ids[key(x, y, z)];
  };

  // --- 邻接：水平 4 向（同层）+ 竖直 ±1（一级台阶/拱洞上下沿） ---
  const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 0, 1], [0, 0, -1], [0, 1, 0], [0, -1, 0]];
  const adj = new Array(nodes.length);
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i];
    const out = [];
    for (const [dx, dy, dz] of DIRS) {
      const j = at(n.x + dx, n.y + dy, n.z + dz);
      if (j >= 0) out.push(j);
    }
    adj[i] = out;
  }

  /** 从起点做 BFS，返回每层代价（每步算 1；竖直也算 1，不做惩罚）。 */
  function bfs(start) {
    const dist = new Int32Array(nodes.length).fill(-1);
    const prev = new Int32Array(nodes.length).fill(-1);
    if (start < 0 || start >= nodes.length) return { dist, prev };
    dist[start] = 0;
    const q = [start];
    for (let qi = 0; qi < q.length; qi++) {
      const id = q[qi];
      for (const nb of adj[id]) {
        if (dist[nb] >= 0) continue;
        dist[nb] = dist[id] + 1;
        prev[nb] = id;
        q.push(nb);
      }
    }
    return { dist, prev };
  }

  /** 连通块编号：多个洞厅互不连通时能一眼看出来。 */
  function components() {
    const comp = new Int32Array(nodes.length).fill(-1);
    let c = 0;
    for (let i = 0; i < nodes.length; i++) {
      if (comp[i] >= 0) continue;
      const q = [i];
      comp[i] = c;
      for (let qi = 0; qi < q.length; qi++) {
        for (const nb of adj[q[qi]]) if (comp[nb] < 0) { comp[nb] = c; q.push(nb); }
      }
      c++;
    }
    let largest = 0;
    const sizes = new Array(c).fill(0);
    for (let i = 0; i < nodes.length; i++) sizes[comp[i]]++;
    for (const s of sizes) if (s > largest) largest = s;
    return { comp, count: c, sizes, largest, largestShare: largest / Math.max(1, nodes.length) };
  }

  const compInfo = components();

  function path(a, b) {
    const { prev } = bfs(a);
    if (b < 0 || b >= nodes.length || (prev[b] < 0 && b !== a)) return [];
    const out = [];
    for (let id = b; id >= 0; id = prev[id]) { out.push(id); if (id === a) break; }
    return out.reverse();
  }

  return {
    nodes, ids, dims: { nx, ny, nz },
    neighbors: (id) => adj[id] || [],
    bfs, path, components,
    componentOf: (id) => compInfo.comp[id],
    stats() {
      // 分层：以最低一层为地面基准，"架空"= 比它高的节点（楼板、拱洞上沿）。
      // 这个比例就是"这张图有多少是二维高度图表达不了的"。
      let floorY = Infinity;
      for (const n of nodes) if (n.y < floorY) floorY = n.y;
      let elevated = 0;
      for (const n of nodes) if (n.y > floorY) elevated++;
      return {
        nodes: nodes.length,
        elevated,
        floorY: Number.isFinite(floorY) ? floorY : -1,
        elevatedShare: +(elevated / Math.max(1, nodes.length)).toFixed(3),
        components: compInfo.count,
        largest: compInfo.largest,
        largestShare: +compInfo.largestShare.toFixed(3),
        dims: `${nx}×${ny}×${nz}`,
      };
    },
  };
}

/**
 * 同一份体素数据的**二维对照**：只保留每列最高的可站点（= 我们现有 navgraph 的假设）。
 *
 * 这条不是凑数：原文"瑞士奶酪"的意思正是二维图做不到的事。把两者跑一遍，
 * 就能量出"隧道"到底丢了多少连通性。
 */
export function buildHeightmapNav(solid, { nx, ny, nz }) {
  const top = new Int32Array(nx * nz).fill(-1);
  for (let z = 0; z < nz; z++) {
    for (let x = 0; x < nx; x++) {
      for (let y = ny - 1; y >= 1; y--) {
        // "最高的可站点" = 空 且 脚下实心。之前写成"最高的空格子"，
        // 没有墙的列会取到 y=9（天花板），整张高度图全错。
        if (!solid(x, y, z) && solid(x, y - 1, z)) { top[z * nx + x] = y; break; }
      }
    }
  }
  const id = (x, z) => (x < 0 || z < 0 || x >= nx || z >= nz) ? -1 : (top[z * nx + x] >= 0 ? z * nx + x : -1);
  const adj = new Map();
  for (let z = 0; z < nz; z++) {
    for (let x = 0; x < nx; x++) {
      const me = id(x, z);
      if (me < 0) continue;
      const h = top[me];
      const out = [];
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ni = id(x + dx, z + dz);
        if (ni < 0) continue;
        if (Math.abs(top[ni] - h) <= 1) out.push(ni);   // 只能上下 1 级
      }
      adj.set(me, out);
    }
  }
  function reach(a, b) {
    if (a < 0 || b < 0 || !adj.has(a)) return false;
    const seen = new Set([a]);
    const q = [a];
    for (let qi = 0; qi < q.length; qi++) {
      for (const nb of adj.get(q[qi]) || []) if (!seen.has(nb)) { seen.add(nb); q.push(nb); }
    }
    return seen.has(b);
  }
  return { top, id, adj, reach, cells: adj.size };
}
