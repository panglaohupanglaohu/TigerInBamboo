/**
 * grid.js — the town grid, rebuilt the way the reference clips show it.
 *
 * Mirrors Placemaker.GridGenerator (HexToPlane / GetSubdivisions /
 * relaxationSteps / GetQuad). The steps are the ones Oskar Stålberg animates
 * in his grid clips:
 *
 *   1147881669350891521  "Fairly even irregular quads grid in a hex"
 *     1. a big hexagon filled with a regular triangle lattice
 *     2. random adjacent triangle pairs are merged into rhombi (some triangles
 *        are left over, which is fine)
 *     3. every polygon is subdivided: a triangle becomes 3 quads, a rhombus 4
 *        (corner, edge midpoint, centre, previous edge midpoint)
 *     4. the result is relaxed so every quad tries to become a square
 *
 *   1151770831619534848 / 1332410042784641026  the relaxation runs on the
 *     quads; the hex rim is pinned so the patch keeps its outline.
 *
 * The earlier version cut each hexagon into six identical kites and jittered
 * the shared corners. That is a periodic grid with noise on top — the clips
 * show something different: the irregularity comes from *topology* (where the
 * left-over triangles and the merge directions land), and the relaxation then
 * makes every cell close to square. That is why Townscaper's cells look like
 * "squares that don't line up" instead of "random quadrilaterals".
 */

const SQRT3 = Math.sqrt(3);

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Signed area of a polygon in the XZ plane (positive = one winding). */
function signedArea(pts) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.z - q.x * p.z;
  }
  return a * 0.5;
}

const cross2 = (ax, az, bx, bz) => ax * bz - az * bx;

