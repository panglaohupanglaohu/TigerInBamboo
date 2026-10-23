import * as T from 'three';

const states=new WeakMap();
function components(mesh,innerInverse){
 const g=mesh.geometry,p=g?.attributes?.position;if(!p||g.index||p.count%36)return [];
 const matrix=innerInverse.clone().multiply(mesh.matrixWorld),rows=[];
 for(let first=0;first<p.count;first+=36){
  const vertices=Array.from({length:36},(_,i)=>new T.Vector3().fromBufferAttribute(p,first+i).applyMatrix4(matrix));
  const box=new T.Box3().setFromPoints(vertices),size=box.getSize(new T.Vector3());
  if(size.y<10)continue;
  // These owned batches consist solely of closed twelve-triangle bridge piers.
  // Read a horizontal slice through the living banks, not their tilted AABB.
  const slice=[];for(let i=0;i<36;i+=3)for(let j=0;j<3;j++){
   const a=vertices[i+j],b=vertices[i+(j+1)%3];
   if((a.y<=33&&b.y>=33)||(b.y<=33&&a.y>=33)){if(Math.abs(a.y-b.y)>1e-8)slice.push(a.clone().lerp(b,(33-a.y)/(b.y-a.y)));}
  }
  const center=new T.Vector3();if(slice.length)for(const v of slice)center.add(v);center.divideScalar(slice.length||1);
  const top=vertices.reduce((a,v)=>v.y>a.y?v:a,vertices[0]).clone();
  // Box top centre, rather than a corner, anchors the replacement bearing.
  const topVertices=[...new Map(vertices.map(v=>[v.toArray().join(','),v])).values()].sort((a,b)=>b.y-a.y).slice(0,4);
  if(topVertices.length)top.copy(topVertices.reduce((a,v)=>a.add(v),new T.Vector3()).divideScalar(topVertices.length));
  rows.push({mesh,first,vertices,box,center,top,crosses:slice.length>0,inside:slice.some(v=>Math.hypot(v.x,v.z)<36)});
 }
 return rows;
}
function filteredGeometry(source,remove){
 const geometry=new T.BufferGeometry(),count=source.attributes.position.count;
 for(const [name,a]of Object.entries(source.attributes)){
  const values=[];for(let i=0;i<count;i++)if(!remove.has(Math.floor(i/36)*36))for(let j=0;j<a.itemSize;j++)values.push(a.array[i*a.itemSize+j]);
  geometry.setAttribute(name,new T.BufferAttribute(new a.array.constructor(values),a.itemSize,a.normalized));
 }
 geometry.userData={...source.userData};geometry.computeBoundingBox();geometry.computeBoundingSphere();return geometry;
}
function samePositions(a,b){const x=a.attributes.position.array,y=b.attributes.position.array;if(x.length!==y.length)return false;for(let i=0;i<x.length;i++)if(x[i]!==y[i])return false;return true;}

