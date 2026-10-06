import * as T from 'three';
import {buildMountainSurfaceIndex} from './mountainSurfaceIndex.js';
import {officialOceanLevelAt} from '../waterV8/officialOcean.js';

export const EAST_CROSSING_STARTUP_SUPPORT_VERSION='east-crossing-startup-support-1';
const hash=a=>{if(!a)return null;let h=2166136261;for(const b of new Uint8Array(a.buffer,a.byteOffset,a.byteLength))h=Math.imul(h^b,16777619)>>>0;return h;};
const epoch=m=>({material:m.material,sides:(Array.isArray(m.material)?m.material:[m.material]).map(v=>({material:v,side:v?.side})),drawRange:{...m.geometry.drawRange},groups:JSON.stringify(m.geometry.groups),geometry:m.geometry,position:m.geometry.attributes.position,index:m.geometry.index,version:m.geometry.attributes.position.version,indexVersion:m.geometry.index?.version,positionHash:hash(m.geometry.attributes.position.array),indexHash:hash(m.geometry.index?.array),matrix:m.matrixWorld.clone()});
const under=(o,root)=>{for(let p=o;p;p=p.parent)if(p===root)return true;return false;};
const matrixSame=(a,b)=>a.elements.every((v,i)=>Math.abs(v-b.elements[i])<1e-9);
const sameData=(m,e,full)=>m.material===e.material&&e.sides.every((v,i)=>v.material===(Array.isArray(m.material)?m.material:[m.material])[i]&&v.side===v.material?.side)&&m.geometry.drawRange.start===e.drawRange.start&&m.geometry.drawRange.count===e.drawRange.count&&JSON.stringify(m.geometry.groups)===e.groups&&m.geometry===e.geometry&&m.geometry.attributes.position===e.position&&m.geometry.index===e.index&&e.position.version===e.version&&e.index?.version===e.indexVersion&&matrixSame(m.matrixWorld,e.matrix)&&(!full||(hash(e.position.array)===e.positionHash&&hash(e.index?.array)===e.indexHash));
const meshOK=(m,scene)=>m?.isMesh&&m.geometry?.attributes?.position&&under(m,scene);

/** Startup-only adapter: actual scene meshes -> world-radial support samplers.
 * No scene/terrain mutation here. Only the tram's prepared support transaction
 * can publish structures. Owns the temporary wave geometry and indices, not
 * borrowed terrain/ocean/runtime/tram resources. Default off is inert. */
