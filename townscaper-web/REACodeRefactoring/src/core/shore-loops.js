/** Boundary walks with land consistently on the left. Point-touching islands
 * stay separate: choose the most leftward continuation, not insertion order.
 * Grid topology/coordinates are read only; no claim about deformed ribbon folds.
 */
export function traceShoreLoops(cells,isLand) {
  const edges=[],out=new Map(),byId=new Map(cells.map(c=>[c.id,c]));
  for(const cell of cells){
    if(!isLand(cell))continue;
    const pts=cell.pts;let area=0;for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length];area+=a.x*b.z-b.x*a.z;}
    if(Math.abs(area)<1e-12)throw new RangeError('degenerate shoreline cell');
    for(let i=0;i<pts.length;i++){
      const nid=cell.edgeNeighbors[i],nb=nid>=0?byId.get(nid):null;
      if(nb&&isLand(nb))continue;
      let a=pts[i],b=pts[(i+1)%pts.length];if(area<0)[a,b]=[b,a];
      const dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz);if(len<1e-9)throw new RangeError('zero shoreline edge');
      const edge={a,b,nx:dz/len,nz:-dx/len};edges.push(edge);
      if(!out.has(a.id))out.set(a.id,[]);out.get(a.id).push(edge);
      if(edges.length>200000)throw new RangeError('shore edge budget');
    }
  }
  const next=new Map();
  for(const e of edges){const list=out.get(e.b.id);if(!list?.length)throw new RangeError('open shoreline');const dx=e.b.x-e.a.x,dz=e.b.z-e.a.z;
    let best=null,score=-Infinity;
    for(const c of list){const xx=c.b.x-c.a.x,zz=c.b.z-c.a.z;const angle=Math.atan2(dx*zz-dz*xx,dx*xx+dz*zz);if(angle>score+1e-12||(Math.abs(angle-score)<=1e-12&&String(c.b.id)<String(best?.b.id))){best=c;score=angle}}
    next.set(e,best);
  }
  const seen=new Set(),loops=[];
  for(const start of edges){if(seen.has(start))continue;const loop=[];let e=start;while(!seen.has(e)){seen.add(e);loop.push(e);e=next.get(e);if(!e)throw new RangeError('open shoreline')}
    if(e!==start||loop.length<3)throw new RangeError('non-manifold shoreline walk');
    // A hole can meet the exterior at one vertex even when land is connected.
    // Decompose that weakly-simple walk in linear time, retaining every edge.
    const stack=[],positions=new Map();
    for(const edge of loop){positions.set(edge.a.id,stack.length);stack.push(edge);const at=positions.get(edge.b.id);if(at!==undefined){const cycle=stack.splice(at);for(const c of cycle)positions.delete(c.a.id);if(cycle.length<3)throw new RangeError('degenerate shoreline cycle');loops.push(cycle)}}
    if(stack.length)throw new RangeError('unclosed shoreline remainder');
  }
  return loops;
}
