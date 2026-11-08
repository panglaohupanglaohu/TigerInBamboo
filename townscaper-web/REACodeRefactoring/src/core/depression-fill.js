/** Priority-flood adapted from REACode/depfill to shared polygon adjacency.
 * Quantized levels use flat spill surfaces, with an explicit acyclic outlet
 * tree. This is filling, not erosion or a continuous micro-slope simulation.
 */
import{MinHeap}from'./minheap.js';
export function depressionFill(cells,heights){
 const n=cells.length;if(heights.length!==n||cells.some((c,i)=>c.id!==i)||!Array.from(heights).every(x=>Number.isFinite(x)&&x>=0))throw new RangeError('invalid height graph');
 for(const c of cells)for(const id of c.edgeNeighbors)if(!Number.isInteger(id)||id<-1||id>=n||id>=0&&!cells[id].edgeNeighbors.includes(c.id))throw new RangeError('invalid reciprocal adjacency');
 const filled=Float64Array.from(heights),parent=new Int32Array(n).fill(-2),heap=new MinHeap();
 for(const c of cells)if(heights[c.id]===0||c.edgeNeighbors.includes(-1)){parent[c.id]=-1;heap.push(filled[c.id],c.id);}
 while(heap.length){const[h,id]=heap.pop();for(const nb of cells[id].edgeNeighbors){if(nb<0||parent[nb]!==-2)continue;filled[nb]=Math.max(heights[nb],h);parent[nb]=id;heap.push(filled[nb],nb);}}
 if(parent.includes(-2))throw new RangeError('component has no water or boundary outlet');
 return{filled,parent,raised:cells.filter(c=>filled[c.id]>heights[c.id]).length};
}
