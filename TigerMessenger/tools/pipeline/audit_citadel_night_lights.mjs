import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=new URL('../../artifacts/pipeline/citadel-plaza-reference-layout/',import.meta.url);await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(String(e)));
await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});await p.waitForFunction(()=>window.__tm?.scene?.getObjectByName('citadel-front-harbor'),null,{timeout:180000});
await p.evaluate(()=>{window.__tm.P.daySpeed=0;window.__tm.P.timeOfDay=.85;});await p.waitForTimeout(1500);
const data=await p.evaluate(()=>{const t=window.__tm,T=t.THREE,ls=[];t.scene.traverse(o=>{if(o.isLight)ls.push({name:o.name,type:o.type,color:o.color.getHexString(),intensity:o.intensity,position:o.getWorldPosition(new T.Vector3()).toArray(),target:o.target?.getWorldPosition(new T.Vector3()).toArray(),ground:o.groundColor?.getHexString()});});return {lights:ls,phase:t.P.timeOfDay};});await writeFile(new URL('../citadel-terrain-render/web-light-audit.json',out),JSON.stringify(data,null,2));console.log(JSON.stringify(data.lights.filter(x=>['DirectionalLight','HemisphereLight','AmbientLight'].includes(x.type))));
}finally{await b.close();}
