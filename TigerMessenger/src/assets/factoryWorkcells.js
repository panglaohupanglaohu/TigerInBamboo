import * as THREE from 'three';
import {factoryKit} from './factoryArchitecture.js';
import {mergeStaticGroup} from '../world/geometryMerge.js';
export function addFactoryWorkcell(root,kind){
 const g=new THREE.Group();g.name=kind+'-operating-workcell';g.position.set(5.4,0,-7.4);root.add(g);
 const fixed=new THREE.Group();g.add(fixed);const K=factoryKit(fixed),{M,box,cyl,beam,torus,pipe,sign,gear}=K;
 const spin=new THREE.Group();spin.name=kind+'-drive-wheel';g.add(spin);
 box(2.4,.25,2.3,0,.125,0,M.iron);box(1.8,.6,1.8,0,.5,0,M.slate);const updates=[];
 if(kind==='ant'){
  cyl(.48,2.8,0,1.28,-.15,M.copper).rotation.x=Math.PI/2;
  for(const z of[-1.25,.85])torus(.51,.065,0,1.28,z,M.iron);
  pipe([[.3,1.6,-1.2],[.3,2.2,-1.2],[1,2.2,-1.2],[1,.65,-1.2]],.075);
  spin.position.set(-.72,1.42,0);spin.rotation.y=Math.PI/2;K.wheel(0,0,0,1.12,spin);torus(.88,.045,0,0,.03,M.copper,spin);
  const piston=new THREE.Group();piston.name='ant-reciprocating-piston';g.add(piston);box(.22,.22,.4,0,1.28,.85,M.iron,piston);beam([0,1.28,.8],[0,1.28,1.7],.045,M.brass,piston);
  updates.push(t=>{spin.rotation.z=t*.9;piston.position.z=Math.sin(t*.9)*.25;});sign('STEAM ENGINE TEST BAY',2.4,.35,0,2.75,-.3);
 }else if(kind==='beetle'){
  box(2.5,.32,1,0,1.1,0,M.slate);for(const x of[-1,1])box(.45,.85,.9,x,1.6,0,M.iron);
  cyl(.16,1.85,0,1.74,0,M.brass).rotation.z=Math.PI/2;
  spin.position.set(-.72,1.74,0);spin.rotation.y=Math.PI/2;gear(0,0,0,.43,spin);cyl(.26,.25,0,0,0,M.iron,spin).rotation.x=Math.PI/2;
  const slide=new THREE.Group();slide.name='beetle-lathe-tool-slide';g.add(slide);box(.38,.25,.75,0,1.3,.22,M.copper,slide);beam([0,1.42,.58],[0,1.74,.12],.045,M.iron,slide);
  updates.push(t=>{spin.rotation.z=t*2.2;slide.position.x=Math.sin(t*.35)*.45;});sign('PRECISION BEARINGS',2.4,.35,0,2.75,-.3);
 }else{
  for(const x of[-1,1])box(.15,3.8,.18,x,1.9,-.7,M.iron);box(2.4,.25,.8,0,3.8,-.7,M.iron);
  const arm=new THREE.Group();arm.name='locust-assembly-fixture';g.add(arm);arm.position.set(0,1.5,0);
  cyl(.30,1.4,0,0,0,M.iron,arm).rotation.z=Math.PI/2;box(.9,1.3,.75,0,.7,0,M.slate,arm);box(.76,.85,.13,0,.8,.44,M.stone,arm);
  for(const x of[-.7,.7])beam([x,.1,0],[x,1.45,0],.065,M.brass,arm);
  spin.position.set(0,1.5,-.7);gear(0,0,0,.62,spin);updates.push(t=>{spin.rotation.z=Math.sin(t*.2)*.16;arm.rotation.z=Math.sin(t*.2)*.07;});sign('HEAVY JOINT ASSEMBLY',2.4,.35,0,4.25,-.3);
 }
 mergeStaticGroup(fixed);return t=>{for(const update of updates)update(t);};
}
