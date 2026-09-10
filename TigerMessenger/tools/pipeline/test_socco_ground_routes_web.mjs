import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const output=new URL('../../artifacts/pipeline/socco-ground-routes/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8931/TigerMessenger/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:120000});
 const report=await page.evaluate(async()=>{
   const T=window.__tm.THREE,{scene}=window.__tm;
   const {createSoccoBerthSolver}=await import('/TigerMessenger/src/world/soccoBerth.js');
   const {createSoccoGroundRoutes}=await import('/TigerMessenger/src/world/soccoGroundRoutes.js');
   const {setSoccoRamp,soccoRampFootWorld}=await import('/TigerMessenger/src/world/gateHaulerCraft.js');
   const checks=[],check=(name,passed)=>checks.push({name,passed});
   const fixture=new T.Scene(),land=new T.Mesh(new T.SphereGeometry(161,48,24),new T.MeshBasicMaterial());land.name='mossy-terrain';fixture.add(land);
   const rock=new T.Mesh(new T.BoxGeometry(2.5,3,2),new T.MeshBasicMaterial());rock.position.set(0,161,-4);rock.userData.kind='gardenStone:standing';fixture.add(rock);
   const carrier=new T.Group();carrier.position.set(30,165,30);fixture.add(carrier);
   const fixtureNav=createSoccoGroundRoutes(fixture,createSoccoBerthSolver(fixture,160.5),carrier);
   const a=new T.Vector3(0,161.06,0),b=new T.Vector3(0,161,-8);
   check('direct path through rock rejected',!fixtureNav.clear(a,b));
   const detour=fixtureNav.plan(a,b);
   check('route around rock found',!!detour&&detour.points.every((p,i)=>i===0||fixtureNav.clear(detour.points[i-1],p)));
   check('occupied assembly point does not invalidate all routes',!!detour&&!!fixtureNav.plan(a,b,[detour.points.at(-1)]));
   const berths=await(await fetch('/TigerMessenger/artifacts/pipeline/socco-web-berth/report.json')).json();
   const solver=createSoccoBerthSolver(scene,160.5),ships=[];
   for(const saved of berths.ships){
     const craft=scene.getObjectByName(saved.name),b=saved.berth;
     scene.attach(craft);craft.position.set(b.position.x,b.position.y,b.position.z);
     craft.quaternion.set(b.quaternion._x,b.quaternion._y,b.quaternion._z,b.quaternion._w);
     setSoccoRamp(craft,1,b.groundLocalY);scene.updateMatrixWorld(true);
     const nav=createSoccoGroundRoutes(scene,solver,craft),start=soccoRampFootWorld(craft),occupied=[],routes=[];
     for(let seat=0;seat<7;seat++){
       const target=craft.localToWorld(new T.Vector3(((seat%3)-1)*1.6,-2,-8.7-(2-Math.floor(seat/3))*1.7));
       const route=nav.plan(start,target,occupied);
       if(route)occupied.push(route.points.at(-1));
       routes.push({seat,valid:!!route,length:route?.length,visits:route?.visits,points:route?.points.map(p=>p.toArray())});
     }
     ships.push({name:craft.name,routes});
   }
   return {checks,ships,scope:'Static authored tree/stone and carrier hull avoidance on sampled spherical dry terrain; diagnostic parked craft'};
 });
 report.errors=errors;report.passed=errors.length===0&&report.checks.every(c=>c.passed)&&report.ships.every(h=>h.routes.every(r=>r.valid));
 await writeFile(new URL('report.json',output),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks,ships:report.ships.map(h=>({name:h.name,routes:h.routes.length,valid:h.routes.filter(r=>r.valid).length,maxLength:Math.max(...h.routes.map(r=>r.length||0))})),errors}));if(!report.passed)process.exitCode=1;
}finally{await browser.close();}
