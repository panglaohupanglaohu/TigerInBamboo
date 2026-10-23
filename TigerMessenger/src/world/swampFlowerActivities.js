import { createSwampActivitySolids } from './swampActivitySolids.js';
import * as T from 'three';

// Only the same story feeder receives articulated swimming anatomy. The
// seated source meshes remain available for rollback and roster consumers.
function installFeederSwimRig(feeder){
  const f=feeder.userData.flowerBoy,body=f.rig.children.find(o=>o.name==='swamp-boy-body-limbs');
  const source={bodyVisible:body.visible,armVisible:f.arm.visible,headPosition:f.head.position.clone()};
  body.visible=false;f.arm.visible=false;
  const group=new T.Group();group.name='swamp-feeder-swimming-anatomy';f.rig.add(group);
  const material=body.material,skin=new T.Color(0x282834),geometries=[];
  const mesh=(parts,parent,name)=>{
    const positions=[],normals=[],colors=[];
    for(const [p,s] of parts){const g=new T.SphereGeometry(1,8,6);g.scale(...s);g.translate(...p);const n=g.toNonIndexed();positions.push(...n.attributes.position.array);normals.push(...n.attributes.normal.array);for(let i=0;i<n.attributes.position.count;i++)colors.push(skin.r,skin.g,skin.b);n.dispose();g.dispose();}
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometries.push(g);
    const m=new T.Mesh(g,material);m.name=name;parent.add(m);return m;
  };
  mesh([[[0,.18,0],[.21,.16,.16]],[[0,.45,.035],[.19,.29,.14]],[[0,.70,.075],[.072,.10,.07]]],group,'swamp-feeder-torso');
  const limbs=[];
  for(const kind of ['arm','leg'])for(const side of [-1,1]){
    const arm=kind==='arm',upper=new T.Group(),lower=new T.Group(),tip=new T.Object3D();
    upper.name=`swamp-feeder-${kind}-${side}`;upper.position.set(side*(arm?.19:.12),arm?.63:.17,.035);group.add(upper);
    const length=arm?.30:.31,lowerLength=arm?.32:.34,radius=arm?.052:.070;
    mesh([[[0,-length/2,0],[radius,length*.56,radius]]],upper,upper.name+'-upper');
    lower.position.y=-length;upper.add(lower);lower.name=upper.name+'-joint';
    mesh([[[0,-lowerLength/2,0],[radius*.83,lowerLength*.56,radius*.83]],[[0,-lowerLength,arm?.02:.065],arm?[.064,.07,.038]:[.065,.055,.14]]],lower,upper.name+'-lower');
    tip.position.set(0,-lowerLength,arm?.02:.065);lower.add(tip);limbs.push({kind,side,upper,lower,tip});
  }
  const mouth=new T.Object3D(),nose=new T.Object3D();mouth.name='swamp-feeder-mouth-waterline';mouth.position.set(0,-.067,.178);nose.name='swamp-feeder-nose-waterline';nose.position.set(0,-.025,.22);f.head.add(mouth,nose);
  const state={version:2,period:7.2,group,limbs,mouth,nose,rightHand:limbs.find(l=>l.kind==='arm'&&l.side===1).tip,
    dispose(){group.removeFromParent();mouth.removeFromParent();nose.removeFromParent();body.visible=source.bodyVisible;f.arm.visible=source.armVisible;f.head.position.copy(source.headPosition);geometries.forEach(g=>g.dispose());}};
  feeder.userData.flowerSwim=state;return state;
}

const smooth=(a,b,x)=>{const t=T.MathUtils.clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};

// Water-level geometry is sampled once, not every frame. This uses the actual
// transformed source triangles, including the source meshes retained by bark batching.
function waterFootprint(object,inner,low=24.2,high=26.4){
  const inverse=new T.Matrix4().copy(inner.matrixWorld).invert(),matrix=new T.Matrix4();
  const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),box=new T.Box3();
  object.traverse(mesh=>{
    if(!mesh.isMesh||mesh.userData.isOutline||mesh.isInstancedMesh)return;
    const p=mesh.geometry?.attributes.position,index=mesh.geometry?.index;if(!p)return;
    matrix.multiplyMatrices(inverse,mesh.matrixWorld);
    for(let i=0;i<(index?.count||p.count);i+=3){
      a.fromBufferAttribute(p,index?index.getX(i):i).applyMatrix4(matrix);b.fromBufferAttribute(p,index?index.getX(i+1):i+1).applyMatrix4(matrix);c.fromBufferAttribute(p,index?index.getX(i+2):i+2).applyMatrix4(matrix);
      for(const v of [a,b,c])if(v.y>=low&&v.y<=high)box.expandByPoint(v);
      for(const [u,v]of [[a,b],[b,c],[c,a]])for(const y of [low,high])if((u.y-y)*(v.y-y)<0){const k=(y-u.y)/(v.y-u.y);box.expandByPoint(new T.Vector3().lerpVectors(u,v,k));}
    }
  });
  if(box.isEmpty())return null;
  return {x:(box.min.x+box.max.x)/2,z:(box.min.z+box.max.z)/2,r:Math.hypot(box.max.x-box.min.x,box.max.z-box.min.z)/2,source:object.name};
}