// Collision probes use real closed fan triangles, not their large envelopes.
function leafClearance(inner,arch){
 const started=performance.now();inner.updateWorldMatrix(true,true);
 const recipes=[
  {anchor:[-47.9160074,77.7425551,1.8693020],axis:[1,0,0],degrees:10,shrink:1},
  {anchor:[-48.1823379,78.7256144,1.6590436],axis:[1,-1,1],degrees:20,shrink:1},
  {anchor:[-42.8000183,74.8391148,-12.1951459],axis:[-1,1,-1],degrees:45,shrink:.85},
  {anchor:[32.1545019,73.4135799,-10.0174674],axis:[-1,-1,-1],degrees:10,shrink:1},
  {anchor:[32.8608129,79.3848037,-14.2275457],axis:[-1,1,0],degrees:45,shrink:1},
  {anchor:[-43.0650889,75.9401247,-12.0588532],trim:true},
  {anchor:[32.9918697,78.8028225,-14.3020147],trim:true},
 ];

 const inverse=inner.matrixWorld.clone().invert(),material=new T.MeshBasicMaterial({side:T.DoubleSide}),archProxy=new T.Mesh(arch.geometry,material),ray=new T.Raycaster();
 archProxy.updateMatrixWorld(true);
 const edges=(geometry,matrix)=>{const p=geometry.attributes.position,ix=geometry.index,result=[],seen=new Set();for(let i=0,n=ix?.count??p.count;i<n;i+=3)for(let j=0;j<3;j++){const a=new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j).applyMatrix4(matrix),b=new T.Vector3().fromBufferAttribute(p,ix?ix.getX(i+(j+1)%3):i+(j+1)%3).applyMatrix4(matrix),k=[a.toArray().join(','),b.toArray().join(',')].sort().join('|');if(!seen.has(k)&&a.distanceToSquared(b)>1e-12){seen.add(k);result.push([a,b]);}}return result;};
 const pieces=[],ap=arch.geometry.attributes.position;for(let i=0;i<ap.count;i+=36){const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(ap.array.slice(i*3,(i+36)*3),3));geometry.computeBoundingBox();geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,material);mesh.updateMatrixWorld(true);pieces.push({index:i/36,mesh,box:geometry.boundingBox,edges:edges(geometry,new T.Matrix4())});}
 const edgeHits=(list,target,stop=false)=>{let count=0;for(const[a,b]of list){const d=b.clone().sub(a);ray.set(a,d.clone().normalize());ray.near=0;ray.far=d.length();if(ray.intersectObject(target,false).length){count++;if(stop)return count;}}return count;};
 const inside=(point,target)=>{target.geometry.computeBoundingBox();const local=point.clone().applyMatrix4(target.matrixWorld.clone().invert());if(!target.geometry.boundingBox.containsPoint(local))return false;ray.set(point,new T.Vector3(.8123,.3471,.4683).normalize());ray.near=1e-6;ray.far=Infinity;const distances=ray.intersectObject(target,false).map(h=>h.distance).sort((a,b)=>a-b).filter((d,i,all)=>i===0||d-all[i-1]>1e-5);return distances.length%2===1;};
 let totalInstances=0;const probes=[];inner.traverse(mesh=>{if(!mesh.isInstancedMesh||mesh.name!=='greg-coral-fan-crown'||mesh.userData.canopySource!=='v2-rim-foliage-lobes'||!mesh.visible)return;totalInstances+=mesh.count;mesh.geometry.computeBoundingBox();for(let i=0;i<mesh.count;i++){const original=new T.Matrix4();mesh.getMatrixAt(i,original);const parent=inverse.clone().multiply(mesh.matrixWorld),proxy=new T.Mesh(mesh.geometry,material);proxy.matrixAutoUpdate=false;const set=matrix=>{proxy.matrix.copy(parent).multiply(matrix);proxy.updateMatrixWorld(true);};set(original);const box=mesh.geometry.boundingBox.clone().applyMatrix4(proxy.matrixWorld);if(!pieces.some(p=>p.box.intersectsBox(box)))continue;probes.push({mesh,instance:i,original,proxy,set});}});
 const measure=(probe,stop=false)=>{if(probe.trimmed)return 0;const box=probe.mesh.geometry.boundingBox.clone().applyMatrix4(probe.proxy.matrixWorld),near=pieces.filter(p=>p.box.intersectsBox(box));if(!near.length)return 0;const leafEdges=edges(probe.mesh.geometry,probe.proxy.matrixWorld);let count=0;for(const piece of near){const a=edgeHits(piece.edges,probe.proxy,stop);if(stop&&a)return a;const b=edgeHits(leafEdges,piece.mesh,stop);if(stop&&b)return b;count+=a+b+(inside(leafEdges[0][0],piece.mesh)?1:0)+(inside(piece.edges[0][0],probe.proxy)?1:0);if(stop&&count)return count;}return count;};
 const affected=probes.map(probe=>({probe,before:measure(probe,true)})).filter(r=>r.before),changes=[],unresolved=[],anchorDiagnostics=[];
 for(const {probe}of affected){const point=new T.Vector3().setFromMatrixPosition(probe.proxy.matrixWorld),contacts=[];for(const piece of pieces)if(inside(point,piece.mesh)){let depth=Infinity;const p=piece.mesh.geometry.attributes.position;for(let i=0;i<p.count;i+=3){const tri=new T.Triangle(...[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,i+j)));depth=Math.min(depth,tri.closestPointToPoint(point,new T.Vector3()).distanceTo(point));}contacts.push({piece:piece.index,depthInner:depth});}anchorDiagnostics.push({instance:probe.instance,anchor:point.toArray(),contacts});}
 // Seven or fewer boundary leaves is a local correction. Never reshape a
 // whole crown to make this bridge fit, and never change a branch endpoint.
 if(affected.length<=7)for(const {probe}of affected){
  const anchor=new T.Vector3().setFromMatrixPosition(probe.original),worldAnchor=new T.Vector3().setFromMatrixPosition(probe.proxy.matrixWorld),recipe=recipes.find(r=>worldAnchor.distanceTo(new T.Vector3(...r.anchor))<.02);let chosen=null;if(pieces.some(p=>inside(worldAnchor,p.mesh))){unresolved.push(probe.instance);continue;}
  // Only two measured new leaves may be trimmed. Exclude their probes from
  // visible collision work explicitly; never invert a singular hide matrix.
  if(recipe?.trim){const matrix=new T.Matrix4().makeScale(0,0,0).setPosition(anchor);probe.mesh.setMatrixAt(probe.instance,matrix);probe.mesh.instanceMatrix.needsUpdate=true;probe.trimmed=true;changes.push({mesh:probe.mesh,instance:probe.instance,original:probe.original,changed:matrix,trimmed:true,degrees:0,scale:0});continue;}
  const options=[];for(const shrink of [1,.95,.9,.85])for(const axis of ['y','x','z'])for(const degrees of [0,5,-5,10,-10,15,-15,20,-20,25,-25,30,-30,35,-35,40,-40,45,-45])if(shrink!==1||degrees!==0)options.push({shrink,axis,degrees,score:(1-shrink)*100+Math.abs(degrees)*.2});options.sort((a,b)=>a.score-b.score);if(recipe&&!recipe.trim)options.unshift(recipe);
  for(const option of options){const matrix=new T.Matrix4().makeRotationAxis((Array.isArray(option.axis)?new T.Vector3(...option.axis).normalize():new T.Vector3(option.axis==='x'?1:0,option.axis==='y'?1:0,option.axis==='z'?1:0)),option.degrees*Math.PI/180).multiply(probe.original);matrix.scale(new T.Vector3(option.shrink,option.shrink,option.shrink));matrix.setPosition(anchor);probe.set(matrix);if(!measure(probe,true)){chosen={...option,matrix};break;}}
  if(chosen){probe.mesh.setMatrixAt(probe.instance,chosen.matrix);probe.mesh.instanceMatrix.needsUpdate=true;changes.push({mesh:probe.mesh,instance:probe.instance,original:probe.original,changed:chosen.matrix,axis:chosen.axis,degrees:chosen.degrees,scale:chosen.shrink});}
  else{probe.set(probe.original);unresolved.push(probe.instance);}
 }
 else unresolved.push(...affected.map(r=>r.probe.instance));
 const changedMeshes=new Set(changes.map(c=>c.mesh));for(const mesh of changedMeshes){mesh.computeBoundingBox();mesh.computeBoundingSphere();}
 const remaining=probes.reduce((n,p)=>n+measure(p),0);for(const p of pieces)p.mesh.geometry.dispose();material.dispose();
 return{changes,report:{anchorDiagnostics,affectedInstances:affected.map(r=>r.probe.instance),changedInstances:changes.map(c=>({instance:c.instance,source:c.mesh.userData.canopySource,trimmed:c.trimmed===true,axis:c.axis,degrees:c.degrees,scale:c.scale})),trimmedInstances:changes.filter(c=>c.trimmed).map(c=>c.instance),visibleInstancesBefore:totalInstances,visibleInstancesAfter:totalInstances-changes.filter(c=>c.trimmed).length,unresolvedInstances:unresolved,remainingBidirectionalIntersections:remaining,candidateInstances:probes.length,installMs:performance.now()-started,instanceCountBefore:totalInstances,instanceCountAfter:totalInstances,branchesChanged:false,anchorTranslationsChanged:false}};
}

