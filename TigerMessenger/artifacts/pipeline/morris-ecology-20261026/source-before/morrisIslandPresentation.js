import * as T from 'three';
import {P} from '../core/params.js';
/** Camera-only view of the installed island; player and old regions stay put. */
export function installMorrisIslandPresentation({island,camera,cameraRig}){
 const panel=document.createElement('section');panel.id='morris-live-review';panel.hidden=true;
 panel.style.cssText='position:fixed;right:14px;top:14px;z-index:220;background:#f4e9cfee;color:#25483e;padding:12px;border-radius:10px;max-width:340px;font:14px system-ui';
 const title=document.createElement('strong');title.textContent='繁花锦岛 · 披锦大马';panel.append(title);
 const controls=document.createElement('div');controls.style.cssText='display:flex;gap:7px;margin:10px 0';panel.append(controls);
 const status=document.createElement('div');status.id='morris-live-audit';status.style.cssText='font-size:12px;line-height:1.5';panel.append(status);document.body.append(panel);
 const views={岛屿全景:[[24,24,34],[0,1,0]],披锦大马:[[-12,5.5,11],[-5,2,1]],卷叶花丛:[[9,3.1,6],[4,1,0]]};let saved=null;
 const api={active:false,open(){if(!saved)saved={timeOfDay:P.timeOfDay,daySpeed:P.daySpeed,fov:camera.fov,far:camera.far};P.timeOfDay=.48;P.daySpeed=0;panel.hidden=false;api.setView('岛屿全景');},setView(name){api.active=true;island.root.updateWorldMatrix(true,true);const[eye,target]=views[name];camera.position.copy(island.root.localToWorld(new T.Vector3(...eye)));camera.up.set(0,1,0).transformDirection(island.root.matrixWorld);camera.lookAt(island.root.localToWorld(new T.Vector3(...target)));camera.fov=48;camera.far=Math.max(camera.far,700);camera.updateProjectionMatrix();camera.updateMatrixWorld(true);status.textContent=`三匹披锦大马 · ${island.report.flowers}簇花 · ${island.report.curledLeafClumps}丛卷叶\n空海域 ${island.report.site.lat}° / ${island.report.site.lon}° · 相机查看，不移动信使`;status.dataset.audit=JSON.stringify({source:'normal-game-installed',view:name,...island.report,horsePositions:island.horses.map(h=>h.position.toArray())});},restore(){api.active=false;panel.hidden=true;if(saved){P.timeOfDay=saved.timeOfDay;P.daySpeed=saved.daySpeed;camera.fov=saved.fov;camera.far=saved.far;camera.updateProjectionMatrix();saved=null;cameraRig.snapToPlayer();}}};
 for(const name of Object.keys(views)){const b=document.createElement('button');b.textContent=name;b.onclick=()=>api.setView(name);controls.append(b);}const exit=document.createElement('button');exit.textContent='返回信使';exit.onclick=api.restore;panel.append(exit);return api;
}
