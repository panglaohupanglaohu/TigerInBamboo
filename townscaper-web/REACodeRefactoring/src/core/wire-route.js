/** 1259838941299183619 "Italian Wires": local wall attachment/clearance.
 * Exact convex-cell ray clipping replaces 0.1-step endpoint guesses. Obstacles
 * use shared per-level solid bits, including tunnels, not column-top inference.
 * Conservative voxel envelope includes sag, cloth hem and shader sway margin;
 * this is not collision against the final deformed roof/wall mesh.
 */
import{signedArea}from'./grid.js';
export function segmentCellInterval(A,B,pts,margin=0){
 if(!Array.isArray(pts)||pts.length<3||![A,B,...pts].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.z))||!Number.isFinite(margin)||margin<0)throw new RangeError('invalid segment/cell');
 const sign=Math.sign(signedArea(pts));if(!sign)return null;let lo=0,hi=1;
 for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length],ex=q.x-p.x,ez=q.z-p.z,g=sign*(ex*(A.z-p.z)-ez*(A.x-p.x))+margin*Math.hypot(ex,ez),d=sign*(ex*(B.z-A.z)-ez*(B.x-A.x));if(Math.abs(d)<1e-12){if(g<0)return null;continue}const t=-g/d;if(d>0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi+1e-10)return null}return[lo,hi];
}
export function planWire(world,cell,edge,{levelHeight=.5,minSpan=.6,maxSpan=2.2,hem=.08,sway=.04}={}){
 if(![levelHeight,minSpan,maxSpan,hem,sway].every(Number.isFinite)||levelHeight<=0||minSpan<=0||maxSpan<minSpan||hem<0||sway<0||!Number.isInteger(edge)||edge<0||edge>=cell.n)throw new RangeError('invalid wire route');
 if(world.top(cell)<3||!world.topIsBuilt(cell))return null;
 const a=cell.pts[edge],b=cell.pts[(edge+1)%cell.n],S={x:(a.x+b.x)/2,z:(a.z+b.z)/2},len=Math.hypot(b.x-a.x,b.z-a.z);if(len<1e-9)return null;let nx=-(b.z-a.z)/len,nz=(b.x-a.x)/len;if(nx*(S.x-cell.cx)+nz*(S.z-cell.cz)<0){nx=-nx;nz=-nz}const end={x:S.x+nx*maxSpan,z:S.z+nz*maxSpan};
 const relevant=[];for(const c of world.cells){if(c.id===cell.id)continue;if(Number.isFinite(c.minX)&&(c.maxX<Math.min(S.x,end.x)-sway||c.minX>Math.max(S.x,end.x)+sway||c.maxZ<Math.min(S.z,end.z)-sway||c.minZ>Math.max(S.z,end.z)+sway))continue;relevant.push(c)}
 const candidates=[];for(const c of relevant){if(world.top(c)<3||!world.topIsBuilt(c))continue;const interval=segmentCellInterval(S,end,c.pts);if(interval&&interval[1]>1e-8)candidates.push({target:c,entry:interval[0]})}candidates.sort((a,b)=>a.entry-b.entry||a.target.id-b.target.id);
 for(const {target,entry}of candidates){const span=entry*maxSpan;if(span<minSpan||span>maxSpan)continue;
 const y=(Math.min(world.top(cell),world.top(target))-.2)*levelHeight,lv=Math.floor(y/levelHeight)+1;if(!world.isBuilt(cell,lv)||!world.isBuilt(target,lv))continue;
 const A={x:S.x+nx*.006,z:S.z+nz*.006},B={x:S.x+nx*(span-.006),z:S.z+nz*(span-.006)},distance=span-.012,sag=.06+distance*.06;
 let blocked=false;for(const c of relevant){if(c.id===target.id||world.top(c)===0)continue;const interval=segmentCellInterval(A,B,c.pts,sway);if(!interval)continue;const t=Math.max(interval[0],Math.min(interval[1],.5)),lowest=y-sag*4*t*(1-t)-hem-.015;
  for(let k=1;k<=world.top(c);k++)if(world.isSolid(c,k)&&k*levelHeight>lowest&&((k-1)*levelHeight)<y+.015){blocked=true;break;}
 }
 if(blocked)continue;return{source:cell.id,target:target.id,edge,A:[A.x,y,A.z],B:[B.x,y,B.z],span:distance,sag,hem,sway};
 }return null;
}
