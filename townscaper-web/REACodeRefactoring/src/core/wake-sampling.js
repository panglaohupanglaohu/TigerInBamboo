/** Fixed time sampling of existing world-space ribbons; not original wake physics.
 * `corridor:true` = 901469409579061248 原片的**平行走廊**：两缘只给固定横偏 `latOffset`、不再随年龄外推，
 * 于是两条边线间距恒定（V 档默认行为逐位不变）。 */
export function advanceWake(state,pose,dt,{interval=.06,spread=.18,max=70,corridor=false,latOffset=.06}={}) {
  if(![dt,interval,spread,latOffset,pose.x,pose.z,pose.dx,pose.dz].every(Number.isFinite)||dt<0||interval<=0||spread<0||latOffset<0||!Number.isInteger(max)||max<1||Math.hypot(pose.dx,pose.dz)<1e-12)throw new RangeError('Invalid wake step');
  const previous=state.lastPose??pose,acc=state.acc??0,total=acc+dt,count=Math.floor((total+1e-10)/interval);
  if(!corridor)for(const p of state.trail){p.l[0]+=p.v[0]*spread*dt;p.l[1]+=p.v[1]*spread*dt;p.r[0]-=p.v[0]*spread*dt;p.r[1]-=p.v[1]*spread*dt;}
  for(const p of state.trail)p.age+=dt;
  for(let k=Math.max(0,count-max);k<count;k++){
    const at=interval-acc+k*interval,f=dt>0?Math.max(0,Math.min(1,at/dt)):1,age=Math.max(0,dt-at);
    const x=previous.x+(pose.x-previous.x)*f,z=previous.z+(pose.z-previous.z)*f;
    let dx=previous.dx+(pose.dx-previous.dx)*f,dz=previous.dz+(pose.dz-previous.dz)*f;const norm=Math.hypot(dx,dz);if(norm>1e-8){dx/=norm;dz/=norm;}else{const n=Math.hypot(pose.dx,pose.dz);dx=pose.dx/n;dz=pose.dz/n;}
    const nx=-dz,nz=dx,sx=x-dx*.5,sz=z-dz*.5,offset=corridor?latOffset:.06+spread*age;
    state.trail.unshift({l:[sx+nx*offset,sz+nz*offset],r:[sx-nx*offset,sz-nz*offset],v:[nx,nz],age});
  }
  state.trail.length=Math.min(state.trail.length,max);state.acc=Math.max(0,total-count*interval);state.lastPose={...pose};
  return count;
}

/** 901469409579061248 "Working on nicer ship wakes" — REACode wake.js Wake/Ship particles.
 * Two broadside emitters push foam outward at a fixed speed; the V is the geometric result:
 * lateral speed = (ship speed - trailing speed)·tan(θ), so the edge makes θ with the track and an
 * old V stays where it was when the ship turns. A third of the foam is a faint central veil, and a
 * few short-lived square spray chips fly off the bow. θ defaults to the Kelvin half-angle; pixel
 * constants from the 2D lab are expressed relative to hull length/beam here.
 */
export const KELVIN=19.47;
/** 尾迹长度按**船长**标定而不是按秒：原片里远端淡出出现在船后约 3 个船长处，
 *  速度一变（绕岛大圈 vs 近岸慢速）秒数就得跟着变，否则同一条寿命在快船上拖 7 个船长、慢船上只剩 1 个。
 *  `hulls` = 目标可见长度（船长倍数），返回该船速下的寿命（秒），并夹在 [1.2, 6.4]。 */
