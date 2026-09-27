import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
const page=await browser.newPage({viewport:{width:1440,height:960}});await page.addInitScript(()=>{const raf=requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);});
await page.goto('http://localhost:8931/TigerMessenger/?autostart=1');await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.canalJunctionCitadel,null,{timeout:180000});
const result=await page.evaluate(async()=>{
 const t=window.__tm,T=t.THREE,old=t.messenger.landmarks.canalJunctionCitadel;
 const {buildCitadelTownAssembly}=await import('/TigerMessenger/src/world/odysseyCitadel.js');
 const base=await(await fetch('/TigerMessenger/assets/models/optimized/canal-junction/foundation.json')).json();
 const root=new T.Group();root.name='canal-junction-target-v1';root.position.copy(old.position);root.quaternion.copy(old.quaternion);t.scene.add(root);old.visible=false;
 for(const p of base.parts){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p.positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(p.normals,3));const o=new T.Mesh(g,new T.MeshStandardMaterial({color:new T.Color(...p.color),roughness:1,flatShading:true}));o.name=p.name;root.add(o);}
 const stats=[];let seed=711;
 for(const [name,x,y,z,w,d,h,color] of base.regions){
  const cols=Math.max(1,Math.round(w/1.6)),rows=Math.max(1,Math.round(d/1.6)),floors=Math.max(2,Math.round(h/1.7));
  const ch={coral:'D',teal:'C',yellow:'3',cream:'0'}[color];
  const levels=Array.from({length:floors},()=>Array.from({length:rows},()=>ch.repeat(cols)));
  // Supported upper setback: front row becomes an open roof terrace, not a full-height slab.
  const terraceStart=(!name.includes('tower')&&name!=='rear-keep')?floors-1:null;
  if(terraceStart!==null)for(let k=terraceStart;k<floors;k++)levels[k][rows-1]='.'.repeat(cols);
  // Keep a true walk-through doorway in the central rear keep at two lowest levels.
  if(name==='rear-keep')for(let k=0;k<2;k++)for(let j=0;j<rows;j++){const a=[...levels[k][j]];a[Math.floor(cols/2)]='.';if(cols>3)a[Math.floor(cols/2)-1]='.';levels[k][j]=a.join('');}
  const cache={};const town=buildCitadelTownAssembly({cellSize:1.6,cellHeight:1.7,levels},{baseY:z,wfcTownV1:true,wfcSeed:seed++,townCtxCache:cache,townscaperColors:true,leanDecor:true});
  for(const child of town.levels)child.position.z=0;
  town.group.position.set(x,0,-y);town.group.name=name;root.add(town.group);
  stats.push({name,stats:town.stats,wfc:cache.wfcTownSelection?.value?.ok??null});
 }
 root.updateWorldMatrix(true,true);const inv=root.matrixWorld.clone().invert(),parts=[];
 root.traverse(o=>{if(!o.isMesh)return;const geo=o.geometry.index?o.geometry.toNonIndexed():o.geometry;const a=geo.attributes.position,n=geo.attributes.normal;if(!a||!n)return;const m=new T.Matrix4(),v=new T.Vector3(),normal=new T.Vector3();
 for(let instance=0;instance<(o.isInstancedMesh?o.count:1);instance++){
  m.copy(o.matrixWorld);if(o.isInstancedMesh){const im=new T.Matrix4();o.getMatrixAt(instance,im);m.multiply(im);}m.premultiply(inv);const nm=new T.Matrix3().getNormalMatrix(m);
  const mats=Array.isArray(o.material)?o.material:[o.material];const groups=geo.groups.length?geo.groups:[{start:0,count:a.count,materialIndex:0}];
  for(const group of groups){const mat=mats[group.materialIndex||0];if(!mat||mat.visible===false||mat.opacity===0)continue;const positions=[],normals=[];for(let i=group.start;i<Math.min(a.count,group.start+group.count);i++){v.fromBufferAttribute(a,i).applyMatrix4(m);positions.push(...v.toArray());normal.fromBufferAttribute(n,i).applyMatrix3(nm).normalize();normals.push(...normal.toArray());}parts.push({region:(()=>{let q=o;while(q&&q.parent!==root)q=q.parent;return q?.name;})(),name:o.name,color:mat.color?.toArray()||[.5,.5,.5],positions,normals});}
 }
 });
 t.camera.position.copy(root.localToWorld(new T.Vector3(40,35,50)));t.camera.up.set(0,1,0).transformDirection(root.matrixWorld);t.camera.lookAt(root.localToWorld(new T.Vector3(0,9,0)));t.camera.fov=48;t.camera.updateProjectionMatrix();t.P.timeOfDay=.68;t.dayNight.update(0);t.lightingDirector.update(0,{timeOfDay:.68,weather:0});t.distanceCulling?.update(1);old.visible=false;t.renderer.render(t.scene,t.camera);
 return {parts,stats,image:t.renderer.domElement.toDataURL('image/png')};
});
await writeFile('TigerMessenger/artifacts/pipeline/canal-junction-target/modules-v1.png',Buffer.from(result.image.split(',')[1],'base64'));delete result.image;
await writeFile('TigerMessenger/assets/models/optimized/canal-junction/modules-source.json',JSON.stringify(result));console.log(JSON.stringify({parts:result.parts.length,wfc:result.stats.map(s=>({name:s.name,wfc:s.wfc}))}));
}finally{await browser.close();}
