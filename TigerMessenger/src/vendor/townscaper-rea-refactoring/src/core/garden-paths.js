/** 1290997501332525056 shows connected garden paths, but gives no algorithm.
 * Local reconstruction: PCA chooses endpoints; graph BFS connects them inside
 * the actual courtyard. Does not invent links across holes/concave boundaries.
 */
export function gardenPaths(cells, neighbors, {minCells=6,maxCells=20000}={}) {
  if(cells.length>maxCells)throw new RangeError('garden path cell budget');
  const result={path:new Set(),hub:null,endpoints:[],reachable:0};
  if(cells.length<minCells)return result;
  const ordered=[...cells].sort((a,b)=>a.id-b.id),byId=new Map(ordered.map(c=>[c.id,c]));
  if(byId.size!==ordered.length||ordered.some(c=>!Number.isFinite(c.cx+c.cz)))throw new TypeError('unique finite garden cells required');
  const n=ordered.length,mx=ordered.reduce((s,c)=>s+c.cx,0)/n,mz=ordered.reduce((s,c)=>s+c.cz,0)/n;
  let xx=0,zz=0,xz=0;
  for(const c of ordered){const x=c.cx-mx,z=c.cz-mz;xx+=x*x;zz+=z*z;xz+=x*z;}
  const angle=.5*Math.atan2(2*xz,xx-zz),ux=Math.cos(angle),uz=Math.sin(angle);
  const rank=(value)=>ordered.reduce((a,c)=>value(c)<value(a)-1e-10?c:a,ordered[0]);
  const hub=rank(c=>(c.cx-mx)**2+(c.cz-mz)**2);
  const parent=new Map([[hub.id,null]]),queue=[hub];
  for(let i=0;i<queue.length;i++)for(const raw of [...neighbors(queue[i])].filter(Boolean).sort((a,b)=>a.id-b.id)){
    const c=byId.get(raw.id);if(!c||parent.has(c.id))continue;parent.set(c.id,queue[i].id);queue.push(c);
  }
  result.hub=hub.id;result.reachable=parent.size;
  if(parent.size!==n)throw new RangeError('courtyard must be connected');
  for(const [x,z] of [[ux,uz],...(n>=10?[[-uz,ux]]:[])])for(const sign of [-1,1]){
    const end=rank(c=>sign*((c.cx-mx)*x+(c.cz-mz)*z));
    if(!result.endpoints.includes(end.id))result.endpoints.push(end.id);
    for(let id=end.id;id!==null;id=parent.get(id))result.path.add(id);
  }
  return result;
}
