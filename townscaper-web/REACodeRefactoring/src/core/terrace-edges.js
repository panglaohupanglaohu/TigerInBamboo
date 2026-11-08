/** Quantized terrace boundaries are existing polygon edges, not interpolated
 * scalar isolines. Shared World only; no second heightfield or grid.
 */
export function terraceEdges(world){
 const cells=world.cells,byId=new Map(cells.map(c=>[c.id,c])),wire=new Map(),steps=[];
 const pointKey=p=>p.id===undefined?`${p.x},${p.z}`:String(p.id);
 const key=(a,b)=>{const x=pointKey(a),y=pointKey(b);return x<y?`${x}|${y}`:`${y}|${x}`};
 for(const c of cells){const h=world.ground(c);if(!h)continue;
  for(let edge=0;edge<c.n;edge++){
   const a=c.pts[edge],b=c.pts[(edge+1)%c.n],o=byId.get(c.edgeNeighbors[edge]),other=o?world.ground(o):0,k=key(a,b),s={key:k,cell:c.id,edge,a,b,level:h,otherLevel:other};
   if(!wire.has(k+'@'+h))wire.set(k+'@'+h,s);
   if(h>other)steps.push(s);
  }
 }
 const sort=(a,b)=>a.key.localeCompare(b.key)||a.level-b.level;
 steps.sort(sort);return{version:world.version,steps,shore:steps.filter(s=>s.otherLevel===0),wire:[...wire.values()].sort(sort),logicalEdges:true};
}
