import * as THREE from 'three';
export function buildHarborBoardingLanding(city,surface,dockY,toCastle){
 const old=city.getObjectByName('citadel-harbor-boarding-landing');if(old)return;
 const root=new THREE.Group();root.name='citadel-harbor-boarding-landing';city.add(root);
 const mat=new THREE.MeshStandardMaterial({color:0x897250,roughness:.95});
 const deckY=Math.max(...[33.5,36.5].flatMap(x=>[49.2,50.8].map(z=>surface(x,z))))+.7;
 function box(name,x,y,z,w,h,d,walk=false){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);m.name=name;m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=true;if(walk){m.userData.westCityWalkable=true;m.userData.isCitadelTerrain=true;}root.add(m);return m;}
 box('west-city-harbor-boarding-deck',35,deckY-.12,50,3,.24,1.6,true);
 const start=new THREE.Vector3(36.75,dockY,56.15),end=new THREE.Vector3(35,deckY,50.4),count=40;
 const run=Math.hypot(end.x-start.x,end.z-start.z),yaw=Math.atan2(end.x-start.x,end.z-start.z);
 const route=[toCastle(start.toArray())];
 for(let i=0;i<count;i++){
  const p=start.clone().lerp(end,(i+.5)/count),top=dockY+(deckY-dockY)*(i+1)/count;
  const step=box('west-city-harbor-boarding-step-'+i,p.x,top-.10,p.z,2,.2,run/count+.04,true);step.rotation.y=yaw;
  route.push(toCastle([p.x,top,p.z]));
 }
 for(const x of [33.7,36.3])for(const z of [49.4,50.6]){const bottom=surface(x,z)-1.8;box('west-city-harbor-boarding-pile',x,(deckY+bottom)/2,z,.2,deckY-bottom,.2);}
 route.push(toCastle([35,deckY,50]));
 city.userData.boardingRoute=route;city.userData.boardingAnchor=toCastle([35,deckY,50]);
 city.userData.harborStatus='low-boarding-platform-candidate; boat-and-unloading-pending';
}
