import fs from 'node:fs';import * as T from 'three';import {createHash} from 'node:crypto';
const context=new Proxy({canvas:{width:2,height:2},createRadialGradient:()=>({addColorStop(){}}),createLinearGradient:()=>({addColorStop(){}}),getImageData:(_,__,w=2,h=2)=>({data:new Uint8ClampedArray(w*h*4)}),createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),measureText:()=>({width:10})},{get:(o,k)=>o[k]??(()=>{})});
function element(){const listeners={};return{width:2,height:2,style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},appendChild(){},cloneNode(){return element();},setAttribute(){},addEventListener(k,f){listeners[k]=f;},removeEventListener(){},set src(v){queueMicrotask(()=>listeners.load?.call(this));},getContext:()=>context};}
globalThis.ImageData=class{constructor(data,width,height){this.data=data;this.width=width;this.height=height;}};
globalThis.document={getElementById:()=>null,querySelector:()=>null,createElement:element,createElementNS:element,addEventListener(){},body:element()};globalThis.location={search:'?tour=crystal-v7&autostart=1',href:'http://localhost:8931/TigerMessenger/index.html?tour=crystal-v7&autostart=1'};
// In-memory storage never reads, clears or writes the user's browser saves.
globalThis.localStorage={getItem:()=>null,setItem(){},removeItem(){}};globalThis.window={addEventListener(){},removeEventListener(){},localStorage,location,innerWidth:1280,innerHeight:800};globalThis.HTMLImageElement=class{};globalThis.Image=class extends HTMLImageElement{constructor(){super();Object.assign(this,element(),{complete:true});}};
const {messengerIslandScene}=await import('../../../src/scenes/messengerIsland.js');



const {createSwampLivingPathConstraints}=await import('../../../src/world/swampGregLivingPaths.js');
const started=performance.now(),scene=new T.Scene(),gen=messengerIslandScene.loadSteps({scene,planetRadius:160});let built;
for(let i=0;i<150;i++){const n=gen.next();if(n.done){built=n.value;break;}}if(!built)throw Error('formal scene incomplete');
const root=built.landmarks.moebiusSwamp,inner=root.userData.inner;await inner.userData.tiger.userData.swampTigerV2Ready;scene.updateMatrixWorld(true);

const rim=inner.userData.gregCoralRim.walkMeshes[0],wall=inner.getObjectByName('swamp-sinkhole-wall');
const shader={uniforms:{},vertexShader:T.ShaderLib.basic.vertexShader,fragmentShader:T.ShaderLib.basic.fragmentShader};wall.material.onBeforeCompile(shader);
const frame=shader.uniforms.coralWeatherFrame?.value, p=wall.geometry.attributes.position,v=new T.Vector3();
const smooth=(a,b,x)=>{const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t)};
let sampled=0,mossStrong=0,mossAny=0,sum=0,max=0,ys=[Infinity,-Infinity],coords=[];
for(let a=-Math.PI;a<Math.PI;a+=.01)for(let y=25.2;y<40;y+=.1){const catchment=Math.sin(a*7+Math.sin(a*3)*.65+y*.035),patches=Math.sin(a*17+y*.23+Math.sin(y*.43)*.38)*.58+Math.sin(a*29-y*.39)*.28+Math.sin(a*47+y*.61)*.14,moss=smooth(.18,.62,catchment)*smooth(-.04,.40,patches)*smooth(28,39,y)*.78;sampled++;sum+=moss;max=Math.max(max,moss);if(moss>.3)mossStrong++;if(moss>.1)mossAny++;if(moss>.77&&coords.length<3)coords.push([a,y]);}
if(frame)for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(frame);ys[0]=Math.min(ys[0],v.y);ys[1]=Math.max(ys[1],v.y);}
const rp=rim.geometry.attributes.position;let topArea=0,protectedArea=0;const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();
for(let i=0;i<rp.count;i+=3){a.fromBufferAttribute(rp,i);b.fromBufferAttribute(rp,i+1);c.fromBufferAttribute(rp,i+2);if([a,b,c].some(q=>Math.abs(q.y-40)>1e-5))continue;const area=b.clone().sub(a).cross(c.clone().sub(a)).length()/2;topArea+=area;}
protectedArea=(Math.PI*2-2*inner.userData.gregCoralRim.entranceHalfAngle)*(39.4**2-35.4**2)/2;
const tiger=inner.userData.tiger,radial=[Infinity,-Infinity];let poses=0,modes={};
for(let i=0;i<180;i++){inner.update(1/30,i/30,{});root.updateMatrixWorld(true);if(tiger.userData._mode!=='patrol')continue;poses++;modes[tiger.userData._mode]=(modes[tiger.userData._mode]||0)+1;const inverse=inner.matrixWorld.clone().invert();tiger.traverse(o=>{if(!o.isMesh||!o.visible||!o.geometry?.attributes?.position)return;const matrix=inverse.clone().multiply(o.matrixWorld),p=o.geometry.attributes.position;for(let j=0;j<p.count;j++){v.fromBufferAttribute(p,j).applyMatrix4(matrix);const r=Math.hypot(v.x,v.z);radial[0]=Math.min(radial[0],r);radial[1]=Math.max(radial[1],r);}});}
const report={at:new Date().toISOString(),topAreaWorld:topArea*.25,protectedRibbonAreaWorld:protectedArea*.25,remainingAreaWorld:(topArea-protectedArea)*.25,routeRadius:37.4,protectedRadii:[35.4,39.4],tigerSample:{seconds:6,poses,radial,modes},weather:{hookPresent:shader.fragmentShader.includes('cwMoss'),replacedOpaque:!shader.fragmentShader.includes('#include <opaque_fragment>')?false:true,frame:frame?.elements,ys,sampled,strongCoverage:mossStrong/sampled,anyCoverage:mossAny/sampled,meanMoss:sum/sampled,maxMoss:max,closeCameraAngles:coords,material:wall.material.userData}};
fs.writeFileSync(new URL('./environment-rim-audit.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
