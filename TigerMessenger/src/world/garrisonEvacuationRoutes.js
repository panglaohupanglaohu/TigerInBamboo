import * as THREE from 'three';
import {createSoccoBerthSolver} from './soccoBerth.js';
import {createSoccoGroundRoutes} from './soccoGroundRoutes.js';
import {intersectTerrainSet} from './terrainRayIndex.js';
import {officialOceanLevelAt} from './waterV8/officialOcean.js';
import {PLANET_RADIUS} from './planet.js';

// Local evacuation only: reuse the existing measured dry-ground A* and
// tree/stone triangle clearance, without pretending a tram stop is dry ground.
export function createGarrisonEvacuationRoutes(scene) {
  scene.updateMatrixWorld(true);
  const terrain=[];
  scene.traverse(o=>{
    const n=o.name||'',p=o.parent?.name||'';
    if(o.isMesh&&(n==='planet-surface'||n==='mossy-terrain'||n==='leviathan-crust-plate'||n==='leviathan-terrain-topography'||n.startsWith('leviathan-moss-bed')||p==='mossyGround'))terrain.push(o);
  });
  const ray=new THREE.Raycaster(),hits=[],direction=new THREE.Vector3();
  function sample(point){
    direction.copy(point).normalize();
    ray.set(direction.clone().multiplyScalar(PLANET_RADIUS+48),direction.clone().negate());ray.far=70;
    hits.length=0;intersectTerrainSet(terrain,ray,hits);
    const hit=hits.find(h=>{for(let o=h.object;o;o=o.parent){if(!o.visible)return false;if(o===scene)return true;}return false;});
    if(!hit||hit.point.length()<=PLANET_RADIUS+officialOceanLevelAt(direction)+.075)return null;
    return hit.point.clone();
  }
  const source=createSoccoBerthSolver(scene,PLANET_RADIUS+.5);
  let obstacles=null;
  const surface={sample,obstacleMeshes:()=>obstacles||(obstacles=source.obstacleMeshes())};
  const planners=new Map();
  function planner(pair){
    if(!planners.has(pair))planners.set(pair,createSoccoGroundRoutes(scene,surface,null,{radius:pair ? .8 : .55,height:1.55,footOffset:.22}));
    return planners.get(pair);
  }
  function plan(start,originalHome,{pair=false,occupied=[]}={}) {
    const solver=planner(pair),up=originalHome.clone().normalize();
    const east=new THREE.Vector3(0,1,0).cross(up).normalize(),north=up.clone().cross(east).normalize();
    const candidates=[];
    for(let x=-8;x<=8;x+=2)for(let z=-8;z<=8;z+=2){
      if(x*x+z*z>64)continue;
      const requested=up.clone().multiplyScalar(PLANET_RADIUS).addScaledVector(east,x).addScaledVector(north,z);
      const ground=sample(requested);if(!ground)continue;
      const target=ground.clone().addScaledVector(ground.clone().normalize(),.22);
      if(occupied.some(p=>p.distanceTo(target)<(pair?1.8:1.2))||!solver.clear(target,target))continue;
      candidates.push({target,offset:Math.hypot(x,z)});
    }
    candidates.sort((a,b)=>a.offset-b.offset);
    const attempts=[];
    for(const candidate of candidates.slice(0,8)){
      const route=solver.planReturn(start,candidate.target,{maxDistance:65,maxVisits:1800});
      if(route.valid&&route.startCorrection<=.7){
        return {...route,originalHome:originalHome.toArray(),destination:candidate.target.toArray(),homeAdjustment:candidate.offset,pair,source:'same-shore-dry-candidate-and-existing-socco-ground-A*',solver};
      }
      attempts.push({destination:candidate.target.toArray(),reason:route.valid?'start-support-gap':route.reason,startCorrection:route.startCorrection,visits:route.visits});
    }
    return {valid:false,reason:candidates.length?'no-dry-connected-home':'no-dry-home-near-stop',originalHome:originalHome.toArray(),attempts};
  }
  function approach(start,target){
    const solver=planner(false),route=solver.planReturn(start,target,{maxDistance:30,maxVisits:1800});
    return route.valid&&route.startCorrection<=.7?{...route,solver}:{valid:false,reason:route.reason||"start-support-gap"};
  }
  function pointAt(route,distance,out=new THREE.Vector3()){
    route.solver.pointAt(route,route.length?distance/route.length:1,out);
    const ground=sample(out);return ground?out.copy(ground).addScaledVector(ground.clone().normalize(),.22):null;
  }
  return {plan,approach,pointAt,sample};
}
