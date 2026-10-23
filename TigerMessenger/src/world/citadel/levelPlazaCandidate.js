import * as T from 'three';
import {createTargetNewCityPlacement,TARGET_NEW_CITY_ORIGIN,TARGET_NEW_CITY_YAW} from './targetNewCityPlacement.js';
export const LEVEL_PLAZA_VERSION='shared-up-solid-massif-1';
export const LEVEL_PLAZA_POLYGON=[[45,76],[49,69],[65,64],[81,67],[88,76],[83,87],[64,91],[49,87]];
const v=a=>new T.Vector3(...a);
/** Reversible geometry candidate. Deliberately NOT installed in production until
 * the measured rail/plaza elevation conflict has an explicit layout decision. */
export function createCitadelLevelPlazaCandidate({castleMatrix,plazaAnchor=[64,6,78],cityOrigin=TARGET_NEW_CITY_ORIGIN,railCurves={},seaHeightAt=()=>-35}={}){
 if(!castleMatrix?.isMatrix4)throw new TypeError('actual castle frame required');
 const inverse=castleMatrix.clone().invert(),worldAnchor=v(plazaAnchor).applyMatrix4(castleMatrix),upWorld=worldAnchor.clone().normalize(),up=upWorld.clone().transformDirection(inverse);
 const plane=(x,z,anchor)=>anchor[1]-(up.x*(x-anchor[0])+up.z*(z-anchor[2]))/up.y;
 const plazaHeight=(x,z)=>plane(x,z,plazaAnchor),cityHeight=(x,z)=>plane(x,z,cityOrigin);
 const q=new T.Quaternion().setFromUnitVectors(v([0,1,0]),up).multiply(new T.Quaternion().setFromAxisAngle(v([0,1,0]),TARGET_NEW_CITY_YAW));
 const placement=new T.Matrix4().compose(v(cityOrigin),q,v([1,1,1]));
 const top=v([0,.3,15.5]).applyMatrix4(placement),bottom=v([56,plazaHeight(56,76),76]);
 const delta=bottom.clone().sub(top),side=new T.Vector3().crossVectors(delta,up).normalize(),width=6.2;
 const root=new T.Group();root.name='citadel-level-plaza-candidate';root.userData.candidateOnly=true;
 const owned=[],materials=[new T.MeshStandardMaterial({color:'#ddd2b3',roughness:.94,side:T.DoubleSide}),new T.MeshStandardMaterial({color:'#a6a092',roughness:1,side:T.DoubleSide})];
 const quad=(positions,a,b,c,d)=>{for(const p of[a,c,b,a,d,c])positions.push(...p.toArray());};
 function solid(name,polygon,height,material){const positions=[],topPoints=polygon.map(([x,z])=>v([x,height(x,z),z])),center=topPoints.reduce((a,p)=>a.add(p),new T.Vector3()).multiplyScalar(1/topPoints.length);center.y=height(center.x,center.z);for(let i=0;i<polygon.length;i++){const a=topPoints[i],b=topPoints[(i+1)%polygon.length],A=v([a.x,seaHeightAt(a.x,a.z)-2,a.z]),B=v([b.x,seaHeightAt(b.x,b.z)-2,b.z]);positions.push(...center.toArray(),...b.toArray(),...a.toArray());quad(positions,a,b,B,A);}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.computeVertexNormals();owned.push(g);const m=new T.Mesh(g,material);m.name=name;m.castShadow=m.receiveShadow=true;m.userData.targetWalkable=true;root.add(m);return m;}
 const plaza=solid('candidate-level-plaza-solid-ground',LEVEL_PLAZA_POLYGON,plazaHeight,materials[0]);
 const upperPolygon=[[-24,-25],[24,-25],[24,0],[24,15.5],[24,28],[24,40],[-24,40],[-24,28],[-24,15.5],[-24,0]].map(([x,z])=>{const p=v([x,0,z]).applyMatrix4(placement);return[p.x,p.z];});
 const cityInverse=placement.clone().invert();
 const mountainHeight=(x,z)=>{const local=v([x,cityHeight(x,z),z]).applyMatrix4(cityInverse);return T.MathUtils.lerp(cityHeight(x,z),plazaHeight(x,z),T.MathUtils.smoothstep(local.z,15.5,40));};
 const city=solid('candidate-city-continuous-rock-bearing-massif',upperPolygon,mountainHeight,materials[1]);
 // One solid straight ascent; no folded return stair, towers or skinny piers.
 const rampPositions=[],corners=[top.clone().addScaledVector(side,width/2),top.clone().addScaledVector(side,-width/2),bottom.clone().addScaledVector(side,-width/2),bottom.clone().addScaledVector(side,width/2)];quad(rampPositions,...corners);for(let i=0;i<4;i++){const a=corners[i],b=corners[(i+1)%4],A=v([a.x,seaHeightAt(a.x,a.z)-2,a.z]),B=v([b.x,seaHeightAt(b.x,b.z)-2,b.z]);quad(rampPositions,a,b,B,A);}const rampGeo=new T.BufferGeometry();rampGeo.setAttribute('position',new T.Float32BufferAttribute(rampPositions,3));rampGeo.computeVertexNormals();owned.push(rampGeo);const ramp=new T.Mesh(rampGeo,materials[0]);ramp.name='candidate-single-solid-processional-ramp';ramp.userData.targetWalkable=true;root.add(ramp);
 const rail=[];for(const [lane,curve]of Object.entries(railCurves)){let nearest=null;for(let i=0;i<=5000;i++){const p=curve.getPointAt(i/5000),d=p.clone().sub(worldAnchor),height=d.dot(upWorld),distance=d.clone().addScaledVector(upWorld,-height).length();if(p.dot(worldAnchor)<=0)continue;if(!nearest||distance<nearest.tangentDistance)nearest={lane,u:i/5000,world:p.toArray(),castle:p.clone().applyMatrix4(inverse).toArray(),heightAbovePlaza:height,tangentDistance:distance};}if(nearest)rail.push(nearest);}
 const tangentLength=delta.clone().addScaledVector(up,-delta.dot(up)).length();
 const report={version:LEVEL_PLAZA_VERSION,castleMatrix:castleMatrix.toArray(),installed:false,productionChanged:false,plazaAnchor:[...plazaAnchor],cityOrigin:[...cityOrigin],upCastle:up.toArray(),upWorld:upWorld.toArray(),cityPlacement:placement.toArray(),plazaPolygon:LEVEL_PLAZA_POLYGON,upperPolygon,sourceCityPlacement:createTargetNewCityPlacement(castleMatrix).report,plazaLevelResidual:Math.max(...LEVEL_PLAZA_POLYGON.map(([x,z])=>Math.abs(v([x,plazaHeight(x,z),z]).sub(v(plazaAnchor)).dot(up)))),singleRamp:{start:top.toArray(),end:bottom.toArray(),width,tangentLength,rise:Math.abs(delta.dot(up)),slope:Math.abs(delta.dot(up))/tangentLength},rail,railChanged:false,limitations:['Candidate retains city origin and raises plaza castle-chart 3 to 6. This does NOT solve the separately measured roughly 15 m rail height conflict.','Solid support is a macro massing experiment; production rail clearance and slope clipping remain unverified.','Existing city builders, story actors and path providers are not replaced by creating this candidate.']};
 root.userData.levelPlazaReport=report;let disposed=false;return{group:root,report,plaza,city,ramp,placement,plazaHeight,cityHeight,dispose(){if(disposed)return;disposed=true;root.removeFromParent();owned.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}

/** Computes an opt-in proposal from the REAL local railway. Does not mutate it.
 * The chosen red lane is the inner line nearest the plaza, not the far-side loop. */
export function fitCitadelPlazaOptionsToRail({castleMatrix,railCurves,plazaAnchor=[64,6,78],cityOrigin=[...TARGET_NEW_CITY_ORIGIN],lane='red'}={}){
 let anchor=[...plazaAnchor],origin=[...cityOrigin],before=null,after=null;
 for(let i=0;i<5;i++){
  const candidate=createCitadelLevelPlazaCandidate({castleMatrix,plazaAnchor:anchor,cityOrigin:origin,railCurves});
  const nearest=candidate.report.rail.find(r=>r.lane===lane);if(!nearest){candidate.dispose();throw new Error('chosen production rail missing');}
  if(!before)before=structuredClone(candidate.report);after=structuredClone(candidate.report);
  const upWorld=v(after.upWorld),chartUp=v([0,1,0]).transformDirection(castleMatrix),shift=nearest.heightAbovePlaza/chartUp.dot(upWorld);
  candidate.dispose();if(Math.abs(nearest.heightAbovePlaza)<.01)break;
  anchor[1]+=shift;origin[1]+=shift;
 }
 return{plazaAnchor:anchor,cityOrigin:origin,report:{version:'nearest-inner-rail-level-fit-1',before,after,chosenLane:lane,plazaChartShift:anchor[1]-plazaAnchor[1],cityChartShift:origin[1]-cityOrigin[1],railChanged:false,requiresUserLayoutDecision:true}};
}

/** Finite envelope probe only; not a continuous train sweep certificate. */
export function probeCitadelPlazaRailClearance(candidate,{castleMatrix,railCurves,samples=1000,width=3.49,height=5.36}={}){
 const ray=new T.Raycaster(),up=new T.Vector3(),side=new T.Vector3(),tangent=new T.Vector3(),point=new T.Vector3(),hits=[];
 candidate.group.matrixAutoUpdate=false;candidate.group.matrix.copy(castleMatrix);candidate.group.updateMatrixWorld(true);
 let tested=0;for(const [lane,curve]of Object.entries(railCurves))for(let i=0;i<=samples;i++){
  const center=curve.getPointAt(i/samples);up.copy(center).normalize();tangent.copy(curve.getTangentAt(i/samples)).normalize();side.crossVectors(tangent,up).normalize();
  for(const sx of[-width,0,width])for(const y of[.12,height*.5,height]){
   point.copy(center).addScaledVector(side,sx).addScaledVector(up,y);ray.set(point.clone().addScaledVector(up,100),up.clone().negate());ray.far=180;tested++;
   const hit=ray.intersectObjects(candidate.group.children,false)[0];if(!hit)continue;const signed=hit.point.clone().sub(point).dot(up);if(signed>.02&&signed<80&&hits.length<100)hits.push({lane,u:i/samples,side:sx,height:y,signed,mesh:hit.object.name});
  }
 }
 candidate.group.matrix.identity();candidate.group.matrixAutoUpdate=true;candidate.group.updateMatrixWorld(true);
 return{samplesPerLane:samples+1,tested,storedHits:hits.length,hits,finiteProbe:true,continuousSweepVerified:false};
}
