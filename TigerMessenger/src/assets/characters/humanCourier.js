import * as THREE from 'three';
import data from '../../../assets/models/optimized/human-courier-v1/geometry.js';

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
    source:'assets/models/optimized/human-courier-v1/human-courier.blend',target:'approved-target.png' };
  root.userData.letter.visible=false;
  root.scale.setScalar(scale);
  return root;
}

export function animateHumanCourier(player, root, dt, moving) {
  const u=root.userData, blend=1-Math.exp(-12*Math.min(dt,.1));
  const speed=player.velocity.length();
  const seated=player.riding&&!player.boardingOnFoot;
  const running=speed>8, walk=(moving||player.boardingOnFoot&&speed>.01) && player.onGround && !seated;
  player.animPhase += dt*(walk?(running?13:9):2);
  const phase=player.animPhase, swing=walk?Math.sin(phase)*(running?.5:.32):0;
  const pose=(o,x)=>{o.rotation.x=THREE.MathUtils.lerp(o.rotation.x,x,blend);};
  pose(u.legL,seated?-1.15:!player.onGround?-.25:swing);
  pose(u.legR,seated?-1.15:!player.onGround?.20:-swing);
  pose(u.kneeL,seated?1.3:Math.max(0,-swing)*1.15);
  pose(u.kneeR,seated?1.3:Math.max(0,swing)*1.15);
  pose(u.armL,seated?-.5:-swing*.65);
  pose(u.armR,player.holdingLetter?-.32:seated?-.5:swing*.65);
  pose(u.elbowL,seated?-.7:-.12);
  pose(u.elbowR,player.holdingLetter?-.5:seated?-.7:-.12);
  u.body.position.y=u.bodyBaseY+(walk?Math.abs(Math.sin(phase*2))*.01:Math.sin(phase)*.003);
  pose(u.cape,walk?.07+Math.sin(phase)*.025:.015);
  // Quest toggles letter.visible. The envelope follows the hand without orbiting.
}
