/** 880853661936734211: "fixed it by introducing left handed traffic".
 * Opposing directions get opposite sides of the SAME portal; steering does not
 * depend on frame dt or on which agent happened to be updated first.
 */
export function narrowCells(world, nav) {
  const mask = new Uint8Array(world.cells.length);
  for (const c of world.cells) {
    if (!nav.walk[c.id]) continue;
    let degree = 0;
    for (const id of c.edgeNeighbors) if (id >= 0 && nav.walk[id] && Number.isFinite(nav.cost(c,world.cells[id]))) degree++;
    if (degree === 2) mask[c.id] = 1;
  }
  return mask;
}
export function leftLaneTarget(from, to, { width = 0.08 } = {}) {
  const dx=to.cx-from.cx,dz=to.cz-from.cz,d=Math.hypot(dx,dz);
  if (!d) return {x:to.cx,z:to.cz};
  // y-up world: left = UP cross forward = (dz, 0, -dx).
  // Limit displacement by distance to polygon edges, including skew triangles.
  let radius=Infinity;
  for(let i=0;i<to.n;i++) {
    const p=to.pts[i],q=to.pts[(i+1)%to.n],ex=q.x-p.x,ez=q.z-p.z;
    radius=Math.min(radius,Math.abs(ex*(to.cz-p.z)-ez*(to.cx-p.x))/(Math.hypot(ex,ez)||1));
  }
  const offset=Math.max(0,Math.min(width,radius*0.35));
  return {x:to.cx+dz/d*offset,z:to.cz-dx/d*offset};
}
