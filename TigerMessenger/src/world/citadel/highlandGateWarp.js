import * as THREE from 'three';
// Split authored triangles into short strips before bending them with the rail.
// A long wall face would otherwise become a chord through the freight path.
// Clipping preserves every original attribute and material group.
export function refineGateForRail(geometry,maxStep=2){
 if(!Number.isFinite(maxStep)||maxStep<=0)throw new Error('Gate refinement step must be positive');
 const attrs=Object.entries(geometry.attributes),position=geometry.attributes.position,index=geometry.index;
 if(!position)return geometry;const count=index?index.count:position.count;
 let needs=false;for(let i=0;i<count;i+=3){const z=[0,1,2].map(k=>position.getZ(index?index.getX(i+k):i+k));if(Math.max(...z)-Math.min(...z)>maxStep){needs=true;break;}}
 if(!needs)return geometry;
 const output=Object.fromEntries(attrs.map(([name])=>[name,[]])),groups=[];
 const vertex=i=>Object.fromEntries(attrs.map(([name,a])=>[name,Array.from({length:a.itemSize},(_,k)=>a.array[i*a.itemSize+k])]));
 const mix=(a,b,t)=>Object.fromEntries(attrs.map(([name])=>[name,a[name].map((v,k)=>v+(b[name][k]-v)*t)]));
 function clip(poly,z,above){const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],inside=p=>above?p.position[2]>=z:p.position[2]<=z,ai=inside(a),bi=inside(b);if(ai)result.push(a);if(ai!==bi)result.push(mix(a,b,(z-a.position[2])/(b.position[2]-a.position[2])));}return result;}
 const a=new THREE.Vector3(),b=new THREE.Vector3(),cross=new THREE.Vector3();
 function append(v){a.fromArray(v[1].position).sub(new THREE.Vector3().fromArray(v[0].position));b.fromArray(v[2].position).sub(new THREE.Vector3().fromArray(v[0].position));if(cross.crossVectors(a,b).lengthSq()<1e-18)return;for(const p of v)for(const [name]of attrs)output[name].push(...p[name]);}
 for(let i=0;i<count;i+=3){
  const v=[0,1,2].map(k=>vertex(index?index.getX(i+k):i+k)),z=v.map(p=>p.position[2]),lo=Math.min(...z),hi=Math.max(...z),start=output.position.length/3;
  if(hi-lo<=maxStep)append(v);else for(let lower=Math.floor(lo/maxStep)*maxStep;lower<hi;lower+=maxStep){const poly=clip(clip(v,lower,true),lower+maxStep,false);for(let j=1;j<poly.length-1;j++)append([poly[0],poly[j],poly[j+1]]);}
  const group=geometry.groups.find(g=>i>=g.start&&i<g.start+g.count),length=output.position.length/3-start;
  if(group&&length){const last=groups.at(-1);if(last&&last.materialIndex===group.materialIndex&&last.start+last.count===start)last.count+=length;else groups.push({start,count:length,materialIndex:group.materialIndex});}
 }
 const refined=new THREE.BufferGeometry();for(const [name,a]of attrs)refined.setAttribute(name,new THREE.BufferAttribute(new a.array.constructor(output[name]),a.itemSize,a.normalized));for(const g of groups)refined.addGroup(g.start,g.count,g.materialIndex);refined.name=geometry.name;refined.userData={...geometry.userData};return refined;
}
