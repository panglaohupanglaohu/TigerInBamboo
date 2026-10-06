import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createTargetOldCity} from '../../src/world/citadel/targetOldCity.js';
test('old city finite scale and deterministic authored layout',()=>{const a=createTargetOldCity(),b=createTargetOldCity();assert.deepEqual(a.report,b.report);assert.ok(a.report.bounds.size[0]<41);assert.ok(Math.abs(a.report.bounds.max[1]-33)<1e-5);assert.ok(a.report.houses.length>=14);a.group.traverse(o=>{if(o.isMesh)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});a.dispose();b.dispose();});
test('entry is a real open arch and central stairs ascend',()=>{const a=createTargetOldCity();a.group.traverse(o=>{if(o.isMesh)o.material.side=T.DoubleSide;});a.group.updateMatrixWorld(true);for(const x of[-1.7,0,1.7]){const ray=new T.Raycaster(new T.Vector3(x,2,18),new T.Vector3(0,0,-1),0,5);assert.equal(ray.intersectObject(a.group,true).length,0);}assert.ok(new T.Raycaster(new T.Vector3(3,2,18),new T.Vector3(0,0,-1),0,5).intersectObject(a.group,true).some(h=>h.object.name==='old-city-front-open-gate'));let last=0;for(let i=0;i<40;i++){const z=9.75-i*.5,hits=new T.Raycaster(new T.Vector3(0,12,z),new T.Vector3(0,-1,0),0,20).intersectObject(a.group,true);assert.ok(hits.length);assert.ok(hits[0].point.y>last);last=hits[0].point.y;}a.dispose();});
test('dispose releases owned resources once',()=>{const a=createTargetOldCity(),parent=new T.Group();parent.add(a.group);let g=0,m=0;const gs=new Set(),ms=new Set();a.group.traverse(o=>{if(o.isMesh){gs.add(o.geometry);ms.add(o.material);}});gs.forEach(x=>x.addEventListener('dispose',()=>g++));ms.forEach(x=>x.addEventListener('dispose',()=>m++));a.dispose();a.dispose();assert.equal(g,gs.size);assert.equal(m,ms.size);assert.equal(a.group.parent,null);});
test('second version keeps bell chamber and supporting arcade genuinely open',()=>{const a=createTargetOldCity();a.group.traverse(o=>{if(o.isMesh)o.material.side=T.DoubleSide;});a.group.updateMatrixWorld(true);const cast=(x,y,z,dir,far)=>new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(...dir),0,far).intersectObject(a.group,true);assert.equal(cast(11.55,28,-7,[0,0,-1],8).length,0);assert.ok(cast(12.75,28,-7,[0,0,-1],8).some(h=>h.object.name.startsWith('tower-bell')));const bay=17.3/3,x=11.15-17.3/2+bay*.5;assert.equal(cast(x,1,4,[0,0,-1],7).length,0);assert.ok(cast(x+2.5,1,4,[0,0,-1],7).some(h=>h.object.name.includes('arcade')));assert.deepEqual(a.report.exits.bridge,[19.8,.3,12.4]);a.dispose();});

test('r30 plot boundaries, palette, public structures and main tower remain unchanged while four roof heights vary',async()=>{
 const fs=await import('node:fs');const prior=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/citadel-four-hour-20261005/r30-sun-rock-target-front-plants-terrain.json',import.meta.url),'utf8')).cityDetail.oldCity.geometry;
 const a=createTargetOldCity({seed:prior.seed,palette:prior.palette});
 for(const key of['entry','exits','stairs','walkable','palette'])assert.deepEqual(a.report[key],prior[key],key);
 assert.ok(a.report.bounds.min[0]>=prior.bounds.min[0]-1e-5);assert.ok(a.report.bounds.max[0]<=prior.bounds.max[0]+1e-5);assert.equal(a.report.bounds.max[1],prior.bounds.max[1]);
 const changed=a.report.houses.filter(h=>h.roofRole!=='hip-roof').map(h=>h.id);assert.equal(changed.length,4);
 for(const fp of a.report.footprints){const old=prior.footprints.find(p=>p.id===fp.id);if(changed.includes(fp.id)){assert.deepEqual({...fp,roofY:old.roofY},old);assert.notEqual(fp.roofY,old.roofY);}else assert.deepEqual(fp,old);}
 for(const h of a.report.houses){const old=prior.houses.find(p=>p.id===h.id);assert.deepEqual(h.position,old.position);assert.equal(h.colour,old.colour);if(!changed.includes(h.id))assert.equal(h.height,old.height);}
 assert.ok(a.report.performance.meshes<=270);assert.ok(a.report.performance.triangles<28000);assert.equal(a.report.houseGrouping.wfcIntegrated,false);a.dispose();
});

