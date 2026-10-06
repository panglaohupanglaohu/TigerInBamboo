import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createTargetOldCity} from '../../src/world/citadel/targetOldCity.js';
test('old city finite scale and deterministic authored layout',()=>{const a=createTargetOldCity(),b=createTargetOldCity();assert.deepEqual(a.report,b.report);assert.ok(a.report.bounds.size[0]<41);assert.ok(Math.abs(a.report.bounds.max[1]-33)<1e-5);assert.ok(a.report.houses.length>=14);a.group.traverse(o=>{if(o.isMesh)for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));});a.dispose();b.dispose();});
test('entry is a real open arch and central stairs ascend',()=>{const a=createTargetOldCity();a.group.traverse(o=>{if(o.isMesh)o.material.side=T.DoubleSide;});a.group.updateMatrixWorld(true);for(const x of[-1.7,0,1.7]){const ray=new T.Raycaster(new T.Vector3(x,2,18),new T.Vector3(0,0,-1),0,5);assert.equal(ray.intersectObject(a.group,true).length,0);}assert.ok(new T.Raycaster(new T.Vector3(3,2,18),new T.Vector3(0,0,-1),0,5).intersectObject(a.group,true).some(h=>h.object.name==='old-city-front-open-gate'));let last=0;for(let i=0;i<40;i++){const z=9.75-i*.5,hits=new T.Raycaster(new T.Vector3(0,12,z),new T.Vector3(0,-1,0),0,20).intersectObject(a.group,true);assert.ok(hits.length);assert.ok(hits[0].point.y>last);last=hits[0].point.y;}a.dispose();});
test('dispose releases owned resources once',()=>{const a=createTargetOldCity(),parent=new T.Group();parent.add(a.group);let g=0,m=0;const gs=new Set(),ms=new Set();a.group.traverse(o=>{if(o.isMesh){gs.add(o.geometry);ms.add(o.material);}});gs.forEach(x=>x.addEventListener('dispose',()=>g++));ms.forEach(x=>x.addEventListener('dispose',()=>m++));a.dispose();a.dispose();assert.equal(g,gs.size);assert.equal(m,ms.size);assert.equal(a.group.parent,null);});
test('second version keeps bell chamber and supporting arcade genuinely open',()=>{const a=createTargetOldCity();a.group.traverse(o=>{if(o.isMesh)o.material.side=T.DoubleSide;});a.group.updateMatrixWorld(true);const cast=(x,y,z,dir,far)=>new T.Raycaster(new T.Vector3(x,y,z),new T.Vector3(...dir),0,far).intersectObject(a.group,true);assert.equal(cast(11.55,28,-7,[0,0,-1],8).length,0);assert.ok(cast(12.75,28,-7,[0,0,-1],8).some(h=>h.object.name.startsWith('tower-bell')));const bay=17.3/3,x=11.15-17.3/2+bay*.5;assert.equal(cast(x,1,4,[0,0,-1],7).length,0);assert.ok(cast(x+2.5,1,4,[0,0,-1],7).some(h=>h.object.name.includes('arcade')));assert.deepEqual(a.report.exits.bridge,[19.8,.3,12.4]);a.dispose();});

