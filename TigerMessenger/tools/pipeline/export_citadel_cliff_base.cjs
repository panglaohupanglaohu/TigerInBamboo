const {chromium}=require('../../../tools/e2e/node_modules/playwright-core');
const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});try{
 const p=await b.newPage();
 // Export a clean terrain baseline: do not bake the previous sparse delta twice.
 await p.route('**/citadel/cliffBlenderRefinement.js*',r=>r.fulfill({contentType:'application/javascript',body:'export function applyCliffBlenderRefinement(){}'}));
 await p.goto('http://localhost:8931/TigerMessenger/?autostart=1');
 await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-west-city'),null,{timeout:180000});
 const data=await p.evaluate(async()=>{
  const T=await import('three');let castle;window.__tm.scene.traverse(o=>{if(o.userData.highlandAssaultAnchors)castle=o;});
  castle.updateMatrixWorld(true);const scene=new T.Scene();
  for(const name of ['citadel-oskar-grid-mountain-surface','highland-west-city']){
   const original=castle.getObjectByName(name),copy=original.clone(true);
   new T.Matrix4().multiplyMatrices(castle.matrixWorld.clone().invert(),original.matrixWorld).decompose(copy.position,copy.quaternion,copy.scale);scene.add(copy);
  }
  const {exportWorldGLB}=await import('/TigerMessenger/tools/world/export_world_glb.js');
  const result=exportWorldGLB(scene,T,{});window.__cliffBytes=result.bytes;
  return {bytes:result.bytes.length,terrainSource:'8931 live scene without prior Blender delta',scope:'Current mountain baseline plus current new-city reference geometry'};
 });
 const version=process.env.CITADEL_CLIFF_BASE_VERSION||'v2';
 if(!/^v\d+$/.test(version))throw Error('Invalid baseline version');
 const target=`TigerMessenger/assets/models/optimized/citadel-cliff/citadel-cliff-input-${version}.glb`;const fd=fs.openSync(target,'w');
 try{for(let i=0;i<data.bytes;i+=1048576){const s=await p.evaluate(i=>{const a=window.__cliffBytes.subarray(i,i+1048576);let s='';for(let k=0;k<a.length;k+=8192)s+=String.fromCharCode(...a.subarray(k,k+8192));return btoa(s)},i);fs.writeSync(fd,Buffer.from(s,'base64'));}}finally{fs.closeSync(fd)}
 fs.writeFileSync(`TigerMessenger/artifacts/pipeline/citadel-cliff-blender/input-${version}.json`,JSON.stringify(data,null,2));console.log(data);
}finally{await b.close();}})().catch(e=>{console.error(e);process.exit(1)});
