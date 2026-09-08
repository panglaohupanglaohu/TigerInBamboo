import {chromium} from '../../../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile,readFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=new URL('../',import.meta.url),base='http://127.0.0.1:8765/TigerMessenger/';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage();
 await page.route('**/blue-citadel-fixture.html',r=>r.fulfill({contentType:'text/html',body:'<script type="importmap">{"imports":{"three":"/TigerMessenger/vendor/three.module.js","three/addons/":"/TigerMessenger/vendor/jsm/"}}</script>'}));
 await page.route('**/wfcTownSelection.js',async r=>{const response=await r.fetch();let body=await response.text();body=body.replace('prototypes = TOWN_MODULE_PROTOTYPES,','prototypes = globalThis.__blueProfile ? TOWN_MODULE_PROTOTYPES.map(p => ({...p,weight:p.weight * (p.family === "terrace" ? 2.0 : p.builderKey === "hip" ? 1.4 : p.builderKey === "gable" ? 0.7 : 1)})) : TOWN_MODULE_PROTOTYPES,');await r.fulfill({response,body,contentType:'text/javascript'});});
 await page.goto(base+'blue-citadel-fixture.html');
 const report=await page.evaluate(async()=>{
  const T=await import('three'),M=await import('./src/world/odysseyCitadel.js'),{HIGHLAND_TOWNSCAPER_TOWN_SPEC:spec}=await import('./src/world/citadelTown.js'),{exportWorldGLB}=await import('./tools/world/export_world_glb.js');
  const build=(wfc,profile)=>{globalThis.__blueProfile=profile;let n=20260908;const prior=Math.random;Math.random=()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296;};try{return M.buildOdysseyCitadel({spec:structuredClone(spec),seed:20260808,wfcTownV1:wfc,wfcTopology:'legacy-faces',wfcSeed:37,latestDesign:true,place:false});}finally{Math.random=prior;}};
  const before=build(false,false),after=build(true,true);
  const layout=JSON.stringify(before.userData.townSpec);
  if(layout!==JSON.stringify(after.userData.townSpec)||!after.userData.townStats.wfcTown.ok)throw Error('Layout/WFC validation failed');
  const fingerprint=o=>{const rows=[];o?.traverse(n=>{if(!n.isMesh)return;rows.push([n.name,n.matrix.toArray(),Array.from(n.geometry.attributes.position.array)]);});return JSON.stringify(rows);};
  const preserved=fingerprint(before.userData.highlandLatestDesignRoot)===fingerprint(after.userData.highlandLatestDesignRoot);
  if(!preserved)throw Error('Original landmark assembly changed');
  const converted=new Set();
  function textures(object){if(object.userData.windowDarkMat)object.userData.windowDarkMat.name='CitadelWindowDark';if(object.userData.windowLitMat)object.userData.windowLitMat.name='CitadelWindowLit';object.traverse(o=>{for(const m of(Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){const t=m.map;if(!t?.isDataTexture||converted.has(t))continue;const {data,width,height}=t.image;if(!(data instanceof Uint8Array)||data.length!==width*height*4)continue;const c=document.createElement('canvas');c.width=width;c.height=height;const rgba=new Uint8ClampedArray(data),color=new T.Color();if(t.colorSpace===T.NoColorSpace)for(let i=0;i<rgba.length;i+=4){color.setRGB(data[i]/255,data[i+1]/255,data[i+2]/255).convertLinearToSRGB();rgba[i]=Math.round(color.r*255);rgba[i+1]=Math.round(color.g*255);rgba[i+2]=Math.round(color.b*255);}c.getContext('2d').putImageData(new ImageData(rgba,width,height),0,0);t.image=c;converted.add(t);}});}
  window.__exports={};const exports={};
  for(const [label,object]of[['original',before],['candidate',after]]){textures(object);object.updateMatrixWorld(true);const scene=new T.Scene();scene.add(object);const result=exportWorldGLB(scene,T,{});window.__exports[label]=result.bytes;exports[label]=result.manifest;}
  const terrain=after.userData.outerTerrainSystem;
  const terrainNames=[];terrain.traverse(n=>{if(n.isMesh)terrainNames.push({name:n.name,vertices:n.geometry.attributes.position.count});});
  const scene=new T.Scene();scene.add(terrain);const result=exportWorldGLB(scene,T,{});window.__exports.terrain=result.bytes;exports.terrain=result.manifest;
  const assignments=Object.entries(after.userData.townCtxCache?.terraces??{}).map(([id,v])=>({id,...v.wfcTownSelection?.value}));
  return {passed:true,layout:before.userData.townSpec,layoutPreserved:true,landmarkAssemblyPreserved:preserved,seed:20260808,wfcSeed:37,topology:'legacy-faces',profile:{terraceWeightMultiplier:2,hipWeightMultiplier:1.4,gableWeightMultiplier:.7},wfc:after.userData.townStats.wfcTown,assignments,exports,terrainNames,rootChildren:after.children.map(x=>x.name),scope:'Original factory with preserved occupancy and landmark assembly. WFC profile only in isolated browser module response; no live deployment or complete Townscaper edit/navigation acceptance.'};
 });
 for(const [id,manifest]of Object.entries(report.exports)){const pieces=[];for(let offset=0;offset<manifest.bytes;offset+=1048576){const b64=await page.evaluate(({id,offset})=>{const bytes=window.__exports[id].subarray(offset,offset+1048576);let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s);},{id,offset});pieces.push(Buffer.from(b64,'base64'));}const data=Buffer.concat(pieces);await writeFile(new URL('project/assets/'+id+'.glb',root),data);manifest.sha256=createHash('sha256').update(data).digest('hex');}
 await writeFile(new URL('export-report.json',root),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({passed:report.passed,wfc:report.wfc,terrain:report.terrainNames,rootChildren:report.rootChildren}));
}finally{await browser.close();}
