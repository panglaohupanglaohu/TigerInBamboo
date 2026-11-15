/** 1164926304640229376: "WFC running ... funky grid ... deterministic".
 * Socket CSP adapted to arbitrary polygon half-edges, not opposite quad edges.
 * Iterative backtracking avoids the original recursive solver's depth limit.
 * Optional allowed[cellId] restricts tile IDs before pins; omitting it preserves
 * the full catalog. Empty domains are contradictions, unknown IDs are errors.
 */
const compare=(a,b)=>a<b?-1:a>b?1:0;
const hash=(seed,id,decision)=>{let h=Math.imul(seed|0,374761393)^Math.imul(id|0,668265263)^Math.imul(decision,2246822519);h=Math.imul(h^(h>>>13),1274126177);return (h^(h>>>16))>>>0;};
// 784847588893814785 tileplace (REACode Placer): weighted=true -> Shannon entropy H=log W - sum(w log w)/W picks the
// next cell, and the option order is a seeded weighted sample without replacement (Efraimidis-Spirakis key u^(1/w)).
// Default false keeps the original count-entropy + rotated order bit-for-bit. weight(tile) defaults to tile.weight ?? 1.
export function solveWFC(grid,{tiles,seed=1,pins={},allowed={},preferred={},maxSteps=1000000,compatible=(a,b)=>a===b,traceLimit=0,explain=false,weighted=false,weight=t=>t.weight??1}={}){
  if(!Number.isInteger(traceLimit)||traceLimit<0||traceLimit>256)throw new RangeError('Invalid trace limit');
  if(typeof explain!=='boolean')throw new RangeError('explain must be boolean');
  if(typeof weighted!=='boolean'||typeof weight!=='function')throw new RangeError('weighted must be boolean, weight a function');
  const W=weighted?new Map(tiles.map(t=>{const w=weight(t);if(!(w>0)||!Number.isFinite(w))throw new RangeError('tile weight must be positive');return[t,w];})):null;
  const entropy=d=>{let s=0,sl=0;for(const t of d){const w=W.get(t);s+=w;sl+=w*Math.log(w);}return Math.log(s)-sl/s;};
  if(!Array.isArray(tiles)||!tiles.length||!Number.isInteger(maxSteps)||maxSteps<1)throw new RangeError('Invalid WFC catalog/budget');
  if(tiles.some(t=>t.id===undefined||!Array.isArray(t.edges)))throw new TypeError('Invalid tile');
  if(grid.cells.some(c=>!Number.isInteger(c.id)||!Number.isInteger(c.n)||c.n<3||c.edgeNeighbors.length!==c.n))throw new TypeError('Invalid cell');
  const catalog=[...tiles].sort((a,b)=>compare(String(a.id),String(b.id))),byTile=new Map(catalog.map(t=>[String(t.id),t]));
  if(byTile.size!==catalog.length)throw new Error('Duplicate tile id');
  const cells=[...grid.cells].sort((a,b)=>a.id-b.id),byCell=new Map(cells.map(c=>[c.id,c]));
  if(byCell.size!==cells.length)throw new Error('Duplicate cell id');
  const domains=new Map(cells.map(c=>[c.id,catalog.filter(t=>t.edges.length===c.n)])),trail=[],frames=[];
  let steps=0,decisions=0,backtracks=0,contradictions=0;const LIMIT=Symbol('budget');
  const tick=()=>{if(++steps>maxSteps)throw LIMIT;};
  const set=(id,d)=>{trail.push([id,domains.get(id)]);domains.set(id,d);};
  // 865200072685912064 dependency chain: live cause records for the CURRENT branch (truncated on backtrack).
  const causes=[],conflicts=[];const cause=r=>{if(explain)causes.push(Object.freeze({...r,decisions}));};
  const restore=(mark,cmark=causes.length)=>{while(trail.length>mark){const[id,d]=trail.pop();domains.set(id,d);}causes.length=Math.min(causes.length,cmark);};
  const twin=(c,e,b)=>{const t=c.edgeTwins?.[e]??b.edgeNeighbors.indexOf(c.id);if(t<0||b.edgeNeighbors[t]!==c.id)throw Error('Nonreciprocal WFC edge');return t;};
  const propagate=ids=>{
    const queue=new Set(ids);
    while(queue.size){tick();let id=Infinity;for(const queued of queue)id=Math.min(id,queued);queue.delete(id);const c=byCell.get(id),d=domains.get(id);if(!d.length)return false;
      for(let e=0;e<c.n;e++){const bid=c.edgeNeighbors[e];if(bid<0)continue;const b=byCell.get(bid);if(!b)throw Error('Unknown neighbor');const t=twin(c,e,b),before=domains.get(bid),after=before.filter(bt=>d.some(at=>compatible(at.edges[e],bt.edges[t])));
        if(after.length!==before.length){set(bid,after);cause({cell:bid,from:id,edge:e,removed:before.filter(t=>!after.includes(t)).map(t=>String(t.id)),left:after.length});if(!after.length){if(explain&&conflicts.length<16)conflicts.push(Object.freeze(dependencyChain(causes,bid)));return false;}queue.add(bid);}
      }
    }return true;
  };
  const pick=()=>{if(!W)return cells.filter(c=>domains.get(c.id).length>1).sort((a,b)=>domains.get(a.id).length-domains.get(b.id).length||a.id-b.id)[0];
    let best=null,bh=Infinity;for(const c of cells){const d=domains.get(c.id);if(d.length<2)continue;const h=entropy(d);if(h<bh-1e-12){bh=h;best=c;}}return best;};
  const order=(c,d)=>{if(!W){const offset=hash(seed,c.id,decisions)%d.length;return d.slice(offset).concat(d.slice(0,offset));}
    return d.map((t,i)=>{const u=(hash(seed^0x5bd1e995,c.id*977+i,decisions)+.5)/4294967296;return{t,k:Math.log(u)/W.get(t)};}).sort((a,b)=>b.k-a.k||compare(String(a.t.id),String(b.t.id))).map(x=>x.t);};
  const push=c=>{decisions++;const d=domains.get(c.id);const options=order(c,d),old=options.findIndex(t=>String(t.id)===String(preferred[c.id]));if(old>0)options.unshift(options.splice(old,1)[0]);frames.push({id:c.id,options,index:0,mark:trail.length,cmark:causes.length});};
  // 865200072685912064: bounded playback of actual candidate domains, not fabricated animation.
  const trace=[];let traceEvents=0;
  const record=stage=>{if(!traceLimit)return;traceEvents++;if(trace.length>=traceLimit)return;
    const snapshot=Object.fromEntries(cells.map(c=>[c.id,Object.freeze(domains.get(c.id).map(t=>String(t.id)))]));
    trace.push(Object.freeze({stage,steps,decisions,domains:Object.freeze(snapshot)}));};
  const result=(ok,reason)=>{record(reason);return {ok,reason,tiles:ok?Object.fromEntries(cells.map(c=>[c.id,String(domains.get(c.id)[0].id)])):{},steps,decisions,backtracks,contradictions,...(traceLimit?{trace:Object.freeze(trace.slice()),traceEvents,traceTruncated:traceEvents>trace.length}:{}),...(explain?{causes:Object.freeze(causes.slice()),conflicts:Object.freeze(conflicts.slice())}:{})};};
  for(const[id,ids]of Object.entries(allowed)){if(!byCell.has(Number(id))||!Array.isArray(ids)||ids.some(x=>!byTile.has(String(x))))throw new Error('Unknown allowed domain');const keep=new Set(ids.map(String));domains.set(Number(id),domains.get(Number(id)).filter(t=>keep.has(String(t.id))));}
  for(const[id,tile]of Object.entries(pins)){const c=byCell.get(Number(id)),t=byTile.get(String(tile));if(!c||!t)throw Error('Unknown pin');domains.set(c.id,domains.get(c.id).filter(x=>x===t));cause({cell:c.id,from:null,kind:'pin',tile:String(t.id)});}
  try{
    if(!propagate(cells.map(c=>c.id)))return result(false,'contradiction');trail.length=0;record('initial');const first=pick();if(!first)return result(true,'solved');push(first);
    while(frames.length){tick();const f=frames.at(-1);restore(f.mark,f.cmark);if(f.index===f.options.length){frames.pop();backtracks++;continue;}
      set(f.id,[f.options[f.index++]]);cause({cell:f.id,from:null,kind:'decision',tile:String(f.options[f.index-1].id)});if(!propagate([f.id])){contradictions++;backtracks++;record('contradiction');continue;}
      record('decision');const c=pick();if(!c)return result(true,'solved');push(c);
    }return result(false,'contradiction');
  }catch(e){if(e===LIMIT)return result(false,'budget');throw e;}
}


