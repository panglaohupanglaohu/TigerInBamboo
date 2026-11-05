/** Posts 938422757288792064 / 938405900573986816: nodes are eaten by
 * the neighbour group to which they are most connected. This local model
 * preserves the existing smallest-group merges, then optionally transfers
 * boundary nodes by edge weight. Exact source update order/weights are unknown.
 */
export function groupByConnection(ids, nb, target, { weight = () => 1, relaxPasses = 0, historyLimit = 128 } = {}) {
  if (!Array.isArray(ids) || ids.length > 512 || new Set(ids).size !== ids.length ||
      ids.some(i => !Number.isInteger(i) || i < 0 || !Array.isArray(nb[i])) ||
      !Number.isInteger(target) || target < 1 || !Number.isInteger(relaxPasses) || relaxPasses < 0 || relaxPasses > 16 ||
      !Number.isInteger(historyLimit) || historyLimit < 2 || historyLimit > 512) throw new RangeError('invalid region graph/options');
  const ordered = [...ids].sort((a, b) => a - b), selected = new Set(ids);
  const adj = new Map(ordered.map(i => [i, new Map()])), edges = [];
  for (const i of ordered) for (const j of new Set(nb[i])) {
    if (!selected.has(j) || i === j) continue;
    if (!nb[j].includes(i)) throw new RangeError('region graph must be undirected');
    if (j < i) continue;
    const w = weight(i, j);
    if (!Number.isFinite(w) || w <= 0 || w > 1e9) throw new RangeError('region edge weight must be positive, finite and at most 1e9');
    adj.get(i).set(j, w); adj.get(j).set(i, w); edges.push([i, j, w]);
  }
  const g = new Map(ordered.map(i => [i, i])), members = new Map(ordered.map(i => [i, new Set([i])])), history = [], events = [];
  let dropped = 0;
  const capture = event => {
    if (history.length === historyLimit) { history.splice(1, 1); dropped++; }
    history.push(new Map(g)); events.push(event);
  };
  capture({kind:'initial', groups:members.size});
  const linksFor = group => {
    const links = new Map();
    for (const i of members.get(group)) for (const [j, w] of adj.get(i)) {
      const other = g.get(j);
      if (other !== group) links.set(other, (links.get(other) || 0) + w);
    }
    return links;
  };
  while (members.size > target) {
    // Only adjacent groups can merge. Never delete isolated components.
    const candidates = [...members.keys()].sort((a, b) => members.get(a).size - members.get(b).size || a - b);
    let small, links;
    for (const key of candidates) { const l = linksFor(key); if (l.size) { small = key; links = l; break; } }
    if (small === undefined) break;
    const eater = [...links].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0];
    for (const i of members.get(small)) { g.set(i, eater); members.get(eater).add(i); }
    members.delete(small); capture({kind:'merge', from:small, to:eater, groups:members.size});
  }
  const cut = () => edges.reduce((sum, [i,j,w]) => sum + (g.get(i) === g.get(j) ? 0 : w), 0);
  const cutBefore = cut(); let moves = 0, passes = 0, lastChanged = null;
  const donorStaysConnected = (id, group) => {
    const rest = [...members.get(group)].filter(i => i !== id);
    if (!rest.length) return false;
    const visited = new Set([rest[0]]), q = [rest[0]];
    for (let h=0; h<q.length; h++) for (const j of adj.get(q[h]).keys()) {
      if (j !== id && g.get(j) === group && !visited.has(j)) { visited.add(j); q.push(j); }
    }
    return visited.size === rest.length;
  };
  for (let pass=0; pass<relaxPasses; pass++) {
    let changed = 0; passes++;
    for (const i of ordered) {
      const own = g.get(i), sums = new Map();
      for (const [j,w] of adj.get(i)) sums.set(g.get(j), (sums.get(g.get(j)) || 0) + w);
      const ownWeight = sums.get(own) || 0;
      const best = [...sums].filter(([key]) => key !== own).sort((a,b)=>b[1]-a[1] || a[0]-b[0])[0];
      if (!best || best[1] <= ownWeight + 1e-9 || !donorStaysConnected(i, own)) continue;
      members.get(own).delete(i); members.get(best[0]).add(i); g.set(i, best[0]); moves++; changed++;
      capture({kind:'node', id:i, from:own, to:best[0], gain:best[1]-ownWeight, groups:members.size});
    }
    lastChanged = changed;
    if (!changed) break;
  }
  const labels = new Map([...members.keys()].sort((a,b)=>a-b).map((key,i)=>[key,i]));
  const out = new Map(ordered.map(i=>[i,labels.get(g.get(i))]));
  out.history = history; // snapshots keep persistent seed IDs for stable playback colours
  out.events = events;
  out.stats = { requested:target, actual:members.size, targetReached:members.size <= target, nodeMoves:moves, passes, refinementConverged:lastChanged === null ? null : lastChanged === 0,
    cutBefore, cutAfter:cut(), totalWeight:edges.reduce((sum,e)=>sum+e[2],0), snapshotsDropped:dropped };
  return out;
}

