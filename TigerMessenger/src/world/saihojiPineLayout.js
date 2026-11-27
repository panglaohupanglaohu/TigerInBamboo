import * as THREE from 'three';
import { mergeStaticGroup } from './geometryMerge.js';
import { isSaihojiPool, SAIHOJI_TARGET_REVISION } from './saihojiTargetGarden.js';
import { SAIHOJI_PINE_CLUSTERS } from '../assets/saihojiClusterPine.js';

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
  for(let z=-5.5,row=0;z<=5.5;z+=.65,row++)for(let x=-14.6+(row%2)*.31;x<=14.6;x+=.65){
    if((x/14.85)**2+(z/5.65)**2>1||isSaihojiPool(x,z,.45))continue;
    const p=surface(x,z);if(p&&clearStone(p,.22))candidates.push(p);
  }
  const placed=[];
  // 2026-11-11 用户参考图：丛松。每丛在期望中心附近找一个「所有成员根部都落在
  // 真实地壳、避开浅池与石组」的位置；丛内根距按树高比例（0.058–0.15H），
  // 不再走旧的 2.75–3.35 m 均匀散布。旧 25 株路径见 artifacts/backups/pines-20261111。
  const clusterReports=[];
  const islandQ=island.getWorldQuaternion(new THREE.Quaternion());
  const islandScale=island.getWorldScale(new THREE.Vector3()).x;
  const yAxis=new THREE.Vector3(0,1,0);
  for(const cluster of SAIHOJI_PINE_CLUSTERS){
    const members=entries.filter(e=>e.pine.userData.pineCluster===cluster.id);
    if(!members.length)continue;
    const H=members.reduce((s,e)=>s+e.pine.userData.targetHeight,0)/members.length;
    const rootsAt=(cx,cz,yaw)=>members.map(e=>{const [dx,dz]=e.pine.userData.clusterOffset;const o=new THREE.Vector3(dx*H,0,dz*H).applyAxisAngle(yAxis,yaw);return {x:cx+o.x,z:cz+o.z};});
    // 期望中心附近 + 期望朝向 ±0.6 rad 内找可用位；朝向偏离按 (4·Δyaw)² 计代价
    let best=null,bestCost=Infinity,bestYaw=cluster.yaw;
    for(const dyaw of [0,-.3,.3,-.6,.6])for(let oz=-3;oz<=3;oz+=.25)for(let ox=-5;ox<=5;ox+=.25){
      const cost=ox*ox+oz*oz+(4*dyaw)**2;if(cost>=bestCost)continue;
      const yaw=cluster.yaw+dyaw,roots=rootsAt(cluster.cx+ox,cluster.cz+oz,yaw),hits=[];
      let ok=true;
      for(const r of roots){
        // 2026-11-26 用户要求树与间距等比 ×4：丛跨幅超岛宽，允许根探出岛缘立进水线面（y=0）、
        // 允许落在浅池边（深水心仍避开），椭圆界放宽到 1.45。
        if((r.x/14.85)**2+(r.z/5.65)**2>1.45||isSaihojiPool(r.x,r.z,-.2)){ok=false;break;}
        const hitP=surface(r.x,r.z),p=hitP||new THREE.Vector3(r.x,0,r.z);
        if(hitP&&!clearStone(p,.15)){ok=false;break;}
        if(placed.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<H*.3)){ok=false;break;}
        hits.push(p);
      }
      if(ok){best=hits;bestCost=cost;bestYaw=yaw;}
    }
    if(!best)throw new Error(`Kun pine cluster ${cluster.id} has insufficient supported ground`);
    members.forEach((entry,i)=>{
      const pine=entry.pine,oldParent=pine.position.clone(),destination=best[i].clone();destination.y+=.015;
      const upright=islandQ.clone().multiply(new THREE.Quaternion().setFromAxisAngle(yAxis,bestYaw));
      pine.quaternion.copy(pine.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(upright));
      const parentScale=pine.parent.getWorldScale(new THREE.Vector3()).x/islandScale;
      pine.scale.setScalar(pine.userData.targetHeight/pine.userData.height/parentScale);
      pine.position.copy(pine.parent.worldToLocal(island.localToWorld(destination.clone())));
      pine.userData.rootMoss?.position.add(pine.position.clone().sub(oldParent));
      pine.userData.whaleBackLocal=destination.toArray();
      pine.userData.islandHeight=pine.userData.targetHeight;
      // 叶片吸食起点（世界单位，约树冠中部）
      pine.userData.crownWorldHeight=pine.userData.targetHeight*islandScale*.78;
      placed.push(destination);entry.current=destination;
    });
    clusterReports.push({id:cluster.id,trees:members.length,meanHeight:H,yaw:bestYaw,center:[cluster.cx,cluster.cz],roots:best.map(p=>[p.x,p.z])});
  }
  if(entries.some(e=>!e.current))throw new Error('Kun pine entry without cluster');
  // 丛下苔霜毯：参考图「圆润、覆白霜与苔藓的岩丘」。极薄（≤0.1 局部单位），
  // 不改变地壳支撑与士兵隐蔽槽高度；每丛合并成少量网格。
  const frostBatch=new THREE.Group();frostBatch.name='saihoji-cluster-frost-moss';island.add(frostBatch);
  const frostMats=[0x5d7454,0x6e8458,0x51684c,0xc9d0c4,0xb7bfae].map(color=>new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true}));
  const rockMat=new THREE.MeshStandardMaterial({color:0x8d8f86,roughness:1,flatShading:true});
  let frostSeed=5113;const fr=()=>((frostSeed=(Math.imul(frostSeed,1664525)+1013904223)>>>0)/4294967296);
  for(const c of clusterReports){
    const cx=c.roots.reduce((s,r)=>s+r[0],0)/c.roots.length,cz=c.roots.reduce((s,r)=>s+r[1],0)/c.roots.length,R=c.meanHeight*.36;
    for(let i=0;i<22;i++){
      const a=fr()*Math.PI*2,d=Math.sqrt(fr())*R,x=cx+Math.cos(a)*d,z=cz+Math.sin(a)*d;
      if(isSaihojiPool(x,z,.2))continue;const p=surface(x,z);if(!p)continue;
      const n=9,verts=[0,0,0],faces=[];const rx=.5+fr()*.9,rz=.4+fr()*.7;
      for(let k=0;k<n;k++){const t=k/n*Math.PI*2,j=.75+fr()*.4;verts.push(Math.cos(t)*rx*j,-.03,Math.sin(t)*rz*j);faces.push(0,(k+1)%n+1,k+1);}
      verts[1]=.06+fr()*.05;
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(faces);g.computeVertexNormals();
      const frost=d<R*.55?fr()<.45:fr()<.2;
      const m=new THREE.Mesh(g,frostMats[frost?3+(i%2):i%3]);m.position.set(p.x,p.y+.02+i*.001,p.z);m.rotation.y=fr()*Math.PI;m.receiveShadow=true;frostBatch.add(m);
    }
    for(const [x,z] of c.roots){ // 根际小石，露出苔面
      for(let k=0;k<2;k++){const a=fr()*Math.PI*2,d=.5+fr()*.5,p=surface(x+Math.cos(a)*d,z+Math.sin(a)*d);if(!p||isSaihojiPool(p.x,p.z,.2))continue;
        const s=.13+fr()*.12,r=new THREE.Mesh(new THREE.IcosahedronGeometry(1,0),rockMat);r.scale.set(s*1.4,s*.55,s);r.position.set(p.x,p.y+s*.2,p.z);r.rotation.y=a;frostBatch.add(r);}
    }
  }
  mergeStaticGroup(frostBatch);
  const LEGACY_SEPARATED_LAYOUT=false;
  for(const entry of LEGACY_SEPARATED_LAYOUT?entries:[]){
    let selected=null,best=Infinity;
    for(const separation of [3.35,3.05,2.75]){
      for(const p of candidates){
        if(placed.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<separation))continue;
        const distance=(p.x-entry.old.x*1.35)**2+(p.z-entry.old.z)**2;
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
    const authoredScale=pine.userData.pineScale||1;
    // Keep small companion trees' equipment clearance. Compress only the
    // towering heroes and, more gently, the middle tier as whole branching
    // silhouettes so neither foliage nor branches detach from their trunks.
    const heightScale=authoredScale>1.15?.93:authoredScale>=.95?1.07:1.2;
    pine.scale.x*=1.42;pine.scale.z*=1.42;pine.scale.y*=heightScale;
    pine.userData.whaleBackCrownWidth=1.42;pine.userData.whaleBackHeight=heightScale;
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
    const valid=p=>p&&!isSaihojiPool(p.x,p.z,.3)&&clearStone(p,.1)&&placed.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>1.1)&&stonePoints.every(q=>Math.hypot(p.x-q.x,p.z-q.z)>.8);
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
    // 2026-11-11 只留一丛 6 棵（用户：数量按图示）：每棵冠幅随 ×2.5 变大，搜索窗从 ±4 放到 ±8，才能在 6 棵树冠下找够 50 个伏击隐蔽槽（间距、净空要求不变）
    for(let z=entry.current.z-8;z<=entry.current.z+8;z+=.3)for(let x=entry.current.x-8;x<=entry.current.x+8;x+=.3){
      const p=surface(x,z);
      if(!p||isSaihojiPool(p.x,p.z,.32)||!clearStone(p,.16)||placed.some(q=>Math.hypot(p.x-q.x,p.z-q.z)<1.1))continue;
      // 丛松树高 ≈ 12–17（岛局部），射线起点抬到 40，覆盖整株树冠
      // 树冠下 = 该点或周围 1.2 内任一竖线穿过叶垫（叶垫之间的缝也算在树荫里；2026-11-11 只剩 6 棵后补）
      const leafHits=[];
      for(const [ox,oz] of [[0,0],[.7,0],[-.7,0],[0,.7],[0,-.7],[1.2,0],[-1.2,0],[0,1.2],[0,-1.2]]){
        ray.set(island.localToWorld(new THREE.Vector3(p.x+ox,40,p.z+oz)),down.clone().transformDirection(island.matrixWorld));
        ray.far=45*worldScale;
        leafHits.push(...ray.intersectObject(entry.pine,true).filter(h=>h.object.userData.pineCrown||['n10','n11','n12'].includes(h.object.userData.sourceNodeId)));
      }
      const clearance=leafHits.length?Math.min(...leafHits.map(h=>(island.worldToLocal(h.point.clone()).y-p.y)*worldScale)):0;
      if(clearance<1.12)continue; // Taller bows receive higher slots in the ambush allocator.
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
    // 只剩一丛 6 棵：1.45 间距排不满 50 时，余下的按 1.0 间距在同一树冠下补满（伏击 50 人都要藏到松荫里，否则苔庭战卡在 cover-capacity）
    if(selected.length<50)for(const candidate of order){
      if(selected.includes(candidate)||selected.some(c=>c.localPoint.distanceTo(candidate.localPoint)<1.0))continue;
      selected.push(candidate);if(selected.length===50)break;
    }
    if(selected.length>covers.length)covers=selected;
  }
  covers=covers.map((c,i)=>({...c,id:`pine-${c.pine.userData.sourceSeed}-cover-${i}`}));
  let minSpacing=Infinity;
  for(let i=0;i<placed.length;i++)for(let j=0;j<i;j++)minSpacing=Math.min(minSpacing,placed[i].distanceTo(placed[j])*worldScale);
  whale.userData.saihojiCoverPoints=covers;
  whale.userData.pineLayoutReport={revision:SAIHOJI_TARGET_REVISION,style:'cluster-pines-20261111',clusters:clusterReports,trees:entries.length,coverCount:covers.length,minRootWorldSpacing:minSpacing,
    entries:entries.map(e=>({seed:e.pine.userData.sourceSeed,zone:e.zone,before:e.old.toArray(),after:e.current.toArray()})),
    scope:'Actual terrain supported roots and cover slots; canopy overlap and walking routes require visual/runtime review'};
  return whale.userData.pineLayoutReport;
}
