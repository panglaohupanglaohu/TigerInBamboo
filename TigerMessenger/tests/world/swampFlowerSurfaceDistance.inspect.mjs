import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const {installSwampHarborScene,overviewCamera,HARBOR_OVERVIEW}=await import('../../src/world/swampHarborScene.js');
const {pruneTaggedOfficialOceanOccludeds}=await import('../../src/core/officialOceanOcclusionPruning.js');
const {crystalV7SwampDir}=await import('../../src/world/crystalV7Layout.js');
const {createSwampLivingPathConstraints}=await import('../../src/world/swampGregLivingPaths.js');


const start=performance.now();
const swamp=createMoebiusSwampPlacement({seed:7711,scale:.5});
placeMoebiusSwampOnSphere(swamp,crystalV7SwampDir(),160,.5,0);
const inner=swamp.userData.inner,activity=inner.userData.flowerBoyActivities;
const h=installSwampHarborScene({swamp,departure:'original',workerScale:1});
const nav=activity.navigation,yard=inner.userData.shipyard;
assert.ok(!h.farBoat,'formal original departure, no far proxy');
const actors=[...inner.userData.whales.map((o,i)=>({key:'whale-'+i,o})),{key:'escort-whale',o:yard.escort},{key:'original-longship',o:yard.departure},{key:'original-dock-ship',o:yard.dock},{key:'repair-barge',o:yard.barge},{key:'feeding-child',o:activity.feeder}];
const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
const bounds=o=>{const result=[];o.traverse(m=>{if(!m.isMesh||m.userData.isOutline||!visible(m))return;if(m.material?.transparent&&m.material.opacity<.2)return;m.geometry.computeBoundingBox();const box=m.geometry.boundingBox.clone().applyMatrix4(inner.matrixWorld.clone().invert().multiply(m.matrixWorld));result.push({box,name:m.name||m.uuid,mesh:m});});return result;};
const sep=(a,b)=>Math.max(a.min.x-b.max.x,b.min.x-a.max.x,a.min.y-b.max.y,b.min.y-a.max.y,a.min.z-b.max.z,b.min.z-a.max.z);
const triangles=m=>{const matrix=inner.matrixWorld.clone().invert().multiply(m.matrixWorld),p=m.geometry.attributes.position,idx=m.geometry.index,out=[];
 for(let i=0;i<(idx?.count||p.count);i+=3){const vs=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+k):i+k).applyMatrix4(matrix));out.push({vs,box:new T.Box3().setFromPoints(vs)});}return out;};
const intersect=(a,b)=>{const ea=[a[1].clone().sub(a[0]),a[2].clone().sub(a[1]),a[0].clone().sub(a[2])],eb=[b[1].clone().sub(b[0]),b[2].clone().sub(b[1]),b[0].clone().sub(b[2])],na=ea[0].clone().cross(ea[1]),nb=eb[0].clone().cross(eb[1]),axes=[na,nb];
 for(const x of ea)for(const y of eb)axes.push(x.clone().cross(y));
 for(const x of [...ea,...eb])axes.push(na.clone().cross(x));
 for(const axis of axes){if(axis.lengthSq()<1e-15)continue;axis.normalize();const pa=a.map(v=>v.dot(axis)),pb=b.map(v=>v.dot(axis));if(Math.max(...pa)<Math.min(...pb)-1e-7||Math.max(...pb)<Math.min(...pa)-1e-7)return false;}return true;};
