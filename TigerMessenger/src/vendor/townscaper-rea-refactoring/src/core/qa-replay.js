import { MAX_LEVEL } from './world.js';

/** Local deterministic stress sequence inspired by 1344290848180203523's edits.
 * Not a recovered original test runner or a claim that vivid colors prove QA. */
export function makeQASequence(world) {
  const cells = [...world.cells].sort((a,b) => Math.hypot(a.cx,a.cz)-Math.hypot(b.cx,b.cz) || a.id-b.id).slice(0,4);
  return cells.flatMap((cell,i) => [
    {cell:cell.id,level:MAX_LEVEL,on:true,color:i % world.palette.colors.length},
    {cell:cell.id,level:MAX_LEVEL-1,on:true,color:i % world.palette.colors.length},
    {cell:cell.id,level:MAX_LEVEL-1,on:false},
    {cell:cell.id,level:1,on:false},
  ]);
}
export function applyQAStep(world, step) {
  const {cell,level,on,color}=step;
  if(!Number.isInteger(cell)||!world.cells[cell]||!Number.isInteger(level)||level<1||level>MAX_LEVEL||typeof on!=='boolean'||(color!==undefined&&(!Number.isInteger(color)||color<0||color>=world.palette.colors.length)))throw new RangeError('Invalid QA edit');
  world.setSolid(world.cells[cell],level,on);
  if(color!==undefined&&world.color[cell]!==color){world.color[cell]=color;world.touch();}
}
export function auditQAGeometry(geometry) {
  const position=geometry.getAttribute('position'), color=geometry.getAttribute('color'), normal=geometry.getAttribute('normal');
  const errors=[];
  for(const [name,a] of [['position',position],['color',color],['normal',normal]]) {
    if(!a||a.itemSize!==3||a.count!==position?.count)errors.push(`${name}: missing/mismatched attribute`);
    else if(!a.array.every(Number.isFinite))errors.push(`${name}: nonfinite values`);
  }
  const index=geometry.index, count=index?.count??position?.count??0;
  if(count%3)errors.push('Incomplete triangle');
  if(index&&(!index.array.every(i=>i>=0&&i<position.count)))errors.push('Index outside vertex range');
  let degenerateTriangles=0;
  if(!errors.length)for(let j=0;j<count;j+=3){
    const ids=[0,1,2].map(k=>index?index.array[j+k]:j+k),p=position.array;
    const u=[0,1,2].map(k=>p[ids[1]*3+k]-p[ids[0]*3+k]),v=[0,1,2].map(k=>p[ids[2]*3+k]-p[ids[0]*3+k]);
    if(Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])<1e-10)degenerateTriangles++;
  }
  return {valid:errors.length===0,errors,vertices:position?.count??0,triangles:count/3,degenerateTriangles};
}

/* ---- r222 漏面 / 悬空支撑核查 ---------------------------------------------------
 * 与 meshwriter.edgeOut 同式的边单位外法线（本文件不引 three，故内联）。 */
function edgeOut(cell, i) {
  const a = cell.pts[i], b = cell.pts[(i + 1) % cell.n];
  let nx = -(b.z - a.z), nz = b.x - a.x;
  const l = Math.hypot(nx, nz) || 1;
  nx /= l; nz /= l;
  if (nx * ((a.x + b.x) / 2 - cell.cx) + nz * ((a.z + b.z) / 2 - cell.cz) < 0) { nx = -nx; nz = -nz; }
  return [nx, nz];
}
const nbrOf = (world, c, i) => { const id = c.edgeNeighbors[i]; return id >= 0 ? world.cells[id] : null; };

/** 外露墙带清单：已建层且邻格同层非实心（buildings.js 墙面按同一条件出墙）。
 * 岩石层走地形崖壁路径、不算墙面；顶面/屋顶不在此清单（另属顶盖范围）。 */
export function exposedWallFaces(world, L = 0.5) {
  const faces = [];
  for (const c of world.cells) for (let l = 1; l <= MAX_LEVEL; l++) {
    if (!world.isBuilt(c, l)) continue;
    for (let i = 0; i < c.n; i++) {
      const nb = nbrOf(world, c, i);
      if (nb && world.isSolid(nb, l)) continue;
      const a = c.pts[i], b = c.pts[(i + 1) % c.n], [nx, nz] = edgeOut(c, i);
      faces.push({ cell: c.id, edge: i, level: l, ax: a.x, az: a.z, bx: b.x, bz: b.z, nx, nz,
        len: Math.hypot(b.x - a.x, b.z - a.z) || 1, yA: (l - 1) * L, yB: l * L });
    }
  }
  return faces;
}

