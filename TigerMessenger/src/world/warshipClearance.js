import * as THREE from 'three';
// Read the actual visible mesh, including instanced oars and crew, at its current pose.
export function createWarshipClearance(boat,obstacleGroups) {
  boat.updateMatrixWorld(true);const inverse=boat.matrixWorld.clone().invert(),triangles=[];
  function visible(o){for(let n=o;n&&n!==boat.parent;n=n.parent)if(!n.visible)return false;return true;}
  function add(geometry,matrix){const p=geometry.attributes.position,index=geometry.index;if(!p)return;for(let i=0;i<(index?index.count:p.count);i+=3){const t=new THREE.Triangle();for(const [v,j]of [[t.a,0],[t.b,1],[t.c,2]])v.fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(matrix);const box=new THREE.Box3().setFromPoints([t.a,t.b,t.c]);triangles.push({t,box,center:box.getCenter(new THREE.Vector3())});}}
  boat.traverse(o=>{if(!o.isMesh||!visible(o))return;const m=inverse.clone().multiply(o.matrixWorld);if(o.isInstancedMesh){const local=new THREE.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,local);if(Math.abs(local.determinant())>1e-12)add(o.geometry,m.clone().multiply(local));}}else add(o.geometry,m);});
  function tree(items){const box=new THREE.Box3();for(const i of items)box.union(i.box);if(items.length<=12)return{box,items};const size=box.getSize(new THREE.Vector3()),axis=size.x>size.y&&size.x>size.z?'x':size.y>size.z?'y':'z';items.sort((a,b)=>a.center[axis]-b.center[axis]);const mid=items.length>>1;return{box,left:tree(items.slice(0,mid)),right:tree(items.slice(mid))};}
  const bvh=tree(triangles),ray=new THREE.Ray(),hit=new THREE.Vector3(),edge=new THREE.Vector3();
  function crossing(a,b){for(const [x,y]of [[a,b],[b,a]]){for(const [u,v]of [[x.a,x.b],[x.b,x.c],[x.c,x.a]]){edge.copy(v).sub(u);const length=edge.length();if(length<1e-10)continue;ray.set(u,edge.multiplyScalar(1/length));const point=ray.intersectTriangle(y.a,y.b,y.c,false,hit);if(point&&point.distanceTo(u)>1e-6&&point.distanceTo(u)<length-1e-6)return true;}}return false;}
  function intersects(node,t,box){if(!node.box.intersectsBox(box))return false;if(node.items)return node.items.some(item=>item.box.intersectsBox(box)&&crossing(item.t,t));return intersects(node.left,t,box)||intersects(node.right,t,box);}
  function clear(position,quaternion,scale=boat.scale){const matrix=new THREE.Matrix4().compose(position,quaternion,scale),inv=matrix.clone().invert(),world=bvh.box.clone().applyMatrix4(matrix),tri=new THREE.Triangle();
    for(const group of obstacleGroups){if(!world.intersectsBox(group.box))continue;for(const {mesh,box}of group.meshes){if(!world.intersectsBox(box))continue;const geometry=mesh.geometry,p=geometry.attributes.position,index=geometry.index;
      const transforms=[];if(mesh.isInstancedMesh){const m=new THREE.Matrix4();for(let k=0;k<mesh.count;k++){mesh.getMatrixAt(k,m);const wm=mesh.matrixWorld.clone().multiply(m);if(geometry.boundingBox.clone().applyMatrix4(wm).intersectsBox(world))transforms.push(inv.clone().multiply(wm));}}else transforms.push(inv.clone().multiply(mesh.matrixWorld));
      for(const transform of transforms)for(let i=0;i<(index?index.count:p.count);i+=3){for(const [v,j]of [[tri.a,0],[tri.b,1],[tri.c,2]])v.fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(transform);const tb=new THREE.Box3().setFromPoints([tri.a,tri.b,tri.c]);if(intersects(bvh,tri,tb))return {clear:false,mesh:mesh.name,point:tri.a.clone().applyMatrix4(matrix).toArray()};}
    }}return {clear:true};
  }
  return {clear,triangleCount:triangles.length,bounds:bvh.box};
}
