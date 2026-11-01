import * as T from 'three';
import {createMoebiusSwampPlacement} from '/TigerMessenger/src/world/moebiusSwamp.js';
const status=document.querySelector('#status'),variant=new URLSearchParams(location.search).get('variant')==='before'?'改前':'改后';
const faults=[];window.addEventListener('error',e=>{faults.push(e.message);status.textContent=JSON.stringify({faults});});
try {
 const scene=new T.Scene();scene.background=new T.Color('#eee7dd');
 const camera=new T.PerspectiveCamera(60,1,.05,300),renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
 renderer.setPixelRatio(1);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.NoToneMapping;
 renderer.debug.onShaderError=(gl,program,vs,fs)=>{faults.push(gl.getProgramInfoLog(program),gl.getShaderInfoLog(vs),gl.getShaderInfoLog(fs));};
 document.body.append(renderer.domElement);
 scene.add(new T.HemisphereLight(0xc1e2e5,0x31455a,2));const sun=new T.DirectionalLight(0xffead0,2);sun.position.set(25,50,30);scene.add(sun);
 const root=createMoebiusSwampPlacement({scale:.5,seed:7711});scene.add(root);const inner=root.userData.inner;
 // Even a paused inspection must initialize actors at their actual story positions.
 root.userData.update?.(1/60,0,{});scene.updateMatrixWorld(true);
 const levels=inner.userData.gregSpatialPlan.levels;
 const views={overview:[[45,68,50],[-4,30,-3]],upper:[[28,38.2,4.5],[-8,31,-7]],middle:[[18,34.2,18],[-8,28,-7]],lower:[[-7,30.2,19],[-8,26,-7]],under:[[6,21,14],[-8,23,-7]]};
 let current=new URLSearchParams(location.search).get('view')||'overview',t=0,previous=performance.now(),lastInfo=0;
 function view(name){current=name;camera.position.copy(inner.localToWorld(new T.Vector3(...views[name][0])));camera.up.set(0,1,0);camera.lookAt(inner.localToWorld(new T.Vector3(...views[name][1]))); draw();}
 // Shore cameras use the actual terrace centre and the production player's 1.66-world height.
 for(const [i,name] of ['upper','middle','lower'].entries()){const l=levels[i],a=(l.angleStart+l.angleEnd)/2;views[name][0]=[Math.cos(a)*l.radius*2,l.innerY+3.32,Math.sin(a)*l.radius*2];}
 const actorViews={tiger:()=>inner.userData.tiger,dock:()=>inner.userData.shipyard.barge,bird:()=>inner.getObjectByName('swamp-bird'),monkey:()=>inner.getObjectByName('swamp-longtail-monkey'),lizard:()=>inner.getObjectByName('swamp-glow-lizard')};
 function refreshActorViews(){for(const [name,get]of Object.entries(actorViews)){const actor=get();if(!actor)continue;const p=inner.worldToLocal(actor.getWorldPosition(new T.Vector3()));const offset=name==='dock'?[9,7,10]:name==='tiger'?[-10,Math.max(9,48-p.y),-4]:[3,2,4];views[name]=[p.clone().add(new T.Vector3(...offset)).toArray(),p.clone().add(new T.Vector3(0,name==='tiger'?.7:.2,0)).toArray()];}}
 refreshActorViews();
 document.querySelector('#drink').onclick=()=>{inner.userData.tiger.userData.forceDrink=true;document.querySelector('#motion').checked=false;};
 document.querySelector('#step').onclick=()=>{document.querySelector('#motion').checked=false;for(let i=0;i<120;i++){t+=1/60;root.userData.update?.(1/60,t,{});}scene.updateMatrixWorld(true);refreshActorViews();view(current);};
 Promise.resolve(inner.userData.tiger?.userData.swampTigerV2Ready).then(()=>{root.userData.update?.(0,t,{});scene.updateMatrixWorld(true);refreshActorViews();view(current);});
 function resize(){renderer.setSize(innerWidth,Math.max(450,innerHeight-130));camera.aspect=renderer.domElement.width/renderer.domElement.height;camera.updateProjectionMatrix();draw();}addEventListener('resize',resize);resize();view(current);
 function entryReport(){
  const top=inner.userData.tigerWalkSurfaces?.[0],lamp=inner.getObjectByName('v2-entry-lamps')?.children[0];
  if(!top)return null;top.geometry.computeBoundingBox();
  const box=top.geometry.boundingBox,round=v=>v.map(n=>+n.toFixed(4));
  return {graded:!!inner.userData.tigerLandingGraded,topBounds:{min:round(box.min.toArray()),max:round(box.max.toArray())},topPosition:round(top.position.toArray()),lamp:lamp?{position:round(lamp.position.toArray()),clearance:lamp.userData.entryPatrolClearance??null}:null,cheeks:inner.getObjectByName('v2-entry-stone-cheeks')?.children.slice(0,2).map(n=>n.userData.entryPatrolClearance??null)};
 }
 function draw(){renderer.render(scene,camera);status.textContent=JSON.stringify({reviewBuild:'entry-clearance-a1',serviceWorker:navigator.serviceWorker?.controller?.scriptURL??null,entry:entryReport(),tigerPosition:inner.userData.tiger?.position.toArray().map(n=>+n.toFixed(4)),tigerHeading:+(inner.userData.tiger?.rotation.y??0).toFixed(4),variant,view:current,round:inner.userData.swampV2Round,time:+t.toFixed(2),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,shaderErrors:faults,bankHeights:levels.map(x=>x.innerY),visuals:inner.userData.gregLakeVisuals?.version,waterShore:inner.userData.swampWaterShore?.version??null,coralRim:inner.userData.gregCoralRim?.version??null,dock:inner.userData.gregShoreDock?.version??null,naturalCliff:inner.userData.gregNaturalCliff?.version??null,tigerMode:inner.userData.tiger?.userData._mode,tigerSupport:inner.userData.tiger?.userData.tigerTargetSupport?.feet?.map(f=>({height:f.height,y:f.foot[1]}))});}
 function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-previous)/1000);previous=now;if(document.hidden)return;
 const moving=document.querySelector('#motion').checked;
 if(moving){t+=dt;root.userData.update?.(dt,t,{});if(actorViews[current]){refreshActorViews();view(current);}}
 // Refresh static views after texture completion or browser backing-buffer changes.
 if(moving||now-lastInfo>500){lastInfo=now;draw();}}
 requestAnimationFrame(frame);
}catch(e){status.textContent=e.stack;throw e;}
