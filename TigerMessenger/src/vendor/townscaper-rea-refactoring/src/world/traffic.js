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
export function passageMarkers(world, nav, { spacing = 0.28, levelHeight = 0.5 } = {}) {
  // spacing 由 0.16 → 0.215 → 0.265 → 0.28：原片（886199305522085890）里点距 ≈ 2.2 倍点径，
  // 本仓 0.16 时是 1.6 倍、看起来像一串连成线的珠子。0.265 实测 2.08，再放一档正好 2.2。
  // 注意 pitch 是 length/ceil(length/spacing)，恒小于 spacing，所以只能实测着调，不能按公式算。
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

/** 886199305522085890: the reference dots fade out where a crest comes between
 * them and the camera instead of being hard-clipped by depth alone.
 * CPU-side sight test against a coarse height raster of the top surface — cheap
 * enough to re-run when the camera moves, and deterministic (no depth texture).
 */
export function heightRaster(world, { res = 0.25, levelHeight = 0.5, roofs = null } = {}) {
  if (!(res > 0) || !Number.isFinite(res)) throw new RangeError('Invalid raster resolution');
  let minX = Infinity, minZ = Infinity, maxX = -Infinity, maxZ = -Infinity;
  for (const c of world.cells) for (const p of c.pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.z < minZ) minZ = p.z; if (p.z > maxZ) maxZ = p.z;
  }
  if (!Number.isFinite(minX)) return { res, ox: 0, oz: 0, w: 0, h: 0, data: new Float32Array(0) };
  const ox = minX - res, oz = minZ - res;
  const w = Math.ceil((maxX - minX) / res) + 3, h = Math.ceil((maxZ - minZ) / res) + 3;
  const data = new Float32Array(w * h).fill(-1e9);
  const paint = (c, top) => {
    let bx0 = Infinity, bz0 = Infinity, bx1 = -Infinity, bz1 = -Infinity;
    for (const p of c.pts) {
      if (p.x < bx0) bx0 = p.x; if (p.x > bx1) bx1 = p.x;
      if (p.z < bz0) bz0 = p.z; if (p.z > bz1) bz1 = p.z;
    }
    const i0 = Math.max(0, Math.floor((bx0 - ox) / res)), i1 = Math.min(w - 1, Math.ceil((bx1 - ox) / res));
    const j0 = Math.max(0, Math.floor((bz0 - oz) / res)), j1 = Math.min(h - 1, Math.ceil((bz1 - oz) / res));
    for (let j = j0; j <= j1; j++) {
      const z = oz + (j + 0.5) * res;
      for (let i = i0; i <= i1; i++) {
        const x = ox + (i + 0.5) * res, k = j * w + i;
        if (data[k] >= top) continue;
        if (insideCell(c, x, z)) data[k] = top;
      }
    }
  };
  for (const c of world.cells) {
    const top = world.top(c) * levelHeight;
    if (!(top > 0)) continue;
    paint(c, top);
  }
  // 886199305522085890（第 54 轮）：原片里点走到屋檐后人就看不见，会被建筑遮住。
  // 原来栅格只有地形顶面，房子根本没进栅格 → 挑檐后的点一直亮着。
  // roofs 由调用方提供 [{cell, y}]，y 是该格建筑的实际顶高（战斗场景用一次射线取屋顶）。
  if (roofs) for (const r of roofs) if (r.cell && Number.isFinite(r.y) && r.y > 0) paint(r.cell, r.y);
  return { res, ox, oz, w, h, data };
}

function insideCell(c, x, z) {
  let hit = false;
  for (let i = 0, j = c.n - 1; i < c.n; j = i++) {
    const a = c.pts[i], b = c.pts[j];
    if ((a.z > z) !== (b.z > z) && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) hit = !hit;
  }
  return hit;
}

export function rasterAt(raster, x, z) {
  if (!raster.w) return -1e9;
  const i = Math.floor((x - raster.ox) / raster.res), j = Math.floor((z - raster.oz) / raster.res);
  if (i < 0 || j < 0 || i >= raster.w || j >= raster.h) return -1e9;
  return raster.data[j * raster.w + i];
}

/** 1 = fully visible, 0 = hidden. `softness` is how many world units of
 * penetration it takes to go from full to gone, so a crest crossing the line of
 * sight dims the dot gradually instead of popping. */
export function sightFade(raster, cam, point, { samples = 24, margin = 0.05, softness = 0.4, near = 0.35 } = {}) {
  if (!raster?.w) return 1;
  const dx = cam.x - point.x, dy = cam.y - point.y, dz = cam.z - point.z;
  const len = Math.hypot(dx, dz);
  let pen = 0;
  for (let s = 1; s <= samples; s++) {
    const t = s / (samples + 1);
    if (Math.hypot(dx * t, dz * t) < near) continue;
    const y = point.y + dy * t, g = rasterAt(raster, point.x + dx * t, point.z + dz * t);
    if (g <= y - margin) continue;
    const p = g - (y - margin);
    if (p > pen) pen = p;
  }
  if (!(pen > 0) || len === 0) return 1;
  const k = Math.min(1, pen / softness);
  return Math.max(0, 1 - k * k * (3 - 2 * k));
}
