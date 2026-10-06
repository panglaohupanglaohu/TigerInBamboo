import * as T from 'three';
import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {actualUserMarkedStructureFixture} from '../../tests/world/targetUserMarkedStructure.fixture.mjs';
import {createTargetUserMarkedProductionRelease} from '../../src/world/citadel/targetUserMarkedProductionRelease.js';
import {createTargetEastGlobalCrossingCandidate} from '../../src/world/citadel/targetEastGlobalCrossingCandidate.js';
import {createTargetEastCliffProductionRelease} from '../../src/world/citadel/targetEastCliffProductionRelease.js';
import {createTargetCliffTransitStructure} from '../../src/world/citadel/targetCliffTransitStructure.js';
import {createTargetCityDetailCandidate} from '../../src/world/citadel/targetCityDetailCandidate.js';
import {createTargetCityPlayerSupport} from '../../src/world/citadel/targetCityPlayerSupport.js';
import {buildMountainSurfaceIndex} from '../../src/world/citadel/mountainSurfaceIndex.js';
const ROOT=new URL('../../',import.meta.url),read=path=>JSON.parse(fs.readFileSync(new URL(path,ROOT)));
const stats=root=>{let meshes=0,triangles=0,instances=0;const materials=new Set();root.traverse(o=>{if(o.isMesh){meshes++;instances+=o.isInstancedMesh?o.count:1;triangles+=(o.geometry.index?.count??o.geometry.attributes.position.count)/3*(o.isInstancedMesh?o.count:1);for(const m of(Array.isArray(o.material)?o.material:[o.material]))materials.add(m);}});return{meshes,instances,triangles,materials:materials.size};};
function auditFullGlobalAgainstCity(root,curves){
 const records=[];root.updateMatrixWorld(true);root.traverse(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position,idx=mesh.geometry.index;for(let n=0;n<(mesh.isInstancedMesh?mesh.count:1);n++){const world=mesh.matrixWorld.clone();if(mesh.isInstancedMesh){const m=new T.Matrix4();mesh.getMatrixAt(n,m);world.multiply(m);}const tris=[],bounds=new T.Box3();for(let i=0;i<(idx?.count??p.count);i+=3){const pts=[0,1,2].map(j=>new T.Vector3().fromBufferAttribute(p,idx?idx.getX(i+j):i+j).applyMatrix4(world)),box=new T.Box3().setFromPoints(pts);tris.push({points:pts,box});bounds.union(box);}records.push({name:mesh.name,bounds,tris});}});
 const body=new T.Box3(new T.Vector3(-2.35,-.136,-3.59),new T.Vector3(2.35,5.71,3.59)),out={poses:0,triangleTests:0,contacts:[],scope:'All final-global red/blue versus rebuilt city structure actual world triangles; finite .5m OBBs, not unrelated retained global structures.'};
 for(const lane of['red','blue']){const c=curves[lane],n=Math.ceil(c.getLength()/.5);for(let i=0;i<=n;i++){out.poses++;const u=i/n,p=c.getPointAt(u),t=c.getTangentAt(u).normalize(),r=p.clone().normalize().cross(t).normalize(),up=t.clone().cross(r).normalize(),pose=new T.Matrix4().makeBasis(r,up,t).setPosition(p),inv=pose.clone().invert(),bb=body.clone().applyMatrix4(pose);for(const mesh of records){if(!bb.intersectsBox(mesh.bounds))continue;for(const tri of mesh.tris){if(!bb.intersectsBox(tri.box))continue;out.triangleTests++;if(body.intersectsTriangle(new T.Triangle(...tri.points.map(p=>p.clone().applyMatrix4(inv))))){out.contacts.push({lane,u,mesh:mesh.name,world:p.toArray()});break;}}}}}return out;
}
export function auditGlobalCrossingStructure({artifactFile='remesh-final-surface-geometry.json',newShorePierWidth=1.05}={}){
 const f=actualUserMarkedStructureFixture(),artifact=read('artifacts/pipeline/citadel-east-shore-route-20261006/'+artifactFile),audit=read('artifacts/pipeline/citadel-east-shore-route-20261006/remesh-expanded-shift-audit.json');
 const retainedRelease=createTargetUserMarkedProductionRelease({sourceCurves:f.sourceCurves}),east=createTargetEastCliffProductionRelease({enabled:true,sourceCurves:f.sourceCurves,retainedRelease,candidateInput:audit.candidateInput,terrainArtifact:artifact,cityGalleryScope:true}),prepared=createTargetEastGlobalCrossingCandidate({enabled:true,release:east.release,sourceCurves:f.sourceCurves,sourceExtensionMetres:50,startMetres:10,endMetres:300,frontLoadedGrade:.0395,independentRadialProfiles:true,tailGrade:-.004});if(!prepared.release)throw new Error('Crossing shape rejected');
 const matrix=f.castle.matrixWorld.clone(),inverse=matrix.clone().invert(),down=new T.Vector3(0,-1,0).transformDirection(matrix);
 // Read the advisor's existing artifact only. No remeshing, refinement or
 // terrain mutation. This is the actual final refined artifact epoch, read-only.
 const geometry=new T.BufferGeometryLoader().parse(artifact.geometry),mat=new T.MeshBasicMaterial({side:T.DoubleSide}),terrain=new T.Mesh(geometry,mat);terrain.name='cpu-advisor-final-refined-artifact';terrain.position.fromArray(artifact.origin);f.castle.add(terrain);f.scene.updateMatrixWorld(true);
 const terrainIndex=buildMountainSurfaceIndex([terrain]),seaIndex=buildMountainSurfaceIndex([f.ocean]),planet=f.scene.getObjectByName('planet-surface'),foundationIndex=buildMountainSurfaceIndex([terrain,...(planet?[planet]:[])]);
 const sampler=index=>(x,z)=>{const hit=index.sample(new T.Ray(new T.Vector3(x,250,z).applyMatrix4(matrix),down),0,900);return hit?hit.point.clone().applyMatrix4(inverse).y:null;};
 const sampleTerrain=sampler(terrainIndex),sampleSea=sampler(seaIndex),sampleRailTerrain=sampler(foundationIndex);
 let candidate,newStructure,provider;
 try{
  // City and exact public ports are regenerated from the current factories;
  // legacy structure is then replaced ONLY in this detached CPU fixture.
  candidate=createTargetCityDetailCandidate({castle:f.castle,cliffTransitRelease:retainedRelease,fitSunShadow:false,newCityStreetInfill:true,newCityFoundationRefinement:true,newCityWindowBatching:true,newCitySecondaryClusters:true});
  const oldStructure=candidate.root.getObjectByName('citadel-target-cliff-transit-structure'),oldReport=candidate.report.cliffTransit;
  const connectionTargets=Object.fromEntries(oldReport.connections.map(c=>[c.id,c.end]));
  const oldStats=stats(oldStructure),cityGroups=candidate.root.children.filter(g=>g!==oldStructure&&!/cloud|forest|foam|ripple|mist|turf|grass/.test(g.name));
  newStructure=createTargetCliffTransitStructure({...prepared.release.structureOptions,galleryPierWidths:{...prepared.release.structureOptions?.galleryPierWidths,...(newShorePierWidth===null?{}:{newShore:newShorePierWidth})},release:prepared.release,castleMatrix:matrix,sampleTerrain,sampleSea,sampleRailTerrain,connectionTargets,obstacleGroups:cityGroups,sampleStep:.75,walkwayHeight:6.9,vehicleEnvelope:{halfWidth:1.75,halfLength:3.49,top:5.36,topMargin:.35},newCityTransitLinks:false});
  const newStats=stats(newStructure.group),r=newStructure.report;
  oldStructure.removeFromParent();candidate.root.add(newStructure.group);f.castle.add(candidate.root);f.terrain.visible=false;f.scene.updateMatrixWorld(true);
  provider=createTargetCityPlayerSupport({castle:f.castle,candidateRoot:candidate.root,finalTerrain:[terrain]});
  const paths=Object.entries(r.galleries).map(([id,g])=>({id,kind:'gallery',points:g.upperPath}));
  for(const c of r.connections)paths.push({id:c.id+'-city-link',kind:'chart',points:c.walkPath});
  paths.push({id:'new-central-seam',kind:'gallery',points:[...r.galleries.newShore.upperPath.slice(-3),...r.galleries.central.upperPath.slice(0,3)]},{id:'central-old-seam',kind:'gallery',points:[...r.galleries.central.upperPath.slice(-3),...r.galleries.oldShore.upperPath.slice(0,3)]});
  const groundFailures=[],bodyFailures=[],pathSummary=[];let groundQueries=0,bodyQueries=0;
  for(const path of paths){const points=path.points.map(p=>new T.Vector3(...p).applyMatrix4(matrix)),startG=groundQueries,startB=bodyQueries,startGF=groundFailures.length,startBF=bodyFailures.length;
   for(const reverse of[false,true])for(const lateral of[-.4,0,.4]){let previous=null;const ps=reverse?[...points].reverse():points;
    for(let j=1;j<ps.length;j++){const a=ps[j-1],b=ps[j],n=Math.max(1,Math.ceil(a.distanceTo(b)/(path.kind==='chart'?.1:.5)));for(let i=0;i<=n;i++){
     const p=a.clone().lerp(b,i/n),direction=b.clone().sub(a),side=(path.kind==='chart'?new T.Vector3(0,1,0).transformDirection(matrix):p.clone().normalize()).cross(direction).normalize();p.addScaledVector(side,lateral);
     const h=provider.ground(p),difference=h===null?null:h-p.length(),context={path:path.id,reverse,lateral,j,i,local:p.clone().applyMatrix4(inverse).toArray()};groundQueries++;
     if(h===null||Math.abs(difference)>.3)groundFailures.push({...context,height:h,difference,hit:provider.report().lastGround});
     if(h!==null)p.setLength(h);if(previous){bodyQueries++;if(provider.walls(previous,p.clone(),p.clone().sub(previous)))bodyFailures.push({...context,hit:provider.report().lastWall});}previous=p;
    }}
   }
   pathSummary.push({id:path.id,points:points.length,groundQueries:groundQueries-startG,bodyQueries:bodyQueries-startB,groundFailures:groundFailures.length-startGF,bodyFailures:bodyFailures.length-startBF});
  }
  const connectionPreservation=r.connections.map(c=>{const old=oldReport.connections.find(v=>v.id===c.id);return{id:c.id,startExact:JSON.stringify(c.start)===JSON.stringify(old?.start),endExact:JSON.stringify(c.end)===JSON.stringify(old?.end),walkPathExact:JSON.stringify(c.walkPath)===JSON.stringify(old?.walkPath)};});
  const fullGlobalCargo=auditFullGlobalAgainstCity(newStructure.group,prepared.startup.curves);
  const joins=[['newShore','central'],['central','oldShore']].map(([a,b])=>({a,b,worldGap:new T.Vector3(...r.galleries[a].upperPath.at(-1)).applyMatrix4(matrix).distanceTo(new T.Vector3(...r.galleries[b].upperPath[0]).applyMatrix4(matrix))}));
  const collisions=r.vehicleClearance.collisions.map(c=>({...c,world:prepared.release.curves[c.lane].getPointAt(c.u).toArray(),local:prepared.release.curves[c.lane].getPointAt(c.u).applyMatrix4(inverse).toArray()})),byMesh={};for(const c of collisions)for(const h of c.hits)byMesh[h.mesh]=(byMesh[h.mesh]??0)+1;
  const report={version:'global-crossing-city-structure-candidate-1',artifactFile,newShorePierWidth,accepted:false,installed:false,gpuVerified:false,terrainFinalEpochVerified:false,scope:'Actual new structure triangles versus exact new release red/blue cargo envelopes. Read-only advisor artifact used for foundation heights and finite provider diagnostics; this does NOT repeat full terrain OBB/parity acceptance.',release:prepared.report,connectionTargets,obstacleGroups:cityGroups.map(g=>g.name),geometry:{before:oldStats,after:newStats,delta:Object.fromEntries(Object.keys(newStats).map(k=>[k,newStats[k]-oldStats[k]]))},lengths:Object.fromEntries(['newShore','central','oldShore'].map(k=>[k,{before:retainedRelease.segments.center[k].getLength(),after:prepared.release.segments.center[k].getLength()}])),structure:r,connectionPreservation,fullGlobalCargo,cargo:{...r.vehicleClearance,collisions,byMesh},walk:{step:{galleries:.5,connections:.1},lateral:[-.4,0,.4],directions:2,groundQueries,bodyQueries,pathSummary,joins,groundFailures,bodyFailures},limitations:['Artifact stage is explicit in release.terrainDependency; this structure audit does not certify terrain OBB/parity or live source epoch.','Actors are current detached candidate city groups only; original global actors, moving ships, load animations and waves remain unaudited.','Vehicle OBB and body rays are finite samples, not continuous CCD.','Extra plaza links55/65 remain disabled; no scene was installed.']};
  return report;
 }finally{provider?.dispose();newStructure?.dispose();candidate?.dispose();terrain.removeFromParent();geometry.dispose();mat.dispose();f.dispose();}
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const report=auditGlobalCrossingStructure(),path=new URL('artifacts/pipeline/citadel-global-approach-support-20261006/crossing-50-city-structure.json',ROOT);fs.writeFileSync(path,JSON.stringify(report,null,2));console.log(JSON.stringify({finitePass:report.structure.finitePass,issues:report.structure.issues,geometry:report.geometry,fullGlobalCargo:report.fullGlobalCargo,lengths:report.lengths,cargo:{poses:report.cargo.poses,collisions:report.cargo.collisions.length,byMesh:report.cargo.byMesh},walk:{ground:report.walk.groundQueries,body:report.walk.bodyQueries,groundFailures:report.walk.groundFailures.length,bodyFailures:report.walk.bodyFailures.length,pathSummary:report.walk.pathSummary}},null,2));}