/** 悬空已建体块：本层实心、下一层空（buildings.js underside 的 runBottom 条件）。
 * kind 同规则：方格且一对对边在下一层都有支撑 → 'arch'，否则 'flat'。
 * flat 的 posts 复刻 underside 的 postSeen：顶点+层去重、按格序先到的格画柱，
 * 柱位用该格自己的 mix(角, 格心, .06)——共享顶点的另一悬空格不再列同一根。
 * world.steelFrame 时钢架另走 emitSteelFrame，posts 留空只核平底。 */
export function floatingVoxels(world, L = 0.5) {
  const out = [], postSeen = new Set();
  for (const c of world.cells) for (let lv = 2; lv <= MAX_LEVEL; lv++) {
    if (!world.isBuilt(c, lv) || world.isSolid(c, lv - 1)) continue;
    const below = lv - 1, yBase = below * L;
    let floorLv = 0;
    for (let l = lv - 1; l >= 1; l--) if (world.isSolid(c, l)) { floorLv = l; break; }
    const yFloor = floorLv * L;
    const axis = c.n === 4 ? [0, 1].find((i) => {
      const a = nbrOf(world, c, i), b = nbrOf(world, c, i + 2);
      return a && b && world.isSolid(a, below) && world.isSolid(b, below);
    }) : undefined;
    const posts = [];
    if (axis === undefined && !world.steelFrame) for (let k = 0; k < c.n; k++) {
      const p = c.pts[k], sharing = world.grid.vertexCells.get(p.id) || [];
      if (sharing.some((id) => world.isSolid(world.cells[id], below))) continue;   // 角上已有墙托着
      const key = p.id * 64 + lv;
      if (postSeen.has(key)) continue;   // 同顶点同层已有别的格先画（柱位按它的内缩方向）
      postSeen.add(key);
      // 该角应有一根从 yFloor 到 yBase 的钢柱（粗 .045，整跨一根方柱）。
      // free：floorLv..lv-1 中邻格均空的层（诊断信息，核查本身按整跨柱面判定）。
      const free = [];
      for (let l = floorLv + 1; l < lv; l++) if (!sharing.some((id) => world.isSolid(world.cells[id], l))) free.push((l - 0.5) * L);
      posts.push({ x: p.x + (c.cx - p.x) * 0.06, z: p.z + (c.cz - p.z) * 0.06, yFloor, yBase, free });
    }
    out.push({ cell: c.id, level: lv, kind: axis !== undefined ? 'arch' : 'flat', axis, yBase, yFloor, posts });
  }
  return out;
}

/** 三角形 XZ 均匀桶索引：按三角形 XZ 包围盒落桶，查询矩形返回候选三角形。 */
export function triangleIndex(geometry, g = 1) {
  const p = geometry.getAttribute('position').array, idx = geometry.index?.array;
  const tris = [], buckets = new Map();
  for (let t = 0; t + 2 < (idx ? idx.length : p.length); t += 3) {
    const ids = [0, 1, 2].map((k) => (idx ? idx[t + k] : t + k));
    const v = ids.map((i) => [p[i * 3], p[i * 3 + 1], p[i * 3 + 2]]);
    const ux = v[1][0] - v[0][0], uy = v[1][1] - v[0][1], uz = v[1][2] - v[0][2];
    const wx = v[2][0] - v[0][0], wy = v[2][1] - v[0][1], wz = v[2][2] - v[0][2];
    const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
    const nl = Math.hypot(nx, ny, nz) || 1;
    tris.push({ v, nx: nx / nl, ny: ny / nl, nz: nz / nl });
  }
  const put = (i) => {
    const v = tris[i].v;
    const x0 = Math.min(v[0][0], v[1][0], v[2][0]), x1 = Math.max(v[0][0], v[1][0], v[2][0]);
    const z0 = Math.min(v[0][2], v[1][2], v[2][2]), z1 = Math.max(v[0][2], v[1][2], v[2][2]);
    for (let bx = Math.floor(x0 / g); bx <= Math.floor(x1 / g); bx++) for (let bz = Math.floor(z0 / g); bz <= Math.floor(z1 / g); bz++) {
      const k = bx + ',' + bz; let arr = buckets.get(k); if (!arr) buckets.set(k, (arr = []));
      arr.push(i);
    }
  };
  tris.forEach((_, i) => put(i));
  const query = (x0, z0, x1, z1, cb) => {
    const seen = new Set();
    for (let bx = Math.floor(x0 / g); bx <= Math.floor(x1 / g); bx++) for (let bz = Math.floor(z0 / g); bz <= Math.floor(z1 / g); bz++) {
      const arr = buckets.get(bx + ',' + bz); if (!arr) continue;
      for (const i of arr) if (!seen.has(i)) { seen.add(i); if (cb(tris[i]) === false) return; }
    }
  };
  return { tris, query };
}
function defaultIndex(geometry, index) { return index ?? triangleIndex(geometry); }

