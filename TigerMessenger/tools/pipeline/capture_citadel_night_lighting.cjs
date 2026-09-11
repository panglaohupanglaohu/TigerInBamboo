const {chromium}=require('../../../tools/e2e/node_modules/playwright-core');
const fs=require('fs'),path=require('path');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});try{
 const p=await browser.newPage();await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>window.__freezeCitadel&&cb.name==='animate'?0:raf(cb);});
 await p.goto('http://localhost:8931/TigerMessenger/?timeOfDay=0.9&autostart=1',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:180000});
 await p.waitForTimeout(1200);await p.evaluate(()=>window.__freezeCitadel=true);await p.waitForTimeout(150);
 const report=await p.evaluate(async(closeGate)=>{
 const T=await import('three'),api=await import('/TigerMessenger/src/world/odysseyCitadel.js');
 const tm=window.__tm;let castle;tm.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)castle=o;});
 tm.P.sunRigManual=false;tm.P.timeOfDay=.9;
 api.updateCitadelNightWindows(castle,.9,{threats:[]});castle.update(.016,10);
 const root=castle.getObjectByName('citadel-new-city-lighting');
 const lights=[];root.traverse(o=>{if(o.isPointLight)lights.push({name:o.name,intensity:o.intensity,position:castle.worldToLocal(o.getWorldPosition(new T.Vector3())).toArray()});});
 const old=castle.getObjectByName('highland-light-volumes');let oldCount=0;old.traverse(o=>{if(o.isPointLight)oldCount++;});
 const {officialOceanLevelAt}=await import('/TigerMessenger/src/world/waterV8/officialOcean.js');
 const quay=castle.getObjectByName('west-city-harbor-quay');quay.updateWorldMatrix(true,false);
 let minQuayClearance=Infinity;
 for(let ix=0;ix<=12;ix++)for(let iz=0;iz<=4;iz++){
  const q=quay.localToWorld(new T.Vector3(-6.25+12.5*ix/12,.25,-2+iz));
  minQuayClearance=Math.min(minQuayClearance,q.length()-160-officialOceanLevelAt(q));
 }
 const garden=castle.getObjectByName('citadel-terrace-garden'),beds=garden.userData.planting;
 const supports=[];castle.traverse(o=>{if(o.isMesh&&o.userData.westCityWalkable)supports.push(o);});
 const up=new T.Vector3(0,1,0).transformDirection(castle.matrixWorld),ray=new T.Raycaster();ray.layers.enableAll();ray.far=.3;
 const plants=[...beds.trees,...beds.shrubs];let supportedPlants=0;
 for(const point of plants){const q=garden.localToWorld(new T.Vector3(...point));ray.set(q.addScaledVector(up,.15),up.clone().negate());if(ray.intersectObjects(supports,false).length)supportedPlants++;}
 const cam=tm.camera;cam.position.copy(castle.localToWorld(new T.Vector3(...(closeGate==='flank'?[85,35,120]:closeGate==='upper'?[17,43,17]:closeGate==='tower'?[8.9,33.8,-4.4]:closeGate==='court'?[8,34,6]:closeGate?[8,26,44]:[0,24,150]))));cam.up.set(0,1,0).transformDirection(castle.matrixWorld);cam.lookAt(castle.localToWorld(new T.Vector3(...(closeGate==='flank'?[8,10,36]:closeGate==='upper'?[8,37,-1]:closeGate==='tower'?[8.9,29,-4.0]:closeGate==='court'?[9.5,19,5]:closeGate?[8,24,11]:[16,15,12]))));cam.fov=50;cam.updateProjectionMatrix();
 tm.renderer.render(tm.scene,cam);
 const canvas=tm.renderer.domElement;canvas.style.position='fixed';canvas.style.inset='0';canvas.style.zIndex='2147483647';
 return {plantCount:plants.length,supportedPlants,minQuayClearance,lights,oldCount,total:lights.length+oldCount,passed:supportedPlants===plants.length&&plants.length===32&&minQuayClearance>.75&&lights.length===3&&oldCount===1&&lights.every(l=>l.intensity>0),scope:'Actual original scene, camera repositioned only; original night environment and production lights, not a separately lit geometry clone.'};
 },process.env.CITADEL_GATE_CLOSE==='flank'?'flank':process.env.CITADEL_GATE_CLOSE==='upper'?'upper':process.env.CITADEL_GATE_CLOSE==='tower'?'tower':process.env.CITADEL_GATE_CLOSE==='court'?'court':process.env.CITADEL_GATE_CLOSE==='1');
 const out=path.resolve(__dirname,'../../artifacts/pipeline/citadel-plaza-horse');fs.mkdirSync(out,{recursive:true});await p.screenshot({path:out+(process.env.CITADEL_GATE_CLOSE==='flank'?'/actual-east-mountain-foot.png':process.env.CITADEL_GATE_CLOSE==='upper'?'/actual-upper-exit.png':process.env.CITADEL_GATE_CLOSE==='tower'?'/actual-tower-spiral.png':process.env.CITADEL_GATE_CLOSE==='court'?'/actual-gate-court.png':process.env.CITADEL_GATE_CLOSE==='1'?'/actual-main-gate.png':'/actual-night-lighting.png')});fs.writeFileSync(out+'/web-night-lighting.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
