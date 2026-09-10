import * as THREE from 'three';
import { mergeStaticGroup } from './geometryMerge.js';

/** Deterministic redistribution on the actual Kun terrain, in island local space.
 * Cover anchors follow the island, not swaying crowns. Original seeds stay intact.
 */
export function arrangeSaihojiPines(island, zones, whale) {
  island.updateWorldMatrix(true, true);
  const terrain = island.getObjectByName('leviathan-crust-plate');
  const ray = new THREE.Raycaster(), down = new THREE.Vector3(0,-1,0);
  const entries = Object.values(zones).flatMap(z=>z.pines.map(pine=>({pine,zone:z.definition.id,
    old:island.worldToLocal(pine.getWorldPosition(new THREE.Vector3()))})));
  const stones = Object.values(zones).flatMap(z=>z.stones);
  const stoneBoxes = stones.map(o=>new THREE.Box3().setFromObject(o));
  const worldScale = island.getWorldScale(new THREE.Vector3()).x;
  function surface(x,z) {
    const origin=island.localToWorld(new THREE.Vector3(x,10,z));
    ray.set(origin,down.clone().transformDirection(island.matrixWorld));ray.far=20*worldScale;
    const hit=ray.intersectObject(terrain,true)[0];
    if(!hit)return null;
    const p=island.worldToLocal(hit.point.clone());
    return p.y>=-.05?p:null; // keep off the steep terraces
  }
  function clearStone(p,margin=.12) {
    const w=island.localToWorld(p.clone());
    return !stoneBoxes.some(b=>w.x>b.min.x-margin&&w.x<b.max.x+margin&&w.y>b.min.y-margin&&w.y<b.max.y+margin&&w.z>b.min.z-margin&&w.z<b.max.z+margin);
  }
  const candidates=[];
  for(let z=-5.5,row=0;z<=5.5;z+=.65,row++)for(let x=-10.7+(row%2)*.31;x<=10.7;x+=.65){
    if((x/10.9)**2+(z/5.65)**2>1)continue;
    const p=surface(x,z);if(p&&clearStone(p,.22))candidates.push(p);
  }
  const placed=[];
  // The dominant authored trees select their positions first; companions fill gaps.
  entries.sort((a,b)=>(b.pine.userData.pineScale||1)-(a.pine.userData.pineScale||1));
  for(const entry of entries){
    let selected=null,best=Infinity;
    for(const separation of [3.05,2.7,2.4]){
      for(const p of candidates){
        if(placed.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<separation))continue;
        const distance=(p.x-entry.old.x)**2+(p.z-entry.old.z)**2;
        const cost=distance+(Math.abs(p.z)<.8?30:0);
        if(cost<best){best=cost;selected=p;}
      }
      if(selected)break;
    }
    if(!selected)throw new Error('Kun pine layout has insufficient supported ground');
    const pine=entry.pine,oldParent=pine.position.clone();
    const islandQ=island.getWorldQuaternion(new THREE.Quaternion());
    const localQ=islandQ.clone().invert().multiply(pine.getWorldQuaternion(new THREE.Quaternion()));
    const forward=new THREE.Vector3(0,0,1).applyQuaternion(localQ);
    const upright=islandQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(forward.x,forward.z)));
    pine.quaternion.copy(pine.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(upright));
    // Target silhouette has broad layered crowns, not tall narrow trees.
    // Scale the whole branching silhouette together so foliage stays attached.
    pine.scale.x*=1.35;pine.scale.z*=1.35;pine.scale.y*=1.2;
    pine.userData.whaleBackCrownWidth=1.35;pine.userData.whaleBackHeight=1.2;
    const destination=selected.clone();destination.y+=.015;
    pine.position.copy(pine.parent.worldToLocal(island.localToWorld(destination.clone())));
    // Root moss is a separate group, so it follows this relocation before merging.
    pine.userData.rootMoss?.position.add(pine.position.clone().sub(oldParent));
    pine.userData.whaleBackLocal=destination.toArray();
    placed.push(destination);entry.current=destination;
  }
  island.updateWorldMatrix(true,true);
  const mossBatch=new THREE.Group();mossBatch.name='saihoji-relocated-root-moss';island.add(mossBatch);
  for(const {pine} of entries){const moss=pine.userData.rootMoss;if(moss){mossBatch.attach(moss);delete pine.userData.rootMoss;}}
  mergeStaticGroup(mossBatch);
  // Re-seat the scattered stepping stones on the same real plate. Their
  // irregular authored samples remain props, never a straight navigation road.
  const steppingStones=[];island.traverse(o=>{if(o.userData.kind==='stoneStep')steppingStones.push(o);});
  const stonePoints=[];
  for(const stone of steppingStones){
    const desired=island.worldToLocal(stone.getWorldPosition(new THREE.Vector3()));
    const valid=p=>p&&clearStone(p,.1)&&placed.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>1.1)&&stonePoints.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>.8);
    let p=surface(desired.x,desired.z);
    if(!valid(p))p=candidates.filter(valid).sort((a,b)=>a.distanceToSquared(desired)-b.distanceToSquared(desired))[0];
    if(!p){stone.visible=false;continue;}
    p=p.clone();p.y+=.008;
    const islandQ=island.getWorldQuaternion(new THREE.Quaternion());
    const localQ=islandQ.clone().invert().multiply(stone.getWorldQuaternion(new THREE.Quaternion()));
    const f=new THREE.Vector3(0,0,1).applyQuaternion(localQ);
    const upright=islandQ.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),Math.atan2(f.x,f.z)));
    stone.position.copy(stone.parent.worldToLocal(island.localToWorld(p.clone())));
    stone.quaternion.copy(stone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(upright));
    stonePoints.push(p);
  }
  whale.userData.steppingStoneLayoutReport={style:'scattered-zen',count:steppingStones.length,supported:stonePoints.length,points:stonePoints.map(p=>p.toArray())};
  island.updateWorldMatrix(true,true);
  // Solve cover packing globally: a point under one broad crown must not
  // consume the only usable space of its neighbour. All candidates are real
  // ground + real leaf intersections; retries change order, never tolerances.
  const pool=[];
  for(const entry of entries){
    for(let z=entry.current.z-4;z<=entry.current.z+4;z+=.3)for(let x=entry.current.x-4;x<=entry.current.x+4;x+=.3){
      const p=surface(x,z);
      if(!p||!clearStone(p,.16)||placed.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<1.1))continue;
      ray.set(island.localToWorld(new THREE.Vector3(p.x,15,p.z)),down.clone().transformDirection(island.matrixWorld));
      ray.far=20*worldScale;
      const leafHits=ray.intersectObject(entry.pine,true).filter(h=>['n10','n11','n12'].includes(h.object.userData.sourceNodeId));
      const clearance=leafHits.length?Math.min(...leafHits.map(h=>(island.worldToLocal(h.point.clone()).y-p.y)*worldScale)):0;
      if(clearance<1.12)continue;
      p.y+=.04;
      pool.push({anchor:island,localPoint:p,pine:entry.pine,canopyHeight:clearance,clearance});
    }
  }
  let covers=[];
  for(let attempt=0;attempt<192&&covers.length<50;attempt++){
    let random=884+attempt*7919;
    const order=pool.slice();
    for(let i=order.length-1;i>0;i--){random=(Math.imul(random,1664525)+1013904223)>>>0;const j=random%(i+1);[order[i],order[j]]=[order[j],order[i]];}
    const selected=[];
    for(const candidate of order){
      if(selected.some(c=>c.localPoint.distanceTo(candidate.localPoint)<1.45))continue;
      selected.push(candidate);if(selected.length===50)break;
    }
    if(selected.length>covers.length)covers=selected;
  }
  covers=covers.map((c,i)=>({...c,id:`pine-${c.pine.userData.sourceSeed}-cover-${i}`}));
  let minSpacing=Infinity;
  for(let i=0;i<placed.length;i++)for(let j=0;j<i;j++)minSpacing=Math.min(minSpacing,placed[i].distanceTo(placed[j])*worldScale);
  whale.userData.saihojiCoverPoints=covers;
  whale.userData.pineLayoutReport={revision:'kun-spread-v1',trees:entries.length,coverCount:covers.length,minRootWorldSpacing:minSpacing,
    entries:entries.map(e=>({seed:e.pine.userData.sourceSeed,zone:e.zone,before:e.old.toArray(),after:e.current.toArray()})),
    scope:'Actual terrain supported roots and cover slots; canopy overlap and walking routes require visual/runtime review'};
  return whale.userData.pineLayoutReport;
}
