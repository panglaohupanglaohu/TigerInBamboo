import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {chromium} from '../../tools/shot/node_modules/playwright/index.mjs';
const output=new URL('../assets/models/optimized/verification/',import.meta.url);
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();
 await page.goto((process.env.TIGER_TEST_BASE_URL || 'http://127.0.0.1:8765/TigerMessenger')+'/tools/originals/capture.html');await page.waitForFunction(()=>window.ready);
 const report=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {createMoebiusTigerModel}=await import('../../src/assets/characters/moebiusTiger.js');
  const {applyOptimizedTigerGeometry}=await import('../../src/assets/tigerGeometry.js');
  const a=createMoebiusTigerModel(Math.random,{optimizedGeometry:false,anatomy:false}),b=createMoebiusTigerModel(Math.random,{optimizedGeometry:false,anatomy:false});
  const refs=[];b.traverse(n=>refs.push({node:n,material:n.material}));
  const update=b.userData.update,tail=b.userData.tailSegs;
  const applied=applyOptimizedTigerGeometry(b);
  const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(640,640);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xa6b5a8);
  scene.add(new THREE.HemisphereLight(0xffffff,0x6e7360,2));
  const sun=new THREE.DirectionalLight(0xfff4df,3);sun.position.set(4,8,6);scene.add(sun);
  const camera=new THREE.PerspectiveCamera(35,1,.1,50);camera.position.set(5,3,6);camera.lookAt(0,.8,0);
  function render(object){scene.add(object);renderer.render(scene,camera);const gl=renderer.getContext(),pixels=new Uint8Array(640*640*4);gl.readPixels(0,0,640,640,gl.RGBA,gl.UNSIGNED_BYTE,pixels);const png=renderer.domElement.toDataURL('image/png');scene.remove(object);return {pixels,png};}
  const poses=[];let preview;
  for(const [name,walking,drinking] of [['idle',false,false],['walking',true,false],['drinking',false,true]]){
   for(let frame=0;frame<30;frame++)for(const tiger of [a,b]){tiger.userData._walking=walking;tiger.userData._drinking=drinking;tiger.userData.update(1/60,frame/60);}
   const x=render(a),y=render(b);let changedBytes=0;
   for(let i=0;i<x.pixels.length;i++)if(x.pixels[i]!==y.pixels[i])changedBytes++;
   const matrices=o=>{o.updateMatrixWorld(true);const r=[];o.traverse(n=>r.push(...n.matrixWorld.elements));return r;};
   const am=matrices(a),bm=matrices(b);
   poses.push({name,changedBytes,transformsEqual:am.every((v,i)=>v===bm[i])});
   if(name==='walking')preview=y.png;
  }
  return {applied,poses,animationReferencesPreserved:update===b.userData.update&&tail===b.userData.tailSegs&&tail.length===8,materialsPreserved:refs.every(r=>r.material===r.node.material),stats:b.userData.blenderGeometry,preview};
 });
 await writeFile(new URL('tiger-web-walking.png',output),Buffer.from(report.preview.split(',')[1],'base64'));delete report.preview;
 await writeFile(new URL('tiger-web-comparison.json',output),JSON.stringify(report,null,2));
 assert(report.applied);assert(report.animationReferencesPreserved);assert(report.materialsPreserved);
 for(const p of report.poses){assert.equal(p.changedBytes,0,p.name);assert(p.transformsEqual);}
 console.log('TIGER_WEB_PARITY_OK',JSON.stringify(report));
}finally{await browser.close();}