/** 外露墙带采样覆盖：每条带 3 沿边 × 3 高度共 9 个采样点，逐点要求被一张「靠墙平面」三角形的
 * (t,y) 投影覆盖——整带缺面（漏面）或局部破洞都会被抓到。
 * 判定三角：三个顶点都在墙面薄板内（内 ≤ min(.10,.45·len)，外 ≤ max(.02·len,.13)，含基座外鼓与门窗凹进）、
 * 竖直向（|ny|≤.75，剔除压顶/檐口水平面）、顶点 y 在带内 ±.04L。
 * strict（默认）：任一采样点未覆盖即记 uncovered；非 strict 只报 coverage==0 的整带缺失。 */
export function auditSurfaceCoverage(world, geometry, { L = 0.5, index, strict = true } = {}) {
  const idx = defaultIndex(geometry, index), faces = exposedWallFaces(world, L);
  const uncovered = [], missing = [];
  let samples = 0, covered = 0, minCoverage = 1;
  for (const f of faces) {
    const sIn = -Math.min(0.10, 0.45 * f.len), sOut = Math.max(0.02 * f.len, 0.13);
    let cov = 0, tot = 0; const bad = [];
    for (const tf of [0.15, 0.5, 0.85]) for (const yf of [0.3, 0.55, 0.8]) {
      tot++;
      const sx = f.ax + (f.bx - f.ax) * tf, sz = f.az + (f.bz - f.az) * tf, sy = f.yA + yf * L;
      const st = ((sx - f.ax) * (f.bx - f.ax) + (sz - f.az) * (f.bz - f.az)) / f.len;
      let hit = false;
      idx.query(Math.min(f.ax, f.bx) - 0.2, Math.min(f.az, f.bz) - 0.2, Math.max(f.ax, f.bx) + 0.2, Math.max(f.az, f.bz) + 0.2, (tr) => {
        if (Math.abs(tr.ny) > 0.75) return;
        const tt = [], yq = [];
        for (const q of tr.v) {
          const d = f.nx * (q[0] - f.ax) + f.nz * (q[2] - f.az);
          if (d < sIn || d > sOut || q[1] < f.yA - 0.04 * L || q[1] > f.yB + 0.04 * L) return;
          tt.push(((q[0] - f.ax) * (f.bx - f.ax) + (q[2] - f.az) * (f.bz - f.az)) / f.len); yq.push(q[1]);
        }
        const den = (yq[1] - yq[2]) * (tt[0] - tt[2]) + (tt[2] - tt[1]) * (yq[0] - yq[2]);
        if (Math.abs(den) < 1e-12) return;
        const l1 = ((yq[1] - yq[2]) * (st - tt[2]) + (tt[2] - tt[1]) * (sy - yq[2])) / den;
        const l2 = ((yq[2] - yq[0]) * (st - tt[2]) + (tt[0] - tt[2]) * (sy - yq[2])) / den;
        if (l1 >= -1e-6 && l2 >= -1e-6 && 1 - l1 - l2 >= -1e-6) { hit = true; return false; }
      });
      if (hit) cov++; else bad.push([+tf.toFixed(2), +yf.toFixed(2)]);
    }
    samples += tot; covered += cov; minCoverage = Math.min(minCoverage, cov / tot);
    if (cov === 0) missing.push({ cell: f.cell, edge: f.edge, level: f.level });
    if (cov < tot) uncovered.push({ cell: f.cell, edge: f.edge, level: f.level, coverage: cov / tot, bad });
  }
  return { valid: strict ? uncovered.length === 0 : missing.length === 0, strict,
    faces: faces.length, samples, covered, minCoverage, missing, uncovered };
}

/** 悬空体块支撑核对（buildings.js underside 规则的几何兑现）：
 * arch → 拱腹：格内 footprint 之下有朝下三角（cy ∈ [yBase-.95L, yBase+.02L]）；
 * flat → yBase 处有覆盖格心方向的朝下平底三角，且每个应立钢柱的角点有一张三顶点贴轴、
 *   y 贯通 yFloor..yBase 的柱侧面三角。
 * 只核「该出的面/柱在不在」，不证明拱形精确或结构力学稳定。 */
