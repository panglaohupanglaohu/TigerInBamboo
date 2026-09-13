import data from '../../../assets/models/optimized/citadel-front-strata/frontStrataData.js';
/** Sparse, indexed Blender edit against the final spherical coastline baseline.
 * Validate a complete mesh before mutation; never partially apply a stale asset.
 */
export function applyFrontStrataBlender(castle){
 const report={source:data.source,meshes:[]};
 for(const item of data.meshes){
  const mesh=castle.getObjectByName(item.name);if(!mesh)continue;
  if(mesh.userData.frontStrataSource===data.source)continue;
  const g=mesh.geometry,a=g.attributes.position;
  const stale=item.changes.filter(([i,x,y,z])=>i>=a.count||Math.hypot(a.getX(i)-x,a.getY(i)-y,a.getZ(i)-z)>.0001);
  if(stale.length){report.meshes.push({name:item.name,applied:0,stale:stale.length});console.warn('Front strata baseline changed',item.name,stale.length);continue;}
  for(const [i,x,y,z,dx,dy,dz] of item.changes)a.setXYZ(i,x+dx,y+dy,z+dz);
  a.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();
  mesh.userData.frontStrataSource=data.source;
  report.meshes.push({name:item.name,applied:item.changes.length,stale:0});
 }
 castle.userData.frontStrataBlender=report;return report;
}
