import * as THREE from 'three';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';

const sources=new WeakMap();
/** Analytic terrain heights precede the triangulated/Blender surface. Attach
 * legacy canopy groves to the final mesh, after the spherical placement pass.
 * Retain authored X/Z, scale and color; omit roots now inside an open water cut.
 */
export function groundCitadelCanopies(castle,radius){
  const forest=castle?.getObjectByName('highland-canopy-groves');
  const terrain=castle?.getObjectByName('citadel-oskar-grid-mountain-surface');
  if(!forest?.isInstancedMesh||!terrain?.isMesh)return null;
  castle.updateWorldMatrix(true,true);
  if(!sources.has(forest)){
    const rows=[];
    for(let i=0;i<forest.count;i++){
      const matrix=new THREE.Matrix4(),color=new THREE.Color();
      forest.getMatrixAt(i,matrix);if(forest.instanceColor)forest.getColorAt(i,color);
      rows.push({matrix,color});
    }
    sources.set(forest,rows);
  }
  const up=new THREE.Vector3(0,1,0).transformDirection(terrain.matrixWorld);
  const ray=new THREE.Raycaster();ray.layers.enableAll();ray.far=1000;
  const inv=forest.matrixWorld.clone().invert(),report={sourceCount:sources.get(forest).length,placed:0,waterOrMissing:0,maxAdjustment:0,surface:terrain.name};
  forest.geometry.computeBoundingBox();const minY=forest.geometry.boundingBox.min.y;
  for(const {matrix,color} of sources.get(forest)){
    const pos=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();matrix.decompose(pos,q,scale);
    const root=pos.clone().add(new THREE.Vector3(0,minY*scale.y,0)).applyMatrix4(forest.matrixWorld);
    ray.set(root.clone().addScaledVector(up,500),up.clone().negate());
    const hit=ray.intersectObject(terrain,false)[0];
    if(!hit||hit.point.length()<radius+officialOceanLevelAt(hit.point)+.12){report.waterOrMissing++;continue;}
    const desired=hit.point.clone().addScaledVector(up,-.04).applyMatrix4(inv);
    const oldY=pos.y;pos.y=desired.y-minY*scale.y;
    report.maxAdjustment=Math.max(report.maxAdjustment,Math.abs(pos.y-oldY));
    forest.setMatrixAt(report.placed,new THREE.Matrix4().compose(pos,q,scale));
    if(forest.instanceColor)forest.setColorAt(report.placed,color);
    report.placed++;
  }
  forest.count=report.placed;forest.instanceMatrix.needsUpdate=true;
  if(forest.instanceColor)forest.instanceColor.needsUpdate=true;
  forest.computeBoundingBox();forest.computeBoundingSphere();
  forest.userData.groundPlacement=report;
  const grove=castle.getObjectByName('highland-mountain-slope-vegetation');
  if(grove){
    const trees=grove.children.filter(o=>o.userData.role==='mountain-slope-vegetation');
    const placement={sourceCount:trees.length,placed:0,waterOrMissing:0};
    for(const tree of trees){
      const root=tree.getWorldPosition(new THREE.Vector3());
      ray.set(root.clone().addScaledVector(up,500),up.clone().negate());
      const hit=ray.intersectObject(terrain,false)[0];
      const shadow=grove.children.find(o=>o.userData.host===tree.name);
      const valid=!!hit&&hit.point.length()>radius+officialOceanLevelAt(hit.point)+.12;
      tree.visible=valid;if(shadow)shadow.visible=valid;
      if(!valid){placement.waterOrMissing++;continue;}
      const local=grove.worldToLocal(hit.point.clone().addScaledVector(up,-.02));
      tree.position.copy(local);tree.userData.surfaceY=local.y;
      if(shadow)shadow.position.set(local.x,local.y+.035,local.z);
      placement.placed++;
    }
    grove.userData.groundPlacement=placement;
  }
  castle.updateWorldMatrix(true,true);
  return report;
}
