import assert from 'node:assert/strict';
import {register} from 'node:module';
import {createHash} from 'node:crypto';
const threeURL=new URL('../../vendor/three.module.js',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(threeURL)},shortCircuit:true};return n(s,c);}`),import.meta.url);
const THREE=await import('three');
const {applyNewCityRidgeCandidate,createCastleOceanSampler,newCityRidgeCandidateOptions,surveyNewCityRidgeAnchors}=await import('../../src/world/citadel/newCityRidgeCandidate.js');
const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z),hash=a=>createHash('sha256').update(new Uint8Array(a.buffer,a.byteOffset,a.byteLength)).digest('hex');
const radius=160,castle=new THREE.Group();castle.position.set(0,radius,0);castle.updateMatrixWorld(true);
const old=new THREE.Mesh(new THREE.BoxGeometry(24,30,70),new THREE.MeshStandardMaterial());old.name='citadel-oskar-grid-mountain-surface';old.position.set(-15,5,-5);castle.add(old);
const city=new THREE.Group();city.name='highland-west-city';castle.add(city);
const dome=new THREE.Mesh(new THREE.SphereGeometry(3,8,6),new THREE.MeshStandardMaterial());dome.material.name='citadel-target-blue-dome';dome.position.set(24,21,4);city.add(dome);
const floor=new THREE.Mesh(new THREE.BoxGeometry(12,1,8),new THREE.MeshStandardMaterial());floor.name='town-terrace-candidate-test-floor';floor.position.set(16,2,0);floor.userData.westCityWalkable=true;castle.add(floor);castle.updateMatrixWorld(true);
const anchors=[{x:-24,z:-9,crestY:19,frontWidth:20,backWidth:17},{x:8,z:-15,crestY:21,frontWidth:20,backWidth:19},{x:34,z:-19,crestY:26,frontWidth:18,backWidth:22},{x:60,z:-11,crestY:17,frontWidth:20,backWidth:17}];
const source=hash(old.geometry.attributes.position.array),sourceIndex=hash(old.geometry.index.array),matrix=old.matrixWorld.toArray();
assert.equal(newCityRidgeCandidateOptions('').enabled,false);assert.equal(newCityRidgeCandidateOptions('?citadelNewCityRidge=0').enabled,false);assert.equal(newCityRidgeCandidateOptions('?citadelNewCityRidge=1').enabled,true);
const childCount=castle.children.length;assert.equal(applyNewCityRidgeCandidate(castle),null);assert.equal(castle.children.length,childCount);
const survey=surveyNewCityRidgeAnchors(castle);assert.equal(survey.blueDome.max[1],24);assert.equal(survey.peakCeilingY,27);assert(survey.anchors.every((a,i)=>i===0||a.x>survey.anchors[i-1].x));
const rail=new THREE.LineCurve3(V(48,165,-8),V(48,165,40));
const opts={enabled:true,radius,anchors,peakCeilingY:27,curves:{red:rail},oceanLevelAt:()=>0,longitudinalSegments:84,crossSegments:40};
const candidate=applyNewCityRidgeCandidate(castle,opts),g=candidate.surfaces[0].geometry,p=g.attributes.position,index=g.index,n=p.count/2;
assert.equal(applyNewCityRidgeCandidate(castle,opts),candidate,'repeat application must not duplicate mesh');assert.equal(hash(old.geometry.attributes.position.array),source);assert.equal(hash(old.geometry.index.array),sourceIndex);assert.deepEqual(old.matrixWorld.toArray(),matrix);
assert(candidate.audit.oldOverlapSamples>0);assert(candidate.audit.minOldOverlapBurial>=.14999);assert(candidate.audit.protectedSamples>0);assert(candidate.audit.railSamples>0);
const edges=new Map(),adj=new Map();let volume=0,minArea=Infinity,minThickness=Infinity,maxY=-Infinity;
for(let i=0;i<index.count;i+=3){const ids=[0,1,2].map(j=>index.getX(i+j)),pts=ids.map(k=>V().fromBufferAttribute(p,k)),cross=pts[1].clone().sub(pts[0]).cross(pts[2].clone().sub(pts[0]));minArea=Math.min(minArea,cross.length()/2);assert(cross.length()>1e-7,'degenerate triangle');volume+=pts[0].dot(pts[1].clone().cross(pts[2]))/6;
 for(let j=0;j<3;j++){const a=ids[j],b=ids[(j+1)%3],k=[a,b].sort((a,b)=>a-b).join(',');if(!edges.has(k))edges.set(k,[]);edges.get(k).push(a<b?1:-1);if(!adj.has(a))adj.set(a,new Set());adj.get(a).add(b);}
 // Top surface is a single-valued terrain chart with positive Y normals.
 if(ids.every(k=>k<n))assert(cross.y>0,'flipped terrain chart');
}
for(const signs of edges.values()){assert.equal(signs.length,2,'open or non-manifold boundary');assert.equal(signs[0]+signs[1],0,'inconsistent oriented edge');}
assert(volume>0);const seen=new Set([0]),todo=[0];while(todo.length)for(const v of adj.get(todo.pop())||[])if(!seen.has(v)){seen.add(v);todo.push(v);}assert.equal(seen.size,p.count,'disconnected solid');
const sea=createCastleOceanSampler(castle.matrixWorld,radius,()=>0);let protectedChecks=0,railChecks=0,seaMaxError=0;
for(let i=0;i<n;i++){
 const point=V().fromBufferAttribute(p,i),bottom=V().fromBufferAttribute(p,i+n),s=sea(point.x,point.z);minThickness=Math.min(minThickness,point.y-bottom.y);maxY=Math.max(maxY,point.y);assert(point.y>bottom.y);assert(point.y<=27+1e-5);
 seaMaxError=Math.max(seaMaxError,Math.abs(castle.localToWorld(V(point.x,s,point.z)).length()-radius));
 if(point.x>=10&&point.x<=22&&point.z>=-4&&point.z<=4){assert(point.y<=s-2.99999);protectedChecks++;}
 if(Math.abs(point.x-48)<12&&point.z>=-8&&point.z<=40){assert(point.y<=Math.max(s-2.99999,5-12));railChecks++;}
}
assert(protectedChecks>0&&railChecks>0);assert(seaMaxError<1e-6);assert(minThickness>8.9999);
// Independent horizontal triangle-box overlap samples prove the protected
// prism has no above-water terrain, not just that metadata claimed masks ran.
let prismProbes=0;const mesh=candidate.surfaces[0];mesh.updateWorldMatrix(true,true);
for(let x=10;x<=22;x+=.5)for(let z=-4;z<=4;z+=.5){const ray=new THREE.Raycaster(castle.localToWorld(V(x,40,z)),V(0,-1,0),0,100);const hit=ray.intersectObject(mesh,false)[0];if(hit){assert(castle.worldToLocal(hit.point.clone()).y<sea(x,z)-2.95);prismProbes++;}}
assert(prismProbes>100);
const fingerprint=hash(p.array);let geometryDisposed=0,materialDisposed=0;g.addEventListener('dispose',()=>geometryDisposed++);mesh.material.addEventListener('dispose',()=>materialDisposed++);candidate.dispose();candidate.dispose();assert.equal(geometryDisposed,1);assert.equal(materialDisposed,1);assert.equal(castle.children.length,childCount);
const repeat=applyNewCityRidgeCandidate(castle,opts);assert.equal(hash(repeat.surfaces[0].geometry.attributes.position.array),fingerprint,'construction not deterministic');repeat.dispose();
// A scene-level horse is outside castle traversal. Test its actual mesh and
// the separately transformed activity reservations, including explicit caller
// objects without accidentally disabling the default bridge/floor protection.
const scene=new THREE.Scene();scene.add(castle);
const horse=new THREE.Group();horse.name='citadel-trojan-horse';horse.position.copy(castle.localToWorld(V(30,10,-15)));horse.add(new THREE.Mesh(new THREE.BoxGeometry(5,8,7),new THREE.MeshStandardMaterial()));scene.add(horse);scene.updateMatrixWorld(true);
city.userData.horseReservation=[30,10,-15];city.userData.statueAnchor=[8,4,-12];
const reserved=applyNewCityRidgeCandidate(castle,{...opts,protectedObjects:[]});assert(reserved.audit.externalHorseMeasured);assert(reserved.audit.protectedReservations.some(r=>r.name==='horseReservation'));assert(reserved.audit.protectedReservations.some(r=>r.name==='statueAnchor'));assert(reserved.audit.protectionFootprints>=4);
for(const [x,z]of [[30,-15],[39,-15],[8,-12],[-3,-12],[16,0]]){
 const hit=new THREE.Raycaster(castle.localToWorld(V(x,40,z)),V(0,-1,0),0,100).intersectObject(reserved.surfaces[0],false)[0];assert(hit);assert(castle.worldToLocal(hit.point.clone()).y<sea(x,z)-2.95,'landmark footprint invaded');
}
reserved.dispose();delete city.userData.horseReservation;delete city.userData.statueAnchor;
// Rotated, translated final-frame ocean intersection. The local frame may be
// tilted relative to radial up after composition; it is not a flat Y=0 sea.
const rotated=new THREE.Matrix4().compose(V(36,146,29),new THREE.Quaternion().setFromEuler(new THREE.Euler(.17,.7,-.18)),V(1,1,1)),curveSea=createCastleOceanSampler(rotated,radius,dir=>.72+.1*dir.x);let tiltedError=0;
for(let x=-30;x<=50;x+=10)for(let z=-40;z<=20;z+=10){const y=curveSea(x,z);assert(y!==null);const w=V(x,y,z).applyMatrix4(rotated),expected=radius+.72+.1*w.clone().normalize().x;tiltedError=Math.max(tiltedError,Math.abs(w.length()-expected));}assert(tiltedError<1e-6);
assert.throws(()=>applyNewCityRidgeCandidate(castle,{...opts,anchors:[anchors[1],anchors[0]]}),/increasing/);
console.log(JSON.stringify({passed:true,sourceUnchanged:true,defaultDisabled:true,deterministic:true,closedOrientedEdges:edges.size,connectedVertices:seen.size,volume,minArea,minThickness,maxY,protectedChecks,railChecks,prismProbes,seaMaxError,tiltedError,candidate:candidate.audit,actualSceneClearanceVerified:false,visualJoinVerified:false},null,2));
// Regression: actual final castle frame from r01, where a rear anchor at z=-73
// missed the curved ocean and used to abort the entire scene load.
const actual=new THREE.Group();actual.matrixAutoUpdate=false;actual.matrix.fromArray([-.5771265090244172,.12463062405961449,.807088718870361,0,.6354855835814281,.689249750214348,.3479839865419536,0,-.5129162364767383,.7137240288626759,-.4769852670498,0,124.43456408079132,72.61606956254715,90.15650671642375,1]);
const actualCity=new THREE.Group();actualCity.name='highland-west-city';actual.add(actualCity);
const realDome=new THREE.Mesh(new THREE.BoxGeometry(92.36596-56.39178,31.42718-7.55036,44.00789-12.87979),new THREE.MeshStandardMaterial());realDome.material.name='citadel-target-blue-dome';realDome.position.set((92.36596+56.39178)/2,(31.42718+7.55036)/2,(44.00789+12.87979)/2);actualCity.add(realDome);actual.updateMatrixWorld(true);
const actualCandidate=applyNewCityRidgeCandidate(actual,{enabled:true});assert(actualCandidate.audit.oceanSamples===3201);assert(actualCandidate.audit.maxCrestY<=34.42719);assert(actualCandidate.surfaces[0].geometry.attributes.position.array.every(Number.isFinite));actualCandidate.dispose();
console.log('Actual tilted castle frame / dome bounds ocean footprint regression passed');

// Rail on the opposite hemisphere must not carve this ridge through an XZ
// projection alone. Compare actual geometry with and without a far-below rail.
const noRail=applyNewCityRidgeCandidate(actual,{enabled:true});const noRailHash=hash(noRail.surfaces[0].geometry.attributes.position.array);noRail.dispose();
const farRail=new THREE.LineCurve3(actual.localToWorld(V(60,-280,-30)),actual.localToWorld(V(90,-280,-30)));
const farCandidate=applyNewCityRidgeCandidate(actual,{enabled:true,curves:{far:farRail}});assert.equal(hash(farCandidate.surfaces[0].geometry.attributes.position.array),noRailHash);farCandidate.dispose();
console.log('Opposite hemisphere railway does not cut terrain; near railway clearance retained');
