// Isolated review copy; the production factory is unchanged.
import * as THREE from 'three';
import data from '../../../assets/models/optimized/human-courier-refinement/round-6/geometry.js';

/** Blender-derived geometry, +Z forward; preserve the existing quest letter socket. */
export function buildHumanCourier({ scale = 0.48 } = {}) {
  const nodes = new Map();
  const materials = new Map(Object.entries(data.materials).map(([name, m]) => [name,
    new THREE.MeshStandardMaterial({ color: new THREE.Color().setRGB(...m.color), roughness: .79,
      metalness: m.metalness, side: THREE.DoubleSide })]));
  for (const n of data.nodes) {
    const g = new THREE.Group(); g.name = n.name;
    new THREE.Matrix4().fromArray(n.matrix).decompose(g.position,g.quaternion,g.scale);
    nodes.set(n.name,g);
  }
  for (const n of data.nodes) if (n.parent) nodes.get(n.parent).add(nodes.get(n.name));
  const root = nodes.get('Courier'); root.updateMatrixWorld(true);
  // Merge rigid details per joint/material: fingers, buckles, hair locks share draws.
  const batches = new Map();
  for (const n of data.nodes) {
    if (!n.parts) continue;
    const obj = nodes.get(n.name);
    let joint = obj.parent;
    while (joint && !data.nodes.find(d => d.name === joint.name && !d.parts)) joint = joint.parent;
    joint ||= root;
    const matrix = joint.matrixWorld.clone().invert().multiply(obj.matrixWorld);
    for (const part of n.parts) {
      if (!materials.has(part.material)) throw new Error(`Missing courier material: ${part.material}`);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(part.position,3));
      geometry.setAttribute('normal',new THREE.Float32BufferAttribute(part.normal,3));
      geometry.applyMatrix4(matrix);
      const key = `${joint.name}:${part.material}`;
      if (!batches.has(key)) batches.set(key,{joint,material:materials.get(part.material),position:[],normal:[]});
      const batch = batches.get(key);
      batch.position.push(...geometry.attributes.position.array); batch.normal.push(...geometry.attributes.normal.array);
      geometry.dispose();
    }
    obj.removeFromParent();
  }
  for (const [name,b] of batches) {
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(b.position,3));
    geometry.setAttribute('normal',new THREE.Float32BufferAttribute(b.normal,3));
    geometry.computeBoundingSphere();
    const mesh=new THREE.Mesh(geometry,b.material); mesh.name=name; mesh.castShadow=true; mesh.receiveShadow=true; b.joint.add(mesh);
  }
  root.userData={ isHumanCourier:true,isAgent:false,isTiger:false,bodyBaseY:.94,
    ...Object.fromEntries(['body','head','cape','legL','legR','kneeL','kneeR','armL','armR','elbowL','elbowR','handL','handR','letter'].map(n=>[n,nodes.get(n)])),
    source:'assets/models/optimized/human-courier-refinement/round-6/human-courier.blend',target:'approved-target.png' };
  root.userData.letter.visible=false;
  root.scale.setScalar(scale);
  return root;
}

export function animateHumanCourier(player, root, dt, moving) {
  const u=root.userData, step=Math.max(0,Math.min(dt,.05)),blend=1-Math.exp(-12*step);
  const speed=player.velocity.length();
  const seated=player.riding&&!player.boardingOnFoot;
  const crouch=!!player.crouching&&!seated,running=speed>8&&!crouch;
  const walk=(moving||player.boardingOnFoot&&speed>.01)&&player.onGround&&!seated;
  u.gaitWeight=THREE.MathUtils.lerp(u.gaitWeight||0,walk?1:0,1-Math.exp(-7*step));
  player.animPhase=(player.animPhase||0)+step*(crouch?6:running?12:8);
  u.idleTime=(u.idleTime||0)+step;
  const phase=player.animPhase,w=u.gaitWeight,swing=Math.sin(phase)*(running?.48:crouch?.21:.30)*w;
  const airborne=!player.onGround&&!seated;
  if(u.wasGrounded===false&&player.onGround)u.landing=1;
  u.wasGrounded=player.onGround;u.landing=(u.landing||0)*Math.exp(-9*step);
  const compress=crouch?.10:u.landing*.065;
  const pose=(o,x,y=0,z=0)=>{
    for(const [axis,v] of Object.entries({x,y,z}))o.rotation[axis]=THREE.MathUtils.lerp(o.rotation[axis],v,blend);
  };
  // +Z forward: negative hip pitch advances the thigh; positive knee pitch folds back.
  pose(u.legL,seated?-1.15:airborne?-.65:swing-(crouch?.38:0)-u.landing*.20);
  pose(u.legR,seated?-1.15:airborne?-.20:-swing-(crouch?.38:0)-u.landing*.20);
  pose(u.kneeL,seated?1.3:airborne?.95:(crouch?.65:.06)+Math.max(0,Math.sin(phase-.55))*(running?.85:.40)*w+u.landing*.4);
  pose(u.kneeR,seated?1.3:airborne?.55:(crouch?.65:.06)+Math.max(0,-Math.sin(phase-.55))*(running?.85:.40)*w+u.landing*.4);
  const armSwing=swing*(running?1.12:.82),elbow=running?-.85:crouch?-.60:-.25;
  pose(u.armL,seated?-.5:airborne?-.7:-armSwing-(crouch?.20:0),0,-.39);
  pose(u.armR,player.holdingLetter?-.40:seated?-.5:airborne?-.45:armSwing-(crouch?.20:0),0,.39);
  pose(u.elbowL,seated?-.7:elbow-Math.max(0,-swing)*.25);
  pose(u.elbowR,player.holdingLetter?-.65:seated?-.7:elbow-Math.max(0,swing)*.25);
  const twist=Math.sin(phase)*.065*w;
  pose(u.body,seated?.04:airborne?.15:(crouch?.25:running?.15:.045)*w+u.landing*.18,twist,-Math.sin(phase)*.018*w);
  pose(u.head,-u.body.rotation.x*.70,-twist*.80,0);
  u.body.position.y=THREE.MathUtils.lerp(u.body.position.y,u.bodyBaseY-compress+Math.cos(phase*2)*.009*w+Math.sin(u.idleTime*1.8)*.002*(1-w),blend);
  u.body.position.x=THREE.MathUtils.lerp(u.body.position.x,Math.sin(phase)*.008*w+Math.sin(u.idleTime*.65)*.003*(1-w),blend);
  for(const leg of [u.legL,u.legR])leg.position.y=THREE.MathUtils.lerp(leg.position.y,.93-compress,blend);
  pose(u.cape,.015+(running?.17:.07)*w+Math.sin(phase-.6)*.026*w,-twist*.5);
  // Review-only authored movement; no Ubisoft animation files or gameplay traversal copied.
  // Envelope remains attached to handR; quest/controller owns its visibility.
}
