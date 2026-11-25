/** Connected built voxels above quay level. Rock and common level-1 paving
 * must not merge separate houses; floating runs must not share sentinel -1.
 * Local decoration grouping, not the author's surface-decoration WFC.
 */
import {MAX_LEVEL}from'./world.js';
export function buildingComponents(world){
 const cells=world.cells,stride=MAX_LEVEL+1,labels=new Int32Array(cells.length*stride).fill(-1),components=[];
 const key=(c,l)=>c.id*stride+l;
 for(const c of cells)for(let level=2;level<=MAX_LEVEL;level++){
  if(!world.isBuilt(c,level)||labels[key(c,level)]!==-1)continue;
  const nodes=[[c,level]];labels[key(c,level)]=-2;
  const add=(other,l)=>{if(!other||l<2||l>MAX_LEVEL||!world.isBuilt(other,l)||labels[key(other,l)]!==-1)return;labels[key(other,l)]=-2;nodes.push([other,l]);};
  for(let i=0;i<nodes.length;i++){const[a,l]=nodes[i];add(a,l-1);add(a,l+1);for(const id of a.edgeNeighbors)if(id>=0)add(cells[id],l);}
  let baseId=Infinity,minKey=Infinity;
  for(const[a,l]of nodes){if(l===2)baseId=Math.min(baseId,a.id);minKey=Math.min(minKey,key(a,l));}
  const id=baseId<Infinity?baseId:cells.length+minKey;
  for(const[a,l]of nodes)labels[key(a,l)]=id;
  components.push({id,voxels:nodes.map(([c,level])=>({cell:c.id,level})),hasLevel2:baseId<Infinity});
 }
 return{components,at(c,level){return c&&Number.isInteger(level)&&level>=2&&level<=MAX_LEVEL?labels[key(c,level)]??-1:-1;}};
}
