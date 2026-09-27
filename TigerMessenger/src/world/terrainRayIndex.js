import * as THREE from 'three';

// Exact triangle queries for rigid terrain. Index geometry in local coordinates;
// a translating/rolling island only changes the ray transform, not the index.
const indices = new WeakMap();
const inverse = new THREE.Matrix4(), ray = new THREE.Ray();
const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
const hit = new THREE.Vector3(), worldHit = new THREE.Vector3();

function indexFor(geometry) {
  const position=geometry.attributes.position, index=geometry.index;
  const previous=indices.get(geometry);
  const pv=position.isInterleavedBufferAttribute?position.data.version:position.version;
  if(previous && previous.position===position && previous.index===index && previous.pv===pv && previous.iv===(index?.version??0))return previous;
  const triangles=[];
  const count=index?.count??position.count;
  for(let i=0;i+2<count;i+=3){
    const ia=index?index.getX(i):i,ib=index?index.getX(i+1):i+1,ic=index?index.getX(i+2):i+2;
    a.fromBufferAttribute(position,ia);b.fromBufferAttribute(position,ib);c.fromBufferAttribute(position,ic);
    const box=new THREE.Box3().setFromPoints([a,b,c]);
    triangles.push({offset:i,ia,ib,ic,box,center:box.getCenter(new THREE.Vector3())});
  }
  const build=items=>{
    const box=new THREE.Box3();for(const t of items)box.union(t.box);
    if(items.length<=24)return {box,items};
    const size=box.getSize(new THREE.Vector3()),axis=size.x>=size.y&&size.x>=size.z?'x':size.y>=size.z?'y':'z';
    items.sort((a,b)=>a.center[axis]-b.center[axis]);const mid=items.length>>1;
    return {box,left:build(items.slice(0,mid)),right:build(items.slice(mid))};
  };
  const result={position,index,pv,iv:index?.version??0,root:build(triangles)};
  indices.set(geometry,result);return result;
}

export function intersectRigidTerrain(mesh,raycaster,hits) {
  if(!mesh.layers.test(raycaster.layers))return;
  const range=mesh.geometry?.drawRange;
  // Preserve Three's exact group/drawRange semantics for unusual geometry.
  if(mesh.raycast!==THREE.Mesh.prototype.raycast||!mesh.geometry?.attributes.position||mesh.isSkinnedMesh||mesh.isInstancedMesh||mesh.morphTargetInfluences?.length||Array.isArray(mesh.material)||range?.start%3||Number.isFinite(range?.count)&&range.count%3){mesh.raycast(raycaster,hits);return;}
  const geometry=mesh.geometry,data=indexFor(geometry);
  inverse.copy(mesh.matrixWorld).invert();ray.copy(raycaster.ray).applyMatrix4(inverse);
  const start=geometry.drawRange.start,end=start+geometry.drawRange.count;
  const materialAt=offset=>Array.isArray(mesh.material)?mesh.material[geometry.groups.find(g=>offset>=g.start&&offset<g.start+g.count)?.materialIndex]:mesh.material;
  let nearest=Infinity,nearestPoint=null;
  function visit(node){
    if(!ray.intersectsBox(node.box))return;
    if(!node.items){visit(node.left);visit(node.right);return;}
    for(const tri of node.items){
      if(tri.offset<start||tri.offset>=end)continue;
      const material=materialAt(tri.offset);if(!material)continue;
      a.fromBufferAttribute(data.position,tri.ia);b.fromBufferAttribute(data.position,tri.ib);c.fromBufferAttribute(data.position,tri.ic);
      const point=material.side===THREE.BackSide?ray.intersectTriangle(c,b,a,true,hit):ray.intersectTriangle(a,b,c,material.side!==THREE.DoubleSide,hit);
      if(!point)continue;
      worldHit.copy(point).applyMatrix4(mesh.matrixWorld);const distance=raycaster.ray.origin.distanceTo(worldHit);
      if(distance<raycaster.near||distance>raycaster.far||distance>=nearest)continue;
      nearest=distance;nearestPoint=worldHit.clone();
    }
  }
  visit(data.root);
  if(nearestPoint)hits.push({distance:nearest,point:nearestPoint,object:mesh});
}

export function intersectTerrainSet(meshes,raycaster,hits) {
  for(const mesh of meshes)intersectRigidTerrain(mesh,raycaster,hits);
  hits.sort((a,b)=>a.distance-b.distance);return hits;
}
