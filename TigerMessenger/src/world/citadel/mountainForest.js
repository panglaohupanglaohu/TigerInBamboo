import * as THREE from 'three';
import {buildCitadelCypress} from './citadelGarden.js';
import {mergeStaticGroup} from '../geometryMerge.js';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';
export function adaptCitadelMountainForest(castle,radius=160){
 const forest=castle.getObjectByName('highland-canopy-groves');
 if(!castle.userData.commonSurfaceFrame||!forest?.isInstancedMesh||castle.getObjectByName('citadel-mountain-cypress-groves'))return null;
 castle.updateWorldMatrix(true,true);forest.geometry.computeBoundingBox();
 const surfaces=['citadel-oskar-grid-mountain-surface','highland-ravine-wall-west'].map(n=>castle.getObjectByName(n)).filter(Boolean);
 const up=new THREE.Vector3(0,1,0).transformDirection(castle.matrixWorld),ray=new THREE.Raycaster();ray.layers.enableAll();ray.far=500;
 const sample=(x,z)=>{ray.set(castle.localToWorld(new THREE.Vector3(x,180,z)),up.clone().negate());const hit=ray.intersectObjects(surfaces,false)[0];if(!hit||hit.point.length()<radius+officialOceanLevelAt(hit.point)+.2)return null;return {point:castle.worldToLocal(hit.point.clone()),slope:Math.acos(THREE.MathUtils.clamp(Math.abs(hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize().dot(up)),0,1))*180/Math.PI};};
 const city=castle.getObjectByName('highland-west-city'),paths=[castle.userData.oldShoreApproach?.route,city.userData.walkRoute,city.userData.harborRoute,city.userData.frontHarborRoute].filter(Boolean);
 const routeDistance=p=>{let best=Infinity;for(const path of paths)for(let j=1;j<path.length;j++){const a=path[j-1],b=path[j],dx=b[0]-a[0],dz=b[2]-a[2],den=dx*dx+dz*dz;if(den<1e-8)continue;const t=THREE.MathUtils.clamp(((p.x-a[0])*dx+(p.z-a[2])*dz)/den,0,1);best=Math.min(best,Math.hypot(p.x-a[0]-t*dx,p.z-a[2]-t*dz));}return best;};
 const root=new THREE.Group();root.name='citadel-mountain-cypress-groves';castle.add(root);
 const report={sourceCount:forest.count,retainedRound:[],cypress:[],omitted:[],source:'assets/models/optimized/citadel-cypress/citadel-cypress-v1.blend',slopeLimit:40,canopyTreatment:"replace-bare-crowns-with-approved-cypress"};
 let retained=0;
 for(let i=0;i<report.sourceCount;i++){
  const matrix=new THREE.Matrix4(),color=new THREE.Color();forest.getMatrixAt(i,matrix);forest.getColorAt(i,color);
  const pos=new THREE.Vector3(),q=new THREE.Quaternion(),scale=new THREE.Vector3();matrix.decompose(pos,q,scale);
  const original=castle.worldToLocal(forest.localToWorld(new THREE.Vector3(0,forest.geometry.boundingBox.min.y,0).applyMatrix4(matrix)));
  const hit=sample(original.x,original.z);if(!hit){report.omitted.push({index:i,reason:'no-dry-surface'});continue;}
  const distance=routeDistance(hit.point);
  const size=.95+(i%5)*.08;
  if(distance-.912191*size<2.4||report.cypress.some(p=>Math.hypot(p.root[0]-hit.point.x,p.root[2]-hit.point.z)<3.0)){report.omitted.push({index:i,reason:distance-.912191*size<2.4?'route-reservation':'grove-spacing'});continue;}
  const footprint=.14*size+.02;
  const feet=[[0,0],[footprint,0],[-footprint,0],[0,footprint],[0,-footprint]].map(([x,z])=>sample(hit.point.x+x,hit.point.z+z));
  if(feet.some(p=>!p)||Math.max(...feet.map(p=>p.point.y))-Math.min(...feet.map(p=>p.point.y))>.8){report.omitted.push({index:i,reason:'broken-root-surface'});continue;}
  const tree=buildCitadelCypress(size,i*.83);tree.position.copy(hit.point);tree.position.y=Math.min(...feet.map(p=>p.point.y))-.06;root.add(tree);
  report.cypress.push({index:i,root:tree.position.toArray(),surface:hit.point.toArray(),size,footprint,slope:hit.slope,routeDistance:distance,footprintDelta:Math.max(...feet.map(p=>p.point.y))-Math.min(...feet.map(p=>p.point.y))});
 }
 forest.count=retained;forest.instanceMatrix.needsUpdate=true;forest.instanceColor.needsUpdate=true;forest.computeBoundingBox();forest.computeBoundingSphere();
 mergeStaticGroup(root,{mergedTag:'mountain-cypress',onSurface:m=>{m.name='mountain-cypress-geometry';m.userData.citadelSolidExterior=true;}});
 root.userData.planting=report;forest.userData.mountainAdaptation=report;castle.userData.mountainForest=report;return root;
}