/** Check all half-edge sockets independently of solver domain state. */
export function findWFCConflicts(grid,assignment,tiles,{compatible=(a,b)=>a===b}={}){
  const byCell=new Map(grid.cells.map(c=>[c.id,c])),catalog=new Map(tiles.map(t=>[String(t.id),t])),bad=new Set();
  for(const c of grid.cells){const a=catalog.get(String(assignment[c.id]));if(!a||a.edges.length!==c.n){bad.add(c.id);continue;}
    for(let e=0;e<c.n;e++){const id=c.edgeNeighbors[e];if(id<0)continue;const b=byCell.get(id),t=c.edgeTwins?.[e]??b?.edgeNeighbors.indexOf(c.id);if(!b||t<0||b.edgeNeighbors[t]!==c.id)throw Error('Nonreciprocal WFC edge');const bt=catalog.get(String(assignment[id]));if(!bt||!compatible(a.edges[e],bt.edges[t])){bad.add(c.id);bad.add(id);}}
  }return [...bad].sort((a,b)=>a-b);
}
/** 793806535898136576: "repair itself when it has screwed up".
 * Freeze the exterior, prefer old values inside, and expand only on contradiction.
 * This is an engineering strategy, not a claim about the video's hidden solver.
 */
export function repairWFC(grid,{tiles,current,edits={},seed=1,maxRadius=4,maxSteps=1000000,compatible=(a,b)=>a===b}={}){
  if(!current||!Number.isInteger(maxRadius)||maxRadius<0||!Number.isInteger(maxSteps)||maxSteps<1)throw new RangeError('Invalid repair input');
  const byCell=new Map(grid.cells.map(c=>[c.id,c])),catalog=new Map(tiles.map(t=>[String(t.id),t])),tentative={...current,...edits};
  for(const id of Object.keys(edits))if(!byCell.has(Number(id))||!catalog.has(String(edits[id])))throw Error('Unknown repair edit');
  const conflicts=findWFCConflicts(grid,tentative,tiles,{compatible}),region=new Set([...conflicts,...Object.keys(edits).map(Number)]);
  if(!region.size)return {ok:true,reason:'unchanged',tiles:{...current},changedCells:[],region:[],radius:0,attempts:0,steps:0};
  let steps=0,attempts=0;
  for(let radius=0;radius<=maxRadius;radius++){
    const pins={...edits};for(const c of grid.cells)if(!region.has(c.id))pins[c.id]=tentative[c.id];
    const candidate=solveWFC(grid,{tiles,seed,pins,preferred:current,compatible,maxSteps:Math.max(1,maxSteps-steps)});attempts++;steps+=candidate.steps;
    if(candidate.ok)return {...candidate,steps,attempts,radius,region:[...region].sort((a,b)=>a-b),changedCells:grid.cells.filter(c=>String(candidate.tiles[c.id])!==String(current[c.id])).map(c=>c.id).sort((a,b)=>a-b),conflictsBefore:conflicts};
    if(candidate.reason==='budget'||steps>=maxSteps)return {ok:false,reason:'budget',tiles:{...current},changedCells:[],region:[...region],steps,attempts};
    if(radius===maxRadius)break;
    const next=new Set(region);for(const id of region)for(const nb of byCell.get(id).edgeNeighbors)if(nb>=0)next.add(nb);
    if(next.size===region.size)break;for(const id of next)region.add(id);
  }
  return {ok:false,reason:'radius',tiles:{...current},changedCells:[],region:[...region].sort((a,b)=>a-b),steps,attempts};
}

