import * as T from 'three';
import {SWAMP_COMPONENT_BUILDERS as current} from '/TigerMessenger/src/world/moebiusSwamp.js';
import {SWAMP_COMPONENT_BUILDERS as original} from '../greg-lake-implementation-20261007/before/moebiusSwamp.js';
import {createMoebiusTiger} from '/TigerMessenger/src/world/moebiusTiger.js';
import {applySwampTigerV2 as tigerBefore} from './before/src/assets/characters/swampTigerV2.js';
import {applySwampTigerV2 as tigerAfter} from '/TigerMessenger/src/assets/characters/swampTigerV2.js';
const list=[['whale','白鲸 · 3个剧情身份'],['tiger','成年湖沼虎 · 1'],['longTailMonkey','长尾猴 · 3普通+2维修'],['swampBird','荧光雀 · 4'],['glowLizard','蜥蜴 · 4个剧情身份'],['lotusLeafBoat','花船黑色男孩 · 5船10人（含岸边/喂鲸）'],['swampEel','鳗鱼 · 1（本批重制）'],['pinkHanger','辣椒猴 · 3（本批重制）'],['tubeWormCluster','管虫 · 11（本批重制）'],['ribbonFish','荧色蝾螈 · 3（本批重制）'],['fishSchool','绿斑小鱼 · 9（本批重制）'],['nativeDoll','水下泳者 · 1（本批重制）'],['fireflies','萤火虫 · 46（本批重制）']];
const select=document.querySelector('#species');for(const[id,label]of list){const opt=document.createElement('option');opt.value=id;opt.textContent=label;select.append(opt);}
const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;document.body.append(renderer.domElement);const errors=[];renderer.debug.onShaderError=(gl,p,v,f)=>errors.push(gl.getProgramInfoLog(p),gl.getShaderInfoLog(v),gl.getShaderInfoLog(f));
const cache=new Map();let pair=null,id=new URLSearchParams(location.search).get('species')||'whale';
function rnd(){let n=7711;return ()=>{n=(n*1664525+1013904223)>>>0;return n/4294967296;};}
async function build(key){if(cache.has(key))return cache.get(key);const result=[];
 for(const builders of[original,current]){let actor;if(key==='tiger'){actor=createMoebiusTiger(rnd());const stage=new T.Group();stage.add(actor);(builders===original?tigerBefore:tigerAfter)(actor);await actor.userData.swampTigerV2Ready;}else actor=key==='nativeDoll'?builders[key](1):builders[key](rnd(),key==='swampBird'?0xd8ffe0:undefined);
  // Keep original authored shape; suppress only identical atmosphere halos for silhouette inspection.
  if(key!=='fireflies')actor.traverse(o=>{if(o.isSprite)o.visible=false;});
  if(key==='whale')actor.rotation.x=-.95;const scene=new T.Scene();scene.background=new T.Color(key==='fireflies'?'#31455a':'#eee7dd');scene.add(actor,new T.HemisphereLight(0xc1e2e5,0x31455a,2));const sun=new T.DirectionalLight(0xffead0,2);sun.position.set(5,8,6);scene.add(sun);scene.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(actor,true);if(key==='fireflies')box.set(new T.Vector3(-5,0,-5),new T.Vector3(5,6,5));result.push({actor,scene,box});}
 cache.set(key,result);return result;}
function draw(){if(!pair)return;const w=innerWidth,h=Math.max(350,innerHeight-145);renderer.setSize(w,h);renderer.setScissorTest(true);const size=new T.Vector3(),extent=Math.max(...pair.map(p=>{p.box.getSize(size);return Math.max(size.x,size.y,size.z);}))*1.08;
 for(const [i,p]of pair.entries()){const center=p.box.getCenter(new T.Vector3()),aspect=(w/2)/h,vertical=extent/Math.min(1,aspect);const camera=new T.OrthographicCamera(-vertical*aspect/2,vertical*aspect/2,vertical/2,-vertical/2,.01,200);const direction=id==='lotusLeafBoat'?new T.Vector3(1,.9,1.3):id==='whale'?new T.Vector3(1,.3,1):id==='tiger'?new T.Vector3(-1,.25,1.1):id==='ribbonFish'?new T.Vector3(.25,3,1):new T.Vector3(1,.32,1.3);camera.position.copy(center).addScaledVector(direction.normalize(),extent*3+5);camera.lookAt(center);renderer.setViewport(i*w/2,0,w/2,h);renderer.setScissor(i*w/2,0,w/2,h);renderer.render(p.scene,camera);}
 renderer.setScissorTest(false);document.querySelector('#status').textContent=JSON.stringify({id,sourceLeft:'20261007 before/moebiusSwamp component builders; tiger20261008 snapshots',sourceRight:'current production component builders',seed:7711,equalFraming:true,shaderErrors:errors,tigerRounds:id==='tiger'?pair.map(p=>p.actor.userData.tigerTargetRound):undefined});}
select.onchange=async()=>{id=select.value;pair=await build(id);draw();};addEventListener('resize',draw);select.value=id;pair=await build(id);draw();
