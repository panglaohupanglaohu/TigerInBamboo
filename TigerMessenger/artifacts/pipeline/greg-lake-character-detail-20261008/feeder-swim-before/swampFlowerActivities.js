import * as T from 'three';

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
  const mouth=new T.Vector3(),swim=new T.Vector3(),hand=new T.Vector3();
  const report={version:1,feeder,shore:shorePoint?shore:null,shorePoint:shorePoint?.toArray()||null,
    passengerCount:boats.reduce((n,b)=>n+b.userData.passengers.length,0),paddleCount:boats.length*2,
    update(time){
      // Respect the adult's original orbit. Approach beside its snout; the
      // child stays at the waterline, never on top of the whale's body.
      whale.updateWorldMatrix(true,false);mouth.set(0,-.18,3.66);whale.localToWorld(mouth);inner.worldToLocal(mouth);
      swim.set(1.65,0,4.5);whale.localToWorld(swim);inner.worldToLocal(swim);
      feeder.position.set(swim.x,24.68+.055*Math.sin(time*1.2),swim.z);
      feeder.rotation.y=Math.atan2(mouth.x-swim.x,mouth.z-swim.z);
      feeder.rotation.z=.045*Math.sin(time*1.4);
      feeder.userData.flowerBoy.arm.rotation.x=-.8+.10*Math.sin(time*.8);
      if(shorePoint){shore.position.y=shorePoint.y+.305*shore.userData.flowerBoy.scale+Math.max(0,Math.sin(time*1.6))*.32;shore.userData.flowerBoy.arm.rotation.z=.25*Math.sin(time*1.6);}
      feeder.updateWorldMatrix(true,true);hand.set(.06,.29,.31);feeder.userData.flowerBoy.arm.localToWorld(hand);inner.worldToLocal(hand);
      foodBits.forEach((bit,i)=>{const k=.15+i*.22;bit.position.lerpVectors(hand,mouth,k);bit.position.y+=Math.sin(k*Math.PI)*.24;});
      for(const boat of boats)boat.userData.updatePaddles?.();
    }};
  inner.userData.flowerBoyActivities=report;report.update(0);return report;
}
