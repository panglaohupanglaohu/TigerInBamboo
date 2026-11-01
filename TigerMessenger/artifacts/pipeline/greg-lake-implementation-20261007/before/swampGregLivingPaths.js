import * as THREE from 'three';

// All arguments and reported bounds use swamp INNER-local units. One local unit
// is .5 world units in the shipped placement; never compare these to world Y.
const clamp = (v,a,b)=>Math.max(a,Math.min(b,v));
const interval = (a,b,c,d)=>a<=d&&b>=c;
function nearSegment(position,a,b) {
  const dx=b[0]-a[0],dz=b[2]-a[2],length=dx*dx+dz*dz;
  const t=length?clamp(((position[0]-a[0])*dx+(position[2]-a[2])*dz)/length,0,1):0;
  return {distance:Math.hypot(position[0]-a[0]-t*dx,position[2]-a[2]-t*dz),y:a[1]+t*(b[1]-a[1])};
}
function localBounds(object,swamp,padding=0) {
  object.updateWorldMatrix(true,true);swamp.updateWorldMatrix(true,false);
  const inverse=swamp.matrixWorld.clone().invert(),result=new THREE.Box3();
  object.traverse(part=>{
    if(!part.geometry)return;
    part.geometry.computeBoundingBox();const box=part.geometry.boundingBox;
    if(!box||box.isEmpty())return;
    const relative=inverse.clone().multiply(part.matrixWorld),instance=new THREE.Matrix4();
    for(let i=0;i<(part.isInstancedMesh?part.count:1);i++){
      const matrix=relative.clone();if(part.isInstancedMesh){part.getMatrixAt(i,instance);matrix.multiply(instance);}
      for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])result.expandByPoint(new THREE.Vector3(x,y,z).applyMatrix4(matrix));
    }
  });
  if(result.isEmpty())return null;
  result.expandByScalar(padding);return {min:result.min.toArray(),max:result.max.toArray()};
}

export function createSwampLivingPathConstraints(swamp) {
  const plan=swamp.userData.gregSpatialPlan;
  if(!plan?.route?.length) return null;
  const route=plan.route.map(point=>point.slice()),zones=[];
  // The actual authored stair solids and worksite are protected, not invented
  // replacement positions. Existing actors and their animation stay untouched.
  for(const [i,step] of (swamp.userData.tigerWalkSurfaces||[]).entries()) {
    const bounds=localBounds(step,swamp,.15);if(bounds){bounds.max[1]+=4;zones.push({id:`tiger-stair-${i}`,type:'tiger-route',...bounds});}
  }
  for(const name of ['dock','barge']) {
    const object=swamp.userData.shipyard?.[name],bounds=object&&localBounds(object,swamp,.75);
    if(bounds)zones.push({id:`repair-${name}`,type:'repair-worksite',...bounds});
  }
  swamp.traverse(object=>{
    if(!['v2-floor-root','v2-rim-bowed-root'].includes(object.name))return;
    const bounds=localBounds(object,swamp,.1);if(bounds)zones.push({id:object.uuid,type:'existing-root',...bounds});
  });
  const waterRoute=[];
  // Matches the authored sailPos curve geometrically: its smoothstep only
  // changes speed. Inflate for the ship, oars and escort instead of sampling a
  // single animation pose; the 8-local half-width is deliberately conservative.
  for(let i=0;i<=64;i++){
    const t=i/64,a=1.1-.8*t,r=16+6*t;waterRoute.push([Math.cos(a)*r,25,Math.sin(a)*r]);
  }
  for(let i=1;i<=32;i++){
    const t=i/32,a=.3+.05*t,r=22+9*t;waterRoute.push([Math.cos(a)*r,25+1.3*t,Math.sin(a)*r]);
  }
  const trunk=swamp.getObjectByName('world-tree-trunk');
  const target=trunk?swamp.worldToLocal(trunk.getWorldPosition(new THREE.Vector3())).toArray():[-8,39,-7];
  target[1]=Math.max(target[1],48);
  const views=plan.levels.map(level=>{
    const angle=(level.angleStart+level.angleEnd)/2,r=level.radius/plan.worldScale;
    return {id:`level-${level.id}-tree`,from:[Math.cos(angle)*r,level.innerY+3.2,Math.sin(angle)*r],to:target.slice()};
  });
  function inspectPlant({position,radius,height}) {
    const p=position?.isVector3?position.toArray():position;
    if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)||!Number.isFinite(radius)||radius<0||!Number.isFinite(height)||height<=0)return {allowed:false,reasons:['invalid-envelope']};
    const reasons=new Set();
    for(let i=1;i<route.length;i++){
      const near=nearSegment(p,route[i-1],route[i]);
      if(near.distance<=2.15+radius&&interval(p[1],p[1]+height,near.y-.2,near.y+4))reasons.add('walking-clearance');
    }
    for(const zone of zones){
      const dx=Math.max(zone.min[0]-p[0],0,p[0]-zone.max[0]),dz=Math.max(zone.min[2]-p[2],0,p[2]-zone.max[2]);
      if(Math.hypot(dx,dz)<=radius&&interval(p[1],p[1]+height,zone.min[1],zone.max[1]))reasons.add(zone.type);
    }
    for(let i=1;i<waterRoute.length;i++){
      const near=nearSegment(p,waterRoute[i-1],waterRoute[i]);
      if(near.distance<=8+radius&&interval(p[1],p[1]+height,20,near.y+6))reasons.add('boat-whale-corridor');
    }
    for(const view of views){
      const near=nearSegment(p,view.from,view.to);
      if(near.distance<=1.1+radius&&interval(p[1],p[1]+height,near.y-.6,near.y+.6))reasons.add('tree-landmark-sightline');
    }
    return {allowed:reasons.size===0,reasons:[...reasons]};
  }
  return {version:1,frame:'inner-swamp-local',worldScale:plan.worldScale,clearWidthWorld:4*plan.worldScale,headroomWorld:4*plan.worldScale,route,zones,waterRoute,views,inspectPlant};
}

// Records must bound the entire root/stem/crown, not just the planting point.
// This audit performs no scene mutation and adds no meshes or runtime loop.
export function auditSwampLivingPlants(swamp,records=[]) {
  const constraints=createSwampLivingPathConstraints(swamp);
  if(!constraints)return {ready:false,reason:'no-spatial-plan',checked:0,rejected:[]};
  const rejected=[];
  records.forEach((record,index)=>{const result=constraints.inspectPlant(record);if(!result.allowed)rejected.push({index,id:record.id??index,reasons:result.reasons});});
  return {ready:true,frame:constraints.frame,clearWidthWorld:constraints.clearWidthWorld,headroomWorld:constraints.headroomWorld,checked:records.length,rejected,passed:rejected.length===0};
}
