import * as THREE from 'three';
import {buildRidgeCloudField} from './ridgeCloudField.js';
import {canopyClearOfConstraints} from './mountainCanopyCandidate.js';

export const MOUNTAIN_CLOUD_BANKS_VERSION = 'citadel-cloud-banks-candidate-7';
// Final castle-chart front clear zones for the fixed r27 target city layout.
export const TARGET_CITY_CLOUD_FRONTS = [
 {name:'old-city-front',min:[-82,-100,-18],max:[-26,140,43]},
 {name:'new-city-front',min:[40,-100,0],max:[106,140,86]},
];
// Connected opaque-ish 3D mist shells, not sprites or an implementation of Oskar's impostors.
export function createMountainCloudBanksCandidate(castle, {
  enabled = false, surfaceIndex = null, protectedBoxes = [], rail = [], radius = 160,
  bounds = {x: [-110, 130], z: [-65, 105]}, maxBanks = 8,
  waterHeight = () => 0, sampleSea = null, timeOfDay = () => .5,
  cityFrontExclusions = TARGET_CITY_CLOUD_FRONTS,
} = {}) {
  const report = {version:MOUNTAIN_CLOUD_BANKS_VERSION, enabled:!!enabled, banks:[], rejected:{unsupported:0,height:0,neighbour:0,clearance:0,cityFront:0,envelope:0}, method:'connected 3D cloud banks traced along final-mesh contours; regular depth occlusion; deterministic bounded drift'};
  if(!enabled)return {group:null,report,update(){},dispose(){}};
  if(!surfaceIndex?.sample)throw new TypeError('Cloud banks require final surfaceIndex');
  if(maxBanks<0||maxBanks>12)throw new RangeError('Cloud bank limit is 12');
  const rearSeaMode=typeof sampleSea==='function';
  castle.updateWorldMatrix(true,false);
  const inverse=castle.matrixWorld.clone().invert(),invLinear=new THREE.Matrix3().setFromMatrix4(inverse),down=new THREE.Vector3(0,-1,0).transformDirection(castle.matrixWorld),ray=new THREE.Ray();
  function sample(x,z){
    const origin=new THREE.Vector3(x,160,z).applyMatrix4(castle.matrixWorld);ray.set(origin,down);
    const hit=surfaceIndex.sample(ray,0,360);
    if(rearSeaMode){const sea=sampleSea(x,z),sy=typeof sea==='number'?sea:sea?.height,terrain=hit?.point.clone().applyMatrix4(inverse),seaValid=Number.isFinite(sy);if(!terrain&&!seaValid)return null;const local=new THREE.Vector3(x,Math.max(terrain?.y??-Infinity,seaValid?sy:-Infinity),z);return{world:local.clone().applyMatrix4(castle.matrixWorld),local,height:local.y,allowed:true,source:terrain&&terrain.y>=sy?hit.object.name:'actual-sea',faceIndex:hit?.faceIndex??null,terrainHit:hit};}
    if(!hit)return null;
    const world=hit.point.clone(),local=world.clone().applyMatrix4(inverse);
    if(world.length()<radius+waterHeight(world)+2)return null;
    return {world,local,height:local.y,allowed:true,source:hit.object.name,faceIndex:hit.faceIndex};
  }
  const field=buildRidgeCloudField(sample,{minX:bounds.x[0],maxX:bounds.x[1],minZ:bounds.z[0],maxZ:bounds.z[1],step:8});
  report.field=field.stats;
  const group=new THREE.Group();group.name='citadel-mountain-cloud-banks-candidate';group.userData.skipColliders=true;group.userData.preserveCitadelMaterials=true;
  const meshes=[],moves=[],materials=[];
  const structureBoxes=[...protectedBoxes];
  report.protectedStructureBoxes=structureBoxes.length;
  const frontBoxes=cityFrontExclusions.map(b=>new THREE.Box3(new THREE.Vector3(...b.min),new THREE.Vector3(...b.max)));
  report.cityFrontExclusions=cityFrontExclusions;
  report.summitCoreExclusions=[{min:[-80,30,-47],max:[-66,75,-32]}];
  for(const b of report.summitCoreExclusions)frontBoxes.push(new THREE.Box3(new THREE.Vector3(...b.min),new THREE.Vector3(...b.max)));
  const drift=7,speed=.7,period=2*drift/speed,clearance=2;let disposed=false;
  // Authored rear-shoulder composition, not independent random cloud scatter.
  const clusters=rearSeaMode?[{id:'old-rear',x:-48,z:-58,quota:2,y:32},{id:'valley-rear',x:-8,z:-76,quota:2,y:22},{id:'new-rear',x:67,z:-60,quota:2,y:26}]:[{id:'old-west-rear',x:-90,z:-44,quota:3},{id:'old-east-rear',x:-35,z:-43,quota:2},{id:'new-rear',x:68,z:-30,quota:3}];
  const queues=clusters.map(cluster=>field.crests.filter(c=>c.z<-16&&Math.hypot(c.x-cluster.x,c.z-cluster.z)<40).map(c=>({...c,cluster:cluster.id,score:Math.hypot(c.x-cluster.x,c.z-cluster.z)+.12*Math.abs(c.z-cluster.z)})).sort((a,b)=>a.score-b.score));
  const candidates=[];for(let i=0;i<Math.max(...queues.map(q=>q.length));i++)for(const q of queues)if(q[i])candidates.push(q[i]);
  if(rearSeaMode){candidates.length=0;for(const depth of[0,10,20,30])for(const cl of clusters)for(const offset of[-15,15])candidates.push({x:cl.x+offset,z:cl.z-depth+(offset>0?-3:3),cluster:cl.id,desiredY:cl.y+(offset>0?2:0)});}
  report.composition={clusters,actualSeaMode:rearSeaMode,kind:'three rear-shoulder groups with depth/height tiers; foreground city exclusions retained'};
  for(const c of candidates){
    if(meshes.length>=maxBanks)break;
    const centre=sample(c.x,c.z);if(!centre){report.rejected.unsupported++;continue;}
    if(report.banks.filter(b=>b.cluster===c.cluster).length>=clusters.find(g=>g.id===c.cluster).quota)continue;
    if(!rearSeaMode&&(centre.height<5||centre.height>45)){report.rejected.height++;continue;}
    if(report.banks.some(b=>(rearSeaMode?Math.hypot(b.local[0]-c.x,b.local[2]-c.z):new THREE.Vector3(...b.anchor).distanceTo(centre.world))<(b.cluster===c.cluster?(rearSeaMode?23:13):(rearSeaMode?10:23)))){report.rejected.neighbour++;continue;}
    const [gx,gz]=field.grad(c.x,c.z),length=Math.hypot(gx,gz),initial=length>.05?new THREE.Vector2(-gz,gx).normalize():new THREE.Vector2(.94,.34).normalize();
    if(initial.x<0)initial.negate();
    function trace(sign){const points=[],p=new THREE.Vector2(c.x,c.z);let previous=initial.clone().multiplyScalar(sign);for(let j=0;j<12;j++){
      const [x,z]=field.grad(p.x,p.y),l=Math.hypot(x,z),t=l>.05?new THREE.Vector2(-z,x).normalize():previous.clone();if(t.dot(previous)<0)t.negate();t.lerp(previous,.65).normalize();p.addScaledVector(t,.82);previous=t;
      const h=sample(p.x,p.y);if(!h||Math.abs(h.height-centre.height)>3)return null;points.push(h);
    }return points;}
    const straight=sign=>{const points=[];for(let j=1;j<=20;j++){const h=sample(c.x+sign*j,c.z+sign*j*.07);if(!h)return null;points.push(h);}return points;};
    const left=rearSeaMode?straight(-1):trace(-1),right=rearSeaMode?straight(1):trace(1);if(!left||!right){report.rejected.unsupported++;continue;}
    const tier=report.banks.filter(b=>b.cluster===c.cluster).length;
    const lobeCount=3+Math.abs(Math.round(c.x*3+c.z*7))%3;
    const lobes=Array.from({length:lobeCount},(_,i)=>({t:(i+.5)/lobeCount,weight:i===Math.floor(lobeCount/2)?1:.65+.18*Math.sin(i*2.3+c.x),width:.13+.025*Math.cos(i+c.z)}));
    const path=[...left.reverse(),centre,...right],positions=[],colors=[],indices=[],warm=new THREE.Color('#fff9ee'),shade=new THREE.Color('#c4dce2');
    for(let j=0;j<path.length;j++){
      const t=j/(path.length-1),envelope=Math.pow(Math.max(.0001,Math.sin(Math.PI*t)),.4),lobe=Math.max(...lobes.map(l=>l.weight*Math.exp(-.5*((t-l.t)/l.width)**2))),up=new THREE.Vector3(0,1,0).transformDirection(castle.matrixWorld);
      const tangent=rearSeaMode?new THREE.Vector3(1,0,.07).transformDirection(castle.matrixWorld):path.at(-1).world.clone().sub(path[0].world).normalize(),side=new THREE.Vector3().crossVectors(tangent,up).normalize();
      // Keep the cloud centreline straight between traced endpoints. Tight contour
      // bends with a 4m cross section can otherwise fold the shell onto itself.
      const base=rearSeaMode?new THREE.Vector3(THREE.MathUtils.lerp(path[0].local.x,path.at(-1).local.x,t),c.desiredY,THREE.MathUtils.lerp(path[0].local.z,path.at(-1).local.z,t)).applyMatrix4(castle.matrixWorld):path[0].world.clone().lerp(path.at(-1).world,t).addScaledVector(up,9.5+tier*1.1);
      for(let k=0;k<14;k++){
        const a=k/14*Math.PI*2,ruffle=1+.045*Math.sin(a*3+t*9),width=(rearSeaMode?4+3*lobe:2.3+2.3*lobe)*envelope*ruffle,height=(rearSeaMode?3.2+4.2*lobe:2.4+3.2*lobe)*envelope*ruffle;
        const p=base.clone().addScaledVector(side,Math.cos(a)*width).addScaledVector(up,Math.sin(a)*height).applyMatrix4(inverse);positions.push(...p.toArray());
        const color=shade.clone().lerp(warm,THREE.MathUtils.smoothstep(Math.sin(a),-.55,.7));colors.push(color.r,color.g,color.b);
        if(j<path.length-1){const n=j*14+k,next=j*14+(k+1)%14;indices.push(n,n+14,next,next,n+14,next+14);}
      }
    }
    // Close the small end rings so view rotation never exposes a hollow strip.
    for(const ring of [0,path.length-1])for(let k=1;k<13;k++){const b=ring*14;indices.push(...(ring===0?[b,b+k,b+k+1]:[b,b+k+1,b+k]));}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geometry.setIndex(indices);geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
    const worldTangent=rearSeaMode?new THREE.Vector3(1,0,.07).transformDirection(castle.matrixWorld):path.at(-1).world.clone().sub(path[0].world).normalize(),move=worldTangent.clone().applyMatrix3(invLinear);
    // Conservative local swept box, checked against the FINAL surface before
    // world protection. Finite 2m samples are not a continuous collision proof.
    const sweepLocal=geometry.boundingBox.clone();
    sweepLocal.union(geometry.boundingBox.clone().translate(move.clone().multiplyScalar(-drift)));
    sweepLocal.union(geometry.boundingBox.clone().translate(move.clone().multiplyScalar(drift)));
    if(frontBoxes.some(b=>b.intersectsBox(sweepLocal))){geometry.dispose();report.rejected.cityFront++;continue;}
    const extent=sweepLocal.getSize(new THREE.Vector3());if(extent.x>(rearSeaMode?60:38)||extent.z>38||extent.y>20){geometry.dispose();report.rejected.envelope++;continue;}
    let highest=-Infinity,supportSamples=0,misses=0;
    const nx=Math.ceil((sweepLocal.max.x-sweepLocal.min.x)/2),nz=Math.ceil((sweepLocal.max.z-sweepLocal.min.z)/2);
    for(let ix=0;ix<=nx;ix++)for(let iz=0;iz<=nz;iz++){
      const h=sample(THREE.MathUtils.lerp(sweepLocal.min.x,sweepLocal.max.x,ix/Math.max(1,nx)),THREE.MathUtils.lerp(sweepLocal.min.z,sweepLocal.max.z,iz/Math.max(1,nz)));
      if(h){highest=Math.max(highest,h.height);if(rearSeaMode&&h.terrainHit){const hit=h.terrainHit,p=hit.object.geometry.attributes.position,m=inverse.clone().multiply(hit.object.matrixWorld);if(hit.instanceId!==undefined){const im=new THREE.Matrix4();hit.object.getMatrixAt(hit.instanceId,im);m.multiply(im);}for(const id of[hit.face.a,hit.face.b,hit.face.c])highest=Math.max(highest,new THREE.Vector3().fromBufferAttribute(p,id).applyMatrix4(m).y);}supportSamples++;}else misses++;
    }
    if(!supportSamples||(rearSeaMode&&misses)){geometry.dispose();report.rejected.unsupported++;continue;}
    const lift=Math.max(0,highest+clearance-sweepLocal.min.y);
    if(lift>(rearSeaMode?5:10)){geometry.dispose();report.rejected.height++;continue;}
    geometry.translate(0,lift,0);geometry.computeBoundingBox();geometry.computeBoundingSphere();sweepLocal.translate(new THREE.Vector3(0,lift,0));
    const swept=sweepLocal.clone().applyMatrix4(castle.matrixWorld);
    if(!canopyClearOfConstraints(swept,structureBoxes,rail,4,6)){geometry.dispose();report.rejected.clearance++;continue;}
    const material=new THREE.MeshBasicMaterial({vertexColors:true,color:0xffffff,transparent:false,alphaHash:true,opacity:1,depthTest:true,depthWrite:true,side:THREE.FrontSide});
    material.userData.preserveCitadelMaterial=true;
    material.customProgramCacheKey=()=>MOUNTAIN_CLOUD_BANKS_VERSION;
    const mesh=new THREE.Mesh(geometry,material);mesh.name='citadel-cloud-bank-'+meshes.length;mesh.renderOrder=6;Object.assign(mesh.userData,{skipColliders:true,skipInkOutline:true,preserveCitadelMaterials:true});group.add(mesh);
    moves.push(move);materials.push(material);meshes.push(mesh);
    report.banks.push({cluster:c.cluster,tier,centreline:rearSeaMode?'rear sea band with horizontal 40m spine; real terrain/sea swept audit':'straight chord of contour endpoints; full swept terrain check retained',lobeCount,lobes,localSweptBounds:{min:sweepLocal.min.toArray(),max:sweepLocal.max.toArray()},anchor:centre.world.toArray(),local:centre.local.toArray(),source:centre.source,faceIndex:centre.faceIndex,path:path.map(p=>({world:p.world.toArray(),source:p.source,faceIndex:p.faceIndex})),sweptBounds:{min:swept.min.toArray(),max:swept.max.toArray()},drift,speed,period,lift,minimumSampledClearance:sweepLocal.min.y-highest,supportSamples,surfaceMisses:misses,clearanceMethod:'entire swept local AABB above maximum final-surface 2m-grid sample; plus sampled-face vertex maxima; not continuous full-world collision',triangles:indices.length/3});
  }
  report.count=meshes.length;report.triangles=report.banks.reduce((s,b)=>s+b.triangles,0);report.drawCalls=meshes.length;group.userData.cloudBankStudy=report;
  function update(time,phase=timeOfDay()){const t=Number.isFinite(time)?time:0,tod=((Number.isFinite(Number(phase))?Number(phase):.5)%1+1)%1,night=THREE.MathUtils.smoothstep(Math.abs(tod-.5),.3,.43);
    if(disposed)return;
    meshes.forEach((m,i)=>{const cycle=((t/period+.2+i*.137)%1+1)%1,offset=-drift+2*drift*cycle,fade=THREE.MathUtils.smoothstep(cycle,0,.035)*(1-THREE.MathUtils.smoothstep(cycle,.965,1));m.position.copy(moves[i]).multiplyScalar(offset);materials[i].opacity=fade;materials[i].color.setRGB(1-.68*night,1-.63*night,1-.53*night);
      const b=report.banks[i],localCenter=m.geometry.boundingBox.getCenter(new THREE.Vector3()).add(m.position),state={time:t,cycle,position:localCenter.toArray(),coordinateSpace:'castle-local',worldPosition:localCenter.clone().applyMatrix4(castle.matrixWorld).toArray(),translation:m.position.toArray(),opacity:materials[i].opacity};if(!b.motionStart)b.motionStart=state;b.motionEnd=state;
    });
    report.fadeMode='depth-writing hashed end fade; opaque middle; night tint not transparency';report.time=t;report.opacity=materials[0]?.opacity??0;
  }
  Object.assign(report,{speed,period,drift,clearance,method:rearSeaMode?'three rear horizon groups of 40m connected cloud banks; actual sea/terrain sampled clearance and short hashed reset':'rounded contour cloud shells; sampled swept-box terrain clearance'});
  update(0);
  const api={group,report,update,dispose(){if(disposed)return;disposed=true;group.removeFromParent();for(const m of meshes)m.geometry.dispose();for(const m of materials)m.dispose();group.clear();report.disposed=true;}};
  group.userData.dispose=api.dispose;group.userData.update=update;
  return api;
}