/** Read-only adapter for the shared World/grid, with actual common-edge length.
 * Handles every polygon edge (including triangles); no second voxel field.
 */
export function regionGraphFromGrid(grid, world, { landOnly = true } = {}) {
  if (!grid?.cells || world?.grid !== grid) throw new RangeError('region graph requires the shared World/grid');
  const cellIds = grid.cells.filter(c => !landOnly || world.top(c) > 0).map(c => c.id);
  if (cellIds.length > 512) throw new RangeError('region graph supports at most 512 selected cells');
  const index = new Map(cellIds.map((id,i)=>[id,i])), links = cellIds.map(()=>[]);
  for (let i=0;i<cellIds.length;i++) {
    const c=grid.cells[cellIds[i]];
    for(let e=0;e<c.n;e++) {
      const id=index.get(c.edgeNeighbors[e]);
      if(id === undefined) continue;
      const a=c.pts[e],b=c.pts[(e+1)%c.n],w=Math.hypot(a.x-b.x,a.z-b.z);
      if(!Number.isFinite(w)||w<=0)throw new RangeError('invalid shared edge length');
      links[i].push({id,w});
    }
  }
  const adjacency=links.map(list=>list.map(e=>e.id));
  const weights=links.map(list=>new Map(list.map(e=>[e.id,e.w])));
  return {n:cellIds.length,cellIds,adjacency,neighbors:i=>links[i],weight:(i,j)=>weights[i].get(j),worldVersion:world.version};
}

export function regionCutRatio(graph, labels) {
  let cut=0,total=0;
  const get=i=>labels instanceof Map?labels.get(i):labels[i];
  for(let i=0;i<graph.n;i++) {
    if(get(i) === undefined)throw new RangeError('missing region label');
    for(const {id,w} of graph.neighbors(i))if(id>i){total+=w;if(get(i)!==get(id))cut+=w;}
  }
  return total?cut/total:0;
}

/** Bounded pair repulsion, immutable input. Exact coincidences receive a
 * deterministic pair direction; no finite iteration count proves full packing.
 */
export function spreadCircles(nodes, {iterations=80,gap=.12}={}) {
  if(!Array.isArray(nodes)||nodes.length>512||nodes.some(p=>!p||![p.x,p.y,p.r].every(Number.isFinite)||p.r<=0)||
    !Number.isInteger(iterations)||iterations<0||iterations>160||!Number.isFinite(gap)||gap<0||gap>100||nodes.some(p=>Math.abs(p.x)>1e6||Math.abs(p.y)>1e6||p.r>1e4))throw new RangeError('invalid circle spread');
  const out=nodes.map(p=>({...p}));
  for(let it=0;it<iterations;it++)for(let i=0;i<out.length;i++)for(let j=i+1;j<out.length;j++){
    const a=out[i],b=out[j];let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy);const min=a.r+b.r+gap;
    if(d>=min)continue;
    if(d<1e-12){const angle=((i+1)*73856093^(j+1)*19349663)*.001;dx=Math.cos(angle);dy=Math.sin(angle);d=1;const f=min*.5;a.x-=dx*f;a.y-=dy*f;b.x+=dx*f;b.y+=dy*f;}
    else{const f=(min-d)/d*.5;a.x-=dx*f;a.y-=dy*f;b.x+=dx*f;b.y+=dy*f;}
  }
  return out;
}
