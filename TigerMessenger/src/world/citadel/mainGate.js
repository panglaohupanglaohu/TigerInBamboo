import * as THREE from 'three';
import portalBlenderData from '../../assets/citadelPortalBlenderData.js';
import {nightWeightAt} from '../../render/lighting/highlandLightVolumes.js';

// Main portal joins the WFC shoulder/wings; the opening is real geometry,
// with a 7.2-wide passage at ground level, not a door painted on a box.
export function buildCitadelMainGate(){
 const root=new THREE.Group();root.name='citadel-new-main-gate';
 const stone=new THREE.MeshStandardMaterial({color:0xe6dfcc,roughness:.9});
 const trim=new THREE.MeshStandardMaterial({color:0xd0b890,roughness:.86});
 const blue=new THREE.MeshStandardMaterial({color:0x2059a6,roughness:.85});
 function portal(name,half,top,inner,spring,apex,depth,mat){
  const shape=new THREE.Shape();
  shape.moveTo(-half,0);shape.lineTo(-inner,0);shape.lineTo(-inner,spring);
  shape.quadraticCurveTo(-inner,spring+1.6,0,apex);
  shape.quadraticCurveTo(inner,spring+1.6,inner,spring);
  shape.lineTo(inner,0);shape.lineTo(half,0);shape.lineTo(half,top);shape.lineTo(-half,top);shape.closePath();
  const source=portalBlenderData[name];
  const g=source?new THREE.BufferGeometry():new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:12});
  if(source){g.setAttribute('position',new THREE.Float32BufferAttribute(source.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(source.normals,3));g.computeBoundingSphere();}
  else g.translate(0,0,-depth/2);
  const mesh=new THREE.Mesh(g,mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
 }
 portal('main-gate-wall',5.3,13,3.9,5.8,9.1,2.4,stone);
 // A slightly smaller inner opening defines the carved arch surround.
 const frame=portal('main-gate-carved-surround',4.15,9.65,3.6,5.7,8.8,.20,trim);frame.position.z=1.3;
 const glowMaterials=[];
 for(let i=0;i<3;i++){
  const m=new THREE.MeshStandardMaterial({color:[0xe0bd87,0xcda064,0xb67a48][i],roughness:.88,emissive:[0xffa13c,0xff7c26,0xff591c][i],emissiveIntensity:0});
  const reveal=new THREE.Mesh(frame.geometry,m);reveal.name='portal-warm-reveal-'+i;
  reveal.position.z=.82-i*.53;reveal.castShadow=false;reveal.receiveShadow=true;root.add(reveal);glowMaterials.push(m);
 }
 // Target reference: suspended blue pennants flank the open pointed arch.
 const gold=new THREE.MeshStandardMaterial({color:0xe6cf96,roughness:.8});
 blue.side=THREE.DoubleSide;
 function box(name,w,h,d,x,y,z,mat){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
  mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;root.add(mesh);return mesh;
 }
 box('portal-cornice',10.9,.32,2.7,0,12.85,0,trim);
 box('portal-coping',11.1,.16,2.85,0,13.08,0,stone);
 for(const side of [-1,1]){
  const x=side*4.55;
  const shape=new THREE.Shape();
  shape.moveTo(-.64,0);shape.lineTo(.64,0);shape.lineTo(.64,-4.65);
  shape.lineTo(0,-5.65);shape.lineTo(-.64,-4.65);shape.closePath();
  const banner=new THREE.Mesh(new THREE.ShapeGeometry(shape),blue);banner.name='main-gate-blue-banner-'+side;
  banner.position.set(x,12.3,1.35);root.add(banner);
  box('portal-banner-hanger-'+side,1.65,.09,.12,x,12.34,1.39,gold);
  // Three upward prongs reproduce the target's light heraldic silhouette.
  box('portal-banner-emblem-stem-'+side,.075,1.05,.025,x,10.18,1.38,gold);
  for(const arm of [-1,1]){
   const tine=box('portal-banner-emblem-tine-'+side+'-'+arm,.07,.58,.025,x+arm*.23,10.45,1.38,gold);
   const join=box('portal-banner-emblem-join-'+side+'-'+arm,.07,.34,.025,x+arm*.115,10.08,1.38,gold);
   join.rotation.z=-arm*.76;
  }
 }
 root.userData.sourceId='citadel-main-portal-v3-blender-beveled';
 root.userData.blenderSource='artifacts/citadel-reference-pass/citadel-portal-refined.blend';
 root.userData.update=phase=>{const w=nightWeightAt(phase);glowMaterials.forEach((m,i)=>m.emissiveIntensity=w*(.22+i*.12));};
 root.userData.opening={width:7.2,springHeight:5.7,apexHeight:8.8};
 return root;
}
