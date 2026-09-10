import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const base='http://localhost:8931/TigerMessenger',output=new URL('../../artifacts/pipeline/socco-return-routes/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/return-route-fixture.html',r=>r.fulfill({contentType:'text/html',body:`<script type="importmap">{"imports":{"three":"${base}/vendor/three.module.js"}}</script>`}));
 await page.goto(base+'/return-route-fixture.html');
 const report=await page.evaluate(async(base)=>{
   const T=await import('three');
   const {createSoccoBerthSolver}=await import(base+'/src/world/soccoBerth.js');
   const {createSoccoGroundRoutes}=await import(base+'/src/world/soccoGroundRoutes.js');
   const scene=new T.Scene(),terrain=new T.Mesh(new T.SphereGeometry(161,64,48),new T.MeshBasicMaterial());terrain.name='mossy-terrain';scene.add(terrain);
   const rock=new T.Mesh(new T.BoxGeometry(3,4,2),new T.MeshBasicMaterial());rock.position.set(0,161,-4.5);rock.userData.kind='gardenStone:standing';scene.add(rock);
   const carrier=new T.Group();carrier.position.set(30,165,30);scene.add(carrier);
   const ground=createSoccoBerthSolver(scene,160.5),nav=createSoccoGroundRoutes(scene,ground,carrier);
   const start=new T.Vector3(0,161,0),target=new T.Vector3(0,161,-9),checks=[];
   const check=(name,passed,detail)=>checks.push({name,passed,detail});
   check('direct line crosses solid rock',!nav.clear(start,target));
   const route=nav.planReturn(start,target,{maxDistance:24});
   check('detour found to exact requested endpoint',route.valid,route.valid?{length:route.length,visits:route.visits}:route);
   if(route.valid){
     const end=ground.sample(target);end.addScaledVector(end.clone().normalize(),.06);
     check('no substitute destination beyond obstacle',route.points.at(-1).distanceTo(end)<1e-7);
     let maxStep=0,blockedSamples=0,previous=nav.pointAt(route,0);
     for(let i=1;i<=100;i++){
       const point=nav.pointAt(route,i/100);maxStep=Math.max(maxStep,point.distanceTo(previous));
       if(!nav.clear(point,point))blockedSamples++;
       previous=point;
     }
     check('walking samples remain outside rock without jumps',blockedSamples===0&&maxStep<.45,{blockedSamples,maxStep});
   }
   const trapped=nav.planReturn(new T.Vector3(0,161,-4.5),target);
   check('embedded start is reported instead of teleported',!trapped.valid&&trapped.reason==='obstructed-endpoint',trapped);
   const noBudget=nav.planReturn(start,target,{maxVisits:0});
   check('exhausted search never claims arrival',!noBudget.valid&&noBudget.reason==='search-budget',noBudget);
   terrain.visible=false;
   const absent=createSoccoGroundRoutes(scene,ground,carrier).planReturn(start,target);
   check('missing terrain fails without a straight-line fallback',!absent.valid&&absent.reason==='missing-dry-endpoint',absent);
   return {checks,route:route.valid?{length:route.length,points:route.points.map(p=>p.toArray())}:route,scope:'Synthetic spherical terrain with a real solid obstacle; exact pathfinding contract, not full battle acceptance'};
 },base);
 report.errors=errors;report.passed=errors.length===0&&report.checks.every(c=>c.passed);
 await writeFile(new URL('report.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks,errors}));if(!report.passed)process.exitCode=1;
}finally{await browser.close();}
