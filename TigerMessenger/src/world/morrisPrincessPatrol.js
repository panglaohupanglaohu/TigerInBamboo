import * as T from 'three';
import {createMorrisPrincess,animateMorrisPrincess} from './morrisPrincess.js?v=morris-direct-v17';
/** Owns one existing white horse. Actual route/bridge support is sampled on every step. */
export function createMorrisPrincessPatrol({island,player,isStarted=()=>true,onMeet=()=>{},eventTarget=globalThis.window,documentTarget=globalThis.document}={}){
 if(!island||!island.horses?.length)return null;
 const horse=island.horses[0],princess=createMorrisPrincess(),u=horse.userData.horse;horse.userData.princessOccupied=true;horse.userData.noDistanceCulling=true;
 princess.scale.setScalar(1/horse.scale.x);princess.position.set(0,2.38,-.1);horse.add(princess);
 const routeAt=s=>island.route.patrolAt?.(s)??island.route.at(s),routeLength=island.route.patrolLength??island.route.length,isBridge=s=>island.route.isPatrolBridge?.(s)??island.route.isBridge(s);
 const reins=[];for(const sign of[-1,1]){const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(25*3),3));const line=new T.Line(g,new T.LineBasicMaterial({color:0x463a25}));line.name='morris-princess-held-rein';horse.add(line);reins.push({line,sign});}
 let s=routeLength-3,direction=-1,speed=0,time=0,pause=2,dialogue=-1,cooldown=0,mode='castle-stop',travelled=0,visits=0,meetings=0,bridgePasses=0,lastBridge=false;
 const messages=['这里的花径通往溪桥。慢些走，能听见鸟鸣。','我会沿山路巡游，再到半山琴庭停一停。你也可以骑马同行。','愿这片繁花陪伴你的旅途。我们路上见。'];
 const hint=documentTarget?.createElement('div'),panel=documentTarget?.createElement('section');
 if(hint){hint.id='morris-princess-hint';hint.style.cssText='position:fixed;left:50%;bottom:145px;transform:translateX(-50%);z-index:112;padding:10px 16px;background:#243d39ed;color:#efe1b6;border:1px solid #aa8c4b;border-radius:8px;font:14px system-ui;pointer-events:none';hint.hidden=true;documentTarget.body.append(hint);}
 if(panel){panel.id='morris-princess-dialogue';panel.style.cssText='position:fixed;left:50%;bottom:190px;transform:translateX(-50%);z-index:114;padding:18px 24px;background:#243d39f5;color:#f2e5c6;border:1px solid #aa8c4b;border-radius:9px;width:min(440px,80vw);font:16px/1.7 system-ui';panel.hidden=true;documentTarget.body.append(panel);}
 const ground=(p)=>{const w=island.root.localToWorld(new T.Vector3(p.x,island.heightAt(p.x,p.z,p.h)+2,p.z)),r=island.sampleGroundRadius(w);if(!Number.isFinite(r))return null;return island.root.worldToLocal(w.normalize().multiplyScalar(r)).y;};
 function place(){const p=routeAt(s),y=ground(p);if(y==null)return false;horse.position.set(p.x,y+.015,p.z);const ahead=routeAt(T.MathUtils.clamp(s+direction*.6,0,routeLength)),behind=routeAt(T.MathUtils.clamp(s-direction*.6,0,routeLength)),ay=ground(ahead),by=ground(behind),span=Math.hypot(ahead.x-behind.x,ahead.z-behind.z)||1;const pitch=ay!=null&&by!=null?-Math.atan2(ay-by,span):0;horse.rotation.set(T.MathUtils.clamp(pitch,-.45,.45),Math.atan2(p.tx*direction,p.tz*direction),0,'YXZ');horse.updateWorldMatrix(true,true);return true;}
 place();u.ridden=true;u.speed=0;
 function distance(){return player?.position?player.position.distanceTo(horse.getWorldPosition(new T.Vector3())):Infinity;}
 function closeDialogue(){dialogue=-1;cooldown=14;if(panel)panel.hidden=true;pause=Math.max(pause,1.4);}
 function onKey(e){if(e.code!=='KeyE'||e.repeat||e.defaultPrevented||!isStarted()||/INPUT|TEXTAREA|SELECT/.test(e.target?.tagName)||e.target?.isContentEditable||distance()>5.2)return;e.preventDefault();e.stopImmediatePropagation?.();speed=0;onMeet();if(dialogue<0){dialogue=0;meetings++;}else dialogue++;if(dialogue>=messages.length){closeDialogue();return;}mode='conversation';if(panel){panel.hidden=false;panel.textContent='莫里斯公主：'+messages[dialogue]+'　[E 继续]';}}
 eventTarget?.addEventListener('keydown',onKey,true);
 function snapshot(){return{revision:'right-bank-court-patrol-r2',state:mode,routeDistance:s,routeLength:routeLength,direction,speed,travelled,bridgePasses,courtVisits:visits,meetings,dialogue,horseLocal:horse.position.toArray(),riderVisible:princess.visible,hoofSupport:horse.userData.hoofSupport??null,horseAsset:horse.userData.authoredHorseStatus??'not-loaded-in-headless',horseRevision:horse.userData.horseAsset?.revision??u.targetRevision,riderAsset:princess.userData.authoredAssetStatus??'not-loaded-in-headless',riderRevision:princess.userData.princess.revision,horseOccupied:true,routeSource:'current installed island route and raycast bridge support'};}
 function update(dt,t){if(!isStarted())return;dt=Math.min(.1,Math.max(0,dt));time=t??time+dt;cooldown=Math.max(0,cooldown-dt);const dist=distance();if(dialogue>=0&&dist>8)closeDialogue();
 const p=routeAt(s),q=routeAt(T.MathUtils.clamp(s+direction*.8,0,routeLength)),onBridge=Math.abs(s-(island.route.patrolBridgeS??island.route.bridge.s))<6;
 const bend=Math.acos(T.MathUtils.clamp(p.tx*q.tx+p.tz*q.tz,-1,1));
 const encounter=dist<4.7&&cooldown===0;let target=onBridge?.65:bend>.15?.8:1.25;
 if(dialogue>=0){mode='conversation';target=0;}else if(encounter||dist<1.7){mode='greeting';target=0;}else if(pause>0){pause-=dt;target=0;}else mode=direction>0?'uphill-patrol':'downhill-patrol';
 speed=T.MathUtils.lerp(speed,target,1-Math.exp(-dt*4));if(target===0&&speed<.02)speed=0;
 if(speed>0){const before=s;s=T.MathUtils.clamp(s+direction*speed*dt,1,routeLength-2);if(!place()){s=before;speed=0;mode='support-blocked';}else travelled+=Math.abs(s-before);
  if(s<=1.001||s>=routeLength-2.001){direction*=-1;pause=s<2?4:8;mode=s<2?'meadow-stop':'castle-stop';speed=0;}
  const courtS=island.landscape.musicCourt?.routeS??island.route.report?.marks?.eastEnd??routeLength-15;if(Math.abs(s-courtS)<.08&&Math.abs(before-courtS)>=.08){pause=5;visits++;mode='music-court-stop';}
 }
 const bridgeNow=isBridge(s);if(lastBridge&&!bridgeNow)bridgePasses++;lastBridge=bridgeNow;
 u.ridden=true;u.speed=speed;u.turn=0;animateMorrisPrincess(princess,{time,speed,phase:u.gaitPhase||0,looking:encounter||dialogue>=0?.35:0});princess.position.y=2.38+u.body.position.y;
 horse.userData.settleHorseFeet?.(position=>island.sampleGroundRadius(position));horse.updateWorldMatrix(true,true);for(const{line,sign}of reins){const hand=horse.worldToLocal(princess.localToWorld(new T.Vector3(sign*.13,.22,.41))),bit=horse.worldToLocal(u.neck.localToWorld(new T.Vector3(...(['reference-rebuilt-v13','reference-rebuilt-v17'].includes(princess.userData.princess.revision)?[sign*.16,.89,1.08]:[sign*.20,1.25,1.15])))),mid=hand.clone().lerp(bit,.5);mid.y-=.12;const curve=new T.QuadraticBezierCurve3(hand,mid,bit),a=line.geometry.attributes.position;for(let j=0;j<25;j++){const v=curve.getPoint(j/24);a.setXYZ(j,v.x,v.y,v.z);}a.needsUpdate=true;line.geometry.computeBoundingSphere();}
 if(hint){hint.hidden=!(dist<5.2&&dialogue<0);hint.textContent='E 与莫里斯公主交谈 · 她会停马等你';hint.dataset.audit=JSON.stringify(snapshot());}
 }
 return{horse,princess,update,snapshot,dispose(){eventTarget?.removeEventListener('keydown',onKey,true);hint?.remove();panel?.remove();princess.removeFromParent();for(const{line}of reins){line.removeFromParent();line.geometry.dispose();line.material.dispose();}delete horse.userData.princessOccupied;u.ridden=false;u.speed=0;}};
}
