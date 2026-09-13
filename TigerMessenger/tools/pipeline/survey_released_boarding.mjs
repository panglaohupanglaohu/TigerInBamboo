import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await browser.newPage({viewport:{width:1500,height:1000}});
 await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>window.__pauseBoardSurvey&&cb.name==='animate'?0:raf(cb);});
 await p.goto('http://localhost:8931/TigerMessenger/?autostart=1');
 await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('castleContainer')?.userData.masterTerrainCandidate?.status==='ready'&&window.__tm?.messenger?.landmarks?.canalBoats?.boats?.length,null,{timeout:180000});
 const result=await p.evaluate(async()=>{
  const t=window.__tm,T=t.THREE,city=t.scene.getObjectByName('highland-west-city'),boat=t.messenger.landmarks.canalBoats.boats[0],api=boat.userData.warshipV6;
  window.__pauseBoardSurvey=true;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
  const {createWarshipWaterRoutes}=await import('/TigerMessenger/src/world/warshipWaterRoutes.js');
  const {createWarshipClearance}=await import('/TigerMessenger/src/world/warshipClearance.js');
  const {orientWarship}=await import('/TigerMessenger/src/world/warshipNavigation.js');
  const solver=createWarshipWaterRoutes(t.scene,160),bed=t.scene.getObjectByName('planet-surface');bed.geometry.computeBoundingBox();
  const box=bed.geometry.boundingBox.clone().applyMatrix4(bed.matrixWorld),obstacles=[...solver.obstacles,{root:bed,box,meshes:[{mesh:bed,box}]}];
  const samples=[],saved={p:boat.position.clone(),q:boat.quaternion.clone()},cityUp=new T.Vector3(0,1,0).transformDirection(city.matrixWorld);
  const quays=[];city.traverse(n=>{if(n.name==='integrated-quay-strip')quays.push(n);});
  const ray=new T.Raycaster();ray.layers.enableAll();
  function supportAt(point){ray.set(point.clone().addScaledVector(cityUp,20),cityUp.clone().negate());ray.far=40;const hit=ray.intersectObjects(quays,false)[0];return {local:city.worldToLocal(point.clone()).toArray(),support:hit?.object.name,error:hit?point.clone().sub(hit.point).dot(cityUp):null};}
  for(const z of [115.6,115.7,115.8]){
   const direction=city.localToWorld(new T.Vector3(53.8,0,z)).normalize();boat.position.copy(solver.position(direction));orientWarship(boat,direction,new T.Vector3(-1,0,0).transformDirection(city.matrixWorld));
   for(const degrees of [-16,-15,-14,-13]){
    api.setBoardingPitch(degrees*Math.PI/180);api.setBoarding(1);api.update(0,0);
    const hinge=api.nodes.get('add:boarding-hinge'),length=api.boardingContract.length;
    const hq=hinge.getWorldQuaternion(new T.Quaternion()),xx=new T.Vector3(1,0,0).applyQuaternion(hq),yy=new T.Vector3(0,1,0).applyQuaternion(hq);
    const roll=Math.atan2(-xx.dot(cityUp),yy.dot(cityUp));hinge.rotateZ(roll);api.render();
    const lanes=[-.16,0,.16].map(x=>supportAt(hinge.localToWorld(new T.Vector3(x,.024,length))));
    // Beam dimensions are from the original Blender builder: center -.028,
    // height .065. Sample inside the bevel, separately from the walk surface.
    const bearings=[-.17,.17].map(x=>supportAt(hinge.localToWorld(new T.Vector3(x,-.0605,length-.02))));
    const supported=bearings.every(l=>l.support&&l.error>=0&&l.error<=.025)&&lanes.every(l=>l.support&&l.error>=0&&l.error<=.20);
    let hit=null;if(lanes.every(l=>l.support&&l.error>0&&l.error<.5)){const checker=createWarshipClearance(boat,obstacles);hit=checker.clear(boat.position,boat.quaternion,boat.scale);}
    samples.push({z,degrees,roll,lanes,bearings,supported,clear:hit?.clear??false,hit,position:boat.position.toArray(),quaternion:boat.quaternion.toArray(),hingeQuaternion:hinge.quaternion.toArray()});
   }
  }
  let landingCandidate=null;
  const best=samples.filter(s=>s.clear&&s.lanes.every(l=>l.error<.3)).sort((a,b)=>a.lanes[1].error-b.lanes[1].error)[0];
  if(best){
   boat.position.fromArray(best.position);boat.quaternion.fromArray(best.quaternion);api.setBoardingPitch(best.degrees*Math.PI/180);api.setBoarding(1);api.update(0,0);
   const hinge=api.nodes.get('add:boarding-hinge'),length=api.boardingContract.length;hinge.rotateZ(best.roll);api.render();
   const top=[[-.23,length-.055],[.23,length-.055],[.23,length+.015],[-.23,length+.015]].map(([x,z])=>city.worldToLocal(hinge.localToWorld(new T.Vector3(x,-.0665,z))));
   const bottom=top.map(p=>{const world=city.localToWorld(p.clone()),s=supportAt(world);if(!s.support)throw Error('Shoe missing quay support');return p.clone().add(new T.Vector3(0,-s.error,0));});
   const vertices=[...bottom,...top].map(v=>v.toArray()),indices=[0,2,1,0,3,2,4,5,6,4,6,7,0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7];
   for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(vertices.flat(),3));geo.setIndex(indices);geo.computeVertexNormals();
   const shoe=new T.Mesh(geo,new T.MeshStandardMaterial({color:0x785438,roughness:.9,side:T.DoubleSide}));shoe.name='citadel-boarding-bearing-shoe-candidate';city.add(shoe);shoe.updateWorldMatrix(true,false);geo.computeBoundingBox();
   const shoeBox=geo.boundingBox.clone().applyMatrix4(shoe.matrixWorld),checker=createWarshipClearance(boat,[...obstacles,{root:shoe,box:shoeBox,meshes:[{mesh:shoe,box:shoeBox}]}]);
   const clearance=checker.clear(boat.position,boat.quaternion,boat.scale);
   landingCandidate={...best,vertices,boatLocalVertices:vertices.map(v=>boat.worldToLocal(city.localToWorld(new T.Vector3(...v))).toArray()),indices,vertexFrame:'highland-west-city',clearance,contactGapLocal:.006,scope:'Static external geometry and narrow timber bearing shoe only. Deployment self-collision, actor walking, Blender save and Godot integration still unverified.'};
   t.cameraRig.update=()=>{};t.P.daySpeed=0;t.P.timeOfDay=.85;t.camera.position.copy(city.localToWorld(new T.Vector3(60,1,124)));t.camera.up.copy(cityUp);t.camera.lookAt(city.localToWorld(new T.Vector3(50,-4.5,111)));t.camera.fov=48;t.camera.updateProjectionMatrix();t.renderer.render(t.scene,t.camera);
   landingCandidate.image=t.renderer.domElement.toDataURL('image/png');
  }
  api.setBoarding(0);api.setBoardingPitch(null);api.update(0,0);boat.position.copy(saved.p);boat.quaternion.copy(saved.q);
  return {source:api.source,contract:api.boardingContract,samples,valid:samples.filter(s=>s.supported&&s.clear),landingCandidate,scope:'Read-only temporary poses of the original ship in a separate browser. Actual deployed hinge lanes and current ship geometry; no production pose change or actor validation.'};
 });
 if(result.landingCandidate?.image){await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/surroundings-r04-landing-candidate.png',import.meta.url),Buffer.from(result.landingCandidate.image.split(',')[1],'base64'));delete result.landingCandidate.image;}
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/surroundings-r04-boarding-survey.json',import.meta.url),JSON.stringify(result,null,2));
 console.log(JSON.stringify({landingCandidate:result.landingCandidate&&{clearance:result.landingCandidate.clearance,z:result.landingCandidate.z,degrees:result.landingCandidate.degrees,roll:result.landingCandidate.roll}}));
 console.log(JSON.stringify({samples:result.samples.length,valid:result.valid.length,clearCandidates:result.samples.filter(s=>s.clear).map(s=>({z:s.z,degrees:s.degrees,roll:s.roll,lanes:s.lanes,bearings:s.bearings})),failures:result.samples.filter(s=>s.hit&&!s.clear).map(s=>({z:s.z,degrees:s.degrees,mesh:s.hit.mesh}))}));
}finally{await browser.close();}