function installFlowerNavigation(inner,boats,whales,shipyard){
  inner.updateWorldMatrix(true,true);
  const obstacles=[];

  if(shipyard?.dock){const disk=waterFootprint(shipyard.dock,inner);if(disk)obstacles.push(disk);}
  if(shipyard?.barge){const disk=waterFootprint(shipyard.barge,inner,24,27);if(disk)obstacles.push(disk);}
  // Reserve the full original whale orbits and departure corridor, so there is
  // no per-frame collision projection or suddenly teleporting vessel avoidance.
  for(const w of whales){const s=w.userData.swim;if(s)obstacles.push({x:s.cx,z:s.cz,r:Math.max(s.rx,s.rz)+2.8*w.scale.x,source:'reserved-whale-orbit'});}
  if(shipyard?.departure)obstacles.push({x:9,z:8,r:10.0,source:'reserved-lake-longship-loop'});
  const solids=createSwampActivitySolids(inner),records=[];
  for(const [i,boat]of [...boats.entries()].sort((a,b)=>b[1].userData.flowerCup.radius-a[1].userData.flowerCup.radius)){
    const cupRadius=boat.userData.flowerCup.radius;
    const inverse=boat.matrixWorld.clone().invert(),boxes=[];
    boat.traverse(o=>{if(!o.isMesh||o.userData.isOutline)return;let visible=true;for(let p=o;p&&p!==boat;p=p.parent)if(!p.visible)visible=false;if(!visible)return;o.geometry.computeBoundingBox();const box=o.geometry.boundingBox.clone().applyMatrix4(inverse.clone().multiply(o.matrixWorld));box.min.x-=.9;box.max.x+=.9;box.min.z-=.3;box.max.z+=.3;box.min.y-=.25;box.max.y+=.25;box.actorMeshUUID=o.uuid;boxes.push(box);});
    boxes.push(new T.Box3(new T.Vector3(-cupRadius*.62-1.05,-.65,-cupRadius-.85),new T.Vector3(cupRadius*.62+1.05,1.5,cupRadius+.85)));
    const radius=Math.hypot(cupRadius*.62,cupRadius+.45)+.14,original=boat.position.clone();let best=null;
    for(let r=1;r<=22-radius;r+=.45)for(let j=0;j<128;j++){
      const angle=j*Math.PI*2/128,x=Math.cos(angle)*r,z=Math.sin(angle)*r;
      const clearance=Math.min(...obstacles.map(o=>Math.hypot(x-o.x,z-o.z)-o.r-radius-.8),...records.map(o=>Math.hypot(x-o.x,z-o.z)-o.radius-radius-1.6));
      if(clearance<.2||!solids.boxesClear(x,z,angle,boxes))continue;
      const score=(x-original.x)**2+(z-original.z)**2;
      if(!best||score<best.score)best={x,z,angle,score,clearance};
    }
    const route=best?{...best,radius,original,boat,period:58+i*6,offset:i*9.7,valid:true}:{x:original.x,z:original.z,angle:Math.atan2(original.z,original.x),radius,original,boat,period:58+i*6,offset:i*9.7,valid:false,clearance:null};
    route.boxes=boxes;route.index=i;boat.userData.flowerNavigation=route;boat.userData.paddleMotion={time:0,moving:false,phase:0,state:"moored"};records.push(route);
  }
  records.sort((a,b)=>a.index-b.index);
  // Keep the asymmetric cups' approved heading. A leaf raft can be rowed in
  // either direction: the children turn their power stroke around at the end.
  // Check the whole visible cup/paddle envelope along each lane, rather than
  // expanding a decorative orbit and assuming the bowl is a clear water disc.
  const planned=[];
  const triangle=new T.Triangle(),poseMatrix=new T.Matrix4(),poseRotation=new T.Matrix4();
  const poseClear=(x,z,angle,boxes)=>{
    const extent=Math.max(...boxes.map(b=>Math.hypot(Math.max(Math.abs(b.min.x),Math.abs(b.max.x)),Math.max(Math.abs(b.min.z),Math.abs(b.max.z)))));
    poseMatrix.makeTranslation(-x,-25.1,-z);poseRotation.makeRotationY(angle);poseMatrix.premultiply(poseRotation);
    for(const poly of solids.polygons){
      if(poly.maxX<x-extent||poly.minX>x+extent||poly.maxZ<z-extent||poly.minZ>z+extent)continue;
      for(let i=1;i<poly.points.length-1;i++){
        triangle.a.copy(poly.points[0]).applyMatrix4(poseMatrix);triangle.b.copy(poly.points[i]).applyMatrix4(poseMatrix);triangle.c.copy(poly.points[i+1]).applyMatrix4(poseMatrix);
        if(boxes.some(box=>box.intersectsTriangle(triangle)))return false;
      }
    }return true;
  };
  const segmentDistance=(x,z,r)=>{
    const dx=Math.cos(r.angle),dz=Math.sin(r.angle),along=T.MathUtils.clamp((x-r.x)*dx+(z-r.z)*dz,-r.travel,r.travel);
    return Math.hypot(x-r.x-dx*along,z-r.z-dz*along);
  };
  // Establish the previously verified five-lane layout first. Greedily giving
  // a large early raft all free space can leave a later child boat no route.
  for(const r of [...records].sort((a,b)=>b.radius-a.radius)){
    let chosen=null;
    for(const travel of [3.0,2.5,2.0,1.5,1.0,.7]){
      for(const shift of [0,.6,-.6,1.2,-1.2,1.8,-1.8,2.4,-2.4,3.0,-3.0,3.6,-3.6,4.2,-4.2,4.8,-4.8]){
        for(const cross of [0,.6,-.6,1.2,-1.2,1.8,-1.8,2.4,-2.4,3.0,-3.0,3.6,-3.6,4.2,-4.2,4.8,-4.8]){
          const candidate={...r,x:r.x+Math.cos(r.angle)*shift-Math.sin(r.angle)*cross,z:r.z+Math.sin(r.angle)*shift+Math.cos(r.angle)*cross,travel};
          let clear=true,gap=Infinity;
          for(let step=0;step<=20;step++){
            const distance=-travel+travel*2*step/20,x=candidate.x+Math.cos(r.angle)*distance,z=candidate.z+Math.sin(r.angle)*distance;
            const obstacleGap=Math.min(...obstacles.map(o=>Math.hypot(x-o.x,z-o.z)-o.r-r.radius-.8));
            const neighborGap=Math.min(...records.filter(other=>other!==r).map(other=>{const p=planned.find(v=>v===other);return (p?segmentDistance(x,z,p):Math.hypot(x-other.x,z-other.z))-other.radius-r.radius-.35;}));
            gap=Math.min(gap,obstacleGap,neighborGap);
            if(gap<.05||!poseClear(x,z,r.angle,r.boxes)){clear=false;break;}
          }
          if(clear){chosen={...candidate,routeClearance:gap};break;}
        }
        if(chosen)break;
      }
      if(chosen)break;
    }
    if(!chosen){
      for(const travel of [1.5,1.0,.7]){
        for(const da of [.25,-.25,.5,-.5,.75,-.75,1,-1,1.25,-1.25,Math.PI/2,-Math.PI/2]){
          const angle=r.angle+da;
          for(const shift of [0,1,-1,2,-2,3,-3]){
            for(const cross of [0,1,-1,2,-2,3,-3]){
              const candidate={...r,angle,x:r.x+Math.cos(angle)*shift-Math.sin(angle)*cross,z:r.z+Math.sin(angle)*shift+Math.cos(angle)*cross,travel};let clear=true,gap=Infinity;
              for(let step=0;step<=20;step++){
                const distance=-travel+travel*2*step/20,x=candidate.x+Math.cos(angle)*distance,z=candidate.z+Math.sin(angle)*distance;
                gap=Math.min(gap,...obstacles.map(o=>Math.hypot(x-o.x,z-o.z)-o.r-r.radius-.8),...records.filter(other=>other!==r).map(other=>(planned.includes(other)?segmentDistance(x,z,other):Math.hypot(x-other.x,z-other.z))-other.radius-r.radius-.35));
                if(gap<.05||!poseClear(x,z,angle,r.boxes)){clear=false;break;}
              }
              if(clear){chosen={...candidate,routeClearance:gap};break;}
            }if(chosen)break;
          }if(chosen)break;
        }if(chosen)break;
      }
    }
    if(chosen){Object.assign(r,chosen);r.valid=true;}
    else{r.travel=0;r.valid=false;r.routeClearance=null;}
    r.legDuration=14.4;r.turnDuration=2.0;r.period=2*(r.legDuration+r.turnDuration);r.offset=r.index*6.1;
    planned.push(r);
  }
  const planning={version:2,candidates:0,rejected:{obstacle:0,neighbor:0,solid:0},examples:[],milliseconds:0,baseline:records.map(r=>({index:r.index,x:r.x,z:r.z,angle:r.angle,travel:r.travel,valid:r.valid})),improved:[]};
  const planStarted=performance.now();
  for(const r of [...records].sort((a,b)=>b.radius-a.radius)){
    let chosen=null;const oldTravel=r.travel;
    const offsets=[0,.6,-.6,1.2,-1.2,1.8,-1.8,2.4,-2.4,3.0,-3.0,3.6,-3.6,4.2,-4.2,4.8,-4.8];
    for(const travel of [3.0,2.5,2.0,1.5,1.0].filter(v=>v>oldTravel+.05)){
      for(const da of [0,Math.PI/2,-Math.PI/2,.5,-.5,1,-1,.25,-.25,.75,-.75,1.25,-1.25]){
        const angle=r.angle+da;
        for(const shift of offsets){
          for(const cross of offsets){
            const candidate={...r,angle,x:r.x+Math.cos(angle)*shift-Math.sin(angle)*cross,z:r.z+Math.sin(angle)*shift+Math.cos(angle)*cross,travel};
            planning.candidates++;let clear=true,gap=Infinity;
            for(let step=0;step<=30;step++){
              const distance=-travel+travel*2*step/30,x=candidate.x+Math.cos(angle)*distance,z=candidate.z+Math.sin(angle)*distance;
              const obstacleGap=Math.min(...obstacles.map(o=>Math.hypot(x-o.x,z-o.z)-o.r-r.radius-.8));
              const neighborGap=Math.min(...records.filter(other=>other!==r).map(other=>segmentDistance(x,z,other)-other.radius-r.radius-.35));
              gap=Math.min(gap,obstacleGap,neighborGap);
              const reason=obstacleGap<.05?'obstacle':neighborGap<.05?'neighbor':!poseClear(x,z,angle,r.boxes)?'solid':null;
              if(reason){clear=false;planning.rejected[reason]++;if(planning.examples.filter(e=>e.index===r.index&&e.reason===reason&&e.travel===travel).length<1)planning.examples.push({index:r.index,travel,angle,centre:[candidate.x,candidate.z],rejectedAt:[x,z],reason,obstacleGap,neighborGap});break;}
            }
            if(clear){chosen={...candidate,routeClearance:gap};break;}
          }if(chosen)break;
        }if(chosen)break;
      }if(chosen)break;
    }
    if(chosen){Object.assign(r,chosen);planning.improved.push({index:r.index,previousTravel:oldTravel,travel:r.travel});}
  }
  planning.milliseconds=performance.now()-planStarted;
  // Exact integral of a submerged power stroke. Recovery contributes zero,
  // so the raft never slides backwards while a blade is being lifted forward.
  const strokeDistance=t=>{
    const cycles=Math.floor(t/2.4),k=t/2.4-cycles;
    return cycles+(k<.62?.5-.5*Math.cos(Math.PI*k/.62):1);
  };
  const pairDistance=t=>(strokeDistance(t)+strokeDistance(t+.192)-strokeDistance(.192))*.5;
  const update=time=>{
    for(const r of records){
      const boat=r.boat,cycle=((time+r.offset)%r.period+r.period)%r.period;
      const half=r.legDuration+r.turnDuration,outward=cycle<half,local=cycle%half;
      const moving=r.valid&&local<r.legDuration,elapsed=Math.min(local,r.legDuration),progress=pairDistance(elapsed)/pairDistance(r.legDuration);
      const direction=outward?1:-1,distance=outward?-r.travel+2*r.travel*progress:r.travel-2*r.travel*progress;
      if(r.valid){boat.position.x=r.x+Math.cos(r.angle)*distance;boat.position.z=r.z+Math.sin(r.angle)*distance;boat.rotation.y=-r.angle;}
      const motion=boat.userData.paddleMotion;motion.time=time;motion.moving=moving;motion.phase=(elapsed*2*Math.PI/2.4)%(2*Math.PI);motion.state=moving?'rowing':'turn-and-rest';motion.direction=direction;
      r.state=motion.state;r.cycle=cycle;r.progress=progress;r.distance=distance;
    }
  };
  update(0);
  return {version:4,records,obstacles,solids,planning,update};
}

