import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, writeFileSync, mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as T from 'three';
import {createTargetCityDetailCandidate} from '../../src/world/citadel/targetCityDetailCandidate.js';
import {actualCliffTransitFixture} from './targetCliffTransitStructure.fixture.mjs';

// Read-only CPU survey. Unlike the connection regression, this follows every
// upper gallery segment and crosses the independently constructed section ends.
test('entire loaded-freight upper walkway has continuous real ground and finite body clearance',()=>{
 const sources=['src/world/citadel/targetCityDetailCandidate.js','src/world/citadel/targetCliffTransitStructure.js','src/world/citadel/targetCliffRailGallery.js','src/world/citadel/targetCityPlayerSupport.js','src/world/citadel/targetTerrainCandidate.js','src/world/citadel/targetOldShoreApronField.js','src/world/citadel/targetCoastalCliffCutField.js','tests/world/targetCliffTransitStructure.fixture.mjs'];
 const hashes=Object.fromEntries(sources.map(p=>[p,createHash('sha256').update(readFileSync(new URL('../../'+p,import.meta.url))).digest('hex')]));
 const f=actualCliffTransitFixture(),c=createTargetCityDetailCandidate({castle:f.castle,cliffTransitRelease:f.release,fitSunShadow:false});
 f.castle.add(c.root);f.scene.updateMatrixWorld(true);
 const provider=c.getPlayerSupport(),inverse=f.castle.matrixWorld.clone().invert();
 const report={schema:'upper-walk-continuity-cpu-1',createdAt:new Date().toISOString(),sourceHashes:hashes,walkwayHeight:c.report.cliffTransit.walkwayHeight,stepLimit:.1,supportTolerance:.06,bodyCentreOffsets:[-.4,0,.4],floorOffsets:[-1.8,0,1.8],sections:[],seams:[],queries:{ground:0,walls:0},failures:[],gpuVerified:false,limitations:['Finite provider rays, not exact capsule or ceiling collision.','Static actual production curves and fixture terrain; no renderer, live player input, ships or future WFC edits.','Only the three public upper galleries and their mutual seams are covered here; separate tests cover city access connections.'],startup:f.startupReport};
 const fail=x=>report.failures.push(x);
 const worldPath=key=>c.report.cliffTransit.galleries[key].upperPath.map(p=>new T.Vector3(...p).applyMatrix4(f.castle.matrixWorld));
 const names=['oldShore','central','newShore'];
 // Curves are east-to-west. Reverse each section to walk old-to-new.
 const sections=names.map(key=>({key,points:worldPath(key).reverse()}));
 function sideAt(points,i){const a=points[Math.max(0,i-1)],b=points[Math.min(points.length-1,i+1)];return points[i].clone().normalize().cross(b.clone().sub(a).normalize()).normalize();}
 function grounded(p,context){report.queries.ground++;const r=provider.ground(p),difference=r===null?null:r-p.length();if(r===null||Math.abs(difference)>report.supportTolerance)fail({...context,type:'ground',world:p.toArray(),local:p.clone().applyMatrix4(inverse).toArray(),radius:r,difference,diagnostic:provider.report().lastGround});return r===null?p.clone():p.clone().setLength(r);}
 function sweep(points,sides,context){
  for(const reverse of[false,true])for(const lateral of report.bodyCentreOffsets){const ps=reverse?[...points].reverse():points,ss=reverse?[...sides].reverse():sides;let previous=grounded(ps[0].clone().addScaledVector(ss[0],lateral),{...context,reverse,lateral,index:0});
   for(let j=1;j<ps.length;j++){const a=ps[j-1].clone().addScaledVector(ss[j-1],lateral),b=ps[j].clone().addScaledVector(ss[j],lateral),steps=Math.max(1,Math.ceil(a.distanceTo(b)/report.stepLimit));
    for(let i=1;i<=steps;i++){const ctx={...context,reverse,lateral,index:j,fraction:i/steps},world=grounded(a.clone().lerp(b,i/steps),ctx);report.queries.walls++;if(provider.walls(previous,world.clone(),world.clone().sub(previous)))fail({...ctx,type:'body',world:world.toArray(),local:world.clone().applyMatrix4(inverse).toArray(),diagnostic:provider.report().lastWall});previous=world;}
   }
  }
 }
 try{
  assert.equal(report.walkwayHeight,6.9);
  for(const section of sections){const {key,points}=section,sides=points.map((_,i)=>sideAt(points,i)),length=points.reduce((n,p,i)=>n+(i?p.distanceTo(points[i-1]):0),0);report.sections.push({key,length,vertices:points.length,startLocal:points[0].clone().applyMatrix4(inverse).toArray(),endLocal:points.at(-1).clone().applyMatrix4(inverse).toArray()});
   sweep(points,sides,{section:key});
   for(let j=0;j<points.length;j++)for(const lateral of report.floorOffsets)grounded(points[j].clone().addScaledVector(sides[j],lateral),{section:key,typeOfSurvey:'floor-width',index:j,lateral});
  }
  for(let j=1;j<sections.length;j++){const a=sections[j-1],b=sections[j],points=[...a.points.slice(-3),...b.points.slice(0,3)],sides=points.map((_,i)=>sideAt(points,i));const seam={from:a.key,to:b.key,gap:a.points.at(-1).distanceTo(b.points[0]),localA:a.points.at(-1).clone().applyMatrix4(inverse).toArray(),localB:b.points[0].clone().applyMatrix4(inverse).toArray()};report.seams.push(seam);if(seam.gap>.02)fail({type:'seam-gap',...seam});sweep(points,sides,{seam:a.key+'->'+b.key});for(let k=0;k<points.length;k++)for(const lateral of report.floorOffsets)grounded(points[k].clone().addScaledVector(sides[k],lateral),{seam:a.key+'->'+b.key,typeOfSurvey:'floor-width',index:k,lateral});}
  report.provider=provider.report();
  // Keep the original 6cm plane deviations verbatim. Authored connection
  // treads at the outer edge are reported separately from through-route failure.
  report.flatnessPass=report.failures.length===0;
  report.edgeStepObservations=report.failures.filter(x=>x.typeOfSurvey==='floor-width'&&x.type==='ground'&&x.radius!==null&&x.difference>0&&x.difference<=report.provider.contract.maxStepUp&&/^(old|new)-city-link-treads$/.test(x.diagnostic?.mesh));
  report.coreFailures=report.failures.filter(x=>!report.edgeStepObservations.includes(x));
  report.pass=report.coreFailures.length===0;report.edgeWalkingVerified=false;
  const output=process.env.CITADEL_WALK_CONTINUITY_REPORT;
  if(output){mkdirSync(new URL('.',new URL(output,'file://'+process.cwd()+'/')),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2)+'\n');}
  console.log(JSON.stringify({pass:report.pass,queries:report.queries,seams:report.seams,coreFailures:report.coreFailures.length,edgeStepObservations:report.edgeStepObservations.length,flatnessPass:report.flatnessPass,firstFailures:report.failures.slice(0,6),output}));
  assert.ok(report.queries.walls>15000);assert.equal(report.coreFailures.length,0,JSON.stringify(report.coreFailures.slice(0,8)));
 }finally{c.dispose();f.dispose();}
});