export function wakeLife(len,speed,hulls=3.2){
  if(![len,speed,hulls].every(Number.isFinite)||len<=0||speed<0||hulls<=0)throw new RangeError('Invalid wake life');
  return Math.max(1.2,Math.min(6.4,hulls*len/Math.max(1e-6,speed)));
}
/**
 * 第 183 轮补 `corridor` 档：原片 901469409579061248 逐帧看下来**不是 Kelvin V**。
 * frame-0060 / frame-0120 的 4× 裁切：船尾两条白边线在整段尾迹上**近似平行**（间距 ≈ 船宽 3–4 倍，
 * 不随距离张开），线间是**成排的 X / chevron 泡沫碎块**（近船密、远端稀）。
 * V 档（默认，REACode 口径）保留不动；corridor 档做的是：
 *   1. 边缘泡沫**只向两侧各推 fixedOffset**，横向速度 0 → 两条边线恒定间距、不张开；
 *   2. 内部泡沫按**行**发射（沿航迹每 rowStep·len 一行），行内按 rowFill 概率跳格
 *      → 断续的横向泡沫排，而不是一层连续薄雾。
 * 两个档共用同一套粒子/衰减/测量接口，页面和测试都能 A/B。
 */
export function makeWakeParticles({angle=KELVIN,life=3.6,rate=60,sprayRate=7,seed=7,max=4000,corridor=false,corridorBeam=3.4,rowStep=1.1,rowFill=.55,edgeLife=0,edgePower=.85,rowPower=1.75,bowSize=.14}={}){
 if(![angle,life,rate,sprayRate,seed,corridorBeam,rowStep,rowFill,edgeLife,edgePower,rowPower,bowSize].every(Number.isFinite)||angle<=0||angle>=60||life<=0||rate<0||sprayRate<0||!Number.isInteger(max)||max<1)throw new RangeError('Invalid wake particles');
 if(!(corridorBeam>=1)||!(rowStep>0)||!(rowFill>0&&rowFill<=1))throw new RangeError('Invalid wake corridor params');
 if(!(edgePower>0&&rowPower>0)||!(bowSize>=0))throw new RangeError('Invalid wake fade params');
 const eLife=edgeLife>0?edgeLife:life*1.5;   // 边线寿命（远端淡出的尾巴比内部泡沫长）
 const EDGE_HULLS=3.2,ROW_HULLS=1.5;   // 片内标定：边线拖到 ~3 个船长，内部泡沫约一半
 let a=seed>>>0;const r=()=>{a=(a+0x6d2b79f5)>>>0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
 const th=angle*Math.PI/180,foam=[],spray=[],acc=new Map();let emitted=0,rows=0;
 function emitFoam(s,side){
  if(corridor){
   // 边线：只给固定横向偏移，不给横向速度（→ 两条线平行，不张开）
   const c=s.dx,sn=s.dz,px=-sn,pz=c,atBow=-s.len*.42,along=s.speed*.1;   // 泡沫留在原地（只随水流微漂）→ 尾迹长度 = 航速×寿命
   const lat=side*(s.beam*corridorBeam/2),edgeLen=wakeLife(s.len,s.speed,EDGE_HULLS);
   foam.push({x:s.x+c*atBow+px*lat,z:s.z+sn*atBow+pz*lat,vx:c*along,vz:sn*along,age:0,life:edgeLen*(.85+.45*r()),size:(.30+.10*r())*s.beam,grow:.02*s.beam,shade:.75+.25*r(),veil:false,row:-1,power:edgePower,ship:s.id});
   emitted++;if(foam.length>max)foam.shift();
   return;
  }
  const veil=side===0,c=s.dx,sn=s.dz,px=-sn,pz=c,atBow=veil?-s.len*.45:s.len*.36,along=s.speed*(veil?.3:.42);
  const across=(s.speed-along)*Math.tan(th)*(veil?.12:1),sc=(r()-.5)*s.len*.06;
  let x=s.x+c*(atBow+sc)+px*side*s.beam*.5,z=s.z+sn*(atBow+sc)+pz*side*s.beam*.5;
  if(veil){x+=(r()-.5)*s.beam;z+=(r()-.5)*s.beam;}
  foam.push({x,z,vx:c*along+px*side*across+(r()-.5)*across*.045,vz:sn*along+pz*side*across+(r()-.5)*across*.045,age:0,life:life*(.72+.56*r()),size:(veil?.3:.14)*s.beam*(1+r()),grow:(veil?.1:.06)*s.beam,shade:veil?.2+.1*r():.7+.3*r(),veil,row:-1,ship:s.id});
  emitted++;if(foam.length>max)foam.shift();
 }
 /** corridor 专用：一行横跨泡沫（按 rowFill 跳格 → 断续） */
 function emitRow(s){
  const c=s.dx,sn=s.dz,px=-sn,pz=c,half=s.beam*corridorBeam/2,slots=Math.max(2,Math.round(corridorBeam*1.5)),id=rows++;
  for(let i=0;i<slots;i++){
   if(r()>rowFill)continue;                                  // 空出来的格子就是"断"
   const lat=-half+((i+.5)/slots)*half*2,along=s.speed*.1,rowLen=wakeLife(s.len,s.speed,ROW_HULLS);
   foam.push({x:s.x+px*lat-c*s.len*.08,z:s.z+pz*lat-sn*s.len*.08,vx:c*along,vz:sn*along,age:0,life:rowLen*(.9+.4*r()),size:(.55+.2*r())*s.beam,grow:.02*s.beam,shade:.6+.3*r(),veil:true,row:id,power:rowPower,ship:s.id});
   emitted++;if(foam.length>max)foam.shift();
  }
 }
 function emitSpray(s,side){
  const c=s.dx,sn=s.dz,px=-sn,pz=c,atBow=s.len*(.34+.1*r()),v=s.speed*(.5+.5*r()),out=.35+.5*r();
  // corridor 档按片内标定：船头只是一小撮白（宽 ≈ 0.14–0.27 beam），没有舷侧大团喷溅
  const w=s.beam*(corridor?bowSize*(1+.9*r()):(.2+.25*r()));
  spray.push({x:s.x+c*atBow+px*side*s.beam*.55,z:s.z+sn*atBow+pz*side*s.beam*.55,vx:c*v*.5+px*side*v*out,vz:sn*v*.5+pz*side*v*out,age:0,life:.45+.7*r(),w,rot:r()*6.283,spin:(r()-.5)*3});
  if(spray.length>max)spray.shift();
 }
 function step(dt,ships){
  if(!Number.isFinite(dt)||dt<0||!Array.isArray(ships))throw new RangeError('Invalid wake step');
  for(const s of ships){
   if(![s.x,s.z,s.dx,s.dz,s.speed,s.len,s.beam].every(Number.isFinite)||s.speed<0||s.len<=0||s.beam<=0||Math.abs(Math.hypot(s.dx,s.dz)-1)>1e-6)throw new RangeError('Invalid wake ship');
   const k=acc.get(s.id)??{foam:0,spray:0};
   k.foam+=rate*dt*2*Math.min(1,s.speed/Math.max(1e-9,s.len*.4));
   if(corridor){
    k.dist=(k.dist??0)+s.speed*dt;                              // 按航迹里程发"行"，不是按时间
    while(k.dist>=rowStep*s.len){k.dist-=rowStep*s.len;emitRow(s);}
    while(k.foam>=1){k.foam-=1;k.side=k.side===1?-1:1;emitFoam(s,k.side);}
   }else{
    while(k.foam>=1){k.foam-=1;const roll=r();emitFoam(s,roll<.32?0:r()<.5?-1:1);}
   }
   k.spray+=sprayRate*dt*2*Math.min(1,s.speed/Math.max(1e-9,s.len*.4));
   while(k.spray>=1){k.spray-=1;emitSpray(s,r()<.5?-1:1);}
   acc.set(s.id,k);
  }
  for(let i=foam.length-1;i>=0;i--){const p=foam[i];p.age+=dt;if(p.age>=p.life){foam.splice(i,1);continue;}p.x+=p.vx*dt;p.z+=p.vz*dt;p.size+=p.grow*dt;}
  const damp=Math.pow(.12,dt);
  for(let i=spray.length-1;i>=0;i--){const p=spray[i];p.age+=dt;if(p.age>=p.life){spray.splice(i,1);continue;}p.x+=p.vx*dt;p.z+=p.vz*dt;p.vx*=damp;p.vz*=damp;p.rot+=p.spin*dt;}
 }
 const alphaOf=(p,k=1.7)=>Math.pow(Math.max(0,1-p.age/p.life),p.power??k)*p.shade;
 /** Least-squares edge slope lat = k·back for one ship on a straight course → atan(k). */
 function measureAngle(s){
  const pts=[];for(const p of foam){if(p.veil||p.ship!==s.id)continue;const dx=p.x-s.x,dz=p.z-s.z,along=dx*s.dx+dz*s.dz,lat=Math.abs(-dx*s.dz+dz*s.dx);if(along<-s.len*.4&&lat>s.beam*.2)pts.push([-along,lat]);}
  if(pts.length<9)return{angleDeg:NaN,samples:pts.length};
  let sx=0,sy=0,sxx=0,sxy=0;for(const [x,y]of pts){sx+=x;sy+=y;sxx+=x*x;sxy+=x*y;}const n=pts.length,k=(n*sxy-sx*sy)/(n*sxx-sx*sx);
  return{angleDeg:Math.atan(Math.max(0,k))*180/Math.PI,samples:n};
 }
/** 横向半宽（世界单位）：只数非 veil 的边线粒子，用于比较 V 档张开 / corridor 档恒宽 */
function width(s){
  let m=0;for(const p of foam){if(p.veil||p.ship!==s.id)continue;const dx=p.x-s.x,dz=p.z-s.z;m=Math.max(m,Math.abs(-dx*s.dz+dz*s.dx));}
  return m;
}
/** 逐距离分桶读数（沿航迹、单位=船长）：边线/行的粒子数与平均 alpha、边线的内外侧横向位置。
 * 两条用途：① corridor 档「间距恒定 vs V 档张开」可量化；② 远端淡出曲线（reach = 仍可见的最远船长数）。 */
function profile(s,{bins=6,min=.1}={}){
  const out=[];
  for(let i=0;i<bins;i++)out.push({from:i,to:i+1,edge:0,row:0,edgeAlpha:0,rowAlpha:0,minLat:Infinity,maxLat:0});
  for(const p of foam){
    if(p.ship!==s.id)continue;
    const dx=p.x-s.x,dz=p.z-s.z,along=-(dx*s.dx+dz*s.dz)/s.len,lat=Math.abs(-dx*s.dz+dz*s.dx)/s.len;
    if(!(along>=0&&along<bins))continue;
    const b=out[Math.floor(along)];
    if(p.veil){b.row++;b.rowAlpha+=alphaOf(p);}
    else{b.edge++;b.edgeAlpha+=alphaOf(p);b.minLat=Math.min(b.minLat,lat);b.maxLat=Math.max(b.maxLat,lat);}
  }
  let edgeReach=0,rowReach=0;
  for(const p of foam){if(p.ship!==s.id||alphaOf(p)<min)continue;const dx=p.x-s.x,dz=p.z-s.z,along=-(dx*s.dx+dz*s.dz)/s.len;p.veil?rowReach=Math.max(rowReach,along):edgeReach=Math.max(edgeReach,along);}
  for(const b of out){b.edgeAlpha=b.edge?b.edgeAlpha/b.edge:0;b.rowAlpha=b.row?b.rowAlpha/b.row:0;if(!Number.isFinite(b.minLat))b.minLat=0;}
  return{len:s.len,buckets:out,reach:{edge:edgeReach,row:rowReach}};
}
 return{foam,spray,step,alphaOf,measureAngle,width,profile,corridor,angle,edgeLife:eLife,edgePower,rowPower,get emitted(){return emitted;},get rows(){return rows;}};
}
/** 边线/带状淡出：与粒子同一条幂律（boats.js 的 ribbon alpha 也走这里，避免两条曲线各说各话）。 */
export function wakeFade(age,life,power=.85){return Math.pow(Math.max(0,1-age/Math.max(1e-9,life)),power);}
