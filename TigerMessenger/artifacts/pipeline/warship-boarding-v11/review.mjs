import * as T from 'three';
import * as H from '../../../src/assets/harbor.js';
import {bindRomanSoldierEquipment} from '../../../src/assets/romanSoldierEquipment.js';
import {bindWarshipCohort} from '../../../src/world/warshipCrewContinuity.js';
import {bindRomanShipCarryPose} from '../../../src/world/romanShipCarryPose.js';
const view=document.querySelector('#view'),status=document.querySelector('#status');
try {
 const scene=new T.Scene();scene.background=new T.Color('#899598');
 scene.add(new T.HemisphereLight(0xfff5e0,0x394650,2));const sun=new T.DirectionalLight(0xffffff,2.3);sun.position.set(4,9,5);scene.add(sun);
 const boat=H.createFisherBoat();boat.name='review-original-troopship';boat.scale.setScalar(1.7);scene.add(boat);H.paintBoatCrewCrest(boat,'blue');
 const cohort=new T.Group();scene.add(cohort);const actors=[];
 function roleAt(i){const x=i%5-2,z=Math.floor(i/5)-2;return Math.max(Math.abs(x),Math.abs(z))>=2?'spear':Math.abs(x)+Math.abs(z)===2?'gladius':'longbow';}
 for(let i=0;i<25;i++){const role=roleAt(i),a=role==='spear'?H.createHarborPatrolSoldier():role==='gladius'?H.createGladiusSoldier():H.createLongbowSoldier({rand:()=>.5});bindRomanSoldierEquipment(a)?.setEnabled(true);H.paintSoldierHelm?.(a,'blue');a.userData.uid=100+i;a.userData.phalanxRole=role;actors.push(a);cohort.add(a);}
 const continuity=bindWarshipCohort(boat,actors,cohort),carry=actors.map(bindRomanShipCarryPose);
 const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));view.append(renderer.domElement);
 const camera=new T.PerspectiveCamera(40,1,.1,100);camera.position.set(11,10,13);const controls={target:new T.Vector3(),update(){camera.lookAt(this.target);},addEventListener(){}};
 let pointer=null;
 renderer.domElement.style.touchAction='none';
 renderer.domElement.onpointerdown=e=>{pointer=[e.clientX,e.clientY];renderer.domElement.setPointerCapture(e.pointerId);};
 renderer.domElement.onpointerup=()=>pointer=null;
 renderer.domElement.onpointermove=e=>{if(!pointer)return;const p=new T.Spherical().setFromVector3(camera.position.clone().sub(controls.target));p.theta-=(e.clientX-pointer[0])*.006;p.phi=T.MathUtils.clamp(p.phi-(e.clientY-pointer[1])*.006,.04,Math.PI-.04);camera.position.copy(new T.Vector3().setFromSpherical(p).add(controls.target));pointer=[e.clientX,e.clientY];controls.update();render();};
 renderer.domElement.addEventListener('wheel',e=>{e.preventDefault();const delta=camera.position.clone().sub(controls.target);delta.setLength(T.MathUtils.clamp(delta.length()*Math.exp(e.deltaY*.001),5,35));camera.position.copy(controls.target).add(delta);controls.update();render();},{passive:false});controls.target.set(0,2.6,0);controls.update();
 let seat=0,stage='seated';
 const names={seated:'坐席中：武器留在中央', 'deck-unarmed':'已离座：本人武器仍在中央', 'deck-armed':'已取械：中央对应武器移除',ashore:'上岸状态：原座位保持空置'};
 function render(){renderer.render(scene,camera);}
 function apply(){const a=actors[seat];carry[seat]?.setEnabled(stage!=='seated');carry[seat]?.update();continuity.setStage(seat,stage);
  boat.updateMatrixWorld(true);const seated=boat.userData.warshipV6.nodes.get(`n220:i${seat}`),p=boat.worldToLocal(seated.getWorldPosition(new T.Vector3()));
  a.position.copy(boat.localToWorld(new T.Vector3(p.x,.663,seat<13?-.29:.29)));a.quaternion.identity();
  // Position samples are deliberately discontinuous: no path clearance claim.
  if(stage==='ashore')a.position.set(5.4,.663*1.7,2.3);
  a.updateMatrixWorld(true);let low=Infinity;for(const leg of [a.userData.parts.legL,a.userData.parts.legR]){if(leg)low=Math.min(low,new T.Box3().setFromObject(leg).min.y);}if(Number.isFinite(low))a.position.y+=.663*1.7-low;
  status.textContent=`${names[stage]}。士兵编号 ${a.userData.uid}；${stage==='ashore'?'岸侧位置仅为状态样本，未模拟岸面。':'当前显示真实游戏模型。'}`;
  document.querySelectorAll('[data-stage]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.stage===stage)));render();
 }
 document.querySelector('#role').onchange=e=>{carry[seat]?.setEnabled(false);continuity.setStage(seat,'seated');seat=Number(e.target.value);apply();};
 document.querySelectorAll('[data-stage]').forEach(b=>b.onclick=()=>{stage=b.dataset.stage;apply();});
 document.querySelector('#top').onclick=()=>{camera.position.set(0,16,.01);controls.target.set(0,1.5,0);controls.update();render();};
 document.querySelector('#perspective').onclick=()=>{camera.position.set(11,10,13);controls.target.set(0,2.6,0);controls.update();render();};
 controls.addEventListener('change',render);new ResizeObserver(()=>{camera.aspect=view.clientWidth/view.clientHeight;camera.updateProjectionMatrix();renderer.setSize(view.clientWidth,view.clientHeight);render();}).observe(view);
 apply();window.warshipTransferReview={boat,actors,continuity,get seat(){return seat},get stage(){return stage}};
} catch(error){status.textContent='检查页加载失败：'+error.message;throw error;}
