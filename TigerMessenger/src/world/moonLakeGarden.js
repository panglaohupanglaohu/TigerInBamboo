import * as T from 'three';
import {createMoonLakeCompanionPine} from '../assets/moonLakePineCompanions.js';
import {mergeStaticGroup} from './geometryMerge.js';

export const MOON_LAKE_GARDEN_SITES=Object.freeze([
 Object.freeze({id:2,role:'lean',x:-14.5,z:-4.5,yaw:0}),
 Object.freeze({id:4,role:'spread',x:0,z:-8.5,yaw:.05}),
 Object.freeze({id:5,role:'windswept',x:-9,z:7.5,yaw:0}),
 Object.freeze({id:6,role:'arching',x:7.5,z:8,yaw:.15})
]);

/** Additive installation. Does not own or mutate the original lake, moon or pine.
 * surfaceHeightAt(x,z) returns lake-parent LOCAL Y, or null to reject a site.
 * Collider centres are world coordinates; radii are world distances.
 */
export function createMoonLakeGarden(lakeGroup,{planetRadius=160,surfaceHeightAt=null,sites=MOON_LAKE_GARDEN_SITES}={}){
 if(!lakeGroup?.isObject3D||!(planetRadius>0))throw new TypeError('Moon lake parent and radius required');
 const root=new T.Group();root.name='moon-lake-oskar-natural-garden';lakeGroup.add(root);
 let sampler=surfaceHeightAt;const sampleCache=new Map();
 const height=(x,z)=>{const key=x.toFixed(5)+','+z.toFixed(5);if(sampleCache.has(key))return sampleCache.get(key);const v=sampler?sampler(x,z):Math.sqrt((planetRadius+.6)**2-x*x-z*z)-(planetRadius+.78);const y=typeof v==='number'?v:v?.height,result=Number.isFinite(y)?y:null;sampleCache.set(key,result);return result;};
 const report={version:4,readabilityRevision:4,target:'greg-moon-target-v2.png',layout:'Greg four NEW individually authored2/4/5/6; lean left clears floating crescent, smaller rear spread, low left windswept, right foreground arching; original ancient pine and forest retained separately',originalLakeChanged:false,originalPineChanged:false,originalForestChanged:false,moonChanged:false,surface:surfaceHeightAt?'caller-final-local-surface':'source-analytic-sphere',navigationVerified:false,sites:[],rejected:[],groundcover:[],draws:0,triangles:0};
 const trees=[],colliders=[],owners=[],plantings=[];
 for(const s of sites){const model=createMoonLakeCompanionPine({role:s.role}),y=height(s.x,s.z),radius=model.report.rootRadius;
  const probes=[[s.x,s.z],[s.x+radius,s.z],[s.x-radius,s.z],[s.x,s.z+radius],[s.x,s.z-radius]].map(([x,z])=>height(x,z));
  const pathGap=Math.hypot(s.x,s.z)-radius-4.7;
  if(y===null||probes.some(p=>p===null)||Math.max(...probes)-Math.min(...probes)>.65||pathGap<.7){report.rejected.push({id:s.id,reason:'missing/steep support or root intrudes ring',probes,pathGap});model.dispose();continue;}
  model.group.position.set(s.x,y,s.z);model.group.rotation.y=s.yaw;root.add(model.group);owners.push(model);trees.push(model.group);
  const row={...s,y,rootRadius:radius,pathGap,model:model.report,worldBounds:null};report.sites.push(row);plantings.push({object:model.group,x:s.x,z:s.z,radius,id:s.id});
 }
 const dressing=new T.Group();dressing.name='moon-lake-natural-low-groundcover';root.add(dressing);
 const mats={turf:new T.MeshStandardMaterial({color:'#909b6d',roughness:1}),leaf:new T.MeshStandardMaterial({color:'#55734f',roughness:1,flatShading:true}),grass:new T.MeshStandardMaterial({color:'#9fa96f',roughness:1,side:T.DoubleSide}),stone:new T.MeshStandardMaterial({color:'#a8a18c',roughness:1,flatShading:true})};
 const patches=[[-15.3,-5.6,1.15],[-13.2,-5,.8],[-1.6,-9,1.1],[1.5,-9.1,.8],[-10.2,7.2,1.05],[-8,8.4,.8],[6.2,8.5,1],[8.4,9.2,.8],[8.1,2.4,.65],[10.8,1.1,.7],[-6.5,-1.8,.7]];
 for(let i=0;i<patches.length;i++){const[x,z,r]=patches[i],y=height(x,z);if(y===null||Math.hypot(x,z)-r<5.05)continue;
  const points=[],n=11;for(let j=0;j<n;j++){const a=j/n*Math.PI*2,rr=r*(.83+.15*Math.sin(j*2.1+i)),px=x+Math.cos(a)*rr,pz=z+Math.sin(a)*rr,py=height(px,pz);if(py===null){points.length=0;break;}points.push([px,py+.018,pz]);}if(points.length!==n)continue;
  const v=[];for(let j=0;j<n;j++)v.push(x,y+.018,z,...points[(j+1)%n],...points[j]);const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(v,3));geo.computeVertexNormals();dressing.add(new T.Mesh(geo,mats.turf));
  for(let k=0;k<3;k++){const a=k*2.4,px=x+Math.cos(a)*r*.3,pz=z+Math.sin(a)*r*.3,py=height(px,pz);if(py===null)continue;const m=new T.Mesh(new T.IcosahedronGeometry(1,1),mats.leaf);m.position.set(px,py+.18,pz);m.scale.set(r*.4,.22+k*.025,r*.34);m.rotation.y=a;dressing.add(m);}
  if(i%2===0){const v=[];for(let k=0;k<3;k++){const a=k*2.5,bx=x+Math.cos(a)*r*.5,bz=z+Math.sin(a)*r*.5,by=height(bx,bz);if(by===null)continue;v.push(bx-.025,by+.02,bz,bx+.025,by+.02,bz,bx+Math.sin(a)*.10,by+.32,bz+Math.cos(a)*.10);}if(v.length){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(v,3));g.computeVertexNormals();dressing.add(new T.Mesh(g,mats.grass));}}
  if(i<3){const px=x+r*.7,pz=z-r*.3,py=height(px,pz);if(py!==null){const m=new T.Mesh(new T.IcosahedronGeometry(.25,0),mats.stone);m.position.set(px,py+.13,pz);m.scale.set(1.1,.65,.9);dressing.add(m);}}
  report.groundcover.push({x,z,r,planter:false});
 }
 mergeStaticGroup(dressing,{mergedTag:'moon-natural-groundcover'});root.updateWorldMatrix(true,true);
 for(let i=0;i<trees.length;i++)colliders.push({position:new T.Vector3(),radius:report.sites[i].rootRadius,kind:'moon-lake-pine-root',object:trees[i],id:report.sites[i].id});
 function syncColliders(){root.updateWorldMatrix(true,true);const scale=root.getWorldScale(new T.Vector3());for(let i=0;i<trees.length;i++){const tree=trees[i],row=report.sites[i],worldBounds=new T.Box3().setFromObject(tree);row.worldBounds={min:worldBounds.min.toArray(),max:worldBounds.max.toArray()};colliders[i].position.copy(tree.localToWorld(new T.Vector3(0,.65,0)));colliders[i].radius=row.rootRadius*Math.max(scale.x,scale.z);}}
 syncColliders();
 const groundBindings=[];dressing.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position,offsets=new Float32Array(p.count);for(let i=0;i<p.count;i++){const h=height(p.getX(i),p.getZ(i));offsets[i]=h===null?NaN:p.getY(i)-h;}groundBindings.push({mesh,offsets});});
 function reseat(surface){if(typeof surface!=='function')throw new TypeError('Final local surface sampler required');sampler=surface;sampleCache.clear();const result={seated:[],rejected:[],groundVertices:0,missingGroundVertices:0};
  for(let i=0;i<plantings.length;i++){const p=plantings[i],r=p.radius,probes=[[p.x,p.z],[p.x+r,p.z],[p.x-r,p.z],[p.x,p.z+r],[p.x,p.z-r]].map(([x,z])=>height(x,z));if(probes.some(h=>h===null)||Math.max(...probes)-Math.min(...probes)>.65){result.rejected.push({id:p.id,probes,reason:'missing or steep actual root support; previous pose retained'});continue;}p.object.position.y=probes[0];report.sites[i].y=probes[0];report.sites[i].finalSupport=probes;result.seated.push(p.id);}
  for(const{mesh,offsets}of groundBindings){const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const h=height(p.getX(i),p.getZ(i));if(h===null||!Number.isFinite(offsets[i])){result.missingGroundVertices++;continue;}p.setY(i,h+offsets[i]);result.groundVertices++;}p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();}
  syncColliders();report.finalGround=result;report.surface='caller-final-local-surface';return result;
 }
 root.traverse(o=>{if(o.isMesh){report.draws++;report.triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3;}});root.userData.moonLakeGardenReport=report;
 let disposed=false;return{group:root,trees,plantings,colliders,report,reseat,syncColliders,dispose(){if(disposed)return;disposed=true;root.removeFromParent();owners.forEach(o=>o.dispose());const geos=new Set();dressing.traverse(o=>{if(o.isMesh)geos.add(o.geometry);});geos.forEach(g=>g.dispose());Object.values(mats).forEach(m=>m.dispose());dressing.clear();root.clear();colliders.length=0;}};
}
