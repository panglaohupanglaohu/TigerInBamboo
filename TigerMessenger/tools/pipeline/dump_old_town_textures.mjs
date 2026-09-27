// Dump old-town facade textures (after recolour) to PNG for inspection.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile,mkdir} from 'node:fs/promises';
const out='TigerMessenger/artifacts/pipeline/old-town-platform/textures/';await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{const p=await b.newPage();await p.goto('http://localhost:8931/TigerMessenger/?autostart=1'+(process.argv[2]||''),{waitUntil:'domcontentloaded'});
await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:240000});await p.waitForTimeout(2000);
const r=await p.evaluate(()=>{const t=window.__tm;const seen=new Map();t.scene.getObjectByName('castleContainer').traverse(o=>{if(!o.isMesh||!/town-terrace/.test(o.parent?.name||''))return;for(const m of (Array.isArray(o.material)?o.material:[o.material])){const mp=m?.map;if(mp&&!seen.has(mp)){const im=mp.image;let url=null;if(im?.toDataURL)url=im.toDataURL();else if(im){const c=document.createElement('canvas');c.width=im.width;c.height=im.height;c.getContext('2d').drawImage(im,0,0);url=c.toDataURL();}seen.set(mp,url);}}});return [...seen.values()].slice(0,6);});
for(const [i,u] of r.entries())if(u)await writeFile(`${out}tex-${i}${process.argv[3]||''}.png`,Buffer.from(u.split(',')[1],'base64'));
console.log('textures',r.length);}finally{await b.close();}
