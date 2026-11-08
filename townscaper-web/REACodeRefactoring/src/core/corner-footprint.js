/** Local render-footprint experiment adapted from REACode/squarehex.js.
 * 1471817524148940807 "Square, yet hex" does not prove corner cutting was the original algorithm.
 * Preserve the source cell and routing graph: cut edges have no new portal semantics.
 */
export function cornerFootprint(cell, {cut=.25, all=false, flip=false}={}) {
  if (!Number.isFinite(cut)||cut<0||cut>.5) throw new RangeError('cut must be in [0,.5]');
  if (!cell || cell.n!==4 || cell.pts?.length!==4 || !cell.pts.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.z))) throw new TypeError('finite quad cell required');
  const points=[];
  for(let i=0;i<4;i++){
    const p=cell.pts[i],a=cell.pts[(i+3)%4],b=cell.pts[(i+1)%4];
    if(cut>0&&(all||i%2===(flip?0:1)))points.push({x:p.x+(a.x-p.x)*cut,z:p.z+(a.z-p.z)*cut},{x:p.x+(b.x-p.x)*cut,z:p.z+(b.z-p.z)*cut});
    else points.push({x:p.x,z:p.z});
  }
  const clean=points.filter((p,i)=>i===0||Math.hypot(p.x-points[i-1].x,p.z-points[i-1].z)>1e-10);
  if(clean.length>1&&Math.hypot(clean[0].x-clean.at(-1).x,clean[0].z-clean.at(-1).z)<1e-10)clean.pop();
  const area=ps=>Math.abs(ps.reduce((a,p,i)=>{const q=ps[(i+1)%ps.length];return a+p.x*q.z-q.x*p.z},0))/2;
  return {sourceCell:cell.id,points:clean,areaRatio:area(clean)/area(cell.pts),renderOnly:true};
}
