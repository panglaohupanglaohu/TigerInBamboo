/** Conservative terminal berth and straight approach reservation using shared 3D SAT.
 * Sweeps the fixed-orientation padded hull along its straight 14-unit path.
 *
 * 第 53 批（G5，974325184525201409「our beautiful viking raid planner」/ REACode boxtest.planRaid）：
 *   · 地形岸礁：航道（泊位以外那段）的俯视矩形不得压到任何陆地格（礁石、石柱、别处海岸）——凸多边形 SAT；
 *   · 车道 × 角度：原版每个站位试多条车道/±0.35 rad；这里同一个登陆点先试正对岸的方向，被占/被礁挡就试偏 ±0.35；
 * 本轮补岸礁后两段与动态避让（本地近似，原片避让机制未公开）：
 *   · 离港段：seawayBox 由 0.8–14.74 延到 19.94（'out' 走到 ~19.2 + 半个船长），出港压陆地同样拒线；
 *   · 母船航线：corridorBlocked 给任意两点（母船 → 泊位外沿）做同一套岸礁检测，battle.js 发船时只在
 *     航线干净的候选里挑最近滩，全压陆地就退回标准直线走廊；
 *   · 动态避让 steerBoat：在航船把高优先级船当障碍，先试直线、再按侧偏表找干净走廊，全堵则停船等让。
 * Still no time-parameterized swept test between moving hulls —— steerBoat 是让行/侧让，不是扫掠。
 */
import{makeBox,obbOverlap,obbFootprintXZ,convexOverlapXZ}from'../core/obb.js';
export const LANE_ANGLES=Object.freeze([0,-.35,.35]);
export function berthBox(stop,dir){return makeBox([stop[0],0,stop[1]],[.74,.2,.26],[0,-Math.atan2(dir[1],dir[0]),0]);}
export function approachBox(stop,dir){return makeBox([stop[0]+dir[0]*7,0,stop[1]+dir[1]*7],[7+.74,.2,.26],[0,-Math.atan2(dir[1],dir[0]),0]);}
/** 泊位之外的航道（从船尾 0.8 处到 19.94，含整段离港）——用于地形检测；泊位本身靠岸，允许擦到海岸格。 */
export function seawayBox(stop,dir){const a=.8,b=19.94,m=(a+b)/2;return makeBox([stop[0]+dir[0]*m,0,stop[1]+dir[1]*m],[(b-a)/2,.2,.26],[0,-Math.atan2(dir[1],dir[0]),0]);}
export function seawayBlocked(world,stop,dir,{except=[]}={}){
 const lane=obbFootprintXZ(seawayBox(stop,dir));
 return world.cells.some(c=>c.pts&&!except.includes(c)&&world.top(c)>0&&convexOverlapXZ(lane,c.pts));
}
/** 任意两点之间的走廊盒（俯视长条）：母船航线、侧偏候选的岸礁检测共用。
 * pad 只沿 a→b 方向伸过 b，不回伸 a（近端由调用方挑在安全水域）。 */
