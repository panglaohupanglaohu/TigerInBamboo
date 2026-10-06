/** Manual developer inspection only. Never installs or moves the camera at boot. */
import {P} from '../core/params.js';
export function installTargetCityPresentation({THREE:T,castle,camera,cameraRig,renderer,runtime,scene,tramSystem=null}){
 const panel=document.createElement('section');panel.id='citadel-live-city';panel.style.cssText='position:fixed;right:16px;top:16px;z-index:200;background:#17343ce8;color:#f6f4e7;padding:12px;border-radius:12px;max-width:380px;font:14px system-ui';
 const title=document.createElement('strong');title.textContent='高山圣城';panel.append(title);
 const buttons=document.createElement('div');buttons.style.cssText='display:flex;gap:6px;margin-top:9px;flex-wrap:wrap';panel.append(buttons);
 const views={全景:[[0,68,220],[0,10,5],50],旧城:[[-20,37,55],[-55,27,9],46],新城:[[19,34,89],[71,21,34],45],广场:[[20,20,111],[63,10,68],46],临轨崖壁:[[143,14,133],[94,-18,86],49],旧城崖壁:[[-46,26,93],[-61,5,40],46]};
 const saved={fov:camera.fov,far:camera.far,zoom:camera.zoom};
 let eastPreview=null,eastPreviewSource=null,eastPreviewVisible=null,eastPreviewPending=false,previewEpoch=0,eastVegetationSurvey=null,vegetationSurveyPending=false,eastPlantingPreview=null;
 function clearEastPreview(){previewEpoch++;if(eastPlantingPreview){eastPlantingPreview.dispose();eastVegetationSurvey=JSON.parse(JSON.stringify(eastPlantingPreview.report));eastVegetationSurvey.restored=true;}eastPlantingPreview=null;if(eastPreviewSource)eastPreviewSource.visible=eastPreviewVisible;eastPreview?.dispose();eastPreview=null;eastPreviewSource=null;eastPreviewVisible=null;}
 function restore(){clearEastPreview();handle.active=false;camera.far=saved.far;camera.zoom=saved.zoom;cameraRig.setFov(cameraRig.getDefaultFov());camera.updateProjectionMatrix();cameraRig.snapToPlayer();panel.hidden=true;}
 const handle={active:false,view:'全景',open(){panel.hidden=false;},setView(name){const [p,q,fov]=views[name];handle.active=true;handle.view=name;castle.updateWorldMatrix(true,false);camera.position.copy(castle.localToWorld(new T.Vector3(...p)));camera.up.set(0,1,0).transformDirection(castle.matrixWorld);camera.lookAt(castle.localToWorld(new T.Vector3(...q)));camera.fov=fov;camera.zoom=1;camera.far=4000;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);},dispose(){restore();panel.remove();}};
 function button(name,action){const b=document.createElement('button');b.textContent=name;b.style.cssText='padding:5px 10px;border:1px solid #abc6ca;border-radius:5px;cursor:pointer';b.onclick=action;buttons.append(b);}
 for(const name of Object.keys(views))button(name,()=>handle.setView(name));
 button('恢复玩家镜头',restore);
 const details=document.createElement('details'),summary=document.createElement('summary'),out=document.createElement('pre');summary.textContent='加载状态';out.id='citadel-runtime-status';out.style.cssText='white-space:pre-wrap;font-size:11px;max-height:35vh;overflow:auto';details.append(summary,out);panel.append(details);
 // On-demand live positions; no seek/update/control mutation. Samples establish
 // motion and route binding only, never full-route collision acceptance.
 function liveTransport(){return {at:new Date().toISOString(),scope:'live poses only; no swept collision or full-loop acceptance',services:(tramSystem?.freightServices??[]).map(service=>{
  const p=service.curve.getPointAt(service.progress),t=service.curve.getTangentAt(service.progress).normalize().multiplyScalar(service.direction),right=p.clone().normalize().cross(t).normalize(),up=t.clone().cross(right).normalize(),expected=p.clone().addScaledVector(up,.12);
  return {variant:service.tram.userData.variant,progress:service.progress,direction:service.direction,dwell:service.dwell,trackLength:service.trackLen,curveShared:service.curve===tramSystem.curves?.[service.tram.userData.variant],expectedLocalPosition:expected.toArray(),localPosition:service.tram.position.toArray(),centreError:expected.distanceTo(service.tram.position),quaternion:service.tram.quaternion.toArray(),wagons:(service.wagons??[]).map(o=>({localPosition:o.position.toArray(),quaternion:o.quaternion.toArray()}))};
 })};}
 function state(){return{eastCliffVegetationSurvey:eastVegetationSurvey,eastCliffVisualPreview:eastPreview?{...eastPreview.report,active:true,scope:'render-only; original navigation, structures and trains retained; not gameplay acceptance'}:null,at:new Date().toISOString(),view:handle.view,timeOfDay:P.timeOfDay,daySpeed:P.daySpeed,installed:runtime.report.installed,lighting:{toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,lights:(()=>{const a=[];scene.traverseVisible(o=>{if(o.isLight&&o.visible&&(o.isAmbientLight||o.isDirectionalLight||o.isHemisphereLight))a.push({name:o.name,type:o.type,color:o.color.getHexString(),intensity:o.intensity});});return a;})()},oldCity:runtime.report.cityDetail?.oldCity?.geometry?.version,newMain:runtime.report.cityDetail?.newCity?.geometry,newStairs:runtime.report.cityDetail?.newCityStairs?.authored?.revision,bayWater:runtime.report.cityDetail?.bayWater,rock:runtime.report.cityDetail?.rockAppearance,clouds:runtime.report.cityDetail?.clouds?.version,cloudComposition:runtime.report.cityDetail?.clouds?.compositionVersion,cloudCount:runtime.report.cityDetail?.clouds?.count,cloudRailSampleCount:runtime.report.cityDetail?.clouds?.actualRailSampleCount??null,transitLinks:runtime.report.cityDetail?.cliffTransit?.newCityTransitLinks,landmarks:runtime.report.landmarkIntegration?.ok,navigation:runtime.report.navigation,tram:runtime.report.tram,liveTransport:liveTransport(),terrain:castle.userData.mountainStudy?.targetTerrain??castle.getObjectByName('citadel-oskar-grid-mountain-surface')?.userData.targetTerrainReport??null,gpuProgramCount:renderer.info.programs?.length??0,gpuFailures:(renderer.info.programs||[]).filter(p=>p.diagnostics?.runnable===false).map(p=>p.diagnostics),oldMaterials:(()=>{const a=[];runtime.root.getObjectByName('citadel-target-old-city')?.traverse(o=>{if(o.isMesh&&a.length<12)a.push({name:o.name,color:o.material?.color?.getHexString(),type:o.material?.type});});return a;})(),glError:renderer.getContext().getError(),camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov}};}
 // Explicit, on-demand diagnostics of what the rendered camera sees. No scene
 // mutation or per-frame scanning; helps identify legacy geometry before edits.
 button('检查可见物体',()=>{
  scene.updateMatrixWorld(true);camera.updateMatrixWorld(true);
  const meshes=[];scene.traverseVisible(o=>{if(o.isMesh)meshes.push(o);});
  const ray=new T.Raycaster(),inverse=castle.matrixWorld.clone().invert();
  const path=o=>{const names=[];for(let p=o;p;p=p.parent)names.unshift(p.name||p.type);return names.join('/');};
  const samples=[[.12,.65],[.17,.72],[.23,.58],[.40,.56],[.72,.61],[.86,.74]].map(([x,y])=>{
   ray.setFromCamera(new T.Vector2(x*2-1,1-y*2),camera);
   return {screen:[x,y],hits:ray.intersectObjects(meshes,false).slice(0,4).map(h=>({path:path(h.object),distance:h.distance,point:h.point.toArray(),castlePoint:h.point.clone().applyMatrix4(inverse).toArray()}))};
  });
  const buckets=new Map();for(const o of meshes){let a=o;while(a.parent&&a.parent!==scene)a=a.parent;const k=a.name||a.type;const b=buckets.get(k)||{name:k,meshCount:0,triangles:0};b.meshCount++;b.triangles+=(o.geometry?.index?.count??o.geometry?.attributes?.position?.count??0)/3*(o.isInstancedMesh?o.count:1);buckets.set(k,b);}
  out.textContent=JSON.stringify({at:new Date().toISOString(),view:handle.view,render:{...renderer.info.render},samples,visibleRoots:[...buckets.values()].sort((a,b)=>b.meshCount-a.meshCount).slice(0,20)},null,2);details.open=true;
 });
 // Reversible inspection of the audited cut, never enabled at boot. The real
 // collision scene and train route remain untouched; restoring the player view
 // always removes this display-only mesh. No stale terrain cache is certified.
 button('预览东岸切崖（仅外观）',async()=>{
  if(eastPreviewPending||eastPreview)return;
  eastPreviewPending=true;const epoch=++previewEpoch;
  try{
   const [module,response]=await Promise.all([import('../world/citadel/targetEastCliffRemeshPreview.js'),fetch(new URL('../../artifacts/pipeline/citadel-east-shore-route-20261006/remesh-final-surface-geometry.json',import.meta.url))]);
   if(!response.ok)throw new Error('候选文件读取失败 '+response.status);
   const artifact=await response.json();if(epoch!==previewEpoch)return;
   const source=castle.getObjectByName('citadel-oskar-grid-mountain-surface');
   const prepared=module.createEastCliffRemeshPreview({enabled:true,castle,sourceMesh:source,artifact});
   prepared.mesh.layers.mask=source.layers.mask;
   eastPreviewSource=source;eastPreviewVisible=source.visible;eastPreview=prepared;
   castle.add(prepared.mesh);source.visible=false;castle.updateMatrixWorld(true);
   out.textContent=JSON.stringify({scope:'仅切崖外观预览；旧轨道、碰撞与植被缓存未替换，不能用于通行验收',...prepared.report},null,2);details.open=true;
  }catch(error){out.textContent='切崖预览未安装：'+error.message;details.open=true;}finally{eastPreviewPending=false;}
 });
 button('撤回切崖预览',()=>{clearEastPreview();out.textContent='已恢复原山体；默认生产路线未改变。';details.open=true;});
 button('调查切崖植被（不安装）',async()=>{
  if(vegetationSurveyPending||eastPreviewPending||eastPreview)return;
  vegetationSurveyPending=true;out.textContent='正在调查实际植被与承托；不安装候选。';details.open=true;
  try{
   const [module,geometryResponse,auditResponse]=await Promise.all([import('../world/citadel/surveyEastCliffLiveVegetation.js'),fetch(new URL('../../artifacts/pipeline/citadel-east-shore-route-20261006/remesh-final-surface-geometry.json',import.meta.url)),fetch(new URL('../../artifacts/pipeline/citadel-east-shore-route-20261006/remesh-final-surface-audit.json',import.meta.url))]);
   if(!geometryResponse.ok||!auditResponse.ok)throw new Error('切崖候选读取失败');
   const [artifact,audit]=await Promise.all([geometryResponse.json(),auditResponse.json()]);
   eastVegetationSurvey=module.surveyEastCliffLiveVegetation({castle,scene,runtime,tramSystem,artifact,candidateInput:audit.candidateInput});
   out.textContent=JSON.stringify(eastVegetationSurvey,null,2);
  }catch(error){out.textContent='植被调查未安装：'+error.message;}finally{vegetationSurveyPending=false;}
 });
 button('预览切崖与植被（仅外观）',async()=>{
  if(vegetationSurveyPending||eastPreviewPending||eastPreview)return;
  vegetationSurveyPending=true;const epoch=++previewEpoch;let prepared;
  try{
   const [module,gr,ar]=await Promise.all([import('../world/citadel/surveyEastCliffLiveVegetation.js'),fetch(new URL('../../artifacts/pipeline/citadel-east-shore-route-20261006/remesh-final-surface-geometry.json',import.meta.url)),fetch(new URL('../../artifacts/pipeline/citadel-east-shore-route-20261006/remesh-final-surface-audit.json',import.meta.url))]);
   if(!gr.ok||!ar.ok)throw new Error('候选读取失败');const [artifact,audit]=await Promise.all([gr.json(),ar.json()]);if(epoch!==previewEpoch)return;
   prepared=module.prepareEastCliffLiveVegetation({castle,scene,runtime,tramSystem,artifact,candidateInput:audit.candidateInput});
   if(!prepared.applyVisual())throw new Error('实际植被承托或对象版本拒绝应用');
   eastVegetationSurvey=JSON.parse(JSON.stringify(prepared.report));
   const source=castle.getObjectByName('citadel-oskar-grid-mountain-surface');
   eastPreviewSource=source;eastPreviewVisible=source.visible;eastPreview=prepared.preview;eastPlantingPreview=prepared;
   eastPreview.mesh.layers.mask=source.layers.mask;castle.add(eastPreview.mesh);source.visible=false;
   eastVegetationSurvey.applied=true;eastVegetationSurvey.vegetation.applied=true;
   out.textContent=JSON.stringify({scope:'仅外观诊断；旧轨/廊/导航保持，退出检查即回退',...eastVegetationSurvey},null,2);details.open=true;
  }catch(error){prepared?.dispose();out.textContent='切崖植被预览未安装：'+error.message+(error.cloudReport?'\n'+JSON.stringify(error.cloudReport):'');details.open=true;}finally{vegetationSurveyPending=false;}
 });
 button('检查列车运行',()=>{out.textContent=JSON.stringify(liveTransport(),null,2);details.open=true;});
 button('检查加载',()=>{out.textContent=JSON.stringify(state(),null,2);details.open=true;});
 button('保存当前画面',async()=>{try{renderer.render(scene,camera);const r=await fetch('http://localhost:8932/capture',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'runtime-'+Date.now(),png:renderer.domElement.toDataURL('image/png'),state:state()})});if(!r.ok)throw new Error(await r.text());out.textContent=await r.text();details.open=true;}catch(e){out.textContent='截图保存失败：'+e.message;details.open=true;}});
 document.body.append(panel);out.textContent=JSON.stringify({installed:runtime.report.installed,landmarks:runtime.report.landmarkIntegration?.ok});return handle;
}
