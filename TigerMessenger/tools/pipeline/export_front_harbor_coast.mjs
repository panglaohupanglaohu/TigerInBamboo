import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
const dir=new URL('../../assets/models/optimized/citadel-front-coast/',import.meta.url);await mkdir(dir,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage();await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});await page.waitForFunction(()=>window.__tm?.scene.getObjectByName('castleContainer')?.userData.masterTerrainCandidate?.status==='ready',null,{timeout:180000});
 const data=await page.evaluate(()=>{const t=window.__tm,T=t.THREE,city=t.scene.getObjectByName('highland-west-city');t.scene.updateMatrixWorld(true);const counts={},parts=[];
 t.scene.traverse(o=>{if(!o.isMesh||!['planet-surface','hills','hills-closed-skirt','camp-flat-patch'].includes(o.name))return;
 const ordinal=counts[o.name]??0;counts[o.name]=ordinal+1;
 parts.push({name:o.name,ordinal,positions:Array.from(o.geometry.attributes.position.array),colors:o.geometry.attributes.color?Array.from(o.geometry.attributes.color.array):null,indices:o.geometry.index?Array.from(o.geometry.index.array):null,matrix:o.matrixWorld.toArray(),color:o.material.color?.toArray()??[.3,.3,.3]});});
 return {frame:'Three world, Y up',cityMatrix:city.matrixWorld.toArray(),parts,basin:{center:[60,125],radii:[27,23],inner:.64,seabedRadius:157.8},scope:'Only original hills and camp decorative ground geometry; no NPC, building, quay or pathway transforms.'};});
 if(process.argv.includes('--append-bed')){const previous=JSON.parse(await readFile(new URL('source.json',dir),'utf8'));previous.parts=previous.parts.filter(p=>p.name!=='planet-surface');previous.parts.push(data.parts.find(p=>p.name==='planet-surface'));await writeFile(new URL('source.json',dir),JSON.stringify(previous));}
 else await writeFile(new URL('source.json',dir),JSON.stringify(data));console.log(JSON.stringify(data.parts.map(p=>({name:p.name,ordinal:p.ordinal,vertices:p.positions.length/3}))));
}finally{await browser.close();}
