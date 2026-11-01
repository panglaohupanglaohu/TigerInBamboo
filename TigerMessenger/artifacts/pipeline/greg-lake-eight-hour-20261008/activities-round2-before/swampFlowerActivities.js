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
  inner.traverse(o=>{if(o.name==='world-tree-trunk'||o.userData.swampTreePart==='trunk'){const disk=waterFootprint(o,inner);if(disk)obstacles.push(disk);}});
  if(shipyard?.dock){const disk=waterFootprint(shipyard.dock,inner);if(disk)obstacles.push(disk);}
  if(shipyard?.barge){const disk=waterFootprint(shipyard.barge,inner,24,27);if(disk)obstacles.push(disk);}
  // Reserve the full original whale orbits and departure corridor, so there is
  // no per-frame collision projection or suddenly teleporting vessel avoidance.
  for(const w of whales){const s=w.userData.swim;if(s)obstacles.push({x:s.cx,z:s.cz,r:Math.max(s.rx,s.rz)+4.65*w.scale.x,source:'reserved-whale-orbit'});}
  if(shipyard?.departure)for(const leg of ['sail','fade'])for(let i=0;i<=18;i++){
    const k=i/18,a=leg==='sail'?1.1-.8*k:.3+.05*k,r=leg==='sail'?16+6*k:22+9*k;
    obstacles.push({x:Math.cos(a)*r,z:Math.sin(a)*r,r:7.5,source:'reserved-departure-corridor'});
  }
  const records=[];
  for(const [i,boat]of boats.entries()){
    const cupRadius=boat.userData.flowerCup.radius;
    const radius=Math.hypot(cupRadius*.62,cupRadius+.45)+.14,original=boat.position.clone();let best=null;
    for(let r=20;r<=31.5-radius;r+=.7)for(let j=0;j<128;j++){
      const angle=j*Math.PI*2/128,x=Math.cos(angle)*r,z=Math.sin(angle)*r;
      const clearance=Math.min(...obstacles.map(o=>Math.hypot(x-o.x,z-o.z)-o.r-radius-1.8),...records.map(o=>Math.hypot(x-o.x,z-o.z)-o.radius-radius-3.6));
      if(clearance<.35)continue;
      const score=(x-original.x)**2+(z-original.z)**2;
      if(!best||score<best.score)best={x,z,angle,score,clearance};
    }
    const route=best?{...best,radius,original,boat,period:58+i*6,offset:i*9.7,valid:true}:{x:original.x,z:original.z,angle:Math.atan2(original.z,original.x),radius,original,boat,period:58+i*6,offset:i*9.7,valid:false,clearance:null};
    boat.userData.flowerNavigation=route;records.push(route);
  }
  const heading=(r,u)=>{
    const tangential=-1.65*Math.sin(u),radial=.65*Math.cos(u),dx=-Math.sin(r.angle)*tangential+Math.cos(r.angle)*radial,dz=Math.cos(r.angle)*tangential+Math.sin(r.angle)*radial;
    return Math.atan2(-dz,dx); // the bowl's two paddles are port/starboard ±Z, forward is +X
  };
  const update=time=>{
    for(const r of records){
      const boat=r.boat,cycle=((time+r.offset)%r.period+r.period)%r.period,elapsed=Math.max(0,cycle-8),moving=cycle>=8&&r.valid;
      const s=T.MathUtils.clamp(elapsed/(r.period-8),0,1),e=s*s*(3-2*s),phase=e*Math.PI*2;
      const stroke=((time+r.offset)/2.4)%1;
      const pushIntegral=stroke<.62?stroke/.62:(1-stroke)/.38;
      const impulse=.032*pushIntegral*Math.sin(Math.PI*s)**2,u=phase+impulse;
      const tangent=1.65*Math.cos(u),radial=.65*Math.sin(u);
      if(r.valid){boat.position.x=r.x-Math.sin(r.angle)*tangent+Math.cos(r.angle)*radial;boat.position.z=r.z+Math.cos(r.angle)*tangent+Math.sin(r.angle)*radial;boat.rotation.y=heading(r,u);}
      boat.userData.paddleMotion={time,moving,phase:((time+r.offset)*Math.PI*2/2.4)%(Math.PI*2),state:moving?'rowing':'moored'};
      r.state=moving?'rowing':'moored';r.cycle=cycle;
      const stem=boat.userData.flowerStem;
      if(stem){const top=new T.Vector3(boat.position.x,boat.position.y,boat.position.z),anchor=stem.userData.flowerStemAnchor,d=top.sub(anchor),length=d.length();stem.position.copy(anchor).addScaledVector(d,.5);stem.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());stem.scale.y=length/stem.userData.flowerStemLength;}
    }
  };
  return {version:1,records,obstacles,update};
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
function animateFeederSwim(feeder,time){
  const f=feeder.userData.flowerBoy,s=feeder.userData.flowerSwim,cycle=((time%s.period)+s.period)%s.period;
  const breath=smooth(0,.22,cycle)*(1-smooth(1.55,1.85,cycle));
  const feed=smooth(3.4,3.8,cycle)*(1-smooth(4.9,5.3,cycle));
  const dive=smooth(1.9,2.25,cycle)*(1-smooth(3.05,3.4,cycle));
  const phase=time*4.6;
  feeder.rotation.x=Math.PI/2-.28*breath;
  feeder.rotation.z=.07*Math.sin(phase*.5)+.20*breath;
  f.head.rotation.set(-.85*breath,.38*breath,.12*breath);
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
  s.cycle=cycle;s.breath=breath;s.feeding=feed;s.phase=breath>.5?'breathing':feed>.5?'feeding':dive>.5?'submerged-swim':'surface-swim';
  // The mouth marker is on the existing facial geometry. Its actual transformed
  // height controls surfacing, independently of body scale or sphere placement.
  s.targetMouthY=25-.24-.18*dive+.43*breath+.10*feed;
}