/**
 * 第 50 轮，迁自 REACode src/socketrock.js（1164926304640229376「WFC running at interactive speed on that funky grid」）：
 * 原版发现「岩类 tile 一块都不出现」不是种子 / 边界的锅，而是 tile 集在边标签上不闭合——某个接口朝外那一侧没有任何 tile 能接，
 * 于是带这个接口的 tile 只能被自己包围，一路传播到边界被消掉。原版在 4 向方格上逐方向查；这里换到共享多边形网格：
 * 1) 只按真实网格做一遍 AC 传播（不做任何决策），哪些 tile 在所有格的初始域里都被消掉 = 死 tile；
 * 2) 逐 tile × 接口值查「有没有任何 tile 的任何一条边能接它」（多边形网格的边序与邻居的孪生边序不固定，所以不看方向）。
 * 返回 { dead: [tile id], alive: {id: 还剩几格}, unpairedSockets: [{tile, socket}], boundaryLocked }。
 * boundary：网格外沿那一侧当作什么接口（默认不限制；原版的「边界锁 0」= boundary: 0）。
 */
export function diagnoseTiles(grid, { tiles, compatible = (a, b) => a === b, boundary = undefined } = {}) {
  const cells = grid.cells, byCell = new Map(cells.map((c) => [c.id, c]));
  const dom = new Map(cells.map((c) => [c.id, tiles.filter((t) => t.edges.length === c.n && (boundary === undefined || c.edgeNeighbors.every((nb, e) => nb >= 0 || compatible(t.edges[e], boundary))))]));
  const twin = (c, e, b) => c.edgeTwins?.[e] ?? b.edgeNeighbors.indexOf(c.id);
  const queue = cells.map((c) => c.id), inq = new Set(queue);
  while (queue.length) {
    const id = queue.shift(); inq.delete(id); const c = byCell.get(id), d = dom.get(id);
    for (let e = 0; e < c.n; e++) {
      const nb = c.edgeNeighbors[e]; if (nb < 0) continue; const b = byCell.get(nb), t = twin(c, e, b), before = dom.get(nb);
      const after = before.filter((u) => d.some((s) => compatible(s.edges[e], u.edges[t])));
      if (after.length !== before.length) { dom.set(nb, after); if (!inq.has(nb)) { inq.add(nb); queue.push(nb); } }
    }
  }
  const alive = Object.fromEntries(tiles.map((t) => [String(t.id), 0]));
  for (const d of dom.values()) for (const t of d) alive[String(t.id)]++;
  const unpairedSockets = [];
  for (const t of tiles) for (const s of new Set(t.edges)) if (!tiles.some((u) => u.edges.some((x) => compatible(s, x)))) unpairedSockets.push({ tile: String(t.id), socket: s });
  return { dead: Object.keys(alive).filter((k) => !alive[k]), alive, unpairedSockets, boundaryLocked: boundary !== undefined };
}

