/** Conservative terminal berth and straight approach reservation using shared 3D SAT.
 * Sweeps the fixed-orientation padded hull along its straight 14-unit path.
 *
 * 第 53 批（G5，974325184525201409「our beautiful viking raid planner」/ REACode boxtest.planRaid）：
 *   · 地形岸礁：航道（泊位以外那段）的俯视矩形不得压到任何陆地格（礁石、石柱、别处海岸）——凸多边形 SAT；
 *   · 车道 × 角度：原版每个站位试多条车道/±0.35 rad；这里同一个登陆点先试正对岸的方向，被占/被礁挡就试偏 ±0.35；
 * Still no time-parameterized sweep between moving hulls.
 */
import{makeBox,obbOverlap,obbFootprintXZ,convexOverlapXZ}from'../core/obb.js';
export const LANE_ANGLES=Object.freeze([0,-.35,.35]);
export function berthBox(stop,dir){return makeBox([stop[0],0,stop[1]],[.74,.2,.26],[0,-Math.atan2(dir[1],dir[0]),0]);}
export function approachBox(stop,dir){return makeBox([stop[0]+dir[0]*7,0,stop[1]+dir[1]*7],[7+.74,.2,.26],[0,-Math.atan2(dir[1],dir[0]),0]);}
/** 泊位之外的航道（从船尾 0.8 处到 14.74）——用于地形检测；泊位本身靠岸，允许擦到海岸格。 */
export function seawayBox(stop,dir){const a=.8,b=14.74,m=(a+b)/2;return makeBox([stop[0]+dir[0]*m,0,stop[1]+dir[1]*m],[(b-a)/2,.2,.26],[0,-Math.atan2(dir[1],dir[0]),0]);}
export function seawayBlocked(world,stop,dir,{except=[]}={}){
 const lane=obbFootprintXZ(seawayBox(stop,dir));
 return world.cells.some(c=>c.pts&&!except.includes(c)&&world.top(c)>0&&convexOverlapXZ(lane,c.pts));
}
export function planLanding(world,boats,{random=Math.random,angles=LANE_ANGLES,terrain=true}={}){
 const cells=world.cells,landings=cells.filter(c=>{const t=world.top(c);return t>=1&&t<=2&&t===world.ground(c)&&c.edgeNeighbors.some(id=>id>=0&&world.top(cells[id])===0);});
 if(!landings.length)return null;
 const start=Math.min(landings.length-1,Math.max(0,Math.floor(random()*landings.length)));
 const reserved=boats.map(b=>berthBox(b.stop,b.dir)),approaches=boats.map(b=>approachBox(b.stop,b.dir));   // 离港也走同一条航道，所以整段航道一直占着
 for(let k=0;k<landings.length;k++){
  const land=landings[(start+k)%landings.length];
  for(const id of land.edgeNeighbors){if(id<0||world.top(cells[id])!==0)continue;const sea=cells[id],dx=sea.cx-land.cx,dz=sea.cz-land.cz,len=Math.hypot(dx,dz);if(len<1e-9)continue;
   for(const da of angles){
    const c=Math.cos(da),s=Math.sin(da),dir=[(dx*c-dz*s)/len,(dx*s+dz*c)/len],stop=[sea.cx+dir[0]*.25,sea.cz+dir[1]*.25],box=berthBox(stop,dir);
    if(reserved.some(other=>obbOverlap(box,other)))continue;
    const approach=approachBox(stop,dir);
    if(approaches.some(other=>obbOverlap(approach,other)))continue;
    if(terrain&&seawayBlocked(world,stop,dir,{except:[land]}))continue;
    return{land,dir,stop,from:[stop[0]+dir[0]*14,stop[1]+dir[1]*14],lane:da};
   }
  }
 }return null;
}