function installWhaleTailMotion(whales){
  const records=[];
  for(const whale of whales)for(const name of ['swamp-beluga-continuous-body','swamp-beluga-rounded-fins']){
    const mesh=whale.getObjectByName(name);if(!mesh)continue;const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal;
    mesh.geometry.computeBoundingSphere();mesh.geometry.boundingSphere.radius+=.23;
    records.push({whale,mesh,base:p.array.slice(),normal:n.array.slice()});
  }
  return {records,update(time){
    for(const r of records){const p=r.mesh.geometry.attributes.position,n=r.mesh.geometry.attributes.normal,a=.19*Math.sin(time*2.2+(r.whale.userData.bobPhase||0));
      for(let i=0;i<p.count;i++){const j=i*3,z=r.base[j+2],k=T.MathUtils.clamp((-z-1.5)/2.85,0,1),offset=a*k*k,derivative=z< -1.5&&z> -4.35?-2*a*k/2.85:0;
        p.setXYZ(i,r.base[j],r.base[j+1]+offset,z);const nx=r.normal[j],ny=r.normal[j+1],nz=r.normal[j+2]-derivative*ny,l=Math.hypot(nx,ny,nz);n.setXYZ(i,nx/l,ny/l,nz/l);
      }p.needsUpdate=true;n.needsUpdate=true;
    }
  }};
}

