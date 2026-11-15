/**
 * spatial.js — 网格上的几何查询：点在哪一格、格子的包围盒。
 */

/** 点是否在凸多边形内（XZ 平面；三角格、方格都行）。 */
export function pointInQuad(pts, x, z) {
  let sign = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const k = (b.x - a.x) * (z - a.z) - (b.z - a.z) * (x - a.x);
    if (Math.abs(k) < 1e-9) continue;
    const s = Math.sign(k);
    if (sign === 0) sign = s;
    else if (s !== sign) return false;
  }
  return true;
}

/** 给每格补上包围盒与尺寸，拾取和栅格化都要用。 */
export function decorateCells(grid) {
  for (const cell of grid.cells) {
    const xs = cell.pts.map((p) => p.x);
    const zs = cell.pts.map((p) => p.z);
    cell.minX = Math.min(...xs); cell.maxX = Math.max(...xs);
    cell.minZ = Math.min(...zs); cell.maxZ = Math.max(...zs);
    // 尺寸 = 角到格心的平均距离 × 0.7（方格时约等于原来的"对角线 / 4"）
    let r = 0;
    for (const p of cell.pts) r += Math.hypot(p.x - cell.cx, p.z - cell.cz);
    cell.size = (r / cell.pts.length) * 0.7;
  }
  return grid;
}

/** 空间哈希：直接跳到某个点附近的几格。 */
export function buildCellIndex(grid, bucket = 2) {
  const map = new Map();
  const key = (ix, iz) => ix * 100003 + iz;
  for (const cell of grid.cells) {
    for (let ix = Math.floor(cell.minX / bucket); ix <= Math.floor(cell.maxX / bucket); ix++) {
      for (let iz = Math.floor(cell.minZ / bucket); iz <= Math.floor(cell.maxZ / bucket); iz++) {
        const k = key(ix, iz);
        let list = map.get(k);
        if (!list) map.set(k, (list = []));
        list.push(cell);
      }
    }
  }
  return {
    at(x, z) { return map.get(key(Math.floor(x / bucket), Math.floor(z / bucket))) ?? []; },
    cellAt(x, z) {
      for (const c of this.at(x, z)) if (pointInQuad(c.pts, x, z)) return c;
      return null;
    },
  };
}

/**
 * 重心坐标：预先算好三角形的两个"对偶向量"，之后每个坐标只要 1 次减法 + 1 次点积
 * （974579499802202113 "Barycentric Coordinates can be calculated with 1 subtraction and 1 dot product
 *  (if you've precalculated some nice vectors in the triangle)"；974564862729838592 讲课用的小工具）。
 *   const B = baryPrep(a, b, c);  B(x, z) → [wa, wb, wc]
 * 向量 g_b 垂直于 ca、长度使 g_b·(b−a) = 1；g_c 同理。于是 wb = g_b·(p−a)，wc = g_c·(p−a)，wa = 1 − wb − wc。
 */
export function baryPrep(a, b, c) {
  const ax=a.x,az=a.z;
  if(![ax,az,b.x,b.z,c.x,c.z].every(Number.isFinite))throw new RangeError('finite XZ triangle required');
  const e1x=b.x-ax,e1z=b.z-az,e2x=c.x-ax,e2z=c.z-az;
  const scale=Math.max(Math.abs(e1x),Math.abs(e1z),Math.abs(e2x),Math.abs(e2z));
  const x1=e1x/scale,z1=e1z/scale,x2=e2x/scale,z2=e2z/scale,det=x1*z2-z1*x2;
  if(!Number.isFinite(det)||Math.abs(det)<=64*Number.EPSILON)throw new RangeError('degenerate XZ triangle');
  const gbx=z2/det/scale,gbz=-x2/det/scale;
  const gcx=-z1/det/scale,gcz=x1/det/scale;
  return (x,z)=>{
    if(!Number.isFinite(x)||!Number.isFinite(z))throw new RangeError('finite XZ query required');
    const px=x-ax,pz=z-az,wb=gbx*px+gbz*pz,wc=gcx*px+gcz*pz;
    return[1-wb-wc,wb,wc];
  };
}

/**
 * 974579499802202113 的三维版：任意朝向平面上的三角形（坡面、崖面、建筑立面）。
 * "nice vectors" 用叉积形式 g_b = (e2×n)/|n|², g_c = (n×e1)/|n|²（n = e1×e2），
 * 不经过 d00·d11 − d01² 这一步相减，极瘦三角形也不会因抵消丢精度。
 * 查询仍是 1 次减法 + 每坐标 1 次点积；平面外的点得到它在平面上投影的权重，另给出有符号离面距离。
 * degenerate: 'throw'（默认，和 baryPrep 一致）| 'flag'：共线/重合三角形不抛错，退化到最长边上的一维重心坐标
 *   （和仍为 1、反算落在最长边最近点），查询函数带 degenerate=true，调用方自己决定怎么处理。
 */