test('each house owns bevel walls, roof and two batched window materials under a stable ID',()=>{
 const a=createTargetOldCity();assert.equal(a.report.houses.length,15);
 for(const h of a.report.houses){const root=a.group.getObjectByName(h.id);assert.ok(root.isGroup);assert.equal(root.userData.candidateEntityId,`old-city:${h.id}`);assert.deepEqual(root.userData.targetEditableHouse,{id:h.id,city:'old',colour:h.colour});assert.equal(a.group.getObjectByName(h.id+'-base').parent,a.group,'public support stays outside editable house');assert.deepEqual(root.position.toArray(),h.position);const wall=root.getObjectByName(h.id+'-walls');assert.ok(wall);assert.equal(wall.userData.targetWall,true);const normals=wall.geometry.attributes.normal.array;let diagonal=false;for(let i=0;i<normals.length;i+=3){const comps=[normals[i],normals[i+1],normals[i+2]].filter(v=>Math.abs(v)>.05&&Math.abs(v)<.95);if(comps.length>=2)diagonal=true;}assert.ok(diagonal,'bevel must have actual non-axis faces');assert.ok(root.getObjectByName(h.id+(h.roofRole==='upper-street-cupola'?'-cupola-finial':'-ridge')));assert.ok(root.getObjectByName(h.id+'-drip-edge'));assert.equal(root.children.filter(c=>c.name.startsWith(h.id+'-windows-')).length,2);}
 a.dispose();
});

test('side and rear windows are mounted on their owner and absent within adjacent house envelopes',()=>{
 const a=createTargetOldCity();const sides=new Set(a.report.facadeWindows.map(w=>w.side));assert.deepEqual([...sides].sort(),['back','front','left','right']);assert.ok(a.report.rejectedWindows.length>0);
 for(const w of a.report.facadeWindows){const h=a.report.houses.find(h=>h.id===w.houseId),fp=a.report.footprints.find(f=>f.id===w.houseId),[x,y,z]=w.position,n=w.normal;const width=(Math.max(...fp.polygon.map(p=>p[0]))-Math.min(...fp.polygon.map(p=>p[0])))-.4;
  const v=w.wallVolume;assert.ok(h.volumes.some(p=>p.id===v.id));if(n[0])assert.ok(Math.abs(Math.abs(x-h.position[0]-v.x)-v.w/2)<1e-8);else assert.ok(Math.abs(Math.abs(z-h.position[2]-v.z)-v.d/2)<1e-8);
  const ex=n[0]?.15:.49,ez=n[2]?.15:.49;
  for(const other of a.report.footprints.filter(f=>f.id!==h.id&&f.id.startsWith('house-'))){const minX=Math.min(...other.polygon.map(p=>p[0])),maxX=Math.max(...other.polygon.map(p=>p[0])),minZ=Math.min(...other.polygon.map(p=>p[1])),maxZ=Math.max(...other.polygon.map(p=>p[1]));const intersect=x+ex>minX&&x-ex<maxX&&z+ez>minZ&&z-ez<maxZ&&y+.64>other.floorY&&y-.64<other.roofY;assert.equal(intersect,false,`${w.id} window buried in ${other.id}`);}
 }
 a.dispose();
});

test('four real stepped roof roles stay inside their original plots and expose open deck beside smaller upper volumes',()=>{
 const a=createTargetOldCity();a.group.updateMatrixWorld(true);const chosen=a.report.houses.filter(h=>h.roofRole!=='hip-roof');assert.equal(chosen.length,4);assert.equal(new Set(chosen.map(h=>h.roofRole)).size,4);assert.equal(a.report.roofRoleSelection.wfc,false);
 for(const h of a.report.houses){const root=a.group.getObjectByName(h.id),fp=a.report.footprints.find(p=>p.id===h.id),bounds=new T.Box3().setFromObject(root);assert.ok(bounds.min.x>=Math.min(...fp.polygon.map(p=>p[0]))-1e-5&&bounds.max.x<=Math.max(...fp.polygon.map(p=>p[0]))+1e-5);assert.ok(bounds.min.z>=Math.min(...fp.polygon.map(p=>p[1]))-1e-5&&bounds.max.z<=Math.max(...fp.polygon.map(p=>p[1]))+1e-5);assert.ok(Math.abs(bounds.max.y-fp.roofY)<1e-5,`${h.id} actual roof does not match report`);assert.equal(h.roofY,fp.roofY);assert.ok(fp.roofY<33);}
 for(const h of chosen){const root=a.group.getObjectByName(h.id),v=h.volumes[1];assert.equal(h.terrace.publicAccess,false);assert.ok(v.w<h.volumes[0].w&&v.d<h.volumes[0].d);const ray=new T.Raycaster(new T.Vector3(h.position[0],h.terrace.topY+2,h.position[2]+1.75),new T.Vector3(0,-1,0),0,3),hits=ray.intersectObject(root,true);assert.ok(hits.length);assert.equal(hits[0].object.name,h.id+'-terrace-deck','terrace must have actual open sky and a floor outside the upper room');assert.ok(Math.abs(hits[0].point.y-h.terrace.topY)<1e-5);assert.ok(root.getObjectByName(h.id+'-terrace-balusters').isInstancedMesh);assert.ok(a.report.facadeWindows.some(w=>w.houseId===h.id&&w.volumeId===v.id),'upper room must own mounted visible windows');}
 a.dispose();
});

