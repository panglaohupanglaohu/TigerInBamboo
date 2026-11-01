// Morris lake town stage — REACodeRefactoring's View, re-hosted inside the game.
//
// The refactor's src/world/view.js owns a WebGLRenderer, a camera rig and a
// scene whose +Y is up. In the game the lake sits on a tilted sphere chart and
// shares the game's renderer, so this file assembles the same parts (World ->
// WorldMesh -> outline / birds / vegetation / atmosphere / effects / decor /
// sound / nav layer / reflection / shore) in a separate, untilted scene in town
// units. Each frame it is drawn right after the main render with a proxy camera
// whose world matrix is inverse(anchor) x gameCamera: view-space positions, and
// therefore depth, are identical to the main pass, so the island banks still
// occlude the town while every refactor shader keeps its world-Y conventions.
// Vendor files are used unchanged (src/vendor/townscaper-rea-refactoring).
import * as THREE from 'three';
import {WorldMesh} from '../vendor/townscaper-rea-refactoring/src/world/worldmesh.js';
import {buildShore,makeSkirtMaterial,makeWaveMaterial} from '../vendor/townscaper-rea-refactoring/src/water/shore.js';
import {OutlineLayers} from '../vendor/townscaper-rea-refactoring/src/world/outline.js';
import {Birds} from '../vendor/townscaper-rea-refactoring/src/life/birds.js';
import {Vegetation} from '../vendor/townscaper-rea-refactoring/src/life/vegetation.js';
import {Atmosphere} from '../vendor/townscaper-rea-refactoring/src/life/atmosphere.js';
import {Effects,popShaderChunk} from '../vendor/townscaper-rea-refactoring/src/life/effects.js';
import {Sound} from '../vendor/townscaper-rea-refactoring/src/life/sound.js';
import {NavLayer} from '../vendor/townscaper-rea-refactoring/src/world/navlayer.js';
import {Decor} from '../vendor/townscaper-rea-refactoring/src/life/decor.js';
import {MAX_LEVEL} from '../vendor/townscaper-rea-refactoring/src/core/world.js';
import {pointInQuad} from '../vendor/townscaper-rea-refactoring/src/core/spatial.js';

// Same constants as REACodeRefactoring/src/world/view.js setTimeOfDay().
export const TOWN_TIME_PROFILES={
 day:{sun:[0xfff1dc,2.7],dir:[-9,21,15],amb:.5,hemi:.95,fill:.45,night:0,exp:1.08,bg:'#6aa8b0',sea:['#5f9fa8','#4f8f99','#78b1b8']},
 dusk:{sun:[0xffb37a,2.2],dir:[22,7,6],amb:.35,hemi:.6,fill:.3,night:.25,exp:1.05,bg:'#c58f86',sea:['#7b8f9e','#5d7787','#c79a8f']},
 night:{sun:[0x9fb4ff,.45],dir:[-8,20,12],amb:.18,hemi:.25,fill:.12,night:1,exp:1,bg:'#24414f',sea:['#2c4c5a','#223f4c','#2b4855']}
};

