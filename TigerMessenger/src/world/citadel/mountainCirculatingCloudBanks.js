import * as THREE from 'three';
import {canopyClearOfConstraints} from './mountainCanopyCandidate.js';

// Stable profiles borrow steam's independent timing, not its translucent rendering.
const CLOUD_FORMS=[
 {name:'broad low bank',length:.98,rate:.048,phase:0,base:.54,towers:[[-4.7,2.8,1.2,2.4],[-2.2,2.9,2.0,3.3],[1.1,3.1,2.15,3.6],[4.6,2.7,1.35,2.6]]},
 {name:'high rising tower',length:.81,rate:.069,phase:1.7,base:.72,towers:[[-4.6,2.9,1.45,2.2],[-2.1,2.9,2.6,2.9],[.7,3.2,3.22,3.1],[4.3,2.9,1.7,2.3]]},
 {name:'left crest trailing tail',length:1,rate:.056,phase:3.1,base:.5,towers:[[-4.7,2.9,2.7,3.1],[-2,2.9,3.0,3.5],[1.3,3.1,1.85,2.7],[4.6,2.7,1.02,1.9]]},
 {name:'double tier cloud',length:.94,rate:.077,phase:4.4,base:.76,towers:[[-4.5,3.1,1.55,2.4],[-2,2.8,2.9,3.4],[1.1,2.7,1.9,2.8],[4.3,3.1,2.65,3.05]]},
 {name:'thin elongated shelf',length:1,rate:.043,phase:5.6,base:.4,towers:[[-4.8,2.7,1.1,2.05],[-2.4,2.8,1.6,2.6],[.8,3.2,1.25,2.5],[4.6,2.8,1.6,2.15]]},
 {name:'right crest folded cloud',length:.88,rate:.061,phase:7.2,base:.65,towers:[[-4.6,2.9,1.2,2.1],[-2.1,3,1.8,2.9],[1.2,3.1,3.05,3.5],[4.4,2.9,2.5,2.8]]}
];
// Project implementation: connected opaque shells, not Oskar's impostor renderer.
// Linear route segments and a fixed maximum morph envelope make all intermediate
// positions subject to the same swept clearance audit as their endpoints.
export function createMountainCirculatingCloudBanks(castle,{surfaceIndex,sampleSea,protectedBoxes=[],protectedLocalBoxes=null,rail=[],maxBanks=6,timeOfDay=()=>.5}={}) {
 if(!surfaceIndex?.sample)throw new TypeError('circulating clouds require actual final terrain');
 if(typeof sampleSea!=='function')throw new TypeError('circulating clouds require actual sea');
 castle.updateWorldMatrix(true,false);
 const C=castle.matrixWorld.clone(),inverse=C.clone().invert(),down=new THREE.Vector3(0,-1,0).transformDirection(C);
 const envelope=new THREE.Vector3(7.5,3.6,4),clearance=2,step=2.5,stations=96;
 const report={version:'citadel-circulating-clouds-2',shape:'six independent opaque cloud forms; changing turrets, shallow blue-grey bases; no steam sprites',enabled:true,banks:[],routes:[],rejected:[],protectedStructureBoxes:protectedBoxes.length,actualRailSampleCount:rail.length,method:'closed low mountain orbits; linear swept segments; bounded animated connected shells',clearanceMethod:'maximum morph envelope, 2.5m terrain/sea grid; conservative world AABB building and rail checks; finite terrain sampling, not exact continuous terrain proof',gpuVerified:false};
 const group=new THREE.Group();group.name='citadel-mountain-cloud-banks-candidate';Object.assign(group.userData,{skipColliders:true,skipInkOutline:true,preserveCitadelMaterials:true});
 const chartConstraints=Array.isArray(protectedLocalBoxes),constraintBoxes=chartConstraints?protectedLocalBoxes:protectedBoxes,constraintRail=chartConstraints?rail.map(p=>p.clone().applyMatrix4(inverse)):rail;
 report.constraintFrame=chartConstraints?'direct castle-chart mesh bounds and actual transformed rails':'world-space supplied bounds';
 const cache=new Map(),ray=new THREE.Ray(),meshes=[],geometries=[],materials=[];let disposed=false,lastMorph=-Infinity;
 function height(x,z){const key=x.toFixed(4)+','+z.toFixed(4);if(cache.has(key))return cache.get(key);ray.set(new THREE.Vector3(x,180,z).applyMatrix4(C),down);const hit=surfaceIndex.sample(ray,0,500),sea=sampleSea(x,z),sy=typeof sea==='number'?sea:sea?.height,y=Math.max(hit?.point.clone().applyMatrix4(inverse).y??-Infinity,Number.isFinite(sy)?sy:-Infinity);cache.set(key,y);return y;}
 function swept(a,b){return new THREE.Box3().setFromPoints([a,b]).expandByVector(envelope);}
 function terrainTop(box){let highest=-Infinity,missing=0;const nx=Math.ceil((box.max.x-box.min.x)/step),nz=Math.ceil((box.max.z-box.min.z)/step);for(let x=0;x<=nx;x++)for(let z=0;z<=nz;z++){const h=height(THREE.MathUtils.lerp(box.min.x,box.max.x,x/nx),THREE.MathUtils.lerp(box.min.z,box.max.z,z/nz));if(!Number.isFinite(h))missing++;else highest=Math.max(highest,h);}return{highest,missing};}
 function clear(a,b){const box=swept(a,b);return canopyClearOfConstraints(chartConstraints?box:box.applyMatrix4(C),constraintBoxes,constraintRail,1.5,6);}
 const plans=[{id:'old-city-circuit',center:[-55,9],radii:[45,48],period:280},{id:'new-city-circuit',center:[74,33],radii:[44,53],period:300}];
 for(const plan of plans){
  const points=Array.from({length:stations},(_,i)=>{const a=i/stations*Math.PI*2;return new THREE.Vector3(plan.center[0]+plan.radii[0]*Math.cos(a),0,plan.center[1]+plan.radii[1]*Math.sin(a));});
  const required=[],misses=[];
  for(let i=0;i<stations;i++){const top=terrainTop(swept(points[i],points[(i+1)%stations]));required[i]=top.highest+envelope.y+clearance;if(top.missing)misses.push(i);}
  if(misses.length){report.rejected.push({id:plan.id,reason:'actual-surface-missing',segments:misses});continue;}
  for(let i=0;i<stations;i++)points[i].y=Math.max(required[i],required[(i+stations-1)%stations]);
  // Solve altitude only once. Buildings and tracks retain priority; upward
  // smoothing cannot recreate a terrain collision, but is re-audited below.
  for(let pass=0;pass<4;pass++){
   for(let i=0;i<stations;i++){const a=points[i],b=points[(i+1)%stations];let lift=0;while(!clear(a,b)&&lift<100){a.y++;b.y++;lift++;}}
   for(let n=0;n<stations;n++)for(let i=0;i<stations;i++)for(const j of[(i+1)%stations,(i+stations-1)%stations]){const distance=Math.hypot(points[i].x-points[j].x,points[i].z-points[j].z);points[i].y=Math.max(points[i].y,points[j].y-distance*.65);}
  }
  // Upward propagation is a safe initial solution, not the desired altitude.
  // Relax back down while testing BOTH incident sweeps. This removes excess
  // height from conservative neighbouring AABBs without cutting a single route.
  for(let pass=0;pass<12;pass++)for(let i=0;i<stations;i++){
   const point=points[i],previous=points[(i+stations-1)%stations],next=points[(i+1)%stations];
   const floor=Math.max(required[i],required[(i+stations-1)%stations],previous.y-Math.hypot(point.x-previous.x,point.z-previous.z)*.9,next.y-Math.hypot(point.x-next.x,point.z-next.z)*.9);
   const original=point.y;if(original-floor<.2)continue;point.y=floor;
   if(!clear(previous,point)||!clear(point,next)){let lo=floor,hi=original;for(let n=0;n<8;n++){point.y=(lo+hi)/2;if(clear(previous,point)&&clear(point,next))hi=point.y;else lo=point.y;}point.y=hi;}
  }
  const unsafe=[];for(let i=0;i<stations;i++)if(!clear(points[i],points[(i+1)%stations]))unsafe.push(i);
  if(unsafe.length){report.rejected.push({id:plan.id,reason:'swept-structure-clearance',segments:unsafe});continue;}
  const route={...plan,terrainRequiredAltitude:required,points:points.map(p=>p.toArray()),maximumAltitude:Math.max(...points.map(p=>p.y)),minimumAltitude:Math.min(...points.map(p=>p.y)),frontStationCount:points.filter(p=>p.z>plan.center[1]+plan.radii[1]*.5).length,minimumSampledTerrainClearance:Math.min(...points.map((p,i)=>Math.min(p.y,points[(i+1)%stations].y)-required[i]+clearance)),fullLoopClear:true};report.routes.push(route);
  for(let j=0;j<3&&meshes.length<Math.min(6,maxBanks);j++){
   const seed=meshes.length*.73,geometry=new THREE.BufferGeometry(),ring=20,sections=37,positions=new Float32Array(ring*sections*3),colors=new Float32Array(positions.length),indices=[];
   for(let n=0;n<sections-1;n++)for(let k=0;k<ring;k++){const a=n*ring+k,b=n*ring+(k+1)%ring,c=(n+1)*ring+k,d=(n+1)*ring+(k+1)%ring;indices.push(a,c,b,b,c,d);}
   geometry.setAttribute('position',new THREE.BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setIndex(indices);
   const material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0,emissive:0xcadce2,emissiveIntensity:.16,depthWrite:true,transparent:false});material.userData.preserveCitadelMaterial=true;
   const mesh=new THREE.Mesh(geometry,material);mesh.name='citadel-orbit-cloud-'+meshes.length;Object.assign(mesh.userData,{skipColliders:true,skipInkOutline:true,preserveCitadelMaterials:true});group.add(mesh);
   const form=CLOUD_FORMS[meshes.length%CLOUD_FORMS.length],bank={shape:form.name,shapeRate:form.rate,shapePhase:form.phase,route:plan.id,phase:j/3,period:plan.period,maximumMorphHalfExtent:envelope.toArray(),triangles:indices.length/3,motionStart:null,motionEnd:null};report.banks.push(bank);meshes.push({mesh,geometry,material,points,bank,seed,ring,sections,form});geometries.push(geometry);materials.push(material);
  }
 }
 function morph(item,t){
  const {geometry,seed,ring,sections,form}=item,p=geometry.attributes.position,c=geometry.attributes.color;
  // Unequal overlapping towers grow from one shallow base. Original three
  // identical, vertically symmetric ellipses read as a row of white capsules.
  const towers=form.towers,clock=t*form.rate+form.phase;
  for(let n=0;n<sections;n++){
   const x=-7.5+15*n/(sections-1);let top=0,width=0,body=0;
   for(let j=0;j<towers.length;j++){
    const [center,length,height,depth]=towers[j],cx=center+Math.sin(clock+seed+j*1.7)*.45;
    const profile=Math.sqrt(Math.max(0,1-((x-cx)/length)**2));
    top=Math.max(top,profile*(height*(1+.07*Math.sin(clock*.83+seed+j*2.1))));
    width=Math.max(width,profile*depth*(.94+.06*Math.sin(clock*.7+j+seed)));body=Math.max(body,profile);
   }
   const end=Math.pow(Math.max(0,Math.sin(Math.PI*n/(sections-1))),.14);
   top*=end;width*=end;
   for(let k=0;k<ring;k++){
    const a=k/ring*Math.PI*2,sine=Math.sin(a),cosine=Math.cos(a);
    const edge=1+.035*Math.sin(a*5+x*.7+seed)*Math.sin(a*2+seed);
    const y=sine>=0?sine*top:-Math.pow(-sine,.42)*(form.base+.10*Math.sin(x*.6+seed+clock*.3))*body*end;
    const z=cosine*width*edge,i=n*ring+k;
    p.setXYZ(i,x*form.length,y,z);
    const lit=THREE.MathUtils.smoothstep(sine,-.28,.65);
    // Warm white sunlit tops; a coloured underside gives depth without a rim.
    c.setXYZ(i,THREE.MathUtils.lerp(.61,.97,lit),THREE.MathUtils.lerp(.72,.97,lit),THREE.MathUtils.lerp(.79,.94,lit));
   }
  }
  p.needsUpdate=true;c.needsUpdate=true;geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();item.bank.shapeSample=Array.from(p.array.slice(9*ring*3,9*ring*3+9));
 }
 function update(seconds=0,phase=timeOfDay()){if(disposed)return;const t=Number.isFinite(seconds)?seconds:0,tod=((Number(phase)||0)%1+1)%1,night=THREE.MathUtils.smoothstep(Math.abs(tod-.5),.3,.43),shapeDue=Math.abs(t-lastMorph)>=.1;
  for(const item of meshes){const {mesh,points,bank}=item,cycle=((t/bank.period+bank.phase)%1+1)%1,index=cycle*stations,n=Math.floor(index);mesh.position.copy(points[n]).lerp(points[(n+1)%stations],index-n);item.material.color.setRGB(1-.68*night,1-.63*night,1-.53*night);if(shapeDue)morph(item,t);const state={time:t,cycle,position:mesh.position.toArray(),worldPosition:mesh.position.clone().applyMatrix4(C).toArray()};if(!bank.motionStart)bank.motionStart=state;bank.motionEnd=state;}
  if(shapeDue)lastMorph=t;report.time=t;
 }
 report.count=meshes.length;report.drawCalls=meshes.length;report.triangles=report.banks.reduce((n,b)=>n+b.triangles,0);report.terrainSampleCount=cache.size;report.fadeMode='opaque depth-writing shells; no fade reset';group.userData.cloudBankStudy=report;
 function dispose(){if(disposed)return;disposed=true;group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());group.clear();report.disposed=true;}
 Object.assign(group.userData,{update,dispose});update(0);return{group,report,update,dispose};
}
