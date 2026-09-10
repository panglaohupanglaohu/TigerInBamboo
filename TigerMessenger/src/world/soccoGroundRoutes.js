import * as THREE from 'three';

// Short shore routes on the sphere. Snapshot the authored static obstacles once
// per berth; moving combat targets and crowd steering are separate systems.
export function createSoccoGroundRoutes(scene, terrain, craft) {
  scene.updateMatrixWorld(true);
  const meshes=terrain.obstacleMeshes();
  const bounds=meshes.map(mesh=>({mesh,box:mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld),meshInverse:mesh.matrixWorld.clone().invert()}));
  const craftInverse=craft.matrixWorld.clone().invert();
  const hull=new THREE.Box3(new THREE.Vector3(-1.55,-2.1,-2.65),new THREE.Vector3(1.55,1.2,2.5));
  const radius=.38,height=1.55;
  const clearanceCache=new Map(),groundCache=new Map();
  const key=p=>`${p.x.toFixed(5)},${p.y.toFixed(5)},${p.z.toFixed(5)}`;
  function clear(a,b){
    const ends=[key(a),key(b)].sort().join('|');
    if(!clearanceCache.has(ends))clearanceCache.set(ends,clearUncached(a,b));
    return clearanceCache.get(ends);
  }
  function clearUncached(a,b) {
    const up=a.clone().add(b).normalize(),center=a.clone().add(b).multiplyScalar(.5);
    let forward=b.clone().sub(a).projectOnPlane(up);
    if(forward.lengthSq()<1e-8)forward.set(0,1,0).cross(up);
    if(forward.lengthSq()<1e-8)forward.set(1,0,0);
    forward.normalize();
    const right=up.clone().cross(forward).normalize();
    const matrix=new THREE.Matrix4().makeBasis(right,up,forward).setPosition(center);
    const inverse=matrix.clone().invert(),length=a.distanceTo(b);
    const volume=new THREE.Box3(new THREE.Vector3(-radius,-.04,-length/2-radius),new THREE.Vector3(radius,height,length/2+radius));
    // Ground walkers may not take a shortcut through the carrier's hull.
    const worldBox=volume.clone().applyMatrix4(matrix);
    if(volume.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(craftInverse,matrix)).intersectsBox(hull))return false;
    for(const {mesh,box,meshInverse} of bounds){
      if(!worldBox.intersectsBox(box))continue;
      const transform=new THREE.Matrix4().multiplyMatrices(inverse,mesh.matrixWorld);
      const pos=mesh.geometry.attributes.position,index=mesh.geometry.index,tri=new THREE.Triangle();
      for(let i=0;i<(index?index.count:pos.count);i+=3){
        tri.a.fromBufferAttribute(pos,index?index.getX(i):i).applyMatrix4(transform);
        tri.b.fromBufferAttribute(pos,index?index.getX(i+1):i+1).applyMatrix4(transform);
        tri.c.fromBufferAttribute(pos,index?index.getX(i+2):i+2).applyMatrix4(transform);
        if(volume.intersectsTriangle(tri))return false;
      }
      // A body fully enclosed by a stone touches no surface triangles. An odd
      // ray intersection count catches that case instead of treating it as air.
      const localPoint=center.clone().applyMatrix4(meshInverse);
      if(mesh.geometry.boundingBox.containsPoint(localPoint)){
        const probe=new THREE.Ray(localPoint,new THREE.Vector3(1,.371,.217).normalize()),distances=[];
        for(let i=0;i<(index?index.count:pos.count);i+=3){
          tri.a.fromBufferAttribute(pos,index?index.getX(i):i);
          tri.b.fromBufferAttribute(pos,index?index.getX(i+1):i+1);
          tri.c.fromBufferAttribute(pos,index?index.getX(i+2):i+2);
          const hit=probe.intersectTriangle(tri.a,tri.b,tri.c,false,new THREE.Vector3());
          if(hit){const d=hit.distanceTo(localPoint);if(d>1e-7&&!distances.some(v=>Math.abs(v-d)<1e-6))distances.push(d);}
        }
        if(distances.length%2===1)return false;
      }
    }
    let previous=null;
    const steps=Math.max(1,Math.ceil(length/.5));
    for(let i=0;i<=steps;i++){
      const ground=terrain.sample(a.clone().lerp(b,i/steps));
      if(!ground||previous&&Math.abs(ground.length()-previous.length())>.42)return false;
      previous=ground;
    }
    return true;
  }
  function ground(point){
    const k=key(point);
    if(!groundCache.has(k)){
      const hit=terrain.sample(point);
      groundCache.set(k,hit?.addScaledVector(hit.clone().normalize(),.06)||null);
    }
    return groundCache.get(k)?.clone()||null;
  }
  function plan(start,target,occupied=[]) {
    const canPass=(a,b)=>occupied.every(p=>(a.distanceToSquared(b)<1e-10?p.distanceTo(a):new THREE.Line3(a,b).closestPointToPoint(p,true,new THREE.Vector3()).distanceTo(p))>.85)&&clear(a,b);
    const first=ground(start);
    if(!first||!clear(first,first))return null;
    const up=first.clone().normalize(),east=new THREE.Vector3(0,1,0).cross(up).normalize();
    if(east.lengthSq()<.01)east.set(1,0,0);
    const north=up.clone().cross(east).normalize(),delta=target.clone().sub(first),step=1.2;
    const gx=Math.round(delta.dot(east)/step),gz=Math.round(delta.dot(north)/step);
    const nodes=new Map();
    function node(x,z){
      const key=`${x},${z}`;
      if(nodes.has(key))return nodes.get(key);
      const p=ground(first.clone().addScaledVector(east,x*step).addScaledVector(north,z*step));
      const n=p&&canPass(p,p)?{key,x,z,p,g:Infinity,f:Infinity,prev:null}:null;
      nodes.set(key,n);return n;
    }
    // Choose the closest dry, unoccupied assembly slot within a small radius.
    const goals=[];
    for(let x=gx-5;x<=gx+5;x++)for(let z=gz-5;z<=gz+5;z++){
      const n=node(x,z);
      if(n&&n.p.distanceTo(first)>1.8&&occupied.every(p=>p.distanceTo(n.p)>1.1))goals.push(n);
    }
    goals.sort((a,b)=>a.p.distanceToSquared(target)-b.p.distanceToSquared(target));
    const goal=goals[0],begin=node(0,0);if(!goal||!begin)return null;
    const goalKeys=new Set(goals.map(n=>n.key));
    begin.g=0;begin.f=begin.p.distanceTo(goal.p);
    const open=[begin],closed=new Set();let visits=0,winner=null,bestScore=Infinity;
    while(open.length&&visits++<1400){
      open.sort((a,b)=>a.f-b.f);const current=open.shift();
      if(goalKeys.has(current.key)){
        const score=current.p.distanceTo(target)+current.g*.15;
        if(score<bestScore){winner=current;bestScore=score;}
      }
      closed.add(current.key);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const x=current.x+dx,z=current.z+dz;
        if(Math.abs(x)>30||Math.abs(z)>30)continue;
        const next=node(x,z);if(!next||closed.has(next.key)||!canPass(current.p,next.p))continue;
        const cost=current.g+current.p.distanceTo(next.p);
        if(cost>12||cost>=next.g)continue;
        next.g=cost;next.f=cost+next.p.distanceTo(goal.p);next.prev=current;
        if(!open.includes(next))open.push(next);
      }
    }
    if(winner){
      const points=[];for(let n=winner;n;n=n.prev)points.push(n.p.clone());points.reverse();
      return {points,length:points.slice(1).reduce((s,p,i)=>s+p.distanceTo(points[i]),0),visits};
    }
    return null;
  }
  // Unlike an assembly slot, a return route must finish at the exact reserved
  // point. Never substitute a nearby reachable point across a rock or water.
  function planReturn(start,target,{maxDistance=60,maxVisits=2500}={}) {
    const first=ground(start),last=ground(target);
    if(!first||!last)return {valid:false,reason:'missing-dry-endpoint'};
    if(!clear(first,first)||!clear(last,last))return {valid:false,reason:'obstructed-endpoint'};
    const makeRoute=points=>({valid:true,points,length:points.slice(1).reduce((sum,p,i)=>sum+p.distanceTo(points[i]),0),startCorrection:first.distanceTo(start)});
    if(first.distanceTo(last)<.15&&clear(first,last))return makeRoute([first,last]);
    const up=first.clone().normalize(),east=new THREE.Vector3(0,1,0).cross(up).normalize();
    if(east.lengthSq()<.01)east.set(1,0,0);
    const north=up.clone().cross(east).normalize(),step=1.2;
    const cells=new Map(),closed=new Set(),open=[];
    function cell(x,z){
      const k=`${x},${z}`;if(cells.has(k))return cells.get(k);
      const p=ground(first.clone().addScaledVector(east,x*step).addScaledVector(north,z*step));
      const n=p&&clear(p,p)?{key:k,x,z,p,g:Infinity,f:Infinity,prev:null}:null;
      cells.set(k,n);return n;
    }
    const begin=cell(0,0);if(!begin)return {valid:false,reason:'obstructed-start'};
    begin.g=0;begin.f=first.distanceTo(last);open.push(begin);
    let visits=0;
    while(open.length&&visits++<maxVisits){
      open.sort((a,b)=>a.f-b.f);const current=open.shift();
      const tail=current.p.distanceTo(last);
      if(tail<=step*1.5&&current.g+tail<=maxDistance&&clear(current.p,last)){
        const points=[last];for(let n=current;n;n=n.prev)points.push(n.p.clone());points.reverse();
        return {...makeRoute(points),visits};
      }
      closed.add(current.key);
      for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){
        const x=current.x+dx,z=current.z+dz;
        if(Math.hypot(x,z)*step>maxDistance)continue;
        const next=cell(x,z);if(!next||closed.has(next.key))continue;
        const cost=current.g+current.p.distanceTo(next.p);
        if(cost>=next.g||cost+next.p.distanceTo(last)>maxDistance||!clear(current.p,next.p))continue;
        next.g=cost;next.f=cost+next.p.distanceTo(last);next.prev=current;
        if(!open.includes(next))open.push(next);
      }
    }
    return {valid:false,reason:visits>=maxVisits?'search-budget':'no-supported-route',visits};
  }
  function pointAt(route,t,out=new THREE.Vector3()) {
    let remaining=THREE.MathUtils.clamp(t,0,1)*route.length;
    for(let i=1;i<route.points.length;i++){
      const a=route.points[i-1],b=route.points[i],length=a.distanceTo(b);
      if(remaining<=length){out.lerpVectors(a,b,length?remaining/length:0);return out.copy(ground(out)||out);}
      remaining-=length;
    }
    return out.copy(route.points[route.points.length-1]);
  }
  return {plan,planReturn,clear,pointAt};
}