function installRepairWork(inner,shipyard){
  if(!shipyard)return null;
  const {dock,mastPivot,workers:[lift,top]}=shipyard;
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(new Float32Array(24),3));
  const rope=new T.LineSegments(geometry,new T.LineBasicMaterial({color:0x807563}));rope.name='swamp-repair-live-hoist-rope';dock.add(rope);
  const tool=new T.Group();tool.name='swamp-repair-mallet';
  const handle=new T.Mesh(new T.CylinderGeometry(.016,.016,.22,6),new T.MeshBasicMaterial({color:0x92796a}));handle.position.y=-.065;tool.add(handle);
  const head=new T.Mesh(new T.BoxGeometry(.14,.055,.06),new T.MeshBasicMaterial({color:0x686177}));head.position.y=-.175;tool.add(head);
  tool.position.set(-.064,-.5,.094);top.userData.armR.add(tool);
  const left=new T.Vector3(),right=new T.Vector3(),grip=new T.Vector3(),pulley=new T.Vector3(.55,4.64,0),armTip=new T.Vector3();
  const toolEnd=new T.Vector3(-.064,-.675,.094),toolUnit=toolEnd.clone().normalize(),shoulder=new T.Vector3(),target=new T.Vector3(),direction=new T.Vector3();
  const report={version:1,rope,tool,phase:'inspect',update(time,liftK){
    const lifting=liftK>.02&&liftK<.98,raised=liftK>=.98;
    report.phase=lifting?'haul-rope':raised?'secure-and-check':'inspect';
    // Original shoulder pivots, feet and raised deck-tail poses remain fixed.
    // During hauling the two hands alternately pull actual visible rope ends.
    lift.userData.armL.rotation.x=-.3-1.20*liftK+(lifting?.22*Math.sin(time*3.2):0);
    lift.userData.armR.rotation.x=-.3-1.20*liftK+(lifting?.22*Math.sin(time*3.2+Math.PI):0);
    top.userData.armL.rotation.x=-.3-.8*liftK;
    top.userData.armR.rotation.x=raised?-1.05+.25*Math.sin(time*5.2):-.3-.9*liftK;
    tool.visible=raised;
    dock.updateWorldMatrix(true,true);
    if(raised){
      const arm=top.userData.armR;
      arm.getWorldPosition(shoulder);mastPivot.worldToLocal(shoulder);
      // The same rigid arm has enough reach to touch this part of the mast.
      // Aim its mallet end at a real mast-side contact, then withdraw on an arc.
      target.set(Math.sign(shoulder.x||1)*.09,shoulder.y,0);
      const reach=toolEnd.length()*top.scale.x,sideDistance=Math.hypot(target.x-shoulder.x,target.z-shoulder.z);
      target.y-=Math.sqrt(Math.max(.002,reach*reach-sideDistance*sideDistance));
      mastPivot.localToWorld(target);top.worldToLocal(target);direction.copy(target).sub(arm.position).normalize();
      arm.quaternion.setFromUnitVectors(toolUnit,direction);
      arm.rotateX(.26*(.5+.5*Math.sin(time*5.2)));
      arm.updateWorldMatrix(true,true);head.getWorldPosition(target);mastPivot.worldToLocal(target);
      report.toolAxisDistance=Math.hypot(target.x,target.z);
    }
    armTip.set(.064,-.5,.094);lift.userData.armL.localToWorld(armTip);dock.worldToLocal(armTip);left.copy(armTip);
    armTip.set(-.064,-.5,.094);lift.userData.armR.localToWorld(armTip);dock.worldToLocal(armTip);right.copy(armTip);
    grip.set(0,2.75,0);mastPivot.localToWorld(grip);dock.worldToLocal(grip);
    const points=[left,pulley,pulley,grip,right,pulley,left,right],p=geometry.attributes.position;
    points.forEach((v,i)=>p.setXYZ(i,v.x,v.y,v.z));p.needsUpdate=true;geometry.computeBoundingSphere();
    report.leftHand=left;report.rightHand=right;report.mastGrip=grip;
  }};
  shipyard.workActivity=report;return report;
}
function animateFeederSwim(feeder,time,whaleUp=1){
  // 2026-10-10 user: the child swims with the head out of the water most of the time and only ducks under
  // to feed the whale. 7.2 s cycle: 0–3.1 s head-up surface swim, dive, ~1.5 s feeding at the whale's snout, resurface.
  const f=feeder.userData.flowerBoy,s=feeder.userData.flowerSwim,cycle=((time%s.period)+s.period)%s.period;
  // feeding (and the dive for it) only while the whale is up at the surface; otherwise keep swimming head-up above it
  const feed=smooth(3.4,3.8,cycle)*(1-smooth(4.9,5.3,cycle))*whaleUp;
  const under=smooth(3.1,3.45,cycle)*(1-smooth(5.05,5.6,cycle))*whaleUp;
  const breath=1-under;// head out of the water
  const phase=time*4.6;
  feeder.rotation.x=Math.PI/2-.30*breath;
  feeder.rotation.z=.07*Math.sin(phase*.5)+.06*breath*Math.sin(phase*.25);
  f.head.rotation.set(-.70*breath,.10*breath*Math.sin(phase*.2),0);
  for(const limb of s.limbs){
    const q=phase+(limb.side===1?Math.PI:0);
    if(limb.kind==='arm'){
      limb.upper.rotation.set(-.45+1.25*Math.sin(q),0,limb.side*(.25+.12*Math.cos(q)));
      limb.lower.rotation.x=.40+.48*(.5+.5*Math.cos(q));
      if(limb.side===1){limb.upper.rotation.x=T.MathUtils.lerp(limb.upper.rotation.x,-2.50,feed);limb.upper.rotation.z=T.MathUtils.lerp(limb.upper.rotation.z,-.18,feed);limb.lower.rotation.x=T.MathUtils.lerp(limb.lower.rotation.x,.22,feed);}
    }else{
      const kick=time*6.9+(limb.side===1?Math.PI:0);
      limb.upper.rotation.set(.30*Math.sin(kick),0,limb.side*.10);
      limb.lower.rotation.x=.20+.52*Math.max(0,Math.sin(kick));
    }
  }
  s.cycle=cycle;s.breath=breath;s.feeding=feed;s.phase=feed>.5?'feeding':under>.5?'submerged-swim':breath>.5?'surface-swim':'diving';
  // The mouth marker is on the existing facial geometry. Its actual transformed
  // height controls surfacing, independently of body scale or sphere placement.
  s.targetMouthY=25+.14*breath-.50*under;// mouth just above the waterline while surface-swimming
}