// The original passenger array is an identity roster, not a parent constraint.
// A child can leave its boat without losing the story's reference to that child.
export function installFlowerBoatPaddles(boat,radius){
  const shaft=new T.CylinderGeometry(.026,.032,1,6);shaft.translate(0,.5,0);
  const blade=new T.SphereGeometry(1,8,6);blade.scale(.13,.24,.045);blade.translate(0,1.02,0);
  const geometry=new T.BufferGeometry(),positions=[],normals=[];
  for(const source of [shaft,blade]){const g=source.toNonIndexed();positions.push(...g.attributes.position.array);normals.push(...g.attributes.normal.array);g.dispose();source.dispose();}
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  const material=new T.MeshBasicMaterial({color:0x88756e});
  const paddles=[0,1].map(i=>{const group=new T.Group();group.name='swamp-flower-boat-paddle';group.userData.slot=i;
    group.add(new T.Mesh(geometry,material));boat.add(group);return group;});
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
      const side=aboard.length===1?Math.sign(boy.position.z):(i===0?1:-1);
      const motion=boat.userData.paddleMotion,phase=motion?.phase||0,k=(phase/(Math.PI*2)+i*.08)%1,power=k<.62;
      const sweep=motion?.moving?(power?1-2*k/.62:-1+2*(k-.62)/.38):.25;
      tip.set(radius*.62*sweep,0,side*(radius+.45));
      const waterTarget=motion?.moving?(power?24.88:25.38):25.34;
      // Solve the blade centre against real water height despite boat bob/roll.
      tip.y=motion?(waterTarget-boat.position.y-Math.sin(boat.rotation.z)*tip.x)/Math.cos(boat.rotation.z):.24;
      dir.subVectors(tip,hand);p.scale.set(1,dir.length()/1.02,1);p.quaternion.setFromUnitVectors(up,dir.normalize());
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
  const report={version:3,feeder,navigation,tails,repair,shore:shorePoint?shore:null,shorePoint:shorePoint?.toArray()||null,
    passengerCount:boats.reduce((n,b)=>n+b.userData.passengers.length,0),paddleCount:boats.length*2,
    update(time){
      navigation.update(time);tails.update(time);
      for(const boat of boats)for(const boy of boat.userData.passengers)if(boy.parent===boat){const f=boy.userData.flowerBoy,m=boat.userData.paddleMotion;f.arm.rotation.z=m.moving?.22*Math.sin(m.phase):0;}
      // Respect the adult's original orbit. Approach beside its snout; the
      // child stays at the waterline, never on top of the whale's body.
      whale.updateWorldMatrix(true,false);mouth.set(0,-.18,3.66);whale.localToWorld(mouth);inner.worldToLocal(mouth);
      swim.set(1.65,0,4.5);whale.localToWorld(swim);inner.worldToLocal(swim);
      feeder.position.set(swim.x,24.68+.055*Math.sin(time*1.2),swim.z);
      feeder.rotation.y=Math.atan2(mouth.x-swim.x,mouth.z-swim.z);
      animateFeederSwim(feeder,time);
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
