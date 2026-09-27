import * as THREE from 'three';
import {mergeStaticGroup} from './geometryMerge.js';

// Grounded planting complements the retreating banks; never fills the water gap.
export function installGateTargetGreenery(gate){
 if(new URLSearchParams(location.search).get('gateGreenery')==='0')return;
 const seat=gate.userData.seatRoot,site=seat.userData.siteRoot,arch=seat.userData.moebiusV10;
 if(!arch?.userData.thirtyRound||site.getObjectByName('gate-reference-greenery'))return;
 const garden=new THREE.Group();garden.name='gate-reference-greenery';site.add(garden);
 const colors=[0x426968,0x64846a,0x8b9d70,0xb4b579];
 const mats=colors.map(color=>new THREE.MeshBasicMaterial({color,side:THREE.DoubleSide}));
 const leaf=new THREE.SphereGeometry(1,5,3),bush=new THREE.IcosahedronGeometry(1,1);
 let clusters=0,blades=0;const anchors=[];
 function mesh(g,m,p,s){const o=new THREE.Mesh(g,m);o.position.copy(p);o.scale.set(...s);garden.add(o);return o;}
 function plant(p,size,seed,shrub=true){
  clusters++;anchors.push(p.toArray());
  if(shrub)for(let k=0;k<5;k++){const a=k*2.4+seed;mesh(bush,mats[k%4],p.clone().add(new THREE.Vector3(Math.cos(a)*size*.4,size*(.28+k%2*.15),Math.sin(a)*size*.4)),[size*.57,size*.36,size*.49]);}
  for(let k=0;k<9;k++){const a=k*2.4+seed,len=size*(.7+(k%3)*.22),dir=new THREE.Vector3(Math.cos(a)*.6,.6+(k%3)*.2,Math.sin(a)*.6).normalize();const o=mesh(leaf,mats[(k+1)%4],p.clone().addScaledVector(dir,len*.5),[size*.12,len*.55,size*.035]);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),dir);blades++;}
 }
 site.updateWorldMatrix(true,true);const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0).transformDirection(site.matrixWorld);
 const rocks=[];site.traverseVisible(o=>{if(o.isMesh&&(o.name==='g30-far-mountain'||o.name==='gate-site-GateSite_rock-solid'))rocks.push(o);});
 let grounded=0;
 function groundedPlant(x,z,size,seed){ray.set(site.localToWorld(new THREE.Vector3(x,100,z)),down);ray.far=180;const hit=ray.intersectObjects(rocks,false)[0];if(!hit)return;const p=site.worldToLocal(hit.point.clone());if(p.y< -12)return;plant(p,size,seed);grounded++;}
 // Stair shoulders: leave the explicit walk surfaces and terrace center clear.
 // Old near-bank planting is omitted with the two removed shoulder meshes.
 // Vegetation descends the distant rock shoulders, rather than only dotting summits.
 for(const rock of rocks.filter(o=>o.name==='g30-far-mountain'))for(let k=0;k<64;k++){const a=k*2.399,r=2+(k%9)*1.15;groundedPlant(rock.position.x+Math.cos(a)*r,rock.position.z+Math.sin(a)*r,1.1+(k%4)*.35,k);}
 // Platform edge beds in the architecture frame, outside the circulation corridor.
 const toSite=p=>site.worldToLocal(arch.localToWorld(p));
 const planterMat=new THREE.MeshBasicMaterial({color:0xc4a273});
 for(const x of[-29.2,-16.8])for(let z=-23.5;z< -15.5;z+=1.3){
  if(x>-20&&z>-20.8&&z<-17.8)continue;
  mesh(new THREE.CylinderGeometry(.4,.3,.4,8),planterMat,toSite(new THREE.Vector3(x,3.48,z).add(new THREE.Vector3(...(arch.userData.meetingShift||[0,0,0])))),[1,1,1]);
  plant(toSite(new THREE.Vector3(x,3.68,z).add(new THREE.Vector3(...(arch.userData.meetingShift||[0,0,0])))),.48,z);
 }
 // Glass columns have their actual scaled centers at x=±7.4925, not the pier axis.
 for(const side of[-1,1])for(const z of[-23.76,-7.92,7.92,23.76])for(let j=0;j<15;j++){
  const a=j*2.4,p=toSite(new THREE.Vector3(side*7.4925+Math.cos(a)*.19,1.0+j*.53,z+Math.sin(a)*.17));plant(p,.34+(j%3)*.04,j,false);
 }
 const merged=mergeStaticGroup(garden,{skipOutline:()=>true});
 for(const o of merged.surfaces)o.name='gate-reference-foliage-batch';
 garden.userData.audit={clusters,blades,grounded,batches:merged.surfaces.length,anchors};
}
