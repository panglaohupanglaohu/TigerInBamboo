import * as T from 'three';
/**
 * Castle-in-lake patrol support for the Morris Townscaper town.
 * - seeds one courtyard castle + causeway on a fresh town;
 * - derives a walkable level-1 route from the shore into the courtyard;
 * - keeps the island patrol route in sync whenever the player edits the town.
 */
const CASTLE_WALL_SLOTS=[3,6,13,8,11];

function neighbours(town,cell){
 return cell.edgeNeighbors.filter(id=>id>=0).map(id=>town.grid.cells[id]);
}
function allNeighbours(cell){
 return [...cell.edgeNeighbors,...cell.cornerNeighbors].filter(id=>id>=0);
}
export function seedMorrisCastle(town,allowed){
 if(!town?.grid?.cells)return false;
 if(town.cells.some(c=>town.top(c)>0))return false;
 const cells=town.grid.cells;
 const centre=cells.reduce((best,c)=>Math.hypot(c.cx,c.cz)<Math.hypot(best.cx,best.cz)?c:best,cells[0]);
 const court=new Set([centre.id,...neighbours(town,centre).map(c=>c.id)]);
 const ring=new Set();
 for(const id of court)for(const other of allNeighbours(cells[id]))if(!court.has(other))ring.add(other);
 if(!ring.size)return false;
 const gateCandidates=[...ring].map(id=>cells[id]).filter(c=>allowed(c)&&neighbours(town,c).some(n=>court.has(n.id)));
 const gate=gateCandidates.reduce((best,c)=>!best||c.z>best.z?c:best,null);
 if(!gate)return false;
 for(const id of court){if(!allowed(cells[id]))return false;}
 // Select the causeway before walls so it can pass through the outer ring.
 let current=gate,visited=new Set([gate.id]);
 while(visited.size<18){
  const next=neighbours(town,current).filter(c=>!visited.has(c.id)&&!court.has(c.id)&&allowed(c)).reduce((best,c)=>{
   if(!best)return c;
   if(Math.abs(c.z-best.z)>.06)return c.z>best.z?c:best;
   const dr=Math.hypot(c.cx,c.cz)-Math.hypot(best.cx,best.cz);
   if(Math.abs(dr)>.06)return dr>0?c:best;
   return Math.abs(c.cx)<Math.abs(best.cx)?c:best;
  },null);
  if(!next)break;
  visited.add(next.id);current=next;
 }
 const causeway=visited;
 for(const id of court){town.fill(cells[id],1);town.colors[id]=7;}
 let index=0;
 for(const id of ring){
  const cell=cells[id];if(!allowed(cell)||causeway.has(id))continue;
  const level=index%3===0?3:2;
  town.fill(cell,level);town.colors[id]=CASTLE_WALL_SLOTS[index%CASTLE_WALL_SLOTS.length];index++;
 }
 for(const id of causeway){town.fill(cells[id],1);town.colors[id]=6;}
 town.version++;
 return true;
}
function routeAt(points,length){
 const at=s=>{
  s=T.MathUtils.clamp(s,0,length);let j=1;
  while(j<points.length-1&&points[j].s<s)j++;
  const a=points[j-1],b=points[j],d=(b.s-a.s)||1,t=(s-a.s)/d;
  return{x:T.MathUtils.lerp(a.x,b.x,t),z:T.MathUtils.lerp(a.z,b.z,t),h:T.MathUtils.lerp(a.h,b.h,t),s,tx:(b.x-a.x)/d,tz:(b.z-a.z)/d};
 };
 const nearest=(x,z)=>{let best={distance:Infinity};for(const p of points){const distance=Math.hypot(x-p.x,z-p.z);if(distance<best.distance)best={...p,distance};}return best;};
 return{at,nearest};
}
export function installMorrisCastlePatrol({root,terrain,edge,town,scale=3,supports=[]}){
 const base={...terrain.route},basePoints=base.points;
 let seen=null,connector=null;
 const removeConnector=()=>{if(!connector)return;const index=supports.indexOf(connector);if(index>=0)supports.splice(index,1);connector.geometry.dispose();connector.material.dispose();connector.removeFromParent();connector=null;};
 function makeConnector(a,b){
  const dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz)+1.6;
  const mesh=new T.Mesh(new T.BoxGeometry(2.4,.3,length),new T.MeshStandardMaterial({color:0xb9a98a,roughness:.95}));
  mesh.name='morris-castle-patrol-causeway-link';mesh.position.set((a.x+b.x)/2,terrain.waterY+1.35,(a.z+b.z)/2);
  mesh.rotation.y=Math.atan2(dx,dz);mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);supports.push(mesh);return mesh;
 }
 function findCastlePath(){
  const cells=town.cells,solid=cells.filter(c=>town.top(c)>=2);
  if(!solid.length)return null;
  const centre=solid.reduce((acc,c)=>({x:acc.x+c.cx/3,y:acc.y+c.cz/3,n:acc.n+1}),{x:0,y:0,n:0});
  const walkable=cells.filter(c=>town.top(c)===1&&town.isSolid(c,1));
  if(walkable.length<4)return null;
  const courtyardScore=c=>allNeighbours(c).reduce((n,id)=>n+(town.top(town.grid.cells[id])>=2?1:0),0);
  const target=walkable.reduce((best,c)=>{
   const score=courtyardScore(c),bestScore=courtyardScore(best);
   if(score!==bestScore)return score>bestScore?c:best;
   const d=(c.cx/3-centre.x)**2+(c.cz/3-centre.y)**2,bd=(best.cx/3-centre.x)**2+(best.cz/3-centre.y)**2;
   return d<bd?c:best;
  },walkable[0]);
  const parent=new Map([[target.id,null]]),queue=[target];
  while(queue.length){
   const cell=queue.shift();
   for(const nb of neighbours(town,cell)){
    if(parent.has(nb.id)||!(town.top(nb)===1&&town.isSolid(nb,1)))continue;
    parent.set(nb.id,cell.id);queue.push(nb);
   }
  }
  const shore=walkable.filter(c=>parent.has(c.id)).reduce((best,c)=>{
   if(!best)return c;
   const r=Math.hypot(c.cx,c.cz),br=Math.hypot(best.cx,best.cz);
   return r>br?c:best;
  },null);
  if(!shore)return null;
  const chain=[];for(let id=shore.id;id!=null;id=parent.get(id))chain.push(cells[id]);
  if(chain.length<3)return null;
  return{target,shore,chain};
 }
 function buildRoute(){
  const found=findCastlePath();
  if(!found){removeConnector();Object.assign(terrain.route,{...base,castlePatrol:false,patrolRevision:'base'});return null;}
  const {shore,chain}=found,a=Math.atan2(shore.cz,shore.cx),bankR=edge(a)*.951;
  const bank={x:Math.cos(a)*bankR,z:Math.sin(a)*bankR,h:terrain.waterY+.6};
  const spur=[bank,...chain.map(c=>({x:c.cx*scale,z:c.cz*scale,h:terrain.waterY+1.5}))];
  const start=basePoints.reduce((best,p,i)=>{
   const pa=Math.atan2(p.z,p.x),ba=Math.atan2(bank.z,bank.x),bestA=Math.atan2(basePoints[best].z,basePoints[best].x);
   let d=Math.abs(((pa-ba+Math.PI*3)%(Math.PI*2))-Math.PI),bd=Math.abs(((bestA-ba+Math.PI*3)%(Math.PI*2))-Math.PI);
   return d<bd?i:best;
  },0);
  const circle=[];
  for(let k=1;k<=basePoints.length;k++)circle.push(basePoints[(start+k)%basePoints.length]);
  circle.push(basePoints[start]);
  const points=[];let length=0,previous=null;
  const push=p=>{if(previous)length+=Math.hypot(p.x-previous.x,p.z-previous.z);points.push({...p,s:length});previous=p;};
  for(const p of spur)push(p);
  const spurDistance=length,courtDistance=spurDistance;
  for(let j=spur.length-2;j>=0;j--)push(spur[j]);
  for(const p of circle)push(p);
  const {at,nearest}=routeAt(points,length);
  Object.assign(terrain.route,{points,branch:[],length,patrolLength:length,at,patrolAt:at,nearest,
   isBridge:s=>s<spurDistance-1,isPatrolBridge:s=>s<spurDistance-1,
   patrolBridgeS:courtDistance,branchAt:()=>at(length/2),branchReport:{length:0},
   bridge:{...at(spurDistance*.6),k:0},shoulder:2,castlePatrol:true,castleCourtS:courtDistance,
   patrolRevision:`castle-${town.version}-${courtDistance.toFixed(1)}`,
   report:{...base.report,revision:'castle-patrol-route-r1',marks:{eastEnd:length/4,castleCourt:courtDistance}}});
  removeConnector();connector=makeConnector(bank,{x:shore.cx*scale,z:shore.cz*scale});
  return terrain.route;
 }
 const update=()=>{
  if(town.version===seen)return;
  seen=town.version;buildRoute();
 };
 return{
  update,
  status(){return{active:!!terrain.route.castlePatrol,revision:terrain.route.patrolRevision??'base',courtDistance:terrain.route.castleCourtS??null};},
  rebuild(){seen=null;update();},
  dispose(){removeConnector();Object.assign(terrain.route,{...base,castlePatrol:false,patrolRevision:'base'});}
 };
}