test('all additional upper walls recolour and undo with their residential entity while deck and support stay original',async()=>{
 const {createTargetCityEntityEditor}=await import('../../src/world/citadel/targetCityEntityEditor.js');const a=createTargetOldCity(),editor=createTargetCityEntityEditor({root:a.group,targetId:'test-roofs',terrainVersion:'frozen-r17',factoryVersion:a.report.version});
 for(const h of a.report.houses.filter(h=>h.roofRole!=='hip-roof')){const root=a.group.getObjectByName(h.id),walls=[];root.traverse(m=>{if(m.userData.targetWall)walls.push(m);});assert.equal(walls.length,2);const originals=walls.map(m=>m.material),deck=root.getObjectByName(h.id+'-terrace-deck'),deckMaterial=deck.material;assert.equal(editor.edit({id:h.id,wallColor:'#226688'}).ok,true);for(const wall of walls)assert.equal(wall.material.color.getHexString(),'226688');assert.equal(deck.material,deckMaterial);assert.equal(editor.undo().ok,true);walls.forEach((m,i)=>assert.equal(m.material,originals[i]));assert.equal(editor.edit({id:h.id,occupied:false}).ok,true);assert.equal(root.visible,false);assert.equal(a.group.getObjectByName(h.id+'-base').visible,true);assert.equal(editor.undo().ok,true);assert.equal(root.visible,true);}
 editor.dispose();a.dispose();
});

test('v7 five inset residential bodies have real connected through arcades and supported open front galleries',()=>{
 const a=createTargetOldCity();a.group.traverse(o=>{if(o.isMesh)o.material.side=T.DoubleSide;});a.group.updateMatrixWorld(true);assert.equal(a.report.residentialArcades.length,5);
 for(const arcade of a.report.residentialArcades){const h=a.report.houses.find(h=>h.id===arcade.houseId),root=a.group.getObjectByName(h.id),v=h.facadeVolumes[0],fp=a.report.footprints.find(f=>f.id===h.id);assert.equal(h.bodyVariant,'through-arcade-inset-storey');assert.equal(h.volumes[0].includesVoid,true);assert.ok(v.d<h.volumes[0].d&&v.w<h.volumes[0].w);assert.equal(arcade.publicNavigationInstalled,false);
  for(const opening of arcade.openings)for(const dy of[.55,1.2,1.8])for(const dx of[-.35,0,.35]){const ray=new T.Raycaster(new T.Vector3(opening.centerX+dx,opening.floorY+dy,opening.frontZ+.1),new T.Vector3(0,0,-1),0,4.9);assert.equal(ray.intersectObject(root,true).length,0,h.id+' blocked through arch');}
  const rayAcross=new T.Raycaster(new T.Vector3(h.position[0]-v.w/2+.2,h.position[1]+1.1,h.position[2]),new T.Vector3(1,0,0),0,v.w-.4);assert.equal(rayAcross.intersectObject(root,true).length,0,'arcades connect behind front piers');
  const rayDown=new T.Raycaster(new T.Vector3(h.position[0],arcade.gallery.topY+1.1,h.position[2]+1.75),new T.Vector3(0,-1,0),0,2),hits=rayDown.intersectObject(root,true);assert.ok(hits.length);assert.ok(Math.abs(hits[0].point.y-arcade.gallery.topY)<1e-5,'gallery has open sky and physical deck');
  const bounds=new T.Box3().setFromObject(root);for(const [axis,index]of[['x',0],['z',1]]){assert.ok(bounds.min[axis]>=Math.min(...fp.polygon.map(p=>p[index]))-1e-5);assert.ok(bounds.max[axis]<=Math.max(...fp.polygon.map(p=>p[index]))+1e-5);}
 }
 a.dispose();
});

test('v7 windows become sparse square details while unchanged public geometry and roles stay within r37 bounds',async()=>{
 const fs=await import('node:fs'),before=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/citadel-four-hour-20261005/r37-continuous-turf-target-front-plants-terrain.json',import.meta.url),'utf8')).cityDetail.oldCity.geometry,a=createTargetOldCity({seed:before.seed,palette:before.palette});
 for(const key of['footprints','walkable','entry','exits','stairs'])assert.deepEqual(a.report[key],before[key],key);
 assert.equal(a.report.version,'target-old-city-8-tower-four-facades');assert.ok(a.report.facadeWindows.length<before.facadeWindows.length*.7);assert.ok(a.report.facadeWindows.every(w=>w.width===.68&&w.height<1));
 for(const h of a.report.houses){const old=before.houses.find(p=>p.id===h.id);for(const key of['position','colour','height','roofRole','roofY'])assert.deepEqual(h[key],old[key]);}
 assert.ok(a.report.performance.meshes<=before.performance.meshes+5);assert.ok(a.report.performance.triangles<=before.performance.triangles);a.dispose();
});
