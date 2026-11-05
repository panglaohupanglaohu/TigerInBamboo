/** 1164926304640229376: "WFC running ... funky grid ... deterministic".
 * Socket CSP adapted to arbitrary polygon half-edges, not opposite quad edges.
 * Iterative backtracking avoids the original recursive solver's depth limit.
 */
const compare=(a,b)=>a<b?-1:a>b?1:0;
const hash=(seed,id,decision)=>{let h=Math.imul(seed|0,374761393)^Math.imul(id|0,668265263)^Math.imul(decision,2246822519);h=Math.imul(h^(h>>>13),1274126177);return (h^(h>>>16))>>>0;};
export function solveWFC(grid,{tiles,seed=1,pins={},preferred={},maxSteps=1000000,compatible=(a,b)=>a===b}={}){
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
  const restore=mark=>{while(trail.length>mark){const[id,d]=trail.pop();domains.set(id,d);}};
  const twin=(c,e,b)=>{const t=c.edgeTwins?.[e]??b.edgeNeighbors.indexOf(c.id);if(t<0||b.edgeNeighbors[t]!==c.id)throw Error('Nonreciprocal WFC edge');return t;};
  const propagate=ids=>{
    const queue=new Set(ids);
    while(queue.size){tick();let id=Infinity;for(const queued of queue)id=Math.min(id,queued);queue.delete(id);const c=byCell.get(id),d=domains.get(id);if(!d.length)return false;
      for(let e=0;e<c.n;e++){const bid=c.edgeNeighbors[e];if(bid<0)continue;const b=byCell.get(bid);if(!b)throw Error('Unknown neighbor');const t=twin(c,e,b),before=domains.get(bid),after=before.filter(bt=>d.some(at=>compatible(at.edges[e],bt.edges[t])));
        if(after.length!==before.length){set(bid,after);if(!after.length)return false;queue.add(bid);}
      }
    }return true;
  };
  const pick=()=>cells.filter(c=>domains.get(c.id).length>1).sort((a,b)=>domains.get(a.id).length-domains.get(b.id).length||a.id-b.id)[0];
  const push=c=>{decisions++;const d=domains.get(c.id),offset=hash(seed,c.id,decisions)%d.length;const options=d.slice(offset).concat(d.slice(0,offset)),old=options.findIndex(t=>String(t.id)===String(preferred[c.id]));if(old>0)options.unshift(options.splice(old,1)[0]);frames.push({id:c.id,options,index:0,mark:trail.length});};
  const result=(ok,reason)=>({ok,reason,tiles:ok?Object.fromEntries(cells.map(c=>[c.id,String(domains.get(c.id)[0].id)])):{},steps,decisions,backtracks,contradictions});
  for(const[id,tile]of Object.entries(pins)){const c=byCell.get(Number(id)),t=byTile.get(String(tile));if(!c||!t)throw Error('Unknown pin');domains.set(c.id,domains.get(c.id).filter(x=>x===t));}
  try{
    if(!propagate(cells.map(c=>c.id)))return result(false,'contradiction');trail.length=0;const first=pick();if(!first)return result(true,'solved');push(first);
    while(frames.length){tick();const f=frames.at(-1);restore(f.mark);if(f.index===f.options.length){frames.pop();backtracks++;continue;}
      set(f.id,[f.options[f.index++]]);if(!propagate([f.id])){contradictions++;backtracks++;continue;}
      const c=pick();if(!c)return result(true,'solved');push(c);
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
