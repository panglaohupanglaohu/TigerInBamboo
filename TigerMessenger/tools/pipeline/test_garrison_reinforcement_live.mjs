import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
import arrivalData from '../../assets/navigation/citadelRedArrival.js';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
  const page=await browser.newPage({viewport:{width:1600,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
  await page.goto('http://127.0.0.1:8931/TigerMessenger/?autostart=1',{timeout:180000});
  await page.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:180000});
  const report=await page.evaluate(async()=>{
    const t=window.__tm,b=t.messenger.landmarks.saihojiPhalanx;t.P.timeOfDay=.6;t.P.daySpeed=0;
    b.root.userData.debugSiege();
    const state=()=>{
      const guards=b.root.getObjectByName('citadel-red-garrison').children;
      return {total:guards.length,alive:guards.filter(s=>s.visible&&!s.userData.dead).length,guards:guards.map(s=>({uid:s.userData.uid,role:s.userData.phalanxRole,embarked:s.userData.embarked,storage:s.userData.weaponStorage})),ships:b.root.children.filter(s=>s.userData.kind==='red-reinforce-ship').map(s=>({name:s.name,visible:s.visible,crew:s.userData.crewManifest?.filter(m=>m.combatant).map(m=>({...m}))})),pendingCohorts:b.root.children.filter(s=>s.name.startsWith('red-reinforce-ship-')&&s.name.endsWith('-cohort')).length};
    };
    const quiet=()=>b.root.traverse(s=>{if(s.userData.siegeEntryRoute){s.userData.dead=true;s.visible=false;}});
    // Admission test deliberately removes blue combatants and uses one-second
    // scheduler steps; this is not a natural battle or animation acceptance test.
    for(let i=0;i<40;i++){quiet();b.update(1,i);}
    // Let the existing oar easing settle at ordinary frame steps while held.
    for(let i=0;i<90;i++){quiet();b.update(1/60,40+i/60);}
    const held=state();
    const city=t.scene.getObjectByName('highland-west-city');
    const castle=t.scene.getObjectByName('castleContainer');
    const boat=b.root.children.find(s=>s.userData.kind==='red-reinforce-ship');
    city.updateWorldMatrix(true,true);boat.updateWorldMatrix(true,true);
    const anchor=castle.localToWorld(new t.THREE.Vector3(...city.userData.frontHarborAnchor));
    const actual=boat.getWorldPosition(new t.THREE.Vector3());
    const hinge=boat.userData.warshipV6?.nodes.get('add:boarding-hinge');
    const hingeWorld=hinge?.getWorldPosition(new t.THREE.Vector3());
    const arrival={waterRoutesEnabled:!!b.root.userData.warshipWaterRoutesEnabled,boatWorld:actual.toArray(),boatCity:city.worldToLocal(actual.clone()).toArray(),quayCity:city.worldToLocal(anchor.clone()).toArray(),boatToQuay:actual.distanceTo(anchor),hingeToQuay:hingeWorld?.distanceTo(anchor),hingeCity:hingeWorld?city.worldToLocal(hingeWorld.clone()).toArray():null};
    const {createWarshipWaterRoutes}=await import('/TigerMessenger/src/world/warshipWaterRoutes.js');
    const waterCheck=createWarshipWaterRoutes(t.scene,160);
    const sample=waterCheck.surface(actual);
    arrival.waterSupport={...sample,seabedDepth:sample?sample.water-sample.seabed:null};
    const ray=new t.THREE.Raycaster(actual.clone().normalize().multiplyScalar(250),actual.clone().normalize().negate(),0,140);ray.layers.enableAll();
    const surfaceMeshes=[];t.scene.traverseVisible(o=>{if(!o.isMesh)return;for(let a=o;a;a=a.parent)if(a.userData.warshipV6)return;surfaceMeshes.push(o);});
    arrival.allSceneSurfaces=ray.intersectObjects(surfaceMeshes,false).slice(0,12).map(h=>({name:h.object.name,parent:h.object.parent?.name,radius:h.point.length(),material:h.object.material?.type,transparent:h.object.material?.transparent,depthTest:h.object.material?.depthTest,layer:h.object.layers.mask}));
    held.arrival=arrival;
    held.oarSpeed=boat.userData.oarSpeed;
    held.arrival.route=b.root.userData.redArrivalRoute;
    held.arrival.boardingVerified=false;
    held.arrival.reason='Measured arrival route is separate from physical boarding and post walking.';
    t.camera.position.copy(city.localToWorld(new t.THREE.Vector3(85,15,140)));
    t.camera.up.set(0,1,0).transformDirection(city.matrixWorld);
    t.camera.lookAt(city.localToWorld(new t.THREE.Vector3(56,0,106)));
    t.camera.fov=55;t.camera.aspect=1.6;t.camera.updateProjectionMatrix();
    t.renderer.setSize(1600,1000);t.scene.updateMatrixWorld(true);t.renderer.render(t.scene,t.camera);
    const arrivalImage=t.renderer.domElement.toDataURL('image/png');
    const guards=b.root.getObjectByName('citadel-red-garrison').children;
    guards.slice(0,4).forEach(s=>{s.userData.dead=true;s.visible=false;});
    quiet();b.update(1,41);const admitted=state();
    b.root.userData.debugSiege();const reset=state();
    return {held,admitted,reset,arrivalImage,scope:'Actual Web admission/queue/reset with debug siege, blue combat disabled and 1-second scheduler steps. Not normal storyline or combat validation.'};
  });
  await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/red-arrival-web.png',import.meta.url),Buffer.from(report.arrivalImage.split(',')[1],'base64'));
  delete report.arrivalImage;
  const heldCrew=report.held.ships[0]?.crew??[];
  const ashore=report.admitted.guards.slice(28);
  report.identityPreserved=heldCrew.length===4&&ashore.length===4&&heldCrew.every((entry,i)=>entry.uid===ashore[i].uid&&entry.role===ashore[i].role&&entry.embarked&&entry.weaponStored&&!ashore[i].embarked&&ashore[i].storage==='actor');
  report.endpointError=Math.hypot(...report.held.arrival.boatWorld.map((v,i)=>v-arrivalData.poses.at(-1).position[i]));
  report.newHarborArrival=report.held.arrival.route?.source==='validated-new-front-harbor'&&report.endpointError<.001;
  report.errors=errors;
  report.passed=report.held.total===28&&report.held.ships.length===1&&report.held.ships[0].visible&&report.admitted.total===32&&report.admitted.alive===28&&!report.admitted.ships[0].visible&&report.reset.total===28&&report.reset.ships.length===0&&report.reset.pendingCohorts===0&&report.admitted.pendingCohorts===0&&report.identityPreserved&&report.newHarborArrival&&report.held.oarSpeed<.02&&!errors.length;
  await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/garrison-reinforcement.json',import.meta.url),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}finally{await browser.close();}
