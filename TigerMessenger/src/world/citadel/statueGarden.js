import * as THREE from 'three';
import {buildSlopeShrub} from '../highlandCitadelDesign.js';
// Low annular planting around the reviewed 1.596m statue foot. It does not
// move the original statue or occupy the outer processional paving.
export function buildStatueGarden(x,z,materials){
 const root=new THREE.Group();root.name='citadel-statue-low-garden';root.position.set(x,4,z);
 const stone=new THREE.MeshStandardMaterial({color:0xd8cfba,roughness:.97});
 const soil=new THREE.MeshStandardMaterial({color:0x444432,roughness:1});
 const shape=new THREE.Shape();shape.absarc(0,0,2.78,0,Math.PI*2,false);const hole=new THREE.Path();hole.absarc(0,0,2.60,0,Math.PI*2,true);shape.holes.push(hole);
 const rim=new THREE.Mesh(new THREE.ExtrudeGeometry(shape,{depth:.20,bevelEnabled:false,curveSegments:32}),stone);rim.rotation.x=-Math.PI/2;rim.position.y=.015;root.add(rim);
 const bed=new THREE.Mesh(new THREE.RingGeometry(1.62,2.61,64),soil);bed.rotation.x=-Math.PI/2;bed.position.y=.12;root.add(bed);
 const shrubs=[];
 for(let i=0;i<22;i++){
  const a=i*Math.PI*2/22,r=2.13+.045*Math.sin(i*2.1);
  const shrub=buildSlopeShrub(materials,3100+i,Math.cos(a)*r,Math.sin(a)*r,.1,{surfaceY:.13});
  shrub.scale.multiplyScalar(.55+(i%3)*.03);root.add(shrub);shrubs.push(shrub);
 }
 root.updateMatrixWorld(true);
 const b=new THREE.Box3();for(const shrub of shrubs)b.union(new THREE.Box3().setFromObject(shrub));
 root.userData.layout={center:[x,4,z],innerRadius:1.62,outerRadius:2.78,statueFootRadius:1.596,shrubs:22,foliageHeight:b.max.y-4,source:'existing highland shrub family; approved concentric statue garden'};
 return root;
}
