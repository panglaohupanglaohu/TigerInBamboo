// Pure data: real shared-edge adjacency, with explicit per-face local Y4 frames.
// Vertex ring order is authored: [c00,c10,c11,c01] => N,E,S,W.
// Never reorder the ring by nearest point, compass bearing, or vertex name.
const SIDES = Object.freeze(['N', 'E', 'S', 'W']);
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const edgeKey = (a, b) => JSON.stringify([a, b].sort(compare));
const layerKey = (faceId, level) => JSON.stringify([faceId, level]);
const point3 = p => p.length === 2 ? [p[0], 0, p[1]] : p;
const sub = (a, b) => a.map((v, i) => v - b[i]);
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];
const dot = (a, b) => a.reduce((s, v, i) => s + v*b[i], 0);
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort(compare).map(k => [k, canonical(value[k])]));
  return value;
}
// Cache identity only; this is not a security or provenance hash.
function hash(value) {
  let h = 2166136261;
  for (const ch of JSON.stringify(canonical(value))) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return `face-layer-v1:${(h >>> 0).toString(16).padStart(8, '0')}`;
}

/**
 * positions: {vertexId: [x,z] | [x,y,z]}; faces: {id, vertices:[four IDs], frame?}[]
 * cells: {faceId, level, char, legacyId?, sortKey?:number[]}[]
 * Missing twins mean domain boundary; boundary labels are keyed by edgeKey.
 * Optional explicit face.twins is a four-entry array of null or {faceId,side}.
 * When supplied it must agree exactly with reversed shared vertex endpoints.
 */