test('v10 redistributes residential plots while retaining r30 public routes, palette and 33m tower',async()=>{
 const fs=await import('node:fs');const prior=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/citadel-four-hour-20261005/r30-sun-rock-target-front-plants-terrain.json',import.meta.url),'utf8')).cityDetail.oldCity.geometry;
 const a=createTargetOldCity({seed:prior.seed,palette:prior.palette});
 for(const key of['entry','exits','stairs','walkable','palette'])assert.deepEqual(a.report[key],prior[key],key);
 assert.ok(a.report.bounds.min[0]>=prior.bounds.min[0]-1e-5);assert.ok(a.report.bounds.max[0]<=prior.bounds.max[0]+1e-5);assert.ok(Math.abs(a.report.bounds.max[1]-33)<1e-5);
 for(const fp of a.report.footprints.filter(f=>!f.id.startsWith('house-')))assert.deepEqual(fp,prior.footprints.find(p=>p.id===fp.id));
 for(const h of a.report.houses){const old=prior.houses.find(p=>p.id===h.id);assert.ok(old);assert.equal(h.colour,old.colour);}
 assert.equal(a.report.layoutRedistribution.changes.length,15);assert.ok(a.report.performance.meshes<=280);assert.ok(a.report.performance.triangles<28000);assert.equal(a.report.houseGrouping.wfcIntegrated,false);a.dispose();
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

test('v9 twelve adjacent inset residential bodies have real connected through arcades and supported open front galleries',()=>{
 const a=createTargetOldCity();a.group.traverse(o=>{if(o.isMesh)o.material.side=T.DoubleSide;});a.group.updateMatrixWorld(true);assert.equal(a.report.residentialArcades.length,12);
 for(const arcade of a.report.residentialArcades){const h=a.report.houses.find(h=>h.id===arcade.houseId),root=a.group.getObjectByName(h.id),v=h.facadeVolumes[0],fp=a.report.footprints.find(f=>f.id===h.id);assert.equal(h.bodyVariant,'through-arcade-inset-storey');assert.equal(h.volumes[0].includesVoid,true);assert.ok(v.d<h.volumes[0].d&&v.w<h.volumes[0].w);assert.equal(arcade.publicNavigationInstalled,false);
  for(const opening of arcade.openings)for(const dy of[.55,1.2,1.8])for(const dx of[-.35,0,.35]){const ray=new T.Raycaster(new T.Vector3(opening.centerX+dx,opening.floorY+dy,opening.frontZ+.1),new T.Vector3(0,0,-1),0,4.9);assert.equal(ray.intersectObject(root,true).length,0,h.id+' blocked through arch');}
  const rayAcross=new T.Raycaster(new T.Vector3(h.position[0]-v.w/2+.2,h.position[1]+1.1,h.position[2]),new T.Vector3(1,0,0),0,v.w-.4);assert.equal(rayAcross.intersectObject(root,true).length,0,'arcades connect behind front piers');
  const rayDown=new T.Raycaster(new T.Vector3(h.position[0],arcade.gallery.topY+1.1,h.position[2]+1.75),new T.Vector3(0,-1,0),0,2),hits=rayDown.intersectObject(root,true);assert.ok(hits.length);assert.ok(Math.abs(hits[0].point.y-arcade.gallery.topY)<1e-5,'gallery has open sky and physical deck');
  const bounds=new T.Box3().setFromObject(root);for(const [axis,index]of[['x',0],['z',1]]){assert.ok(bounds.min[axis]>=Math.min(...fp.polygon.map(p=>p[index]))-1e-5);assert.ok(bounds.max[axis]<=Math.max(...fp.polygon.map(p=>p[index]))+1e-5);}
 }
 a.dispose();
});

test('v10 keeps sparse square windows, protected public geometry and authored roof roles',async()=>{
 const fs=await import('node:fs'),before=JSON.parse(fs.readFileSync(new URL('../../artifacts/pipeline/citadel-four-hour-20261005/r37-continuous-turf-target-front-plants-terrain.json',import.meta.url),'utf8')).cityDetail.oldCity.geometry,a=createTargetOldCity({seed:before.seed,palette:before.palette});
 for(const key of['walkable','entry','exits','stairs'])assert.deepEqual(a.report[key],before[key],key);
 assert.deepEqual(a.report.footprints.filter(f=>!f.id.startsWith('house-')),before.footprints.filter(f=>!f.id.startsWith('house-')));
 assert.equal(a.report.version,'target-old-city-11-three-street-clusters');assert.ok(a.report.facadeWindows.length<before.facadeWindows.length*.7);assert.ok(a.report.facadeWindows.every(w=>w.width===.68&&w.height<1));
 for(const h of a.report.houses){const old=before.houses.find(p=>p.id===h.id);for(const key of['colour','roofRole'])assert.deepEqual(h[key],old[key]);}
 assert.ok(a.report.performance.meshes<=280);assert.ok(a.report.performance.triangles<28000,'connected side openings remain inside the explicit 28k geometry budget');a.dispose();
});

test('v9 actual same-level neighbours share open side arches, continuous floors and solid supporting jambs',()=>{
 const a=createTargetOldCity();a.group.traverse(o=>{if(o.isMesh)o.material.side=T.DoubleSide;});a.group.updateMatrixWorld(true);
 const r=a.report.streetArcades;assert.equal(r.groups.length,4);assert.equal(r.links.length,8);assert.equal(r.publicNavigationInstalled,false);assert.equal(r.terrainChanged,false);
 const cast=(p,d,far)=>new T.Raycaster(new T.Vector3(...p),new T.Vector3(...d),0,far).intersectObject(a.group,true);
 for(const link of r.links){const hs=link.houses.map(id=>a.report.houses.find(h=>h.id===id));assert.equal(hs[0].position[1],hs[1].position[1]);assert.ok(hs[0].position[0]*hs[1].position[0]>0,'links must not bridge the public ascending street');assert.ok(link.sharedDepth>=3.69);assert.equal(link.source,'actual-same-level-body-adjacency');
  for(const dy of[.55,1.2,1.8])for(const dz of[-.4,0,.4])for(const direction of[-1,1])assert.equal(cast([link.edgeX-direction*.75,link.floorY+dy,link.centerZ+dz],[direction,0,0],1.5).length,0,link.id+' side opening blocked');
  assert.ok(cast([link.edgeX-.6,link.floorY+1,link.centerZ+1.12],[1,0,0],1.2).some(h=>h.object.userData.targetResidentialArcade),'a real stone jamb must remain beside the hole');
  assert.ok(cast([link.edgeX-.6,link.crownY+.08,link.centerZ],[1,0,0],1.2).some(h=>h.object.userData.targetResidentialArcade),'arch crown carries actual stone, not a painted recess');
 }
 for(const row of r.groups){const hs=row.houses.map(id=>a.report.houses.find(h=>h.id===id)),xs=hs.map(h=>h.position[0]),min=Math.min(...xs),max=Math.max(...xs),links=r.links.filter(l=>row.houses.includes(l.houses[0])&&row.houses.includes(l.houses[1])),z=links.reduce((sum,l)=>sum+l.centerZ,0)/links.length,y=hs[0].position[1]+.22;
  for(const dy of[.55,1.2,1.8])for(const dz of[-.4,0,.4])assert.equal(cast([min,y+dy,z+dz],[1,0,0],max-min).length,0,row.id+' three-house interior is discontinuous');
  for(let i=0;i<=24;i++)for(const dz of[-.4,0,.4]){const hit=cast([min+(max-min)*i/24,y+.1,z+dz],[0,-1,0],.2)[0];assert.ok(hit,'continuous shared plinth floor missing');assert.ok(Math.abs(hit.point.y-y)<1e-5,'floor step at shared edge');}
 }
 a.dispose();
});

test('v10 retains protected v8 public meshes and all 20 tower windows while residential plinths follow moved houses',async()=>{
 const fs=await import('node:fs/promises');let source=await fs.readFile(new URL('../../artifacts/pipeline/citadel-city-detail-20261006/source-before-old-city-v9/targetOldCity.js',import.meta.url),'utf8');source=source.replace("from 'three'",`from '${import.meta.resolve('three')}'`).replace("from './targetOldCityRoofWfc.js'",`from '${new URL('../../src/world/citadel/targetOldCityRoofWfc.js',import.meta.url).href}'`);
 const {createTargetOldCity:beforeFactory}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64')),a=createTargetOldCity(),before=beforeFactory({palette:a.report.palette});
 const publicMeshes=asset=>{const output=[];asset.group.traverse(o=>{if(!o.isMesh||o.userData.targetHouseSupportFor||o.userData.targetSharedResidentialFloor||o.userData.targetStreetInfill)return;let parent=o.parent;while(parent&&parent!==asset.group){if(parent.userData.targetEditableHouse)return;parent=parent.parent;}o.updateMatrix();output.push({name:o.name,position:[...o.geometry.attributes.position.array],normal:[...o.geometry.attributes.normal.array],index:o.geometry.index?[...o.geometry.index.array]:null,matrix:[...o.matrix.elements],colour:o.material.color.getHexString()});});return output;};
 assert.deepEqual(publicMeshes(a),publicMeshes(before),'public geometry must remain byte-equivalent');assert.equal(a.report.towerWindows.length,20);assert.deepEqual(a.report.towerWindows,before.report.towerWindows);
 for(const change of a.report.layoutRedistribution.changes){const old=before.report.houses.find(h=>h.id===change.id);assert.deepEqual(change.before.position,old.position);assert.equal(change.before.width,old.volumes[0].w);assert.equal(change.before.authoredHeight,old.authoredHeight);assert.ok(Math.abs(change.before.roofY-old.roofY)<1e-8);}
 for(const key of['stairs','entry','exits','walkable','palette'])assert.deepEqual(a.report[key],before.report[key],key);
 assert.deepEqual(a.report.footprints.filter(f=>!f.id.startsWith('house-')),before.report.footprints.filter(f=>!f.id.startsWith('house-')));
 const {createTargetCityEntityEditor}=await import('../../src/world/citadel/targetCityEntityEditor.js'),editor=createTargetCityEntityEditor({root:a.group,targetId:'arcades',terrainVersion:'r17',factoryVersion:a.report.version});
 for(const arcade of a.report.residentialArcades){const root=a.group.getObjectByName(arcade.houseId),stone=root.getObjectByName(arcade.houseId+'-stone-residential-arcade'),material=stone.material;assert.equal(stone.userData.targetWalkable,false);assert.equal(stone.userData.targetWall,undefined);assert.equal(editor.edit({id:arcade.houseId,wallColor:'#305080'}).ok,true);assert.equal(stone.material,material);assert.equal(editor.undo().ok,true);assert.equal(editor.edit({id:arcade.houseId,occupied:false}).ok,true);assert.equal(root.visible,false);assert.equal(a.group.getObjectByName(arcade.houseId+'-base').visible,true);assert.equal(editor.undo().ok,true);}
 editor.dispose();before.dispose();a.dispose();
});

test('v10 actual tower-flank redistribution stays supported on existing decks and preserves public front strips and upward sightlines',async()=>{
 const a=createTargetOldCity({seed:20261005});a.group.traverse(o=>{if(o.isMesh)o.material.side=T.DoubleSide;});a.group.updateMatrixWorld(true);
 const changes=a.report.layoutRedistribution.changes;assert.equal(changes.length,15);assert.ok(changes.every(c=>c.before.position.some((v,i)=>v!==c.after.position[i])));assert.equal(a.report.layoutRedistribution.towerMoved,false);
 const relocated=changes.find(c=>c.id==='house-2--1-1');assert.ok(relocated.before.position[0]<0&&relocated.after.position[0]>13.475);assert.equal(relocated.supportTerrace,'terrace-2-1');assert.ok(relocated.after.width<relocated.before.width);assert.ok(changes.find(c=>c.id==='house-2-1-0').after.position[0]<11.55);
 assert.equal(new Set(a.report.residentialArcades.map(r=>r.gallery.sideSetback.toFixed(2))).size,3);
 const cast=(p,d,far,objects)=>new T.Raycaster(new T.Vector3(...p),new T.Vector3(...d),0,far).intersectObjects(objects,true);
 for(const h of a.report.houses){const fp=a.report.footprints.find(f=>f.id===h.id),support=a.group.getObjectByName(h.id+'-base'),b=new T.Box3().setFromObject(support),terrace=a.group.children.filter(o=>o.name===fp.supportedBy||o.name===fp.supportedBy+'-deck');assert.equal(terrace.length,1);
  for(const tx of[0,.5,1])for(const tz of[0,.5,1]){const x=T.MathUtils.lerp(b.min.x,b.max.x,tx),z=T.MathUtils.lerp(b.min.z,b.max.z,tz),hit=cast([x,h.position[1]+.01,z],[0,-1,0],.04,terrace)[0];assert.ok(hit,h.id+' unsupported plinth corner');assert.ok(Math.abs(hit.point.y-h.position[1])<1e-5);}
  const change=changes.find(c=>c.id===h.id);assert.deepEqual(change.after.position,h.position);assert.equal(change.after.roofY,h.roofY);
 }
 for(const [z,y]of[[12.4,.3],[2.4,4.3],[-7.6,8.3]])for(const dz of[-.3,0,.3])for(const dy of[.55,1.2,1.8])assert.equal(cast([-19,y+dy,z+dz],[1,0,0],38,[a.group]).length,0,'front terrace public strip blocked');
 const houses=a.report.houses.map(h=>a.group.getObjectByName(h.id));
 for(const z of[9,4,0])for(const x of[-.8,0,.8]){const ground=.3+(10-z)*.4,eye=new T.Vector3(x,ground+1.6,z),target=new T.Vector3(11.55,28.4,-11.15),dir=target.clone().sub(eye),length=dir.length();assert.equal(new T.Raycaster(eye,dir.normalize(),0,length).intersectObjects(houses,true).length,0,'houses interrupt the stair-to-tower upward view');}
 const {createWarshipClearance}=await import('../../src/world/warshipClearance.js');
 const obstacles=houses.map(root=>{const meshes=[];root.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.computeBoundingBox();meshes.push({mesh,box:new T.Box3().setFromObject(mesh)});});return{root,meshes,box:new T.Box3().setFromObject(root)};});
 for(let i=0;i<houses.length;i++){const relevant=obstacles.slice(i+1).filter(o=>obstacles[i].box.intersectsBox(o.box));if(!relevant.length)continue;const sweep=createWarshipClearance(houses[i],relevant),result=sweep.clear(houses[i].position,houses[i].quaternion,houses[i].scale);assert.equal(result.clear,true,JSON.stringify({house:houses[i].name,result}));}
 a.dispose();
});