const fs=await import('node:fs');
const prior=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/greg-flower-dynamic-traffic-20261012/dynamic-traffic-cpu.json',import.meta.url)));
const selected=prior.pairs.filter(p=>p.overlapSamples>0||p.boat===0&&p.actor==='original-dock-ship').map(p=>({...p,times:p.overlapSamples?p.overlapTimes:Array.from({length:601},(_,i)=>i*.25),best:Infinity,triangleTests:0}));
if(process.argv.includes('--feeder-all')){selected.splice(0,selected.length,...Array.from({length:5},(_,boat)=>({boat,actor:'feeding-child',times:Array.from({length:601},(_,i)=>i*.25),best:Infinity,triangleTests:0})));}
if(process.argv.includes('--feeder-static')){const solids=new T.Group();solids.name='cpu-only-actual-shore-root-copy';inner.add(solids);inner.updateWorldMatrix(true,true);for(const m of nav.solids.meshes){const c=new T.Mesh(m.geometry,m.material);c.name=m.name;c.applyMatrix4(inner.matrixWorld.clone().invert().multiply(m.matrixWorld));solids.add(c);}actors.push({key:'actual-shore-root',o:solids});selected.splice(0,selected.length,{boat:-1,actor:'actual-shore-root',times:Array.from({length:601},(_,i)=>i*.25),best:Infinity,triangleTests:0});}
if(process.argv.includes('--long-feeder')){selected.splice(0,selected.length,...Array.from({length:5},(_,boat)=>({boat,actor:'feeding-child',times:Array.from({length:751},(_,i)=>150+i),best:Infinity,triangleTests:0})));}
const refine=process.argv.includes('--refine-feeder');if(refine){const r=selected.find(r=>r.boat===2&&r.actor==='feeding-child');r.times=process.argv.includes('--fine')?Array.from({length:51},(_,i)=>86.55+i*.001):Array.from({length:121},(_,i)=>85.9+i*.01);selected.splice(0,selected.length,r);}
const boxD2=(a,b)=>{let d=0;for(const k of['x','y','z']){const g=Math.max(0,a.min[k]-b.max[k],b.min[k]-a.max[k]);d+=g*g;}return d;};
const tree=items=>{const box=new T.Box3();for(const x of items)box.union(x.box);if(items.length<=6)return{box,items};const size=box.getSize(new T.Vector3()),axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z';items.sort((a,b)=>(a.box.min[axis]+a.box.max[axis])-(b.box.min[axis]+b.box.max[axis]));const mid=items.length>>1;return{box,children:[tree(items.slice(0,mid)),tree(items.slice(mid))]};};
const edgeD2=(a,b,c,d)=>{const u=b.clone().sub(a),v=d.clone().sub(c),w=a.clone().sub(c),A=u.dot(u),B=u.dot(v),C=v.dot(v),D=u.dot(w),E=v.dot(w),den=A*C-B*B;let s=den>1e-14?T.MathUtils.clamp((B*E-C*D)/den,0,1):0;let t=C>1e-14?(B*s+E)/C:0;
 if(t<0){t=0;s=A>1e-14?T.MathUtils.clamp(-D/A,0,1):0;}else if(t>1){t=1;s=A>1e-14?T.MathUtils.clamp((B-D)/A,0,1):0;}return a.clone().addScaledVector(u,s).distanceToSquared(c.clone().addScaledVector(v,t));};
const triangleD2=(a,b)=>{if(intersect(a,b))return 0;let best=Infinity;const ta=new T.Triangle(...a),tb=new T.Triangle(...b),p=new T.Vector3();for(const v of a)best=Math.min(best,v.distanceToSquared(tb.closestPointToPoint(v,p)));for(const v of b)best=Math.min(best,v.distanceToSquared(ta.closestPointToPoint(v,p)));for(let i=0;i<3;i++)for(let j=0;j<3;j++)best=Math.min(best,edgeD2(a[i],a[(i+1)%3],b[j],b[(j+1)%3]));return best;};
const V=(x,y,z)=>new T.Vector3(x,y,z);
assert.ok(Math.abs(triangleD2([V(0,0,0),V(1,0,0),V(0,1,0)],[V(0,0,2),V(1,0,2),V(0,1,2)])-4)<1e-10);
assert.equal(edgeD2(V(-1,0,0),V(1,0,0),V(0,-1,0),V(0,1,0)),0);
assert.equal(edgeD2(V(0,0,0),V(1,0,0),V(2,-1,0),V(2,1,0)),1);
assert.equal(triangleD2([V(0,0,0),V(1,0,0),V(0,1,0)],[V(.2,.2,-1),V(.2,.2,1),V(.4,.2,0)]),0);
const nearest=(a,b,result,context)=>{if(boxD2(a.box,b.box)>=result.best)return;if(a.items&&b.items){for(const x of a.items)for(const y of b.items){if(boxD2(x.box,y.box)>=result.best)continue;result.triangleTests++;const d=triangleD2(x.vs,y.vs);if(d<result.best){result.best=d;result.closest={...context,boatTriangle:x.vs.map(v=>v.toArray()),actorTriangle:y.vs.map(v=>v.toArray())};}}return;}
 const choices=a.children?a.children.map(x=>[x,b]):b.children.map(y=>[a,y]);choices.sort((x,y)=>boxD2(x[0].box,x[1].box)-boxD2(y[0].box,y[1].box));for(const[x,y]of choices)nearest(x,y,result,context);
};
const times=[...new Set(selected.flatMap(p=>p.times))].sort((a,b)=>a-b),started=performance.now();
for(const time of times){swamp.userData.update(.25,time,{});h.update(time);inner.updateWorldMatrix(true,true);const cached=new Map(),getTree=m=>{if(!cached.has(m.uuid))cached.set(m.uuid,tree(triangles(m)));return cached.get(m.uuid);};
 for(const result of selected){if(!result.times.includes(time))continue;const boat=result.boat===-1?activity.feeder:nav.records.find(r=>r.index===result.boat).boat,actor=actors.find(a=>a.key===result.actor).o;
  for(const a of bounds(boat))for(const b of bounds(actor)){if(boxD2(a.box,b.box)>=result.best)continue;nearest(getTree(a.mesh),getTree(b.mesh),result,{time,boatMesh:a.name,actorMesh:b.name});}
 }
}
console.log(JSON.stringify({seed:7711,departure:'original',sampleSpan:process.argv.includes('--long-feeder')?[150,900]:refine?(process.argv.includes('--fine')?[86.55,86.6]:[85.9,87.1]):[0,150],step:process.argv.includes('--long-feeder')?1:refine?(process.argv.includes('--fine')?.001:.01):.25,buildAndMeasureMs:performance.now()-started,worldScale:.5,method:'BVH triangle AABB squared-distance pruning; exact vertex-to-triangle, nine edge-to-edge distances and triangle SAT for intersections',pairs:selected.map(r=>({boat:r.boat,actor:r.actor,samples:r.times.length,minimumSurfaceDistanceInner:Math.sqrt(r.best),minimumSurfaceDistanceWorld:Math.sqrt(r.best)*.5,triangleTests:r.triangleTests,closest:r.closest})),containment:'not checked; positive surface distance does not exclude a closed mesh entirely contained inside another',continuous:'discrete samples only; no swept-time collision certification',GPU:'not checked; no production source modified'},null,2));
