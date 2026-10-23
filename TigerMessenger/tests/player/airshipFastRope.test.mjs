import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
const listeners=[];
globalThis.window={addEventListener(type,handler){if(type==='keydown')listeners.push(handler);}};
globalThis.document={getElementById(){return null;},addEventListener(){}};
const {createAirshipRide}=await import('../../src/player/airshipRide.js');
const {createMoebiusAirship}=await import('../../src/assets/moebiusAirship.js');
const press=code=>{const e={code,preventDefault(){this.defaultPrevented=true;}};for(const l of listeners)l(e);return e;};

test('F while flying: the courier steps out, slides down the rope in view, brakes and lands standing on the ground under it',()=>{
  listeners.length=0;
  const up=new T.Vector3(0,1,0),forward=new T.Vector3(0,0,1);
  const ground=163;// e.g. a raised walkway under the airship
  const player={position:new T.Vector3(0,160,0),forward,facing:forward.clone(),velocity:new T.Vector3(),onGround:true,riding:false};
  const ship=createMoebiusAirship();ship.scale.setScalar(1.25);
  const group={visible:true},cam={dist:5,fp:false,setDist(d){this.dist=d;},getDist(){return this.dist;},setFirstPerson(v){this.fp=v;},setFov(){},getFov(){return 60;}};
  const ride=createAirshipRide({player,getAirship:()=>ship,planetRadius:160,keys:{},playerGroup:group,cameraRig:cam,groundRadius:()=>ground});
  ride.summon();press('KeyF');
  for(let i=0;i<120&&ride.getState()!=='flying';i++)ride.update(1/30);
  assert.equal(ride.getState(),'flying');
  // fly up high
  ship.userData.hover=(ship.userData.hover??20)+12;for(let i=0;i<120;i++){ride.update(1/30);ship.updateMatrixWorld(true);}
  // companions ride on the gondola roof right beside the courier, not in mid-air
  const sp=new T.Vector3(),fw=new T.Vector3();assert.equal(ride.rideSpot(-1,sp,fw),true);
  const seat=ship.userData.parts.gondolaMesh.getWorldPosition(new T.Vector3());
  assert.ok(sp.distanceTo(player.position)<2.2&&sp.distanceTo(player.position)>.8,`beside the courier ${sp.distanceTo(player.position)}`);
  assert.ok(Math.abs(sp.length()-player.position.length())<.3,'same deck height as the courier');assert.ok(sp.length()>seat.length(),'above the gondola');
  press('KeyF');assert.equal(ride.getState(),'descending');assert.equal(group.visible,true);assert.equal(cam.fp,false);assert.ok(cam.dist>=6);
  const radii=[];let speedMax=0,prev=player.position.clone();
  for(let i=0;i<600&&ride.getState()==='descending';i++){ride.update(1/30);ship.updateMatrixWorld(true);radii.push(player.position.length());speedMax=Math.max(speedMax,player.position.distanceTo(prev)*30);prev.copy(player.position);assert.equal(group.visible,true,'courier always visible on the rope');}
  assert.equal(ride.getState(),'idle');assert.equal(player.riding,false);
  assert.ok(Math.abs(player.position.length()-(ground+.05))<.08,`lands on the ground ${player.position.length()}`);
  const rb=ship.userData.rope.getWorldPosition(new T.Vector3());assert.ok(Math.abs(rb.length()-ground)<.3,'rope paid out to the ground');
  assert.ok(player.position.distanceTo(rb)<1.2,'lands beside the rope end');
  assert.ok(speedMax<=8,'controlled slide, not a teleport '+speedMax+' from '+radii.slice(0,4).join(','));
  assert.ok(radii.length>30,'descent takes visible time');
  for(let i=1;i<radii.length;i++)assert.ok(radii[i]<=radii[i-1]+.1,'only goes down (apart from stepping out)');
});

test('landing is decided by the receiving surface, not the rope end: a walkway that only reports itself near the feet still catches the courier',()=>{
  listeners.length=0;
  const forward=new T.Vector3(0,0,1);
  // like the swamp samplers: the raised walkway (r=163) answers only within 3.5 above it; otherwise the canyon floor (r=158) answers
  const ground=p=>{const r=p.length();return r-163<=3.5&&r-163>=-.35?163:158;};
  const player={position:new T.Vector3(0,163,0),forward,facing:forward.clone(),velocity:new T.Vector3(),onGround:true,riding:false};
  const ship=createMoebiusAirship();ship.scale.setScalar(1.25);
  const cam={dist:5,setDist(d){this.dist=d;},getDist(){return this.dist;},setFirstPerson(){},setFov(){},getFov(){return 60;}};
  const ride=createAirshipRide({player,getAirship:()=>ship,planetRadius:160,keys:{},playerGroup:{visible:true},cameraRig:cam,groundRadius:ground});
  ride.summon();press('KeyF');for(let i=0;i<120&&ride.getState()!=='flying';i++)ride.update(1/30);
  for(let i=0;i<60;i++){ride.update(1/30);ship.updateMatrixWorld(true);}
  press('KeyF');for(let i=0;i<900&&ride.getState()==='descending';i++){ride.update(1/30);ship.updateMatrixWorld(true);}
  assert.equal(ride.getState(),'idle');
  assert.ok(Math.abs(player.position.length()-163.05)<.1,`stands on the walkway, not the canyon floor: ${player.position.length()}`);
  assert.ok(Math.abs(ship.userData.rope.getWorldPosition(new T.Vector3()).length()-163)<.35,'rope end rests on the walkway');
});
