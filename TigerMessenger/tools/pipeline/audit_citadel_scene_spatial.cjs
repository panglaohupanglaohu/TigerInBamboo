const {chromium}=require('../../../tools/e2e/node_modules/playwright-core');
const fs=require('fs'),path=require('path');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});try{
 const p=await browser.newPage();await p.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await p.goto('http://localhost:8931/TigerMessenger/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.__tm?.messenger,null,{timeout:180000});
 const report=await p.evaluate(async()=>{
 const T=await import('three');let castle;const scene=window.__tm.scene;scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)castle=o;});scene.updateMatrixWorld(true);
 const objects=[];scene.traverse(o=>{if(!o.isGroup||!/tree|pine|harbor|navona/i.test(o.name))return;const b=new T.Box3().setFromObject(o);if(b.isEmpty())return;const center=castle.worldToLocal(b.getCenter(new T.Vector3()));if(center.distanceTo(new T.Vector3(8,10,40))>120)return;objects.push({name:o.name,parent:o.parent?.name,position:castle.worldToLocal(o.getWorldPosition(new T.Vector3())).toArray(),center:center.toArray(),size:b.getSize(new T.Vector3()).toArray(),visible:o.visible,role:o.userData.designRole});});
 const waters=[];scene.traverse(o=>{if(o.isMesh&&/ocean|sea|water/i.test(o.name)&&!o.userData.isOutline)waters.push({name:o.name,parent:o.parent?.name,geometry:o.geometry.type,radius:o.geometry.parameters?.radius,scale:o.getWorldScale(new T.Vector3()).toArray(),position:o.getWorldPosition(new T.Vector3()).toArray()});});
 const quay=castle.getObjectByName('west-city-harbor-quay');return {objects,waters:waters.slice(0,50),castleOrigin:castle.getWorldPosition(new T.Vector3()).toArray(),quayWorld:quay.getWorldPosition(new T.Vector3()).toArray(),quayRadius:quay.getWorldPosition(new T.Vector3()).length(),passed:true};
 });
 const out=path.resolve(__dirname,'../../artifacts/pipeline/citadel-plaza-horse');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(out+'/web-spatial-audit.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
