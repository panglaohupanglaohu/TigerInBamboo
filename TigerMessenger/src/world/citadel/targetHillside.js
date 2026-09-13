import * as THREE from 'three';
import {buildClaudeHouses} from './claudeHouses.js';

// Additional small hillside lots follow the actual mountain, not a flat art plate.
export function buildTargetHillside(castle, city) {
 const terrain=castle.getObjectByName('citadel-oskar-grid-mountain-surface');
 if(!terrain||!city)return;
 castle.updateWorldMatrix(true,true);
 const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0).transformDirection(city.matrixWorld);
 const lots=[],diagnostics={tested:0,noHit:0,height:0,steep:0};
 const footings=[];
 for(let row=0;row<11;row++)for(let col=0;col<10;col++){
  const x=-48+col*5.3+(row%2)*1.7,z=-47+row*6.1;
  // Original playable old-city core / bridge corridor are left clear.
  if(x>-17&&z>-26&&z<27)continue;
  diagnostics.tested++;
  const origin=city.localToWorld(new THREE.Vector3(x,160,z));
  ray.set(origin,down);ray.far=220;
  const hit=ray.intersectObject(terrain,false)[0];if(!hit){diagnostics.noHit++;continue;}
  const p=city.worldToLocal(hit.point.clone());
  if(p.y<2||p.y>58){diagnostics.height++;continue;}
  const normal=hit.face.normal.clone().transformDirection(terrain.matrixWorld);
  if(Math.abs(normal.dot(down))<.55){diagnostics.steep++;continue;}
  const width=2.9+((row*7+col*3)%5)*.18;
  const heights=[p.y];
  for(const dx of [-width/2,width/2])for(const dz of [-1.5,1.5]){
   ray.set(city.localToWorld(new THREE.Vector3(x+dx,160,z+dz)),down);
   const h=ray.intersectObject(terrain,false)[0];
   if(h)heights.push(city.worldToLocal(h.point.clone()).y);
  }
  const low=Math.min(...heights),high=Math.max(...heights);
  if(heights.length<5||high-low>3.4)continue;
  const base=high+.03;
  lots.push([x,base,z,width,3,3.3+((col+row*3)%4)*.9]);
  footings.push([x,(low+base)/2-.1,z,width+.12,base-low+.2,3.12]);
 }
 // Distant settlement follows the newly authored rocky backdrop. These are
 // scenic lots, distinct from the playable old-city core left untouched above.
 const ridge=city.getObjectByName('citadel-backdrop-ridge-near');
 if(ridge){
  const attr=ridge.geometry.attributes.position;
  for(let i=0;i<attr.count&&lots.length<62;i+=9){
   const p=city.worldToLocal(ridge.localToWorld(new THREE.Vector3().fromBufferAttribute(attr,i)));
   if(p.x< -55||p.x>20||p.y<12||p.y>57||p.z> -49)continue;
   if(lots.some(l=>Math.hypot(l[0]-p.x,l[2]-p.z)<4.7))continue;
   const w=2.7+(i%4)*.22,h=3.7+(i%5)*.65;
   lots.push([p.x,p.y+.05,p.z,w,3,h]);
   footings.push([p.x,p.y-1.4,p.z,w+.18,3.0,3.18]);
  }
 }
 const group=buildClaudeHouses(1,lots);
 // These static lots lie outside the authored routes, but remain solid to walkers.
 group.userData.designRole='target-dense-terraced-old-city';
 group.userData.placementDiagnostics=diagnostics;
 const stone=new THREE.MeshStandardMaterial({color:0x646d7d,roughness:1});
 const feet=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),stone,footings.length),m=new THREE.Object3D();
 footings.forEach(([x,y,z,w,h,d],i)=>{m.position.set(x,y,z);m.scale.set(w,h,d);m.updateMatrix();feet.setMatrixAt(i,m.matrix);});
 feet.name='target-hillside-rock-foundations';feet.instanceMatrix.needsUpdate=true;feet.computeBoundingSphere();group.add(feet);
 city.add(group);
 return group;
}
