/** Priority-flood adapted from REACode/depfill to shared polygon adjacency.
 * Quantized levels use flat spill surfaces, with an explicit acyclic outlet
 * tree. This is filling, not erosion.
 *
 * r53 (REACode/depfill.js, 1447488323845509121 "Erosion valid terrain with no
 * local minimums"): optional Barnes-style epsilon micro-slope. `filled` keeps
 * the integer spill levels that the World stores; `surface` is the continuous
 * drainage surface (spill + k·eps) in which every non-outlet cell has a strictly
 * lower parent, so flats and lakes get one drainage direction. Also ports the
 * original lake/local-minimum/drained diagnostics onto polygon adjacency.
 */
import{MinHeap}from'./minheap.js';
function validate(cells,heights){
 const n=cells.length;if(heights.length!==n||cells.some((c,i)=>c.id!==i)||!Array.from(heights).every(x=>Number.isFinite(x)&&x>=0))throw new RangeError('invalid height graph');
 for(const c of cells)for(const id of c.edgeNeighbors)if(!Number.isInteger(id)||id<-1||id>=n||id>=0&&!cells[id].edgeNeighbors.includes(c.id))throw new RangeError('invalid reciprocal adjacency');
}
export function depressionFill(cells,heights,{microSlope=0}={}){
 validate(cells,heights);if(!Number.isFinite(microSlope)||microSlope<0||microSlope>=.5)throw new RangeError('micro slope must be in [0,0.5)');
 const n=cells.length,filled=Float64Array.from(heights),surface=Float64Array.from(heights),parent=new Int32Array(n).fill(-2),heap=new MinHeap();
 for(const c of cells)if(heights[c.id]===0||c.edgeNeighbors.includes(-1)){parent[c.id]=-1;heap.push(surface[c.id],c.id);}
 while(heap.length){const[h,id]=heap.pop();for(const nb of cells[id].edgeNeighbors){if(nb<0||parent[nb]!==-2)continue;
  filled[nb]=Math.max(heights[nb],filled[id]);
  // Micro-slope only where the integer surface is flat/raised; real steps keep their height.
  surface[nb]=heights[nb]>filled[id]?heights[nb]:Math.max(heights[nb],h+microSlope);
  parent[nb]=id;heap.push(surface[nb],nb);}}
 if(parent.includes(-2))throw new RangeError('component has no water or boundary outlet');
 if(microSlope>0){for(let id=0;id<n;id++)if(surface[id]-filled[id]>=.5)throw new RangeError('micro slope too large for this flat; reduce microSlope');}
 return{filled,surface,parent,microSlope,raised:cells.filter(c=>filled[c.id]>heights[c.id]).length};
}
/** Land cells (h>0) whose every edge neighbour exists and is strictly higher. */
export function localMinima(cells,heights){
 const out=[];for(const c of cells){const h=heights[c.id];if(!(h>0))continue;let low=c.edgeNeighbors.length>0;for(const id of c.edgeNeighbors)if(id<0||!(heights[id]>h)){low=false;break;}if(low)out.push(c.id);}return out;
}
/** Share of land cells with a non-ascending path to sea/boundary (REACode drained()). */
export function drainedCells(cells,heights){
 const seen=new Uint8Array(cells.length),queue=[];let land=0;
 for(const c of cells){if(!(heights[c.id]>0))continue;land++;if(c.edgeNeighbors.some(id=>id<0||!(heights[id]>0))){seen[c.id]=1;queue.push(c.id);}}
 for(let k=0;k<queue.length;k++){const id=queue[k];for(const nb of cells[id].edgeNeighbors)if(nb>=0&&!seen[nb]&&heights[nb]>0&&heights[nb]>=heights[id]){seen[nb]=1;queue.push(nb);}}
 let ok=0;for(let id=0;id<cells.length;id++)if(heights[id]>0&&seen[id])ok++;return{ok,land,share:land?ok/land:1,seen};
}
/** Connected raised cells → lakes with spill level, depth and the outlet cell the spill leaves through. */
export function lakeClusters(cells,heights,fill){
 const{filled,parent}=fill,n=cells.length,lakeOf=new Int32Array(n).fill(-1),lakes=[];
 for(const c of cells){if(lakeOf[c.id]>=0||!(filled[c.id]>heights[c.id]))continue;const id=lakes.length,members=[c.id];lakeOf[c.id]=id;
  for(let k=0;k<members.length;k++)for(const nb of cells[members[k]].edgeNeighbors)if(nb>=0&&lakeOf[nb]<0&&filled[nb]>heights[nb]&&filled[nb]===filled[c.id]){lakeOf[nb]=id;members.push(nb);}
  let spillCell=-1;for(const m of members){const p=parent[m];if(p<0||lakeOf[p]!==id){spillCell=p;break;}}
  lakes.push({id,level:filled[c.id],cells:members,area:members.length,depth:Math.max(...members.map(m=>filled[m]-heights[m])),spillCell});}
 return{lakes,lakeOf};
}
/** r55 (REACode/depfill "Erosion valid terrain with no local minimums", 1447488323845509121):
 * integer stream-power erosion on polygon adjacency. Each pass priority-floods the current
 * heights, accumulates upstream area down the explicit outlet tree (children before parents,
 * reverse BFS of the tree), and lowers a land cell by one level where area^m · drop ≥ k — never
 * below its tree parent's spill level and never below level 1, so drainage stays monotone and
 * cliffs retreat headward instead of digging pits. Optional talus pass (thermal) lowers cells
 * that stand ≥ talus levels above their lowest neighbour. A final fill is returned, so the
 * eroded heights plus `fill` describe terrain whose only remaining minima are reported lakes.
 */
