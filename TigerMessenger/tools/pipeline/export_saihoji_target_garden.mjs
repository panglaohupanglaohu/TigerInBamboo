import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const output=path.join(root,'artifacts/pipeline/saihoji-target-integration');
await mkdir(output,{recursive:true});
const base='http://localhost:8931/TigerMessenger';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1400,height:950}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/target-garden-fixture.html',r=>r.fulfill({contentType:'text/html',body:`<style>body{margin:0}</style><script type="importmap">{"imports":{"three":"${base}/vendor/three.module.js"}}</script>`}));
 await page.goto(base+'/target-garden-fixture.html');
 const data=await page.evaluate(async(base)=>{
   const T=await import('three'),{saihojiGardenScene}=await import(base+'/src/scenes/saihojiGarden.js');
   const {isSaihojiPool}=await import(base+'/src/world/saihojiTargetGarden.js');
   const {PLANET_RADIUS}=await import(base+'/src/world/planet.js');
   const scene=new T.Scene(),loaded=saihojiGardenScene.load({scene,planetRadius:PLANET_RADIUS,options:{}}),whale=loaded.group,island=whale.getObjectByName('leviathan-island');
   scene.updateMatrixWorld(true);const inv=island.matrixWorld.clone().invert(),meshes=[],trees=[],stones=[];
   const exportMesh=n=>{
     if(!n.isMesh||n.userData.isOutline)return;
     const geometry=n.geometry.index?n.geometry.toNonIndexed():n.geometry.clone();geometry.applyMatrix4(inv.clone().multiply(n.matrixWorld));
     const m=n.material;
     if(Array.isArray(m))throw new Error('Unmapped multi-material target mesh');
     meshes.push({name:n.name,positions:Array.from(geometry.attributes.position.array),normals:Array.from(geometry.attributes.normal.array),colors:geometry.attributes.color?Array.from(geometry.attributes.color.array):[],material:{color:m.color.toArray(),roughness:m.roughness??1}});geometry.dispose();
   };
   for(const child of island.children)if(child.name==='leviathan-crust-plate'||child.name.startsWith('leviathan-moss-bed-')||child.name==='leviathan-shrub-ring'||child.name==='saihoji-target-shallow-gardens'||child.name==='saihoji-relocated-root-moss')child.traverse(exportMesh);
   island.traverse(n=>{
     if(n.name==='giantTreeGroup')trees.push({seed:n.userData.sourceSeed,matrix:inv.clone().multiply(n.matrixWorld).toArray()});
     if(n.userData.kind==='stoneStep'){stones.push({position:island.worldToLocal(n.getWorldPosition(new T.Vector3())).toArray(),visible:n.visible});n.traverse(exportMesh);}
   });
   const covers=whale.userData.saihojiCoverPoints.map(c=>({id:c.id,seed:c.pine.userData.sourceSeed,position:c.localPoint.toArray(),clearance:c.clearance}));
   const checks={trees:trees.length===25,covers:covers.length===50,rootsAvoidPools:whale.userData.pineLayoutReport.entries.every(e=>!isSaihojiPool(e.after[0],e.after[2],.4)),coversAvoidPools:covers.every(c=>!isSaihojiPool(c.position[0],c.position[2],.3)),stonesAvoidPools:stones.every(s=>s.visible&&!isSaihojiPool(s.position[0],s.position[2],.29)),finite:meshes.every(m=>m.positions.every(Number.isFinite))};
   // Deliberately posed risen inspection, not a natural battle screenshot.
   whale.position.copy(whale.position.clone().normalize().multiplyScalar(185));island.position.y=6.08;scene.updateMatrixWorld(true);
   scene.background=new T.Color('#a9c9ce');scene.add(new T.HemisphereLight(0xf2edd7,0x344e53,2));
   const sun=new T.DirectionalLight(0xffe2ad,2);sun.position.copy(island.localToWorld(new T.Vector3(-20,40,15)));sun.target.position.copy(island.getWorldPosition(new T.Vector3()));scene.add(sun,sun.target);
   const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1400,950);renderer.outputColorSpace=T.SRGBColorSpace;document.body.appendChild(renderer.domElement);
   const camera=new T.PerspectiveCamera(36,1400/950,.1,1000);camera.up.set(0,1,0).transformDirection(island.matrixWorld);
   window.captureTargetGarden=(near)=>{camera.position.copy(island.localToWorld(new T.Vector3(...(near?[10,30,27]:[65,58,75]))));camera.lookAt(island.localToWorld(new T.Vector3(0,near?1:-4,0)));camera.updateMatrixWorld(true);renderer.render(scene,camera);return {calls:renderer.info.render.calls,triangles:renderer.info.render.triangles};};
   return {planetRadius:PLANET_RADIUS,revision:island.userData.targetGarden.revision,space:'garden_island-local, Three.js Y-up, column-major matrix',replaceNames:['leviathan-crust-plate','leviathan-terrain-topography','leviathan-shrub-ring',...Array.from({length:18},(_,i)=>`leviathan-moss-bed-${i}`),'SaihojiContinuousRootSupport'],replaceSourcePrefixes:['leviathanGroup[156]/leviathan-island[39]/SaihojiSixScenes[45]/Group['],meshes,trees,covers,pools:island.userData.targetGarden.pools,checks,scope:'Shared visual layout. Godot retains its static shore concealment positions; Web uses island anchored positions.'};
 },base);
 if(Object.values(data.checks).some(v=>!v)||errors.length)throw new Error(JSON.stringify({checks:data.checks,errors}));
 await writeFile(path.join(root,'godot/data/saihoji-target-garden-20260919.json'),JSON.stringify(data));
 const report={revision:data.revision,checks:data.checks,errors,scope:data.scope,meshes:data.meshes.length,trees:data.trees.length,covers:data.covers.length,captures:[]};
 for(const near of [false,true]){report.captures.push(await page.evaluate(v=>window.captureTargetGarden(v),near));await page.screenshot({path:path.join(output,near?'garden-after.png':'kun-after.png')});}
 await writeFile(path.join(output,'layout-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
} finally {await browser.close();}