function isConvex(pts, eps = 1e-6) {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const c = pts[(i + 2) % pts.length];
    const k = cross2(b.x - a.x, b.z - a.z, c.x - b.x, c.z - b.z);
    if (Math.abs(k) < eps) continue;
    const s = Math.sign(k);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/**
 * @param {object} o
 * @param {number} o.radius      hexagon side, in triangles
 * @param {number} o.hexSize     triangle side length (world units)
 * @param {number} o.seed
 * @param {number} o.mergeRate   fraction of merge attempts that go through
 * @param {number} o.relaxPasses
 */
export function buildQuadGrid({ radius = 14, hexSize = 1.0, seed = 1337, mergeRate = 0.92, relaxPasses = 80 } = {}) {
  const { verts, polys, addVert, ekey } = latticeAndMerge({ radius, hexSize, seed, mergeRate });

  /* ---- 3. subdivide every polygon into quads ------------------------------ */
  const midId = new Map();
  const mid = (a, b) => {
    const k = ekey(a, b);
    let m = midId.get(k);
    if (!m) {
      m = addVert((a.x + b.x) / 2, (a.z + b.z) / 2, a.pinned && b.pinned);
      midId.set(k, m);
    }
    return m;
  };
  const quads = [];
  for (const poly of polys) {
    if (signedArea(poly) < 0) poly.reverse();
    let cx = 0, cz = 0;
    for (const p of poly) { cx += p.x; cz += p.z; }
    const c = addVert(cx / poly.length, cz / poly.length);
    const n = poly.length;
    for (let i = 0; i < n; i++) {
      const prev = poly[(i + n - 1) % n];
      const cur = poly[i];
      const next = poly[(i + 1) % n];
      quads.push([cur, mid(cur, next), c, mid(prev, cur)]);
    }
  }
  // all quads now wind with positive signed area
  for (const qd of quads) if (signedArea(qd) < 0) qd.reverse();

  /* ---- 4 + 5. relax towards squares, hand off ------------------------------ */
  for (const qd of quads) if (signedArea(qd) < 0) qd.reverse();
  relaxPolygons(quads, verts, relaxPasses);
  return finishGrid(quads, verts, { radius, hexSize, kind: 'quad', triangles: polys.filter((p) => p.length === 3).length });
}

/**
 * 第三个项目的混合网格（1447494168448753667、1447496205282549761、1579483114178768898）：
 *   "The base graph is just a humble irregular triangle grid"
 *   "a mix of triangular and square tiles"
 * 和 Townscaper 网格的区别只有一处：合并完不再细分。剩下的三角形就是三角格，合并出的菱形就是方格；
 * 松弛时三角格趋向正三角形、方格趋向正方形 —— 边长一致，所以"方，又带着六边形的味道"（1471817524148940807）。
 */
export function buildMixedGrid({ radius = 22, hexSize = 0.62, seed = 1337, mergeRate = 0.55, relaxPasses = 90 } = {}) {
  const { verts, polys } = latticeAndMerge({ radius, hexSize, seed, mergeRate });
  for (const p of polys) if (signedArea(p) < 0) p.reverse();
  relaxPolygons(polys, verts, relaxPasses);
  return finishGrid(polys, verts, { radius, hexSize, kind: 'mixed', triangles: polys.filter((p) => p.length === 3).length });
}

/**
 * 每个面趋向自己的正多边形：把各角相对形心的偏移反向旋转 i·2π/n 后取平均
 * （就是最佳拟合的正 n 边形），再把每个角拉向对应的位置。外圈顶点钉住。
 * n = 4 时与原来的"最佳拟合正方形"完全一样。
 */
function relaxPolygons(polys, verts, passes) {
  const fx = new Float64Array(verts.length), fz = new Float64Array(verts.length), fn = new Float64Array(verts.length);
  for (let pass = 0; pass < passes; pass++) {
    fx.fill(0); fz.fill(0); fn.fill(0);
    for (const pg of polys) {
      const n = pg.length;
      let cx = 0, cz = 0;
      for (const p of pg) { cx += p.x; cz += p.z; }
      cx /= n; cz /= n;
      let vx = 0, vz = 0;
      for (let i = 0; i < n; i++) {
        const a = -(i * 2 * Math.PI) / n, ca = Math.cos(a), sa = Math.sin(a);
        const ox = pg[i].x - cx, oz = pg[i].z - cz;
        vx += ox * ca - oz * sa; vz += ox * sa + oz * ca;
      }
      vx /= n; vz /= n;
      for (let i = 0; i < n; i++) {
        const a = (i * 2 * Math.PI) / n, ca = Math.cos(a), sa = Math.sin(a);
        const tx = vx * ca - vz * sa, tz = vx * sa + vz * ca;
        const p = pg[i];
        fx[p.id] += cx + tx - p.x; fz[p.id] += cz + tz - p.z; fn[p.id] += 1;
      }
    }
    const k = pass < passes * 0.5 ? 0.45 : 0.3;
    for (const v of verts) {
      if (v.pinned || fn[v.id] === 0) continue;
      v.x += (fx[v.id] / fn[v.id]) * k;
      v.z += (fz[v.id] / fn[v.id]) * k;
    }
  }
}

/**
 * 交给体素图：任意多边形的格子。
 *   cell.n            角数（3 或 4）
 *   cell.pts[i]       第 i 个角（共享顶点），边 i = pts[i] → pts[(i+1)%n]
 *   edgeNeighbors[i]  边 i 另一侧的格子（-1 = 外圈）
 *   edgeTwins[i]      同一条边在邻居里的序号（半边结构的 twin，1458921394855718917）
 */
function finishGrid(polys, verts, { radius, hexSize, kind, triangles }) {
  const ekey = (a, b) => (a.id < b.id ? a.id * 1e6 + b.id : b.id * 1e6 + a.id);
  const cells = polys.map((pg, id) => {
    // 网格生成器要求的绕序：扇形三角 (0,i,i+1) 朝 +Y
    const pts = [...pg].reverse();
    const n = pts.length;
    let cx = 0, cz = 0;
    for (const p of pts) { cx += p.x; cz += p.z; }
    return {
      id, n, pts, cx: cx / n, cz: cz / n,
      edges: new Array(n).fill(null),
      edgeNeighbors: new Array(n).fill(-1),
      edgeTwins: new Array(n).fill(-1),
      cornerNeighbors: [],
      convex: isConvex(pts),
    };
  });
  const edgeMap = new Map();
  const vertCells = new Map();
  for (const cell of cells) {
    for (let i = 0; i < cell.n; i++) {
      const a = cell.pts[i], b = cell.pts[(i + 1) % cell.n];
      cell.edges[i] = [a.id, b.id];
      const k = ekey(a, b);
      const list = edgeMap.get(k);
      if (list) list.push([cell.id, i]); else edgeMap.set(k, [[cell.id, i]]);
      let set = vertCells.get(a.id);
      if (!set) vertCells.set(a.id, (set = new Set()));
      set.add(cell.id);
    }
  }
  for (const list of edgeMap.values()) {
    if (list.length !== 2) continue;
    const [[c0, i0], [c1, i1]] = list;
    cells[c0].edgeNeighbors[i0] = c1; cells[c0].edgeTwins[i0] = i1;
    cells[c1].edgeNeighbors[i1] = c0; cells[c1].edgeTwins[i1] = i0;
  }
  for (const set of vertCells.values()) {
    const ids = [...set];
    for (const id of ids) {
      const cell = cells[id];
      for (const other of ids) {
        if (other === id || cell.edgeNeighbors.includes(other)) continue;
        if (!cell.cornerNeighbors.includes(other)) cell.cornerNeighbors.push(other);
      }
    }
  }
  const vertexCells = new Map();
  for (const [vid, set] of vertCells) vertexCells.set(vid, [...set]);
  return { kind, cells, verts, vertexCells, radius, hexSize, cellCount: cells.length, triangles };
}

/** 1670790425232175108: "pure triangle/hex and square grids ... mixed approach".
 * A true regular square control, sharing the existing cell/half-edge contract.
 * Randomly merging all possible triangle pairs can leave triangles and rhombi;
 * it is not a pure square lattice. The main game grid choices stay unchanged.
 */
export function buildSquareGrid({radius=9, cellSize=1}={}) {
  if(!Number.isInteger(radius)||radius<0||radius>128||!Number.isFinite(cellSize)||cellSize<=0) throw new RangeError('Invalid square grid size');
  const side=radius*2+1, verts=[], polys=[];
  for(let z=0;z<=side;z++)for(let x=0;x<=side;x++)verts.push({id:verts.length,x:(x-radius-.5)*cellSize,z:(z-radius-.5)*cellSize,pinned:x===0||z===0||x===side||z===side});
  const at=(x,z)=>verts[z*(side+1)+x];
  for(let z=0;z<side;z++)for(let x=0;x<side;x++)polys.push([at(x,z),at(x+1,z),at(x+1,z+1),at(x,z+1)]);
  return finishGrid(polys,verts,{radius,hexSize:cellSize,kind:'square',triangles:0});
}

/** 1447494168448753667: quads cut on both diagonals into four triangles.
 * Derive a new shared-cell grid, retaining parent ownership. This supplies
 * geometry/adjacency; it does not impose a joint four-subtile WFC constraint.
 * Source uses the existing clockwise XZ cell contract and is never mutated.
 */
export function buildTriangularSubgrid(source) {
  const verts=[],byId=new Map(),polys=[],owners=[],groups=[],cellIds=new Set();
  for(const p of source.verts){
    if(!Number.isInteger(p.id)||byId.has(p.id)||!Number.isFinite(p.x)||!Number.isFinite(p.z))throw new TypeError('Invalid source vertex');
    const copy={...p,id:verts.length};byId.set(p.id,copy);verts.push(copy);
  }
  for(const c of source.cells){
    if(!Number.isInteger(c.id)||cellIds.has(c.id)||![3,4].includes(c.pts.length))throw new TypeError('Invalid source cell');
    cellIds.add(c.id);
    const pts=c.pts.map(p=>{const v=byId.get(p.id);if(!v||v.x!==p.x||v.z!==p.z)throw new TypeError('Unknown source corner');return v;});
    let area=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];area+=a.x*b.z-b.x*a.z;}
    if(!(area<0)||!isConvex(pts))throw new RangeError('Expected convex clockwise source cell');
    const children=[];
    const add=(pg,edge)=>{children.push(polys.length);polys.push([...pg].reverse());owners.push({sourceCell:c.id,sourceEdge:edge});};
    if(pts.length===3)add(pts,-1);
    else{
      const [a,b,c,d]=pts,rx=c.x-a.x,rz=c.z-a.z,sx=d.x-b.x,sz=d.z-b.z,den=rx*sz-rz*sx;
      const t=((b.x-a.x)*sz-(b.z-a.z)*sx)/den,u=((b.x-a.x)*rz-(b.z-a.z)*rx)/den;
      if(!Number.isFinite(t)||!Number.isFinite(u)||t<=0||t>=1||u<=0||u>=1)throw new RangeError('Invalid quad diagonal intersection');
      const center={id:verts.length,x:a.x+t*rx,z:a.z+t*rz,pinned:false};verts.push(center);
      for(let e=0;e<4;e++)add([pts[e],pts[(e+1)%4],center],e);
    }
    groups.push({sourceCell:c.id,children});
  }
  const grid=finishGrid(polys,verts,{radius:source.radius,hexSize:source.hexSize,kind:'tri-subtiles',triangles:polys.length});
  grid.cells.forEach((c,i)=>Object.assign(c,owners[i]));
  grid.subdivision={parentKind:source.kind,groups};return grid;
}

