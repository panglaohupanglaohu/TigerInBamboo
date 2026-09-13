import * as THREE from 'three';
import {buildCitadelCypress} from './citadelGarden.js';
import {mergeStaticGroup} from '../geometryMerge.js';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';
export function buildCitadelShorePlanting(castle,radius=160){
 const shore=castle.userData.oldShoreApproach;if(!shore||castle.getObjectByName('citadel-shore-cypress-groves'))return null;
 castle.updateWorldMatrix(true,true);const city=castle.getObjectByName('highland-west-city'),root=new THREE.Group();root.name='citadel-shore-cypress-groves';castle.add(root);
 const surfaces=['citadel-oskar-grid-mountain-surface','old-shore-blender-rock-support','highland-ravine-wall-west'].map(n=>castle.getObjectByName(n)).filter(Boolean);
 const up=new THREE.Vector3(0,1,0).transformDirection(castle.matrixWorld),ray=new THREE.Raycaster();ray.layers.enableAll();ray.far=500;
 const sample=(x,z)=>{const from=castle.localToWorld(new THREE.Vector3(x,180,z));ray.set(from,up.clone().negate());const hit=ray.intersectObjects(surfaces,false)[0];if(!hit||hit.point.length()<radius+officialOceanLevelAt(hit.point)+.25)return null;return castle.worldToLocal(hit.point.clone());};
 const blockers=[];castle.traverseVisible(o=>{if(!o.isMesh||surfaces.includes(o)||o.layers.mask===0||o.userData.isOutline||o.userData.backlitHighlight)return;const mats=Array.isArray(o.material)?o.material:[o.material];if(mats.every(m=>m.transparent||m.visible===false))return;let p=o;while(p&&p!==castle){if(/vegetation|canopy|garden|cypress|backdrop|coastal-cliff-seal/.test(p.name))return;p=p.parent;}blockers.push(o);});
 const clearCrown=(p,size)=>{for(const height of [1,2.5,4.5])for(let i=0;i<8;i++){const origin=castle.localToWorld(new THREE.Vector3(p.x,p.y+height*size,p.z));const direction=new THREE.Vector3(Math.cos(i*Math.PI/4),0,Math.sin(i*Math.PI/4)).transformDirection(castle.matrixWorld);ray.set(origin,direction);ray.far=.85*size;if(ray.intersectObjects(blockers,false).length){ray.far=500;return false;}}ray.far=500;return true;};
 const candidates=[];
 for(const leg of [2,4,6]){const a=new THREE.Vector3(...shore.control[leg-1]),b=new THREE.Vector3(...shore.control[leg]),normal=new THREE.Vector3(b.z-a.z,0,a.x-b.x).normalize();for(const t of [.25,.7])for(const side of [-1,1])candidates.push({p:a.clone().lerp(b,t).addScaledVector(normal,side*2.9),size:.58+(leg%3)*.045,zone:'old-shore'});}
 for(const p of [[39,4,78],[42,4,66],[80,4,65],[81,10,40],[36,10,38],[38,16,17],[83,16,16]])candidates.push({p:castle.worldToLocal(city.localToWorld(new THREE.Vector3(...p))),size:.8,zone:'new-city-slope'});
 const paths=[shore.route,city.userData.frontHarborRoute,city.userData.walkRoute].filter(Boolean);
 const pathDistance=(p)=>{let best=Infinity;for(const path of paths)for(let i=1;i<path.length;i++){const a=path[i-1],b=path[i],dx=b[0]-a[0],dz=b[2]-a[2],l=dx*dx+dz*dz;if(l<1e-8)continue;const t=THREE.MathUtils.clamp(((p.x-a[0])*dx+(p.z-a[2])*dz)/l,0,1);best=Math.min(best,Math.hypot(p.x-a[0]-t*dx,p.z-a[2]-t*dz));}return best;};
 const moss=new THREE.MeshStandardMaterial({color:0x49634c,roughness:1,flatShading:true});
 const report={source:'assets/models/optimized/citadel-cypress/citadel-cypress-v1.glb',candidates:candidates.length,placed:[],rejected:[],footprintRadius:.18};
 for(const [i,spec] of candidates.entries()){
  const p=sample(spec.p.x,spec.p.z),distance=pathDistance(spec.p);
  if(!p||distance-.912191*spec.size<1.85){report.rejected.push({index:i,reason:!p?'no-dry-support':'route-reservation'});continue;}
  const feet=[[.18,0],[-.18,0],[0,.18],[0,-.18]].map(([x,z])=>sample(p.x+x,p.z+z));
  if(feet.some(q=>!q)||Math.max(...feet.map(q=>Math.abs(q.y-p.y)))>.20){report.rejected.push({index:i,reason:'unstable-root-footprint'});continue;}
  const rootPoint=p.clone();rootPoint.y=Math.min(p.y,...feet.map(q=>q.y))-.05;
  if(!clearCrown(rootPoint,spec.size)){report.rejected.push({index:i,reason:'building-or-wall-clearance'});continue;}
  const tree=buildCitadelCypress(spec.size,i*.83);tree.position.copy(p);tree.position.y=Math.min(p.y,...feet.map(q=>q.y))-.05;root.add(tree);
  const ring=Array.from({length:9},(_,j)=>sample(p.x+Math.cos(j*Math.PI*2/9)*.48,p.z+Math.sin(j*Math.PI*2/9)*.48));
  if(ring.every(Boolean)){
   const vertices=[];for(let j=0;j<ring.length;j++)for(const v of [p,ring[(j+1)%ring.length],ring[j]])vertices.push(v.x,v.y+.025,v.z);
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geo.computeVertexNormals();const patch=new THREE.Mesh(geo,moss);patch.name='shore-root-groundcover';patch.receiveShadow=true;root.add(patch);
  }
  report.placed.push({index:i,groundcover:ring.every(Boolean),zone:spec.zone,root:tree.position.toArray(),surface:p.toArray(),size:spec.size,routeDistance:distance,canopyRadius:.912191*spec.size,walkEdgeClearance:distance-.912191*spec.size,crownSampleRays:24,crownClearanceRadius:.85*spec.size,footprintDelta:Math.max(...feet.map(q=>Math.abs(q.y-p.y)))});
 }
 mergeStaticGroup(root,{mergedTag:'shore-cypress',onSurface:m=>{m.name='shore-cypress-geometry';m.userData.citadelSolidExterior=true;}});
 root.userData.planting=report;castle.userData.shorePlanting=report;return root;
}
