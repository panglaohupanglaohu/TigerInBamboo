/** Fixed time sampling of existing world-space V ribbons; not original wake physics. */
export function advanceWake(state,pose,dt,{interval=.06,spread=.18,max=70}={}) {
  if(![dt,interval,spread,pose.x,pose.z,pose.dx,pose.dz].every(Number.isFinite)||dt<0||interval<=0||spread<0||!Number.isInteger(max)||max<1||Math.hypot(pose.dx,pose.dz)<1e-12)throw new RangeError('Invalid wake step');
  const previous=state.lastPose??pose,acc=state.acc??0,total=acc+dt,count=Math.floor((total+1e-10)/interval);
  for(const p of state.trail){p.age+=dt;p.l[0]+=p.v[0]*spread*dt;p.l[1]+=p.v[1]*spread*dt;p.r[0]-=p.v[0]*spread*dt;p.r[1]-=p.v[1]*spread*dt;}
  for(let k=Math.max(0,count-max);k<count;k++){
    const at=interval-acc+k*interval,f=dt>0?Math.max(0,Math.min(1,at/dt)):1,age=Math.max(0,dt-at);
    const x=previous.x+(pose.x-previous.x)*f,z=previous.z+(pose.z-previous.z)*f;
    let dx=previous.dx+(pose.dx-previous.dx)*f,dz=previous.dz+(pose.dz-previous.dz)*f;const norm=Math.hypot(dx,dz);if(norm>1e-8){dx/=norm;dz/=norm;}else{const n=Math.hypot(pose.dx,pose.dz);dx=pose.dx/n;dz=pose.dz/n;}
    const nx=-dz,nz=dx,sx=x-dx*.5,sz=z-dz*.5,offset=.06+spread*age;
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
export function makeWakeParticles({angle=KELVIN,life=3.6,rate=60,sprayRate=7,seed=7,max=4000}={}){
 if(![angle,life,rate,sprayRate,seed].every(Number.isFinite)||angle<=0||angle>=60||life<=0||rate<0||sprayRate<0||!Number.isInteger(max)||max<1)throw new RangeError('Invalid wake particles');
 let a=seed>>>0;const r=()=>{a=(a+0x6d2b79f5)>>>0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};
 const th=angle*Math.PI/180,foam=[],spray=[],acc=new Map();let emitted=0;
 function emitFoam(s,side){
  const veil=side===0,c=s.dx,sn=s.dz,px=-sn,pz=c,atBow=veil?-s.len*.45:s.len*.36,along=s.speed*(veil?.3:.42);
  const across=(s.speed-along)*Math.tan(th)*(veil?.12:1),sc=(r()-.5)*s.len*.06;
  let x=s.x+c*(atBow+sc)+px*side*s.beam*.5,z=s.z+sn*(atBow+sc)+pz*side*s.beam*.5;
  if(veil){x+=(r()-.5)*s.beam;z+=(r()-.5)*s.beam;}
  foam.push({x,z,vx:c*along+px*side*across+(r()-.5)*across*.045,vz:sn*along+pz*side*across+(r()-.5)*across*.045,age:0,life:life*(.72+.56*r()),size:(veil?.3:.14)*s.beam*(1+r()),grow:(veil?.1:.06)*s.beam,shade:veil?.2+.1*r():.7+.3*r(),veil,ship:s.id});
  emitted++;if(foam.length>max)foam.shift();
 }
 function emitSpray(s,side){
  const c=s.dx,sn=s.dz,px=-sn,pz=c,atBow=s.len*(.34+.1*r()),v=s.speed*(.5+.5*r()),out=.35+.5*r();
  spray.push({x:s.x+c*atBow+px*side*s.beam*.55,z:s.z+sn*atBow+pz*side*s.beam*.55,vx:c*v*.5+px*side*v*out,vz:sn*v*.5+pz*side*v*out,age:0,life:.45+.7*r(),w:s.beam*(.2+.25*r()),rot:r()*6.283,spin:(r()-.5)*3});
  if(spray.length>max)spray.shift();
 }
 function step(dt,ships){
  if(!Number.isFinite(dt)||dt<0||!Array.isArray(ships))throw new RangeError('Invalid wake step');
  for(const s of ships){
   if(![s.x,s.z,s.dx,s.dz,s.speed,s.len,s.beam].every(Number.isFinite)||s.speed<0||s.len<=0||s.beam<=0||Math.abs(Math.hypot(s.dx,s.dz)-1)>1e-6)throw new RangeError('Invalid wake ship');
   const k=acc.get(s.id)??{foam:0,spray:0};
   k.foam+=rate*dt*2*Math.min(1,s.speed/Math.max(1e-9,s.len*.4));
   while(k.foam>=1){k.foam-=1;const roll=r();emitFoam(s,roll<.32?0:r()<.5?-1:1);}
   k.spray+=sprayRate*dt*2*Math.min(1,s.speed/Math.max(1e-9,s.len*.4));
   while(k.spray>=1){k.spray-=1;emitSpray(s,r()<.5?-1:1);}
   acc.set(s.id,k);
  }
  for(let i=foam.length-1;i>=0;i--){const p=foam[i];p.age+=dt;if(p.age>=p.life){foam.splice(i,1);continue;}p.x+=p.vx*dt;p.z+=p.vz*dt;p.size+=p.grow*dt;}
  const damp=Math.pow(.12,dt);
  for(let i=spray.length-1;i>=0;i--){const p=spray[i];p.age+=dt;if(p.age>=p.life){spray.splice(i,1);continue;}p.x+=p.vx*dt;p.z+=p.vz*dt;p.vx*=damp;p.vz*=damp;p.rot+=p.spin*dt;}
 }
 const alphaOf=(p,k=1.7)=>Math.pow(1-p.age/p.life,k)*p.shade;
 /** Least-squares edge slope lat = k·back for one ship on a straight course → atan(k). */
 function measureAngle(s){
  const pts=[];for(const p of foam){if(p.veil||p.ship!==s.id)continue;const dx=p.x-s.x,dz=p.z-s.z,along=dx*s.dx+dz*s.dz,lat=Math.abs(-dx*s.dz+dz*s.dx);if(along<-s.len*.4&&lat>s.beam*.2)pts.push([-along,lat]);}
  if(pts.length<9)return{angleDeg:NaN,samples:pts.length};
  let sx=0,sy=0,sxx=0,sxy=0;for(const [x,y]of pts){sx+=x;sy+=y;sxx+=x*x;sxy+=x*y;}const n=pts.length,k=(n*sxy-sx*sy)/(n*sxx-sx*sx);
  return{angleDeg:Math.atan(Math.max(0,k))*180/Math.PI,samples:n};
 }
 return{foam,spray,step,alphaOf,measureAngle,get emitted(){return emitted;},angle};
}
