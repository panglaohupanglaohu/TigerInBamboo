import * as THREE from 'three';

// Dredge only the authored harbor footprint in the original planet shell.
// Subdivision interpolates the original triangle (not a new sphere), retaining
// the exact original surface and vertex colors outside the submerged cut.
export function buildCitadelHarborSeabed(scene,castle){
 const planet=scene.getObjectByName('planet-surface'),city=castle.getObjectByName('highland-west-city');
 if(!planet||!city||planet.userData.citadelHarborSeabed)return;
 planet.updateWorldMatrix(true,false);city.updateWorldMatrix(true,false);
 const source=planet.geometry,attrs=source.attributes,index=source.index;
 const local=city.matrixWorld.clone().invert().multiply(planet.matrixWorld);
 const inverse=planet.matrixWorld.clone().invert(),world=new THREE.Vector3(),q=new THREE.Vector3();
 const names=Object.keys(attrs),out=Object.fromEntries(names.map(n=>[n,[]]));
 let split=0,changed=0,untouched=0,maxDrop=0;
 function vertex(i){return Object.fromEntries(names.map(n=>[n,Array.from({length:attrs[n].itemSize},(_,j)=>attrs[n].array[i*attrs[n].itemSize+j])]));}
 function midpoint(a,b){return Object.fromEntries(names.map(n=>[n,a[n].map((v,i)=>(v+b[n][i])/2)]));}
 function project(v){return new THREE.Vector3(...v.position).applyMatrix4(local);}
 function emit(v){
  q.fromArray(v.position).applyMatrix4(local);
  // Author-local rectangle: keep all city land and the remote hemisphere intact.
  const edge=Math.min(q.x-18,37.5-q.x,q.z+4,69-q.z);
  let weight=q.y>-60&&q.y<10?THREE.MathUtils.clamp(edge/2,0,1):0;
  weight=weight*weight*(3-2*weight);
  const p=v.position.slice();
  if(weight>0){world.fromArray(p).applyMatrix4(planet.matrixWorld);const drop=3.5*weight;world.multiplyScalar((world.length()-drop)/world.length()).applyMatrix4(inverse);p.splice(0,3,...world.toArray());changed++;maxDrop=Math.max(maxDrop,drop);}
  for(const n of names)out[n].push(...(n==='position'?p:v[n]));
 }
 function triangle(a,b,c,depth=0){
  const ps=[project(a),project(b),project(c)];
  const intersects=Math.max(...ps.map(p=>p.x))>=18&&Math.min(...ps.map(p=>p.x))<=37.5&&Math.max(...ps.map(p=>p.z))>=-4&&Math.min(...ps.map(p=>p.z))<=69&&Math.max(...ps.map(p=>p.y))>-60&&Math.min(...ps.map(p=>p.y))<10;
  const span=Math.max(ps[0].distanceTo(ps[1]),ps[1].distanceTo(ps[2]),ps[2].distanceTo(ps[0]));
  if(intersects&&span>1&&depth<6){split++;const ab=midpoint(a,b),bc=midpoint(b,c),ca=midpoint(c,a);triangle(a,ab,ca,depth+1);triangle(ab,b,bc,depth+1);triangle(ca,bc,c,depth+1);triangle(ab,bc,ca,depth+1);}
  else {if(!intersects)untouched++;emit(a);emit(b);emit(c);}
 }
 for(let i=0;i<(index?index.count:attrs.position.count);i+=3)triangle(...[0,1,2].map(j=>vertex(index?index.getX(i+j):i+j)));
 const geometry=new THREE.BufferGeometry();for(const n of names)geometry.setAttribute(n,new THREE.Float32BufferAttribute(out[n],attrs[n].itemSize));
 geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 planet.__citadelSeabedSource=source;
 planet.geometry=geometry;
 planet.userData.citadelHarborSeabed={sourceTriangles:(index?index.count:attrs.position.count)/3,triangles:out.position.length/9,split,changed,untouched,maxDrop,frame:'highland-west-city authored local',bounds:[18,37.5,-4,69],scope:'Local submerged planet-shell dredging; no boat docking claim'};
}
