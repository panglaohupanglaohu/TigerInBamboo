/** Local World diagnostic, inspired by REACode/terracecliff.classify.
 * 815236105079398400 "irregular is the new hex" does not specify quantization.
 * Measures logical undeformed top columns, not actual mesh slopes, caves or overhang underside area.
 */
export function terraceProfile(world,{levelHeight=1}={}){
 if(!Number.isFinite(levelHeight)||levelHeight<=0)throw new RangeError('positive level height required');
 const cells=world.cells,byId=new Map(cells.map(c=>[c.id,c])),heights=new Map(cells.map(c=>[c.id,world.ground(c)])),seen=new Set(),patches=[];
 let topArea=0,stepArea=0,shoreLength=0,stepEdges=0;
 const area=c=>Math.abs(c.pts.reduce((v,p,i)=>{const q=c.pts[(i+1)%c.n];return v+p.x*q.z-q.x*p.z},0))/2;
 for(const c of cells){const h=heights.get(c.id);if(!h)continue;topArea+=area(c);
  for(let i=0;i<c.n;i++){const id=c.edgeNeighbors[i],other=byId.get(id),oh=heights.get(id)||0;if(h<=oh)continue;const a=c.pts[i],b=c.pts[(i+1)%c.n],len=Math.hypot(a.x-b.x,a.z-b.z);stepArea+=len*(h-oh)*levelHeight;stepEdges++;if(!other||oh===0)shoreLength+=len;}
  if(seen.has(c.id))continue;const queue=[c];seen.add(c.id);let patchArea=0;
  for(let j=0;j<queue.length;j++){const q=queue[j];patchArea+=area(q);for(const id of q.edgeNeighbors)if(!seen.has(id)&&heights.get(id)===h){const next=byId.get(id);if(next){seen.add(id);queue.push(next);}}}
  patches.push({level:h,cells:queue.map(c=>c.id),area:patchArea});
 }
 return{version:world.version,landCells:seen.size,patches,topArea,stepArea,stepEdges,shoreLength,logicalColumnsOnly:true};
}
