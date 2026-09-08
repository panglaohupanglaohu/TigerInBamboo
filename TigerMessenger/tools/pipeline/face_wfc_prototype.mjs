// Isolated topology contract prototype. No production imports are modified.
import {BitSet} from '../../src/procgen/core/bitSet.js';
const SIDES=['N','E','S','W'];
const key=(face,level)=>JSON.stringify([face,level]);
const edgeKey=(a,b)=>JSON.stringify([String(a),String(b)].sort());

export function createFaceLayerGraph({faces,positions,cells,colorSplit=true,boundaries={}}){
 const sorted=faces.slice().sort((a,b)=>a.id.localeCompare(b.id));
 if(new Set(sorted.map(f=>f.id)).size!==sorted.length)throw Error('duplicate face ID');
 const byFace=new Map(),edges=new Map();
 for(const face of sorted){
  if(face.vertices.length!==4||new Set(face.vertices).size!==4)throw Error('quad with four unique vertices required');
  let vertices=face.vertices.slice();
  const first=vertices.reduce((best,v,i)=>String(v)<String(vertices[best])?i:best,0);
  vertices=[...vertices.slice(first),...vertices.slice(0,first)];
  const pts=vertices.map(v=>positions[v]);
  if(pts.some(p=>!p||!p.every(Number.isFinite)))throw Error('missing/invalid vertex position');
  for(let i=0;i<4;i++){
   const a=pts[i],b=pts[(i+1)%4],c=pts[(i+2)%4];
   if((b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0])<=1e-9)throw Error('non-convex or inconsistent winding');
  }
  const owned=[];
  for(let i=0;i<4;i++){
   const a=vertices[i],b=vertices[(i+1)%4],id=edgeKey(a,b);
   const half={face:face.id,side:SIDES[i],a,b,edgeId:id};
   if(!edges.has(id))edges.set(id,[]);edges.get(id).push(half);owned.push(half);
  }
  // Canonical ring is [c00,c10,c11,c01]; cage wants [c00,c10,c01,c11].
  byFace.set(face.id,{...face,vertices,halfEdges:owned,cageCorners:[pts[0],pts[1],pts[3],pts[2]]});
 }
 for(const halves of edges.values()){
  if(halves.length>2)throw Error('non-manifold shared edge');
  if(halves.length===2){const[a,b]=halves;if(a.a!==b.b||a.b!==b.a)throw Error('twin winding mismatch');a.twin=b;b.twin=a;}
 }
 const nodes=cells.slice().sort((a,b)=>a.level-b.level||a.faceId.localeCompare(b.faceId));
 const ids=nodes.map(c=>key(c.faceId,c.level)),index=new Map(ids.map((id,i)=>[id,i]));
 if(index.size!==nodes.length)throw Error('duplicate occupied cell');
 if(nodes.some(c=>!byFace.has(c.faceId)||!Number.isInteger(c.level)||c.level<0))throw Error('invalid face/layer');
 const adjacency=nodes.map(()=>[]),exposure=nodes.map(()=>({})),boundary=nodes.map(()=>({}));
 nodes.forEach((node,i)=>{
  const visit=(side,toId,targetSide,edgeId,kind)=>{
   const j=index.get(toId),other=j===undefined?null:nodes[j];
   if(!other){exposure[i][side]='air';boundary[i][side]=kind;return;}
   if(SIDES.includes(side)&&colorSplit&&node.char!==other.char){exposure[i][side]='foreign';boundary[i][side]='color-boundary';return;}
   exposure[i][side]=SIDES.includes(side)&&!index.has(key(other.faceId,other.level+1))?'edge-top':'edge';
   adjacency[i].push({to:j,direction:`pair:${side}:${targetSide}`,sourceSide:side,targetSide,edgeId,edgeParameterReversed:SIDES.includes(side)});
  };
  for(const half of byFace.get(node.faceId).halfEdges)visit(half.side,half.twin?key(half.twin.face,node.level):null,half.twin?.side,half.edgeId,half.twin?'empty-cell':boundaries[half.edgeId]||'domain-edge');
  visit('U',key(node.faceId,node.level+1),'D',null,'top-air');visit('D',key(node.faceId,node.level-1),'U',null,'foundation');
 });
 const columnHeight=i=>{let n=1;const c=nodes[i];for(const d of [-1,1])for(let y=c.level+d;index.has(key(c.faceId,y));y+=d)n++;return n;};
 const isolated=i=>nodes.filter(n=>n.faceId===nodes[i].faceId).every(n=>{const j=index.get(key(n.faceId,n.level));return SIDES.every(s=>['air','foreign'].includes(exposure[j][s]));});
 return {kind:'prototype-face-layer-graph',cellCount:nodes.length,cells:()=>ids.map((id,index)=>({id,index})),cellId:i=>ids[i],indexOfId:id=>index.get(id)??-1,neighborsOf:i=>adjacency[i]||[],exposure:i=>exposure[i],boundaryOf:i=>boundary[i],columnHeight,columnIsolated:isolated,charOf:i=>nodes[i].char,faceOf:i=>byFace.get(nodes[i].faceId),nodes,faces:byFace};
}

// Endpoint pair compatibility preserves the existing symmetric/normal/flipped
// contract. Detailed sampled edge profiles would additionally need u -> 1-u.
function compatible(a,b,va,vb){
 if(!a||!b||a.connector==='boundary'||a.connector!==b.connector)return false;
 const pa=a.parity||'normal',pb=b.parity||'normal';
 if(pa==='symmetric'||pb==='symmetric'){if(pa!==pb)return false;}else if(pa===pb)return false;
 if((a.excludedNeighbors||[]).includes(vb.protoId)||(b.excludedNeighbors||[]).includes(va.protoId))return false;
 if((va.rules?.excludes||[]).includes(vb.protoId)||(vb.rules?.excludes||[]).includes(va.protoId))return false;
 return !!a.walkable===!!b.walkable;
}
export function compileSidePairTable(graph,compiled){
 const n=compiled.variants.length,tokens=new Set();
 for(let i=0;i<graph.cellCount;i++)for(const e of graph.neighborsOf(i))tokens.add(e.direction);
 const table={compatible:{},directions:[...tokens].sort()};
 for(const token of table.directions){
  const[,sideA,sideB]=token.split(':');
  table.compatible[token]=compiled.variants.map(()=>new BitSet(n,false));
  for(let a=0;a<n;a++)for(let b=0;b<n;b++)if(compatible(compiled.variants[a].faces[sideA],compiled.variants[b].faces[sideB],compiled.variants[a],compiled.variants[b]))table.compatible[token][a].set(b);
 }
 return table;
}
