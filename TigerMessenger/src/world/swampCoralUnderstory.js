import * as THREE from 'three';
import {GREG_LAKE_PALETTE as P} from './swampGregVisuals.js';
import {createSwampLivingPathConstraints} from './swampGregLivingPaths.js';
import {createSwampCliffSampler} from './swampNaturalCliff.js';
import {useSwampTargetFoliage} from './swampCoralCanopy.js';

function leafTemplate(type){
 const target=useSwampTargetFoliage(),base=new THREE.Color(P.foliageShade).lerp(new THREE.Color(P.foliage),.2),tip=new THREE.Color(P.foliageLight);
 const positions=[],colors=[],uvs=[],light=new THREE.Color(0x6cc06e),dark=new THREE.Color(0x24806a),fans=type==='fern'?7:type==='fan'?9:5,steps=type==='fern'?10:8;
 const emit=(point,u,v,tint)=>{positions.push(...point);uvs.push(u,v);colors.push(...tint);};
 for(let f=0;f<fans;f++){
  const a=(f/(fans-1)-.5)*(type==='fan'?2.7:2.3),length=.84+.24*Math.sin(f*2.3+1);
  function point(t,side){
   if(type==='pendant'){
    // Unequal arched fronds leave one shared root, instead of five identical
    // hanging ribbons. Alternate rounded broad leaves and lobed fern blades.
    const reach=.55+.42*(.5+.5*Math.sin(f*2.3+1));
    const lobes=f%2?1:.65+.35*Math.abs(Math.sin(t*Math.PI*3+.15*f));
    const width=Math.pow(Math.sin(Math.PI*t),.5)*.27*lobes;
    const spread=.34*t+.36*Math.sin(Math.PI*t),curl=.18*t+reach*.64*Math.sin(Math.PI*t*.88);
    const x=Math.sin(a)*spread+.12*Math.sin(f*1.7)*t*t+Math.cos(a)*width*side;
    const z=Math.max(.015*t,Math.cos(a)*curl-Math.sin(a)*width*side);
    const y=-reach*(.82*t+.13*t*t)+(.1+.04*Math.cos(f))*Math.sin(Math.PI*t);
    return new THREE.Vector3(x,y,z);
   }
   const lobes=type==='fern'?.64+.36*Math.abs(Math.sin(t*Math.PI*5)) : 1+.1*Math.sin(t*19);
   const width=Math.pow(Math.sin(Math.PI*t),type==='fan'?.65:1)*(type==='fan'?.38:type==='fern'?.29:.24)*lobes;
   const x=Math.sin(a)*length*t+Math.cos(a)*width*side,rawZ=.12*t+Math.cos(a)*length*t-Math.sin(a)*width*side;
   const z=type==='fan'?Math.max(.03*t,rawZ):rawZ;
   const y=type==='fan'?.50*t+Math.sin(t*Math.PI)*(.68+.06*Math.sin(f)):.12*t+Math.sin(t*Math.PI)*(.73+.08*Math.sin(f));
   return new THREE.Vector3(x,y,z);
  }
  for(let j=0;j<steps;j++){
   const t=j/steps,u=(j+1)/steps;
   for(const [v,s] of [[t,-1],[u,-1],[t,1],[t,1],[u,-1],[u,1]]){
    // Coherent blade planes: dark sheltered bases and softly lit outer blades.
    // Formerly each midrib separated unrelated bright/dark halves on every leaf.
    const tint=target?base.clone().lerp(tip,.16+.63*Math.sin(v*Math.PI*.72)).multiplyScalar((.91+.09*Math.sin(f*2.3+1)**2)*(s<0?1:.93)):(s<0?light:dark);
    emit(point(v,s),v,(s+1)/2,tint);
   }
  }
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
function leafMaterial(){
 const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false});
 material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 understoryLeafUv;').replace('#include <begin_vertex>','#include <begin_vertex>\nunderstoryLeafUv=uv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 understoryLeafUv;').replace('#include <color_fragment>',`#include <color_fragment>
   float mid=abs(understoryLeafUv.y-.5),aa=max(fwidth(mid),.006);
   float vein=1.-smoothstep(.012-aa,.012+aa,mid);
   float branchPhase=fract(understoryLeafUv.x*5.-abs(understoryLeafUv.y-.5)*1.1+step(.5,understoryLeafUv.y)*.42);
   float branchDistance=min(branchPhase,1.-branchPhase),branchAA=max(fwidth(branchPhase),.015);
   float branch=(1.-smoothstep(.018-branchAA,.018+branchAA,branchDistance))*smoothstep(.025,.1,mid)*(1.-smoothstep(.36,.49,mid));
   diffuseColor.rgb*=1.-vein*.22-branch*.10;`);
 };material.customProgramCacheKey=()=> 'greg-understory-leaf-2';return material;
}
function surfaceAt(mesh,y,angle){
 const p=mesh.geometry.attributes.position,ix=mesh.geometry.index;mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox,reach=Math.max(box.max.x-box.min.x,box.max.z-box.min.z)+3;
 const normal=new THREE.Vector3(Math.cos(angle),0,Math.sin(angle)),origin=box.getCenter(new THREE.Vector3()).setY(y).addScaledVector(normal,reach),ray=new THREE.Ray(origin,normal.clone().negate());let found=null,best=Infinity;
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),hit=new THREE.Vector3();
 for(let i=0,n=ix?ix.count:p.count;i<n;i+=3){a.fromBufferAttribute(p,ix?ix.getX(i):i);b.fromBufferAttribute(p,ix?ix.getX(i+1):i+1);c.fromBufferAttribute(p,ix?ix.getX(i+2):i+2);if(ray.intersectTriangle(a,b,c,false,hit)&&hit.distanceToSquared(origin)<best){best=hit.distanceToSquared(origin);found=hit.clone();}}
 return found?{point:found,normal}:null;
}

// Install after the real cliff / route / trunk geometry, and reinstall after V7
// changes tree transforms. Three leaf templates + one rooted-vine batch, no loop.
export function installSwampCoralUnderstory(swamp,{enabled=new URLSearchParams(globalThis.location?.search||'').get('gregUnderstory')!=='0'}={}){
 const inner=swamp.userData.inner||swamp;if(inner.userData.gregUnderstory)return inner.userData.gregUnderstory;if(!enabled)return null;
 const cliff=inner.userData.gregNaturalCliff,constraints=createSwampLivingPathConstraints(inner);if(!cliff?.ok||!constraints)return {ok:false,reason:'actual cliff and three-bank route required'};
 inner.updateWorldMatrix(true,true);const inverse=inner.matrixWorld.clone().invert(),wallAt=createSwampCliffSampler(inner),rockAt=createSwampCliffSampler(inner,cliff.root.getObjectByName('greg-natural-cliff-rock'));
 const root=new THREE.Group();root.name='greg-coral-understory';const instances={fern:[],fan:[],pendant:[]},templates={fern:leafTemplate('fern'),fan:leafTemplate('fan'),pendant:leafTemplate('pendant')},vines=[],records=[],rejected=[];
 const at=(a,y)=>{const hits=[wallAt(a,y),rockAt(a,y)].filter(Boolean).sort((p,q)=>Math.hypot(p.x,p.z)-Math.hypot(q.x,q.z));return hits[0]||null;};
 function plant(type,point,yaw,scale,attachment,matrixOverride=null){
  if(type==='pendant')yaw+=.34*Math.sin(point.y*1.79+point.x*.12+point.z*.08);
  const down=type==='pendant'?scale:0,envelope={position:[point.x,point.y-down,point.z],radius:scale*1.3,height:scale*(type==='pendant'?1.3:1.15)};
  const matrix=matrixOverride||new THREE.Matrix4().compose(point,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(scale,scale,scale));
  if(matrixOverride){
   const p=templates[type].attributes.position,v=new THREE.Vector3();let minY=Infinity,maxY=-Infinity,radius=0;
   for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);radius=Math.max(radius,Math.hypot(v.x-point.x,v.z-point.z));}
   envelope.position[1]=minY-.015;envelope.radius=radius+.02;envelope.height=maxY-minY+.03;
  }
  const clearance=constraints.inspectPlant(envelope);
  if(!clearance.allowed){rejected.push({type,reason:'protected clearance',source:attachment.source,rimSide:attachment.rimSide,cluster:attachment.cluster,reasons:clearance.reasons});return;}
  if(attachment.source==='rim'){
   // The rim patrol / player ribbon is four local units (two world) wide.
   // Inward-facing crowns may overhang the cliff, but never cover that ribbon.
   const p=templates[type].attributes.position,v=new THREE.Vector3();
   for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);const r=Math.hypot(v.x,v.z);if(r>35.4&&r<39.4){rejected.push({type,reason:'rim walking ribbon'});return;}}
  }
  const record={type,position:point.toArray(),scale,envelope,...attachment,matrix};instances[type].push(record);records.push(record);
 }
 // Broad fern / fan groups on the already supported rock shoulders.
 for(const pocket of cliff.pockets){
  const exposed=pocket.frontSamples.slice().sort((a,b)=>b.depth-a.depth).slice(0,4),centre=new THREE.Vector3(...pocket.centre);
  for(let k=0;k<4;k++){
   const point=centre.clone().lerp(new THREE.Vector3(...exposed[k%exposed.length].point),.38+.1*(k%3));point.y=pocket.y+.024;
   const size=1.15+.32*((pocket.id+k)%3);plant(k%3?'fern':'fan',point,Math.atan2(-Math.cos(pocket.angle),-Math.sin(pocket.angle))+(k-1.5)*.23,size,{source:'shoulder',pocket:pocket.id});
  }
 }
 // Three uneven trails per geological band. Dense patches alternate with gaps;
 // the leaf bases are ray-attached to the actual visible stone, not a grid shelf.
 const colonies=[];
 for(const band of cliff.rockBands){
  // A single irregular catchment branches into short overlapping leaf trails.
  // Endpoints differ per band; empty walls remain between whole habitats.
  const strands=2+band.id%3;
  for(let strand=0;strand<strands;strand++){
   const colony={id:`wall-${band.id}-${strand}`,band:band.id,records:[]},count=17+(band.id+strand)%5;
   for(let k=0;k<count;k++){
    const t=.035+.91*k/(count-1),y=40-(40-band.bottom)*t;
    // One rock window in selected streams, rather than a regular gap each row.
    if(strand===0&&band.id%2===0&&k===Math.floor(count*.56))continue;
    const offset=(strand-(strands-1)/2)*band.width*.12;
    const a=band.angle+band.lean*t+offset+Math.sin(t*7+band.id)*.029+Math.sin(t*19+strand)*.008;
    const surface=at(a,y);if(!surface)continue;
    const point=surface.clone().addScaledVector(new THREE.Vector3(-Math.cos(a),0,-Math.sin(a)),.022);
    const size=.9+.63*(.5+.5*Math.sin(t*9+band.id+strand*.8));
    const before=records.length;
    plant('pendant',point,Math.atan2(-Math.cos(a),-Math.sin(a))+.12*Math.sin(t*11+strand),size,{source:'cliff',colony:colony.id,surface:surface.toArray()});
    if(records.length>before)colony.records.push(records.at(-1));
   }
   colonies.push(colony);
  }
 }
 // Redistribute accepted wall plants without changing the species/count.
 // Three uneven catchments replace equal vertical spacing. Retain a plant's
 // original safe root when its new candidate would enter a protected route.
 const habitatRelocations=[];
 for(const colony of colonies){
  const band=cliff.rockBands.find(b=>b.id===colony.band),strand=Number(colony.id.split('-').at(-1));
  if(!band||!colony.records.length)continue;
  for(const [i,r]of colony.records.entries()){
   const u=(i+.35)/(colony.records.length+.1),phase=band.id*1.17+strand*.91;
   const t=u<.48?.065+.30*u/.48:u<.72?.50+.105*(u-.48)/.24:.72+.24*(u-.72)/.28;
   const warped=THREE.MathUtils.clamp(t+.022*Math.sin(phase+i*2.399),.045,.97);
   const y=40-(40-band.bottom)*warped;
   const a=band.angle+band.lean*warped+(strand-1)*band.width*.085+.035*Math.sin(phase+warped*5)+.019*Math.sin(i*2.399+phase);
   const surface=at(a,y);if(!surface)continue;
   const point=surface.clone().addScaledVector(new THREE.Vector3(-Math.cos(a),0,-Math.sin(a)),.022);
   const envelope={...r.envelope,position:[point.x,point.y-r.scale,point.z]};
   if(!constraints.inspectPlant(envelope).allowed)continue;
   const previous=r.position.slice(),yaw=Math.atan2(-Math.cos(a),-Math.sin(a))+.3*Math.sin(i*1.73+phase);
   r.position=point.toArray();r.surface=surface.toArray();r.envelope=envelope;
   r.matrix=new THREE.Matrix4().compose(point,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(r.scale,r.scale,r.scale));
   habitatRelocations.push({colony:colony.id,previous,position:r.position.slice()});
  }
 }
 // Rim crowns emerge from the real solid ground outside the two-world path.
 const rim=inner.userData.gregCoralRim?.walkMeshes?.[0];
 if(rim){
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0).transformDirection(inner.matrixWorld);
  // Seven unequal habitats replace twelve repeated hedge strips. Tall fan
  // accents sit beside low, broad fern mats; whole spans remain bare rock.
  const habitats=[
   {axis:1.04,width:.19,count:6,fan:2.6},
   {axis:1.82,width:.28,count:10,fan:3.9},
   {axis:2.69,width:.34,count:13,fan:3.1},
   {axis:-2.94,width:.13,count:5,fan:2.3},
   {axis:-2.03,width:.29,count:11,fan:4.3},
   {axis:-1.27,width:.24,count:8,fan:2.8},
   {axis:-.56,width:.18,count:7,fan:3.6},
  ];
  for(const [cluster,habitat] of habitats.entries())for(let k=0;k<habitat.count;k++){
   const hero=k===0||k===3,phase=k*2.399+cluster*.7;
   const a=habitat.axis+Math.sin(phase)*habitat.width*(hero?.26:.76),edge=wallAt(a,39.9999);if(!edge)continue;
   const r=Math.hypot(edge.x,edge.z)+.09+(hero?.25:.04+.27*(.5+.5*Math.cos(phase))),point=new THREE.Vector3(Math.cos(a)*r,42,Math.sin(a)*r);ray.set(inner.localToWorld(point.clone()),down);ray.far=3;
   const hit=ray.intersectObject(rim,false)[0];if(!hit)continue;const surface=inner.worldToLocal(hit.point.clone());point.copy(surface).y+=.02;
   const size=hero?habitat.fan*(k===0?1:.69):.9+1.42*(.5+.5*Math.sin(phase*1.19));
   const type=hero?'fan':'fern',yaw=Math.atan2(-Math.cos(a),-Math.sin(a))+(hero?.16:.34)*Math.sin(phase);
   const heightRatio=hero?1.48+.18*Math.sin(cluster):.58+.39*(.5+.5*Math.cos(phase));
   const matrix=new THREE.Matrix4().compose(point,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(size,heightRatio*size,size*(hero?.66:.92)));
   plant(type,point,yaw,size,{source:'rim',cluster,hero,heightRatio,surface:surface.toArray()},matrix);
  }
  // The outer lip was still bare in the actual overview. Each existing habitat
  // gets a small outward-facing crown: a narrow grounded base, broad curved fans,
  // and lower fern skirts. Radial compression leaves the patrol ribbon open;
  // tangential spread gives mass without filling the gaps between habitats.
  for(const [cluster,habitat] of habitats.entries())for(let k=0;k<[5,8,10,5,9,7,8][cluster];k++){
   const hero=k<([5,8,10,5,9,7,8][cluster]>7?3:2),phase=cluster*1.73+k*2.399;
   const baseAngle=habitat.axis+(k===0?-.018:k===1?.026:Math.sin(phase)*habitat.width*.65);
   // Existing bowed roots own their space. Search beside them on the actual
   // outer lip, rather than relaxing the full-crown clearance test.
   for(const shift of [0,.12,-.12,.24,-.24,.36,-.36]){
   const a=baseAngle+shift;
   const r=39.72+.18*(.5+.5*Math.cos(phase)),point=new THREE.Vector3(Math.cos(a)*r,42,Math.sin(a)*r);
   ray.set(inner.localToWorld(point.clone()),down);ray.far=3;
   const hit=ray.intersectObject(rim,false)[0];if(!hit)continue;
   const surface=inner.worldToLocal(hit.point.clone());point.copy(surface).y+=.02;
   const size=hero?(3.3+habitat.fan*.42)*(k===0?1:k===1?.7:.48):1.75+.8*(.5+.5*Math.sin(phase));
   const type=hero?'fan':'fern',yaw=Math.atan2(Math.cos(a),Math.sin(a));
   const heightRatio=hero?(k===0?1.15:k===1?.95:.78):.46+.2*(.5+.5*Math.cos(phase));
   const matrix=new THREE.Matrix4().compose(point,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw),new THREE.Vector3(size,size*heightRatio,hero?3.1:1.15));
   const count=records.length;
   plant(type,point,yaw,size,{source:'rim',rimSide:'outer',cluster,hero,heightRatio,angleAdjustment:shift,surface:surface.toArray()},matrix);
   if(records.length>count)break;
   }
  }
 }
 // Raise selected accepted rim crowns in-place. Horizontal footprint, roots,
 // count and all prior ground support stay exact; only the vertical row of the
 // instance transform changes. A broad upright fan sits above a low fern skirt.
 // Recheck the complete taller envelope against worksite, routes and roots.
 const verticalGrowth=[];
 for(const r of records.filter(r=>r.source==='rim')){
  const h=r.envelope.height,desired=r.type==='fan'?(h>4.5?(9.1+1.1*Math.sin(r.cluster*1.71+.3)**2)/h:1.5+.14*Math.sin(r.cluster*2+.4)**2):(r.scale>1.8?1.24:1);
  if(desired<=1.01)continue;
  const original=r.matrix.clone(),originalEnvelope={...r.envelope,position:r.envelope.position.slice()},p=templates[r.type].attributes.position,v=new THREE.Vector3();let accepted=false;
  for(const factor of [desired,1+(desired-1)*.6,1+(desired-1)*.3]){
   const matrix=original.clone();for(const index of [1,5,9])matrix.elements[index]*=factor;
   let minY=Infinity,maxY=-Infinity,radius=0;
   for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);radius=Math.max(radius,Math.hypot(v.x-r.position[0],v.z-r.position[2]));}
   const envelope={position:[r.position[0],minY-.015,r.position[2]],radius:radius+.02,height:maxY-minY+.03};
   if(maxY>51||!constraints.inspectPlant(envelope).allowed)continue;
   r.matrix=matrix;r.envelope=envelope;r.verticalGrowth={factor,originalMatrix:original,originalEnvelope};verticalGrowth.push({type:r.type,cluster:r.cluster,side:r.rimSide||'inner',position:r.position.slice(),beforeHeight:h,height:envelope.height,factor});accepted=true;break;
  }
  if(!accepted)verticalGrowth.push({type:r.type,cluster:r.cluster,position:r.position.slice(),beforeHeight:h,height:h,factor:1,rejected:'protected taller envelope'});
 }
 // Only a few selected lower trunk sections carry climbing growth. The main
 // underwater roots remain exactly as authored; no vine enters swimming space.
 const trunks=[inner.getObjectByName('world-tree-trunk')].filter(Boolean);
 for(const tree of inner.userData.towerTrees||[]){if(tree.name!=='swamp-towering-tree')continue;const segments=tree.children.filter(o=>o.userData.swampTreePart==='trunk');trunks.push(...segments.slice(0,2));}
 for(const [id,trunk] of trunks.entries()){
  const matrix=inverse.clone().multiply(trunk.matrixWorld);trunk.geometry.computeBoundingBox();const box=trunk.geometry.boundingBox,height=box.max.y-box.min.y;
  for(let strand=0;strand<(id===0?3:1);strand++){
   let previous=null;
   for(let k=0;k<=22;k++){
    const t=.06+.87*k/22,y=box.min.y+height*t,a=id*2.399+strand*2.08+Math.sin(t*4+id)*.35,hit=surfaceAt(trunk,y,a);if(!hit)continue;
    const point=hit.point.clone().addScaledVector(hit.normal,.018).applyMatrix4(matrix);
    if(point.y<27||point.y>53){previous=null;continue;}
    const safe=constraints.inspectPlant({position:point.toArray(),radius:.1,height:.2}).allowed;
    if(!safe){previous=null;continue;}
    if(previous&&point.distanceTo(previous.point)<3)vines.push({a:previous.point.toArray(),b:point.toArray(),source:trunk});
    previous={point};
    if(k%3===0){const size=id===0?1.08:.65,normal=hit.normal.clone().transformDirection(matrix),yaw=Math.atan2(normal.x,normal.z);plant('pendant',point,yaw,size,{source:'trunk',trunk,localSurface:hit.point.toArray()});}
   }
  }
 }
 // The older shoulder/trunk groups still repeated the same leaf scale.
 // Vary only already accepted non-rim plants, using anchored local coordinates.
 // Every axis stays within the original envelope; neither plant count nor
 // path clearance is traded for density. Existing heroes on the rim stay intact.
 const scaleVariation=[];
 const anchoredHash=(r,offset)=>{const n=Math.sin(r.position[0]*1.73+r.position[1]*2.19+r.position[2]*.83+offset)*43758.5453;return n-Math.floor(n);};
 for(const r of records.filter(r=>r.source!=='rim')){
  const h=anchoredHash(r,7.1),factor=h<.28?.66+.12*h/.28:h>.78?.95+.05*(h-.78)/.22:.80+.15*(h-.28)/.50;
  const width=.84+.16*anchoredHash(r,13.7),height=.84+.16*anchoredHash(r,29.3),matrix=r.matrix.clone();
  for(const i of [0,1,2])matrix.elements[i]*=factor*width;
  for(const i of [4,5,6])matrix.elements[i]*=factor*height;
  for(const i of [8,9,10])matrix.elements[i]*=factor;
  const p=templates[r.type].attributes.position,v=new THREE.Vector3();let minY=Infinity,maxY=-Infinity,radius=0;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(matrix);minY=Math.min(minY,v.y);maxY=Math.max(maxY,v.y);radius=Math.max(radius,Math.hypot(v.x-r.position[0],v.z-r.position[2]));}
  const envelope={position:[r.position[0],minY-.015,r.position[2]],radius:radius+.02,height:maxY-minY+.03};
  if(!constraints.inspectPlant(envelope).allowed)continue;
  scaleVariation.push({source:r.source,type:r.type,position:r.position.slice(),beforeScale:r.scale,factor,width,height});
  r.matrix=matrix;r.envelope=envelope;r.scale*=factor;
 }
 // Low eroded stone shoulders belong to the same discontinuous rim habitats.
 // Their full footprint is ray-supported by the unchanged top and stays wholly
 // outside the four-inner-unit walking/tiger ribbon. No new collision surface.
 const rimRocks=[];
 if(rim){
  const rockGeometry=new THREE.SphereGeometry(1,7,4),rp=rockGeometry.attributes.position;
  for(let i=0;i<rp.count;i++){
   const x=rp.getX(i),y=rp.getY(i),z=rp.getZ(i),a=Math.atan2(z,x),cut=.87+.09*Math.sin(a*3+.7);
   rp.setXYZ(i,x*cut,Math.max(0,y)*(.68+.08*Math.sin(a*2))+.06,z*cut);
  }
  rockGeometry.computeVertexNormals();rockGeometry.computeBoundingBox();
  const rockColors=[],cold=new THREE.Color(P.wallShade),soil=new THREE.Color(P.stone);
  for(let i=0;i<rp.count;i++){const c=cold.clone().lerp(soil,THREE.MathUtils.smoothstep(rockGeometry.attributes.normal.getY(i),-.15,.7));rockColors.push(c.r,c.g,c.b);}
  rockGeometry.setAttribute('color',new THREE.Float32BufferAttribute(rockColors,3));
  const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0).transformDirection(inner.matrixWorld),v=new THREE.Vector3();
  for(const r of records.filter(r=>r.source==='rim'&&r.hero))for(let k=0;k<2;k++){
   const a=Math.atan2(r.position[2],r.position[0])+(k?-.028:.033),outer=r.rimSide==='outer',radius=outer?40.02:Math.hypot(r.position[0],r.position[2])+.15;
   const point=new THREE.Vector3(Math.cos(a)*radius,40.012,Math.sin(a)*radius),scale=new THREE.Vector3(.92+.33*Math.sin(r.cluster+1)**2,.52+.45*Math.sin(r.cluster*2+k)**2,.44);
   const matrix=new THREE.Matrix4().compose(point,new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(Math.cos(a),Math.sin(a))),scale);
   let safe=true;
   for(let i=0;i<rp.count;i++){
    v.fromBufferAttribute(rp,i).applyMatrix4(matrix);const radius=Math.hypot(v.x,v.z);
    if(radius>35.4&&radius<39.4||!constraints.inspectPlant({position:v.toArray(),radius:.025,height:.03}).allowed){safe=false;break;}
    ray.set(inner.localToWorld(v.clone().setY(42)),down);ray.far=3;
    if(!ray.intersectObject(rim,false).length){safe=false;break;}
   }
   if(safe)rimRocks.push({matrix,position:point.toArray(),cluster:r.cluster,side:outer?'outer':'inner'});
  }
  templates.rimRock=rockGeometry;
 }
 const meshes=[];
 for(const [type,list] of Object.entries(instances)){
  const geometry=templates[type],mesh=new THREE.InstancedMesh(geometry,leafMaterial(),list.length);mesh.name=`greg-understory-${type}`;
  for(const [i,r] of list.entries()){mesh.setMatrixAt(i,r.matrix);// 2026-10-10 目标图：每丛深浅分明（.78–1.12），并带一点偏暖/偏冷，不再整片一个颜色。
    const v=(type==='fern'?.74:.80)+.32*(.5+.5*Math.sin(i*2.399)),h=Math.sin(i*5.17+1.3);mesh.setColorAt(i,new THREE.Color().setRGB(v*(1+.05*h),v,v*(1-.05*h)));}
  mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();root.add(mesh);meshes.push(mesh);
 }
 const stemGeometry=new THREE.CylinderGeometry(.025,.04,1,5),stems=new THREE.InstancedMesh(stemGeometry,new THREE.MeshBasicMaterial({color:P.foliageShade,toneMapped:false}),vines.length);stems.name='greg-understory-attached-vines';
 for(const [i,segment] of vines.entries()){
  const a=new THREE.Vector3(...segment.a),b=new THREE.Vector3(...segment.b),delta=b.clone().sub(a),matrix=new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(.5),new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),delta.clone().normalize()),new THREE.Vector3(1,delta.length(),1));stems.setMatrixAt(i,matrix);
 }
 stems.instanceMatrix.needsUpdate=true;stems.computeBoundingSphere();root.add(stems);meshes.push(stems);
 if(templates.rimRock){
  const rocks=new THREE.InstancedMesh(templates.rimRock,new THREE.MeshBasicMaterial({vertexColors:true,toneMapped:false}),rimRocks.length);rocks.name='greg-understory-rim-rocks';
  rimRocks.forEach((r,i)=>rocks.setMatrixAt(i,r.matrix));rocks.instanceMatrix.needsUpdate=true;rocks.computeBoundingSphere();root.add(rocks);meshes.push(rocks);
 }
 inner.add(root);
 const angularBins=new Set(),v=new THREE.Vector3();
 for(const r of records.filter(r=>r.source==='rim')){
  const angle=Math.atan2(r.position[2],r.position[0]),p=templates[r.type].attributes.position;let low=Infinity,high=-Infinity;
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(r.matrix);const delta=Math.atan2(Math.sin(Math.atan2(v.z,v.x)-angle),Math.cos(Math.atan2(v.z,v.x)-angle));low=Math.min(low,delta);high=Math.max(high,delta);}
  for(let i=Math.floor((angle+low)/(Math.PI*2)*720);i<=Math.ceil((angle+high)/(Math.PI*2)*720);i++)angularBins.add((i%720+720)%720);
 }
 let disposed=false;const report={ok:true,version:9,root,records,vines,colonies,habitatRelocations,scaleVariation,rejected,rimRocks,verticalGrowth,counts:Object.fromEntries(Object.entries(instances).map(([type,list])=>[type,list.length])),rimAngularCoverage:angularBins.size/720,coverageScope:'projected angular leaf silhouette, not ground coverage or GPU acceptance',drawCalls:meshes.length,triangles:meshes.reduce((sum,m)=>sum+(m.geometry.index?.count||m.geometry.attributes.position.count)/3*m.count,0),dispose(){if(disposed)return;disposed=true;root.removeFromParent();for(const mesh of meshes){mesh.geometry.dispose();mesh.material.dispose();}if(inner.userData.gregUnderstory===report)delete inner.userData.gregUnderstory;}};
 inner.userData.gregUnderstory=report;return report;
}
