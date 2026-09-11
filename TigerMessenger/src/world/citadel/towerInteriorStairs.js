import {mergeStaticGroup} from '../geometryMerge.js';
import * as THREE from 'three';
// 3m rise per revolution keeps head clearance above the 1.6m messenger.
export function buildTowerInteriorStairs(){
 const root=new THREE.Group();root.name='citadel-main-tower-stairs';
 const mat=new THREE.MeshStandardMaterial({color:0xd8d5c6,roughness:.93});
 const route=[],n=99,angleStep=Math.PI*2/20,inner=.35,outer=1.74;
 for(let i=0;i<n;i++){
  const start=Math.PI/2-i*angleStep,end=start-angleStep-.012;
  const shape=new THREE.Shape();
  shape.moveTo(inner*Math.cos(start),inner*Math.sin(start));
  shape.lineTo(outer*Math.cos(start),outer*Math.sin(start));
  shape.absarc(0,0,outer,start,end,true);
  shape.lineTo(inner*Math.cos(end),inner*Math.sin(end));
  shape.absarc(0,0,inner,end,start,false);shape.closePath();
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:.12,bevelEnabled:false,curveSegments:3});
  geometry.rotateX(Math.PI/2);
  const top=22.3+i*.15,mesh=new THREE.Mesh(geometry,mat);
  mesh.name='west-city-main-tower-spiral-'+i;mesh.position.set(60,top,-4.4);
  mesh.userData.westCityWalkable=true;mesh.userData.isCitadelTerrain=true;
  mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);
  const a=(start+end)/2;
  route.push([60+1.15*Math.cos(a),top,-4.4+1.15*Math.sin(a)]);
 }
 const structure=new THREE.Group();structure.name='citadel-tower-interior-structure';root.add(structure);
 const core=new THREE.Mesh(new THREE.CylinderGeometry(.34,.34,15.7,12),mat);
 core.position.set(60,30.03,-4.4);structure.add(core);
 const railPoints=[];
 for(let i=3;i<n-4;i++){
  const a=Math.PI/2-(i+.5)*angleStep,y=22.3+i*.15;
  const x=60+1.72*Math.cos(a),z=-4.4+1.72*Math.sin(a);
  railPoints.push(new THREE.Vector3(x,y+.85,z));
  if(i%4===0||i===n-1){
   const post=new THREE.Mesh(new THREE.CylinderGeometry(.035,.035,.85,6),mat);
   post.position.set(x,y+.425,z);structure.add(post);
  }
 }
 const rail=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPoints),n*2,.045,6,false),mat);structure.add(rail);
 mergeStaticGroup(structure,{mergedTag:'tower-interior-structure'});
 structure.traverse(m=>{if(m.isMesh){m.name='tower-interior-solid';m.castShadow=true;m.receiveShadow=true;}});
 root.userData.route=route;root.userData.status='22.3-to-37; upper-balcony-entry';return root;
}
