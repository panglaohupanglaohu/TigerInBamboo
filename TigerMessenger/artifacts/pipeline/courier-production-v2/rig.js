import * as T from '../../../vendor/three.module.js';
import {buildRig as originalRig,pose as originalPose,clips as originalClips,snapshot} from '../courier-production/rig.js';
export {snapshot};
export const clips={...originalClips,vault:{duration:1.65,speed:1.1}};
const v=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=T.MathUtils.clamp;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
function curve(t,keys){for(let i=0;i<keys.length-1;i++){const a=keys[i],b=keys[i+1];if(t<=b[0])return T.MathUtils.lerp(a[1],b[1],smooth((t-a[0])/(b[0]-a[0])))}return keys.at(-1)[1]}
export function buildRig(data){
 const r=originalRig(data),pelvis=new T.Group();pelvis.name='pelvis';pelvis.position.y=.93;r.root.add(pelvis);r.root.updateMatrixWorld(true);
 for(const name of ['body','legL','legR'])pelvis.attach(r.nodes.get(name));
 r.nodes.set('pelvis',pelvis);r.joints.pelvis=pelvis;
 for(const name of ['pelvis','body','legL','legR']){const o=r.nodes.get(name);r.rest.set(name,{position:o.position.clone(),quaternion:o.quaternion.clone(),scale:o.scale.clone()})}
 for(const c of r.cloth){const inv=c.world.clone().invert();for(let i=0;i<c.base.length;i+=3){const p=v().fromArray(c.base,i).applyMatrix4(c.world);p.x*=.70+.30*smooth((p.y-1.02)/.28);p.applyMatrix4(inv).toArray(c.base,i)}}
 return r;
}
function solve(r,upperName,lowerName,endName,target,pole,endQ){
 const upper=r.nodes.get(upperName),lower=r.nodes.get(lowerName),end=r.nodes.get(endName);
 r.root.updateMatrixWorld(true);const start=upper.getWorldPosition(v()),delta=target.clone().sub(start),raw=delta.length(),axis=delta.normalize();
 const a=r.rest.get(lowerName).position,b=r.rest.get(endName).position,L1=a.length(),L2=b.length(),d=clamp(raw,Math.abs(L1-L2)+.001,L1+L2-.0001);
 const along=(L1*L1-L2*L2+d*d)/(2*d),height=Math.sqrt(Math.max(0,L1*L1-along*along));
 pole=pole.clone().addScaledVector(axis,-pole.dot(axis)).normalize();
 const elbow=start.clone().addScaledVector(axis,along).addScaledVector(pole,height);
 upper.quaternion.copy(upper.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(new T.Quaternion().setFromUnitVectors(a.clone().normalize(),elbow.clone().sub(start).normalize())));
 r.root.updateMatrixWorld(true);
 lower.quaternion.copy(upper.getWorldQuaternion(new T.Quaternion()).invert().multiply(new T.Quaternion().setFromUnitVectors(b.clone().normalize(),target.clone().sub(elbow).normalize())));
 r.root.updateMatrixWorld(true);end.quaternion.copy(lower.getWorldQuaternion(new T.Quaternion()).invert().multiply(endQ));r.root.updateMatrixWorld(true);
 return end.getWorldPosition(v()).distanceTo(target);
}
function cloth(r,name,u,round){
 const n=r.nodes,bd=n.get('body').matrixWorld.clone().multiply(r.bind.get('body').clone().invert());
 const ld={};for(const s of ['L','R'])ld[s]=n.get('leg'+s).matrixWorld.clone().multiply(r.bind.get('leg'+s).clone().invert());
 for(const c of r.cloth){const delta=c.node.matrixWorld.clone().multiply(c.world.clone().invert()),inv=c.node.matrixWorld.clone().invert(),a=c.mesh.geometry.attributes.position;
  for(let i=0;i<a.count;i++){
   const p=v().fromArray(c.base,i*3).applyMatrix4(c.world),h=clamp((1.36-p.y)/.85,0,1);let out=p.clone().applyMatrix4(delta);
   if(c.type==='coat'){const w=clamp((.99-p.y)/.44,0,1);out=p.clone().applyMatrix4(bd).lerp(p.clone().applyMatrix4(ld[p.x>=0?'L':'R']),w*(name==='vault'?.70:.86))}
   if(c.type==='cape'){out.z-=h*h*((name==='run'?.12:.05)+.018*Math.sin(u*Math.PI*2+h*2));out.y-=h*h*(name==='vault'?.24*Math.sin(Math.PI*u):.015);if(name==='vault'&&round>=6)out.x-=.16*h*h*Math.sin(Math.PI*u)}
   if(name==='vault'&&round>=6&&Math.abs(out.x)<1.5&&Math.abs(out.z)<.145&&out.y<1.065){out.z=-.15}
   out.y=Math.max(.007,out.y);out.applyMatrix4(inv);a.setXYZ(i,out.x,out.y,out.z);
  }a.needsUpdate=true;c.mesh.geometry.computeVertexNormals();
 }
}
export function pose(r,name,time,round=4){
 const u=clamp(time/clips[name].duration,0,1),phase=u*Math.PI*2,n=r.nodes;
 if(name!=='vault'){
  originalPose(r,name,time,round>=4?2:1,2);
  for(const [side,sign] of [['L',1],['R',-1]]){
   if(name==='jump'){
    n.get('arm'+side).rotation.x=curve(u,[[0,.05],[.15,.55],[.31,-1.65],[.60,-.9],[.84,-.5],[1,.05]])*(round>=4?1:.86);
    n.get('elbow'+side).rotation.x=-.30-.35*Math.sin(Math.PI*u);
   }else{
    n.get('arm'+side).rotation.x=(name==='run'?.60:.30)*Math.cos(phase)*sign-(name==='run'?.15:0);
    n.get('elbow'+side).rotation.x=name==='run'?(-1.1-.12*Math.cos(phase)*sign):(-.28-.07*Math.cos(phase)*sign);
   }
  }
  if(round>=4)n.get('head').rotation.y=-n.get('body').rotation.y*.6;
  r.root.updateMatrixWorld(true);cloth(r,name,u,round);return r.metrics;
 }
 for(const [name,o] of r.nodes){const b=r.rest.get(name);o.position.copy(b.position);o.quaternion.copy(b.quaternion);o.scale.copy(b.scale)}
 const z=curve(u,[[0,-.78],[.20,-.60],[.32,-.42],[.45,-.12],[.60,.22],[.82,.69],[1,.94]]);
 const y=curve(u,[[0,-.08],[.20,-.12],[.32,.26],[.45,.43],[.60,.43],[.72,.34],[.86,-.16],[1,-.07]]);
 const roll=curve(u,[[0,0],[.22,0],[.36,.93],[.50,1.13],[.65,.96],[.84,0],[1,0]])*(round>=5?1:.88);
 r.root.position.set(0,y,z);n.get('pelvis').rotation.set(0,round>=5?.13*Math.sin(Math.PI*u):0,roll);
 n.get('body').rotation.x=.18*Math.sin(Math.PI*u);n.get('head').rotation.z=-roll*(round>=7?.70:.45);
 n.get('armL').rotation.set(-.28,0,(round>=7?1.05:.80)*Math.sin(Math.PI*u));n.get('elbowL').rotation.x=round>=7?-.3-.25*Math.sin(Math.PI*u):-.4;
 n.get('armR').rotation.set(-.4,0,.2);n.get('elbowR').rotation.x=-.6;
 r.root.updateMatrixWorld(true);
 let footError=0,handError=0;const targets={};
 for(const side of ['L','R']){
  const left=side==='L';let x=left?.093:-.093,fy=0,fz=left?-.50:-.85,contact=u<.21;
  const landing=round>=5?(left?.86:.91):.88;
  if(u>=.21&&u<landing){x=curve(u,[[.21,x],[.40,.60+(left?.05:-.05)],[.64,.66+(left?.05:-.05)],[landing,left?.093:-.093]]);fy=curve(u,[[.21,0],[.28,.36],[.32,.64],[.40,1.14],[.60,1.20],[.70,1.1],[.80,.55],[landing,0]]);fz=curve(u,[[.21,fz],[.38,-.50],[.50,.15],[.70,.50],[landing,.75+(left?.06:-.06)]]);contact=false}
  else if(u>=landing){fz=.75+(left?.06:-.06);contact=true}
  const q=new T.Quaternion(),off=-Math.min(...r.feet[side].points.map(p=>p.y)),target=v(x,fy+off,fz);
  footError=Math.max(footError,solve(r,'leg'+side,'knee'+side,'ankle'+side,target,v(1,.35,-.6),q));r.feet[side].contact=contact;r.feet[side].target.copy(target);targets[side]=target.toArray();
 }
 const support=u>=.32&&u<=.45;
 if(u>.23&&u<.53){
  const w=u<.32?smooth((u-.23)/.09):u>.45?1-smooth((u-.45)/.08):1;
  const target=n.get('handR').getWorldPosition(v()).lerp(v(-.28,1.067,round>=4?-.16:z+.24),w);
  if(u<.32)target.y+=.12*Math.sin(Math.PI*(u-.23)/.09);
  handError=solve(r,'armR','elbowR','handR',target,v(-.6,.1,-.6),new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,0,0)));
 }
 r.root.updateMatrixWorld(true);cloth(r,name,u,round);
 r.metrics={footError,handError,contactHands:support,supportHand:'R',targets,round,sideVault:true};return r.metrics;
}
