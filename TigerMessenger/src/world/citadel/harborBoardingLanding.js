import * as THREE from 'three';
export function buildHarborBoardingLanding(city,surface,dockY,toCastle){
 const old=city.getObjectByName('citadel-harbor-boarding-landing');if(old)return;
 const root=new THREE.Group();root.name='citadel-harbor-boarding-landing';city.add(root);
 const mat=new THREE.MeshStandardMaterial({color:0x897250,roughness:.95});
 const deckY=surface(35,50)+.8;
 const sx=(surface(35.1,50)-surface(34.9,50))/.2,sz=(surface(35,50.1)-surface(35,49.9))/.2;
 const topAt=(x,z)=>deckY+sx*(x-35)+sz*(z-50);
 function box(name,x,y,z,w,h,d,walk=false){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.name=name;m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=true;if(walk){m.userData.westCityWalkable=true;m.userData.isCitadelTerrain=true;}root.add(m);return m;}
 const deck=box('west-city-harbor-boarding-deck',35,deckY-.12,50,1.6,.24,3,true);
 const vertices=deck.geometry.attributes.position;for(let i=0;i<vertices.count;i++)vertices.setY(i,vertices.getY(i)+sx*vertices.getX(i)+sz*vertices.getZ(i));vertices.needsUpdate=true;deck.geometry.computeVertexNormals();
 const start=new THREE.Vector3(36.75,dockY,56.15),end=new THREE.Vector3(35,topAt(35,51.35),51.35),count=40;
 const run=Math.hypot(end.x-start.x,end.z-start.z),yaw=Math.atan2(end.x-start.x,end.z-start.z);
 const route=[toCastle(start.toArray())];
 for(let i=0;i<count;i++){
  const p=start.clone().lerp(end,(i+.5)/count),top=dockY+(end.y-dockY)*(i+1)/count;
  const step=box('west-city-harbor-boarding-step-'+i,p.x,top-.10,p.z,2,.2,run/count+.04,true);step.rotation.y=yaw;
  route.push(toCastle([p.x,top,p.z]));
 }
 for(const x of [34.4,35.6])for(const z of [48.7,51.3]){const bottom=surface(x,z)-1.8;box('west-city-harbor-boarding-pile',x,(topAt(x,z)+bottom)/2,z,.2,topAt(x,z)-bottom,.2);}
 route.push(toCastle([35,deckY,50]));
 city.userData.boardingRoute=route;city.userData.boardingAnchor=toCastle([35,deckY,50]);
 city.userData.harborStatus='low-boarding-platform-candidate; boat-and-unloading-pending';
}