export function baryPrep3(a,b,c,{degenerate='throw'}={}){
  if(degenerate!=='throw'&&degenerate!=='flag')throw new RangeError('degenerate must be throw or flag');
  const P=[a,b,c].map(p=>[p.x,p.y??0,p.z??0]);
  if(!P.flat().every(Number.isFinite))throw new RangeError('finite triangle required');
  const [A,B,C]=P,e1=[B[0]-A[0],B[1]-A[1],B[2]-A[2]],e2=[C[0]-A[0],C[1]-A[1],C[2]-A[2]];
  const cr=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]],dt=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
  const n=cr(e1,e2),nn=dt(n,n),l1=Math.hypot(...e1),l2=Math.hypot(...e2);
  const bad=!(nn>0)||!Number.isFinite(nn)||Math.sqrt(nn)<=1e-12*l1*l2||!(l1>0&&l2>0);
  if(bad){
    if(degenerate==='throw')throw new RangeError('degenerate triangle');
    // 最长边 i→j 上的一维坐标；第三个顶点权重 0。全部重合时权重全给 a。
    const E=[[0,1],[0,2],[1,2]].map(([i,j])=>{const d=[P[j][0]-P[i][0],P[j][1]-P[i][1],P[j][2]-P[i][2]];return{i,j,d,l2:dt(d,d)}}).sort((x,y)=>y.l2-x.l2)[0];
    const q=(x,y=0,z=0)=>{if(![x,y,z].every(Number.isFinite))throw new RangeError('finite query required');const w=[0,0,0];
      if(!(E.l2>0)){w[0]=1;return w}const t=Math.max(0,Math.min(1,((x-P[E.i][0])*E.d[0]+(y-P[E.i][1])*E.d[1]+(z-P[E.i][2])*E.d[2])/E.l2));w[E.i]=1-t;w[E.j]=t;return w};
    q.degenerate=true;q.normal=[0,0,0];q.distance=()=>NaN;return q;
  }
  const gb=cr(e2,n).map(v=>v/nn),gc=cr(n,e1).map(v=>v/nn),len=Math.sqrt(nn),un=n.map(v=>v/len),[ax,ay,az]=A;
  const q=(x,y=0,z=0)=>{
    if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(z))throw new RangeError('finite query required');
    const px=x-ax,py=y-ay,pz=z-az,wb=gb[0]*px+gb[1]*py+gb[2]*pz,wc=gc[0]*px+gc[1]*py+gc[2]*pz;
    return[1-wb-wc,wb,wc];
  };
  q.degenerate=false;q.normal=un;q.distance=(x,y=0,z=0)=>(x-ax)*un[0]+(y-ay)*un[1]+(z-az)*un[2];
  q.ops={sub:1,dotPerWeight:1,dot:2};return q;
}
/** 对照答案：朴素 Cramer（3 减 4 点积 + 乘除）。只给测试/教学对账，不进生产路径。 */
export function baryCramer3(a,b,c,p){
  const s=(u,v)=>[u.x-v.x,(u.y??0)-(v.y??0),(u.z??0)-(v.z??0)],d=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
  const v0=s(b,a),v1=s(c,a),v2=s(p,a),d00=d(v0,v0),d01=d(v0,v1),d11=d(v1,v1),d20=d(v2,v0),d21=d(v2,v1),den=d00*d11-d01*d01;
  const w1=(d11*d20-d01*d21)/den,w2=(d00*d21-d01*d20)/den;return[1-w1-w2,w1,w2];
}
/** 权重 → 点（验证"权重 + 三顶点"无损）；含边判定；974564862729838592 gizmo 的红/绿/蓝三球颜色。 */
export function baryPoint(a,b,c,w){return{x:a.x*w[0]+b.x*w[1]+c.x*w[2],y:(a.y??0)*w[0]+(b.y??0)*w[1]+(c.y??0)*w[2],z:(a.z??0)*w[0]+(b.z??0)*w[1]+(c.z??0)*w[2]};}
export function baryInside(w,eps=0){return w[0]>=-eps&&w[1]>=-eps&&w[2]>=-eps;}
export function baryColor(w){const c=v=>Math.max(0,Math.min(1,v));return{r:c(w[0]),g:c(w[1]),b:c(w[2])};}