test('v11 six infill modules have actual slab support in three clusters without expanding city or public geometry',()=>{
 const a=createTargetOldCity(),before=createTargetOldCity({streetInfill:false});
 assert.equal(a.report.streetInfill.modules.length,6);assert.equal(new Set(a.report.streetInfill.modules.map(m=>m.cluster)).size,3);
 assert.deepEqual(a.report.footprints,before.report.footprints);assert.deepEqual(a.report.bounds,before.report.bounds);
 assert.equal(a.report.houses.length,15);assert.equal(a.report.performance.materials,before.report.performance.materials);assert.equal(a.report.performance.meshes-before.report.performance.meshes,6);assert.ok(a.report.performance.triangles-before.report.performance.triangles<1500);
 a.group.updateMatrixWorld(true);let supportSamples=0;
 for(const m of a.report.streetInfill.modules){
  const support=a.group.getObjectByName(m.support.mesh);assert.ok(support);assert.ok(m.roofY<17);
  for(const u of[-.5,0,.5])for(const v of[-.5,0,.5]){const x=m.position[0]+u*m.width,z=m.position[2]+v*m.depth;
   const hit=new T.Raycaster(new T.Vector3(x,m.support.top+.02,z),new T.Vector3(0,-1,0),0,.04).intersectObject(support,true)[0];assert.ok(hit,m.id+' unsupported base');assert.ok(Math.abs(hit.point.y-m.position[1])<1e-5);supportSamples++;
  }
  if(m.attachedTo){const fp=a.report.footprints.find(p=>p.id===m.attachedTo);for(const [x,z]of m.polygon){assert.ok(x>=Math.min(...fp.polygon.map(p=>p[0]))&&x<=Math.max(...fp.polygon.map(p=>p[0])));assert.ok(z>=Math.min(...fp.polygon.map(p=>p[1]))&&z<=Math.max(...fp.polygon.map(p=>p[1])));}}
 }
 assert.equal(supportSamples,54);
 // Every original public step, gate, landing, terrace and landmark retains its
 // exact buffer and transform; additive infill cannot replace protected pieces.
 const protectedMeshes=asset=>{const result=[];asset.group.traverse(o=>{if(!o.isMesh||o.userData.targetStreetInfill)return;for(let p=o.parent;p&&p!==asset.group;p=p.parent)if(p.userData.targetEditableHouse)return;o.updateMatrix();result.push([o.name,[...o.geometry.attributes.position.array],[...o.matrix.elements]]);});return result;};
 assert.deepEqual(protectedMeshes(a),protectedMeshes(before));
 const upper=a.group.getObjectByName('old-city-upper-left-street-infill');
 for(const w of a.report.streetInfill.windows){const hit=new T.Raycaster(new T.Vector3(w.position[0],w.position[1],w.position[2]+.3),new T.Vector3(0,0,-1),0,.5).intersectObject(a.group,true)[0];assert.ok(hit,w.moduleId+' floating window');}
 assert.ok(upper);a.dispose();before.dispose();
});

