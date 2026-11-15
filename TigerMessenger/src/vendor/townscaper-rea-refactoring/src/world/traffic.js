/** 880853661936734211: "fixed it by introducing left handed traffic".
 * Opposing directions get opposite sides of the SAME portal; steering does not
 * depend on frame dt or on which agent happened to be updated first.
 */
export function narrowCells(world, nav) {
  const mask = new Uint8Array(world.cells.length);
  const neighbors=world.cells.map(c=>nav.walk[c.id] ? c.edgeNeighbors.filter(id=>id>=0&&nav.walk[id]&&Number.isFinite(nav.cost(c,world.cells[id]))) : []);
  for (const c of world.cells) {
    const links=neighbors[c.id];
    if(links.length!==2)continue;
    const [a,b]=links;
    // A broad platform corner also has degree two. If its neighbors reconnect
    // immediately through a triangle or square, it is not a passage bottleneck.
    const bypass=neighbors[a].includes(b)||neighbors[a].some(id=>id!==c.id&&neighbors[b].includes(id));
    if(!bypass)mask[c.id]=1;
  }
  return mask;
}
export function leftLaneTarget(from, to, { width = 0.08, bodyRadius = 0 } = {}) {
  if (![width,bodyRadius].every(Number.isFinite) || width<0 || bodyRadius<0) throw new RangeError('Invalid lane dimensions');
  const dx=to.cx-from.cx,dz=to.cz-from.cz,d=Math.hypot(dx,dz);
  if (!d) return {x:to.cx,z:to.cz};
  // y-up world: left = UP cross forward = (dz, 0, -dx).
  // Limit displacement by distance to polygon edges, including skew triangles.
  let radius=Infinity;
  for(let i=0;i<to.n;i++) {
    const p=to.pts[i],q=to.pts[(i+1)%to.n],ex=q.x-p.x,ez=q.z-p.z;
    radius=Math.min(radius,Math.abs(ex*(to.cz-p.z)-ez*(to.cx-p.x))/(Math.hypot(ex,ez)||1));
  }
  const offset=Math.max(0,Math.min(width,radius*0.35,radius-bodyRadius));
  return {x:to.cx+dz/d*offset,z:to.cz-dx/d*offset};
}

/** Radius-aware soft separation, bounded by elapsed time. This is steering,
 * not a rigid-body collision solver; navigation still validates the move.
 */
export function localSeparation(unit, neighbors, dt, {heightTolerance=.3,maxSpeed=.8,response=20}={}) {
  if (![dt,heightTolerance,maxSpeed,response].every(Number.isFinite) || dt<0 || heightTolerance<0 || maxSpeed<0 || response<0)
    throw new RangeError('Invalid separation parameters');
  let x=0,z=0;
  if (dt===0) return {x,z};
  const radius=unit.radius??.055;
  if (!Number.isFinite(radius)||radius<0) return {x,z};
  for (const other of neighbors) {
    if (other===unit||other.dead||other.onBoat||other.fall||Math.abs(other.y-unit.y)>heightTolerance) continue;
    const otherRadius=other.radius??.055,dx=unit.x-other.x,dz=unit.z-other.z,distance=Math.hypot(dx,dz);
    if (!Number.isFinite(otherRadius)||otherRadius<0||distance<=1e-4||distance>=radius+otherRadius) continue;
    const overlap=radius+otherRadius-distance;
    x+=dx/distance*overlap;z+=dz/distance*overlap;
  }
  const factor=.5*(1-Math.exp(-response*dt));x*=factor;z*=factor;
  const length=Math.hypot(x,z),limit=maxSpeed*dt;
  if (length>limit) {x*=limit/length;z*=limit/length;}
  return {x,z};
}

/** 886199305522085890: "Dotted lines to mark narrow passages".
 * Classify from the SAME traversable graph as movement. Selected stair links
 * also qualify: an otherwise broad plateau may have a single bottleneck exit.
 * Emit each undirected segment once and keep regular arc-length spacing.
 */
export function passageMarkers(world, nav, { spacing = 0.16, levelHeight = 0.5 } = {}) {
  if (!(spacing > 0) || !Number.isFinite(spacing)) throw new RangeError('Invalid passage spacing');
  const narrow = narrowCells(world, nav), stairs = new Set();
  for (const s of nav.stairs) stairs.add([s.low.id,s.high.id].sort((a,b)=>a-b).join(':'));
  const points = [], segments = [];
  for (const a of world.cells) {
    if (!nav.walk[a.id]) continue;
    for (const id of a.edgeNeighbors) {
      if (id <= a.id || !nav.walk[id]) continue;
      const b = world.cells[id];
      if (!Number.isFinite(nav.cost(a,b)) || !Number.isFinite(nav.cost(b,a))) continue;
      if (!narrow[a.id] && !narrow[id] && !stairs.has(a.id+':'+id)) continue;
      const length = Math.hypot(b.cx-a.cx,b.cz-a.cz);
      const count = Math.max(1,Math.ceil(length/spacing));
      segments.push({a:a.id,b:id,length,count});
      // Midpoint samples avoid duplicates where several segments meet.
      for(let k=0;k<count;k++) {
        const t=(k+.5)/count;
        points.push({x:a.cx+(b.cx-a.cx)*t,z:a.cz+(b.cz-a.cz)*t,
          y:(nav.hgt[a.id]+(nav.hgt[id]-nav.hgt[a.id])*t)*levelHeight+.035});
      }
    }
  }
  return {points,segments,narrow};
}
