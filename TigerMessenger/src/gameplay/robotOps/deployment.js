// Keep a robot's assigned landing bay stable even if an older serial arrives later.
export const DEPLOYMENT_SPACING=5.6;
export function findDeploymentBay(units,obstacles=[],reservations=[],ignoreId=null){
 const occupied=[...units.filter(u=>u.id!==ignoreId),...reservations.filter(u=>u.id!==ignoreId)];
 for(const z of[12,6.4,.8,-4.8,-10.4])for(let x=-20;x<=20;x+=DEPLOYMENT_SPACING){
  if(obstacles.some(o=>Math.hypot(x-o.x,z-o.z)<o.radius+2.6))continue;
  if(occupied.some(u=>Math.hypot(x-u.x,z-u.z)<DEPLOYMENT_SPACING-.01))continue;
  return{x,z};
 }
 return null;
}
export function repairDeploymentOverlaps(combat){
 const placed=[],moved=[];
 for(const u of combat.units){
  if(u.team!=='friendly'){placed.push(u);continue;}
  if(placed.some(v=>Math.hypot(u.x-v.x,u.z-v.z)<5.0)){
   const p=findDeploymentBay([...placed,...combat.units.filter(v=>v!==u&&!placed.includes(v))],combat.obstacles,[],u.id);
   if(p){Object.assign(u,p);u.path=[];if(u.order.type==='hold')u.order={type:'hold',...p};moved.push(u.id);}
  }
  placed.push(u);
 }
 return moved;
}