export function createFaceLayerGraph({faces, positions, cells, colorSplit = true, boundaries = {}}) {
  if (!Array.isArray(faces) || !positions || !Array.isArray(cells)) throw Error('faceLayerGraph: faces, positions and cells required');
  const byFace = new Map(), edges = new Map(), copiedPositions = {};
  for (const face of faces.slice().sort((a, b) => compare(a.id, b.id))) {
    if (typeof face.id !== 'string' || !face.id || byFace.has(face.id)) throw Error('faceLayerGraph: duplicate/invalid face ID');
    if (!Array.isArray(face.vertices) || face.vertices.length !== 4 || new Set(face.vertices).size !== 4) throw Error('faceLayerGraph: four unique quad vertices required');
    const ring = face.vertices.slice();
    const pts = ring.map(id => {
      if (typeof id !== 'string' || !id) throw Error('faceLayerGraph: vertex ID must be string');
      const p = positions[id];
      if (!Array.isArray(p) || ![2,3].includes(p.length) || !p.every(Number.isFinite)) throw Error('faceLayerGraph: invalid vertex position');
      copiedPositions[id] = p.slice(); return point3(p);
    });
    const normal = cross(sub(pts[1], pts[0]), sub(pts[2], pts[1]));
    const norm2 = dot(normal, normal);
    if (norm2 <= 1e-18) throw Error('faceLayerGraph: degenerate quad');
    for (let i = 0; i < 4; i++) {
      const turn = cross(sub(pts[(i+1)%4], pts[i]), sub(pts[(i+2)%4], pts[(i+1)%4]));
      if (dot(turn, normal) <= norm2*1e-10) throw Error('faceLayerGraph: non-convex or inconsistent winding');
    }
    const halfEdges = ring.map((a, i) => {
      const b = ring[(i+1)%4], id = edgeKey(a, b);
      const half = {faceId:face.id, sourceSide:SIDES[i], a, b, edgeId:id, twin:null};
      if (!edges.has(id)) edges.set(id, []);
      edges.get(id).push(half); return half;
    });
    const cageCornerIds = [ring[0],ring[1],ring[3],ring[2]];
    byFace.set(face.id, {...face, vertices:ring, halfEdges, cageCornerIds, cageCorners:cageCornerIds.map(id => copiedPositions[id].slice())});
  }
  for (const halves of edges.values()) {
    if (halves.length > 2) throw Error('faceLayerGraph: non-manifold shared edge');
    if (halves.length === 2) {
      const [a,b] = halves;
      if (a.a !== b.b || a.b !== b.a) throw Error('faceLayerGraph: twin winding mismatch');
      a.twin = b; b.twin = a;
    }
  }
  for (const face of byFace.values()) {
    if (face.twins === undefined) continue;
    if (!Array.isArray(face.twins) || face.twins.length !== 4) throw Error('faceLayerGraph: explicit twins require four entries');
    face.halfEdges.forEach((half,i) => {
      const actual = half.twin, declared = face.twins[i];
      if (actual ? !declared || declared.faceId !== actual.faceId || declared.side !== actual.sourceSide : declared !== null) throw Error('faceLayerGraph: explicit twin mismatch');
    });
  }
  const nodes = cells.map(c => ({...c, sortKey:c.sortKey?.slice()}));
  for (const c of nodes) {
    if (!byFace.has(c.faceId) || !Number.isInteger(c.level) || c.level < 0 || typeof c.char !== 'string' || !c.char || c.char === '.') throw Error('faceLayerGraph: invalid occupied face/layer');
    if (c.legacyId !== undefined && (typeof c.legacyId !== 'string' || !c.legacyId)) throw Error('faceLayerGraph: invalid legacy ID');
    if (c.sortKey !== undefined && (!Array.isArray(c.sortKey) || !c.sortKey.every(Number.isFinite))) throw Error('faceLayerGraph: invalid sortKey');
  }
  if (nodes.some(c=>c.sortKey) && nodes.some(c=>!c.sortKey)) throw Error('faceLayerGraph: sortKey must be supplied for all cells or none');
  nodes.sort((a,b) => {
    if (a.sortKey && b.sortKey) { for (let i=0;i<Math.max(a.sortKey.length,b.sortKey.length);i++) { const d=(a.sortKey[i]??0)-(b.sortKey[i]??0); if(d)return d; } }
    return a.level-b.level || compare(a.faceId,b.faceId);
  });
  const ids = nodes.map(c => c.legacyId ?? layerKey(c.faceId,c.level));
  const index = new Map(ids.map((id,i)=>[id,i]));
  const occupied = new Map(nodes.map((c,i)=>[layerKey(c.faceId,c.level),i]));
  if (index.size !== nodes.length || occupied.size !== nodes.length) throw Error('faceLayerGraph: duplicate occupied cell or cell ID');
  const adjacency = nodes.map(()=>[]), exposures = nodes.map(()=>({})), boundary = nodes.map(()=>({}));
  const pairs = new Map();
  nodes.forEach((node,i) => {
    const visit = (side, otherFace, otherLevel, targetSide, edgeId, missingBoundary) => {
      const j = otherFace === null ? undefined : occupied.get(layerKey(otherFace,otherLevel));
      const other = j === undefined ? null : nodes[j];
      if (!other) { exposures[i][side]='air'; boundary[i][side]=missingBoundary; return; }
      if (SIDES.includes(side) && colorSplit && node.char !== other.char) { exposures[i][side]='foreign'; boundary[i][side]='color-boundary'; return; }
      exposures[i][side] = SIDES.includes(side) && !occupied.has(layerKey(other.faceId,other.level+1)) ? 'edge-top' : 'edge';
      boundary[i][side] = null;
      const direction = `pair:${side}:${targetSide}`;
      pairs.set(direction,{direction,sourceSide:side,targetSide});
      adjacency[i].push({to:j,direction,sourceSide:side,targetSide,edgeId,edgeParameterReversed:SIDES.includes(side)});
    };
    for (const half of byFace.get(node.faceId).halfEdges) visit(half.sourceSide,half.twin?.faceId??null,node.level,half.twin?.sourceSide,half.edgeId,half.twin?'empty-cell':boundaries[half.edgeId]??'domain-edge');
    visit('U',node.faceId,node.level+1,'D',null,'top-air');
    visit('D',node.faceId,node.level-1,'U',null,node.level===0?'foundation':'empty-cell');
  });
  const heights = nodes.map(c => { let n=1;for(const step of [-1,1])for(let y=c.level+step;occupied.has(layerKey(c.faceId,y));y+=step)n++;return n; });
  const isolated = new Map();
  nodes.forEach((c,i)=>isolated.set(c.faceId,(isolated.get(c.faceId)??true)&&SIDES.every(s=>['air','foreign'].includes(exposures[i][s]))));
  const topologyHash = hash({positions:copiedPositions,faces:[...byFace.values()].map(f=>({id:f.id,vertices:f.vertices,frame:f.frame??null,regionId:f.regionId??null})),cells:nodes.map((c,i)=>({...c,id:ids[i]})),colorSplit,boundaries});
  return {
    kind:'citadel-face-layer-graph',colorSplit,topologyHash,cellCount:nodes.length,
    sidePairs:[...pairs.values()].sort((a,b)=>compare(a.direction,b.direction)),
    cells:()=>ids.map((id,index)=>({id,index})),cellId:i=>ids[i],indexOfId:id=>index.get(id)??-1,
    neighborsOf:i=>adjacency[i]||[],exposure:i=>exposures[i],boundaryOf:i=>boundary[i],
    levelOf:i=>nodes[i]?.level,charOf:i=>nodes[i]?.char,columnHeight:i=>heights[i],columnIsolated:i=>isolated.get(nodes[i]?.faceId)===true,
    faceIdOf:i=>nodes[i]?.faceId,faceOf:i=>byFace.get(nodes[i]?.faceId),indexOfFaceLevel:(faceId,level)=>occupied.get(layerKey(faceId,level))??-1,
    faceById:faceId=>byFace.get(faceId),
    validate(){
      const errors=[];
      adjacency.forEach((list,i)=>list.forEach(e=>{if(!adjacency[e.to]?.some(r=>r.to===i&&r.sourceSide===e.targetSide&&r.targetSide===e.sourceSide&&r.edgeId===e.edgeId))errors.push(`missing-reverse:${ids[i]}:${e.direction}`);}));
      return {ok:errors.length===0,errors};
    },
  };
}

/** Lossless regular-topology baseline, retaining original IDs and solver order.
 * deformVertex(x,z,id) may move a shared vertex, never change its identity.
 * The callback returns [x,z] or [x,y,z]. Coordinates are cell-grid units.
 */
export function createLegacyFaceLayout(grid,{deformVertex}={}) {
  if (!(grid instanceof Map)) throw Error('createLegacyFaceLayout: grid Map required');
  const positions={},faces=new Map(),cells=[];
  for(const [legacyId,char] of [...grid].sort(([a],[b])=>compare(a,b))){
    const coords=legacyId.split(',').map(Number);
    if(coords.length!==3||!coords.every(Number.isInteger)||coords[1]<0)throw Error('createLegacyFaceLayout: invalid ASCII cell ID');
    const [x,level,z]=coords,faceId=`${x},${z}`;
    if(!faces.has(faceId)){
      const corners=[[x-.5,z-.5],[x+.5,z-.5],[x+.5,z+.5],[x-.5,z+.5]];
      const vertices=corners.map(([vx,vz])=>{
        const id=`${vx},${vz}`;
        if(!Object.hasOwn(positions,id))positions[id]=deformVertex?deformVertex(vx,vz,id):[vx,vz];
        return id;
      });
      faces.set(faceId,{id:faceId,vertices});
    }
    cells.push({faceId,level,char,legacyId,sortKey:[level,z,x]});
  }
  return {faces:[...faces.values()],positions,cells};
}
