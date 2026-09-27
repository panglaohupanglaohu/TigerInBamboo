import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage();await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});await p.waitForTimeout(3000);
const r=await p.evaluate(()=>{const t=window.__tm,T=t.THREE;const castle=t.scene.getObjectByName('castleContainer');const roofs=[];const vis=o=>{while(o){if(!o.visible)return false;o=o.parent;}return true;};
castle.traverse(o=>{if(o.isMesh&&!o.userData.isOutline&&/^town-terrace-/.test(o.parent?.name||''))roofs.push(o);});
const visRoofs=roofs.filter(vis);castle.updateMatrixWorld(true);const ray=new T.Raycaster(),up=new T.Vector3(0,1,0).transformDirection(castle.matrixWorld);const hits=[];
for(let x=-92;x<=-20;x+=3)for(let z=-42;z<=26;z+=3){const from=castle.localToWorld(new T.Vector3(x,80,z));ray.set(from,up.clone().negate());ray.far=100;const h=ray.intersectObjects(visRoofs,false)[0];if(h)hits.push([+castle.worldToLocal(h.point.clone()).y.toFixed(1),+(h.face.normal.clone().transformDirection(h.object.matrixWorld).dot(up)).toFixed(2)]);}
const flat=hits.filter(h=>h[1]>.85);return {roofs:roofs.length,visible:visRoofs.length,hits:hits.length,flat:flat.length,topFlat:flat.sort((a,b)=>b[0]-a[0]).slice(0,8),topAny:hits.sort((a,b)=>b[0]-a[0]).slice(0,8)};});
console.log(JSON.stringify(r));}finally{await b.close();}
