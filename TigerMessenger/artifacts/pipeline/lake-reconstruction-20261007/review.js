import * as T from 'three';
import {createMoebiusSwampPlacement} from '/TigerMessenger/src/world/moebiusSwamp.js';
const status=document.querySelector('#status'),variant=new URLSearchParams(location.search).get('variant')==='before'?'改前':'改后';
const faults=[];window.addEventListener('error',e=>{faults.push(e.message);status.textContent=JSON.stringify({faults});});
try {
 const scene=new T.Scene();scene.background=new T.Color('#9bc8ce');
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
 function resize(){renderer.setSize(innerWidth,Math.max(450,innerHeight-130));camera.aspect=renderer.domElement.width/renderer.domElement.height;camera.updateProjectionMatrix();draw();}addEventListener('resize',resize);resize();view(current);
 function draw(){renderer.render(scene,camera);status.textContent=JSON.stringify({variant,view:current,round:inner.userData.swampV2Round,time:+t.toFixed(2),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,shaderErrors:faults,bankHeights:levels.map(x=>x.innerY),visuals:inner.userData.gregLakeVisuals?.version,waterShore:inner.userData.swampWaterShore?.version??null});}
 function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-previous)/1000);previous=now;if(document.hidden)return;
 const moving=document.querySelector('#motion').checked;
 if(moving){t+=dt;root.userData.update?.(dt,t,{});}
 // Refresh static views after texture completion or browser backing-buffer changes.
 if(moving||now-lastInfo>500){lastInfo=now;draw();}}
 requestAnimationFrame(frame);
}catch(e){status.textContent=e.stack;throw e;}
