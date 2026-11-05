/** 1582293326815862786: evaluate candidates around the collapsed edge.
 * A read-only local socket probe, not global CSP feasibility or a navmesh.
 * Only neighbors of explicitly collapsed cells are enumerated; incomplete
 * budget results expose complete=false and never publish a partial domain.
 */
export function frontierCandidates(grid,{tiles,collapsed={},maxTests=100000,compatible=(a,b)=>a===b}={}){
 if(!Array.isArray(tiles)||!tiles.length||!Number.isInteger(maxTests)||maxTests<0)throw new RangeError('invalid frontier catalog/budget');
 const byTile=new Map(tiles.map(t=>[String(t.id),t])),byCell=new Map(grid.cells.map(c=>[c.id,c]));if(byTile.size!==tiles.length||tiles.some(t=>t.id===undefined||!Array.isArray(t.edges)))throw new RangeError('invalid frontier tiles');
 const fixed=new Map();for(const [id,tid]of Object.entries(collapsed)){const c=byCell.get(Number(id)),t=byTile.get(String(tid));if(!c||!t||t.edges.length!==c.n)throw new RangeError('unknown collapsed cell/tile');fixed.set(c.id,t)}
 const twin=(c,e,b)=>{const j=c.edgeTwins?.[e];if(!b||!Number.isInteger(j)||j<0||b.edgeNeighbors[j]!==c.id)throw new RangeError('nonreciprocal frontier edge');return j};
 const frontier=new Set();for(const[id,t]of fixed){const c=byCell.get(id);for(let e=0;e<c.n;e++){const nid=c.edgeNeighbors[e];if(nid<0)continue;const b=byCell.get(nid),j=twin(c,e,b);if(fixed.has(nid)){if(!compatible(t.edges[e],fixed.get(nid).edges[j]))throw new RangeError('contradictory collapsed edge')}else frontier.add(nid)}}
 let tests=0;const rows=[];for(const id of [...frontier].sort((a,b)=>a-b)){const c=byCell.get(id),requirements=[];for(let e=0;e<c.n;e++){const n=fixed.get(c.edgeNeighbors[e]);if(n){const b=byCell.get(c.edgeNeighbors[e]),j=twin(c,e,b);requirements.push({edge:e,neighbor:b.id,socket:n.edges[j]})}}const candidates=[];const catalog=tiles.filter(t=>t.edges.length===c.n).sort((a,b)=>String(a.id).localeCompare(String(b.id)));
  for(const t of catalog){if(tests>=maxTests)return{complete:false,tests,frontier:[...frontier],rows,collapsed:fixed.size,pendingCell:id};tests++;if(requirements.every(r=>compatible(t.edges[r.edge],r.socket)))candidates.push(String(t.id))}
  rows.push({cell:id,requirements,candidates,fullCount:catalog.length});
 }return{complete:true,tests,frontier:[...frontier],rows,collapsed:fixed.size};
}
