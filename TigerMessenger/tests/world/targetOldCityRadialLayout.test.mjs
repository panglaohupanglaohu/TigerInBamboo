import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {createTargetOldCity} from '../../src/world/citadel/targetOldCity.js';

export function auditRadialStreets(asset){
 asset.group.updateMatrixWorld(true);const floors=[],solid=[];asset.group.traverse(m=>{if(m.isMesh){if(m.userData.targetWalkable||asset.report.footprints.some(f=>f.walkable&&f.id===m.name))floors.push(m);solid.push(m);}});
 const ray=new T.Raycaster(),misses=[],blocked=[];let samples=0;
 for(const route of asset.report.radialLayout.routes){for(let j=1;j<route.points.length;j++){
  const a=new T.Vector3(...route.points[j-1]),b=new T.Vector3(...route.points[j]),length=a.distanceTo(b),n=Math.ceil(length/.25),direction=b.clone().sub(a);direction.y=0;direction.normalize();const side=new T.Vector3(-direction.z,0,direction.x);
  for(let i=0;i<n;i++)for(const lateral of[-.35,0,.35]){const p=a.clone().lerp(b,(i+.5)/n).addScaledVector(side,lateral);samples++;
   ray.set(p.clone().add(new T.Vector3(0,.25,0)),new T.Vector3(0,-1,0));ray.far=.6;const floor=ray.intersectObjects(floors)[0];
   if(!floor){misses.push({route:route.id,point:p.toArray()});continue;}
   for(const h of[.55,1.2,1.8]){const from=p.clone();from.y=floor.point.y+h;ray.set(from,direction);ray.far=.28;const hit=ray.intersectObjects(solid)[0];if(hit)blocked.push({route:route.id,mesh:hit.object.name,point:from.toArray()});}
  }
 }}
 return{samples,misses,blocked,scope:'local finite public route floor rays and 9 standing-body probes, not continuous navigation proof'};
}

test('radial default actually moves all fifteen editable houses around the preserved tower and external anchors',()=>{
 const a=createTargetOldCity(),old=createTargetOldCity({layout:'axial'});
 assert.equal(a.report.version,'target-old-city-14-radial-streets');
 assert.equal(a.report.houses.length,15);assert.deepEqual(a.report.entry,old.report.entry);assert.deepEqual(a.report.exits,old.report.exits);assert.deepEqual(a.report.palette,old.report.palette);
 assert.ok(a.report.houses.every(h=>h.position.some((v,i)=>Math.abs(v-old.report.houses.find(o=>o.id===h.id).position[i])>1)));
 assert.ok(new Set(a.report.houses.map(h=>h.yaw.toFixed(2))).size>10);
 const towerParts=g=>g.children.filter(m=>m.isMesh&&m.name.startsWith('tower-')&&m.name!=='tower-axial-court-foundation');
 for(const [i,m]of towerParts(old.group).entries()){const next=towerParts(a.group)[i];assert.ok(next);assert.equal(next.name,m.name);assert.deepEqual(next.geometry.attributes.position.array,m.geometry.attributes.position.array);assert.equal(next.material.color.getHex(),m.material.color.getHex());assert.equal(next.position.y,m.position.y-4);}
 assert.ok(Math.abs(a.report.bounds.max[1]-29)<1e-5);assert.equal(a.report.radialLayout.routes.filter(p=>p.closed).length,2);
 assert.equal(a.group.getObjectByName('central-step-0'),undefined);assert.equal(a.group.getObjectByName('terrace-1--1-deck'),undefined);
 for(const h of a.report.houses){const root=a.group.getObjectByName(h.id);assert.equal(root.userData.candidateEntityId,`old-city:${h.id}`);assert.equal(root.userData.targetEditableHouse.id,h.id);}
 a.dispose();old.dispose();
});

test('ring streets, three radial stair alleys and stable waterfront anchors have actual supported and clear body samples',()=>{
 const a=createTargetOldCity(),audit=auditRadialStreets(a);assert.equal(audit.misses.length,0,JSON.stringify(audit.misses.slice(0,10)));
 const counts={};for(const b of audit.blocked)counts[b.route+' / '+b.mesh]=(counts[b.route+' / '+b.mesh]||0)+1;
 assert.equal(audit.blocked.length,0,JSON.stringify(counts));assert.ok(audit.samples>1000);a.dispose();
});

