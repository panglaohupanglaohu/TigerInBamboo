/** 1751932427272909032: reuse a suitable existing patch before generating one.
 * Topological candidates ONLY: sides + induced adjacency do not prove socket,
 * metric shape, support or prefab compatibility. Read-only, bounded, iterative.
 */
function validatePattern(pattern){
 const {sides,adj}=pattern??{},n=sides?.length;
 if(!Array.isArray(sides)||n<1||n>32||!sides.every(s=>Number.isInteger(s)&&s>=3&&s<=8)||!Array.isArray(adj)||adj.length!==n)throw new TypeError('Invalid module');
 for(let i=0;i<n;i++)if(!Array.isArray(adj[i])||new Set(adj[i]).size!==adj[i].length||adj[i].some(j=>!Number.isInteger(j)||j<0||j>=n||j===i)||adj[i].length>sides[i])throw new TypeError('Invalid adjacency');
 for(let i=0;i<n;i++)for(const j of adj[i])if(!adj[j].includes(i))throw new TypeError('Asymmetric module');
 const order=[0],seen=new Set(order),parent=Array(n).fill(-1);for(let k=0;k<order.length;k++)for(const j of [...adj[order[k]]].sort((a,b)=>a-b))if(!seen.has(j)){seen.add(j);parent[j]=order[k];order.push(j)}
 if(order.length!==n)throw new RangeError('Disconnected module');return{n,sides,adj,order,parent};
}
function validateGrid(grid){
 const cells=grid?.cells;if(!Array.isArray(cells))throw new TypeError('Invalid grid');
 for(let i=0;i<cells.length;i++){const c=cells[i];if(c.id!==i||!Number.isInteger(c.n)||!Array.isArray(c.edgeNeighbors)||c.edgeNeighbors.length!==c.n||c.edgeNeighbors.some(j=>!Number.isInteger(j)||j< -1||j>=cells.length||j===i))throw new TypeError('Invalid grid topology');}
 for(const c of cells)for(const j of c.edgeNeighbors)if(j>=0&&!cells[j].edgeNeighbors.includes(c.id))throw new TypeError('Asymmetric grid');return cells;
}
export function describeModule(grid,ids){
 const cells=validateGrid(grid);if(!Array.isArray(ids)||!ids.length||new Set(ids).size!==ids.length||ids.some(i=>!Number.isInteger(i)||i<0||i>=cells.length))throw new TypeError('Invalid selection');
 const sides=ids.map(i=>cells[i].n),adj=ids.map(i=>ids.flatMap((j,k)=>cells[i].edgeNeighbors.includes(j)?[k]:[]));const pattern={sides,adj};validatePattern(pattern);return pattern;
}
export function findModulePatches(grid,pattern,{maxTests=250000,limit=6,accept=null}={}){
 if(accept!==null&&typeof accept!=='function')throw new TypeError('Invalid candidate predicate');
 if(!Number.isSafeInteger(maxTests)||maxTests<0||!Number.isSafeInteger(limit)||limit<1||limit>1000)throw new RangeError('Invalid search budget');
 const cells=validateGrid(grid),{n,sides,adj,order,parent}=validatePattern(pattern),mapping=Array(n).fill(-1),used=new Set(),matches=[],footprints=new Set();let tests=0,depth=0,reason='complete';
 const candidates=(mi)=>parent[mi]<0?cells.map(c=>c.id):[...new Set(cells[mapping[parent[mi]]].edgeNeighbors.filter(i=>i>=0))].sort((a,b)=>a-b);
 const frames=[{ids:candidates(order[0]),next:0}];
 while(depth>=0){const frame=frames[depth],mi=order[depth];
  if(frame.next>=frame.ids.length){frames.pop();depth--;if(depth>=0){const pm=order[depth];used.delete(mapping[pm]);mapping[pm]=-1}continue;}
  if(tests>=maxTests){reason='budget';break;}const ci=frame.ids[frame.next++];tests++;
  if(used.has(ci)||cells[ci].n!==sides[mi]||cells[ci].edgeNeighbors.filter(i=>i>=0).length<adj[mi].length)continue;
  if(mapping.some((gi,mj)=>gi>=0&&adj[mi].includes(mj)!==cells[ci].edgeNeighbors.includes(gi)))continue;
  mapping[mi]=ci;used.add(ci);
  if(depth===n-1){const key=[...mapping].sort((a,b)=>a-b).join(',');if(!footprints.has(key)&&(!accept||accept([...mapping]))){footprints.add(key);matches.push([...mapping]);}used.delete(ci);mapping[mi]=-1;if(matches.length>=limit){reason='limit';break}}
  else{depth++;frames.push({ids:candidates(order[depth]),next:0})}
 }
 return{matches,tests,reason,complete:reason==='complete',scope:accept?'topology-with-predicate':'topology-only',deduplication:'cell-footprint'};
}