export function createTargetEastCrossingStartupSupport(options={}){
 const report={version:EAST_CROSSING_STARTUP_SUPPORT_VERSION,enabled:options.enabled===true,accepted:false,installed:false,status:'disabled',startupOnly:true,gpuVerified:false};
 if(!report.enabled)return{report,commit(){return false;},finalize(){},rollback(){},dispose(){}};
 const {scene,castle,tramSystem,runtime,planet,hills,ocean,radius=160}=options;
 if(!scene?.isObject3D||!castle?.isObject3D||!under(castle,scene)||!Number.isFinite(radius)||radius<=0||!tramSystem?.crossingBundle||typeof tramSystem.prepareCrossingSupport!=='function')throw new Error('CROSSING_STARTUP_INPUT');
 if(tramSystem.citadelTransitRelease!==tramSystem.crossingBundle.release||tramSystem.curve!==tramSystem.crossingBundle.startupPreview.curves.center||['red','blue'].some(l=>tramSystem.curves?.[l]!==tramSystem.crossingBundle.startupPreview.curves[l]))throw new Error('CROSSING_STARTUP_TRAM_CURVE_BINDING');
 const source=castle.getObjectByName('citadel-oskar-grid-mountain-surface'),strict=castle.userData.eastCliffStartupTerrain,artifact=tramSystem.terrainPreparation?.artifact;
 const city=runtime?.root?.getObjectByName('citadel-target-cliff-transit-structure');
 const required=[source,planet,hills?.mesh,hills?.skirt,ocean];
 if(required.some(m=>!meshOK(m,scene))||planet.name!=='planet-surface'||ocean.name!=='planet-v8-curved-ocean')throw new Error('CROSSING_STARTUP_ACTUAL_SURFACES_REQUIRED');
 if(!artifact?.sourceHash||!strict?.report?.installed||strict.report.phase!=='after-refine-before-sampling'||strict.report.sourceMeshUUID!==source.uuid||castle.userData.mountainStudy?.exactRemesh!==strict.report)throw new Error('CROSSING_STARTUP_STRICT_INSTALL_REQUIRED');
 if(strict.report.sourceEpoch?.position!==artifact.sourceHash.position||strict.report.sourceEpoch?.index!==artifact.sourceHash.index||strict.report.sourceEpoch?.vertices!==artifact.sourceHash.vertices)throw new Error('CROSSING_STARTUP_BASE_EPOCH_MISMATCH');
 if(!runtime?.report?.installed||castle.userData.targetCityRuntime!==runtime||!under(runtime.root,castle)||!city)throw new Error('CROSSING_STARTUP_RUNTIME_BINDING_REQUIRED');
 scene.updateMatrixWorld(true);
 if(castle.matrixWorld.elements.some((v,i)=>Math.abs(v-artifact.castleMatrix[i])>1e-6))throw new Error('CROSSING_STARTUP_CASTLE_FRAME_MISMATCH');
 // Recreate only the artifact's source-frame transform, compare exact position
 // and index bytes, then release it. An installed report alone is insufficient.
 const expected=new T.BufferGeometryLoader().parse(artifact.geometry);
 try{expected.applyMatrix4(source.matrixWorld.clone().invert().multiply(castle.matrixWorld).multiply(new T.Matrix4().makeTranslation(...artifact.origin)));
  if(hash(expected.attributes.position.array)!==hash(source.geometry.attributes.position.array)||hash(expected.index?.array)!==hash(source.geometry.index?.array)||expected.attributes.position.count!==source.geometry.attributes.position.count)throw new Error('CROSSING_STARTUP_FINAL_GEOMETRY_MISMATCH');
 }finally{expected.dispose();}
 const material=ocean.material,scale=new T.Vector3(),oceanOrigin=new T.Vector3(),quaternion=new T.Quaternion();ocean.matrixWorld.decompose(oceanOrigin,quaternion,scale);
 if(oceanOrigin.length()>1e-7||Math.min(...scale.toArray())<=0||Math.max(...scale.toArray())-Math.min(...scale.toArray())>1e-7)throw new Error('CROSSING_STARTUP_OCEAN_NONRADIAL_TRANSFORM');
 const shader=material?.vertexShader?.replace(/\s+/g,' ');
 if(!material?.isShaderMaterial||material.uniforms?.uWaterKind?.value!==0||!Number.isFinite(material.uniforms?.uTime?.value)||!shader?.includes('float oceanWave = sin(phase * 8.0 + uTime * 0.9) * 0.045 + cos(phase * 13.0 - uTime * 0.57) * 0.022;')||!shader.includes('vec3 p = position + radial * wave;'))throw new Error('CROSSING_STARTUP_OCEAN_WAVE_CONTRACT');
 const snapshots=new Map(required.map(m=>[m,epoch(m)])),castleFrame=castle.matrixWorld.clone(),runtimeRoot=runtime.root,cityGeometry=[];
 city.traverse(o=>{if(o.isMesh)cityGeometry.push([o,epoch(o)]);});
 const boundSamplers=runtime.getSurfaceSamplers?.();
 function bindings(full=false){
  scene.updateMatrixWorld(true);
  if(tramSystem.citadelTransitRelease!==tramSystem.crossingBundle.release||tramSystem.curve!==tramSystem.crossingBundle.startupPreview.curves.center||['red','blue'].some(l=>tramSystem.curves?.[l]!==tramSystem.crossingBundle.startupPreview.curves[l]))throw new Error('CROSSING_STARTUP_TRAM_CURVE_BINDING');
  if(castle.getObjectByName(source.name)!==source||castle.userData.eastCliffStartupTerrain!==strict||!strict.report.installed||castle.userData.mountainStudy?.exactRemesh!==strict.report||!matrixSame(castle.matrixWorld,castleFrame))throw new Error('CROSSING_STARTUP_TERRAIN_IDENTITY_CHANGED');
  if(castle.userData.targetCityRuntime!==runtime||!runtime.report.installed||runtime.root!==runtimeRoot||!under(runtimeRoot,castle)||runtimeRoot.getObjectByName(city.name)!==city)throw new Error('CROSSING_STARTUP_RUNTIME_CHANGED');
  for(const[m,e]of snapshots)if(!under(m,scene)||!sameData(m,e,full))throw new Error('CROSSING_STARTUP_SURFACE_EPOCH_CHANGED');
  for(const[m,e]of cityGeometry)if(!under(m,city)||!sameData(m,e,full))throw new Error('CROSSING_STARTUP_CITY_GEOMETRY_CHANGED');
  if(ocean.material!==material||material.uniforms.uWaterKind.value!==0||material.vertexShader.replace(/\s+/g,' ')!==shader)throw new Error('CROSSING_STARTUP_WAVE_CHANGED');
  const sources=runtime.report.cityDetail?.sourceSurfaces,land=sources?.terrain?.find(x=>x.name===source.name),foundation=sources?.foundationTerrain??[];
  if(land?.geometry!==source.geometry.uuid||land?.positionVersion!==source.geometry.attributes.position.version||sources?.ocean?.geometry!==ocean.geometry.uuid||!foundation.some(x=>x.name===source.name&&x.geometry===source.geometry.uuid)||!foundation.some(x=>x.name===planet.name&&x.geometry===planet.geometry.uuid))throw new Error('CROSSING_STARTUP_CITY_TERRAIN_BINDING_STALE');
  const current=runtime.getSurfaceSamplers?.();if(!current||['terrain','foundationTerrain','sea'].some(k=>typeof current[k]!=='function'||current[k]!==boundSamplers?.[k]))throw new Error('CROSSING_STARTUP_CITY_SAMPLERS_CHANGED');
 }
 bindings(true);
 let waveGeometry=null,groundIndex=null,seaIndex=null,waveIndex=null,transaction=null,status='preparing',released=false;
 const release=()=>{if(released)return;released=true;waveGeometry?.dispose();waveGeometry=null;groundIndex=seaIndex=waveIndex=null;report.temporaryGeometryDisposed=true;report.indicesReleased=true;};
 try{
  groundIndex=buildMountainSurfaceIndex([source,planet,hills.mesh,hills.skirt]);seaIndex=buildMountainSurfaceIndex([ocean]);
  waveGeometry=ocean.geometry.clone();const p=waveGeometry.attributes.position;
  for(let i=0;i<p.count;i++){const v=new T.Vector3().fromBufferAttribute(p,i);v.addScaledVector(v.clone().normalize(),.067);p.setXYZ(i,...v.toArray());}
  const wave=new T.Mesh(waveGeometry,material);wave.name='temporary-actual-ocean-wave-bound';wave.matrixAutoUpdate=false;wave.matrix.copy(ocean.matrixWorld);wave.updateMatrixWorld(true);waveIndex=buildMountainSurfaceIndex([wave]);
  let maxRadius=radius;const boundPoint=new T.Vector3();for(const m of required){const a=m.geometry.attributes.position;for(let i=0;i<a.count;i++)maxRadius=Math.max(maxRadius,boundPoint.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld).length());}maxRadius+=50;const oceanInverse=ocean.matrixWorld.clone().invert();report.rayOriginRadius=maxRadius;
  const hit=(index,q)=>{if(released)throw new Error('CROSSING_STARTUP_SAMPLERS_RELEASED');const d=q.clone().normalize();return index.sample(new T.Ray(d.clone().multiplyScalar(maxRadius),d.clone().negate()),0,maxRadius*2);};
  const sampleGround=q=>{const h=hit(groundIndex,q);report.samples.ground++;if(!h){report.samples.missingGround++;return null;}return{point:h.point,objectName:h.object.name};};
  const sampleSea=q=>{const a=hit(seaIndex,q),b=hit(waveIndex,q);report.samples.sea++;if(!a||!b)report.samples.missingSea++;return{radius:a?.point.length(),upperRadius:b?.point.length(),officialUpperRadius:scale.x*(radius+officialOceanLevelAt(q.clone().applyMatrix4(oceanInverse).normalize())+.067)};};
  report.samples={ground:0,sea:0,missingGround:0,missingSea:0};report.source={uuid:source.uuid,geometry:source.geometry.uuid,positionHash:snapshots.get(source).positionHash,indexHash:snapshots.get(source).indexHash,strictSourceEpoch:strict.report.sourceEpoch};report.wave={localMaximum:.067,actualWorldScale:scale.toArray(),worldMaximum:.067*scale.x,origin:oceanOrigin.toArray(),shaderContract:'official ocean sin .045 + cos .022; uWaterKind=0'};report.indexStats={ground:groundIndex.stats,sea:seaIndex.stats,wave:waveIndex.stats};
  transaction=tramSystem.prepareCrossingSupport({sampleGround,sampleSea,cityStructure:city});bindings(true);status='prepared';report.status=status;report.support=transaction.report;
  const rollback=()=>{if(status==='rolled-back')return;if(status==='finalized')throw new Error('CROSSING_STARTUP_FINALIZED_USE_TRAM_DISPOSE');transaction.rollback();status='rolled-back';report.status=status;report.installed=false;release();};
  return{report,
   commit(){if(status==='committed'||status==='finalized')return report;if(status!=='prepared')throw new Error('CROSSING_STARTUP_CLOSED');try{bindings(true);transaction.commit();bindings(true);status='committed';report.status=status;report.installed=true;return report;}catch(error){rollback();throw error;}},
   finalize(){if(status==='finalized')return;if(status!=='committed')throw new Error('CROSSING_STARTUP_NOT_COMMITTED');try{bindings(true);}catch(error){rollback();throw error;}transaction.finalize();status='finalized';report.status=status;release();},
   rollback,
   dispose(){if(status==='finalized'){release();return;}rollback();},
  };
 }catch(error){try{transaction?.rollback();}finally{release();}report.status='rejected';report.error=String(error.message??error);error.startupSupportReport=report;throw error;}
}