/** 对边：方格的第 i 条边对着 i+2；三角格没有对边（返回 -1）。直线行走、拱门都靠它。 */
export function oppositeEdge(cell, i) { return cell.n === 4 ? (i + 2) % 4 : -1; }


/** 1–2：六边形里的三角点阵 + 随机把相邻三角形两两合并成菱形（两种网格共用）。 */
function latticeAndMerge({ radius, hexSize, seed, mergeRate }) {
  const rnd = mulberry32(seed);
  const N = radius;
  const L = hexSize;

  /* ---- 1. triangle lattice inside a hexagon ------------------------------ */
  // Axial lattice points (q, r) with |q|,|r|,|q+r| <= N.
  const latticeId = new Map();
  const verts = [];          // {id, x, z, pinned}
  const lkey = (q, r) => q * 4096 + r;
  const addVert = (x, z, pinned = false) => {
    const v = { id: verts.length, x, z, pinned };
    verts.push(v);
    return v;
  };
  const inHex = (q, r) => Math.abs(q) <= N && Math.abs(r) <= N && Math.abs(q + r) <= N;
  for (let q = -N; q <= N; q++) {
    for (let r = -N; r <= N; r++) {
      if (!inHex(q, r)) continue;
      const x = L * (q + r / 2);
      const z = L * (SQRT3 / 2) * r;
      const rim = Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) === N;
      latticeId.set(lkey(q, r), addVert(x, z, rim));
    }
  }
  const lv = (q, r) => latticeId.get(lkey(q, r));

  // Two triangles per rhombic lattice cell: "up" (q,r)(q+1,r)(q,r+1) and
  // "down" (q+1,r)(q+1,r+1)(q,r+1).
  const tris = [];
  for (let q = -N; q < N; q++) {
    for (let r = -N; r < N; r++) {
      const a = lv(q, r), b = lv(q + 1, r), c = lv(q, r + 1), d = lv(q + 1, r + 1);
      if (a && b && c) tris.push([a, b, c]);
      if (b && d && c) tris.push([b, d, c]);
    }
  }

  /* ---- 2. merge random neighbouring triangles into rhombi ----------------- */
  const ekey = (a, b) => (a.id < b.id ? a.id * 1e6 + b.id : b.id * 1e6 + a.id);
  const edgeTris = new Map();
  tris.forEach((t, ti) => {
    for (let i = 0; i < 3; i++) {
      const k = ekey(t[i], t[(i + 1) % 3]);
      const list = edgeTris.get(k);
      if (list) list.push(ti); else edgeTris.set(k, [ti]);
    }
  });

  const used = new Uint8Array(tris.length);
  const polys = [];
  const order = tris.map((_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = (rnd() * (i + 1)) | 0;
    [order[i], order[j]] = [order[j], order[i]];
  }
  for (const ti of order) {
    if (used[ti]) continue;
    const t = tris[ti];
    if (rnd() < mergeRate) {
      // candidate partners across each edge, in random order
      const cands = [];
      for (let i = 0; i < 3; i++) {
        const k = ekey(t[i], t[(i + 1) % 3]);
        for (const o of edgeTris.get(k)) if (o !== ti && !used[o]) cands.push([o, i]);
      }
      if (cands.length > 0) {
        const [o, i] = cands[(rnd() * cands.length) | 0];
        const other = tris[o];
        const a = t[i], b = t[(i + 1) % 3], c = t[(i + 2) % 3];
        const d = other.find((v) => v !== a && v !== b);
        // quad a-d-b-c keeps the shared edge (a,b) as its diagonal
        polys.push([a, d, b, c]);
        used[ti] = 1;
        used[o] = 1;
        continue;
      }
    }
    used[ti] = 1;
    polys.push([...t]);
  }

  return { verts, polys, addVert, ekey };
}

