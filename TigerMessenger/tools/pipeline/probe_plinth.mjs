import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage();const logs=[];p.on('console',m=>{const t=m.text();if(/plinth|Plinth|跳过|error/i.test(t))logs.push(m.type()+': '+t.slice(0,240));});p.on('pageerror',e=>logs.push('pageerror '+e.message));
await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});await p.waitForTimeout(2500);
const r=await p.evaluate(()=>{const t=window.__tm,T=t.THREE;const m=t.scene.getObjectByName('highland-town-foundation-plinth');const f=t.scene.getObjectByName('highland-town-foundation-platform');const s=f?.getObjectByName('highland-town-foundation-platform-side');
let box=null;if(m){const bb=new T.Box3().setFromObject(m);box={min:bb.min.length(),size:bb.getSize(new T.Vector3()).toArray().map(Math.round)};}
return {plinth:!!m,info:m?.userData.plinth,visible:m?.visible,box,foundationVisible:f?.visible,sideCount:s?.geometry.attributes.position.count,fParentVisible:f?.parent?.visible,fPath:(()=>{const a=[];let o=f;while(o){a.push(o.name+(o.visible?'':'(hidden)'));o=o.parent;}return a.slice(0,6);})()};});
console.log(JSON.stringify(r));console.log(logs.slice(0,8).join('\n'));}finally{await b.close();}
