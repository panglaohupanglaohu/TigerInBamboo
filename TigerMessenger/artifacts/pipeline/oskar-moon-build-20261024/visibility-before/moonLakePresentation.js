import * as T from 'three';
import {P} from '../core/params.js';

/** Manual inspection of the real installed garden, never a substitute model. */
export function installMoonLakePresentation({lake,camera,cameraRig}){
 const panel=document.createElement('section');panel.id='moon-lake-live-review';panel.hidden=true;
 panel.style.cssText='position:fixed;right:16px;top:16px;z-index:220;background:#f6f3e7ed;color:#284535;padding:12px;border-radius:10px;max-width:370px;font:14px system-ui';
 const title=document.createElement('strong');title.textContent='月湖 · 四松借月（正式场景）';panel.append(title);
 const controls=document.createElement('div');controls.style.cssText='display:flex;gap:6px;flex-wrap:wrap;margin:9px 0';panel.append(controls);
 const status=document.createElement('div');status.id='moon-lake-live-audit';status.style.fontSize='12px';panel.append(status);document.body.append(panel);
 const views={全景:[[0,15,32],[0,3,0]],松月:[[18,8,25],[-3,4,1]],低斜松:[[-19,5,15],[-5,3,1]],俯视:[[0,37,3],[0,0,0]]};
 let saved=null,lastAudit=-Infinity;const handle={active:false,view:null,open(){if(!saved)saved={daySpeed:P.daySpeed,timeOfDay:P.timeOfDay,fov:camera.fov,far:camera.far,zoom:camera.zoom};P.daySpeed=0;P.timeOfDay=.48;panel.hidden=false;handle.setView('全景');},setView(name){const [eye,aim]=views[name];handle.active=true;handle.view=name;lake.viewerOverride=camera.position;lastAudit=-Infinity;lake.group.updateWorldMatrix(true,true);camera.position.copy(lake.group.localToWorld(new T.Vector3(...eye)));camera.up.set(0,1,0).transformDirection(lake.group.matrixWorld);camera.lookAt(lake.group.localToWorld(new T.Vector3(...aim)));camera.fov=48;camera.zoom=1;camera.far=Math.max(camera.far,700);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);lake.moonOrb?.update?.(0,1,lake.group.worldToLocal(camera.position.clone()));handle.update(1,0);},update(dt,t){if(!handle.active)return;if(t-lastAudit<.4)return;lastAudit=t;status.textContent=`原场景保留 · 新增${lake.garden?.trees.length??0}棵松 · 原湖、月牙与环路保留`;status.dataset.audit=JSON.stringify({source:'normal-game-installed',view:handle.view,originalPine:lake.ancientPine?.uuid,moon:lake.moonOrb?.group?.position?.toArray(),garden:lake.garden?.report,trees:lake.garden?.trees.map(o=>({uuid:o.uuid,name:o.name,position:o.position.toArray(),visible:o.visible}))});},restore(){if(lake.viewerOverride===camera.position)delete lake.viewerOverride;if(!saved){handle.active=false;panel.hidden=true;return;}Object.assign(P,{daySpeed:saved.daySpeed,timeOfDay:saved.timeOfDay});camera.fov=saved.fov;camera.far=saved.far;camera.zoom=saved.zoom;camera.updateProjectionMatrix();saved=null;handle.active=false;panel.hidden=true;cameraRig.snapToPlayer();},dispose(){handle.restore();panel.remove();}};
 for(const name of Object.keys(views)){const b=document.createElement('button');b.textContent=name;b.onclick=()=>handle.setView(name);controls.append(b);}
 const exit=document.createElement('button');exit.textContent='返回信使';exit.onclick=()=>handle.restore();controls.append(exit);
 return handle;
}