/** 1447494168448753667 / 1579483114178768898: four diagonal subtiles of one quad behave as ONE module.
 * Joint constraint by sockets: for every quad tile T and child slot e, a triangle tile whose two
 * inner edges carry `T` + the shared spoke index. Equality around the closed ring of spokes forces
 * all four children of a source quad to pick the same T, so the ordinary half-edge WFC enforces the
 * group without a special solver. Source triangles keep the triangle catalog via `allowed`.
 * Returns {tiles, allowed, decode(assignment)} — decode maps a solved subgrid back to parent tiles.
 */
export function jointSubtileCatalog(subgrid,{quadTiles,triTiles=[]}={}){
  const groups=subgrid?.subdivision?.groups;if(!Array.isArray(groups))throw new TypeError('buildTriangularSubgrid result required');
  if(!Array.isArray(quadTiles)||!quadTiles.length||quadTiles.some(t=>t?.id===undefined||t.edges?.length!==4))throw new TypeError('quad tiles need four edges');
  if(!Array.isArray(triTiles)||triTiles.some(t=>t?.id===undefined||t.edges?.length!==3))throw new TypeError('triangle tiles need three edges');
  const byCell=new Map(subgrid.cells.map(c=>[c.id,c])),tiles=[...triTiles.map(t=>({...t,id:'tri:'+t.id}))],allowed={},slotTiles=new Map(),groupOf=new Map();
  const spoke=(T,k)=>'spoke:'+String(T.id)+':'+k;
  for(const g of groups){
    if(g.children.length===1){allowed[g.children[0]]=triTiles.map(t=>'tri:'+t.id);groupOf.set(g.children[0],g);continue;}
    if(g.children.length!==4)throw new RangeError('unexpected subdivision group');
    for(const id of g.children){
      const c=byCell.get(id),e=c.sourceEdge;groupOf.set(id,g);
      // Geometry-derived roles: outer edge leaves the group; inner edges touch slots e±1.
      const role=c.edgeNeighbors.map(nb=>{const o=byCell.get(nb);if(!o||o.sourceCell!==c.sourceCell)return'outer';if(o.sourceEdge===(e+1)%4)return'next';if(o.sourceEdge===(e+3)%4)return'prev';throw new RangeError('subtile ring broken');});
      if(role.filter(r=>r==='outer').length!==1||!role.includes('next')||!role.includes('prev'))throw new RangeError('subtile roles invalid');
      const key=e+':'+role.join(',');if(!slotTiles.has(key)){const ids=[];for(const T of quadTiles){const id='quad:'+T.id+'#'+key;ids.push(id);tiles.push({id,quad:String(T.id),slot:e,edges:role.map(r=>r==='outer'?T.edges[e]:r==='next'?spoke(T,(e+1)%4):spoke(T,e))});}slotTiles.set(key,ids);}
      allowed[id]=slotTiles.get(key);
    }
  }
  const decode=assignment=>{const parent={};for(const g of groups){const vals=g.children.map(id=>String(assignment[id]));
    if(g.children.length===1){if(!vals[0].startsWith('tri:'))throw new RangeError('triangle cell got a subtile');parent[g.sourceCell]=vals[0].slice(4);continue;}
    const quads=new Set(vals.map(v=>{const m=/^quad:(.*)#/.exec(v);if(!m)throw new RangeError('quad child got a triangle tile');return m[1];}));
    if(quads.size!==1)throw new RangeError('joint subtile constraint violated');parent[g.sourceCell]=[...quads][0];}
    return parent;};
  return {tiles,allowed,decode};
}

/** Follow live cause records back from the latest reduction of `cell` to the decision/pin that
 * started it: [{cell, from, edge, removed, ...}, ..., {kind:'decision'|'pin'}] (the red chain). */
export function dependencyChain(causes,cell){
  const chain=[];let i=causes.length-1,target=cell;
  while(i>=0){
    while(i>=0&&causes[i].cell!==target)i--;if(i<0)break;
    const r=causes[i];chain.push(r);if(r.from===null||r.from===undefined)break;target=r.from;i--;
    if(chain.length>causes.length)break;
  }
  return chain;
}

/** REACode slotsolve variants(): corner values 0..K-1, edge value = (c_i + c_(i+1)) mod K, deduplicated
 * by edge tuple. Symmetric in the two corners, so it is a valid socket on reversed half-edge twins of
 * any polygon grid. n=4, K=3 reproduces the original 4-sided pool. */
export function cornerVariantTiles(n=4,K=3){
  if(!Number.isInteger(n)||n<3||n>8||!Number.isInteger(K)||K<1||K**n>65536)throw new RangeError('invalid variant size');
  const seen=new Map();
  for(let code=0;code<K**n;code++){const c=[];let x=code;for(let i=0;i<n;i++){c.push(x%K);x=Math.floor(x/K);}
    const edges=c.map((v,i)=>(v+c[(i+1)%n])%K),key=edges.join(',');if(!seen.has(key))seen.set(key,{id:n+'v'+seen.size,edges,corners:c});}
  return [...seen.values()];
}

/** REACode slotsolve makeGrid on the shared grid: random corner values per shared vertex give a
 * self-consistent truth; a deterministic share of cells becomes "given" pins. */
export function cornerSlots(grid,{K=3,seed=7,givenRatio=.18}={}){
  if(!(givenRatio>=0&&givenRatio<=1))throw new RangeError('givenRatio in [0,1]');
  let s=(seed>>>0)||1;const rnd=()=>{s^=s<<13;s>>>=0;s^=s>>17;s^=s<<5;s>>>=0;return s/4294967296;};
  const corner=new Map();for(const v of[...grid.verts].sort((a,b)=>a.id-b.id))corner.set(v.id,Math.floor(rnd()*K));
  const pools=new Map(),tiles=[],truth={},pins={};
  for(const c of[...grid.cells].sort((a,b)=>a.id-b.id)){
    if(!pools.has(c.n)){const p=cornerVariantTiles(c.n,K);pools.set(c.n,p);tiles.push(...p);}
    const vals=c.pts.map(p=>corner.get(p.id)),edges=vals.map((v,i)=>(v+vals[(i+1)%c.n])%K).join(',');
    truth[c.id]=pools.get(c.n).find(t=>t.edges.join(',')===edges).id;if(rnd()<givenRatio)pins[c.id]=truth[c.id];
  }
  return{tiles,truth,pins,K,seed};
}

/** 1751932427272909032 "force specific modules to appear" — joint with WFC. For a footprint `mapping`
 * (module index → cell id, e.g. from findModulePatches) every module cell is restricted to catalog tiles
 * whose edges carry `inner` exactly on edges toward other module cells and never elsewhere; no other
 * cell anywhere may use `inner` (so the module socket cannot appear by accident). Then the ordinary solver fills the surroundings.
 * Returns the solve result plus {mapping}; ok=false means this footprint cannot host the module.
 */
export function solveWithModule(grid,{tiles,mapping,inner,seed=1,maxSteps=1000000,compatible=(a,b)=>a===b,pins={}}={}){
  if(!Array.isArray(mapping)||!mapping.length||new Set(mapping).size!==mapping.length)throw new RangeError('module mapping required');
  const byCell=new Map(grid.cells.map(c=>[c.id,c])),inside=new Set(mapping);if(mapping.some(id=>!byCell.has(id)))throw new RangeError('unknown module cell');
  const allowed={};
  for(const c of grid.cells){
    const want=c.edgeNeighbors.map(nb=>inside.has(c.id)&&inside.has(nb));
    allowed[c.id]=tiles.filter(t=>t.edges.length===c.n&&t.edges.every((s,e)=>want[e]?s===inner:s!==inner)).map(t=>t.id);
  }
  return{...solveWFC(grid,{tiles,seed,allowed,pins,maxSteps,compatible}),mapping:[...mapping]};
}

/** 787319655648100352 "Now in 3D": stack any half-edge grid into H layers. Lattice id = cellId*H + (level-1);
 * edges = the cell's own sides (twins kept), then up (index n) and down (index n+1), so the ordinary solver
 * runs unchanged. Each lattice cell keeps {base, level}. */
export function layerGrid(grid,H){
  if(!Number.isInteger(H)||H<1||H>16)throw new RangeError('layer count 1..16');
  const cells=[];for(const c of [...grid.cells].sort((a,b)=>a.id-b.id)){
    if(!Number.isInteger(c.id)||c.id<0)throw new TypeError('Invalid cell');
    for(let k=1;k<=H;k++){const edgeNeighbors=c.edgeNeighbors.map(nb=>nb<0?-1:nb*H+k-1),edgeTwins=c.edgeNeighbors.map((nb,e)=>nb<0?-1:c.edgeTwins?.[e]??grid.cells.find(b=>b.id===nb).edgeNeighbors.indexOf(c.id));
      edgeNeighbors.push(k<H?c.id*H+k:-1,k>1?c.id*H+k-2:-1);edgeTwins.push(k<H?c.n+1:-1,k>1?c.n:-1);
      cells.push({id:c.id*H+k-1,n:c.n+2,edgeNeighbors,edgeTwins,base:c.id,level:k});}
  }
  return{cells,H,base:grid,kind:'layered'};
}

/** 1447494168448753667 + 787319655648100352 + 1579483114178768898: the four-diagonal-subtile joint module, in 3D.
 * Per layer the spoke ring forces the four children of a quad to one module (as jointSubtileCatalog); vertically
 * a module may span `levels` layers (multi-cell tile across floors): its parts are tied by `tall:` sockets on the
 * up/down half-edges, so all 4×levels subcells (or 1×levels for a triangle) are one module.
 * quadTiles: {id, edges:[4 side sockets], up, down, levels=1, weight}; triTiles: {id, edges:[3], up, down, levels=1}.
 * `compatible` judges the user's side/up/down sockets; joint sockets (spoke:/tall:) are compared by equality.
 * Returns {lattice, tiles, allowed, compatible, decode} — decode(assignment) gives {levels:[{parentCell: id}], modules}
 * and throws if any joint constraint is broken. */
export function layeredJointCatalog(subgrid,H,{quadTiles,triTiles=[],compatible=(a,b)=>a===b}={}){
  const groups=subgrid?.subdivision?.groups;if(!Array.isArray(groups))throw new TypeError('buildTriangularSubgrid result required');
  const lv=t=>t.levels??1;
  if(!Array.isArray(quadTiles)||!quadTiles.length||quadTiles.some(t=>t?.id===undefined||t.edges?.length!==4||!Number.isInteger(lv(t))||lv(t)<1||lv(t)>H))throw new TypeError('quad tiles need four side edges and 1..H levels');
  if(!Array.isArray(triTiles)||triTiles.some(t=>t?.id===undefined||t.edges?.length!==3||!Number.isInteger(lv(t))||lv(t)<1||lv(t)>H))throw new TypeError('triangle tiles need three side edges');
  const lattice=layerGrid(subgrid,H),byCell=new Map(subgrid.cells.map(c=>[c.id,c])),tiles=[],allowed={},byKey=new Map();
  const joint=x=>typeof x==='string'&&(x.startsWith('spoke:')||x.startsWith('tall:'));
  const compat=(a,b)=>joint(a)||joint(b)?a===b:compatible(a,b);
  const vert=(T,tag,p)=>[p<lv(T)-1?'tall:'+tag+':'+p:T.up,p>0?'tall:'+tag+':'+(p-1):T.down];
  const variant=(key,make)=>{if(!byKey.has(key))byKey.set(key,make());return byKey.get(key);};
  for(const g of groups){
    if(g.children.length===1){const id=g.children[0];
      const parts=variant('tri',()=>{const out=[];for(const T of triTiles)for(let p=0;p<lv(T);p++){const t={id:'tri:'+T.id+'@'+p,src:String(T.id),part:p,levels:lv(T),weight:T.weight,edges:[...T.edges,...vert(T,'t:'+T.id,p)]};tiles.push(t);out.push(t);}return out;});
      for(let k=1;k<=H;k++)allowed[id*H+k-1]=parts.filter(t=>k-t.part>=1&&k+t.levels-1-t.part<=H).map(t=>t.id);continue;}
    if(g.children.length!==4)throw new RangeError('unexpected subdivision group');
    for(const id of g.children){const c=byCell.get(id),e=c.sourceEdge;
      const role=c.edgeNeighbors.map(nb=>{const o=byCell.get(nb);if(!o||o.sourceCell!==c.sourceCell)return'outer';if(o.sourceEdge===(e+1)%4)return'next';if(o.sourceEdge===(e+3)%4)return'prev';throw new RangeError('subtile ring broken');});
      if(role.filter(r=>r==='outer').length!==1)throw new RangeError('subtile roles invalid');
      const key=e+':'+role.join(',');
      const parts=variant(key,()=>{const out=[];for(const T of quadTiles)for(let p=0;p<lv(T);p++){const sp=k=>'spoke:'+T.id+':'+p+':'+k;
        const t={id:'quad:'+T.id+'@'+p+'#'+key,src:String(T.id),part:p,levels:lv(T),slot:e,weight:T.weight,edges:[...role.map(r=>r==='outer'?T.edges[e]:r==='next'?sp((e+1)%4):sp(e)),...vert(T,'q:'+T.id+':'+e,p)]};tiles.push(t);out.push(t);}return out;});
      for(let k=1;k<=H;k++)allowed[id*H+k-1]=parts.filter(t=>k-t.part>=1&&k+t.levels-1-t.part<=H).map(t=>t.id);}
  }
  const byId=new Map(tiles.map(t=>[t.id,t]));
  const decode=assignment=>{const levels=Array.from({length:H},()=>({})),modules=[];
    for(const g of groups){for(let k=1;k<=H;k++){const ts=g.children.map(id=>byId.get(String(assignment[id*H+k-1])));if(ts.some(t=>!t))throw new RangeError('unknown tile');
        if(new Set(ts.map(t=>t.src+'@'+t.part)).size!==1)throw new RangeError('joint subtile constraint violated');
        if(ts[0].id.startsWith('tri:')!==(g.children.length===1))throw new RangeError('tile kind mismatch');levels[k-1][g.sourceCell]=ts[0].src;
        if(ts[0].part===0){for(let p=1;p<ts[0].levels;p++){const up=g.children.map(id=>byId.get(String(assignment[id*H+k-1+p])));if(up.some(t=>!t||t.src!==ts[0].src||t.part!==p))throw new RangeError('multi-level module broken');}
          modules.push({cell:g.sourceCell,tile:ts[0].src,level:k,levels:ts[0].levels,children:g.children.length});}}}
    return{levels,modules};};
  return{lattice,tiles,allowed,compatible:compat,decode};
}

/** 1751932427272909032 + 1579483114178768898: 3D prefab with sockets. `mapping` lists lattice cells (any grid,
 * typically layerGrid) the prefab occupies, in prefab index order. Each part gets its own tile: faces toward
 * another part carry a unique pair socket 'prefab:i-j' (so only this exact arrangement fits), outer faces carry
 * socket(i, e, cell) — the prefab's declared sockets (door, wall, roof...). No other cell may use a prefab tile.
 * The ordinary solver must then fill the surroundings against those sockets. Returns solve result + {parts}. */
export function solveWithPrefab(grid,{tiles,mapping,socket,seed=1,maxSteps=1000000,compatible=(a,b)=>a===b,pins={},allowed:extra={},weighted=false,traceLimit=0,partWeight=1}={}){
  if(!Array.isArray(mapping)||!mapping.length||new Set(mapping).size!==mapping.length)throw new RangeError('prefab mapping required');
  if(typeof socket!=='function')throw new TypeError('socket(i,e,cell) required');
  const byCell=new Map(grid.cells.map(c=>[c.id,c])),index=new Map(mapping.map((id,i)=>[id,i]));if(mapping.some(id=>!byCell.has(id)))throw new RangeError('unknown prefab cell');
  const pair=x=>typeof x==='string'&&x.startsWith('prefab:');
  const compat=(a,b)=>pair(a)||pair(b)?a===b:compatible(a,b);
  const parts=mapping.map((id,i)=>{const c=byCell.get(id);return{id:'prefab#'+i,part:i,weight:partWeight,solid:true,edges:c.edgeNeighbors.map((nb,e)=>index.has(nb)?'prefab:'+Math.min(i,index.get(nb))+'-'+Math.max(i,index.get(nb))+':'+(i<index.get(nb)?e:c.edgeTwins?.[e]??byCell.get(nb).edgeNeighbors.indexOf(id)):socket(i,e,c))};});
  // pair socket must be identical from both sides: key on the lower index's edge number
  for(const [i,id] of mapping.entries()){const c=byCell.get(id);c.edgeNeighbors.forEach((nb,e)=>{if(!index.has(nb))return;const j=index.get(nb),t=c.edgeTwins?.[e]??byCell.get(nb).edgeNeighbors.indexOf(id);if(parts[i].edges[e]!==parts[j].edges[t])throw new Error('prefab pair socket mismatch');});}
  const all=[...tiles,...parts],allowed={};
  for(const c of grid.cells){const own=index.get(c.id);allowed[c.id]=own!==undefined?[parts[own].id]:(extra[c.id]??tiles.filter(t=>t.edges.length===c.n).map(t=>t.id));}
  return{...solveWFC(grid,{tiles:all,seed,allowed,pins,maxSteps,compatible:compat,weighted,traceLimit}),parts,catalog:all,compatible:compat};
}

/** Lift a 2D footprint (base cell ids, e.g. from findModulePatches) into a layered lattice: levels from..from+h-1. */
export function liftFootprint(lattice,baseIds,from,h){
  if(!Number.isInteger(from)||!Number.isInteger(h)||from<1||h<1||from+h-1>lattice.H)throw new RangeError('levels out of lattice');
  return Array.from({length:h},(_,p)=>baseIds.map(id=>id*lattice.H+from+p-1)).flat();
}