export function auditUndersideSupport(world, geometry, { L = 0.5, index } = {}) {
  const idx = defaultIndex(geometry, index), voxels = floatingVoxels(world, L);
  const unsupported = [];
  const inside = (world, c, x, z, eps = 0.01) => {
    for (let i = 0; i < c.n; i++) { const [nx, nz] = edgeOut(c, i), a = c.pts[i]; if (nx * (x - a.x) + nz * (z - a.z) > eps) return false; }
    return true;
  };
  for (const v of voxels) {
    const c = world.cells[v.cell];
    const x0 = Math.min(...c.pts.map((p) => p.x)), x1 = Math.max(...c.pts.map((p) => p.x));
    const z0 = Math.min(...c.pts.map((p) => p.z)), z1 = Math.max(...c.pts.map((p) => p.z));
    let bottom = false;
    const nyMax = v.kind === 'arch' ? -0.2 : -0.5, yLo = v.kind === 'arch' ? v.yBase - 0.95 * L : v.yBase - 0.02 * L, yHi = v.yBase + 0.02 * L;
    idx.query(x0, z0, x1, z1, (tr) => {
      if (bottom || tr.ny > nyMax) return;
      const cx = (tr.v[0][0] + tr.v[1][0] + tr.v[2][0]) / 3, cy = (tr.v[0][1] + tr.v[1][1] + tr.v[2][1]) / 3, cz = (tr.v[0][2] + tr.v[1][2] + tr.v[2][2]) / 3;
      if (cy < yLo || cy > yHi || !inside(world, c, cx, cz)) return;
      bottom = true; return false;
    });
    if (!bottom) { unsupported.push({ cell: v.cell, level: v.level, kind: v.kind, reason: v.kind === 'arch' ? 'arch-soffit' : 'flat-bottom' }); continue; }
    for (const post of v.posts) {
      // w.beam 把整根柱画成一个跨越 yFloor..yBase 的方柱（4 侧面 × 2 三角）：侧面三角的
      // 三个顶点都贴着柱轴（±thick/2 内），且 y 范围贯通整跨。找一张这样的侧面三角即算柱在；
      // 墙/拱腹三角要么顶点离轴远、要么 y 跨度只有一层（柱跨恒 ≥ 2L），不会误判。
      let found = false;
      idx.query(post.x - 0.1, post.z - 0.1, post.x + 0.1, post.z + 0.1, (tr) => {
        if (found) return false;
        let yLo = Infinity, yHi = -Infinity, ok = true;
        for (const q of tr.v) {
          if (Math.hypot(q[0] - post.x, q[2] - post.z) > 0.055) { ok = false; break; }
          if (q[1] < yLo) yLo = q[1];
          if (q[1] > yHi) yHi = q[1];
        }
        if (ok && yLo <= post.yFloor + 0.06 && yHi >= post.yBase - 0.06) { found = true; return false; }
      });
      if (!found) unsupported.push({ cell: v.cell, level: v.level, kind: v.kind, reason: 'post', x: +post.x.toFixed(3), z: +post.z.toFixed(3) });
    }
  }
  return { valid: unsupported.length === 0, floating: voxels.length,
    arch: voxels.filter((v) => v.kind === 'arch').length, flat: voxels.filter((v) => v.kind === 'flat').length,
    postsExpected: voxels.reduce((s, v) => s + v.posts.length, 0), unsupported };
}

/** Always restores shared occupancy, wall colors, rivers and palette, including on failure.
 * surfaceAudit（默认开）：每步再核外露墙带采样覆盖与悬空体块底部/钢柱；漏面或失支撑即抛错（仍会还原）。 */
export async function runWorldQA(api, { afterStep=async()=>{}, surfaceAudit=true }={}) {
  const {world,view}=api,saved=world.snapshot(),palette=world.palette,steps=makeQASequence(world),reports=[];
  const L=view.worldMesh?.L??0.5;
  try {
    for(const step of steps){
      applyQAStep(world,step);view.changed();view.render(0);
      const geometry=view.worldMesh.geometry,report=auditQAGeometry(geometry);
      if(surfaceAudit){
        const index=triangleIndex(geometry);
        report.walls=auditSurfaceCoverage(world,geometry,{L,index});
        report.support=auditUndersideSupport(world,geometry,{L,index});
        if(report.walls.uncovered.length)report.errors.push(`wall band uncovered ${report.walls.uncovered.length}: first cell ${report.walls.uncovered[0].cell} edge ${report.walls.uncovered[0].edge} lv ${report.walls.uncovered[0].level}`);
        if(report.support.unsupported.length)report.errors.push(`underside unsupported ${report.support.unsupported.length}: first cell ${report.support.unsupported[0].cell} lv ${report.support.unsupported[0].level} ${report.support.unsupported[0].reason}`);
        report.valid=report.valid&&report.walls.valid&&report.support.valid;
      }
      reports.push({step,...report});if(!report.valid)throw Error(report.errors.join('; '));await afterStep(reports.at(-1));
    }
    return {steps:reports,valid:true,scope:'Finite attributes and valid triangle indices; exposed wall-band sampled coverage and floating-voxel underside/post audit; degeneracy reported separately, no manifold/visual proof'};
  } finally {
    world.restore(saved);world.palette=palette;view.changed();view.render(0);
  }
}
