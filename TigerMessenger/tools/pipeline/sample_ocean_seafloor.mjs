import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage();await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});await page.waitForFunction(()=>window.__tm?.messenger,null,{timeout:180000});
 const result=await page.evaluate(async()=>{
  const {createStaticMeshRaycast}=await import('/TigerMessenger/src/world/staticMeshRaycast.js');const t=window.__tm,T=t.THREE,water=t.scene.getObjectByName('planet-v8-curved-ocean'),bed=t.scene.getObjectByName('planet-surface');t.scene.updateMatrixWorld(true);
  const cast=createStaticMeshRaycast(water),ray=new T.Ray(),reference=new T.Raycaster(),a=bed.geometry.attributes.position,p=new T.Vector3(),cache=new Map(),waterLevels=[];reference.layers.enableAll();let verified=0,error=0,wet=0,dry=0,missing=0,minGap=Infinity;
  for(let i=0;i<a.count;i++){
   p.fromBufferAttribute(a,i).applyMatrix4(bed.matrixWorld);const radius=p.length(),d=p.clone().normalize(),key=d.toArray().map(v=>v.toFixed(6)).join(',');
   if(!cache.has(key)){ray.set(d.clone().multiplyScalar(250),d.clone().negate());const hit=cast.firstHit(ray,250);cache.set(key,hit?.point.length()??null);
    if(verified<256){reference.set(ray.origin,ray.direction);reference.far=250;const brute=reference.intersectObject(water,false)[0];if(!!hit!==!!brute)error=Infinity;else if(hit)error=Math.max(error,hit.point.distanceTo(brute.point));verified++;}
   }
   const level=cache.get(key);waterLevels.push(level);if(level===null)missing++;else{const gap=level-radius;minGap=Math.min(minGap,gap);if(gap>.15)wet++;else dry++;}
  }
  for(let i=0;i<256;i++){
   const y=1-2*(i+.5)/256,angle=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-y*y),d=new T.Vector3(Math.cos(angle)*r,y,Math.sin(angle)*r);ray.set(d.clone().multiplyScalar(250),d.clone().negate());const hit=cast.firstHit(ray,250);reference.set(ray.origin,ray.direction);reference.far=250;const brute=reference.intersectObject(water,false)[0];if(!!hit!==!!brute)error=Infinity;else if(hit)error=Math.max(error,hit.point.distanceTo(brute.point));verified++;
  }
  return {vertices:a.count,uniqueDirections:cache.size,verified,error,wet,dry,missing,minGap,waterLevels,scope:'Per-vertex actual radial ocean surface; null or dry vertices are protected. Accelerated sampling checked against Three Raycaster.'};
 });
 await writeFile(new URL('../../assets/models/optimized/citadel-front-coast/ocean-seafloor-samples.json',import.meta.url),JSON.stringify(result));console.log(JSON.stringify({...result,waterLevels:undefined}));if(result.error>.0001)process.exitCode=1;
}finally{await browser.close();}
