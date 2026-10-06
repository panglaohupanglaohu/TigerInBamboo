import * as T from 'three';
const active=new WeakMap();
const signature=m=>m.elements.map(v=>v.toFixed(6)).join(',');
function visible(o){for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;}
/** Candidate forest only. Exact building triangles versus oriented tree geometry
 * boxes after broad phase; conservative at the crown's small concave notches.
 * Crown/trunk are coupled by their existing instance matrix, never by index. */
export function applyTargetCityForestClearance({castle,candidateRoot,walkableFootprints=[]}={}){
 if(!castle?.isObject3D||!candidateRoot?.isObject3D)throw new TypeError('castle and candidateRoot required');
 if(active.has(castle))return active.get(castle);
 castle.updateWorldMatrix(true,true);candidateRoot.updateWorldMatrix(true,true);
 const forest=castle.getObjectByName('citadel-mountain-canopy-candidate'),meshes=[];forest?.traverse(o=>{if(o.isInstancedMesh)meshes.push(o);});
 const report={version:'target-city-forest-clearance-1',method:'building triangle against oriented tree bounds; paired existing instance signatures',hidden:[],collisions:[],instancesExamined:0,triangleTests:0,terrainChanged:false,limitations:['Tree oriented bounding boxes conservatively approximate crown concavities.','Only candidateRoot visible geometry and explicit castle-chart walkable prisms are checked.','Hidden instances are not relocated.']};
 // Build triangle soups once in castle coordinates; preserve nested/instance transforms.
 const invCastle=castle.matrixWorld.clone().invert(),structures=[];
 candidateRoot.traverse(m=>{if(!m.isMesh||!visible(m)||m.userData.skipColliders||/outline|waterfall|water-supply|water-sheet|foam/i.test(m.name))return;const p=m.geometry?.attributes.position;if(!p)return;const idx=m.geometry.index;m.geometry.computeBoundingBox();
  for(let instance=0;instance<(m.isInstancedMesh?m.count:1);instance++){
   const matrix=invCastle.clone().multiply(m.matrixWorld);if(m.isInstancedMesh){const im=new T.Matrix4();m.getMatrixAt(instance,im);matrix.multiply(im);}if(Math.abs(matrix.determinant())<1e-12)continue;
   const triangles=[];for(let k=0,n=idx?idx.count:p.count;k<n;k+=3)triangles.push(new T.Triangle(...[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(k+j):k+j).applyMatrix4(matrix))));
   structures.push({uuid:m.uuid,name:m.name,instance:m.isInstancedMesh?instance:null,box:m.geometry.boundingBox.clone().applyMatrix4(matrix),triangles});
  }
 });
 // Optional explicit walkable polygon prisms, in final castle XZ and Y.
 for(const [i,f] of walkableFootprints.entries()){
  if(!Array.isArray(f.polygon)||f.polygon.length<3||!f.polygon.every(p=>p.length===2&&p.every(Number.isFinite))||![f.bottom,f.top].every(Number.isFinite)||f.top<=f.bottom)throw new TypeError('walkableFootprints require finite polygon and bottom/top');
  const lo=f.polygon.map(p=>new T.Vector3(p[0],f.bottom,p[1])),hi=f.polygon.map(p=>new T.Vector3(p[0],f.top,p[1])),triangles=[];
  for(let k=1;k<lo.length-1;k++){triangles.push(new T.Triangle(lo[0],lo[k],lo[k+1]),new T.Triangle(hi[0],hi[k+1],hi[k]));}for(let k=0;k<lo.length;k++){const j=(k+1)%lo.length;triangles.push(new T.Triangle(lo[k],lo[j],hi[j]),new T.Triangle(lo[k],hi[j],hi[k]));}
  structures.push({uuid:'walkable-'+i,name:f.name||'walkable-prism',box:new T.Box3().setFromPoints([...lo,...hi]),triangles});
 }
 const keys=new Set(),records=[];
 for(const mesh of meshes){mesh.geometry.computeBoundingBox();for(let i=0;i<mesh.count;i++){
  const im=new T.Matrix4();mesh.getMatrixAt(i,im);if(Math.abs(im.determinant())<1e-12)continue;report.instancesExamined++;
  const transform=invCastle.clone().multiply(mesh.matrixWorld).multiply(im),inverse=transform.clone().invert(),localBox=mesh.geometry.boundingBox,box=localBox.clone().applyMatrix4(transform);
  let collision=null;for(const structure of structures){if(!box.intersectsBox(structure.box))continue;for(const t of structure.triangles){report.triangleTests++;const tri=new T.Triangle(t.a.clone().applyMatrix4(inverse),t.b.clone().applyMatrix4(inverse),t.c.clone().applyMatrix4(inverse));if(localBox.intersectsTriangle(tri)){collision=structure;break;}}if(!collision&&structure.box.containsPoint(box.getCenter(new T.Vector3()))){
    // A tree can be fully inside a closed room-sized solid without touching a
    // boundary triangle. Odd parity is used only for that containment case.
    const origin=box.getCenter(new T.Vector3()),ray=new T.Ray(origin,new T.Vector3(1,.371,.193).normalize()),hits=[];
    for(const t of structure.triangles){const hit=ray.intersectTriangle(t.a,t.b,t.c,false,new T.Vector3());if(hit){const d=hit.distanceTo(origin);if(d>1e-6&&!hits.some(x=>Math.abs(x-d)<1e-5))hits.push(d);}}
    if(hits.length%2===1)collision=structure;
   }if(collision)break;}
  if(collision){keys.add(signature(im));report.collisions.push({treeMesh:mesh.name,index:i,structure:collision.name,structureUUID:collision.uuid,structureInstance:collision.instance});}
 }}
 for(const mesh of meshes)for(let i=0;i<mesh.count;i++){const matrix=new T.Matrix4();mesh.getMatrixAt(i,matrix);if(keys.has(signature(matrix))){records.push({mesh,index:i,matrix});mesh.setMatrixAt(i,new T.Matrix4().makeScale(0,0,0));report.hidden.push({uuid:mesh.uuid,name:mesh.name,index:i});}}
 const refresh=()=>{for(const mesh of new Set(records.map(r=>r.mesh))){mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingBox();mesh.computeBoundingSphere();}};refresh();report.hiddenTrees=keys.size;report.hiddenInstances=records.length;report.structureParts=structures.length;
 let disposed=false;const handle={report,dispose(){if(disposed)return;disposed=true;for(const r of records)r.mesh.setMatrixAt(r.index,r.matrix);refresh();active.delete(castle);report.restored=true;}};active.set(castle,handle);return handle;
}
