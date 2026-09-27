import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const page=await browser.newPage();await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
 await page.goto('http://localhost:8931/TigerMessenger/?autostart=1',{timeout:180000});await page.waitForFunction(()=>window.__tm?.messenger,null,{timeout:180000});
 const report=await page.evaluate(async()=>{
  const {createFisherBoat}=await import('/TigerMessenger/src/assets/harbor.js');
  const t=window.__tm,T=t.THREE,boat=createFisherBoat(),api=boat.userData.warshipV6,scale=1.7,offset=.25;
  const local=new T.Matrix4(),m=new T.Matrix4(),v=new T.Vector3(),rows=[];let minY=Infinity,maxRadius=0,total=0,invalidVertices=0;const invalidExamples=[];
  for(const frame of [...Array.from({length:120},(_,i)=>60+i*.5),180]){
   api.pose(Math.floor(frame),frame>=119&&frame<180?60:Math.ceil(frame),frame%1);api.render();boat.updateMatrixWorld(true);const inv=boat.matrixWorld.clone().invert();
   let lowest={y:Infinity},radial=0,vertices=0;
   boat.traverseVisible(mesh=>{if(!mesh.isMesh)return;const base=inv.clone().multiply(mesh.matrixWorld),a=mesh.geometry.attributes.position;
    for(let instance=0;instance<(mesh.isInstancedMesh?mesh.count:1);instance++){
     if(mesh.isInstancedMesh){mesh.getMatrixAt(instance,local);if(Math.abs(local.determinant())<1e-12)continue;m.copy(base).multiply(local);}else m.copy(base);
     for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).applyMatrix4(m).multiplyScalar(scale);vertices++;if(![v.x,v.y,v.z].every(Number.isFinite)){invalidVertices++;if(invalidExamples.length<8)invalidExamples.push({frame,mesh:mesh.name,material:mesh.material.name,instance,index:i,matrix:m.toArray(),raw:[a.getX(i),a.getY(i),a.getZ(i)]});continue;}if(v.y<lowest.y)lowest={y:v.y,point:v.toArray(),material:mesh.material.name,instanced:!!mesh.isInstancedMesh};radial=Math.max(radial,Math.hypot(v.x,v.z));}
    }
   });
   minY=Math.min(minY,lowest.y);maxRadius=Math.max(maxRadius,radial);total+=vertices;rows.push({frame,lowest,radius:radial,vertices});
  }
  return {invalidVertices,invalidExamples,source:api.source,sha256:api.sha256,boatScale:scale,waterlineRootOffset:offset,minimumLocalY:minY,requiredGeometricDraft:offset-minY,maxHorizontalRadius:maxRadius,samples:rows.length,verticesInspected:total,rows,scope:'Actual rendered vertices for saved rowing cycle 60..119.5 with 119→60 wrap at half-frame steps and resting frame180; full 26 crew. Conservative flat-water vertical draft, no waves, roll, grounding or collision certificate.'};
 });
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/warship-navigation-envelope.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,rows:undefined}));
}finally{await browser.close();}
