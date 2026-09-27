import * as T from '../../../vendor/three.module.js';
const clamp=T.MathUtils.clamp,lerp=T.MathUtils.lerp;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export const clips={walk:{duration:1.1,speed:.9},run:{duration:.68,speed:2.35},jump:{duration:1.2,speed:1.6},vault:{duration:1.5,speed:1.3}};
function curve(t,keys){for(let i=0;i<keys.length-1;i++){const a=keys[i],b=keys[i+1];if(t<=b[0])return lerp(a[1],b[1],smooth((t-a[0])/(b[0]-a[0])))}return keys.at(-1)[1]}
export function buildRig(data){
  const nodes=new Map(),materials=new Map(),cloth=[],meshes=[];
  for(const [name,m] of Object.entries(data.materials))materials.set(name,new T.MeshStandardMaterial({color:new T.Color().setRGB(...m.color),roughness:.78,metalness:m.metalness,side:T.DoubleSide}));
  for(const n of data.nodes){const o=new T.Group();o.name=n.name;new T.Matrix4().fromArray(n.matrix).decompose(o.position,o.quaternion,o.scale);nodes.set(n.name,o)}
  for(const n of data.nodes)if(n.parent)nodes.get(n.parent).add(nodes.get(n.name));
  const root=nodes.get('Courier');root.updateMatrixWorld(true);
  const bind=new Map([...nodes].map(([n,o])=>[n,o.matrixWorld.clone()]));
  for(const n of data.nodes){if(!n.parts)continue;const obj=nodes.get(n.name);for(const [index,p] of n.parts.entries()){
    if(!materials.has(p.material))throw Error('Missing material '+p.material);
    const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p.position,3));g.setAttribute('normal',new T.Float32BufferAttribute(p.normal,3));g.computeBoundingBox();
    const m=new T.Mesh(g,materials.get(p.material));m.name=n.name+'#'+index;m.castShadow=true;m.receiveShadow=true;obj.add(m);meshes.push(m);
    if(/^(Split_coat|Coat_|Back_coat|Cloak_)/.test(n.name))cloth.push({node:obj,mesh:m,base:Float32Array.from(p.position),world:bind.get(n.name),type:n.name.startsWith('Cloak')?'cape':'coat'});
  }}
  // Head detail is static relative to head: batch by material for the review renderer.
  const headNode=nodes.get('head'),headInverse=bind.get('head').clone().invert(),headBatches=new Map();
  const headMeshes=[];headNode.traverse(o=>{if(o.isMesh)headMeshes.push(o)});
  root.updateMatrixWorld(true);
  for(const m of headMeshes){const g=m.geometry.clone().applyMatrix4(headInverse.clone().multiply(m.parent.matrixWorld)),key=m.material.uuid;
    if(!headBatches.has(key))headBatches.set(key,{material:m.material,p:[],n:[]});const b=headBatches.get(key);b.p.push(...g.attributes.position.array);b.n.push(...g.attributes.normal.array);m.removeFromParent();g.dispose();
  }
  for(const b of headBatches.values()){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(b.p,3));g.setAttribute('normal',new T.Float32BufferAttribute(b.n,3));const m=new T.Mesh(g,b.material);m.castShadow=true;headNode.add(m)}
  const joints=Object.fromEntries(data.nodes.filter(n=>!n.parts).map(n=>[n.name,nodes.get(n.name)]));
  const feet={};
  for(const side of ['L','R']){
    const knee=nodes.get('knee'+side),ankle=new T.Group();ankle.name='ankle'+side;ankle.position.set(0,-.41,0);knee.add(ankle);root.updateMatrixWorld(true);
    for(const prefix of ['Boot_sole_','Boot_toe_']){const obj=nodes.get(prefix+side);ankle.attach(obj)}
    joints[ankle.name]=ankle;nodes.set(ankle.name,ankle);root.updateMatrixWorld(true);
    const points=[];ankle.traverse(o=>{if(o.isMesh){const mat=ankle.matrixWorld.clone().invert().multiply(o.matrixWorld);const a=o.geometry.attributes.position;for(let i=0;i<a.count;i++)points.push(v().fromBufferAttribute(a,i).applyMatrix4(mat))}});
    feet[side]={ankle,points,target:v(),contact:false};
  }
  const rest=new Map([...nodes].map(([n,o])=>[n,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()}]));
  nodes.get('letter').visible=false;
  return {root,nodes,joints,feet,rest,bind,cloth,meshes,data,metrics:{}};
}
function footOffset(foot,pitch){const q=new T.Quaternion().setFromAxisAngle(v(1,0,0),pitch);return -Math.min(...foot.points.map(p=>p.clone().applyQuaternion(q).y))}
function legIK(rig,side,target,pitch,bend=1){
  const hip=rig.nodes.get('leg'+side),knee=rig.nodes.get('knee'+side),ankle=rig.feet[side].ankle;
  const h=hip.getWorldPosition(v()),dy=h.y-target.y,dz=target.z-h.z,l1=.42,l2=.41;
  const raw=Math.hypot(dy,dz),d=clamp(raw,.0101,l1+l2-.0001);
  const k=bend*Math.acos(clamp((d*d-l1*l1-l2*l2)/(2*l1*l2),-1,1));
  const angle=-Math.atan2(dz,dy)-Math.atan2(l2*Math.sin(k),l1+l2*Math.cos(k));
  hip.rotation.set(angle,0,0);knee.rotation.set(k,0,0);ankle.rotation.set(pitch-angle-k,0,0);
  rig.root.updateMatrixWorld(true);return ankle.getWorldPosition(v()).distanceTo(target);
}
function handIK(rig,side,target){
  const upper=rig.nodes.get('arm'+side),lower=rig.nodes.get('elbow'+side),hand=rig.nodes.get('hand'+side);
  const S=upper.getWorldPosition(v()),delta=target.clone().sub(S),raw=delta.length();delta.normalize();
  const a=rig.rest.get(lower.name).position,b=rig.rest.get(hand.name).position,L1=a.length(),L2=b.length(),d=clamp(raw,.035,L1+L2-.001);
  const along=(L1*L1-L2*L2+d*d)/(2*d),height=Math.sqrt(Math.max(0,L1*L1-along*along));
  let pole=v(side==='L'?.7:-.7,-.5,-.5);pole.sub(delta.clone().multiplyScalar(pole.dot(delta))).normalize();
  const E=S.clone().addScaledVector(delta,along).addScaledVector(pole,height);
  const worldQ=new T.Quaternion().setFromUnitVectors(a.clone().normalize(),E.clone().sub(S).normalize());
  upper.quaternion.copy(upper.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(worldQ));rig.root.updateMatrixWorld(true);
  const q2=new T.Quaternion().setFromUnitVectors(b.clone().normalize(),target.clone().sub(E).normalize());
  lower.quaternion.copy(upper.getWorldQuaternion(new T.Quaternion()).invert().multiply(q2));rig.root.updateMatrixWorld(true);
  hand.quaternion.copy(lower.getWorldQuaternion(new T.Quaternion()).invert().multiply(new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,0,0))));
  rig.root.updateMatrixWorld(true);return hand.getWorldPosition(v()).distanceTo(target);
}
export function pose(rig,name,time,round=2,clothRound=2){
  const clip=clips[name],u=clamp(time/clip.duration,0,1),phase=u*2*Math.PI;
  for(const [n,o] of rig.nodes){const b=rig.rest.get(n);o.position.copy(b.position);o.quaternion.copy(b.quaternion);o.scale.copy(b.scale)}
  const root=rig.root,n=rig.nodes,body=n.get('body');
  let rootY=0,rootZ=clip.speed*time,lean=0,contactHands=false;
  if(name==='walk'){rootY=-.080+.012*Math.cos(phase*2);lean=round===2?.045:0}
  if(name==='run'){rootY=-.14+.045*Math.sin(phase*2)**2;lean=round===2?.17:.08}
  if(name==='jump'){
    rootZ=curve(u,[[0,0],[.25,.18],[.83,1.45],[1,1.60]]);
    rootY=curve(u,[[0,-.06],[.15,-.18],[.25,-.08],[.52,.42],[.75,.12],[.86,-.16],[1,-.06]]);
    if(round===2&&u>=.25&&u<=.83){const p=(u-.25)/.58;rootY=-.08+4*.50*p*(1-p)}
    lean=curve(u,[[0,.04],[.16,.28],[.32,.13],[.65,.20],[.87,.36],[1,.04]]);
  }
  if(name==='vault'){
    rootZ=curve(u,[[0,-.60],[.2,-.55],[.35,-.55],[.40,-.42],[.48,-.22],[.58,.015],[.72,.39],[.87,.70],[1,.95]]);
    rootY=curve(u,[[0,-.08],[.15,-.10],[.34,.26],[.40,.48],[.48,.48],[.52,.62],[.68,.64],[.74,.58],[.86,-.14],[1,-.07]]);
    lean=curve(u,[[0,.1],[.22,.55],[.4,1.55],[.58,1.55],[.73,.5],[.87,.30],[1,.1]]);contactHands=u>=.32&&u<=.44;
  }
  root.position.set(0,rootY,rootZ);body.rotation.set(lean,round===2&&/walk|run/.test(name)?Math.sin(phase)*.055:0,round===2?Math.sin(phase)*.012:0);
  n.get('head').rotation.x=-lean*.72;
  for(const side of ['L','R']){
    const sign=side==='L'?1:-1,swing=Math.sin(phase)*sign;
    n.get('arm'+side).rotation.set((name==='run'?.65:.24)*swing-(name==='jump'?.45:name==='run'?.20:0),0,-sign*.39);
    n.get('elbow'+side).rotation.x=name==='run'?-1.25:-.28;
  }
  root.updateMatrixWorld(true);
  const errors=[],targets={};
  for(const [side,shift] of [['L',0],['R',.5]]){
    const foot=rig.feet[side];let z=rootZ,y=0,pitch=0,contact=false;
    if(name==='walk'||name==='run'){
      const p=(u+shift)%1,stance=name==='walk'?.62:.38,stride=clip.speed*clip.duration,front=stride*stance*.5;
      if(p<stance){z=rootZ+front-stride*p;contact=true;if(round===2)pitch=p<stance*.18?-.12*(1-p/(stance*.18)):.26*smooth((p/stance-.72)/.28)}
      else{const f=(p-stance)/(1-stance);z=rootZ+lerp(-front,front,smooth(f));y=Math.sin(Math.PI*f)*(name==='run'?.23:.10);pitch=round===2?.15*Math.sin(Math.PI*f):0}
    }else if(name==='jump'){
      if(u<.25){z=.16+(side==='L'?.04:-.10);contact=true}
      else if(u<.83){const p=(u-.25)/.58;z=rootZ+(side==='L'?.12:-.12)*Math.sin(Math.PI*p);y=Math.max(.03,rootY+.12+.18*Math.sin(Math.PI*p));pitch=.08}
      else{z=1.45+(side==='L'?.08:-.08);contact=true}
    }else{
      if(u<.20){z=side==='L'?-.40:-.72;contact=true}
      else if(u<.86){z=curve(u,[[.20,side==='L'?-.445:-.66],[.32,-.62],[.40,-.40],[.55,.20],[.70,.60],[.86,.71]])+(side==='L'?.045:-.06);y=curve(u,[[.20,0],[.28,.43],[.40,1.08],[.55,1.14],[.65,1.11],[.74,.80],[.86,0]]);pitch=.04*Math.sin(Math.PI*(u-.20)/.66)}
      else{z=.71+(side==='L'?.045:-.06);contact=true}
    }
    const ankleY=y+footOffset(foot,pitch);foot.target.set(side==='L'?.093:-.093,ankleY,z);foot.contact=contact;
    const e=legIK(rig,side,foot.target,pitch,name==='vault'?-1:1);errors.push(e);targets[side]=foot.target.toArray();
  }
  let handError=0;
  if(name==='vault'&&u>=.24&&u<=.48){for(const side of ['L','R']){
    const weight=u<.32?smooth((u-.24)/.08):u>.44?1-smooth((u-.44)/.04):1;
    const target=n.get('hand'+side).getWorldPosition(v()).lerp(v(side==='L'?.18:-.18,1.067,round===2?-.16:rootZ+.26),weight);
    if(round===2&&u<.32)target.y+=.12*Math.sin(Math.PI*(u-.24)/.08);
    handError=Math.max(handError,handIK(rig,side,target));
  }}
  n.get('cape').rotation.x=(name==='run'?.08:.025)+Math.sin(phase-.6)*.015;
  root.updateMatrixWorld(true);
  const bodyDelta=body.matrixWorld.clone().multiply(rig.bind.get('body').clone().invert());
  const legDelta={};for(const s of ['L','R'])legDelta[s]=n.get('leg'+s).matrixWorld.clone().multiply(rig.bind.get('leg'+s).clone().invert());
  const legPoints=['L','R'].flatMap(s=>[n.get('leg'+s).getWorldPosition(v()),n.get('knee'+s).getWorldPosition(v()),rig.feet[s].ankle.getWorldPosition(v())]);
  let wallCorrections=0;
  for(const c of rig.cloth){
    const a=c.mesh.geometry.attributes.position,delta=c.node.matrixWorld.clone().multiply(c.world.clone().invert()),inv=c.node.matrixWorld.clone().invert();
    for(let i=0;i<a.count;i++){
      const p=v().fromArray(c.base,i*3).applyMatrix4(c.world),h=clamp((1.35-p.y)/.85,0,1);let out=p.clone().applyMatrix4(delta);
      if(c.type==='coat'&&clothRound===2){
        const weight=clamp((.97-p.y)/.42,0,1),side=p.x>=0?'L':'R';
        out=p.clone().applyMatrix4(bodyDelta).lerp(p.clone().applyMatrix4(legDelta[side]),weight*.86);
        if(c.node.name.startsWith('Back_coat'))out.z-=.05*weight+.03*Math.abs(Math.sin(phase))*weight;
      }
      if(c.type==='cape'){
        out.z-=h*h*((name==='run'?.16:.055)+.025*Math.sin(phase-1.3+h*2));
        if(clothRound===2&&name==='vault')out.y-=.30*h*h*Math.sin(Math.PI*u);
        out.x+=.025*Math.sin(phase-1+h*2)*h*h;
        if(clothRound===2&&h>.12){
          for(const q of legPoints)if(Math.abs(out.x-q.x)<.19&&Math.abs(out.y-q.y)<.24)out.z=Math.min(out.z,q.z-.11);
        }
      }
      if(clothRound===2&&name==='vault'&&Math.abs(out.x)<.62&&out.z>-.145&&out.z<.145&&out.y<1.075){out.z=-.15;wallCorrections++}
      if(clothRound===2)out.y=Math.max(out.y,.008);
      out.applyMatrix4(inv);a.setXYZ(i,out.x,out.y,out.z);
    }
    a.needsUpdate=true;c.mesh.geometry.computeVertexNormals();
  }
  rig.metrics={footError:Math.max(...errors),handError,contactHands,targets,wallCorrections,round,clothRound};return rig.metrics;
}
export function snapshot(rig){
  rig.root.updateMatrixWorld(true);
  return {nodes:Object.values(rig.joints).map(o=>({name:o.name,parent:o.parent?.name||null,position:o.position.toArray(),quaternion:o.quaternion.toArray(),scale:o.scale.toArray()})),cloth:rig.cloth.map(c=>({name:c.node.name,part:Number(c.mesh.name.split('#').at(-1)),position:Array.from(c.mesh.geometry.attributes.position.array)}))};
}
