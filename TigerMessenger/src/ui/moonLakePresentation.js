import * as T from 'three';
import {P} from '../core/params.js';
import {flatToWorld} from '../world/sphereMath.js';

/** Inspect the installed garden. Number tags exist only while this panel is open. */
export function installMoonLakePresentation({lake,camera,cameraRig}){
 const panel=document.createElement('section');panel.id='moon-lake-live-review';panel.hidden=true;
 panel.style.cssText='position:fixed;right:16px;top:16px;z-index:220;background:#f6f3e7ed;color:#284535;padding:12px;border-radius:10px;max-width:370px;font:14px system-ui';
 const title=document.createElement('strong');title.textContent='月湖 · 四松借月（正式场景）';panel.append(title);
 const controls=document.createElement('div');controls.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin:9px 0';panel.append(controls);
 const status=document.createElement('div');status.id='moon-lake-live-audit';status.style.fontSize='12px';panel.append(status);document.body.append(panel);
 const tags=[];
 for(let i=0;i<4;i++){
  const tag=document.createElement('span');tag.textContent=`新增松 ${i+1}`;tag.hidden=true;
  tag.style.cssText='position:fixed;z-index:215;pointer-events:none;transform:translate(-50%,-100%);background:#fff8d6ed;color:#244c36;border:1px solid #56765c;border-radius:6px;padding:3px 7px;font:bold 13px system-ui;box-shadow:0 2px 4px #0003';
  document.body.append(tag);tags.push(tag);
 }
 const views={全景:[[0,15,32],[0,3,0]],松月:[[18,8,25],[-3,4,1]],低斜松:[[-19,5,15],[-5,3,1]],俯视:[[0,37,3],[0,0,0]]};
 let saved=null,lastAudit=-Infinity;
 function aim(eye,target){handle.active=true;lake.viewerOverride=camera.position;lastAudit=-Infinity;lake.group.updateWorldMatrix(true,true);camera.position.copy(lake.group.localToWorld(eye));camera.up.set(0,1,0).transformDirection(lake.group.matrixWorld);camera.lookAt(lake.group.localToWorld(target));camera.fov=48;camera.zoom=1;camera.far=Math.max(camera.far,700);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);handle.update(1,0);}
 const handle={active:false,view:null,
  open(){if(!saved)saved={daySpeed:P.daySpeed,timeOfDay:P.timeOfDay,fov:camera.fov,far:camera.far,zoom:camera.zoom};P.daySpeed=0;P.timeOfDay=.48;panel.hidden=false;handle.setView('全景');},
  setView(name){handle.view=name;if(name==='临海外岸'||name==='岸线俯看'){const radius=lake.surfaceR-.6,eye=name==='岸线俯看'?flatToWorld(84,20,76,radius):flatToWorld(61,2,59,radius),target=name==='岸线俯看'?flatToWorld(50,.3,48,radius):flatToWorld(48,.3,44,radius);lake.group.updateWorldMatrix(true,true);aim(lake.group.worldToLocal(eye.clone()),lake.group.worldToLocal(target.clone()));camera.up.copy(eye).normalize();camera.lookAt(target);camera.updateMatrixWorld(true);return;}const [eye,target]=views[name];aim(new T.Vector3(...eye),new T.Vector3(...target));},
  focusTree(i){const tree=lake.garden?.trees[i];if(!tree)return;handle.view=`新增松${i+1}`;const bounds=new T.Box3().setFromObject(tree),center=lake.group.worldToLocal(bounds.getCenter(new T.Vector3())),size=bounds.getSize(new T.Vector3()).length();aim(center.clone().add(new T.Vector3(0,size*.24,size*1.35)),center);},
  update(dt,t){if(!handle.active)return;
   const trees=lake.garden?.trees??[],rows=[];
   for(let i=0;i<tags.length;i++){
    const tree=trees[i],tag=tags[i];if(!tree){tag.hidden=true;continue;}
    const box=new T.Box3().setFromObject(tree),anchor=box.getCenter(new T.Vector3()),up=new T.Vector3(0,1,0).transformDirection(lake.group.matrixWorld);anchor.addScaledVector(up,box.getSize(new T.Vector3()).length()*.3);
    const ndc=anchor.project(camera),onScreen=ndc.z>=-1&&ndc.z<=1&&Math.abs(ndc.x)<.98&&Math.abs(ndc.y)<.98;
    tag.hidden=!onScreen;tag.style.left=`${(ndc.x*.5+.5)*innerWidth}px`;tag.style.top=`${(-ndc.y*.5+.5)*innerHeight}px`;
    let meshes=0,enabledMeshes=0;tree.traverse(o=>{if(!o.isMesh)return;meshes++;let n=o,enabled=true;while(n){if(!n.visible)enabled=false;n=n.parent;}if(enabled)enabledMeshes++;});
    rows.push({uuid:tree.uuid,name:tree.name,position:tree.position.toArray(),meshes,enabledMeshes,labelOnScreen:onScreen,occlusionVerified:false});
   }
   if(t-lastAudit<.4)return;lastAudit=t;
   status.textContent=['临海外岸','岸线俯看'].includes(handle.view)?'临海外岸 · 原场景布局保留':`原景保留 · 四棵新增松带编号定位（检查模式专用）`;
   status.dataset.audit=JSON.stringify({source:'normal-game-installed',view:handle.view,shore:lake.shore?.userData?.report,outerCoast:lake.coastOwnership,originalPine:lake.ancientPine?.uuid,moon:lake.moonOrb?.group?.position?.toArray(),moonOrbit:lake.moonOrb?.group?.userData?.moonOrbit,garden:lake.garden?.report,trees:rows});
  },
  restore(){tags.forEach(tag=>tag.hidden=true);if(lake.viewerOverride===camera.position)delete lake.viewerOverride;if(!saved){handle.active=false;panel.hidden=true;return;}Object.assign(P,{daySpeed:saved.daySpeed,timeOfDay:saved.timeOfDay});camera.fov=saved.fov;camera.far=saved.far;camera.zoom=saved.zoom;camera.updateProjectionMatrix();saved=null;handle.active=false;panel.hidden=true;cameraRig.snapToPlayer();},
  dispose(){handle.restore();panel.remove();tags.forEach(tag=>tag.remove());}
 };
 for(const name of [...Object.keys(views),'临海外岸','岸线俯看']){const b=document.createElement('button');b.textContent=name;b.onclick=()=>handle.setView(name);controls.append(b);}
 for(let i=0;i<4;i++){const b=document.createElement('button');b.textContent=`定位新增松${i+1}`;b.onclick=()=>handle.focusTree(i);controls.append(b);}
 const exit=document.createElement('button');exit.textContent='返回信使';exit.onclick=()=>handle.restore();controls.append(exit);
 return handle;
}
