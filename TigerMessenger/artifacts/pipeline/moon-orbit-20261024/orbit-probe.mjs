import assert from 'node:assert/strict';
import * as T from 'three';
globalThis.document={createElement(){return {width:0,height:0,getContext(){return {createRadialGradient(){return {addColorStop(){}}},fillRect(){},fillStyle:null}}}}};
const {createMoonOrb,MOON_ORB}=await import('../../../src/world/moonOrb.js');
const {createMoonLakeAncientPine}=await import('../../../src/assets/moonLakeAncientPine.js');
const {createMoonLakeGarden}=await import('../../../src/world/moonLakeGarden.js');
const parent=new T.Group();parent.position.set(40,100,-30);parent.rotation.set(.6,.2,-.4);parent.scale.setScalar(1.1);
const orb=createMoonOrb(parent),initial=orb.group.position.clone(),viewer=new T.Vector3(0,5,25);
orb.update(0,0,viewer);orb.update(45,45,viewer);assert.ok(Math.abs(Math.hypot(orb.group.position.x,orb.group.position.z)-Math.hypot(initial.x,initial.z))<1e-10);assert.ok(orb.group.position.distanceTo(initial)>5);
const quarter=orb.group.position.clone();orb.update(180,135,viewer);assert.ok(Math.hypot(orb.group.position.x-initial.x,orb.group.position.z-initial.z)<1e-10);
const second=createMoonOrb(new T.Group());second.update(0,0,viewer);for(let i=1;i<=90;i++)second.update(i*.5,.5,viewer);assert.ok(second.group.position.distanceTo(quarter)<1e-10);
const ancient=createMoonLakeAncientPine();ancient.position.set(9.3,Math.sqrt(160.6**2-9.3**2-1.5**2)-160.78,1.5);ancient.rotation.y=-.36;parent.add(ancient);const garden=createMoonLakeGarden(parent);
const third=createMoonOrb(parent);const report=third.setOrbitObstacles([ancient,...garden.trees]);assert.equal(report.obstacleCount,5);assert.ok(report.peakHeight<16.2&&report.peakHeight>10);const samples=[];
third.update(0,0,viewer);let previous=third.group.position.clone(),largestStep=0;
for(let i=1;i<=720;i++){third.update(i*.25,.25,viewer);largestStep=Math.max(largestStep,third.group.position.distanceTo(previous));previous.copy(third.group.position);if(i%90===0)samples.push({t:i*.25,position:third.group.position.toArray()});}
assert.ok(largestStep<.3,'no orbit teleports');
third.update(30,.1,viewer);parent.updateMatrixWorld(true);const expected=third.group.position.clone().applyMatrix4(parent.matrixWorld);assert.ok(expected.distanceTo(third.group.getWorldPosition(new T.Vector3()))<1e-10);
const away=new T.Vector3(third.group.position.x-viewer.x,0,third.group.position.z-viewer.z).normalize();const halo=third.glows[0].position.clone().normalize();assert.ok(halo.dot(away)>.999999);
const gx=third.group.position.x,gz=third.group.position.z,dir=new T.Vector3(viewer.x-gx,0,viewer.z-gz).normalize();assert.ok(Math.abs(third.reflect.position.x-(gx*.42+dir.x*MOON_ORB.radius*1.2))<1e-9);assert.ok(Math.abs(third.reflect.position.z-(gz*.42+dir.z*MOON_ORB.radius*1.2))<1e-9);
const vertices=[],inverse=parent.matrixWorld.clone().invert(),relative=new T.Matrix4(),point=new T.Vector3();
for(const tree of [ancient,...garden.trees])tree.traverse(mesh=>{if(!mesh.isMesh)return;relative.multiplyMatrices(inverse,mesh.matrixWorld);const p=mesh.geometry.attributes.position;for(let j=0;j<p.count;j++){point.fromBufferAttribute(p,j).applyMatrix4(relative);vertices.push(point.x,point.y,point.z);}});
let minimumVertexGap=Infinity;
const bodySphereRadius=Math.hypot(MOON_ORB.radius,MOON_ORB.radius*MOON_ORB.depthRatio/2);
for(let i=0;i<=360;i++){third.update(i*.5,.5,viewer);const p=third.group.position;for(let j=0;j<vertices.length;j+=3){const gap=Math.hypot(vertices[j]-p.x,vertices[j+1]-p.y,vertices[j+2]-p.z)-bodySphereRadius;minimumVertexGap=Math.min(minimumVertexGap,gap);}}
assert.ok(minimumVertexGap>.1,'sampled tree vertices remain outside moving moon bounding sphere');
console.log(JSON.stringify({ok:true,minimumVertexGap,clearanceScope:'sampled actual vertices only; triangle interiors and unsampled moments remain approximations',scope:'actual production moon factory + original ancient pine/four new tree factories; CPU only',period:180,initialXZ:[initial.x,initial.z],frameRateIndependent:true,periodicXZ:true,parentSphereTransformPreserved:true,haloUsesCurrentMoon:true,reflectionUsesCurrentMoon:true,report,largestStepPerQuarterSecond:largestStep,samples},null,2));