// Low-level topology finalizer; callers must validate polygon geometry first.
export { signedArea, isConvex, relaxPolygons, finishGrid };

/**
 * 无限网格用的"一块"（1332410042784641026）：中心在三角点阵 (q0, r0) 的六边形块，
 * 自己的种子 → 合并 → 细分成四边形，不松弛。外圈顶点 pinned，位置就是点阵点 / 外圈边中点，
 * 所以相邻两块在公共边上的顶点坐标完全相同（用 key 合并即可）。
 */
export function quadPatchTopology({ N = 4, L = 1, q0 = 0, r0 = 0, seed = 1 } = {}) {
  const { verts, polys, addVert, ekey } = latticeAndMerge({ radius: N, hexSize: L, seed, mergeRate: 0.92 });
  const ox = L * (q0 + r0 / 2), oz = L * (SQRT3 / 2) * r0;
  for (const v of verts) { v.x += ox; v.z += oz; }
  const midId = new Map();
  const mid = (a, b) => {
    const k = ekey(a, b);
    let m = midId.get(k);
    if (!m) { m = addVert((a.x + b.x) / 2, (a.z + b.z) / 2, a.pinned && b.pinned); midId.set(k, m); }
    return m;
  };
  const quads = [];
  for (const poly of polys) {
    if (signedArea(poly) < 0) poly.reverse();
    let cx = 0, cz = 0;
    for (const p of poly) { cx += p.x; cz += p.z; }
    const c = addVert(cx / poly.length, cz / poly.length);
    const n = poly.length;
    for (let i = 0; i < n; i++) quads.push([poly[i], mid(poly[i], poly[(i + 1) % n]), c, mid(poly[(i + n - 1) % n], poly[i])]);
  }
  for (const qd of quads) if (signedArea(qd) < 0) qd.reverse();
  return { verts, quads, center: [ox, oz] };
}


