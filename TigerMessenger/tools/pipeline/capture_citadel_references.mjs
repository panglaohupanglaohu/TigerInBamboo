// Read-only reference capture from the real default world; no scene factories,
// source changes, localStorage writes or isolated replacement towers.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
const out=fileURLToPath(new URL('../../artifacts/pipeline/citadel/reference/',import.meta.url));
const url='http://127.0.0.1:8767/TigerMessenger/';
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1080},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 await page.goto(url,{timeout:120000,waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__tm?.messenger?.landmarks?.odysseyCitadel,{timeout:180000});
 const result=await page.evaluate(()=>{
  const tm=window.__tm,T=tm.THREE,root=tm.messenger.landmarks.odysseyCitadel;
  root.updateMatrixWorld(true);const inv=root.matrixWorld.clone().invert();
  const localBox=o=>{const b=new T.Box3();o.traverse(n=>{if(!n.isMesh||!n.geometry)return;
    n.geometry.computeBoundingBox();const mat=new T.Matrix4().multiplyMatrices(inv,n.matrixWorld);
    if(n.isInstancedMesh){const inst=new T.Matrix4();for(let i=0;i<n.count;i++){n.getMatrixAt(i,inst);b.union(n.geometry.boundingBox.clone().applyMatrix4(new T.Matrix4().multiplyMatrices(mat,inst)));}}
    else b.union(n.geometry.boundingBox.clone().applyMatrix4(mat));});return b;};
  const row=o=>{const b=localBox(o);return {name:o.name,type:o.type,visible:o.visible,children:o.children.length,localBounds:b.isEmpty()?null:{min:b.min.toArray(),max:b.max.toArray()},userDataKeys:Object.keys(o.userData)}};
  const assembly=root.getObjectByName('odyssey-citadel-mountain-valley-assembly');
  if(!assembly||root.userData.highlandLatestDesign!==true)throw Error('Expected real default continuous mountain-valley citadel');
  const town=new T.Box3();for(const layer of root.userData.layers||[])town.union(localBox(layer));
  if(town.isEmpty())throw Error('Real town layers have no geometry');
  const center=town.getCenter(new T.Vector3()),size=town.getSize(new T.Vector3());
  const span=Math.max(size.x,size.z,60),centerArray=center.toArray();
  const details=[];assembly.traverse(o=>{if(!o.isMesh||!/door|gate|arch|window/i.test(o.name))return;const b=localBox(o),s=b.getSize(new T.Vector3());if(!b.isEmpty()&&Math.max(s.x,s.y,s.z)<12&&Math.max(s.x,s.y,s.z)>.3)details.push({object:o,box:b});});
  details.sort((a,b)=>b.box.max.z-a.box.max.z);
  const detail=details[0];
  const nearTarget=new T.Vector3(center.x,center.y,center.z+size.z*.28);
  const detailTarget=detail?detail.box.getCenter(new T.Vector3()):nearTarget.clone();
  const ds=detail?Math.max(detail.box.getSize(new T.Vector3()).length(),4):12;
  const views=[
   {id:'01-overview',label:'完整默认圣城全景',target:center.clone(),position:center.clone().add(new T.Vector3(span*.62,span*.65,span*1.15)),fov:48,selection:'Actual town layer bounds inside full mountain-valley assembly'},
   {id:'02-buildings',label:'圣城建筑群近景',target:nearTarget,position:nearTarget.clone().add(new T.Vector3(span*.20,span*.17,span*.40)),fov:48,selection:'Front quarter of actual town layer bounds'},
   {id:'03-architectural-detail',label:'建筑细节（未验证可通行入口）',target:detailTarget,position:detailTarget.clone().add(new T.Vector3(ds*.7,ds*.45,ds*1.8)),fov:48,selection:detail?`Actual named object: ${detail.object.name}`:'No reliable small named entrance object; town frontage detail',walkabilityVerified:false}
  ];
  const captures=[];for(const v of views){
   const camera=tm.camera.clone();camera.fov=v.fov;camera.aspect=1440/1080;camera.near=.1;camera.far=2500;
   camera.position.copy(root.localToWorld(v.position.clone()));camera.up.set(0,1,0).transformDirection(root.matrixWorld);camera.lookAt(root.localToWorld(v.target.clone()));camera.updateProjectionMatrix();camera.updateMatrixWorld(true);
   // Render the existing full scene once with a temporary inspection camera.
   // No visibility, materials, geometry, lights, feature flags or game state are edited.
   tm.renderer.render(tm.scene,camera);
   captures.push({id:v.id,label:v.label,selection:v.selection,walkabilityVerified:v.walkabilityVerified??false,camera:{localPosition:v.position.toArray(),localTarget:v.target.toArray(),worldPosition:camera.position.toArray(),worldTarget:root.localToWorld(v.target.clone()).toArray(),up:camera.up.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,near:camera.near,far:camera.far,aspect:camera.aspect},image:tm.renderer.domElement.toDataURL('image/png'),renderInfo:{...tm.renderer.info.render}});
  }
  const rootMeshes=[];root.traverse(o=>{if(o.isMesh)rootMeshes.push({name:o.name,visible:o.visible})});
  return {url:location.href,featureFlags:tm.FEATURES,parameters:{irregularGridV1:tm.P.irregularGridV1,wfcTownV1:tm.P.wfcTownV1},root:row(root),rootTransform:{position:root.position.toArray(),quaternion:root.quaternion.toArray(),scale:root.scale.toArray()},townBounds:{min:town.min.toArray(),max:town.max.toArray(),center:centerArray},assembly:row(assembly),assemblyChildren:assembly.children.map(row),rootChildren:root.children.map(row),meshCount:rootMeshes.length,hiddenMeshCount:rootMeshes.filter(m=>!m.visible).length,design:{highlandLatestDesign:root.userData.highlandLatestDesign,version:root.userData.highlandLatestDesignVersion,v4RuntimeSuppressed:root.userData.v4RuntimeSuppressed,instanceId:root.userData.instanceId},captures,canvas:{width:tm.renderer.domElement.width,height:tm.renderer.domElement.height},localStorageKeys:Object.keys(localStorage),note:'Fresh isolated browser context with default world; no user profile/storage accessed. Full live scene directly rendered with temporary cameras using existing renderer. No overlay UI/postprocessing pass is captured; no culling or visibility overrides. Third view is architectural detail, not passage validation.'};
 });
 for(const capture of result.captures){const bytes=Buffer.from(capture.image.split(',')[1],'base64');delete capture.image;capture.file=`${capture.id}.png`;capture.sha256=createHash('sha256').update(bytes).digest('hex');await writeFile(out+capture.file,bytes);}
 result.capturedAt=new Date().toISOString();result.pageErrors=errors;
 await writeFile(out+'manifest.json',JSON.stringify(result,null,2)+'\n');
 await writeFile(out+'README.md',`# 原圣城参考截图\n\n来源：${url} 的实际 __tm.messenger.landmarks.odysseyCitadel。完整默认世界，独立无用户数据浏览器上下文；没有调用单独塔楼或五台地展示工厂，没有修改源码或用户 localStorage。\n\n保留原场景、原材质、灯光和可见性。通过临时相机直接绘制完整 scene，截图不含 UI 与额外后处理，时间和运行时剔除状态未固定。此批是原作观察参考，不能当成确定性视觉回归或玩法验证。\n\n- 01-overview.png：真实圣城建筑占用范围确定的全景。\n- 02-buildings.png：实际建筑群近景。\n- 03-architectural-detail.png：命名建筑对象或街区前缘细节；未证实人高入口及可走通道。\n\n相机局部/世界坐标、实际 feature flags、源对象结构、画面 hash 和运行时错误见 manifest.json。\n`);
 console.log(JSON.stringify({output:out,meshCount:result.meshCount,hiddenMeshCount:result.hiddenMeshCount,townBounds:result.townBounds,views:result.captures.map(c=>({id:c.id,selection:c.selection,camera:c.camera.localPosition})),errors},null,2));
}finally{await browser.close();}
