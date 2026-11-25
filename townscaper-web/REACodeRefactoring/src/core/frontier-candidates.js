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

/** 1582293326815862786 "tries to expand (and interconnect) a simplified nav graph".
 * Incremental placement driven ONLY by the collapsed edge: candidates live on frontier cells and are
 * re-enumerated just for neighbours of the cell placed last (tests counted against the naive
 * placed×catalog cost). Minimum-candidate frontier cell first (ties by id); a candidate is taken only
 * if every still-open neighbour keeps >= 1 local candidate (one-step forward check, not global CSP).
 * Every placement links walkable shared edges into a nav graph; union-find reports when growth from
 * different seeds interconnects. Cells with no viable candidate become `dead` (left open, as REACode).
 */
export function expandFrontier(grid,{tiles,seeds={},compatible=(a,b)=>a===b,walkable=(a,ea,b,eb)=>compatible(a.edges[ea],b.edges[eb]),prefer=null,seed=1,maxCells=Infinity,maxTests=1000000,forwardCheck=true,twoFronts=false}={}){
 if(!Array.isArray(tiles)||!tiles.length||!Number.isInteger(maxTests)||maxTests<0||typeof walkable!=='function'||typeof forwardCheck!=='boolean')throw new RangeError('invalid frontier expansion options');
 const byTile=new Map(tiles.map(t=>[String(t.id),t])),byCell=new Map(grid.cells.map(c=>[c.id,c]));if(byTile.size!==tiles.length)throw new RangeError('duplicate tile id');
 const catalog=new Map();for(const t of [...tiles].sort((a,b)=>String(a.id).localeCompare(String(b.id)))){if(!catalog.has(t.edges.length))catalog.set(t.edges.length,[]);catalog.get(t.edges.length).push(t);}
 const twin=(c,e,b)=>{const j=c.edgeTwins?.[e];if(!b||!Number.isInteger(j)||j<0||b.edgeNeighbors[j]!==c.id)throw new RangeError('nonreciprocal frontier edge');return j};
 const fixed=new Map(),order=[],nav=[],dead=new Set(),parent=new Map(),comp=new Map(),merges=[];let tests=0,naive=0,truncated=false;
 const find=x=>{while(parent.get(x)!==x){parent.set(x,parent.get(parent.get(x)));x=parent.get(x);}return x;};
 const link=(a,b)=>{const ra=find(a),rb=find(b);if(ra===rb)return;const sa=comp.get(ra),sb=comp.get(rb);parent.set(rb,ra);comp.set(ra,new Set([...sa,...sb]));if(sa.size&&sb.size&&![...sa].some(x=>sb.has(x)))merges.push({at:order.length,cells:[a,b],seeds:[[...sa],[...sb]]});};
 const place=(c,t,via)=>{fixed.set(c.id,t);order.push({cell:c.id,tile:String(t.id),candidates:via});parent.set(c.id,c.id);comp.set(c.id,new Set(via===null?[c.id]:[]));
  for(let e=0;e<c.n;e++){const nid=c.edgeNeighbors[e];if(!fixed.has(nid))continue;const b=byCell.get(nid),j=twin(c,e,b),o=fixed.get(nid);if(!compatible(t.edges[e],o.edges[j]))throw new Error('placement broke a collapsed edge');if(walkable(t,e,o,j)){nav.push([c.id,nid]);link(nid,c.id);}}};
 const cands=new Map(),stale=new Set();
 const local=(c,extra=null)=>{const req=[];for(let e=0;e<c.n;e++){const nid=c.edgeNeighbors[e];let o=fixed.get(nid),j;if(!o&&extra&&extra.id===nid)o=extra.t;if(!o)continue;j=twin(c,e,byCell.get(nid));req.push([e,o.edges[j]]);}
  const out=[];for(const t of catalog.get(c.n)??[]){if(tests>=maxTests){truncated=true;return null;}tests++;if(req.every(([e,s])=>compatible(t.edges[e],s)))out.push(t);}return out;};
 const seedOrder=[];for(const [id,tid] of Object.entries(seeds).sort((a,b)=>a[0]-b[0])){const c=byCell.get(Number(id)),t=byTile.get(String(tid));if(!c||!t||t.edges.length!==c.n)throw new RangeError('unknown seed cell/tile');seedOrder.push(c.id);place(c,t,null);}
 for(const id of fixed.keys())for(const nid of byCell.get(id).edgeNeighbors)if(nid>=0&&!fixed.has(nid))stale.add(nid);
 const hash=(a,b)=>{let h=Math.imul(seed|0,374761393)^Math.imul(a,668265263)^Math.imul(b,2246822519);h=Math.imul(h^(h>>>13),1274126177);return(h^(h>>>16))>>>0;};
 // twoFronts：两粒种子的区域轮流推进（原片两条锋面同时生长）；候选集合与「只看坍缩边」的口径完全不变
 const [seedA,seedB]=seedOrder,turnCell=id=>{if(seedB===undefined)return 0;const c=byCell.get(id);let a=false,b=false;
  for(let e=0;e<c.n;e++){const nid=c.edgeNeighbors[e];if(nid<0||!fixed.has(nid))continue;const s=comp.get(find(nid));if(s?.has(seedA))a=true;if(s?.has(seedB))b=true;}
  return a&&b?2:a?0:b?1:-1;};
 let turn=0;
 while(order.length<maxCells&&!truncated){
  for(const id of stale){if(fixed.has(id)||dead.has(id))continue;const r=local(byCell.get(id));if(r===null)break;cands.set(id,r);}stale.clear();if(truncated)break;
  const pool=want=>{let b=null;for(const [id,list] of cands){if(fixed.has(id)||dead.has(id))continue;if(want!==null&&turnCell(id)!==want)continue;if(!b||list.length<b[1].length||(list.length===b[1].length&&id<b[0]))b=[id,list];}return b;};
  let best=twoFronts?(pool(turn)??pool(null)):pool(null);
  if(!best)break;const [id,list]=best,c=byCell.get(id);cands.delete(id);
  if(twoFronts&&turnCell(id)!==2)turn=turn===0?1:0;
  const ranked=prefer?[...list].sort((a,b)=>prefer(c,a)-prefer(c,b)||String(a.id).localeCompare(String(b.id))):(()=>{const k=list.length?hash(id,order.length)%list.length:0;return list.slice(k).concat(list.slice(0,k));})();
  let pick=null;for(const t of ranked){if(!forwardCheck){pick=t;break;}let ok=true;for(const nid of c.edgeNeighbors){if(nid<0||fixed.has(nid)||dead.has(nid))continue;const r=local(byCell.get(nid),{id,t});if(r===null){ok=false;break;}if(!r.length){ok=false;break;}}if(truncated)break;if(ok){pick=t;break;}}
  if(truncated)break;naive+=catalog.get(c.n)?.length??0;
  if(!pick){dead.add(id);continue;}
  place(c,pick,list.length);for(const nid of c.edgeNeighbors)if(nid>=0&&!fixed.has(nid)&&!dead.has(nid))stale.add(nid);
 }
 const placed=order.filter(o=>o.candidates!==null),components=new Map();for(const id of fixed.keys()){const r=find(id);components.set(r,(components.get(r)||0)+1);}
 return{complete:!truncated,order,assignment:Object.fromEntries([...fixed].map(([id,t])=>[id,String(t.id)])),nav,dead:[...dead].sort((a,b)=>a-b),merges,
  components:[...components.values()].sort((a,b)=>b-a),stats:{placed:placed.length,tests,naiveTests:naive,meanCandidates:placed.length?placed.reduce((s,o)=>s+o.candidates,0)/placed.length:0,saving:naive?1-tests/naive:0}};
}
