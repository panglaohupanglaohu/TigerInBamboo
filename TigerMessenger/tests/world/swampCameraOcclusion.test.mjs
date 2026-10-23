import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const context=new Proxy({createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
const element=()=>({style:{},addEventListener(){},removeEventListener(){},getContext:()=>context});
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element};
globalThis.location={search:''};globalThis.localStorage={getItem:()=>null};globalThis.window={addEventListener(){},localStorage,location};
const {createMoebiusSwampPlacement,placeMoebiusSwampOnSphere}=await import('../../src/world/moebiusSwamp.js');
const {createSwampCameraOccluders}=await import('../../src/world/swampCameraOcclusion.js');
const {createCameraRig}=await import('../../src/core/camera.js');
const {CAMERA_LOOK_Y,CAMERA_HEIGHT,PLAYER_HEIGHT}=await import('../../src/core/constants.js');
const placement=createMoebiusSwampPlacement({seed:7711,scale:.5}),inner=placement.userData.inner;
placeMoebiusSwampOnSphere(placement,new T.Vector3(.4,.8,.3).normalize(),160,.5,-15.8);placement.updateMatrixWorld(true);
const provider=createSwampCameraOccluders(placement),wall=inner.getObjectByName('swamp-sinkhole-wall');
const snapshots=[];inner.traverse(o=>snapshots.push({o,visible:o.visible,position:o.position.toArray(),scale:o.scale.toArray(),material:o.material}));

test('provider supplies authored solid meshes, excludes vegetation and story objects, and returns empty far away',()=>{
 const meshes=provider.getMeshes();assert.ok(meshes.includes(wall));// 2026-10-10: trunks make way (swampOcclusionFade) instead of pulling the camera in.
  assert.ok(!meshes.includes(inner.getObjectByName('world-tree-trunk')));
 assert.ok(meshes.includes(inner.getObjectByName('greg-natural-cliff-rock')));assert.ok(meshes.includes(inner.userData.gregCoralRim.walkMeshes[0]));
 for(const mesh of meshes){assert.ok(mesh.isMesh);assert.ok(!/leaf|flower|monkey|whale|bird|fern|growth|ink/.test(mesh.name.replace('swamp-sinkhole-wall','wall')));}
 assert.ok(meshes.length<80,`solid cache ${meshes.length}; rim trees have several authored trunk sections`);
 assert.deepEqual(provider(new T.Vector3(-400,200,500),12),[]);assert.deepEqual(provider(new T.Vector3(NaN,0,0),12),[]);
});

for(const level of inner.userData.gregSpatialPlan.levels)test(`real camera pulls in before the lake wall on bank ${level.id}, spherical scale .5`,()=>{
 const angle=level.id===1?level.angleEnd+.03:(level.angleStart+level.angleEnd)/2,r=level.radius/.5,local=new T.Vector3(Math.cos(angle)*r,level.innerY,Math.sin(angle)*r);
 // Player.position is the feet, not the head: the rendered courier is 1.66 m
 // tall and camera.js adds its own CAMERA_LOOK_Y exactly once.
 assert.equal(PLAYER_HEIGHT,1.66);
 const position=inner.localToWorld(local),up=position.clone().normalize();position.addScaledVector(up,.025);
 const forward=inner.localToWorld(new T.Vector3(-8,level.innerY,-7)).sub(position);forward.addScaledVector(up,-forward.dot(up)).normalize();
 const look=position.clone().addScaledVector(up,CAMERA_LOOK_Y),desired=position.clone().addScaledVector(up,CAMERA_HEIGHT).addScaledVector(forward,-7.5),direction=desired.clone().sub(look).normalize(),length=desired.distanceTo(look);
 const candidates=provider(look,length+2);assert.ok(candidates.includes(wall));assert.ok(candidates.length<25);
 const ray=new T.Raycaster(look,direction,0,length),wallHit=ray.intersectObject(wall,false)[0];assert.ok(wallHit,'rearward 7.5m camera intersects the actual bowl wall');
 const nearest=ray.intersectObjects(candidates,false)[0];assert.ok(nearest);assert.ok(nearest.distance>2,'existing camera minimum must remain before the surface');
 const camera=new T.PerspectiveCamera(),player={position,forward,velocity:new T.Vector3()},rig=createCameraRig(camera,player,{colliders:()=>[],occluderMeshes:provider});rig.setDist(7.5);rig.snapToPlayer();for(let frame=0;frame<60;frame++)rig.update(1/60);
 assert.ok(rig.getOcclusionDist()!==null);assert.ok(rig.getOcclusionDist()<7.5);assert.ok(camera.position.distanceTo(look)<nearest.distance-.01,'camera settles on the player side of the wall');
 assert.ok(camera.position.clone().sub(look).normalize().dot(direction)>.99999,'pull-in does not rotate the view direction');assert.equal(rig.getDist(),7.5,'requested zoom stays unchanged');
});

test('near cliff keeps the full safety gap and snap/first update never render behind the wall', {skip:'2026-10-10 Greg emergency-orbit camera reverted (WSAD reversal); see SWAMP_CAMERA_PLAN.md'},()=>{
 const local=new T.Vector3(16.815,30.8,-17.487),position=inner.localToWorld(local),up=position.clone().normalize();
 const forward=inner.localToWorld(new T.Vector3(-8,30.8,-7)).sub(position);forward.addScaledVector(up,-forward.dot(up)).normalize();
 const look=position.clone().addScaledVector(up,CAMERA_LOOK_Y),desired=position.clone().addScaledVector(up,CAMERA_HEIGHT).addScaledVector(forward,-7.5),dir=desired.clone().sub(look).normalize(),length=desired.distanceTo(look);
 const nearest=new T.Raycaster(look,dir,0,length).intersectObjects(provider(look,length+2),false)[0];assert.ok(nearest);assert.ok(nearest.distance<2.55,'regression requires a wall close enough to violate the old 2m minimum');
 const camera=new T.PerspectiveCamera(),rig=createCameraRig(camera,{position,forward,velocity:new T.Vector3()},{colliders:()=>[],occluderMeshes:provider});rig.setDist(7.5);rig.snapToPlayer();
 for(let frame=0;frame<5;frame++){
  assert.ok(camera.position.distanceTo(look)<=nearest.distance-.54,'snap and every rendered update remain before the padded surface');rig.update(1/60);
 }
 assert.equal(rig.getDist(),7.5);
 // Deliberately put the smooth state beyond a wall: correcting the desired
 // destination alone would leave the first interpolated frame obstructed.
 camera.position.copy(desired);rig.update(1/60);
 assert.ok(camera.position.distanceTo(look)<=nearest.distance-.54);
 rig.setFirstPerson(true);rig.update(1/60);assert.equal(rig.getDist(),.08);assert.ok(rig.isFirstPerson());
});

test('unoccluded third person, vehicle follow offsets and first person remain available',()=>{
 const position=new T.Vector3(0,160,0),forward=new T.Vector3(0,0,1),player={position,forward,velocity:new T.Vector3()},camera=new T.PerspectiveCamera(),rig=createCameraRig(camera,player,{colliders:()=>[],occluderMeshes:()=>[]});
 rig.setDist(7.5);rig.snapToPlayer();const initial=camera.position.clone();rig.update(1/60);assert.ok(initial.distanceTo(camera.position)<1e-9);assert.equal(rig.getOcclusionDist(),null);
 rig.setFollowProfile({yaw:.3,height:2});rig.update(1/60);assert.deepEqual(rig.getFollowProfile(),{yaw:.3,height:2});assert.equal(rig.getDist(),7.5);
 rig.setFirstPerson(true);rig.snapToPlayer();for(let i=0;i<60;i++)rig.update(1/60);assert.ok(camera.position.distanceTo(position)<.1);assert.equal(rig.getDist(),.08);
 rig.setFirstPerson(false);rig.setFollowProfile(null);rig.setDist(7.5);rig.setOcclusionEnabled(false);rig.snapToPlayer();assert.ok(initial.distanceTo(camera.position)<1e-9);
});

test('emergency orbit keeps the camera outside the courier when a close rear obstacle blocks the normal line', {skip:'2026-10-10 Greg emergency-orbit camera reverted (WSAD reversal); see SWAMP_CAMERA_PLAN.md'},()=>{
 const position=new T.Vector3(0,160,0),forward=new T.Vector3(0,0,1),player={position,forward,velocity:new T.Vector3()},camera=new T.PerspectiveCamera();
 const wall=new T.Mesh(new T.BoxGeometry(.3,5,.2),new T.MeshBasicMaterial({side:T.DoubleSide}));wall.position.set(0,162,-1.3);wall.updateMatrixWorld(true);
 const rig=createCameraRig(camera,player,{colliders:()=>[],occluderMeshes:()=>[wall]});rig.setDist(7.5);rig.snapToPlayer();
 const look=position.clone().add(new T.Vector3(0,CAMERA_LOOK_Y,0)),offset=camera.position.clone().sub(look),distance=offset.length();
 assert.ok(distance>1.15,'camera stays outside the courier body envelope');
 const requestedCameraOffset=Math.hypot(7.5,CAMERA_HEIGHT-CAMERA_LOOK_Y);assert.ok(Math.abs(distance-requestedCameraOffset)<1e-5,'emergency orbit keeps the requested zoom when a clear route exists');
 const ray=new T.Raycaster(look,offset.normalize(),0,distance);assert.equal(ray.intersectObject(wall,false).length,0,'selected orbit clears the close rear obstacle');
 assert.ok(Math.abs(rig.getOrbit().yaw)>.1,'selected escape yaw is retained in rig state');
 for(let frame=0;frame<10;frame++)rig.update(1/60);
 assert.ok(Math.abs(rig.getOrbit().yaw)>.1,'following updates retain the escaped view instead of snapping back into the wall');
 assert.equal(rig.getDist(),7.5);rig.setFirstPerson(true);for(let i=0;i<60;i++)rig.update(1/60);assert.ok(camera.position.distanceTo(position)<.1);
});

test('emergency orbit picks the wider side route around an enclosing shell and nearby rear wall', {skip:'2026-10-10 Greg emergency-orbit camera reverted (WSAD reversal); see SWAMP_CAMERA_PLAN.md'},()=>{
 const position=new T.Vector3(0,160,0),forward=new T.Vector3(0,0,1),player={position,forward,velocity:new T.Vector3()},camera=new T.PerspectiveCamera();
 const shell=new T.Mesh(new T.SphereGeometry(1,24,12),new T.MeshBasicMaterial({side:T.DoubleSide}));shell.position.set(0,160+CAMERA_LOOK_Y,0);shell.updateMatrixWorld(true);
 const localWall=new T.Mesh(new T.BoxGeometry(.3,5,.2),new T.MeshBasicMaterial({side:T.DoubleSide}));localWall.position.set(0,160+CAMERA_LOOK_Y,-.4);localWall.updateMatrixWorld(true);
 const rig=createCameraRig(camera,player,{colliders:()=>[],occluderMeshes:()=>[shell,localWall]});rig.setDist(7.5);rig.snapToPlayer();
 assert.ok(Math.abs(rig.getOrbit().yaw)>.1,'solver chooses an alternate side route around the local wall');
});

test('provider follows a new spherical placement, respects hidden ancestors, refreshes and releases references only',()=>{
 placeMoebiusSwampOnSphere(placement,new T.Vector3(-.2,.4,-.8).normalize(),160,.5,-15.8);placement.updateMatrixWorld(true);
 const near=inner.localToWorld(new T.Vector3(0,30,0));assert.ok(provider(near,30).includes(wall));
 inner.visible=false;assert.deepEqual(provider(near,30),[]);inner.visible=true;
 provider.refresh();assert.ok(provider(near,30).includes(wall));
 for(const s of snapshots){assert.equal(s.o.visible,s.visible);assert.deepEqual(s.o.position.toArray(),s.position);assert.deepEqual(s.o.scale.toArray(),s.scale);assert.equal(s.o.material,s.material);}
 provider.dispose();provider.dispose();assert.deepEqual(provider(near,30),[]);assert.deepEqual(provider.getMeshes(),[]);
});
