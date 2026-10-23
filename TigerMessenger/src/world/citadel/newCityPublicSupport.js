import * as T from 'three';
import {buildMountainSurfaceIndex} from './mountainSurfaceIndex.js';

const visible=o=>{for(let n=o;n;n=n.parent)if(!n.visible)return false;return true;};
const publicName=/^(target-plaza-paving-surface|target-horse-paving|surveyed-route-tread-\d+|main-hall-floor|entrance-landing(?:-radial-transition|-surveyed-joint)?|entrance-stair-\d+|bridge-stair-connector-stepped-floor|bridge-stair-connector-cell-\d+|bay-bridge-walking-deck-\d+|rear-court-stone-floor|rear-court-door-path|rear-court-access-step-\d+)$/;
// New court paths opt in explicitly; fountain pools, walls and roofs never do.
const isPublicSurface=o=>publicName.test(o.name)||o.userData.newCityPublicWalkable===true;
/** The released city's actual public triangles, never the old highland city or
 * rock slope. Coordinates are castle-local; all queries use this same up. */
export function createNewCityPublicSupport(castle,{root,spacing=.65,onProgress=()=>{}}={}){
 if(!castle||!root)return null;
 castle.updateWorldMatrix(true,true);root.updateWorldMatrix(true,true);
 const inverse=castle.matrixWorld.clone().invert(),up=new T.Vector3(0,1,0).transformDirection(castle.matrixWorld),ray=new T.Raycaster(),normal=new T.Vector3(),records=[];
 ray.layers.enableAll();
 const meshes=new Set();root.traverse(o=>meshes.add(o));
 // The migrated horse paving is intentionally owned outside runtime.root.
 castle.traverse(o=>{if(o.name==='target-horse-paving')meshes.add(o);});
 for(const o of meshes){if(!o.isMesh||o.userData.isOutline||!visible(o)||!isPublicSurface(o))continue;
  const g=o.geometry;g.computeBoundingBox();records.push({mesh:o,box:g.boundingBox.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld)),normal:new T.Matrix3().getNormalMatrix(o.matrixWorld)});
 }
 const surfaceIndex=buildMountainSurfaceIndex(records.map(r=>r.mesh)),recordByMesh=new Map(records.map(r=>[r.mesh,r]));
 onProgress({phase:"public-index",meshes:records.length,triangles:surfaceIndex.stats.triangles});
 const collisionRoots=[root,...['citadel-plaza-hero-statue','citadel-trojan-horse'].map(name=>castle.getObjectByName(name)).filter(Boolean)];
 const solids=[];for(const collisionRoot of collisionRoots)collisionRoot.traverse(o=>{if(!o.isMesh||o.userData.isOutline||!visible(o)||isPublicSurface(o))return;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.every(m=>m?.transparent))return;o.geometry.computeBoundingBox();solids.push({mesh:o,box:o.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld))});});
 const publicBounds=new T.Box3();for(const r of records)publicBounds.union(r.box);publicBounds.expandByScalar(1.5);
 const bodyIndex=buildMountainSurfaceIndex(solids.filter(r=>r.box.intersectsBox(publicBounds)).map(r=>r.mesh));
 onProgress({phase:"body-index",triangles:bodyIndex.stats.triangles});
 const bodyCells=new Map(),largeSolids=[];
 for(const r of solids){const x0=Math.floor((r.box.min.x-.25)/2),x1=Math.floor((r.box.max.x+.25)/2),z0=Math.floor((r.box.min.z-.25)/2),z1=Math.floor((r.box.max.z+.25)/2);if((x1-x0+1)*(z1-z0+1)>2000){largeSolids.push(r);continue;}for(let x=x0;x<=x1;x++)for(let z=z0;z<=z1;z++){const key=`${x},${z}`;if(!bodyCells.has(key))bodyCells.set(key,[]);bodyCells.get(key).push(r);}}
 function clearBody(p){
  const near=[...(bodyCells.get(`${Math.floor(p.x/2)},${Math.floor(p.z/2)}`)||[]),...largeSolids];
  const candidates=near.filter(r=>r.mesh.parent&&visible(r.mesh)&&r.box.max.x>p.x-.22&&r.box.min.x<p.x+.22&&r.box.max.z>p.z-.22&&r.box.min.z<p.z+.22&&r.box.max.y>p.y+.28&&r.box.min.y<p.y+1.3).map(r=>r.mesh);
  if(!candidates.length)return true;
  // A short ray wholly inside a thick wall has no front-face hit. Reject its
  // occupied body volume too; architectural mesh bounds are conservative.
  for(const r of near)if(candidates.includes(r.mesh)&&r.mesh.geometry.type==='BoxGeometry'){const inside=toWorld(p.clone().add(new T.Vector3(0,.8,0))).applyMatrix4(r.mesh.matrixWorld.clone().invert());if(r.mesh.geometry.boundingBox.containsPoint(inside))return false;}
  for(const y of [.35,.8,1.2])for(const [x,z]of[[1,0],[-1,0],[0,1],[0,-1]]){ray.set(toWorld(p.clone().add(new T.Vector3(-x*.25,y,-z*.25))),new T.Vector3(x,0,z).transformDirection(castle.matrixWorld));ray.far=.5;if(bodyIndex.sample(ray.ray,0,ray.far,h=>h.object.parent&&visible(h.object)))return false;}
  return true;
 }
 const report={publicMeshNames:records.map(r=>r.mesh.name),source:'released-new-city-public-triangles-v1',publicMeshes:records.length,nodes:0,posts:0,rejectedFeet:0,blockedMoves:0,actualSceneVerified:false};
 const toWorld=p=>castle.localToWorld(p.clone()),toLocal=p=>p.clone().applyMatrix4(inverse);
 function hitLocal(p,upRange=.45,drop=.6){
  if(!root.parent)return null;
  ray.set(toWorld(p.clone().add(new T.Vector3(0,upRange,0))),up.clone().negate());ray.far=upRange+drop;
  return surfaceIndex.sample(ray.ray,0,ray.far,h=>{const r=recordByMesh.get(h.object);return r.mesh.parent&&visible(r.mesh)&&!r.mesh.userData.targetSupportDisabled&&h.face&&normal.copy(h.face.normal).applyMatrix3(r.normal).normalize().dot(up)>.6;});
 }
 function supportLocal(p,{footprint=true,upRange=.45,drop=.6}={}){
  const h=hitLocal(p,upRange,drop);if(!h)return null;const q=toLocal(h.point);
  if(footprint)for(const [x,z]of[[.13,0],[-.13,0],[0,.13],[0,-.13]]){const edge=hitLocal(q.clone().add(new T.Vector3(x,0,z)),.36,.36);if(!edge||Math.abs(toLocal(edge.point).y-q.y)>.36)return null;}
  q.supportMesh=h.object.name;return clearBody(q)?q:null;
 }
 const nodes=[],keys=new Set();
 for(const r of records){for(let x=Math.ceil(r.box.min.x/spacing)*spacing;x<r.box.max.x;x+=spacing)for(let z=Math.ceil(r.box.min.z/spacing)*spacing;z<r.box.max.z;z+=spacing){
  const p=supportLocal(new T.Vector3(x,r.box.max.y,z),{upRange:.1,drop:Math.max(.2,r.box.max.y-r.box.min.y+.1)});if(!p){report.rejectedFeet++;continue;}
  const key=[p.x,p.y,p.z].map(v=>Math.round(v*100)).join(',');if(keys.has(key))continue;keys.add(key);nodes.push({local:p,world:toWorld(p),mesh:p.supportMesh,links:[]});
 }}
 onProgress({phase:"nodes",nodes:nodes.length,solids:solids.length});
 // The sampled graph cannot bridge a void: every edge samples actual support.
 function segment(a,b){const n=Math.max(1,Math.ceil(a.distanceTo(b)/.18));let last=null;for(let i=0;i<=n;i++){const p=supportLocal(a.clone().lerp(b,i/n));if(!p||last&&Math.abs(last.y-p.y)>.36)return false;last=p;}return true;}
 const buckets=new Map(),keyFor=(x,z)=>`${Math.round(x/spacing)},${Math.round(z/spacing)}`;
 nodes.forEach((n,i)=>{const key=keyFor(n.local.x,n.local.z);if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(i);});
 nodes.forEach((n,i)=>{const x=Math.round(n.local.x/spacing),z=Math.round(n.local.z/spacing);for(const [dx,dz]of[[1,0],[0,1]])for(const j of buckets.get(`${x+dx},${z+dz}`)||[]){if(Math.abs(nodes[j].local.y-n.local.y)<=.5&&segment(n.local,nodes[j].local)){n.links.push(j);nodes[j].links.push(i);}}});
 const seen=new Set(),components=[];for(let i=0;i<nodes.length;i++){if(seen.has(i))continue;const component=[],queue=[i];seen.add(i);while(queue.length){const id=queue.pop();component.push(id);for(const j of nodes[id].links)if(!seen.has(j)){seen.add(j);queue.push(j);}}components.push(component);}
 components.sort((a,b)=>b.length-a.length);const component=components[0]||[],allowed=new Set(component);
 const sorted=component.map(i=>nodes[i]).sort((a,b)=>b.local.y-a.local.y||a.local.z-b.local.z||a.local.x-b.local.x),posts=[];
 // Keep the public stair axis clear: broad floors/plaza host stationary squads.
 for(const n of sorted){if(/stair|tread/.test(n.mesh))continue;if(posts.every(p=>p.distanceTo(n.world)>.82))posts.push(n.world.clone().addScaledVector(up,.05));if(posts.length===28)break;}
 report.nodes=nodes.length;report.components=components.length;report.connectedNodes=component.length;report.connectedStairNodes=component.filter(i=>/stair|tread/.test(nodes[i].mesh)).length;report.posts=posts.length;report.ready=posts.length>=28;
 function nearest(world){let best=-1,d=Infinity;const p=toLocal(world);for(const i of component){const dist=nodes[i].local.distanceToSquared(p);if(dist<d){d=dist;best=i;}}return best;}
 function path(a,b){const start=nearest(a),end=nearest(b);if(start<0||end<0)return null;const queue=[start],previous=new Map([[start,null]]);for(let k=0;k<queue.length&&!previous.has(end);k++)for(const n of nodes[queue[k]].links)if(allowed.has(n)&&!previous.has(n)){previous.set(n,queue[k]);queue.push(n);}if(!previous.has(end))return null;const out=[];for(let i=end;i!==null;i=previous.get(i))out.push(nodes[i].world.clone());return out.reverse();}
 const mainFloor=records.find(r=>r.mesh.name==='main-hall-floor'),mainCenter=mainFloor?.box.getCenter(new T.Vector3());
 const mainNodes=component.map(i=>nodes[i]).filter(n=>n.mesh==='main-hall-floor');report.connectedMainHallNodes=mainNodes.length;
 report.mainHallReachable=mainNodes.length>0;report.routeDestination=mainNodes.length?"new-city-main-hall":"new-city-supported-entrance";
 const destination=mainCenter?mainNodes.sort((a,b)=>a.local.distanceToSquared(mainCenter)-b.local.distanceToSquared(mainCenter))[0]:null;
 const low=component.map(i=>nodes[i]).sort((a,b)=>a.local.y-b.local.y)[0],high=destination||sorted[0];
 let route=low&&high?path(low.world,high.world):null;
 if(route?.length===1&&component.length>1){const far=component.map(i=>nodes[i]).sort((a,b)=>b.world.distanceToSquared(high.world)-a.world.distanceToSquared(high.world))[0];route=path(far.world,high.world);}
 report.routePoints=route?.length||0;report.routeHeightGain=low&&high?high.local.y-low.local.y:0;
 return{report,up,posts,route,face:new T.Vector3(0,0,1).transformDirection(castle.matrixWorld),
  contactName(world){return hitLocal(toLocal(world))?.object.name||null;},
  sample(world){const p=supportLocal(toLocal(world));return p?toWorld(p).addScaledVector(up,.05):null;},
  move(previous,proposed){const a=toLocal(previous),b=toLocal(proposed);if(a.distanceTo(b)>2||!segment(a,b)){report.blockedMoves++;return previous.clone();}return this.sample(proposed)||previous.clone();},
  nearest(world){const i=nearest(world);return i<0?null:nodes[i].world.clone().addScaledVector(up,.05);},path,
 };
}
