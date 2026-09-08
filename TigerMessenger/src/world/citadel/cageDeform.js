// =====================================================================
//  笼形变形（C10）：单位立方体 [0,1]³ → 四边形四角双线性 × 层高线性。
//  方格时四角是正方形，映射是恒等（与 cx/cz 一致）。
//  纯数据，禁止 import Three.js。
// =====================================================================

/** c00=(u0,v0) c10=(u1,v0) c01=(u0,v1) c11=(u1,v1)，各为 [x,z] */
export function bilinearXZ(c00, c10, c01, c11, u, v) {
  const a = 1 - u;
  const b = 1 - v;
  return [
    a * b * c00[0] + u * b * c10[0] + a * v * c01[0] + u * v * c11[0],
    a * b * c00[1] + u * b * c10[1] + a * v * c01[1] + u * v * c11[1],
  ];
}

export function cageMapUnit(u, y, v, cornersXZ, y0, y1) {
  const xz = bilinearXZ(cornersXZ[0], cornersXZ[1], cornersXZ[2], cornersXZ[3], u, v);
  return [xz[0], y0 + y * (y1 - y0), xz[1]];
}

/** Read the authored graph frame directly; no nearest-point corner assignment.
 * Graph coordinates may be transformed uniformly into the town's local units.
 * 3D vertices must lie at y=0: the existing cage uses separate y0/y1 floors.
 * Sloping/offset 3D surfaces require an explicit height-aware adapter instead.
 */
function graphFaceCorners(face, { scale = 1, offset = [0, 0], epsilon = 1e-9 } = {}) {
  if (!face || face.cageCorners?.length !== 4 || face.vertices?.length !== 4) throw Error('face cage: missing explicit quad frame');
  if (!Number.isFinite(scale) || scale <= 0 || !Array.isArray(offset) || offset.length !== 2 || !offset.every(Number.isFinite) || !Number.isFinite(epsilon) || epsilon <= 0) throw Error('face cage: invalid coordinate transform');
  const expected = [face.vertices[0], face.vertices[1], face.vertices[3], face.vertices[2]];
  if (!face.cageCornerIds || expected.some((id,i)=>face.cageCornerIds[i]!==id)) throw Error('face cage: corner/frame identity mismatch');
  const corners = face.cageCorners.map(p => {
    if (!Array.isArray(p) || ![2,3].includes(p.length) || !p.every(Number.isFinite)) throw Error('face cage: invalid point');
    if (p.length === 3 && Math.abs(p[1]) > epsilon) throw Error('face cage: nonzero 3D height requires height-aware mapping');
    return [p[0]*scale+offset[0],p[p.length-1]*scale+offset[1]];
  });
  // For a bilinear XZ map its Jacobian determinant is affine in u/v;
  // testing the four corners bounds its sign throughout the entire unit square.
  const [a,b,c,d] = corners;
  for (const [u,v] of [[0,0],[1,0],[0,1],[1,1]]) {
    const du = [(1-v)*(b[0]-a[0])+v*(d[0]-c[0]),(1-v)*(b[1]-a[1])+v*(d[1]-c[1])];
    const dv = [(1-u)*(c[0]-a[0])+u*(d[0]-b[0]),(1-u)*(c[1]-a[1])+u*(d[1]-b[1])];
    if (du[0]*dv[1]-du[1]*dv[0] <= epsilon) throw Error('face cage: degenerate or reversed mapping');
  }
  return corners;
}

export function faceCageCorners(graph, cellIndex, options = {}) {
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= graph?.cellCount) throw Error('face cage: invalid cell index');
  return graphFaceCorners(graph.faceOf(cellIndex), options);
}

/** Direct input for makeExposedCellGeometry's existing cage argument. */
export function faceCageFromGraph(graph, cellIndex, options = {}) {
  const corners = faceCageCorners(graph, cellIndex, options);
  const [cx,cz] = bilinearXZ(...corners,.5,.5);
  return { corners, cx, cz, faceId:graph.faceIdOf(cellIndex), level:graph.levelOf(cellIndex) };
}

// Parameter t follows the authored CCW half-edge ring, not always increasing u/v.
function edgeUv(side,t) {
  if(side==='N')return [t,0];if(side==='E')return [1,t];
  if(side==='S')return [1-t,1];if(side==='W')return [0,1-t];
  throw Error('face cage: unknown local side');
}

