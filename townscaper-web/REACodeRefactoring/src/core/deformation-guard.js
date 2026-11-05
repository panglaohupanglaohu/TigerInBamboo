/** Keep a proposed shared-vertex slice from collapsing/inverting its cells.
 * Global backtracking toward the original slice preserves shared boundaries and
 * pinned vertices. This is a local 2D bound, not a 3D collision/erosion guarantee.
 */
export function guardDeformation(cells,bx,bz,x,z,offset=0,{minAreaRatio=.3,minEdgeRatio=.35,minFanRatio=.2}={}){
  if(![minAreaRatio,minEdgeRatio,minFanRatio].every(v=>Number.isFinite(v)&&v>=0&&v<=1))throw new RangeError('deformation ratios 0..1');
  const dx=Float64Array.from(bx,(v,i)=>x[offset+i]-v),dz=Float64Array.from(bz,(v,i)=>z[offset+i]-v);
  const constraints=cells.map(c=>{const ids=c.pts.map(p=>p.id),cx=ids.reduce((s,i)=>s+bx[i],0)/ids.length,cz=ids.reduce((s,i)=>s+bz[i],0)/ids.length;let area=0;const edges=[],fans=[];for(let k=0;k<ids.length;k++){const a=ids[k],b=ids[(k+1)%ids.length];area+=bx[a]*bz[b]-bx[b]*bz[a];edges.push(Math.hypot(bx[b]-bx[a],bz[b]-bz[a]));fans.push((bx[a]-cx)*(bz[b]-cz)-(bz[a]-cz)*(bx[b]-cx));}return{ids,area,edges,fans}});
  function inspect(t){let failures=0,minArea=1,minEdge=1,minFan=1;const px=i=>bx[i]+t*dx[i],pz=i=>bz[i]+t*dz[i];for(const c of constraints){let area=0,cx=0,cz=0,bad=false;for(const i of c.ids){cx+=px(i);cz+=pz(i)}cx/=c.ids.length;cz/=c.ids.length;for(let k=0;k<c.ids.length;k++){const a=c.ids[k],b=c.ids[(k+1)%c.ids.length];area+=px(a)*pz(b)-px(b)*pz(a);const edge=Math.hypot(px(b)-px(a),pz(b)-pz(a))/c.edges[k],fan=((px(a)-cx)*(pz(b)-cz)-(pz(a)-cz)*(px(b)-cx))/c.fans[k];minEdge=Math.min(minEdge,edge);minFan=Math.min(minFan,fan);if(edge<minEdgeRatio||fan<minFanRatio||!Number.isFinite(edge+fan))bad=true;}const ratio=area/c.area;minArea=Math.min(minArea,ratio);if(ratio<minAreaRatio||!Number.isFinite(ratio))bad=true;if(bad)failures++;}return {failures,minArea,minEdge,minFan}}
  let blend=1,initial=inspect(blend),result=initial,steps=0;
  while(result.failures&&steps++<12){blend*=.5;result=inspect(blend)}
  if(result.failures){blend=0;result=inspect(0);if(result.failures)throw new RangeError('degenerate original cells cannot be guarded')}
  if(blend<1)for(let i=0;i<bx.length;i++){x[offset+i]=bx[i]+blend*dx[i];z[offset+i]=bz[i]+blend*dz[i];}
  return {blend,initialFailures:initial.failures,...result};
}