export function corridorBox(a,b,{pad=0,halfWidth=.3}={}){
 const dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz);
 if(len<1e-9)return null;
 const dir=[dx/len,dz/len],m=(len+pad)/2;
 return makeBox([a[0]+dir[0]*m,0,a[1]+dir[1]*m],[m,.2,halfWidth],[0,-Math.atan2(dir[1],dir[0]),0]);
}
/** 走廊压陆地判定：与 seawayBlocked 同一套凸多边形 SAT；except 里放泊位贴岸的那个格。 */
export function corridorBlocked(world,a,b,{except=[],halfWidth=.3,pad=0}={}){
 const box=corridorBox(a,b,{pad,halfWidth});
 if(!box)return false;
 const lane=obbFootprintXZ(box);
 return world.cells.some(c=>c.pts&&!except.includes(c)&&world.top(c)>0&&convexOverlapXZ(lane,c.pts));
}
/** 2D 两线段最小距离平方（动态避让的距离场）。 */
function segSegDist2(px,pz,qx,qz,ax,az,bx,bz){
 const ux=qx-px,uz=qz-pz,vx=bx-ax,vz=bz-az,wx=px-ax,wz=pz-az;
 const A=ux*ux+uz*uz,B=ux*vx+uz*vz,C=vx*vx+vz*vz,D=ux*wx+uz*wz,E=vx*wx+vz*wz;
 let sN,sD=A*C-B*B,tN,tD=sD;
 if(sD<1e-12){sN=0;sD=1;tN=E;tD=C;}
 else{sN=B*E-C*D;if(sN<0){sN=0;tN=E;tD=C;}else if(sN>sD){sN=sD;tN=E+B;tD=C;}}
 if(tN<0){tN=0;if(-D<0)sN=0;else if(-D>A)sN=sD;else{sN=-D;sD=A;}}
 else if(tN>tD){tN=tD;if((-D+B)<0)sN=0;else if((-D+B)>A)sN=sD;else{sN=-D+B;sD=A;}}
 const sc=Math.abs(sN)<1e-12?0:sN/sD,tc=Math.abs(tN)<1e-12?0:tN/tD;
 const dx=wx+sc*ux-tc*vx,dz=wz+sc*uz-tc*vz;
 return dx*dx+dz*dz;
}
/** 动态避让（本地近似，原片避让机制未公开——不是时间参数化扫掠，是让行 + 侧让）。
 * 障碍序：卸货中的船（'unload'，占着泊位）挡所有船；离港（'out'）先于进港（'in'）走；同态按数组序先发先行
 * —— 所以最多只有一艘等，不会互等死锁。
 * 每个候选侧偏 s 把「当前位置 → 前方 reach 一段」整体平移 perp·s（perp = 行进方向左手），
 * 要求它跟每条障碍航线段相距 ≥ clear，且（world 存在且未到泊位跟前时）不压陆地；全堵就 hold。
 * @param me  本条船（{x,z,stop,dir,state}）
 * @param others  全部船（含 me；靠 i 跳过自己）
 * @param i  me 在 others 里的下标
 * @returns {{offset:number,hold:boolean}} offset=建议侧偏（左手为正），hold=true=本帧停船等让。 */
export function steerBoat(me,others,i,{clear=.9,ahead=2.6,side=[0,.55,-.55,1.1,-1.1],world=null,except=[]}={}){
 const st=me.state;let fx,fz,rem=Infinity;
 if(st==='out'){fx=me.dir[0];fz=me.dir[1];}
 else if(st==='in'){const dx=me.stop[0]-me.x,dz=me.stop[1]-me.z;rem=Math.hypot(dx,dz);if(rem<1e-6)return{offset:0,hold:false};fx=dx/rem;fz=dz/rem;}
 else return{offset:0,hold:false};
 const reach=st==='in'?Math.min(ahead,rem+.4):ahead,px=-fz,pz=fx;
 const obstacles=[];
 for(let j=0;j<others.length;j++){
  if(j===i)continue;const o=others[j];
  if(!o||!o.state)continue;
  const blocks=o.state==='unload'||(o.state==='out'?st!=='out'||j<i:st==='in'&&j<i);
  if(!blocks)continue;
  // 障碍航线段：泊位船是 stop±dir·.7 的定轴；在航船向前伸 ahead
  let oa,ob;
  if(o.state==='unload'){oa=[o.x-o.dir[0]*.7,o.z-o.dir[1]*.7];ob=[o.x+o.dir[0]*.7,o.z+o.dir[1]*.7];}
  else{let ofx=0,ofz=0;if(o.state==='out'){ofx=o.dir[0];ofz=o.dir[1];}else{const dx=o.stop[0]-o.x,dz=o.stop[1]-o.z,l=Math.hypot(dx,dz);if(l>1e-6){ofx=dx/l;ofz=dz/l;}}
   oa=[o.x,o.z];ob=[o.x+ofx*ahead,o.z+ofz*ahead];}
  obstacles.push([oa,ob]);
 }
 if(!obstacles.length&&!world)return{offset:0,hold:false};
 const clear2=clear*clear;
 // 进港贴岸的最后 1.2 不再查岸礁：泊位走廊是规划期验过的，近岸岸线角点会把侧偏全部误杀成 hold
 const terrain=st==='out'?null:world&&rem>1.2?world:null;
 for(const s of side){
  const ax=me.x+px*s,az=me.z+pz*s,bx=ax+fx*reach,bz=az+fz*reach;
  let blocked=false;
  for(const[oa,ob]of obstacles)if(segSegDist2(ax,az,bx,bz,oa[0],oa[1],ob[0],ob[1])<clear2){blocked=true;break;}
  if(blocked)continue;
  if(terrain&&corridorBlocked(terrain,[ax,az],[bx,bz],{except,halfWidth:.3}))continue;
  return{offset:s,hold:false};
 }
 return{offset:me.avoid||0,hold:true};
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
