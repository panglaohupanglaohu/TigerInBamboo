import {createTargetCityDetailCandidate} from './targetCityDetailCandidate.js';
import {integrateTargetCityLandmarks} from './targetCityLandmarkIntegration.js';

export const TARGET_CITY_RUNTIME_VERSION = 'target-city-runtime-1';
const active = new WeakMap();
const ROCK = /^citadel-new-city-continuous-ridge-surface|^citadel-oskar-grid-mountain-surface|^highland-ravine-wall|^citadel-backdrop-ridge|^new-city-rock-shoulder|^citadel-coastal-cliff-seal|^citadel-study-rock-crags|^old-shore-blender-rock-support/;
const PLANT = /^citadel-canopy-|^citadel-mountain-canopy-candidate$|^citadel-study-(cypress|understory|meadow-grass|groundcover)|^citadel-study-mountain-planting$|^citadel-mountain-cypress-groves$|^highland-(mountain-slope|slope-shrub|slope-grass)-vegetation$/;
const below = (o, root) => {for (let p=o;p;p=p.parent) if(p===root)return true;return false;};
const visible = o => {for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
const synchronous = (fn, name) => {if(typeof fn!=='function'||fn.constructor.name==='AsyncFunction')throw new TypeError(`${name} must be synchronous`);};
const completed = (value, name) => {if(value?.then)throw new TypeError(`${name} returned a Promise`);return value;};

// Last-resort restoration of the borrowed scene references when construction
// throws before returning its handle. Owned allocations must also register with
// onOwned as they are created; reference restoration cannot release a closure.
function captureRollback({castle,sceneRoot,oceanMesh,actors,renderer}) {
  const objects=new Set(), sceneChildren=[...sceneRoot.children];
  castle.traverse(o=>objects.add(o));for(const actor of actors)actor?.traverse(o=>objects.add(o));objects.add(oceanMesh);
  sceneRoot.traverse(o=>{if(o.isLight){objects.add(o);if(o.target)objects.add(o.target);if(o.shadow?.camera)objects.add(o.shadow.camera);}});
  const saved=[...objects].map(o=>({o,parent:o.parent,index:o.parent?.children.indexOf(o)??-1,visible:o.visible,children:[...o.children],
    position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone(),matrix:o.matrix.clone(),matrixAutoUpdate:o.matrixAutoUpdate,
    geometry:o.geometry,material:o.material,userData:{...o.userData},instances:o.isInstancedMesh?o.instanceMatrix.array.slice():null,
    count:o.isInstancedMesh?o.count:null,camera:o.isCamera?Object.fromEntries(['near','far','left','right','top','bottom','fov','aspect','zoom'].filter(k=>k in o).map(k=>[k,o[k]])):null,
    shadow:o.shadow?{bias:o.shadow.bias,normalBias:o.shadow.normalBias}:null}));
  const originals=new Set(saved.map(s=>s.o)),shadowType=renderer?.shadowMap?.type;
  return () => {
    // Construction is synchronous, so children first attached in this interval
    // belong to this failed transaction. Never run this broad rollback on a
    // normal later uninstall, when gameplay may have added unrelated actors.
    for(const s of saved)for(const child of [...s.o.children])if(!s.children.includes(child)&&!originals.has(child))child.removeFromParent();
    for(const child of [...sceneRoot.children])if(!sceneChildren.includes(child))child.removeFromParent();
    for(const s of saved){const o=s.o;if(o.parent!==s.parent){o.removeFromParent();s.parent?.add(o);}o.visible=s.visible;o.position.copy(s.position);o.quaternion.copy(s.quaternion);o.scale.copy(s.scale);o.matrix.copy(s.matrix);o.matrixAutoUpdate=s.matrixAutoUpdate;
      if(s.geometry)o.geometry=s.geometry;if(s.material)o.material=s.material;
      for(const key of Object.keys(o.userData))if(!Object.hasOwn(s.userData,key))delete o.userData[key];Object.assign(o.userData,s.userData);
      if(s.instances){o.instanceMatrix.array.set(s.instances);o.instanceMatrix.needsUpdate=true;o.count=s.count;o.computeBoundingBox();o.computeBoundingSphere();}
      if(s.camera){Object.assign(o,s.camera);o.updateProjectionMatrix();}if(s.shadow){Object.assign(o.shadow,s.shadow);o.shadow.needsUpdate=true;}
    }
    for(const s of saved)if(s.parent&&s.index>=0){const children=s.parent.children,i=children.indexOf(s.o);if(i>=0){children.splice(i,1);children.splice(Math.min(s.index,children.length),0,s.o);}}
    if(renderer?.shadowMap&&shadowType!==undefined){renderer.shadowMap.type=shadowType;renderer.shadowMap.needsUpdate=true;}
    sceneRoot.updateMatrixWorld(true);
  };
}

/** Install into the ACTUAL scene; this function does not modify main.js.
 * Required: live castle, sceneRoot and citadelRange with the original horse,
 * statue and idle-daytime nightInfiltration controller. Uses castle.matrixWorld
 * and the real rangeWorldToLocal by default; no synthetic geographic frame.
 *
 * legacyRoots is explicit: pass the original tramSystem.group and highland-gate
 * only when replacing their entire visual scope is intended. No global tram
 * hiding, curve mutation, controller freezing or navigation install is implicit.
 * update receives elapsed SECONDS, not a frame delta; caller owns its game loop.
 * If distanceCulling is supplied, its update is wrapped so legacy visibility is
 * enforced AFTER culling; all arguments, receiver and return values survive.
 * dispose may reject while the original horse action is active. It leaves the
 * live install intact; retry when its controller reports safeToRelocate.
 *
 * The optional second argument supplies synchronous construction adapters for
 * transaction tests. A factory MUST clean its own partially constructed handles
 * before throwing, and register owned handles via onOwned for teardown recovery.
 * Registered handles must have idempotent dispose methods.
 */
export function installTargetCityRuntime({castle,sceneRoot,citadelRange,terrainMeshes,oceanMesh,legacyRoots=[],renderer=null,distanceCulling=null,worldToRange,candidateOptions={}}={},
  {createCandidate=createTargetCityDetailCandidate,integrateLandmarks=integrateTargetCityLandmarks}={}) {
  if(!castle?.isObject3D||!sceneRoot?.isObject3D||!below(castle,sceneRoot))throw new TypeError('live castle attached to sceneRoot is required');
  const existing=active.get(castle);if(existing){if(existing.sceneRoot!==sceneRoot||existing.citadelRange!==citadelRange)throw new Error('runtime already installed with another scene/range');return existing.handle;}
  if(castle.getObjectByName('citadel-target-city-detail-candidate')||castle.getObjectByName('target-original-landmark-paving'))throw new Error('existing candidate/landmark transaction must be removed before runtime install');
  synchronous(createCandidate,'createCandidate');synchronous(integrateLandmarks,'integrateLandmarks');
  if(worldToRange!==undefined)synchronous(worldToRange,'worldToRange');
  const statue=castle.getObjectByName('citadel-plaza-hero-statue'),horse=citadelRange?.trojanHorse,controller=citadelRange?.nightInfiltration;
  if(!statue?.isObject3D||!horse?.isObject3D||!below(horse,sceneRoot)||typeof controller?.relocateGround!=='function'||typeof controller?.getPlacementState!=='function')throw new TypeError('original statue, horse and real citadelRange relocation controller are required');
  if(!controller.getPlacementState()?.safeToRelocate)throw new Error('landmark controller must be idle in daytime before installation');
  const terrain=terrainMeshes??[castle.getObjectByName('citadel-oskar-grid-mountain-surface')].filter(Boolean),ocean=oceanMesh??sceneRoot.getObjectByName('planet-v8-curved-ocean');
  if(!Array.isArray(terrain)||!terrain.length||terrain.some(m=>!m?.isMesh||!m.geometry?.attributes?.position||!below(m,sceneRoot)||!visible(m)))throw new TypeError('visible final terrain meshes are required');
  if(!ocean?.isMesh||!ocean.geometry?.attributes?.position||!below(ocean,sceneRoot)||!visible(ocean))throw new TypeError('visible actual ocean mesh is required');
  if(!Array.isArray(legacyRoots)||legacyRoots.some(o=>!o?.isObject3D||!below(o,sceneRoot)||o===sceneRoot||o===castle||terrain.some(t=>below(t,o)||below(o,t))||(below(ocean,o)||below(o,ocean))||[statue,horse,controller.root].some(a=>a&&(below(a,o)||below(o,a)))))throw new TypeError('legacyRoots must not contain terrain, ocean or protected actors');
  if(candidateOptions===null||typeof candidateOptions!=='object'||Array.isArray(candidateOptions))throw new TypeError('candidateOptions must be an options record');
  sceneRoot.updateMatrixWorld(true);
  if(!castle.matrixWorld.elements.every(Number.isFinite)||Math.abs(castle.matrixWorld.determinant())<1e-12)throw new Error('castle frame must be finite and invertible');
  const actors=[statue,horse,controller.root].filter(Boolean),savedVisibility=new Map(),statueParent=statue.parent,statueIndex=statue.parent?.children.indexOf(statue)??-1;
  castle.traverse(o=>{if(!(o.isMesh||o.isLine||o.isPoints)||actors.some(a=>below(o,a)))return;let keep=terrain.includes(o)||o===ocean;for(let p=o;p&&p!==castle;p=p.parent)if(ROCK.test(p.name)||PLANT.test(p.name)||/cloud/i.test(p.name))keep=true;if(!keep)savedVisibility.set(o,o.visible);});
  for(const o of legacyRoots)savedVisibility.set(o,o.visible);
  const replacedVisibility=new Map(['citadel-mountain-cloud-banks-candidate','citadel-ridge-flow-clouds'].map(name=>castle.getObjectByName(name)).filter(Boolean).map(o=>[o,o.visible]));
  const rollbackScene=captureRollback({castle,sceneRoot,oceanMesh:ocean,actors,renderer}),owned=[],ownedSet=new Set(),disposeErrors=[];
  const register=h=>{if(!h||typeof h.dispose!=='function')throw new TypeError('onOwned requires a disposable construction handle');if(!ownedSet.has(h)){ownedSet.add(h);owned.push(h);}return h;};
  let candidate=null,migration=null,disposed=false,cullingWrapper=null,originalCullingUpdate=null;
  const report={version:TARGET_CITY_RUNTIME_VERSION,status:'installing',installed:false,cityDetail:null,landmarkIntegration:null,
    coordinateFrame:'live castle.matrixWorld and citadelRange rangeWorldToLocal',visibility:{legacyObjects:savedVisibility.size,explicitRoots:legacyRoots.map(o=>({name:o.name,uuid:o.uuid})),dynamicActorVisibilityPreserved:true},
    navigation:{providerAvailable:false,installedIntoPlayer:false,completeNavigationVerified:false},tram:{routeIntegrated:false,controlsChanged:false,railIsStatic:true},gpuValidated:false,visualAccepted:false,
    limitations:['Initial production scene attachment, not completed navigation or tram routing.','Landmark and support checks are finite samples, not continuous swept collision proof.','Retreat is rejected during an active original horse action; caller must retry when idle.']};
  function enforceVisibility(){if(disposed)return;for(const o of savedVisibility.keys())o.visible=false;
    for(const o of candidate?.replacedCloudRoots??[])o.visible=false;
    for(const row of [...(candidate?.report?.benchTurf?.hiddenLegacy??[]),...(candidate?.report?.rockAppearance?.suppressedDecorations??[])]){const o=castle.getObjectByProperty('uuid',row.uuid);if(o)o.visible=false;}
  }
  function detachCulling(){if(cullingWrapper&&distanceCulling.update===cullingWrapper)distanceCulling.update=originalCullingUpdate;cullingWrapper=null;}
  function refresh(){if(disposed)return;sceneRoot.updateMatrixWorld(true);distanceCulling?.recollect?.();enforceVisibility();}
  try {
    enforceVisibility();
    candidate=completed(createCandidate({...candidateOptions,castle,sceneRoot,terrainMeshes:terrain,oceanMesh:ocean,renderer,onOwned:register}),'createCandidate');
    if(!candidate?.root?.isObject3D||candidate.root.parent||typeof candidate.dispose!=='function'||typeof candidate.update!=='function'||typeof candidate.getPlayerSupport!=='function'||!candidate.report)throw new Error('candidate factory must return a detached, owned runtime handle');
    for(const o of candidate.replacedCloudRoots??[])if(!replacedVisibility.has(o))replacedVisibility.set(o,o.visible);
    castle.add(candidate.root);candidate.root.userData.candidateHandle=candidate;report.cityDetail=candidate.report;
    completed(candidate.completeTerraceLinks?.(),'completeTerraceLinks');completed(candidate.completeWaterfrontStairs?.(),'completeWaterfrontStairs');completed(candidate.clearForest?.(),'clearForest');
    enforceVisibility();sceneRoot.updateMatrixWorld(true);
    migration=completed(integrateLandmarks({castle,sceneRoot,range:citadelRange,detailCandidate:candidate,terrainMeshes:terrain,...(worldToRange?{worldToRange}:{})}),'integrateLandmarks');
    report.landmarkIntegration=migration?.report??null;
    if(migration?.ok!==true||typeof migration.rollback!=='function')throw Object.assign(new Error('landmark integration rejected: '+(migration?.reason??'invalid-result')),{landmarkReport:migration?.report});
    report.cityDetail=candidate.report;report.landmarkIntegration=migration.report;
    if(distanceCulling?.update){originalCullingUpdate=distanceCulling.update;cullingWrapper=function(...args){try{return originalCullingUpdate.apply(this,args);}finally{enforceVisibility();}};distanceCulling.update=cullingWrapper;}
    refresh();report.status='installed-awaiting-runtime-validation';report.installed=true;
  } catch(error) {
    detachCulling();
    if(migration?.ok){try{const r=migration.rollback();if(!r?.ok)throw new Error(r?.reason??'landmark rollback failed');}catch(e){disposeErrors.push(e);}}
    let ownerReleased=false;if(candidate?.dispose)try{candidate.dispose();ownerReleased=true;}catch(e){disposeErrors.push(e);}
    if(candidate&&!ownerReleased)for(const h of owned.slice().reverse())try{h.dispose();}catch(e){disposeErrors.push(e);}
    try{rollbackScene();for(const[o,value]of savedVisibility)o.visible=value;for(const[o,value]of replacedVisibility)o.visible=value;distanceCulling?.recollect?.();}catch(e){disposeErrors.push(e);}
    report.status='installation-failed';report.failure=String(error?.message??error);report.cleanupErrors=disposeErrors.map(e=>String(e.message??e));
    error.runtimeReport=report;if(disposeErrors.length)throw Object.assign(new AggregateError([error,...disposeErrors],'Target city install failed; rollback reported errors'),{runtimeReport:report});throw error;
  }
  const handle={root:candidate.root,report,enforceVisibility,refresh,
    update(seconds=0){if(disposed)return;if(!Number.isFinite(seconds)||seconds<0)throw new RangeError('elapsed seconds must be finite and nonnegative');try{candidate.update(seconds);}catch(error){report.lastUpdateError=String(error.message??error);throw error;}finally{enforceVisibility();}},
    getPlayerSupport(){if(disposed)throw new Error('target city runtime disposed');const provider=candidate.getPlayerSupport();report.navigation.providerAvailable=true;return provider;},
    dispose(){if(disposed)return{ok:true,alreadyDisposed:true};
      if(!controller.getPlacementState()?.safeToRelocate)return{ok:false,reason:'landmark-active',report};
      const restored=migration.rollback();if(!restored?.ok)return{ok:false,reason:'landmark-rollback:'+String(restored?.reason??'failed'),report};
      if(statue.parent===statueParent&&statueIndex>=0){const children=statueParent.children,i=children.indexOf(statue);children.splice(i,1);children.splice(Math.min(statueIndex,children.length),0,statue);}
      // No layout/material teardown occurs before the actor transaction accepts.
      const errors=[];try{candidate.dispose();}catch(error){errors.push(error);for(const h of owned.slice().reverse())try{h.dispose();}catch(e){errors.push(e);}}
      detachCulling();for(const[o,value]of savedVisibility)o.visible=value;for(const[o,value]of replacedVisibility)o.visible=value;disposed=true;active.delete(castle);if(castle.userData.targetCityRuntime===handle)delete castle.userData.targetCityRuntime;
      try{sceneRoot.updateMatrixWorld(true);distanceCulling?.recollect?.();}catch(error){errors.push(error);}
      report.installed=false;report.status=errors.length?'disposed-with-cleanup-errors':'disposed';if(errors.length)throw Object.assign(new AggregateError(errors,'Target city teardown failed'),{runtimeReport:report});return{ok:true};
    },
  };
  active.set(castle,{handle,sceneRoot,citadelRange});castle.userData.targetCityRuntime=handle;return handle;
}

export const createTargetCityRuntime = installTargetCityRuntime;
