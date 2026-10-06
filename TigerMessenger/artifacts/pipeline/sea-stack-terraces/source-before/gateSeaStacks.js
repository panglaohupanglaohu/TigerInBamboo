import * as THREE from 'three';
import {solveStackWfc,sampleStackProfile} from './seaStackWfc.js';
export function seaStackWfcEnabled(){return new URLSearchParams(globalThis.location?.search||'').get('seaStackWfc')!=='0';}
export function gateSeaStacksEnabled(){return new URLSearchParams(globalThis.location?.search||'').get('gateSeaStacks')!=='0';}
// Closed sedimentary sea stacks: broad broken crowns, near-vertical layered
// faces and a wave-cut waist. Seeded geometry keeps captures reproducible.
export function seaStackGeometry(radius,height,seed){
 const solution=seaStackWfcEnabled()?solveStackWfc(seed):null;
 const sides=36,rows=56,p=[],colors=[],idx=[];
 const color=new THREE.Color(),light=new THREE.Vector3(-.6,.7,.4).normalize();
 for(let j=0;j<=rows;j++)for(let i=0;i<=sides;i++){
  const t=j/rows,a=(i%sides)/sides*Math.PI*2;
  const course=Math.floor(t*11),notch=.23*Math.exp(-Math.pow((t-.15)/.065,2));
  const profile=solution?sampleStackProfile(solution.modules,t):.96-.27*t-notch+.042*Math.sin(course*2.47+seed);
  const fractures=1+.11*Math.sin(a*3+seed)+.035*Math.cos(a*7-seed*.7)+.035*Math.sin(a*11+course*.2);
  const lean=radius*.10*t*Math.sin(seed*1.8);
  const r=radius*profile*fractures;
  const cap=height*.025*(Math.sin(a*3+seed)+.4*Math.cos(a*7-seed))*Math.pow(t,9);
  const x=Math.cos(a)*r+lean,z=Math.sin(a)*r*(.79+.09*Math.sin(seed)),y=-height/2+t*height+cap;
  p.push(x,y,z);
  const shade=.80+.16*Math.max(0,new THREE.Vector3(Math.cos(a),.1,Math.sin(a)).dot(light));
  color.setHex(seed%3===0?0x718ba4:seed%3===1?0x607b96:0x7b90a5).multiplyScalar(shade*(.95+.045*Math.sin(course*2.3+seed)));
  colors.push(color.r,color.g,color.b);
 }
 for(let j=0;j<rows;j++)for(let i=0;i<sides;i++){const a=j*(sides+1)+i,b=a+1,c=a+sides+1,d=c+1;idx.push(a,c,b,b,c,d);}
 const top=p.length/3;p.push(radius*.10*Math.sin(seed*1.8),height/2,0);colors.push(.32,.39,.45);
 const bottom=p.length/3;p.push(0,-height/2,0);colors.push(.12,.17,.22);
 for(let i=0;i<sides;i++){idx.push(top,rows*(sides+1)+i+1,rows*(sides+1)+i);idx.push(bottom,i,i+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(idx);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();if(solution)g.userData.wfc={...solution,modules:solution.modules.map(m=>m.id)};return g;
}
export function seaStackMaterial(height){
 const m=new THREE.MeshBasicMaterial({vertexColors:true});
 m.onBeforeCompile=s=>{
  s.uniforms.stackHeight={value:height};
  s.vertexShader='varying vec3 stackP;varying vec3 stackN;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nstackP=position;stackN=normal;');
  s.fragmentShader='varying vec3 stackP;varying vec3 stackN;uniform float stackHeight;\n'+s.fragmentShader;
  s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
   float t=(stackP.y+stackHeight*.5)/stackHeight;
   float bed=stackP.y*.38+.14*sin(stackP.x*.6)+.13*sin(stackP.z*.8);
   float seam=abs(fract(bed)-.5);float aa=max(fwidth(bed),.014);
   float face=1.-smoothstep(.4,.8,abs(normalize(stackN).y));float joint=(1.-smoothstep(.013,.013+aa,seam))*face*(.5+.5*sin(stackP.x*.7+stackP.z*.6+stackP.y*.23));
   float small=sin(stackP.x*.93+stackP.z*.71)*sin(stackP.y*.63+stackP.z*.47);
   float angle=atan(stackP.z,stackP.x);
   float fissure=abs(sin(angle*9.+.08*sin(stackP.y*.8)+.02*sin(stackP.y*3.)));
   float crack=(1.-smoothstep(.022,.022+max(fwidth(fissure),.009),fissure))*smoothstep(-.5,.1,sin(stackP.y*.18+angle*3.));
   diffuseColor.rgb*=1.-.32*joint-.33*crack*face+.065*small;
   float wet=1.-smoothstep(.16,.26,t);diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.45,.52,.60),wet*.8);
  `);
 };m.customProgramCacheKey=()=>`gate-sea-stack-v1-${height}`;return m;
}

// Broken surf skirts conform to the same spherical sea used by the gate;
// they are transparent foam ribbons, not a second opaque water surface.
export function addSeaStackFoot(parent,x,z,r,seed,seaY){
 const p=[],uv=[],idx=[],segments=64;
 for(let j=0;j<2;j++)for(let i=0;i<=segments;i++){
  const a=i/segments*Math.PI*2,rr=r*(j?1.40:.88)*(1+.075*Math.sin(a*5+seed)),xx=x+Math.cos(a)*rr,zz=z+Math.sin(a)*rr*.85;
  p.push(xx,seaY(xx,zz)+.14,zz);uv.push(i/segments,j);
 }
 for(let i=0;i<segments;i++)idx.push(i,i+1,i+segments+1,i+1,i+segments+2,i+segments+1);
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
 const m=new THREE.MeshBasicMaterial({color:0xc3dce6,transparent:true,opacity:.48,depthWrite:false,side:THREE.DoubleSide});const clock={value:0};
 m.onBeforeCompile=s=>{s.uniforms.surfTime=clock;s.vertexShader='varying vec2 surfUV;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nsurfUV=uv;');s.fragmentShader='varying vec2 surfUV;uniform float surfTime;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float a=surfUV.x*6.283185;float broken=smoothstep(-.35,.55,sin(a*11.+sin(a*7.)+surfTime*.35));float ribbon=pow(max(0.,sin(surfUV.y*3.14159)),1.6);diffuseColor.a*=broken*ribbon*(.65+.35*sin(a*23.+surfTime));`);};m.customProgramCacheKey=()=> 'gate-sea-stack-surf-v1';
 const foam=new THREE.Mesh(g,m);foam.name='gate-sea-stack-surf';foam.onBeforeRender=()=>{clock.value=performance.now()*.001;};parent.add(foam);
 const rockMat=new THREE.MeshBasicMaterial({color:0x41586d});
 for(let k=0;k<3;k++){const a=seed+k*2.399,xx=x+Math.cos(a)*r*1.13,zz=z+Math.sin(a)*r*.91,size=.65+(seed+k)%3*.35;const b=new THREE.Mesh(new THREE.IcosahedronGeometry(size,1),rockMat);b.name='gate-sea-stack-fallen-block';b.position.set(xx,seaY(xx,zz)+size*.15,zz);b.scale.set(1.4,.65,1);b.rotation.y=a;parent.add(b);}
}

// Each stack has its own local gravity direction on the small spherical world.
// Using the distant gate site's shared Y axis produced the visible group lean.
export function standSeaStackOnOcean(rock,site,x,z,height,seaY,yaw=0){
 site.updateWorldMatrix(true,true);rock.parent.updateWorldMatrix(true,false);
 const sea=site.localToWorld(new THREE.Vector3(x,seaY(x,z),z)),up=sea.clone().normalize();
 const base=sea.clone().addScaledVector(up,-6),center=base.clone().addScaledVector(up,height/2);
 rock.position.copy(rock.parent.worldToLocal(center));
 const worldQ=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),up).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0,1,0),yaw));
 rock.quaternion.copy(rock.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(worldQ));rock.updateMatrix();
 rock.userData.seaStack.worldUp=up.toArray();rock.userData.seaStack.seaAnchor=sea.toArray();rock.userData.seaStack.wfc=rock.geometry.userData.wfc;
}
