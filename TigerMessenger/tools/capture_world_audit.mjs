import {chromium} from '../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 await page.goto('http://127.0.0.1:8767/TigerMessenger/?autostart=1',{timeout:120000});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.bookshop,null,{timeout:120000});
 const data=await page.evaluate(()=>{const t=window.__tm,T=t.THREE; t.scene.updateMatrixWorld(true);let meshes=0,triangles=0;const materialTypes={},roots=[];
 t.scene.traverseVisible(o=>{if(o.isMesh&&!o.userData.isOutline){meshes++;const g=o.geometry;triangles+=(g.index?.count||g.attributes.position?.count||0)/3*(o.isInstancedMesh?o.count:1);const m=Array.isArray(o.material)?o.material:[o.material];for(const a of m)materialTypes[a.type]=(materialTypes[a.type]||0)+1;}});
 for(const o of t.scene.children){const p=o.getWorldPosition(new T.Vector3());let n=0;o.traverseVisible(v=>{if(v.isMesh&&!v.userData.isOutline)n++;});roots.push({name:o.name,type:o.type,meshes:n,position:p.toArray(),visible:o.visible});}
 const landmarks={};for(const [k,v]of Object.entries(t.messenger.landmarks)){const o=v?.isObject3D?v:v?.group?.isObject3D?v.group:null;if(o)landmarks[k]={name:o.name,matrix:o.matrixWorld.toArray(),position:o.getWorldPosition(new T.Vector3()).toArray()};}
 return {meshes,triangles,materialTypes,roots,landmarks};});
 await mkdir('TigerMessenger/artifacts/world-migration',{recursive:true});await writeFile('TigerMessenger/artifacts/world-migration/source-audit.json',JSON.stringify(data,null,2));console.log(JSON.stringify(data));
}finally{await browser.close();}
