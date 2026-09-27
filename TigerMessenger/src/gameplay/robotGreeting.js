import * as THREE from 'three';
export function createRobotGreeting({player,isStarted,getModels,toast}){
 const point=new THREE.Vector3();let candidate=null;
 const hint=document.createElement('div');hint.id='robot-greeting-hint';hint.style.cssText='position:fixed;bottom:130px;left:50%;transform:translateX(-50%);padding:10px 18px;border:1px solid #b59b66;background:#18272de8;color:#f4e5c4;border-radius:8px;pointer-events:none;z-index:80;display:none';document.body.append(hint);
 function nearest(){let best=null,distance=5;for(const m of getModels()){
   if(!m?.parent||!m.visible||m.userData.animationState==='disabled'||m.userData.animationState==='transport')continue;
   let visible=true;for(let p=m.parent;p;p=p.parent)if(!p.visible)visible=false;if(!visible)continue;
   const d=m.getWorldPosition(point).distanceTo(player.position);if(d<distance){distance=d;best=m;}
 }return best;}
 function interact(){if(!isStarted()||player.riding)return false;const m=nearest();if(!m)return false;
   const now=performance.now()/1000;if(now-(m.userData.greetingStarted??-Infinity)<4)return true;
   m.userData.greetingStarted=now;toast(`${m.userData.robotName} · ${m.userData.robotType==='ant'?'起身向信使致意':m.userData.robotType==='beetle'?'展开四腿，炮塔环视一周':'点头回应信使'}`,3);return true;
 }
 const key=e=>{if(e.code!=='KeyE'||e.repeat||e.defaultPrevented||e.ctrlKey||e.metaKey||e.target?.closest?.('input,textarea,select,[contenteditable="true"]'))return;if(interact()){e.preventDefault();e.stopImmediatePropagation();}};
 window.addEventListener('keydown',key,{capture:true});
 return{interact,update(){candidate=isStarted()&&!player.riding?nearest():null;hint.style.display=candidate?'block':'none';if(candidate)hint.textContent=`E · 与${candidate.userData.robotName}打招呼`;},dispose(){window.removeEventListener('keydown',key,true);hint.remove();}};
}