/** Final-placement repair: leave all rail paths, decks and story objects intact.
 * Replace only measured bridge piers inside the relocated open lake bowl. */
export function installSwampBridgeClearance(scene,swamp,{enabled=new URLSearchParams(globalThis.location?.search||'').get('gregLakeBridgeClearance')!=='0'}={}){
 const inner=swamp?.userData?.inner||swamp;if(!inner||!enabled)return null;if(states.has(inner))return states.get(inner).report;
 scene.updateMatrixWorld(true);const inverse=inner.matrixWorld.clone().invert(),sources=[];
 scene.traverse(o=>{if(!o.isMesh||o.userData.isOutline)return;
  if(o.name==='gate-site-GateSite_stone-solid'||(o.parent?.name==='tram-static-sector'&&o.userData.materialSourceNames?.length===1&&o.userData.materialSourceNames[0]==='tram-static-pier'))sources.push(o);
 });
 const all=sources.flatMap(o=>components(o,inverse)),removed=all.filter(r=>r.crosses&&r.inside),tram=all.filter(r=>r.mesh.parent?.name==='tram-static-sector');
 if(!removed.length)return {ok:true,removedPiers:0,reason:'no intersecting pier components'};
 const cutTram=tram.filter(r=>removed.includes(r));if(cutTram.length<2)return {ok:false,reason:'both generic bearing endpoints must be measured'};
 let ends=[cutTram[0],cutTram[1]],distance=0;for(const a of cutTram)for(const b of cutTram){const d=a.top.distanceToSquared(b.top);if(d>distance){distance=d;ends=[a,b];}}
 const axis=ends[1].top.clone().sub(ends[0].top).normalize(),origin=ends[0].top,project=r=>r.top.clone().sub(origin).dot(axis),lo=Math.min(...cutTram.map(project)),hi=Math.max(...cutTram.map(project));
 const retained=tram.filter(r=>!removed.includes(r)).filter(r=>{const t=project(r),on=origin.clone().addScaledVector(axis,t);return on.distanceTo(r.top)<8;});
 const left=retained.filter(r=>project(r)<lo).sort((a,b)=>project(b)-project(a))[0],right=retained.filter(r=>project(r)>hi).sort((a,b)=>project(a)-project(b))[0];
 if(!left||!right)return {ok:false,reason:'retained supports on both sides not found'};
 const scale=inner.getWorldScale(new T.Vector3()).x,spanWorld=left.top.distanceTo(right.top)*scale;
 if(spanWorld>55)return {ok:false,reason:'measured span exceeds narrow bridge repair',spanWorld};
 // Two continuous shallow stone ribs and end crossheads bridge the actual
 // retained bearings. Their spring line is high above the inhabited banks.
 const a=left.top.clone(),b=right.top.clone(),side=new T.Vector3(b.z-a.z,0,a.x-b.x).normalize(),vertices=[];
 const quad=(A,B,C,D)=>vertices.push(...A,...B,...D,...B,...C,...D);
 const prism=(A,B,width,depth)=>{const up=A.clone().add(B).multiplyScalar(.5).applyMatrix4(inner.matrixWorld).normalize().transformDirection(inverse),n=up.clone().cross(B.clone().sub(A)).normalize().multiplyScalar(width/2),d=up.multiplyScalar(-depth),p=[A.clone().add(n),A.clone().sub(n),B.clone().sub(n),B.clone().add(n)];quad(...p);quad(...p.map(v=>v.clone().add(d)).reverse());for(let i=0;i<4;i++)quad(p[i],p[(i+1)%4],p[(i+1)%4].clone().add(d),p[i].clone().add(d));};
 const springDrop=8/scale,rise=6.5/scale,ribDepth=.8/scale,halfWidth=3.98/scale;
 const stations=[left,...cutTram.sort((a,b)=>project(a)-project(b)),right].map(r=>r.top.clone()),route=new T.CatmullRomCurve3(stations,false,'centripetal');
 const frame=t=>{const p=route.getPoint(t),tangent=route.getTangent(t),radial=p.clone().applyMatrix4(inner.matrixWorld).normalize().transformDirection(inverse),normal=radial.cross(tangent).normalize(),up=tangent.clone().cross(normal).normalize();return {p,normal,up};};
 const ribPoint=(t,offset)=>{const f=frame(t);return f.p.addScaledVector(f.normal,offset).addScaledVector(f.up,-springDrop+rise*4*t*(1-t));};
 const post=(A,B,width)=>{const direction=B.clone().sub(A),g=new T.BoxGeometry(width,direction.length(),width).toNonIndexed();g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),direction.normalize()));g.translate(...A.clone().add(B).multiplyScalar(.5));vertices.push(...g.attributes.position.array);g.dispose();};
 let spandrelPosts=0;
 for(const offset of [-halfWidth,halfWidth]){
  for(let i=0;i<32;i++)prism(ribPoint(i/32,offset),ribPoint((i+1)/32,offset),.65/scale,ribDepth);
  // The original beam underside is trackR-.70; each retained pier top was
  // authored at trackR-.45. These short posts physically join rib and beam.
  for(let i=0;i<=12;i++){const t=i/12,f=frame(t),upper=f.p.addScaledVector(f.normal,offset).addScaledVector(f.up,-.25/scale);post(ribPoint(t,offset),upper,.42/scale);spandrelPosts++;}
 }
 for(const t of [0,1]){const f=frame(t),c=f.p.addScaledVector(f.up,-springDrop);prism(c.clone().addScaledVector(f.normal,-4.35/scale),c.clone().addScaledVector(f.normal,4.35/scale),1.2/scale,1/scale);}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const stone=sources.find(o=>o.name==='gate-site-GateSite_stone-solid'),color=stone?.geometry.attributes.color;
 const material=new T.MeshStandardMaterial({color:color?new T.Color(color.getX(0),color.getY(0),color.getZ(0)):0x8a8f94,roughness:.96,flatShading:true});
 const arch=new T.Mesh(geometry,material);arch.name='greg-lake-high-bridge-bearing-arches';arch.castShadow=true;arch.receiveShadow=true;arch.userData.presentationOnly=true;
 const changes=[];
 for(const source of sources){const remove=new Set(removed.filter(r=>r.mesh===source).map(r=>r.first));if(!remove.size)continue;
  const outlines=source.parent.children.filter(o=>o.isMesh&&o!==source&&o.userData.isOutline&&samePositions(source.geometry,o.geometry));
  for(const mesh of [source,...outlines]){const original=mesh.geometry,replacement=filteredGeometry(original,remove);changes.push({mesh,original,replacement});mesh.geometry=replacement;}
 }
 inner.add(arch);const leaf=leafClearance(inner,arch);
 const report={ok:true,version:1,removedPiers:removed.length,removedGatePiers:removed.filter(r=>r.mesh.name==='gate-site-GateSite_stone-solid').length,removedGenericPiers:cutTram.length,retainedPiers:all.length-removed.length,spanWorld,retainedBearingCenters:[a.toArray(),b.toArray()],archBottomInnerY:geometry.boundingBox.min.y,bankSightlineInnerY:33,bankClearanceWorld:(geometry.boundingBox.min.y-33)*scale,leafClearance:leaf.report,spandrelPosts,renderMeshesAdded:1,modifiedBatches:changes.length,deckAndRoutesChanged:false,cutRadiusInner:36,
  dispose(){for(const c of leaf.changes){c.mesh.setMatrixAt(c.instance,c.original);c.mesh.instanceMatrix.needsUpdate=true;}for(const mesh of new Set(leaf.changes.map(c=>c.mesh))){mesh.computeBoundingBox();mesh.computeBoundingSphere();}for(const c of changes){c.mesh.geometry=c.original;c.replacement.dispose();}arch.removeFromParent();geometry.dispose();material.dispose();states.delete(inner);delete inner.userData.gregBridgeClearance;}};
 inner.userData.gregBridgeClearance=report;states.set(inner,{report,changes});return report;
}
