import {buildUpperTowerPortal} from './upperTowerPortal.js';
import {buildTowerInteriorStairs} from './towerInteriorStairs.js';
import {buildCitadelGarden} from './citadelGarden.js';
import {buildNewCityLighting} from './newCityLighting.js';
import {buildProcessionalDetails} from './processionalDetails.js';
import {OLD_CITY_BRIDGE_ANCHOR} from './oldCityOrientation.js';
import * as THREE from 'three';
import {applyCrownRoundProfiles,refineCitadelDomes} from './roundTowerProfiles.js';
import {buildCitadelMainGate} from './mainGate.js';
import {buildCitadelPlazaStatue} from './plazaStatue.js';
import {WEST_CITY,westCitySpec} from './westCityLayout.js';
import {mergeStaticGroup} from '../geometryMerge.js';

export function buildWestCity(buildTown,waterHeight) {
  const root=new THREE.Group(); root.name='highland-west-city';
  root.userData.sourceId='citadel-west-city-v1';
  root.userData.designRole='foreground-right-new-holy-city';
  root.userData.layoutVersion='foreground-right-city-v3-massing';
  const stone=new THREE.MeshStandardMaterial({color:0xa5adb0,roughness:.94});
  const paving=new THREE.MeshStandardMaterial({color:0xd8d5c6,roughness:.93});
  const domeBlue=new THREE.MeshStandardMaterial({color:0x2059a6,roughness:.72});
  domeBlue.name='citadel-target-blue-dome';
  root.add(buildNewCityLighting());
  root.add(buildCitadelGarden());
  const reports=[];
  const bridgeStart=new THREE.Vector3(...OLD_CITY_BRIDGE_ANCHOR);
  const bridgeEnd=new THREE.Vector3(WEST_CITY.x-14.35,5.03,WEST_CITY.districts[0].z);
  const route=[bridgeStart.toArray()];
  const waterPoints=[],waterIndices=[];
  for(let iz=0;iz<=24;iz++)for(let ix=0;ix<=6;ix++){
    const z=-4+iz*68/24;
    const width=z>=52&&z<=62?18.8:12.5;
    const x=25+ix*width/6;
    waterPoints.push(x,waterHeight(x,z),z);
    if(ix<6&&iz<24){const a=iz*7+ix;waterIndices.push(a,a+7,a+1,a+1,a+7,a+8);}
  }
  const waterGeometry=new THREE.BufferGeometry();
  waterGeometry.setAttribute('position',new THREE.Float32BufferAttribute(waterPoints,3));
  waterGeometry.setIndex(waterIndices);waterGeometry.computeVertexNormals();
  const water=new THREE.Mesh(waterGeometry,new THREE.MeshStandardMaterial({color:0x276c87,roughness:.24,metalness:.15}));
  water.name='west-city-water-channel';water.userData.sourceId=water.name;root.add(water);
  function box(name,x,y,z,w,h,d,mat=stone){
    const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat);
    m.name=name;m.position.set(x,y,z);m.receiveShadow=true;m.castShadow=true;
    m.userData.sourceId=name;root.add(m);return m;
  }
  function walkBox(...args){
    const m=box(...args);m.userData.westCityWalkable=true;m.userData.isCitadelTerrain=true;return m;
  }
  WEST_CITY.districts.forEach((district,tier)=>{
    const spec=westCitySpec(tier);
    const cache={};
    const a=buildTown(spec,{baseY:district.y,highlandColors:true,wfcTownV1:true,
      domeProfile:'citadel-target',domeMaterial:domeBlue,wfcSeed:20260911+tier,wfcTopology:'legacy-faces',townCtxCache:cache,
      protectedCore:{centerX:5,centerZ:5,halfX:1,halfZ:5},leanDecor:true,skipDecor:true});
    refineCitadelDomes(a.group,district.buildingWidthScale);
    if(tier===2)applyCrownRoundProfiles(a.group,spec,district.y);
    a.group.name='west-city-'+district.id;
    a.group.position.set(WEST_CITY.x,0,district.z);
    a.group.scale.set(district.buildingWidthScale,1,district.buildingWidthScale);
    a.group.userData.sourceId=a.group.name;
    a.group.userData.editableSpec=spec;
    a.group.userData.wfc=a.stats.wfcTown;
    root.add(a.group);
    reports.push({id:district.id,cells:a.stats.cellCount,domeCount:a.stats.domeCount,wfc:a.stats.wfcTown});
    // Upper terraces have a real notch: the incoming staircase must not run
    // through the solid front face of the 4 m retaining wall.
    const sideWidth=district.halfWidth-3.6,sideCenter=(district.halfWidth+3.6)/2;
    const back=Math.max(9.5,13.2*district.buildingWidthScale);
    const parts=tier ? [[-sideCenter,sideWidth,(9.5-back)/2,back+9.5],[sideCenter,sideWidth,(9.5-back)/2,back+9.5],[0,7.2,(2-back)/2,back+2]] : [[0,29,0,19]];
    parts.forEach(([dx,width,dz,depth],part)=>{
      box('west-city-'+district.id+'-retaining-wall-'+part,WEST_CITY.x+dx,district.y-2.1,district.z+dz,width,4,depth);
      walkBox('west-city-'+district.id+'-promenade-'+part,WEST_CITY.x+dx,district.y-.1,district.z+dz,width,.2,depth,paving);
    });
    if(tier){
      const lower=WEST_CITY.districts[tier-1];
      const startZ=lower.z-2,endZ=district.z+2;
      const n=44;
      route.push([WEST_CITY.x,lower.y,startZ+.12]);
      for(let i=0;i<n;i++)walkBox('west-city-stair-'+tier+'-'+i,WEST_CITY.x,
        lower.y+(district.y-lower.y)*(i+1)/n-.1,startZ+(endZ-startZ)*(i+.5)/n,
        7.2,.2,Math.abs(endZ-startZ)/n+.05,paving);
      for(let i=0;i<n;i++)route.push([WEST_CITY.x,lower.y+(district.y-lower.y)*(i+1)/n,startZ+(endZ-startZ)*(i+.5)/n]);
      route.push([WEST_CITY.x,district.y,endZ-.12],[WEST_CITY.x,district.y,district.z]);
    }
  });
  // Gate court switchback: two separated flights reach the east front tower roof.
  // Narrow inner flights leave the original main entrance axis accessible.
  route.push([WEST_CITY.x,16,9.5],[WEST_CITY.x+3,16,9.5]);
  const courtSteps=24;
  const courtStone=new THREE.Group();courtStone.name='citadel-court-structure';root.add(courtStone);
  function courtBlock(name,x,y,z,w,h,d){
    const m=box(name,x,y,z,w,h,d,paving);courtStone.attach(m);return m;
  }

  for(let flight=0;flight<2;flight++){
    const x=WEST_CITY.x+(flight===0?3:0),start=flight===0?9:2,end=flight===0?2:9;
    const base=16+flight*3.15;
    if(flight===1)route.push([x,base,1.8]);
    for(let i=0;i<courtSteps;i++){
      const z=start+(end-start)*(i+.5)/courtSteps,y=base+3.15*(i+1)/courtSteps;
      walkBox('west-city-court-stair-'+flight+'-'+i,x,y-.1,z,1.8,.2,7/courtSteps+.04,paving);
      route.push([x,y,z]);
      for(const side of [-1,1]){
        // Supporting cheeks extend down to the courtyard, outside clear tread width.
        const cheekTop=y+(z<2.7?-.2:.72);
        courtBlock('court-cheek-'+flight+'-'+i+'-'+side,x+side*1.06,(16+cheekTop)/2,z,.28,cheekTop-16,7/courtSteps+.035);
      }
    }
    if(flight===0){
      walkBox('west-city-court-turn',WEST_CITY.x+1.5,19.05,1.75,4.8,.2,1.1,paving);
      route.push([x,19.15,1.8]);
    }
  }
  walkBox('west-city-court-upper-landing',WEST_CITY.x+1.5,22.2,9.5,4.8,.2,1.6,paving);
  walkBox('west-city-court-upper-link',WEST_CITY.x+3,22.2,8.85,1.6,.2,1.9,paving);
  walkBox('west-city-court-upper-gallery',WEST_CITY.x+4.5,22.2,8.3,4.6,.2,1.5,paving);
  route.push([WEST_CITY.x,22.3,9.4],[WEST_CITY.x+3,22.3,9.4],[WEST_CITY.x+3,22.3,8.3],[WEST_CITY.x+6,22.3,8.3]);
  // Retain the stair-mouth opening while protecting the exposed turning edge.
  courtBlock('court-upper-front-guard',WEST_CITY.x+1.5,22.72,10.42,5.05,.84,.22);
  courtBlock('court-upper-left-guard',WEST_CITY.x-1.08,22.72,9.5,.22,.84,1.85);
  courtBlock('court-upper-inner-guard',WEST_CITY.x+1.53,22.72,8.60,1.10,.84,.20);
  courtBlock('court-turn-rear-guard',WEST_CITY.x+1.5,19.57,1.04,5.08,.84,.24);
  courtBlock('court-turn-left-support',WEST_CITY.x-1.06,17.55,1.75,.28,3.1,1.1);
  courtBlock('court-turn-right-support',WEST_CITY.x+4.06,17.55,1.75,.28,3.1,1.1);
  // Upper gallery enters the WFC-reserved doorway at the central tower front.
  walkBox('west-city-main-tower-entry-bridge',WEST_CITY.x+3,22.2,6.1,1.5,.2,5.8,paving);
  walkBox('west-city-main-tower-entry-crossing',WEST_CITY.x+1.5,22.2,4,4.5,.2,1.5,paving);
  walkBox('west-city-main-tower-entry-floor',WEST_CITY.x,22.2,-.6,3.5,.2,10.6,paving);
  route.push([WEST_CITY.x+3,22.3,8.3],[WEST_CITY.x+3,22.3,4],[WEST_CITY.x,22.3,4],[WEST_CITY.x-1,22.3,-2.8],[WEST_CITY.x-1,22.3,-3.4]);
  const interiorStairs=buildTowerInteriorStairs();root.add(interiorStairs);route.push(...interiorStairs.userData.route);
  walkBox('west-city-main-tower-upper-exit',WEST_CITY.x,36.9,-.05,2.2,.2,6.1,paving);
  walkBox('west-city-main-tower-upper-balcony',WEST_CITY.x,36.9,2.4,6,.2,3.2,paving);
  route.push([WEST_CITY.x,37,-2.5],[WEST_CITY.x,37,2.4]);
  // Enclose exposed balcony edges, keeping the central tower approach open.
  courtBlock('tower-balcony-front-parapet',WEST_CITY.x,37.48,3.86,6,.96,.28);
  courtBlock('tower-balcony-front-coping',WEST_CITY.x,38.01,3.86,6.16,.14,.42);
  for(const side of [-1,1]){
    courtBlock('tower-balcony-side-parapet',WEST_CITY.x+side*2.86,37.48,2.35,.28,.96,3.3);
    courtBlock('tower-balcony-side-coping',WEST_CITY.x+side*2.86,38.01,2.35,.42,.14,3.44);
    courtBlock('tower-balcony-rear-parapet',WEST_CITY.x+side*2.02,37.48,.84,1.68,.96,.28);
    courtBlock('tower-balcony-rear-coping',WEST_CITY.x+side*2.02,38.01,.84,1.68,.14,.42);
    // A stepped stone corbel carries each side back into the tower facade.
    for(let tier=0;tier<4;tier++){
      const reach=1.0+tier*.65;
      courtBlock('tower-balcony-corbel',WEST_CITY.x+side*2.2,35.15+tier*.42,.72+reach/2,.62,.44,reach);
    }
  }
  courtBlock('tower-balcony-fascia',WEST_CITY.x,36.73,2.4,6.12,.24,3.32);
  const upperPortal=buildUpperTowerPortal(paving);upperPortal.position.set(WEST_CITY.x,37,1.0);courtStone.add(upperPortal);
  mergeStaticGroup(courtStone,{mergedTag:'court-structure'});
  courtStone.traverse(m=>{if(m.isMesh)m.name='court-solid-stone';});
  root.userData.upperRouteStatus='main-tower-37m-upper-balcony-connected; stone-parapet-and-corbels; battle-pending';

  root.add(buildProcessionalDetails());
  // Harbor landing follows the existing spherical lake height, not the plaza's elevation.
  const dockY=waterHeight(30.5,56)+.9;
  walkBox('west-city-harbor-quay',36.75,dockY-.25,58,12.5,.5,4,paving);
  const harborRoute=[[WEST_CITY.x-14.5,4,78],[42,4,78]];
  walkBox('west-city-harbor-top-landing',43.75,3.9,79,5.5,.2,2.05,paving);
  const harborSteps=Math.ceil((4-dockY)/.14),harborRun=20;
  for(let i=0;i<harborSteps;i++){
    const z=78-harborRun*(i+.5)/harborSteps,y=4+(dockY-4)*(i+1)/harborSteps;
    walkBox('west-city-stair-harbor-'+i,42,y-.1,z,3.6,.2,harborRun/harborSteps+.03,paving);
    harborRoute.push([42,y,z]);
  }
  harborRoute.push([42,dockY,58],[36.75,dockY,58]);
  for(const x of [31.5,36.75,42])for(const z of [56.6,59.4]){
    const bottom=waterHeight(x,z)-2;
    box('west-city-harbor-pile-'+x+'-'+z,x,(dockY+bottom)/2,z,.46,dockY-bottom,.46,stone);
    box('west-city-harbor-bollard-'+x+'-'+z,x,dockY+.28,z,.42,.56,.42,stone);
  }
  root.userData.harborRoute=harborRoute;
  root.userData.harborAnchor=[36.75,dockY,58];
  root.userData.harborStatus='landing-and-stairs; original-ships-and-unloading-not-connected';
  const gate=buildCitadelMainGate();gate.position.set(WEST_CITY.x,16,11);root.add(gate);
  // Forecourt meets the first terrace without a raised lip. It stays open for
  // the Blender statue and the original horse actor reservation.
  walkBox('west-city-plaza-deck',WEST_CITY.x,3.9,71.5,32,.2,24,paving);
  box('west-city-plaza-foundation',WEST_CITY.x,1.8,71.5,32,4,24);
  const ring=new THREE.Mesh(new THREE.RingGeometry(4.6,5.2,48),stone);
  ring.name='west-city-plaza-paving-ring';ring.rotation.x=-Math.PI/2;
  ring.position.set(WEST_CITY.x,4.012,71.5);root.add(ring);
  const statue=buildCitadelPlazaStatue();statue.position.set(WEST_CITY.x,4,71.5);root.add(statue);
  root.userData.plazaAnchor=[WEST_CITY.x,4,71.5];
  root.userData.horseReservation=[WEST_CITY.x+11,4,71.5];
  root.userData.artStatus='blue-dome-and-statue-pass; main-facade-horse-harbor-lighting-pending';
  // A raised crossing leaves an open water corridor between the two cities.
  const direction=bridgeEnd.clone().sub(bridgeStart),length=direction.length();
  const axis=direction.clone().normalize(),normal=new THREE.Vector3(0,1,0).addScaledVector(axis,-axis.y).normalize();
  const side=new THREE.Vector3().crossVectors(axis,normal).normalize();
  const center=bridgeStart.clone().add(bridgeEnd).multiplyScalar(.5).addScaledVector(normal,-.15);
  const bridge=walkBox('west-city-bridge-deck',center.x,center.y,center.z,length+.3,.3,3.5,paving);
  bridge.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(axis,normal,side));
  for(const [i,p] of [bridgeStart,bridgeEnd].entries())walkBox('west-city-bridge-landing-'+i,p.x,p.y-.1,p.z,.6,.2,3.8,paving);
  const descent=[];const run=4.4,n=8,descentStart=bridgeEnd.x+2.6;
  walkBox('west-city-bridge-apron',bridgeEnd.x+1.25,4.93,bridgeEnd.z,2.7,.2,3.8,paving);
  for(let i=0;i<n;i++){
    const x=descentStart+run*(i+.5)/n,y=5.03-1.03*(i+1)/n;
    walkBox('west-city-stair-bridge-'+i,x,y-.1,bridgeEnd.z,run/n+.04,.2,3.5,paving);
    descent.push([x,y,bridgeEnd.z]);
  }
  route.splice(1,0,bridgeEnd.toArray(),[descentStart-.12,5.03,bridgeEnd.z],...descent,[WEST_CITY.x,4,WEST_CITY.districts[0].z]);
  for(const t of [.25,.7]){const p=bridgeStart.clone().lerp(bridgeEnd,t);box('west-city-bridge-pier-'+t,p.x,p.y-4,p.z,1.2,7.6,1.8);}
  root.userData.districts=reports;
  root.userData.connectedToMainGate=false;
  root.userData.walkRoute=route;
  // Source cell ownership stays in merged metadata; district seeds remain above.
  root.children.filter(n=>n.name.startsWith('west-city-')&&n.isGroup).forEach(g=>mergeStaticGroup(g,{
    mergedTag:'west-city',
    skip:mesh=>mesh.name==='town-window',
    onSurface:(mesh,_material,segments)=>{mesh.userData.faceToCell=segments.map(s=>({triStart:s.triStart,triCount:s.triCount,cell:s.mesh.userData.cell,cells:s.mesh.userData.cells}));},
  }));
  return root;
}