export class MorrisTownStage{
 /**
  * @param {object} o
  * @param {import('../vendor/townscaper-rea-refactoring/src/core/world.js').World} o.world
  * @param {THREE.BufferGeometry} o.waterGeometry lake surface in town units (horizontal, y = 0)
  * @param {THREE.Object3D} o.anchor object in the game scene whose matrixWorld maps town units to world
  */
 constructor({world,grid,index,waterGeometry,anchor,levelHeight=.5,shadowExtent=28}){
  this.world=this.town=world;this.grid=grid;this.index=index;this.anchor=anchor;this.levelHeight=levelHeight;
  this.scene=new THREE.Scene();this.scene.name='morris-reacode-refactoring-town-scene';
  this.proxy=new THREE.PerspectiveCamera();this.proxy.matrixAutoUpdate=false;this.proxy.matrixWorldAutoUpdate=false;
  this.time=0;this.timeOfDay='day';this.exposure=1.08;this.debugState={};this.visible=true;
  // lights (view.js #setupLights)
  this.ambient=new THREE.AmbientLight(0xfffbf2,1.05);this.hemi=new THREE.HemisphereLight(0xf2fbff,0x9fb9b4,1.25);
  const sun=new THREE.DirectionalLight(0xfff3e2,2.3);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);const sc=sun.shadow.camera;sc.left=sc.bottom=-shadowExtent;sc.right=sc.top=shadowExtent;sc.near=1;sc.far=120;sun.shadow.bias=-.0008;sun.shadow.normalBias=.025;sun.shadow.radius=5;
  this.sun=sun;this.sunDir=new THREE.Vector3(13,24,17).normalize();this.fill=new THREE.DirectionalLight(0xd9ecf6,.75);this.fill.position.set(-16,10,-12);
  this.scene.add(this.ambient,this.hemi,sun,sun.target,this.fill);
  // water (view.js #setupWater) on the lake footprint instead of a 400x400 plane
  const uniforms={uTime:{value:0},uShallow:{value:new THREE.Color('#5f9fa8')},uDeep:{value:new THREE.Color('#4f8f99')},uSky:{value:new THREE.Color('#78b1b8')}};this.waterUniforms=uniforms;
  this.water=new THREE.Mesh(waterGeometry,new THREE.ShaderMaterial({uniforms,depthWrite:false,side:THREE.DoubleSide,
   vertexShader:'varying vec3 vWorld;\nvoid main(){vec4 w=modelMatrix*vec4(position,1.0);vWorld=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}',
   fragmentShader:'uniform float uTime;uniform vec3 uShallow;uniform vec3 uDeep;uniform vec3 uSky;varying vec3 vWorld;\nvoid main(){vec2 p=vWorld.xz;float n=sin(p.x*0.35+uTime*0.21)*sin(p.y*0.29-uTime*0.17)+0.5*sin((p.x-p.y)*0.8+uTime*0.37);vec3 col=mix(uDeep,uShallow,0.55+0.08*n);float far=smoothstep(25.0,140.0,length(vWorld.xz-cameraPosition.xz));col=mix(col,uSky,far);gl_FragColor=vec4(col,1.0);\n#include <colorspace_fragment>\n}'}));
  this.water.name='morris-reacode-lake-water';this.water.renderOrder=-2;this.scene.add(this.water);
  this.shadowCatcher=new THREE.Mesh(waterGeometry.clone(),new THREE.ShadowMaterial({opacity:.2,depthWrite:false,side:THREE.DoubleSide}));this.shadowCatcher.position.y=.002;this.shadowCatcher.receiveShadow=true;this.shadowCatcher.renderOrder=4;this.scene.add(this.shadowCatcher);
  // world mesh + material (view.js constructor)
  this.worldMesh=new WorldMesh(world,{levelHeight});
  this.material=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0});
  this.nightUniform={value:0};this.pop=popShaderChunk();this.snowUniform={value:0};
  this.material.onBeforeCompile=shader=>{shader.uniforms.uNight=this.nightUniform;shader.uniforms.uTime=this.waterUniforms.uTime;shader.uniforms.uSnow=this.snowUniform;Object.assign(shader.uniforms,this.pop.uniforms);
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float aGlow;\nvarying float vGlow;\nvarying float vUp;\nuniform float uTime;\n'+this.pop.pars).replace('#include <begin_vertex>','#include <begin_vertex>\nvGlow = aGlow;\nvUp = normalize(objectNormal).y;\n'+this.pop.body);
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float uNight;\nuniform float uSnow;\nvarying float vGlow;\nvarying float vUp;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.93, 0.95, 0.98), uSnow * smoothstep(0.55, 0.85, vUp));').replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0, 0.72, 0.32) * vGlow * uNight * 1.6;');};
  this.mesh=new THREE.Mesh(this.worldMesh.geometry,this.material);this.mesh.name='morris-reacode-refactoring-world';this.mesh.castShadow=this.mesh.receiveShadow=true;this.scene.add(this.mesh);
  this.outline=new OutlineLayers(this.worldMesh.geometry);this.scene.add(this.outline.group);
  this.birds=new Birds({scene:this.scene,town:world,grid,index,levelHeight,water:this.waterUniforms.uShallow});
  this.vegetation=new Vegetation({scene:this.scene,levelHeight,uTime:this.waterUniforms.uTime});this.impostorsReady=false;
  this.atmosphere=new Atmosphere({scene:this.scene,levelHeight,uTime:this.waterUniforms.uTime});
  this.effects=new Effects({scene:this.scene,uTime:this.waterUniforms.uTime,popUniforms:this.pop.uniforms});
  this.navLayer=new NavLayer({scene:this.scene,levelHeight});
  this.sound=new Sound();
  this.decor=new Decor({scene:this.scene,uTime:this.waterUniforms.uTime,uWind:this.atmosphere.uWind,levelHeight});
  // reflection (view.js): mirrored town flattened toward the water/town midpoint colour
  this.reflectMaterial=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,uniforms:{uTime:this.waterUniforms.uTime,uWater:this.waterUniforms.uShallow,uNight:this.nightUniform},
   vertexShader:'uniform float uTime;\nattribute float aGlow;\nvarying vec3 vCol;\nvarying float vDepth;\nvarying float vGlow;\nvoid main(){vec4 w=modelMatrix*vec4(position,1.0);vDepth=-w.y;w.x+=sin(w.y*9.0+uTime*1.3+w.z*0.7)*0.018*vDepth;w.z+=cos(w.y*7.0-uTime*1.1+w.x*0.5)*0.012*vDepth;vCol=color;vGlow=aGlow;gl_Position=projectionMatrix*viewMatrix*w;}',
   fragmentShader:'uniform vec3 uWater;\nuniform float uNight;\nvarying vec3 vCol;\nvarying float vDepth;\nvarying float vGlow;\nvoid main(){vec3 mid=mix(uWater,vCol*1.25+0.04,0.5);mid+=vec3(1.0,0.7,0.3)*vGlow*uNight*0.6;float fade=exp(-vDepth*0.9);gl_FragColor=vec4(mid,0.82*fade);\n#include <colorspace_fragment>\n}'});
  this.reflection=new THREE.Mesh(this.worldMesh.geometry,this.reflectMaterial);this.reflection.scale.y=-1;this.reflection.renderOrder=1;this.scene.add(this.reflection);
  this.skirtMaterial=makeSkirtMaterial(new THREE.Color('#9fd0d3'));this.skirt=new THREE.Mesh(new THREE.BufferGeometry(),this.skirtMaterial);this.skirt.renderOrder=2;this.scene.add(this.skirt);
  this.waveMaterial=makeWaveMaterial();this.waveMaterial.uniforms.uTime=this.waterUniforms.uTime;this.waves=new THREE.Mesh(new THREE.BufferGeometry(),this.waveMaterial);this.waves.renderOrder=3;this.waves.frustumCulled=false;this.scene.add(this.waves);
  // hover quad + learning overlays (view.js #setupHover / #setupDebug)
  const hg=new THREE.BufferGeometry();hg.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(12),3));hg.setIndex([0,1,2,0,2,3]);
  this.hover=new THREE.Mesh(hg,new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.28,depthWrite:false,side:THREE.DoubleSide}));this.hover.visible=false;this.hover.renderOrder=3;this.scene.add(this.hover);
  const seen=new Set(),arr=[];for(const c of grid.cells)for(let i=0;i<c.n;i++){const a=c.pts[i],b=c.pts[(i+1)%c.n],k=a.id<b.id?a.id+':'+b.id:b.id+':'+a.id;if(seen.has(k))continue;seen.add(k);arr.push(a.x,.015,a.z,b.x,.015,b.z);}
  const gg=new THREE.BufferGeometry();gg.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
  this.gridLines=new THREE.LineSegments(gg,new THREE.LineBasicMaterial({color:0xffffff,transparent:true,opacity:.55,depthWrite:false}));this.gridLines.renderOrder=5;this.gridLines.visible=false;this.scene.add(this.gridLines);
  const lineMat=c=>new THREE.LineBasicMaterial({color:c,depthTest:false,transparent:true});
  this.shoreLine=new THREE.LineSegments(new THREE.BufferGeometry(),lineMat(0xffd23a));this.seaLine=new THREE.LineSegments(new THREE.BufferGeometry(),lineMat(0x3a6dff));
  for(const l of[this.shoreLine,this.seaLine]){l.renderOrder=6;l.visible=false;l.frustumCulled=false;this.scene.add(l);}
  this.birdTimer=null;this.birdsReady=false;
  this.setTimeOfDay('day');
 }
 changed(){this.dirty=true;}
 /** 'day' | 'dusk' | 'night' (view.js setTimeOfDay; background is the game's, not ours). */
 setTimeOfDay(mode){const P=TOWN_TIME_PROFILES[mode];if(!P)return;this.timeOfDay=mode;this.sun.color.setHex(P.sun[0]);this.sun.intensity=P.sun[1];this.sunDir.set(...P.dir).normalize();this.ambient.intensity=P.amb;this.hemi.intensity=P.hemi;this.fill.intensity=P.fill;this.nightUniform.value=P.night;this.outline?.setTimeOfDay(mode);this.vegetation?.setTimeOfDay(mode);this.atmosphere?.setFogColor(P.bg);this.exposure=P.exp;this.waterUniforms.uShallow.value.set(P.sea[0]);this.waterUniforms.uDeep.value.set(P.sea[1]);this.waterUniforms.uSky.value.set(P.sea[2]);this.onTimeOfDay?.();}
 /** Learning-panel switches (view.js setDebug, unchanged). */
 setDebug(name,on){this.debugState[name]=on;switch(name){
  case 'grid':this.gridLines.visible=on;break;case 'shorelines':this.shoreLine.visible=on;this.seaLine.visible=on;break;
  case 'wavewire':this.waveMaterial.wireframe=on;this.skirt.visible=!on;break;case 'waves':this.waves.visible=on;this.skirt.visible=on;break;
  case 'reflection':this.reflection.visible=on;this.birds.reflections=on;break;case 'birds':this.birds.visible=on;break;
  case 'vegetation':this.vegetation.visible=on;break;case 'grass':case 'shrubs':case 'trees':case 'flowers':this.vegetation.setLayer(name,on);break;
  case 'leafy':this.vegetation.leafyOn=on;break;case 'impostor':this.vegetation.impostor=on;break;case 'clouds':this.vegetation.clouds=on;break;case 'moody':this.vegetation.moody=on;break;
  case 'wind':this.atmosphere.showArrows=on;break;case 'snow':this.atmosphere.showSnow=on;this.snowUniform.value=on?1:0;break;case 'fog':this.atmosphere.showFog=on;break;
  case 'fire':this.effects.showFire=on;break;case 'sound':this.sound.enabled=on;break;case 'nav':this.navLayer.showGraph=on;break;
  case 'modules':this.worldMesh.debugModules=on;this.worldMesh.invalidate();break;case 'stairs':this.navLayer.showStairs=on;break;
  case 'flags':case 'wires':case 'butterflies':this.decor.setLayer(name,on);break;
  case 'shadows':this.sun.castShadow=on;this.shadowCatcher.visible=on;break;case 'ao':this.worldMesh.bake=on;this.worldMesh.invalidate();break;
  case 'smooth':this.worldMesh.smooth=on;this.worldMesh.invalidate();break;case 'outline':this.outline.inkVisible=on;this.vegetation.ink=on;break;case 'backlit':this.outline.rimVisible=on;break;
  case 'lightonly':this.material.vertexColors=!on;this.material.color.set(on?0xf2efe8:0xffffff);this.material.needsUpdate=true;break;case 'wire':this.material.wireframe=on;break;default:break;}}
 /** Ray march over the voxel columns (view.js pick), ray given in town units. */
 pickRay(ray){const o=ray.origin,d=ray.direction,L=this.levelHeight,maxY=MAX_LEVEL*L+1.5;let tStart=0,tEnd=220;
  if(Math.abs(d.y)>1e-6){const t1=(0-o.y)/d.y,t2=(maxY-o.y)/d.y;tStart=Math.max(tStart,Math.min(t1,t2));tEnd=Math.min(tEnd,Math.max(t1,t2));}if(tEnd<=tStart)return null;
  const step=Math.max(.035,L*.14),p=new THREE.Vector3();
  const inside=(x,y,z)=>{const level=Math.min(MAX_LEVEL,Math.max(1,Math.floor(y/L)+1));for(const cell of this.index.at(x,z)){if(!pointInQuad(cell.pts,x,z))continue;if(!this.world.isSolid(cell,level))continue;if(y>=0)return{cell,level};}return null;};
  let prevT=tStart;for(let t=tStart;t<=tEnd;t+=step){p.copy(o).addScaledVector(d,t);const hit=inside(p.x,p.y,p.z);if(hit){let a=prevT,b=t;for(let i=0;i<12;i++){const m=(a+b)*.5;p.copy(o).addScaledVector(d,m);if(inside(p.x,p.y,p.z))b=m;else a=m;}p.copy(o).addScaledVector(d,b);return{cell:hit.cell,level:hit.level,point:p.clone()};}prevT=t;}
  if(Math.abs(d.y)>1e-6){const tw=(0-o.y)/d.y;if(tw>0&&tw<220){p.copy(o).addScaledVector(d,tw);for(const cell of this.index.at(p.x,p.z))if(pointInQuad(cell.pts,p.x,p.z))return{cell,level:0,point:p.clone(),water:true};}}
  return null;}
 /** view.js updateHover. */
 updateHover(hit,mode){if(!hit){this.hover.visible=false;return;}const cell=hit.cell,L=this.levelHeight,w=this.world;let y;
  if(mode==='erase'){const level=hit.level||w.top(cell);if(!level){this.hover.visible=false;return;}y=level*L+.008;}
  else{const top=w.top(cell),empty=hit.level>=1&&!w.isSolid(cell,hit.level),level=empty?hit.level:Math.min(MAX_LEVEL,top+1);y=(level-1)*L+.008;}
  if(y<.008){this.hover.visible=false;return;}const pos=this.hover.geometry.getAttribute('position');for(let i=0;i<4;i++){const p=cell.pts[Math.min(i,cell.n-1)];pos.setXYZ(i,p.x,y,p.z);}pos.needsUpdate=true;this.hover.geometry.computeVertexNormals();this.hover.material.opacity=mode==='erase'?.34:.26;this.hover.visible=true;}
 /** view.js render(dt) without the final draw: rebuild, edits, deferred refresh, shore, life. */
 update(dt){this.time+=dt;this.waterUniforms.uTime.value+=dt;const wm=this.worldMesh;
  if(wm.rebuild()){this.mesh.geometry=wm.geometry;this.reflection.geometry=wm.geometry;this.outline.setGeometry(wm.geometry);this.onGeometry?.(wm.geometry);
   for(const e of wm.edits||[]){this.effects.onEdit(e.cell,e.before,e.after,this.levelHeight);this.sound.onEdit(e.cell,e.before,e.after);}
   clearTimeout(this.birdTimer);this.birdTimer=setTimeout(()=>{this.birdTimer=null;this.birds.refresh(wm.geometry);this.vegetation.refresh(this.world,wm.shape,wm.garden);this.atmosphere.rebuild(this.world,this.index);this.decor.refresh(this.world,this.index,this.birds.perches,this.vegetation.flowerSpots||[]);this.effects.setFireSources(wm.chimneys||[]);this.navLayer.refresh(this.world,wm.shape);},this.birdsReady?450:0);this.birdsReady=true;
   if(wm.shoreDirty){const shore=buildShore(this.world,this.grid,this.index,{posts:wm.posts,shape:wm.shape});for(const [o,g]of[[this.skirt,shore.skirt],[this.waves,shore.waves],[this.shoreLine,shore.shoreLine],[this.seaLine,shore.seaLine]]){o.geometry.dispose();o.geometry=g;}}}
  this.birds.update(dt);this.atmosphere.update(dt);this.effects.update(dt,this.atmosphere.uWind.value);this.decor.update(dt);}
 /** Town centre used as the shadow target (view.js keeps it on the camera target). */
 focus(){let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const c of this.world.cells){if(!this.world.top(c))continue;minX=Math.min(minX,c.minX);maxX=Math.max(maxX,c.maxX);minZ=Math.min(minZ,c.minZ);maxZ=Math.max(maxZ,c.maxZ);}return Number.isFinite(minX)?new THREE.Vector3((minX+maxX)/2,0,(minZ+maxZ)/2):new THREE.Vector3();}
 /** Draw the town over the finished main pass, sharing its depth buffer. */
 renderOverlay({renderer,camera}){if(!this.visible||!camera||!this.anchor)return;
  if(!this.impostorsReady){this.impostorsReady=true;try{this.vegetation.initImpostors(renderer);for(const k of['impostor','clouds','moody'])if(k in this.debugState)this.setDebug(k,this.debugState[k]);}catch(e){console.warn('[morris town] impostor bake failed',e);}}
  this.anchor.updateWorldMatrix(true,false);const proxy=this.proxy;
  proxy.matrixWorld.copy(this.anchor.matrixWorld).invert().multiply(camera.matrixWorld);proxy.matrixWorldInverse.copy(proxy.matrixWorld).invert();
  proxy.projectionMatrix.copy(camera.projectionMatrix);proxy.projectionMatrixInverse.copy(camera.projectionMatrixInverse);proxy.matrixWorld.decompose(proxy.position,proxy.quaternion,proxy.scale);proxy.near=camera.near;proxy.far=camera.far;proxy.fov=camera.fov;proxy.aspect=camera.aspect;
  const c=this.focusPoint||(this.focusPoint=this.focus());this.sun.target.position.copy(c);this.sun.position.copy(c).addScaledVector(this.sunDir,40);this.sun.target.updateMatrixWorld();
  this.outline.update(renderer,proxy,this.sunDir);
  const prev={autoClear:renderer.autoClear,tone:renderer.toneMapping,exposure:renderer.toneMappingExposure,space:renderer.outputColorSpace,shadows:renderer.shadowMap.enabled};
  renderer.autoClear=false;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=this.exposure;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;
  try{renderer.render(this.scene,proxy);}finally{renderer.autoClear=prev.autoClear;renderer.toneMapping=prev.tone;renderer.toneMappingExposure=prev.exposure;renderer.outputColorSpace=prev.space;renderer.shadowMap.enabled=prev.shadows;}}
 dispose(){clearTimeout(this.birdTimer);this.birds.dispose?.();const gs=new Set(),ms=new Set();this.scene.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ms.add(m));});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());this.sun.shadow.dispose?.();}
}
