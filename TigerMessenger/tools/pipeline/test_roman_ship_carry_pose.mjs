import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import{mkdir,writeFile}from'node:fs/promises';
const out='artifacts/pipeline/roman-ship-carry';await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try{
const p=await browser.newPage({viewport:{width:1200,height:850}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
await p.route('**/carry-fixture',r=>r.fulfill({contentType:'text/html',body:'<script type="importmap">{"imports":{"three":"/TigerMessenger/vendor/three.module.js","three/addons/":"/TigerMessenger/vendor/jsm/"}}</script><body style="margin:0"></body>'}));await p.goto('http://localhost:8931/carry-fixture');
const report=await p.evaluate(async()=>{
const T=await import('three'),H=await import('/TigerMessenger/src/assets/harbor.js'),E=await import('/TigerMessenger/src/assets/romanSoldierEquipment.js'),C=await import('/TigerMessenger/src/world/romanShipCarryPose.js');
const scene=new T.Scene();scene.background=new T.Color('#829098');scene.add(new T.HemisphereLight(0xffffff,0x33402b,3));const l=new T.DirectionalLight(0xffffff,3);l.position.set(3,5,4);scene.add(l);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(1200,850);document.body.append(renderer.domElement);
const camera=new T.PerspectiveCamera(36,1200/850,.01,100);camera.position.set(3,2.4,4.5);camera.lookAt(0,.55,0);
function bounds(a){a.updateWorldMatrix(true,true);const b=new T.Box3(),v=new T.Vector3(),inv=a.matrixWorld.clone().invert();a.traverse(n=>{if(!n.isMesh||!n.geometry?.attributes.position)return;for(let q=n;q;q=q.parent)if(!q.visible)return;const m=inv.clone().multiply(n.matrixWorld),ps=n.geometry.attributes.position;for(let i=0;i<ps.count;i++)b.expandByPoint(v.fromBufferAttribute(ps,i).applyMatrix4(m));});return{min:b.min.toArray(),max:b.max.toArray(),width:b.max.z-b.min.z};}
const results=[];
for(const [i,f]of [H.createHarborPatrolSoldier,H.createGladiusSoldier,H.createLongbowSoldier].entries()){
const a=f();E.bindRomanSoldierEquipment(a);scene.add(a);a.position.x=(i-1)*1.1;
if(a.userData.bowCycle){a.userData.bowCycle.phase='draw';a.userData.bowCycle.t=.13;H.updateLongbowShot(a,.016,()=>.5);}
const before=bounds(a);const nodes=[];a.traverse(n=>nodes.push(n));const state=nodes.map(n=>JSON.stringify([n.position.toArray(),n.quaternion.toArray(),n.scale.toArray(),n.visible]));const parents=nodes.map(n=>n.parent);const bow=JSON.stringify(a.userData.bowCycle);
const c=C.bindRomanShipCarryPose(a);c.setEnabled(true);const after=bounds(a),gripErrors=c.gripErrors();c.setEnabled(false);
const restored=nodes.every((n,j)=>state[j]===JSON.stringify([n.position.toArray(),n.quaternion.toArray(),n.scale.toArray(),n.visible])&&parents[j]===n.parent)&&bow===JSON.stringify(a.userData.bowCycle);
c.setEnabled(true);
const q=a.quaternion.clone(),scale=a.scale.clone();a.rotation.set(.2,.7,-.1);a.scale.set(1.2,.9,1.1);c.update();const transformedGrip=c.gripErrors();a.quaternion.copy(q);a.scale.copy(scale);c.update();
results.push({role:c.role,before,after,gripErrors,transformedGrip,restored,passesWidth:after.width<=.43});
}
renderer.render(scene,camera);return{results,capture:renderer.domElement.toDataURL(),scope:'Actual three public soldier factories with current approved equipment; optional carry pose only, not integrated movement or boarding.'};});
await writeFile(out+'/carry.png',Buffer.from(report.capture.split(',')[1],'base64'));delete report.capture;report.errors=errors;report.passed=errors.length===0&&report.results.every(r=>r.passesWidth&&r.restored&&r.gripErrors.every(e=>e<1e-6)&&r.transformedGrip.every(e=>e<1e-6));await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
}finally{await browser.close();}
