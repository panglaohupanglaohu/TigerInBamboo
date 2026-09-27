import {buildBookshopFactoryBase} from './bookshopFactoryBase.js';
import {buildBookshopTownGround,townSurfacePoint,townSurfaceMesh,seatTownObject} from './bookshopTownSite.js';
import * as THREE from 'three';
import {BOOKSHOP_ROBOT_FACTORIES} from '../assets/bookshopRobots.js';
import {createRobotBookshop} from '../assets/robotBookshops.js';

// Three shops face a shared open plaza. Existing bookstore remains in place.
export function installBookshopRobots({scene,bookshop,colliders,platforms,R=160}) {
 if(bookshop.userData.steampunkRobots)return bookshop.userData.steampunkRobots;
 const root=new THREE.Group();root.name='bookshop-steampunk-robots';
 bookshop.updateWorldMatrix(true,true);root.position.copy(bookshop.position);root.quaternion.copy(bookshop.quaternion);scene.add(root);
 buildBookshopTownGround({root,R,platforms});
 const stone=new THREE.MeshStandardMaterial({color:0xc6bba0,roughness:.94}),brass=new THREE.MeshStandardMaterial({color:0xbc995b,roughness:.65,metalness:.25});
 function floor(parent,w,d,x,z,name){const m=townSurfaceMesh(parent,x-w/2,x+w/2,z-d/2,z+d/2,stone,R,.915,12);m.name=name;return m;}
 // The central compass disk is kept clear of robots and bookshelves.

 const verts=[],indices=[],segments=96;
 verts.push(...townSurfacePoint(root,0,18,R,.925).toArray());
 for(let i=0;i<=segments;i++){const a=i*Math.PI*2/segments;verts.push(...townSurfacePoint(root,Math.sin(a)*9.4,18+Math.cos(a)*9.4,R,.925).toArray());if(i)indices.push(0,i,i+1);}
 const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));dg.setIndex(indices);dg.computeVertexNormals();const disk=new THREE.Mesh(dg,stone);disk.name='bookshop-spherical-compass-plaza';root.add(disk);
 for(const radius of [3.2,6.4,8.3,9.2]){const pts=[];for(let i=0;i<=128;i++){const a=i*Math.PI*2/128;pts.push(townSurfacePoint(root,Math.sin(a)*radius,18+Math.cos(a)*radius,R,.94));}root.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),128,.025,4,false),brass));}
 for(let i=0;i<8;i++){const a=i*Math.PI/4,g=new THREE.BufferGeometry();const points=[[0,18],[Math.sin(a)*4.8,18+Math.cos(a)*4.8],[Math.sin(a+Math.PI/2)*.45,18+Math.cos(a+Math.PI/2)*.45]];g.setAttribute('position',new THREE.Float32BufferAttribute(points.flatMap(([x,z])=>townSurfacePoint(root,x,z,R,.946).toArray()),3));g.computeVertexNormals();root.add(new THREE.Mesh(g,new THREE.MeshBasicMaterial({color:i%2?0xa38c65:0x67766a,side:THREE.DoubleSide})));}
 floor(root,3,5,0,3,'original-bookshop-plaza-path');
 const specs=[Math.PI,-1.85,1.85].map((a,i)=>{
  const x=Math.sin(a)*18,z=18+Math.cos(a)*18;
  return {x,z,yaw:Math.atan2(-x,18-z),robotX:i===2?5.5:-5.5,robotZ:1};
 });
 const rimPos=[],rimIds=[],segs=144;
 for(let i=0;i<=segs;i++){const a=i*Math.PI*2/segs;for(const rr of[8.7,11.2])rimPos.push(...townSurfacePoint(root,Math.sin(a)*rr,18+Math.cos(a)*rr,R,.93).toArray());if(i){const n=i*2;rimIds.push(n-2,n-1,n,n-1,n+1,n);}}
 const rg=new THREE.BufferGeometry();rg.setAttribute('position',new THREE.Float32BufferAttribute(rimPos,3));rg.setIndex(rimIds);rg.computeVertexNormals();const ringPaving=new THREE.Mesh(rg,stone);ringPaving.name='bookshop-continuous-ring-walk';root.add(ringPaving);
 // Radial joints make the circular organization legible from the tram and overhead.
 const seamMat=new THREE.LineBasicMaterial({color:0x8a8d7c,transparent:true,opacity:.7}),seamPoints=[];
 for(let i=0;i<96;i++){const a=i*Math.PI*2/96;for(const rr of[9.5,11.2])seamPoints.push(townSurfacePoint(root,Math.sin(a)*rr,18+Math.cos(a)*rr,R,.939));}
 root.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(seamPoints),seamMat));
 const models=[],audit=[],districts=[];
 for(const [i,make]of BOOKSHOP_ROBOT_FACTORIES.entries()){
  const s=specs[i],district=new THREE.Group();district.name=['locust','ant','beetle'][i]+'-bookshop-court';root.add(district);districts.push(district);seatTownObject(root,district,s.x,s.z,s.yaw,R);
  if(i){const shop=createRobotBookshop(i===1?'蚂蚁':'甲壳虫',i===1?'ant':'beetle');district.add(shop);floor(district,7.2,6.7,0,.3,'shop-foundation');floor(district,3,3,0,4.8,'shop-plaza-path');district.updateWorldMatrix(true,true);colliders.push({position:district.getWorldPosition(new THREE.Vector3()),radius:3.05});}
  floor(district,4.3,4.2,s.robotX,s.robotZ,'robot-service-pad');
  const robot=make();district.add(robot);seatTownObject(district,robot,s.robotX,s.robotZ,i===0?.15:0,R);models.push(robot);robot.updateWorldMatrix(true,true);
  const world=robot.getWorldPosition(new THREE.Vector3());colliders.push({position:world.clone(),radius:i===0?1.45:1.3});audit.push({name:robot.userData.robotName,pairedShop:i===0?'原书店／蝗虫书店':i===1?'蚂蚁书店':'甲壳虫书店',world:world.toArray(),stats:robot.userData.stats});
 }
 buildBookshopFactoryBase({root,districts,R,colliders});
 root.userData.audit=audit;root.userData.models=models;root.userData.layout='Three shops at 120-degree intervals around one circular plaza; all doors face its center';root.userData.ringLayout={center:[0,18],radius:18,angles:[180,-106,106],shops:specs};bookshop.userData.steampunkRobots=root;return root;
}
