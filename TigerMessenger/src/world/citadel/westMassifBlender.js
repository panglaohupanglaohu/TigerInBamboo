import * as THREE from 'three';
import data from '../../../assets/models/optimized/citadel-west-massif/westMassifR02.js';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';
const authored=new WeakMap();
export function buildWestMassifGeometry(){
 const geometry=new THREE.BufferGeometry();
 for(const [name,key] of [['position','positions'],['normal','normals'],['color','colors']])geometry.setAttribute(name,new THREE.Float32BufferAttribute(data[key],3));
 geometry.computeBoundingSphere();geometry.userData.blenderSource=data.source;return geometry;
}
export function conformWestMassifToOcean(castle,radius=160){
 const wall=castle?.getObjectByName('highland-ravine-wall-west');
 if(!wall?.geometry.userData.blenderSource)return null;
 wall.updateWorldMatrix(true,false);const inverse=wall.matrixWorld.clone().invert(),p=wall.geometry.attributes.position;
 if(!authored.has(wall.geometry))authored.set(wall.geometry,p.array.slice());const base=authored.get(wall.geometry),v=new THREE.Vector3();let changed=0,maxFootClearance=-Infinity;
 for(let i=0;i<p.count;i++){
  const y=base[i*3+1];v.fromArray(base,i*3);
  if(y<8){v.applyMatrix4(wall.matrixWorld);const r=v.length(),sea=radius+officialOceanLevelAt(v),fade=Math.min(1,Math.max(0,(8-y)/13));const target=sea-(y<-8?3:1.5);v.multiplyScalar((r+Math.min(0,target-r)*fade)/r);if(y<=-4.99)maxFootClearance=Math.max(maxFootClearance,v.length()-sea);v.applyMatrix4(inverse);changed++;}
  p.setXYZ(i,v.x,v.y,v.z);
 }
 p.needsUpdate=true;wall.geometry.computeVertexNormals();wall.geometry.computeBoundingBox();wall.geometry.computeBoundingSphere();
 const report={source:data.source,changed,vertices:p.count,maxFootClearance,scope:'Closed west-wing massif, final ocean foot; no original route changes'};wall.userData.westMassifBlender=report;return report;
}
