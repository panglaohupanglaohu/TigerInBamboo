import * as THREE from 'three';

/** Conservative finite vehicle boxes, on the actual red/blue rail curves. */
export function buildHarborRailEnvelopes(curves,{sampleStep=.6,halfWidth=2.32,halfLength=3.49,bottom=-.6,top=5.71,margin=.25}={}){
  const boxes=[];
  for(const curve of [...new Set(Object.values(curves||{}))]){
    if(!curve?.getPointAt||!curve?.getTangentAt||!curve?.getLength)continue;
    const count=Math.max(1,Math.ceil(curve.getLength()/sampleStep));
    for(let i=0;i<=count;i++){
      const p=curve.getPointAt(i/count),forward=curve.getTangentAt(i/count).normalize(),radial=p.clone().normalize();
      if(radial.lengthSq()<.5)radial.set(0,1,0);
      let side=new THREE.Vector3().crossVectors(radial,forward).normalize();
      if(side.lengthSq()<.5)side.set(1,0,0);
      const up=new THREE.Vector3().crossVectors(forward,side).normalize();
      const box=new THREE.Box3();
      for(const x of [-halfWidth-margin,halfWidth+margin])for(const y of [bottom-margin,top+margin])for(const z of [-halfLength-margin-sampleStep,halfLength+margin+sampleStep])box.expandByPoint(p.clone().addScaledVector(side,x).addScaledVector(up,y).addScaledVector(forward,z));
      const pose=new THREE.Matrix4().makeBasis(side,up,forward).setPosition(p);
      boxes.push({bounds:box,worldToVehicle:pose.invert(),localBounds:new THREE.Box3(new THREE.Vector3(-halfWidth-margin,bottom-margin,-halfLength-margin-sampleStep),new THREE.Vector3(halfWidth+margin,top+margin,halfLength+margin+sampleStep))});
    }
  }
  return boxes;
}

function treeLocalBounds(tree){
  const bounds=new THREE.Box3(),inverse=tree.matrixWorld.clone().invert();
  tree.traverse(o=>{if(!o.isMesh)return;o.geometry.computeBoundingBox();bounds.union(o.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld)));});
  return bounds;
}
export function harborTreeIntersectsRail(tree,envelope,localBounds=treeLocalBounds(tree)){
  const worldBounds=localBounds.clone().applyMatrix4(tree.matrixWorld);
  if(!envelope.bounds.intersectsBox(worldBounds))return false;
  const inVehicle=localBounds.clone().applyMatrix4(envelope.worldToVehicle.clone().multiply(tree.matrixWorld));
  return envelope.localBounds.intersectsBox(inVehicle);
}

/** Preserve rooted harbor placement; constrain entire tree volume, never only its trunk point. */
export function fitHarborTreesOutsideRail(trees,curves){
  const boxes=buildHarborRailEnvelopes(curves),report={version:'harbor-tree-rail-clearance-1',envelopes:boxes.length,trees:[],verified:boxes.length>0};
  for(const tree of trees||[]){
    tree.updateWorldMatrix(true,true);
    const localBounds=treeLocalBounds(tree),original=tree.scale.clone(),rootBefore=tree.getWorldPosition(new THREE.Vector3());let hits=[],scale=1;
    for(let i=0;i<=14;i++){
      scale=1-i*.05;tree.scale.copy(original).multiplyScalar(scale);tree.updateWorldMatrix(true,true);
      hits=boxes.filter(b=>harborTreeIntersectsRail(tree,b,localBounds));
      if(!hits.length)break;
    }
    const bounds=new THREE.Box3().setFromObject(tree,true),entry={name:tree.name,scale,intersections:hits.length,rootUnmoved:rootBefore.distanceTo(tree.getWorldPosition(new THREE.Vector3()))<1e-8,bounds:{min:bounds.min.toArray(),max:bounds.max.toArray()}};
    tree.userData.railClearance=entry;report.trees.push(entry);if(hits.length)report.verified=false;
  }
  return report;
}
