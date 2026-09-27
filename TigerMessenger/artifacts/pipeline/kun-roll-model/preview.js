import * as T from 'three';
import {saihojiGardenScene} from '../../../src/scenes/saihojiGarden.js';
const scene=new T.Scene();scene.background=new T.Color('#abc8ce');
const loaded=saihojiGardenScene.load({scene,planetRadius:160,options:{}}),kun=loaded.group;
for(const child of [...scene.children])if(child!==kun)child.visible=false;
loaded.previewRoll(0);const base=kun.quaternion.clone(),center=kun.position.clone();
scene.add(new T.HemisphereLight(0xe3f1ff,0x5a6558,2));
const light=new T.DirectionalLight(0xffe8c9,2.1);light.position.copy(center).add(new T.Vector3(20,45,35).applyQuaternion(base));scene.add(light);light.target.position.copy(center);scene.add(light.target);
const renderer=new T.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));document.body.append(renderer.domElement);
const camera=new T.PerspectiveCamera(43,1,.1,1000);camera.up.set(0,1,0).applyQuaternion(base);camera.position.copy(center).add(new T.Vector3(12,28,65).applyQuaternion(base));camera.lookAt(center);
const slider=document.querySelector('#angle'),label=document.querySelector('#label');let playing=false,start=0;
function pose(degrees){loaded.previewRoll(degrees*Math.PI/180);slider.value=degrees;label.textContent=Math.round(degrees)+'°';renderer.render(scene,camera);}
function size(){renderer.setSize(innerWidth,Math.max(400,innerHeight-document.querySelector('header').offsetHeight));camera.aspect=renderer.domElement.clientWidth/renderer.domElement.clientHeight;camera.updateProjectionMatrix();}size();addEventListener('resize',size);
document.querySelectorAll('[data-angle]').forEach(b=>b.onclick=()=>{playing=false;pose(+b.dataset.angle)});slider.oninput=()=>{playing=false;pose(+slider.value)};
document.querySelector('#play').onclick=()=>{playing=true;start=performance.now()};
renderer.setAnimationLoop(now=>{if(playing){const p=Math.min(1,(now-start)/8000);pose(360*(p*p*(3-2*p)));if(p===1)playing=false}else renderer.render(scene,camera)});
window.rollReview={loaded,kun,pose,scene};pose(0);