/** Validate all shared edges touching occupied faces, including foreign/empty
 * neighbors omitted from WFC adjacency. This is geometry validation, not proof
 * of walkability or permission to use arbitrary topology in the old builder.
 */
export function validateFaceCages(graph, options = {}) {
  const errors=[], checkedFaces=new Map(), edges=new Set();let sampleCount=0;
  const tolerance=options.tolerance??1e-7;
  if (!Number.isFinite(tolerance)||tolerance<=0) throw Error('face cage: invalid tolerance');
  const get=face=>{
    if(!face)throw Error('face cage: missing twin face');
    if(!checkedFaces.has(face.id))checkedFaces.set(face.id,graphFaceCorners(face,options));
    return checkedFaces.get(face.id);
  };
  for(const {index} of graph.cells()){
    const face=graph.faceOf(index);
    try{
      const a=get(face);
      for(const half of face.halfEdges){
        if(!half.twin||edges.has(half.edgeId))continue;
        const twin=half.twin;
        if(twin.twin!==half||half.a!==twin.b||half.b!==twin.a)throw Error('face cage: invalid reversed twin');
        const b=get(graph.faceById(twin.faceId));
        for(const t of [0,.25,.5,.75,1]){
          const [u,v]=edgeUv(half.sourceSide,t),[s,w]=edgeUv(twin.sourceSide,1-t);
          const pa=bilinearXZ(...a,u,v),pb=bilinearXZ(...b,s,w);
          if(Math.hypot(pa[0]-pb[0],pa[1]-pb[1])>tolerance)throw Error(`face cage: shared edge mismatch ${half.edgeId} at ${t}`);
          sampleCount++;
        }
        edges.add(half.edgeId);
      }
    }catch(error){errors.push(`${face?.id}: ${error.message}`);}
  }
  return {ok:errors.length===0,errors,faceCount:checkedFaces.size,sharedEdges:edges.size,sampleCount};
}

export function squareCellCorners(ix, iz, cellSize, gridSize) {
  const half = (gridSize - 1) / 2;
  const x0 = (ix - half - 0.5) * cellSize;
  const z0 = (iz - half - 0.5) * cellSize;
  const x1 = x0 + cellSize;
  const z1 = z0 + cellSize;
  return [
    [x0, z0],
    [x1, z0],
    [x0, z1],
    [x1, z1],
  ];
}

function nearestUnused(pts, target, used) {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < pts.length; i++) {
    if (used.has(i)) continue;
    const d = (pts[i][0] - target[0]) ** 2 + (pts[i][1] - target[1]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  }
  used.add(best);
  return pts[best];
}

/** 把 face 四角对到方格四角槽位，保证双线性 u/v 与 (ix,iz) 一致。 */
export function orderFaceCorners(pts, square) {
  if (!pts || pts.length < 4) return square;
  const used = new Set();
  return square.map((target) => nearestUnused(pts, target, used));
}

export function cellCageCorners(ix, iz, { quad = null, mapping = null, cellSize = 2, gridSize = 25 } = {}) {
  const square = squareCellCorners(ix, iz, cellSize, gridSize);
  if (!quad || !mapping) return square;
  const fid = mapping.cellToFace.get(`${ix},${iz}`);
  if (!fid) return square;
  if (!quad._faceIndex) {
    quad._faceIndex = new Map(quad.faceIds.map((id, i) => [id, i]));
  }
  const i = quad._faceIndex.get(fid);
  if (i === undefined) return square;
  return orderFaceCorners(quad.corners[i], square);
}

/**
 * 角柱对偶立方体的四个水平角 = 四格中心。
 * columnAt(ix,iz) → {x,z} | null，缺的回落方格中心。
 */
export function cornerCageCorners(gx, gz, { columnAt, cellSize = 2, gridSize = 25 } = {}) {
  const at = (ix, iz) => {
    const c = columnAt?.(ix, iz);
    if (c) return [c.x, c.z];
    const half = (gridSize - 1) / 2;
    return [(ix - half) * cellSize, (iz - half) * cellSize];
  };
  return [
    at(gx - 1, gz - 1),
    at(gx, gz - 1),
    at(gx - 1, gz),
    at(gx, gz),
  ];
}
