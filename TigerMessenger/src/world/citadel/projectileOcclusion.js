// Actual opaque citadel meshes, including independent lighting layers.
// Ignore only region visibility; honour every retired/hidden descendant.
export function createCitadelProjectileOcclusion(THREE, scene) {
  const ray=new THREE.Raycaster();ray.layers.enableAll();
  const delta=new THREE.Vector3(),start=new THREE.Vector3(),end=new THREE.Vector3();
  let meshes=[],last=-Infinity;
  const trees=new WeakMap(),localRay=new THREE.Ray(),inverse=new THREE.Matrix4();
  const va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3(),intersection=new THREE.Vector3();
  function treeFor(geometry) {
    if(trees.has(geometry))return trees.get(geometry);
    const positions=geometry.attributes.position,indices=geometry.index;
    const count=Math.floor((indices?.count??positions.count)/3);
    const vertex=(triangle,corner,out)=>out.fromBufferAttribute(positions,indices?indices.getX(triangle*3+corner):triangle*3+corner);
    const centers=new Float32Array(count*3);
    for(let i=0;i<count;i++){vertex(i,0,va);vertex(i,1,vb);vertex(i,2,vc);for(let axis=0;axis<3;axis++)centers[i*3+axis]=(va.getComponent(axis)+vb.getComponent(axis)+vc.getComponent(axis))/3;}
    function build(ids) {
      const box=new THREE.Box3();
      for(const id of ids)for(let corner=0;corner<3;corner++)box.expandByPoint(vertex(id,corner,va));
      if(ids.length<=24)return {box,ids};
      const size=box.getSize(new THREE.Vector3()),axis=size.x>=size.y&&size.x>=size.z?0:(size.y>=size.z?1:2);
      ids.sort((a,b)=>centers[a*3+axis]-centers[b*3+axis]);const mid=ids.length>>1;
      return {box,left:build(ids.slice(0,mid)),right:build(ids.slice(mid))};
    }
    const tree={root:build(Array.from({length:count},(_,i)=>i)),vertex};trees.set(geometry,tree);return tree;
  }
  function meshHit(mesh,from,to) {
    const geometry=mesh.geometry;if(!geometry.attributes.position)return null;
    const tree=treeFor(geometry);inverse.copy(mesh.matrixWorld).invert();
    localRay.copy(ray.ray).applyMatrix4(inverse);
    let nearest=null,best=from.distanceTo(to);
    function visit(node) {
      if(!localRay.intersectsBox(node.box))return;
      if(node.ids){
        for(const id of node.ids){
          tree.vertex(id,0,va);tree.vertex(id,1,vb);tree.vertex(id,2,vc);
          if(!localRay.intersectTriangle(va,vb,vc,false,intersection))continue;
          const point=intersection.clone().applyMatrix4(mesh.matrixWorld),distance=point.distanceTo(from);
          if(distance>.001&&distance<=best){best=distance;nearest={object:mesh,point,distance};}
        }
      }else{visit(node.left);visit(node.right);}
    }
    visit(tree.root);return nearest;
  }
  function refresh(time) {
    if(time>=last&&time-last<2)return;
    last=time;meshes=[];
    const castle=scene.getObjectByName?.('castleContainer');
    if(!castle)return;
    castle.updateWorldMatrix(true,true);
    castle.traverse(o=>{
      if(!o.isMesh||!o.geometry||o.userData.skipColliders||o.userData.isWater||/backlit-highlight|water-surface/.test(o.name))return;
      for(let p=o;p&&p!==castle;p=p.parent)if(!p.visible)return;
      const materials=Array.isArray(o.material)?o.material:[o.material];
      if(!materials.some(m=>m&&(!m.transparent||m.opacity>=.95)))return;
      if(!o.geometry.boundingBox)o.geometry.computeBoundingBox();
      meshes.push({object:o,box:o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld)});
    });
  }
  function segment(from,to,time,candidates=null) {
    refresh(time);
    delta.subVectors(to,from);const length=delta.length();
    if(length<.001)return null;
    delta.divideScalar(length);ray.near=.001;ray.far=length;ray.set(from,delta);
    let nearest=null;
    for(const row of candidates||meshes){
      if(!ray.ray.intersectsBox(row.box))continue;
      const hit=meshHit(row.object,from,to);
      if(hit&&(!nearest||hit.distance<nearest.distance))nearest=hit;
    }
    return nearest;
  }
  function arc(from,to,up,time,height=3.2) {
    // Same nominal arc as the projectile; <= 0.5 m chords at launch.
    refresh(time);
    const bounds=new THREE.Box3().setFromPoints([from,to]);
    const excursion=up.clone().multiplyScalar(height);
    bounds.expandByPoint(from.clone().add(excursion));bounds.expandByPoint(to.clone().add(excursion));
    const candidates=meshes.filter(row=>row.box.intersectsBox(bounds));
    const count=Math.max(8,Math.ceil(from.distanceTo(to)/.5));start.copy(from);
    for(let i=1;i<=count;i++){
      const t=i/count;end.lerpVectors(from,to,t).addScaledVector(up,Math.sin(t*Math.PI)*height);
      const hit=segment(start,end,time,candidates);if(hit)return hit;start.copy(end);
    }
    return null;
  }
  return {segment,arc,invalidate(){last=-Infinity;},get meshCount(){return meshes.length;}};
}
