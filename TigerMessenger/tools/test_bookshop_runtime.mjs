import assert from 'node:assert/strict';
import {writeFile,mkdir} from 'node:fs/promises';
import {chromium} from '../../tools/shot/node_modules/playwright/index.mjs';
const output=new URL('../assets/models/optimized/verification/',import.meta.url);
await mkdir(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 const page=await browser.newPage();
 await page.goto(`${process.env.TM_TEST_URL || 'http://127.0.0.1:8767/TigerMessenger/'}tools/originals/capture.html`);
 await page.waitForFunction(()=>window.ready);
 const report=await page.evaluate(async()=>{
  const THREE=await import('three');
  const {createHardToFindBookshop}=await import('../../src/assets/bookshop.js');
  const {applyOptimizedBookshopGeometry}=await import('../../src/assets/bookshopGeometry.js');
  const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});
  renderer.setSize(720,720);renderer.shadowMap.enabled=true;
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xc9d9e3);
  scene.add(new THREE.HemisphereLight(0xffffff,0x676454,2));
  const sun=new THREE.DirectionalLight(0xfff1dc,3);sun.position.set(-8,15,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;scene.add(sun);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshToonMaterial({color:0x819477}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
  const camera=new THREE.PerspectiveCamera(35,1,.1,100);camera.position.set(12,9,19);camera.lookAt(0,3.3,0);
  const before=createHardToFindBookshop({optimizedGeometry:false,artGeometry:false});
  const nodes=[];before.traverse(n=>nodes.push({node:n,material:n.material}));
  const render=()=>{renderer.render(scene,camera);const gl=renderer.getContext(),pixels=new Uint8Array(720*720*4);gl.readPixels(0,0,720,720,gl.RGBA,gl.UNSIGNED_BYTE,pixels);return {pixels,png:renderer.domElement.toDataURL('image/png')};};
  scene.add(before);const a=render();const applied=applyOptimizedBookshopGeometry(before);const b=render();
  let changedBytes=0;for(let i=0;i<a.pixels.length;i++)if(a.pixels[i]!==b.pixels[i])changedBytes++;
  const identityPreserved=nodes.every(({node,material})=>node.material===material && node.parent);
  const sign=before.userData.signNamePlane,oldMap=sign.material.map;
  before.userData.setSignText('TIGER MESSENGER','原作书店');
  const c=render();const signEditable=sign===before.userData.signNamePlane && sign.material.map!==oldMap && before.userData.signLine2==='原作书店' && c.png!==b.png;
  const variant=createHardToFindBookshop({bermEdgeY:-.4});
  const variantFallback=!variant.userData.blenderGeometry;
  const mismatched=createHardToFindBookshop({optimizedGeometry:false,artGeometry:false});const originalGeos=[];mismatched.traverse(n=>originalGeos.push(n.geometry));mismatched.children.at(-1).name='modified-sign';
  const rejected=!applyOptimizedBookshopGeometry(mismatched);const actualGeos=[];mismatched.traverse(n=>actualGeos.push(n.geometry));
  return {applied,changedBytes,identityPreserved,signEditable,variantFallback,atomicFallback:rejected&&originalGeos.every((g,i)=>g===actualGeos[i]),stats:before.userData.blenderGeometry,before:a.png,after:b.png,edited:c.png};
 });
 for(const key of ['before','after','edited']){await writeFile(new URL(`bookshop-web-${key}.png`,output),Buffer.from(report[key].split(',')[1],'base64'));delete report[key];}
 await writeFile(new URL('bookshop-web-comparison.json',output),JSON.stringify(report,null,2));
 assert(report.applied);assert.equal(report.changedBytes,0);assert(report.identityPreserved);assert(report.signEditable);assert(report.variantFallback);assert(report.atomicFallback);
 console.log('BOOKSHOP_WEB_PARITY_OK',JSON.stringify(report));
}finally{await browser.close();}