test('actual radial and upper-anchor stair treads are at least 28cm with no riser over 20cm',()=>{
 const a=createTargetOldCity();for(const r of a.report.radialLayout.routes.filter(r=>r.id.startsWith('old-radial-alley')||r.id==='old-upper-anchor-link')){assert.ok(r.maxRise<=.2+1e-9);assert.ok(r.minimumTread>=.28,r.id+': '+r.minimumTread);for(const step of r.surfaces){const mesh=a.group.getObjectByName(step.id);assert.ok(mesh.geometry.parameters.depth>=.28);}}
 assert.ok(a.report.stairs.tread>=.28);a.dispose();
});

test('oriented houses have real podium support and all legal authored geometry remains finite',()=>{
 const a=createTargetOldCity();a.group.updateMatrixWorld(true);
 for(const h of a.report.houses){const support=a.group.getObjectByName(h.id+'-radial-podium'),base=a.group.getObjectByName(h.id+'-base'),p=base.geometry.attributes.position;
  for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(base.matrixWorld);v.y=h.position[1]+.02;const hit=new T.Raycaster(v,new T.Vector3(0,-1,0),0,.04).intersectObject(support)[0];assert.ok(hit,h.id+' unsupported bottom corner');assert.ok(Math.abs(hit.point.y-h.position[1])<1e-5);}
 }
 a.group.traverse(o=>{if(o.isMesh)for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));});a.dispose();
});

test('radial factory disposal releases exactly its retained owned resources',()=>{
 const a=createTargetOldCity(),gs=new Set(),ms=new Set();a.group.traverse(m=>{if(m.isMesh){gs.add(m.geometry);ms.add(m.material);}});let g=0,m=0;for(const x of gs)x.addEventListener('dispose',()=>g++);for(const x of ms)x.addEventListener('dispose',()=>m++);a.dispose();a.dispose();assert.equal(g,gs.size);assert.equal(m,ms.size);
});

test('post-placement radial wings use sampled support, reject actual overlap, connect doors and roll back resources',()=>{
 const a=createTargetOldCity({wingStreets:true}),before=structuredClone({routes:a.report.radialLayout.routes,walkable:a.report.walkable,bounds:a.report.bounds});
 const wings=a.completeWingStreets({enabled:true,sampleSurface:()=>.3,protectedFootprints:[],collisionGroups:[]});
 assert.equal(wings.report.modules.length,6);assert.ok(wings.report.rejected.some(r=>r.reason.kind==='actual-obstacle-triangle'));assert.ok(wings.report.triangleTests>0);
 const audit=auditRadialStreets(a);assert.equal(audit.misses.length,0,JSON.stringify(audit.misses.slice(0,6)));assert.equal(audit.blocked.length,0,JSON.stringify(audit.blocked.slice(0,6)));
 for(const r of a.report.radialLayout.routes.filter(r=>r.id.startsWith('old-radial-wing-gap'))){assert.ok(r.minimumTread>=.28);assert.ok(r.maxRise<=.2+1e-9);}
 const gs=new Set();wings.group.traverse(m=>{if(m.isMesh)gs.add(m.geometry);});let disposed=0;for(const g of gs)g.addEventListener('dispose',()=>disposed++);wings.dispose();wings.dispose();assert.equal(disposed,gs.size);assert.deepEqual(a.report.radialLayout.routes,before.routes);assert.deepEqual(a.report.walkable,before.walkable);assert.deepEqual(a.report.bounds,before.bounds);a.dispose();assert.equal(disposed,gs.size);
});

test('all fifteen conservative oriented building envelopes are disjoint',()=>{
 const a=createTargetOldCity(),plots=a.report.footprints.filter(p=>p.orientedPolygon);
 const overlap=(a,b)=>{for(const polygon of[a,b])for(let i=0;i<4;i++){const p=polygon[i],q=polygon[(i+1)%4],n=[q[1]-p[1],p[0]-q[0]],aa=a.map(p=>p[0]*n[0]+p[1]*n[1]),bb=b.map(p=>p[0]*n[0]+p[1]*n[1]);if(Math.max(...aa)<=Math.min(...bb)||Math.max(...bb)<=Math.min(...aa))return false;}return true;};
 for(let i=0;i<plots.length;i++)for(let j=i+1;j<plots.length;j++)assert.equal(overlap(plots[i].orientedPolygon,plots[j].orientedPolygon),false,plots[i].id+' intersects '+plots[j].id);
 a.dispose();
});