// The original passenger array is an identity roster, not a parent constraint.
// A child can leave its boat without losing the story's reference to that child.
export function installFlowerBoatPaddles(boat,radius){
  // Broad, dark oar blades hold their silhouette against the pale lotus leaf
  // and blue water. Keep the shaft and blade as separate meshes so the shaft
  // can stretch between a real palm and the moving blade without deforming it.
  const shaft=new T.CylinderGeometry(.038,.046,1,8);shaft.translate(0,.5,0);
  const blade=new T.SphereGeometry(1,10,8);blade.scale(.23,.36,.075);
  const shaftMaterial=new T.MeshBasicMaterial({color:0x51443e});
  const bladeMaterial=new T.MeshBasicMaterial({color:0x6e5148,side:T.DoubleSide});
  const paddles=[0,1].map(i=>{const group=new T.Group();group.name='swamp-flower-boat-paddle';group.userData.slot=i;
    const stem=new T.Mesh(shaft,shaftMaterial),leaf=new T.Mesh(blade,bladeMaterial);stem.name='flower-paddle-shaft';leaf.name='flower-paddle-blade';leaf.position.y=1.02;
    group.add(stem,leaf);group.userData.blade=leaf;boat.add(group);return group;});
  const up=new T.Vector3(0,1,0),hand=new T.Vector3(),tip=new T.Vector3(),dir=new T.Vector3();
  boat.userData.paddles=paddles;
  boat.userData.updatePaddles=()=>{
    const aboard=boat.userData.passengers.filter(b=>b.parent===boat);
    boat.updateWorldMatrix(true,true);
    for(let i=0;i<2;i++){
      const boy=aboard.length===1?aboard[0]:boat.userData.passengers[i],p=paddles[i],f=boy.userData.flowerBoy;
      const left=aboard.length===1&&i===1;
      if(left){hand.set(-.27,.035,.27);f.rig.localToWorld(hand);}
      else{hand.set(...(f.pose==='play'?[.08,-.79,.65]:[.06,.29,.31]));f.arm.localToWorld(hand);}
      boat.worldToLocal(hand);p.position.copy(hand);
      // Both ends remain outside the actual flower rim, with the grip locked
      // to a real palm. The sole remaining passenger holds both paddles.
      const side=aboard.length===1?(i===0?1:-1)*Math.sign(boy.position.z||1):(i===0?1:-1);
      const motion=boat.userData.paddleMotion,phase=motion?.phase||0,k=(phase/(Math.PI*2)+i*.08)%1,power=k<.62;
      const sweep=motion?.moving?(power?1-2*k/.62:-1+2*(k-.62)/.38):.25;
      tip.set(radius*.58*sweep*(motion?.direction||1),0,side*(radius+.72));
      const waterTarget=motion?.moving?(power?24.82:25.48):25.42;
      // Solve the blade centre against real water height despite boat bob/roll.
      tip.y=motion?(waterTarget-boat.position.y-Math.sin(boat.rotation.z)*tip.x)/Math.cos(boat.rotation.z):.24;
      dir.subVectors(tip,hand);p.scale.set(1,dir.length()/1.02,1);p.quaternion.setFromUnitVectors(up,dir.normalize());p.userData.blade.scale.y=1/p.scale.y;
      p.userData.holder=boy;p.userData.hand=left?'left':'right';p.userData.gripLocal=hand.toArray();p.userData.stroke=motion?.moving?(power?'power':'recovery'):'rest';p.userData.bladeLocal=tip.toArray();
    }
  };
  boat.userData.updatePaddles();
}

