import {depressionFill} from './depression-fill.js';
/** Flow accumulation on an acyclic priority-flood outlet tree. This ports the
 * accumulation strategy, not the original sphere's coupled WFC collapse.
 * Count contributing cells (not metric catchment area).
 */
export function planRiverNetwork(cells,heights,{threshold=8,depth=1}={}){
 if(!Number.isInteger(threshold)||threshold<1||!Number.isInteger(depth)||depth<0||depth>12)throw new RangeError('river settings');
 const drainage=depressionFill(cells,heights),{parent,filled}=drainage,n=cells.length;
 const pending=new Int32Array(n),area=new Int32Array(n).fill(1),queue=[];
 for(let id=0;id<n;id++)if(parent[id]>=0)pending[parent[id]]++;
 for(let id=0;id<n;id++)if(!pending[id])queue.push(id);
 for(let k=0;k<queue.length;k++){const id=queue[k],p=parent[id];if(p>=0){area[p]+=area[id];if(--pending[p]===0)queue.push(p);}}
 if(queue.length!==n)throw new Error('drainage cycle');
 const river=new Uint8Array(n),bed=Float64Array.from(filled),outlets=[];
 for(let id=0;id<n;id++)if(filled[id]>0&&area[id]>=threshold){river[id]=1;bed[id]=Math.max(1,filled[id]-depth);if(parent[id]<0||filled[parent[id]]===0)outlets.push(id);}
 return{...drainage,area,river,bed,outlets,riverCells:river.reduce((a,b)=>a+b,0),maxArea:area.reduce((a,b)=>Math.max(a,b),0)};
}
