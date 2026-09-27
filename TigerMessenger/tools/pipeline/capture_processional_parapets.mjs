import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const out=new URL('../../artifacts/pipeline/citadel-master-terrain/',import.meta.url);
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await b.newPage({viewport:{width:1600,height:1000}});
 await p.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});
 await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('citadel-processional-parapets-2'),null,{timeout:180000});
 const report=await p.evaluate(async(afterOnly)=>{
  const t=window.__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer'),city=c.getObjectByName('highland-west-city');
  t.P.timeOfDay=.5;t.P.daySpeed=0;t.cameraRig.update=()=>{};
  t.camera.position.copy(city.localToWorld(new T.Vector3(39,26,65)));t.camera.up.set(0,1,0).transformDirection(city.matrixWorld);
  t.camera.lookAt(city.localToWorld(new T.Vector3(60,12,37)));t.camera.updateProjectionMatrix();
  const groups=[1,2].map(i=>city.getObjectByName('citadel-processional-parapets-'+i));
  const data={images:{},groups:groups.map(g=>({name:g.name,position:g.position.toArray(),clearWidth:g.userData.clearWidth,triangles:g.children.reduce((n,m)=>n+m.geometry.attributes.position.count/3,0)}))};
  for(const variant of (afterOnly?['after']:['before','after'])){
   groups.forEach(g=>g.visible=variant==='after');
   for(let i=0;i<50;i++)await new Promise(r=>requestAnimationFrame(r));
   t.renderer.render(t.scene,t.camera);data.images[variant]=t.renderer.domElement.toDataURL('image/png');
  }
  return data;
 },process.argv.includes('--after-only'));
 for(const [name,img]of Object.entries(report.images))await writeFile(new URL('parapets-'+name+'.png',out),Buffer.from(img.split(',')[1],'base64'));
 delete report.images;await writeFile(new URL('parapets.json',out),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await b.close();}
