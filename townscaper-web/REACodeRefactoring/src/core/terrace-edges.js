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

/** REACode/islandpasses traceRings + interpContour on the shared polygon grid (1669315384619540487).
 * For every level k the contour is the set of real cell edges separating ground≥k from ground<k;
 * edges are chained into closed rings (Euler walk, pinch vertices allowed). `interpLength` is the
 * marching-squares style comparison: the same ring through edge midpoints (corners cut), which is
 * always shorter — the reason contours here stay on cell edges instead of being interpolated.
 */
export function traceTerraceRings(world,edges=terraceEdges(world)){
 const pointKey=p=>p.id===undefined?`${p.x},${p.z}`:String(p.id),levels=[];
 let maxLevel=0;for(const s of edges.steps)maxLevel=Math.max(maxLevel,s.level);
 for(let k=1;k<=maxLevel;k++){
  const segs=edges.steps.filter(s=>s.level>=k&&s.otherLevel<k),at=new Map(),used=new Uint8Array(segs.length),pts=new Map();
  segs.forEach((s,i)=>{for(const p of[s.a,s.b]){const q=pointKey(p);pts.set(q,p);if(!at.has(q))at.set(q,[]);at.get(q).push(i);}});
  let odd=0;for(const list of at.values())if(list.length%2)odd++;
  const rings=[];
  for(let i=0;i<segs.length;i++){if(used[i])continue;
   const start=pointKey(segs[i].a),order=[start];let cur=pointKey(segs[i].b),e=i;used[i]=1;order.push(cur);
   while(cur!==start){const next=at.get(cur).find(j=>!used[j]);if(next===undefined)break;used[next]=1;e=next;const s=segs[next];cur=pointKey(s.a)===cur?pointKey(s.b):pointKey(s.a);order.push(cur);}
   const closed=cur===start,P=order.map(q=>pts.get(q));let length=0,interpLength=0;
   for(let j=0;j+1<P.length;j++)length+=Math.hypot(P[j+1].x-P[j].x,P[j+1].z-P[j].z);
   const mids=[];for(let j=0;j+1<P.length;j++)mids.push({x:(P[j].x+P[j+1].x)/2,z:(P[j].z+P[j+1].z)/2});
   for(let j=0;j+1<mids.length;j++)interpLength+=Math.hypot(mids[j+1].x-mids[j].x,mids[j+1].z-mids[j].z);
   if(closed&&mids.length>1)interpLength+=Math.hypot(mids[0].x-mids[mids.length-1].x,mids[0].z-mids[mids.length-1].z);
   rings.push({level:k,closed,segments:order.length-1,length,interpLength,points:P});
  }
  levels.push({level:k,segments:segs.length,oddVertices:odd,rings});
 }
 const all=levels.flatMap(l=>l.rings),crisp=all.reduce((a,r)=>a+r.length,0),interp=all.reduce((a,r)=>a+r.interpLength,0);
 return{version:world.version,levels,rings:all.length,closed:all.filter(r=>r.closed).length,length:crisp,interpLength:interp,lenRatio:crisp?interp/crisp:1};
}

/** r55 final-bevel consistency (1669315384619540487: contour / wire / final render are one set of edges).
 * Places step/wire/shore segments exactly where terrain/terrainmesh.js puts the top-fan rim: xz from the
 * same cage sampler `at(p, slice)` at slice = y/L, y = the soft-top corner height when present
 * (terrain/soft-tops.js), else level·L. Steps that soft tops turned into a seamless slope (both sides share
 * the corner heights) are returned in `seamless` instead of `segments`, because the mesh has no edge there.
 */
export function finalSegments(world, list, { at = (p) => [p.x, p.z], L = 1, soft = null } = {}) {
 const segments = [], seamless = [];
 const yOf = (cell, p, level) => soft?.y(cell, p.id) ?? level * L;
 for (const s of list) {
  const ya = yOf(s.cell, s.a, s.level), yb = yOf(s.cell, s.b, s.level);
  const o = world.cells[s.cell].edgeNeighbors[s.edge];
  if (soft && o >= 0 && s.level > s.otherLevel) {
   const oa = yOf(o, s.a, s.otherLevel), ob = yOf(o, s.b, s.otherLevel);
   if (Math.abs(oa - ya) < 1e-9 && Math.abs(ob - yb) < 1e-9) { seamless.push(s); continue; }
  }
  const [ax, az] = at(s.a, ya / L), [bx, bz] = at(s.b, yb / L);
  segments.push({ s, a: [ax, ya, az], b: [bx, yb, bz] });
 }
 return { segments, seamless };
}