export function installFlowerBoyActivities(inner,boats,whale,foodBits,{whales=[whale],shipyard=inner.userData.shipyard}={}){
  const feeder=boats[0].userData.feeder,shore=boats[1]?.userData.passengers[1];
  inner.add(feeder);feeder.userData.activity='swimming-whale-feeding';
  feeder.userData.flowerBoy.rig.position.set(0,0,0);feeder.rotation.order='YXZ';feeder.rotation.x=Math.PI/2;
  const swimming=installFeederSwimRig(feeder);
  const navigation=installFlowerNavigation(inner,boats,whales,shipyard);
  const tails=installWhaleTailMotion([...whales,...(shipyard?.escort?[shipyard.escort]:[])]);
  const repair=installRepairWork(inner,shipyard);
  const rim=inner.userData.gregCoralRim?.walkMeshes||[],ray=new T.Raycaster(),v=new T.Vector3();
  let shorePoint=null;
  inner.updateWorldMatrix(true,true);
  // Sample the real outer rim, beyond the protected r=35.4..39.4 walkway.
  for(const angle of [2.45,2.25,2.05,2.65,1.85]){
    const p=new T.Vector3(Math.cos(angle)*40.15,40,Math.sin(angle)*40.15);let good=true;
    for(const da of [-1,0,1])for(const dr of [-.46,0,.46]){
      const x=p.x+Math.cos(angle+Math.PI/2)*da+Math.cos(angle)*dr,z=p.z+Math.sin(angle+Math.PI/2)*da+Math.sin(angle)*dr;
      const origin=inner.localToWorld(new T.Vector3(x,45,z)),down=new T.Vector3(0,-1,0).transformDirection(inner.matrixWorld);
      ray.set(origin,down);const hit=ray.intersectObjects(rim,false)[0];
      if(!hit){good=false;break;}v.copy(hit.point);inner.worldToLocal(v);if(Math.abs(v.y-40)>.1){good=false;break;}
    }
    if(good){shorePoint=p;break;}
  }
  if(shore&&shorePoint){inner.add(shore);shore.userData.activity='shore-hop';shore.userData.flowerBoy.rig.position.set(0,0,0);
    shore.rotation.set(0,Math.atan2(-shorePoint.z,shorePoint.x),0);
    shore.position.copy(shorePoint);shore.position.y+=.305*shore.userData.flowerBoy.scale;
  }
  const mouth=new T.Vector3(),swim=new T.Vector3(),hand=new T.Vector3(),face=new T.Vector3();
  const report={version:4,feeder,navigation,tails,repair,shore:shorePoint?shore:null,shorePoint:shorePoint?.toArray()||null,
    passengerCount:boats.reduce((n,b)=>n+b.userData.passengers.length,0),paddleCount:boats.length*2,
    update(time){
      navigation.update(time);tails.update(time);
      for(const boat of boats)for(const boy of boat.userData.passengers)if(boy.parent===boat){const f=boy.userData.flowerBoy,m=boat.userData.paddleMotion;f.arm.rotation.z=m.moving?.22*Math.sin(m.phase):0;}
      // Respect the adult's original orbit. Approach beside its snout; the
      // child stays at the waterline, never on top of the whale's body.
      whale.updateWorldMatrix(true,false);mouth.set(0,-.18,3.66);whale.localToWorld(mouth);inner.worldToLocal(mouth);
      swim.set(-1.65,0,4.5);whale.localToWorld(swim);inner.worldToLocal(swim);
      // Follow the other side of the snout at the same feeding distance.
      // While the adult is submerged, take the inside of its orbit. The
      // former snout-following offset crossed the southern rowing envelope.
      // The surfacing blend returns smoothly to the mirrored feeding point;
      // no per-frame collision projection or change to any flowerboat route.
      const whaleUp=T.MathUtils.clamp(whale.userData.surfacing??1,0,1);
      const insideWeight=1-smooth(.25,.85,whaleUp),orbit=whale.userData.swim;
      if(orbit){const dx=orbit.cx-swim.x,dz=orbit.cz-swim.z,length=Math.hypot(dx,dz);
        if(length>1e-6){swim.x+=dx/length*1.5*insideWeight;swim.z+=dz/length*1.5*insideWeight;}}
      swimming.routeAvoidance={mode:'inside-adult-orbit',offsetInner:1.5*insideWeight};
      feeder.position.set(swim.x,24.68+.055*Math.sin(time*1.2),swim.z);
      feeder.rotation.y=Math.atan2(mouth.x-swim.x,mouth.z-swim.z);
      animateFeederSwim(feeder,time,whale.userData.surfacing??1);
      feeder.updateWorldMatrix(true,true);swimming.mouth.getWorldPosition(face);inner.worldToLocal(face);
      feeder.position.y+=swimming.targetMouthY-face.y;
      if(shorePoint){shore.position.y=shorePoint.y+.305*shore.userData.flowerBoy.scale+Math.max(0,Math.sin(time*1.6))*.32;shore.userData.flowerBoy.arm.rotation.z=.25*Math.sin(time*1.6);}
      feeder.updateWorldMatrix(true,true);swimming.rightHand.getWorldPosition(hand);inner.worldToLocal(hand);
      swimming.mouth.getWorldPosition(face);inner.worldToLocal(face);swimming.mouthY=face.y;
      swimming.nose.getWorldPosition(face);inner.worldToLocal(face);swimming.noseY=face.y;
      foodBits.forEach((bit,i)=>{const k=.15+i*.22;bit.visible=swimming.feeding>.05;bit.position.lerpVectors(hand,mouth,k);bit.position.y+=Math.sin(k*Math.PI)*.24;});
      for(const boat of boats)boat.userData.updatePaddles?.();
    }};
  inner.userData.flowerBoyActivities=report;report.update(0);return report;
}
