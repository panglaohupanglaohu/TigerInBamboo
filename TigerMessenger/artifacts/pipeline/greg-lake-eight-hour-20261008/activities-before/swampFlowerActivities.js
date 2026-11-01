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
      tip.set((left?-1:1)*radius*.56,-.18,side*(radius+.45));
      dir.subVectors(tip,hand);p.scale.set(1,dir.length()/1.02,1);p.quaternion.setFromUnitVectors(up,dir.normalize());
      p.userData.holder=boy;p.userData.hand=left?'left':'right';p.userData.gripLocal=hand.toArray();
    }
  };
  boat.userData.updatePaddles();
}

export function installFlowerBoyActivities(inner,boats,whale,foodBits){
  const feeder=boats[0].userData.feeder,shore=boats[1]?.userData.passengers[1];
  inner.add(feeder);feeder.userData.activity='swimming-whale-feeding';
  feeder.userData.flowerBoy.rig.position.set(0,0,0);feeder.rotation.order='YXZ';feeder.rotation.x=Math.PI/2;
  const swimming=installFeederSwimRig(feeder);
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
  const report={version:2,feeder,shore:shorePoint?shore:null,shorePoint:shorePoint?.toArray()||null,
    passengerCount:boats.reduce((n,b)=>n+b.userData.passengers.length,0),paddleCount:boats.length*2,
    update(time){
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
