import {makeRobotNavigator} from './navigation.js';
export const ROBOT_RULES=Object.freeze({
 locust:{hp:1000,armor:.25,speed:2.2,range:28,minRange:0,damage:24,shots:3,interval:2.4,magazine:30,reserve:120,reload:3,skillCooldown:8,radius:1.4},
 ant:{hp:1400,armor:.35,speed:1.5,range:14,minRange:0,damage:100,shots:1,interval:4.5,magazine:8,reserve:24,reload:4,skillCooldown:18,radius:1.5},
 beetle:{hp:650,armor:.15,speed:3.8,range:22,minRange:0,damage:9,shots:5,interval:1.8,magazine:60,reserve:240,reload:2.5,skillCooldown:12,radius:1.4},
 sentry:{hp:600,armor:.15,speed:0,range:25,minRange:0,damage:20,shots:2,interval:3,magazine:20,reserve:80,reload:4,skillCooldown:0,radius:1.2}
});
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function robotSkillStatus(u){
 const label=u.kind==='locust'?(u.braced?'收姿':'架稳'):u.kind==='ant'?'排汽屏障':'扫描';
 const reason=u.hp<=0?'机体已失能':u.skillCooldown>0?`冷却 ${Math.ceil(u.skillCooldown)} 秒`:u.kind==='ant'&&u.pressure<35?'锅炉压力不足 35':u.kind==='beetle'&&u.damageParts.sensor>=.25?'传感器受损，请维修':null;
 return{label,available:reason===null,reason};
}
function segmentDistance(a,b,p){const dx=b.x-a.x,dz=b.z-a.z,len=dx*dx+dz*dz,t=len?clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/len,0,1):0;return Math.hypot(a.x+t*dx-p.x,a.z+t*dz-p.z);}
export class RobotCombat {
 constructor({obstacles=[],bounds={minX:-45,maxX:45,minZ:-45,maxZ:45},findPath=null}={}){this.units=[];this.obstacles=obstacles;this.bounds=bounds;this.findPath=findPath||makeRobotNavigator({bounds,obstacles});this.time=0;this.events=[];this.eventSequence=0;this.smoke=[];this.autoRetreat=true;this.home={x:0,z:30};}
 add({id,kind,team='friendly',x=0,z=0,hp=null}){if(this.units.some(u=>u.id===id))throw Error('Duplicate combat unit');const r=ROBOT_RULES[kind];if(!r)throw Error('Invalid robot kind');const u={id,kind,team,x,z,hp:hp??r.hp,maxHp:r.hp,heading:0,turretYaw:0,state:'idle',order:{type:'hold',x,z},target:null,magazine:r.magazine,reserve:r.reserve,heat:0,pressure:100,cooldown:0,reload:0,skillCooldown:0,scan:0,braced:false,damageParts:{legs:0,weapon:0,sensor:0},path:[],lastSeen:null,recoil:0,speed:0,overheated:false,repairAmmo:0};this.units.push(u);return u;}
 get(id){return this.units.find(u=>u.id===id);}
 emit(type,data){this.events.push({type,time:this.time,...data,sequence:++this.eventSequence});if(this.events.length>256)this.events.shift();}
 command(ids,type,target={}){const valid=[...new Set(ids)].filter(id=>this.get(id)?.hp>0&&this.get(id)?.team==='friendly'),columns=Math.ceil(Math.sqrt(valid.length));for(const [index,id]of valid.entries()){const u=this.get(id);if(!u||u.team!=='friendly'||u.hp<=0)continue;if(type==='skill'){this.skill(u);continue;}u.order={type,...target};if(type==='hold')u.order={type,x:u.x,z:u.z};if(type==='retreat')u.order={type,...this.repairDestination(u)};if(type==='move'&&valid.length>1){const r=ROBOT_RULES[u.kind].radius,b=this.bounds;u.order.x=clamp(target.x+(index%columns-(columns-1)/2)*4.8,b.minX+r,b.maxX-r);u.order.z=clamp(target.z+Math.floor(index/columns)*4.8,b.minZ+r,b.maxZ-r);}u.path=[];if(u.braced)u.skillCooldown=Math.max(u.skillCooldown,ROBOT_RULES[u.kind].skillCooldown);u.braced=false;u.target=type==='attack'?target.id:null;u.state=type==='cease'?'idle':'move';if(type==='attack'){const e=this.get(target.id);if(e&&this.lineClear(u,e,{ignoreFriends:true}))u.lastSeen={x:e.x,z:e.z,time:this.time};}}}
 repairDestination(u){
  // Reserve a separate service bay per unit, including automatic retreat.
  const friendly=this.units.filter(v=>v.team==='friendly'&&v.hp>0),index=friendly.indexOf(u),r=ROBOT_RULES[u.kind].radius,b=this.bounds,spacing=4;
  if(friendly.length===1)return{...this.home};
  const columns=Math.max(1,Math.floor((b.maxX-b.minX-2*r)/spacing));
  return{x:clamp(b.minX+r+1+(Math.max(0,index)%columns)*spacing,b.minX+r,b.maxX-r),z:clamp(this.home.z-Math.floor(Math.max(0,index)/columns)*spacing,b.minZ+r,b.maxZ-r)};
 }
 skill(u){if(!robotSkillStatus(u).available)return false;const r=ROBOT_RULES[u.kind];
  if(u.kind==='locust'){u.braced=!u.braced;u.state=u.braced?'braced':'idle';if(!u.braced)u.skillCooldown=r.skillCooldown;return true;}
  if(u.kind==='ant'){if(u.pressure<35)return false;u.pressure-=35;this.smoke.push({x:u.x,z:u.z,radius:5.5,expires:this.time+6});this.emit('steam-screen',{id:u.id,x:u.x,z:u.z});}
  if(u.kind==='beetle'){u.scan=5;for(const e of this.units)if(e.team!==u.team&&e.hp>0&&dist(u,e)<35&&this.lineClear(u,e)){e.markedUntil=this.time+5;e.lastMarkedPosition={x:e.x,z:e.z,time:this.time};this.emit('scan',{id:u.id,target:e.id});}}
  u.skillCooldown=r.skillCooldown;return true;
 }
 lineClear(a,b,{ignoreSmoke=false,ignoreFriends=false}={}){
  if(this.obstacles.some(o=>segmentDistance(a,b,o)<o.radius))return false;
  if(!ignoreSmoke&&this.smoke.some(s=>s.expires>this.time&&segmentDistance(a,b,s)<s.radius))return false;
  if(!ignoreFriends&&this.units.some(u=>u.id!==a.id&&u.id!==b.id&&u.hp>0&&u.team===a.team&&segmentDistance(a,b,u)<ROBOT_RULES[u.kind].radius))return false;
  return true;
 }
 acquire(u){const r=ROBOT_RULES[u.kind];let candidates=this.units.filter(e=>e.team!==u.team&&e.hp>0&&dist(u,e)<=r.range*(u.damageParts.sensor>=.25?.7:1)+(u.scan>0?7:0)&&this.lineClear(u,e));if(u.order.type==='attack')candidates.sort((a,b)=>(a.id===u.order.id?-1:b.id===u.order.id?1:dist(u,a)-dist(u,b)));else candidates.sort((a,b)=>(a.target===u.id?-1:b.target===u.id?1:dist(u,a)-dist(u,b)));return candidates[0]||null;}
 canStand(x,z,u){const r=ROBOT_RULES[u.kind].radius,b=this.bounds;if(x<b.minX+r||x>b.maxX-r||z<b.minZ+r||z>b.maxZ-r)return false;return !this.obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<r+o.radius)&&!this.units.some(e=>e!==u&&e.hp>0&&Math.hypot(x-e.x,z-e.z)<r+ROBOT_RULES[e.kind].radius+.1);}
 move(u,destination,dt){const r=ROBOT_RULES[u.kind];if(!r.speed||u.braced)return;
  const obstructed=this.obstacles.some(o=>segmentDistance(u,destination,o)<r.radius+o.radius+.2);
  if(obstructed&&(!u.path.length||!u.pathGoal||dist(u.pathGoal,destination)>3)){u.path=this.findPath(u,destination,r.radius);u.pathGoal={...destination};}
  while(u.path.length&&dist(u,u.path[0])<.4)u.path.shift();
  const waypointBlocked=this.units.some(e=>e!==u&&e.hp>0&&dist(e,u.path[0]||destination)<r.radius+ROBOT_RULES[e.kind].radius+.2);
  if((waypointBlocked||(u.blockedFor||0)>.4)&&this.time>=(u.repathAt||0)){
   const obstacles=[...this.obstacles,...this.units.filter(e=>e!==u&&e.hp>0).map(e=>({x:e.x,z:e.z,radius:ROBOT_RULES[e.kind].radius+.1}))];
   u.path=makeRobotNavigator({bounds:this.bounds,obstacles})(u,destination,r.radius);u.pathGoal={...destination};u.repathAt=this.time+.75;
  }
  const waypoint=u.path[0]||destination;let dx=waypoint.x-u.x,dz=waypoint.z-u.z,d=Math.hypot(dx,dz);if(d<.25){u.state='idle';u.speed=0;return;}
  const step=Math.min(d,r.speed*(u.damageParts.legs>=.7?.4:1)*dt);const heading=Math.atan2(dx,dz);let moved=false;
  for(const offset of[0,.45,-.45,.9,-.9,1.4,-1.4]){const a=heading+offset,x=u.x+Math.sin(a)*step,z=u.z+Math.cos(a)*step;if(this.canStand(x,z,u)){u.x=x;u.z=z;u.heading=a;u.state='move';u.speed=step/dt;moved=true;break;}}
  if(!moved){u.speed=0;u.state='blocked';u.blockedFor=(u.blockedFor||0)+dt;}else u.blockedFor=0;
 }
 damage(attacker,target,raw){const rule=ROBOT_RULES[target.kind],toward=Math.atan2(attacker.x-target.x,attacker.z-target.z),frontal=Math.cos(toward-target.heading)>.35;const damage=raw*(1-(frontal?rule.armor:rule.armor*.35));target.hp=Math.max(0,target.hp-damage);const fraction=1-target.hp/target.maxHp;target.damageParts.legs=fraction;target.damageParts.weapon=Math.max(0,fraction-.3);target.damageParts.sensor=Math.max(0,fraction-.4);target.target=attacker.id;this.emit('hit',{id:attacker.id,target:target.id,damage});if(target.hp===0){target.state='disabled';target.order={type:'cease'};this.emit('disabled',{id:target.id});}}
 fire(u,target){const r=ROBOT_RULES[u.kind];if(!target||target.team===u.team||target.hp<=0||u.hp<=0||u.damageParts.weapon>=.4||!this.lineClear(u,target)||dist(u,target)>r.range||u.magazine<=0||u.overheated||u.heat>=100||u.cooldown>0||u.reload>0||(u.kind==='ant'&&u.pressure<25))return false;
  const shots=Math.min(r.shots,u.magazine);u.magazine-=shots;u.cooldown=r.interval*(u.braced?.8:1);u.heat=Math.min(100,u.heat+(u.kind==='ant'?34:18));if(u.heat>=100){u.overheated=true;this.emit('overheat',{id:u.id});}if(u.kind==='ant')u.pressure-=25;u.recoil=1;u.state='attack';this.damage(u,target,r.damage*shots*(u.kind==='beetle'&&u.speed>0?.6:1));this.emit('shot',{id:u.id,target:target.id,kind:u.kind,shots,from:{x:u.x,z:u.z},to:{x:target.x,z:target.z}});
  if(u.kind==='ant')for(const e of this.units)if(e!==target&&e.team!==u.team&&e.hp>0&&dist(e,target)<3&&this.lineClear(target,e,{ignoreFriends:true}))this.damage(u,e,r.damage*.3);
  return true;
 }
 aimTurret(u,target,dt,moving){
  const desired=Math.atan2(target.x-u.x,target.z-u.z),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));let relative=wrap(desired-u.heading);
  if(!moving&&Math.abs(relative)>1.4){const turn=clamp(relative,-dt*2,dt*2);u.heading+=turn;u.turretYaw=wrap((u.turretYaw||0)-turn);relative=wrap(desired-u.heading);}
  const wanted=clamp(relative,-1.4,1.4);u.turretYaw=(u.turretYaw||0)+clamp(wanted-(u.turretYaw||0),-dt*3.4,dt*3.4);
  u.target=target.id;u.lastSeen={x:target.x,z:target.z,time:this.time};
  if(Math.abs(wrap(relative-u.turretYaw))<.12){if(!this.fire(u,target)&&!moving)u.state=u.overheated?'cooling':'aim';}else if(!moving)u.state='aim';
 }
 update(dt){if(!Number.isFinite(dt)||dt<=0)return;for(let remaining=dt;remaining>1e-9;){const d=Math.min(.05,remaining);remaining-=d;this.time+=d;this.smoke=this.smoke.filter(s=>s.expires>this.time);
  for(const u of this.units){if(u.hp<=0)continue;const r=ROBOT_RULES[u.kind];u.speed=0;u.cooldown=Math.max(0,u.cooldown-d);u.skillCooldown=Math.max(0,u.skillCooldown-d);u.scan=Math.max(0,u.scan-d);u.recoil=Math.max(0,u.recoil-d*5);u.heat=Math.max(0,u.heat-d*(u.heat>=90?10:6));u.pressure=Math.min(100,u.pressure+d*7*(u.kind==='ant'?1-u.damageParts.weapon*.7:1));if(u.overheated&&u.heat<=55)u.overheated=false;
   if(u.reload>0){u.reload=Math.max(0,u.reload-d);u.state='reload';if(u.reload===0){const n=Math.min(r.magazine-u.magazine,u.reserve);u.magazine+=n;u.reserve-=n;}continue;}
   if(u.magazine===0&&u.reserve>0){u.reload=r.reload;u.state='reload';continue;}
   if(u.team==='friendly'&&this.autoRetreat&&(u.hp/u.maxHp<.25||u.damageParts.weapon>=.4||(u.magazine===0&&u.reserve===0))&&u.order.type!=='retreat'){u.order={type:'retreat',...this.repairDestination(u)};u.braced=false;this.emit('retreat',{id:u.id});}
   if(u.order.type==='retreat'){this.move(u,{x:u.order.x??this.home.x,z:u.order.z??this.home.z},d);if(dist(u,{x:u.order.x??this.home.x,z:u.order.z??this.home.z})<1){u.state='repair';u.hp=Math.min(u.maxHp,u.hp+d*45);const damage=1-u.hp/u.maxHp;u.damageParts={legs:damage,weapon:Math.max(0,damage-.3),sensor:Math.max(0,damage-.4)};u.repairAmmo=(u.repairAmmo||0)+d*3;const rounds=Math.floor(u.repairAmmo+1e-9),magazineRounds=Math.min(r.magazine-u.magazine,rounds);u.magazine+=magazineRounds;u.reserve=Math.min(r.reserve,u.reserve+rounds-magazineRounds);u.repairAmmo=Math.max(0,u.repairAmmo-rounds);if(u.hp===u.maxHp&&u.magazine===r.magazine&&u.reserve===r.reserve)u.order={type:'hold',x:u.x,z:u.z};}continue;}
   if(u.order.type==='cease'){u.state='idle';continue;}
   if(u.order.type==='move'){this.move(u,u.order,d);if(u.speed>0){const target=this.acquire(u);if(target){this.aimTurret(u,target,d,true);u.state='move';}}if(dist(u,u.order)<.4)u.order={type:'hold',x:u.x,z:u.z};continue;}
   const target=this.acquire(u);if(target){u.target=target.id;u.lastSeen={x:target.x,z:target.z,time:this.time};if(u.kind==='beetle'){this.aimTurret(u,target,d,false);continue;}u.turretYaw=0;const desired=Math.atan2(target.x-u.x,target.z-u.z),turn=Math.atan2(Math.sin(desired-u.heading),Math.cos(desired-u.heading));u.heading+=clamp(turn,-d*2,d*2);if(dist(u,target)<=r.range){if(Math.abs(turn)>.12)u.state='aim';else if(!this.fire(u,target)&&u.state!=='attack')u.state=u.overheated?'cooling':'aim';}else this.move(u,target,d);}
   else{u.target=null;if(u.order.type==='attack'){const requested=this.get(u.order.id);if(requested?.hp>0&&this.lineClear(u,requested,{ignoreFriends:true}))u.lastSeen={x:requested.x,z:requested.z,time:this.time};const seen=u.lastSeen;if(seen&&this.time-seen.time<6)this.move(u,seen,d);else u.state='search';}else if(u.order.type==='escort'){const leader=this.get(u.order.id);if(leader&&dist(u,leader)>6)this.move(u,leader,d);else u.state='idle';}else u.state=u.braced?'braced':'idle';}
  }
 }}
 snapshot(){return JSON.parse(JSON.stringify({version:1,time:this.time,units:this.units,smoke:this.smoke,autoRetreat:this.autoRetreat}));}
 restore(s){
  if(s?.version!==1||!Array.isArray(s.units)||s.units.length>10000||!Number.isFinite(s.time)||s.time<0||!Array.isArray(s.smoke)||typeof s.autoRetreat!=='boolean')throw Error('Invalid combat save');
  const ids=new Set(),finite=(v,min=0,max=Infinity)=>Number.isFinite(v)&&v>=min&&v<=max;
  const orders=['hold','cease','move','attack','escort','retreat'];
  for(const u of s.units){
   const r=ROBOT_RULES[u.kind];
   if(!u||typeof u.id!=='string'||!/^[-\w]{1,64}$/.test(u.id)||ids.has(u.id)||!r||!['friendly','enemy'].includes(u.team)||![u.x,u.z,u.heading,u.turretYaw??0].every(Number.isFinite)||!finite(u.hp,0,r.hp)||u.maxHp!==r.hp||!orders.includes(u.order?.type))throw Error('Invalid combat unit');
   if(!Number.isInteger(u.magazine)||!finite(u.magazine,0,r.magazine)||!Number.isInteger(u.reserve)||!finite(u.reserve,0,r.reserve)||!finite(u.heat,0,100)||!finite(u.pressure,0,100)||!['cooldown','reload','skillCooldown','scan','recoil','speed'].every(k=>finite(u[k]))||!['legs','weapon','sensor'].every(k=>finite(u.damageParts?.[k],0,1)))throw Error('Invalid combat resources');
   if(!Array.isArray(u.path)||!u.path.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z))||(u.lastSeen&&![u.lastSeen.x,u.lastSeen.z,u.lastSeen.time].every(Number.isFinite)))throw Error('Invalid combat path');
   if(['repathAt','blockedFor','repairAmmo'].some(k=>u[k]!==undefined&&!finite(u[k]))||(u.pathGoal&&![u.pathGoal.x,u.pathGoal.z].every(Number.isFinite))||(u.lastMarkedPosition&&![u.lastMarkedPosition.x,u.lastMarkedPosition.z,u.lastMarkedPosition.time].every(Number.isFinite)))throw Error('Invalid combat navigation state');
   if(['move','hold'].includes(u.order.type)&&![u.order.x,u.order.z].every(Number.isFinite))throw Error('Invalid combat order');
   if(u.order.type==='retreat'&&['x','z'].some(k=>u.order[k]!==undefined&&!Number.isFinite(u.order[k])))throw Error('Invalid repair destination');
   if(['attack','escort'].includes(u.order.type)&&(typeof u.order.id!=='string'||!/^[-\w]{1,64}$/.test(u.order.id)))throw Error('Invalid combat target');
   ids.add(u.id);
  }
  for(const smoke of s.smoke)if(![smoke.x,smoke.z,smoke.radius,smoke.expires].every(Number.isFinite)||smoke.radius<=0)throw Error('Invalid smoke');
  const copy=JSON.parse(JSON.stringify(s));for(const key of ['time','units','smoke','autoRetreat'])this[key]=copy[key];this.events=[];
 }
}
