import {PLAZA_SHIFT} from './newPlazaLayout.js';
import masonry from '../../../assets/models/optimized/citadel-horse-terrace/masonryData.js';
import * as THREE from 'three';
export const HORSE_TERRACE={x:75+PLAZA_SHIFT,z:72.5,y:5.8,width:12,depth:14,rampEnd:60,rampStart:65.5,rampWidth:5.6};
export function horseTerraceHeight(x,z){
  const t=HORSE_TERRACE;
  const localX=x-PLAZA_SHIFT;
  if(localX>=69&&localX<=81&&z>=65.5&&z<=79.5)return t.y;
  if(Math.abs(x-t.x)<=t.rampWidth/2&&z>=t.rampEnd&&z<t.rampStart)return 4+1.8*(z-t.rampEnd)/(t.rampStart-t.rampEnd);
  return 4;
}
export function buildHorseTerrace(stone,paving){
 const root=new THREE.Group();root.name='citadel-original-horse-terrace';root.position.x=PLAZA_SHIFT;
 function block(name,x,y,z,w,h,d,walk=false){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),walk?paving:stone);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;m.userData.sourceId=name;m.userData.citadelSolidExterior=!walk;if(walk){m.userData.westCityWalkable=true;m.userData.isCitadelTerrain=true;}root.add(m);return m;}
 block('horse-terrace-foundation',75,2.85,72.5,12,5.7,14);
 block('horse-terrace-paving',75,5.7,72.5,12,.2,14,true);
 // Continuous load-bearing ramp for the wheeled original horse, not stairs.
 const x0=72.2,x1=77.8,z0=60,z1=65.5;
 const vertices=[x0,4,z0,x1,4,z0,x0,5.8,z1,x1,5.8,z1,x0,3.8,z0,x1,3.8,z0,x0,3.8,z1,x1,3.8,z1];
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.setIndex([0,2,1,1,2,3,4,5,6,5,7,6,0,4,2,2,4,6,1,3,5,3,7,5,2,6,3,3,6,7,0,1,4,1,5,4]);geo.computeVertexNormals();
 const ramp=new THREE.Mesh(geo,paving);ramp.name='horse-terrace-exit-ramp';ramp.userData.westCityWalkable=true;ramp.userData.isCitadelTerrain=true;ramp.castShadow=true;ramp.receiveShadow=true;root.add(ramp);
 // Pedestrians use the western stair, offset from the statue's circular paving.
 const steps=PLAZA_SHIFT?8:12,tread=2.4/steps;
 for(let i=0;i<steps;i++){const top=4+(i+1)*1.8/steps;block('horse-terrace-side-step-'+i,66.6+(i+.5)*tread,(top+3.8)/2,77,tread,top-3.8,2.4,true);}
 block('horse-terrace-east-parapet',80.85,6.25,72.5,.3,.9,14);
 block('horse-terrace-rear-parapet',75,6.25,79.35,12,.9,.3);
 const claddingGeometry=new THREE.BufferGeometry();
 claddingGeometry.setAttribute('position',new THREE.Float32BufferAttribute(masonry.positions,3));
 claddingGeometry.setAttribute('color',new THREE.Float32BufferAttribute(masonry.colors,3));
 claddingGeometry.computeVertexNormals();
 const cladding=new THREE.Mesh(claddingGeometry,new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,roughness:.97,flatShading:true}));
 cladding.name='horse-terrace-blender-masonry';cladding.userData.sourceBlender=masonry.source;
 cladding.castShadow=true;cladding.receiveShadow=true;root.add(cladding);
 root.userData.sourceId='citadel-original-horse-terrace-v2';return root;
}

// The rigid-legged original soldiers use the pedestrian stair. The continuous
// sloped ramp remains reserved for the wheeled horse and is not gait clearance.
export function horseSoldierExitRoute(){
 if(!PLAZA_SHIFT)return [[75,5.8,66],[75,5.8,65.5],[75,4,60],[60,4,60],[60,4,58]];
 const points=[[76.5,5.8,77],[75.1,5.8,77]];
 for(let i=7;i>=0;i--)points.push([72.6+(i+.5)*.3,4+(i+1)*.225,77]);
 points.push([72.45,4,77],[72,4,74.5],[72,4,67],[60,4,65],[60,4,58]);
 const extra=PLAZA_SHIFT-6;
 return points.map(p=>[p[0]>70?p[0]+extra:p[0],p[1],p[2]]);
}
