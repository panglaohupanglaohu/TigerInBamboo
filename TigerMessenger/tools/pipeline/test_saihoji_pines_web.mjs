import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const base=process.env.PINE_TEST_BASE_URL||'http://127.0.0.1:8765/TigerMessenger';
const output=path.join(root,'artifacts/pipeline/saihoji-pines-web');
await mkdir(output,{recursive:true});
const manifest=JSON.parse(await readFile(path.join(root,'assets/models/optimized/saihoji-pines-v1/manifest.json'),'utf8'));
const sourceHashes=[];
for(const s of manifest.seeds){const raw=await readFile(path.join(root,s.lods[0].glb));sourceHashes.push({seed:s.seed,unchanged:createHash('sha256').update(raw).digest('hex')===s.lods[0].sha256});}
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:900,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/pine-fixture.html',r=>r.fulfill({contentType:'text/html',body:`<style>body{margin:0}</style><script type="importmap">{"imports":{"three":"${base}/vendor/three.module.js"}}</script>`}));
 await page.goto(base+'/pine-fixture.html');
 const report=await page.evaluate(async(base)=>{
  const T=await import('three'),P=await import(base+'/src/assets/saihojiPineOptimized.js'),A=await import(base+'/src/assets/ancient.js');
  const checks=[],trees=[];const check=(name,pass,detail)=>checks.push({name,passed:!!pass,detail});
  const all=n=>{const a=[];n.traverse(x=>a.push(x));return a;};
  for(const seed of P.SAIHOJI_PINE_SEEDS){
   const tree=P.createOptimizedSaihojiPine(seed),old=A.createAncientPineTree(seed),ns=all(tree),meshes=ns.filter(n=>n.isMesh);tree.updateMatrixWorld(true);
   const qerror=1-Math.abs(tree.quaternion.dot(old.quaternion)),serror=tree.scale.distanceTo(old.scale);
   const finite=ns.every(n=>n.matrixWorld.elements.every(Number.isFinite))&&meshes.every(n=>Object.values(n.geometry.attributes).every(a=>a.array.every(Number.isFinite)));
   const triangleCount=meshes.reduce((s,m)=>s+m.geometry.index.count/3,0);
   const bounds=P.getOptimizedSaihojiPineBounds(seed);
   const colors=meshes.every((m,i)=>m.material.color.getHexString()===P.SAIHOJI_PINE_PALETTE[i].slice(1));
   check(`seed ${seed}: 17 nodes, 5 GLB meshes, finite, factory root and target palette`,ns.length===17&&meshes.length===5&&finite&&qerror<1e-7&&serror<1e-7&&colors,{qerror,serror,triangleCount});
   trees.push({seed,bounds,source:tree.userData.pineOptimization});
  }
  const a=P.createOptimizedSaihojiPine(811),b=P.createOptimizedSaihojiPine(811);
  check('clones share buffers without sharing transforms',a.children[7].geometry===b.children[7].geometry&&a!==b&&a.children[7]!==b.children[7]);
  let rejected=false;try{P.createOptimizedSaihojiPine(999999);}catch{rejected=true;}check('unknown seed rejected instead of generic substitution',rejected);
  const scene=new T.Scene();scene.background=new T.Color('#929aa0');
  const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(900,900);renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;document.body.appendChild(renderer.domElement);
  scene.add(new T.HemisphereLight(0xffffff,0x62615c,2));const sun=new T.DirectionalLight(0xfff0d6,2.1);sun.position.set(-3,7,5);scene.add(sun);
  const floor=new T.Mesh(new T.PlaneGeometry(200,200),new T.MeshLambertMaterial({color:0x858d92}));floor.rotation.x=-Math.PI/2;floor.position.y=-.08;scene.add(floor);
  const camera=new T.PerspectiveCamera(34,1,.1,100);camera.position.set(8,5,11);camera.lookAt(.1,2.6,0);
  let current;
  window.pineReview=(version)=>{
   if(current)scene.remove(current);
   current=version==='original'?A.createAncientPineTree(811):P.createOptimizedSaihojiPine(811);
   if(version==='candidate-source-palette')current.traverse(n=>{if(n.isMesh){n.material=n.material.clone();n.material.color.fromArray(n.material.userData.sourceLinear);}});
   current.rotation.y=0;current.scale.setScalar(1.02);scene.add(current);renderer.render(scene,camera);
   return {version,triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,camera:camera.position.toArray(),target:[.1,2.6,0]};
  };
  return {checks,trees,scope:'Actual unchanged Blender LOD0 geometry; independent Web target palette. Same camera/light factory review, not full game acceptance.'};
 },base);
 report.captures=[];
 for(const version of ['original','candidate-source-palette','candidate-target-palette']){report.captures.push(await page.evaluate(v=>window.pineReview(v),version));await page.screenshot({path:path.join(output,version+'.png')});}
 report.checks.push({name:'all 25 source GLBs unchanged',passed:sourceHashes.every(s=>s.unchanged),detail:sourceHashes});
 report.checks.push({name:'browser page errors absent',passed:errors.length===0,detail:errors});
 report.passed=report.checks.every(c=>c.passed);
 await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({passed:report.passed,checks:report.checks.length,trees:report.trees.length,bounds:report.trees[0].bounds,failed:report.checks.filter(c=>!c.passed)}));
 if(!report.passed)process.exitCode=1;
}finally{await browser.close();}
