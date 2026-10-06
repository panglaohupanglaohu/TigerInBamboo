import * as THREE from 'three';

/** Pure terrain-first candidate. bounds={minX,maxX,minZ,maxZ}; heights and
 * floor are in one caller-owned chart. Invalid-domain cells are conservatively
 * omitted (all four corners must be valid), not interpolated across null sea.
 * No city/rail constraints, scene mutations or implicit source replacement. */
export function buildTargetTerrainHeightfield({bounds,heightAt,floorAt,step=2,maxCells=250000}={}){
 if(!bounds||![bounds.minX,bounds.maxX,bounds.minZ,bounds.maxZ,step].every(Number.isFinite)||bounds.maxX<=bounds.minX||bounds.maxZ<=bounds.minZ||step<=0||typeof heightAt!=='function'||typeof floorAt!=='function')throw new Error('finite bounds, positive step and height/floor callbacks required');
 const nx=Math.ceil((bounds.maxX-bounds.minX)/step),nz=Math.ceil((bounds.maxZ-bounds.minZ)/step);
 if(nx*nz>maxCells)throw new Error('heightfield cell budget exceeded');
 const samples=[],positions=[],indices=[],edgeUse=new Map(),activeCells=[];let invalidSamples=0,invalidCells=0;
 for(let j=0;j<=nz;j++)for(let i=0;i<=nx;i++){
  const x=THREE.MathUtils.lerp(bounds.minX,bounds.maxX,i/nx),z=THREE.MathUtils.lerp(bounds.minZ,bounds.maxZ,j/nz),floor=floorAt(x,z);
  if(floor===null){samples.push(null);invalidSamples++;continue;}
  const y=heightAt(x,z);
  if(y===null){samples.push(null);invalidSamples++;continue;}
  if(!Number.isFinite(floor)||!Number.isFinite(y))throw new Error(`nonfinite height/floor at ${x},${z}`);
  if(y<=floor)throw new Error(`top must be strictly above floor at ${x},${z}`);
  samples.push({x,z,y,floor});
 }
 const id=(i,j)=>j*(nx+1)+i;
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){
  const corners=[id(i,j),id(i+1,j),id(i+1,j+1),id(i,j+1)];
  if(corners.some(k=>samples[k]===null)){invalidCells++;continue;}
  activeCells.push(corners);
 }
 // Separate face-connected components. Corner-only contacts must not share a
 // vertex; sharing those would create a nonmanifold pinch despite edge-count 2.
 const cellEdge=new Map(),parents=activeCells.map((_,i)=>i);
 const find=i=>parents[i]===i?i:(parents[i]=find(parents[i]));
 const edgeKey=(a,b)=>a<b?`${a}:${b}`:`${b}:${a}`;
 activeCells.forEach((c,k)=>{for(let j=0;j<4;j++){const key=edgeKey(c[j],c[(j+1)%4]);if(cellEdge.has(key)){const a=find(k),b=find(cellEdge.get(key));parents[a]=b;}else cellEdge.set(key,k);}});
 const vertexMap=new Map();const vertex=(sampleId,component,bottom)=>{const key=`${component}/${sampleId}/${bottom}`,s=samples[sampleId];if(!vertexMap.has(key)){vertexMap.set(key,positions.length/3);positions.push(s.x,bottom?s.floor:s.y,s.z);}return vertexMap.get(key);};
 activeCells.forEach((c,k)=>{
  const component=find(k),t=c.map(s=>vertex(s,component,false)),b=c.map(s=>vertex(s,component,true));
  indices.push(t[0],t[2],t[1],t[0],t[3],t[2],b[0],b[1],b[2],b[0],b[2],b[3]);
  for(let j=0;j<4;j++){const a=c[j],bb=c[(j+1)%4],key=`${component}/${edgeKey(a,bb)}`;if(edgeUse.has(key))edgeUse.get(key).count++;else edgeUse.set(key,{count:1,a:t[j],b:t[(j+1)%4],bottomA:b[j],bottomB:b[(j+1)%4]});}
 });
 let boundaryEdges=0;for(const e of edgeUse.values())if(e.count===1){boundaryEdges++;indices.push(e.a,e.b,e.bottomB,e.a,e.bottomB,e.bottomA);}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 // Validate Float32 output, not merely double input: reject collapsing scales.
 const p=geometry.attributes.position,v=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];let minArea=Infinity;
 for(let i=0;i<indices.length;i+=3){for(let j=0;j<3;j++)v[j].fromBufferAttribute(p,indices[i+j]);const area=v[1].sub(v[0]).cross(v[2].sub(v[0])).length()/2;if(!Number.isFinite(area)||area<=0){geometry.dispose();throw new Error('float32 triangle collapsed or nonfinite');}minArea=Math.min(minArea,area);}
 const audit={revision:'target-terrain-heightfield-1',grid:[nx,nz],stepActual:[(bounds.maxX-bounds.minX)/nx,(bounds.maxZ-bounds.minZ)/nz],validCells:activeCells.length,invalidCells,invalidSamples,boundaryEdges,components:new Set(activeCells.map((_,i)=>find(i))).size,vertices:p.count,triangles:indices.length/3,minArea:Number.isFinite(minArea)?minArea:null,domainPolicy:'omit whole cells touching null; cap resulting boundary; no analytic sea-curve clipping',closed:activeCells.length>0,empty:activeCells.length===0,coordinateSpace:'caller chart',sceneMutation:false};geometry.userData.targetTerrainHeightfield=audit;return {geometry,audit};
}
