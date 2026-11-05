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
