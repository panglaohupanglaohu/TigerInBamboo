// Swept centre clearance for friendly marching units. Equipment still needs
// its own animated clearance checks; this prevents bodies overtaking in a queue.
export function marchFraction(position,delta,actor,peers,clearance=.6) {
  const a=delta.x*delta.x+delta.y*delta.y+delta.z*delta.z;
  if(a<1e-12)return 1;
  let allowed=1;
  for(const other of peers){
    if(other===actor||!other.visible||other.userData.dead)continue;
    const q=other.position,x=position.x-q.x,y=position.y-q.y,z=position.z-q.z;
    const c=x*x+y*y+z*z-clearance*clearance,b=x*delta.x+y*delta.y+z*delta.z;
    // Already crowded spawn points may separate, but cannot move closer.
    if(c<0){if(b<0)allowed=0;continue;}
    if(b>=0)continue;
    const disc=b*b-a*c;if(disc<0)continue;
    const enter=(-b-Math.sqrt(disc))/a;
    if(enter>=0&&enter<allowed)allowed=Math.max(0,enter-.001/Math.sqrt(a));
  }
  return allowed;
}