test('v11 rollback exactly reproduces pre-infill geometry and attached rooms survive every legal roof role/editor transaction',async()=>{
 const fs=await import('node:fs/promises');let source=await fs.readFile(new URL('../../artifacts/pipeline/citadel-old-street-infill-20261006/targetOldCity.before.js',import.meta.url),'utf8');
 source=source.replace("from 'three'",`from '${import.meta.resolve('three')}'`).replace("from './targetOldCityRoofWfc.js'",`from '${new URL('../../src/world/citadel/targetOldCityRoofWfc.js',import.meta.url).href}'`).replace("from './targetArchitecturePalette.js'",`from '${new URL('../../src/world/citadel/targetArchitecturePalette.js',import.meta.url).href}'`);
 const factory=(await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'))).createTargetOldCity,prior=factory(),rollback=createTargetOldCity({streetInfill:false});
 const geometry=a=>{const out=[];a.group.traverse(o=>{if(o.isMesh){o.updateMatrix();out.push([o.name,[...o.geometry.attributes.position.array],[...o.matrix.elements],o.material.color.getHexString()]);}});return out;};assert.deepEqual(geometry(rollback),geometry(prior));prior.dispose();rollback.dispose();
 const {createTargetCityEntityEditor}=await import('../../src/world/citadel/targetCityEntityEditor.js');
 for(const role of['hip-roof','open-terrace-pavilion','setback-upper-room','outer-edge-short-tower','upper-street-cupola']){
  const id='house-1--1-1',a=createTargetOldCity({roofRoles:{[id]:role}}),root=a.group.getObjectByName(id),editor=createTargetCityEntityEditor({root:a.group,targetId:'infill',terrainVersion:'r17',factoryVersion:a.report.version}),wall=root.getObjectByName(id+'-walls'),original=wall.material;
  assert.equal(a.report.houses.find(h=>h.id===id).roofRole,role);assert.equal(editor.list().length,15);assert.equal(editor.edit({id,wallColor:'#ee9988'}).ok,true);assert.equal(wall.material.color.getHexString(),'ee9988');assert.equal(editor.undo().ok,true);assert.equal(wall.material,original);assert.equal(editor.edit({id,occupied:false}).ok,true);assert.equal(root.visible,false);assert.equal(a.group.getObjectByName(id+'-base').visible,true);assert.equal(editor.undo().ok,true);
  assert.ok(new T.Box3().setFromObject(root).max.y<=a.report.footprints.find(f=>f.id===id).roofY+1e-5);editor.dispose();a.dispose();
 }
 assert.throws(()=>createTargetOldCity({streetInfill:'yes'}),/streetInfill/);
});
