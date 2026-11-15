/** Conservative terminal berth and straight approach reservation using shared 3D SAT.
 * Sweeps the fixed-orientation padded hull along its straight 14-unit path.
 * No terrain collision or time-dependent avoidance claim.
 */
import{makeBox,obbOverlap}from'../core/obb.js';
export function berthBox(stop,dir){return makeBox([stop[0],0,stop[1]],[.74,.2,.26],[0,-Math.atan2(dir[1],dir[0]),0]);}
export function approachBox(stop,dir){return makeBox([stop[0]+dir[0]*7,0,stop[1]+dir[1]*7],[7+.74,.2,.26],[0,-Math.atan2(dir[1],dir[0]),0]);}
export function planLanding(world,boats,{random=Math.random}={}){
 const cells=world.cells,landings=cells.filter(c=>{const t=world.top(c);return t>=1&&t<=2&&t===world.ground(c)&&c.edgeNeighbors.some(id=>id>=0&&world.top(cells[id])===0);});
 if(!landings.length)return null;
 const start=Math.min(landings.length-1,Math.max(0,Math.floor(random()*landings.length)));
 const reserved=boats.map(b=>berthBox(b.stop,b.dir)),approaches=boats.map(b=>approachBox(b.stop,b.dir));
 for(let k=0;k<landings.length;k++){
  const land=landings[(start+k)%landings.length];
  for(const id of land.edgeNeighbors){if(id<0||world.top(cells[id])!==0)continue;const sea=cells[id],dx=sea.cx-land.cx,dz=sea.cz-land.cz,len=Math.hypot(dx,dz);if(len<1e-9)continue;
   const dir=[dx/len,dz/len],stop=[sea.cx+dir[0]*.25,sea.cz+dir[1]*.25],box=berthBox(stop,dir);
   if(reserved.some(other=>obbOverlap(box,other)))continue;
   const approach=approachBox(stop,dir);
   if(approaches.some(other=>obbOverlap(approach,other)))continue;
   return{land,dir,stop,from:[stop[0]+dir[0]*14,stop[1]+dir[1]*14]};
  }
 }return null;
}