/**
 * 拓扑直线（1384958097542819845 "trace topologically straight lines across the Townscaper grid … for the gamepad
 * controls and possibly some drag-to-paint mode"）：从格子 cell 的第 i 条边出去，每到一个四边形就从对边出去，
 * 碰到三角格 / 外圈就停。返回经过的格子（不含起点）。
 */
export function traceStraightReport(grid, cell, i, max = 200) {
  if(!Number.isInteger(max)||max<0||max>100000)throw new RangeError('Invalid trace budget');
  const byId=new Map(grid.cells.map(c=>[c.id,c]));
  if(byId.size!==grid.cells.length||byId.get(cell?.id)!==cell||!Number.isInteger(i)||i<0||i>=cell.n)throw new TypeError('Invalid trace origin');
  const cells=[],segments=[],seen=new Set();
  let c=cell,e=i,reason='budget',closed=false;
  const initial=cell.id+':'+i;
  const mid=(c,e)=>{const a=c.pts[e],b=c.pts[(e+1)%c.n];return [(a.x+b.x)/2,(a.z+b.z)/2];};
  for(let step=0;step<max;step++){
    const key=c.id+':'+e;
    if(seen.has(key)){reason=key===initial?'loop':'cycle';closed=key===initial;break;}
    seen.add(key);
    const nid=c.edgeNeighbors[e];
    if(nid===-1){reason='boundary';break;}
    const next=byId.get(nid),twin=c.edgeTwins[e];
    if(!next||!Number.isInteger(twin)||twin<0||twin>=next.n||next.edgeNeighbors[twin]!==c.id||next.edgeTwins[twin]!==e)throw new Error('Nonreciprocal trace edge');
    c=next;cells.push(c);
    if(c.n!==4){segments.push({cell:c.id,entry:twin,exit:null,a:mid(c,twin),b:[c.cx,c.cz]});reason='nonquad';break;}
    e=(twin+2)%4;
    segments.push({cell:c.id,entry:twin,exit:e,a:mid(c,twin),b:mid(c,e)});
    const nextKey=c.id+':'+e;
    if(seen.has(nextKey)){reason=nextKey===initial?'loop':'cycle';closed=nextKey===initial;break;}
  }
  return {cells,segments,reason,closed,steps:cells.length,max};
}

/** Compatibility array result: excludes the start unless the walk returns to it.
 * Loop detection uses a directed cell/exit state, not just a visited cell.
 */
export function traceStraight(grid, cell, i, max = 200) {
  return traceStraightReport(grid,cell,i,max).cells;
}