export function erodeHeights(cells,heights,{passes=3,m=.5,k=3,talus=Infinity,keep=null}={}){
 validate(cells,heights);if(!(Number.isInteger(passes)&&passes>=0))throw new RangeError('passes must be a non-negative integer');
 if(!(k>0)||!(m>=0))throw new RangeError('erosion k must be >0 and m ≥0');
 const n=cells.length,h=Float64Array.from(heights);let lowered=0,volume=0,thermal=0;const log=[];
 for(let pass=0;pass<passes;pass++){
  const f=depressionFill(cells,h),kids=Array.from({length:n},()=>[]),order=[];
  for(let id=0;id<n;id++){const p=f.parent[id];if(p>=0)kids[p].push(id);else order.push(id);}
  for(let i=0;i<order.length;i++)for(const c of kids[order[i]])order.push(c);
  const acc=new Float64Array(n).fill(1);for(let i=order.length-1;i>=0;i--){const id=order[i],p=f.parent[id];if(p>=0)acc[p]+=acc[id];}
  let cut=0;const next=Float64Array.from(h);
  for(const id of order){const p=f.parent[id];if(p<0||!(h[id]>1)||keep?.[id])continue;if(f.filled[id]>h[id])continue;// lake beds do not erode
   const drop=f.filled[id]-f.filled[p];if(drop<1)continue;if(Math.pow(acc[id],m)*drop<k)continue;
   const to=Math.max(1,f.filled[p],h[id]-1);if(to<h[id]){volume+=h[id]-to;next[id]=to;cut++;}}
  let slid=0;if(Number.isFinite(talus))for(const c of cells){const id=c.id;if(!(next[id]>1)||keep?.[id])continue;let lo=Infinity;for(const nb of c.edgeNeighbors)if(nb>=0)lo=Math.min(lo,next[nb]);if(lo<Infinity&&next[id]-lo>=talus){next[id]-=1;volume++;slid++;}}
  h.set(next);lowered+=cut;thermal+=slid;log.push({pass,cut,slid,maxAcc:Math.max(...acc)});if(!cut&&!slid)break;
 }
 const fill=depressionFill(cells,h);
 return{heights:h,fill,lowered,thermal,volume,log,minimaAfterFill:localMinima(cells,fill.filled).length};
}
