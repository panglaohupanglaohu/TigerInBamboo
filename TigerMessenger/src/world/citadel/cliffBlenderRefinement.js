import data from '../../../assets/models/optimized/citadel-cliff/citadelCliffData.js';
const key=(x,y,z)=>[x,y,z].map(v=>Math.round(v*10000)).join(',');
const deltas=new Map(data.changes.map(r=>[key(...r.slice(0,3)),r.slice(3)]));
export function applyCliffBlenderRefinement(castle){
 const terrain=castle.getObjectByName('citadel-oskar-grid-mountain-surface');
 if(!terrain||terrain.userData.cliffBlenderSource===data.source)return;
 const apply=mesh=>{
  const g=mesh.geometry,p=g.getAttribute('position');let changed=0;
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),d=deltas.get(key(x,y,z));if(!d)continue;
   p.setXYZ(i,x+d[0],y+d[1],z+d[2]);changed++;
  }
  if(changed){p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();}
  return changed;
 };
 const count=apply(terrain);
 const backlit=castle.getObjectByName('backlit-highlight-citadel-oskar-grid-mountain-surface');
 if(backlit&&backlit.geometry!==terrain.geometry)apply(backlit);
 terrain.userData.cliffBlenderSource=data.source;
 terrain.userData.cliffBlenderChangedVertices=count;
}
