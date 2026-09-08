// Explicit original factories, independent of the historical 72-entry catalog.
import * as THREE from 'three';
import { captureObject } from './capture.js';
import { createTripleGateScoutAircraft } from '../../src/world/planetV8/tripleGateScout.js';
import { createGatePodCraft, GATE_POD_VARIANTS, mountGatePodEscort } from '../../src/world/gatePodCraft.js';
import { createGateHaulerCraft, GATE_HAULER_VARIANTS, createSoccoCraft, setSoccoRamp } from '../../src/world/gateHaulerCraft.js';
import { createCitadelTrojanHorse } from '../../src/assets/citadelTrojanHorse.js';
import { createVanguardTrooper } from '../../src/world/vanguardTrooper.js';
import { createHarborPatrolSoldier, createGladiusSoldier, createLongbowSoldier, paintSoldierHelm } from '../../src/assets/harbor.js';
const rows=[];
function add(id,label,source,factory,options,create,extra={}) { rows.push({id,label,source,factory,options,create,...extra}); }
add('scoutAircraft','三重门侦察机','src/world/planetV8/tripleGateScout.js','createTripleGateScoutAircraft',{scale:1},()=>createTripleGateScoutAircraft(),{dynamicKeys:['propeller','canopy','cockpitAnchor','navigationLights','gunMuzzles'],runtimeSource:'src/player/scoutAircraftRide.js'});
for(const variant of GATE_POD_VARIANTS) {
 const {id,...options}=variant;
 add('gatePodCraft_'+id,'泡形侦察艇 '+id,'src/world/gatePodCraft.js','createGatePodCraft',options,()=>createGatePodCraft(options),{family:'gatePodCraft',variant:id});
}
for(let i=0;i<GATE_POD_VARIANTS.length;i++) {
 const id=GATE_POD_VARIANTS[i].id;
 add('gatePodEscort_'+id,'伴飞泡机（含麻醉炮口） '+id,'src/world/gatePodCraft.js','mountGatePodEscort',{slotIndex:i},()=>mountGatePodEscort(new THREE.Group()).children[i],{family:'gatePodCraft',variant:id,relationship:'equipment/formation variant of gatePodCraft_'+id,dynamicKeys:['tranqMuzzle'],runtimeSource:'src/world/vanguardAssault.js'});
}
for(const variant of GATE_HAULER_VARIANTS) {
 const {id,...options}=variant;
 add('gateHaulerCraft_'+id,'重型运输艇 '+id,'src/world/gateHaulerCraft.js','createGateHaulerCraft',options,()=>createGateHaulerCraft(options),{family:'gateHaulerCraft',variant:id});
}
add('soccoCraft','先锋兵登陆艇（货舱与活动尾门）','src/world/gateHaulerCraft.js','createSoccoCraft',{},()=>createSoccoCraft(),{family:'gateHaulerCraft',relationship:'carrier variant with cargo hold; 3 runtime instances share factory',dynamicKeys:['soccoRamp','soccoSeats','soccoRopeAnchors'],runtimeSource:'src/world/vanguardAssault.js'});
add('citadelTrojanHorse','特洛伊木马','src/assets/citadelTrojanHorse.js','createCitadelTrojanHorse',{seed:9901,scale:1},()=>createCitadelTrojanHorse({seed:9901,scale:1}),{relationship:'standalone extraction; already nested in citadelRange parent snapshot',dynamicKeys:['bellyHatch'],runtimeSource:'src/world/citadelRange.js'});
add('vanguardTrooper','先锋重甲兵','src/world/vanguardTrooper.js','createVanguardTrooper',{seed:0,scale:1},()=>createVanguardTrooper({seed:0,scale:1}),{dynamicKeys:['parts'],runtimeSource:'src/world/vanguardAssault.js'});
for(const [role,factory,create] of [['spear','createHarborPatrolSoldier',createHarborPatrolSoldier],['gladius','createGladiusSoldier',createGladiusSoldier],['longbow','createLongbowSoldier',createLongbowSoldier]]) {
 for(const side of ['red','blue']) add('romanSoldier_'+role+'_'+side,`罗马羽冠兵 ${role} ${side}`,'src/assets/harbor.js',factory+' + paintSoldierHelm',{side},()=>paintSoldierHelm(create(),side),{family:'romanSoldier',variant:role+'_'+side,relationship:'equipment/crest variant; retain shared lineage, not a new independent design',dynamicKeys:['parts','equipment'],runtimeSource:'src/world/saihojiPhalanx.js'});
}
window.supplementalCatalog=rows.map(({create,...row})=>row);
window.captureSupplemental=(id)=>{
 const row=rows.find(r=>r.id===id); if(!row)throw Error('Unknown supplemental id '+id);
 const previous=Math.random; let seed=20260908;
 Math.random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 try {
  const root=row.create(); const {create,...entry}=row;
  for(const key of row.dynamicKeys||[])if(root.userData[key]==null)throw Error('Missing dynamic contract '+key);
  const snapshot=captureObject(root,{...entry,seed:20260908,captureScope:'standalone factory; runtime layout/animation/interaction not migrated'});
  const probes=[];
  if(id==='soccoCraft') {const node=root.userData.soccoRamp;setSoccoRamp(root,1);probes.push({action:'setSoccoRamp(1)',node:'socco-ramp-hinge',rotationX:node.rotation.x,passed:node.rotation.x<-1});}
  if(id==='citadelTrojanHorse') {root.userData.setBellyOpen(1);probes.push({action:'setBellyOpen(1)',passed:root.userData.bellyHatch.open===1});}
  return {snapshot,probes};
 } finally {Math.random=previous;}
};
window.ready=true;
