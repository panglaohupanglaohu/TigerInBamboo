/**
 * 906425294533394432: "It's like navigating a Swiss cheese".
 * 797119718477991936: "Got some basic navigation going".
 * Review: artifacts/coverage/navigation-review.md. These clips show navigation
 * inside perforated structures; they do not reveal the original solver.
 * Our implementation enumerates supported, clear volumes in the existing World.
 * Unlike REACode/src/voxelnav.js it uses polygon adjacency and real horizontal
 * step transitions; it never invents a walkable sea floor or vertical air ladders.
 */
import { MAX_LEVEL } from '../core/world.js';

export function buildLayeredNav(world, { headroom = 1, maxStep = 1, canStep = () => true } = {}) {
  if (!Number.isInteger(headroom) || headroom < 1 || !Number.isInteger(maxStep) || maxStep < 0) throw new RangeError('Invalid navigation clearance/step');
  const nodes = [], layers = world.cells.map(() => []), portals = [];
  const clear = (cell, floor, height) => {
    for (let lv = floor + 1; lv <= floor + height; lv++) if (world.isSolid(cell, lv)) return false;
    return true;
  };
  for (const c of world.cells) for (let floor = 1; floor <= MAX_LEVEL; floor++) {
    if (!world.isSolid(c, floor) || !clear(c, floor, headroom)) continue;
    const id = nodes.length;
    nodes.push({ id, cell: c, floor, x: c.cx, z: c.cz }); layers[c.id].push(id);
  }
  const adj = nodes.map(() => []);
  for (const a of nodes) for (let edge = 0; edge < a.cell.n; edge++) {
    const bid = a.cell.edgeNeighbors[edge]; if (bid < 0) continue;
    for (const j of layers[bid]) {
      const b = nodes[j], rise = b.floor - a.floor;
      if (Math.abs(rise) > maxStep || !canStep(a, b)) continue;
      // Low-ceiling tunnels must not connect diagonally through their lintels.
      const high = Math.max(a.floor, b.floor);
      const lowNode=a.floor <= b.floor ? a : b, highNode=a.floor <= b.floor ? b : a;
      if (!clear(lowNode.cell, lowNode.floor, high-lowNode.floor+headroom) ||
          !clear(highNode.cell, high, headroom)) continue;
      const distance = Math.hypot(a.x-b.x,a.z-b.z);
      const p = a.cell.pts[edge], q = a.cell.pts[(edge+1)%a.cell.n];
      const portal = { from: a.id, to: j, edge, x:(p.x+q.x)/2, z:(p.z+q.z)/2, floor:high, width:Math.hypot(p.x-q.x,p.z-q.z) };
      portals.push(portal); adj[a.id].push({ to:j, cost:distance*(rise ? 1.8 : 1), portal });
    }
  }
  function search(start, goal) {
    const distance = new Float64Array(nodes.length).fill(Infinity), parent = new Int32Array(nodes.length).fill(-1);
    if (!nodes[start] || !nodes[goal]) return { path:[], distance:Infinity };
    // Small per-island graph. Stable Dijkstra; no Float32 round-trip or array-order ties.
    const queue = [[0,start]]; distance[start]=0;
    while(queue.length) {
      queue.sort((a,b)=>b[0]-a[0] || b[1]-a[1]); const [d,id]=queue.pop();
      if(d!==distance[id]) continue; if(id===goal) break;
      for(const e of adj[id]) { const nd=d+e.cost; if(nd<distance[e.to]) { distance[e.to]=nd; parent[e.to]=id; queue.push([nd,e.to]); } }
    }
    if(!Number.isFinite(distance[goal])) return {path:[],distance:Infinity};
    const path=[]; for(let i=goal;i>=0;i=parent[i]) { path.push(i);if(i===start) break; }
    return {path:path.reverse(),distance:distance[goal]};
  }
  return {nodes,layers,portals,adj,version:world.version,search,
    at(cell,floor) { return layers[cell.id].find(id=>nodes[id].floor===floor) ?? -1; },
    nearest(cell,floor) { return layers[cell.id].reduce((a,id)=>a<0 || Math.abs(nodes[id].floor-floor)<Math.abs(nodes[a].floor-floor)?id:a,-1); },
  };
}
