import * as THREE from 'three';

// Small repeatable hand-authored metal wear maps, no external texture dependency.
export function wornMetal(color,kind='paint'){
 // Object-space alloy patina avoids latitude stretching and wood-grain artifacts.
 const painted=kind!=='metal';
 const mat=new THREE.MeshPhysicalMaterial({color,roughness:painted?(kind==='rust'?.34:.27):.48,metalness:painted?.22:.65,clearcoat:painted?.8:0,clearcoatRoughness:.19,envMap:painted?robotPaintEnvironment():null,envMapIntensity:.55});
 mat.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vAlloyPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nvAlloyPosition=position;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
  varying vec3 vAlloyPosition;
  float alloyHash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}
  float alloyNoise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(alloyHash(i),alloyHash(i+vec3(1,0,0)),f.x),mix(alloyHash(i+vec3(0,1,0)),alloyHash(i+vec3(1,1,0)),f.x),f.y),mix(mix(alloyHash(i+vec3(0,0,1)),alloyHash(i+vec3(1,0,1)),f.x),mix(alloyHash(i+vec3(0,1,1)),alloyHash(i+vec3(1,1,1)),f.x),f.y),f.z);}
  `).replace('#include <color_fragment>',`#include <color_fragment>
  float grain=alloyNoise(vAlloyPosition*95.);
  float patches=alloyNoise(vAlloyPosition*8.)*.65+alloyNoise(vAlloyPosition*23.)*.35;
  diffuseColor.rgb*=.93+.09*grain;
  diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*vec3(.45,.33,.23),smoothstep(.57,.79,patches)*${kind==='rust'?'.72':'.32'});
  diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.22,.25,.23),smoothstep(.80,.91,alloyNoise(vAlloyPosition*41.))*.19);
  `).replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
  float wear=smoothstep(.58,.79,alloyNoise(vAlloyPosition*8.));
  roughnessFactor=clamp(roughnessFactor+wear*.32,.20,.86);
  `);
 };
 mat.customProgramCacheKey=()=>`robot-alloy-v5-gloss-${kind}`;
 return mat;
}
export function armorPolygon(root,points,depth,position,material){
 const shape=new THREE.Shape();points.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
 const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:true,bevelSize:.025,bevelThickness:.035,bevelSegments:2,curveSegments:1});g.translate(0,0,-depth/2);
 const mesh=new THREE.Mesh(g,material);mesh.position.set(...position);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.panel=true;root.add(mesh);return mesh;
}
export function stencil(root,text,position,width=.3,height=.16,color='#eee8d7',angle=0){
 const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const c=canvas.getContext('2d');c.fillStyle=color;c.textAlign='center';c.textBaseline='middle';c.font='bold 75px monospace';c.fillText(text,128,64);
 const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
 const m=new THREE.Mesh(new THREE.PlaneGeometry(width,height),new THREE.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));m.position.set(...position);m.rotation.y=angle;root.add(m);return m;
}
export function hose(root,points,radius,material){const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p)));const m=new THREE.Mesh(new THREE.TubeGeometry(curve,24,radius,8,false),material);m.castShadow=true;root.add(m);return m;}
export function curvedPlate(root,center,scale,phi0,phiLength,theta0,thetaLength,material){
 // Closed volumetric armor segment: both skins and all four cut edges.
 const nx=Math.max(8,Math.ceil(phiLength*16)),ny=Math.max(5,Math.ceil(thetaLength*14));
 const pos=[],uv=[],idx=[],layer=(nx+1)*(ny+1),thickness=.035;
 for(let inner=0;inner<2;inner++)for(let y=0;y<=ny;y++)for(let x=0;x<=nx;x++){
  const phi=phi0+phiLength*x/nx,theta=theta0+thetaLength*y/ny;
  const sx=scale[0]-inner*thickness,sy=scale[1]-inner*thickness,sz=scale[2]-inner*thickness;
  pos.push(-Math.cos(phi)*Math.sin(theta)*sx,Math.cos(theta)*sy,Math.sin(phi)*Math.sin(theta)*sz);uv.push(x/nx,y/ny);
 }
 for(let y=0;y<ny;y++)for(let x=0;x<nx;x++){
  const a=y*(nx+1)+x,b=a+1,c=a+nx+1,d=c+1;
  idx.push(a,c,b,b,c,d,a+layer,b+layer,c+layer,b+layer,d+layer,c+layer);
 }
 const edge=(a,b)=>idx.push(a,b,a+layer,b,b+layer,a+layer);
 for(let x=0;x<nx;x++){edge(x+1,x);edge(ny*(nx+1)+x,ny*(nx+1)+x+1);}
 for(let y=0;y<ny;y++){edge(y*(nx+1),(y+1)*(nx+1));edge((y+1)*(nx+1)+nx,y*(nx+1)+nx);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();
 const normals=g.attributes.normal;for(let i=0;i<normals.count;i++){if(Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))<.1){const p=new THREE.Vector3(pos[i*3]/(scale[0]*scale[0]),pos[i*3+1]/(scale[1]*scale[1]),pos[i*3+2]/(scale[2]*scale[2])).normalize().multiplyScalar(i>=layer?-1:1);normals.setXYZ(i,p.x,p.y,p.z);}}
 const m=new THREE.Mesh(g,material);m.position.set(...center);m.castShadow=m.receiveShadow=true;root.add(m);return m;
}

export function castLegGuard(root,position,material){
 const s=new THREE.Shape();s.moveTo(-.27,-.39);s.bezierCurveTo(-.39,-.16,-.37,.21,-.22,.40);s.bezierCurveTo(-.08,.56,.17,.52,.28,.34);s.bezierCurveTo(.38,.14,.23,-.16,.12,-.41);s.bezierCurveTo(.02,-.54,-.18,-.54,-.27,-.39);
 const g=new THREE.ExtrudeGeometry(s,{depth:.19,bevelEnabled:true,bevelSegments:5,bevelSize:.09,bevelThickness:.105,curveSegments:14});g.translate(0,0,-.095);
 // Extrusion repeats vertices per triangle. Average coincident normals so the
 // cast rounded edge is smooth rather than looking like stacked polygon bands.
 const p=g.attributes.position,n=g.attributes.normal,sums=new Map(),keys=[];
 for(let i=0;i<p.count;i++){const key=[p.getX(i),p.getY(i),p.getZ(i)].map(v=>Math.round(v*1e5)).join(',');keys.push(key);const sum=sums.get(key)||new THREE.Vector3();sum.add(new THREE.Vector3().fromBufferAttribute(n,i));sums.set(key,sum);}
 for(const v of sums.values())v.normalize();for(let i=0;i<n.count;i++){const v=sums.get(keys[i]);n.setXYZ(i,v.x,v.y,v.z);}n.needsUpdate=true;
 const m=new THREE.Mesh(g,material);m.position.set(...position);m.castShadow=m.receiveShadow=true;root.add(m);return m;
}

let paintEnvironment;
function robotPaintEnvironment(){
 if(paintEnvironment)return paintEnvironment;
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=256;const c=canvas.getContext('2d');
 const sky=c.createLinearGradient(0,0,0,256);sky.addColorStop(0,'#8facc0');sky.addColorStop(.47,'#d7ddd8');sky.addColorStop(.53,'#928a76');sky.addColorStop(1,'#333d3e');c.fillStyle=sky;c.fillRect(0,0,512,256);
 for(const x of[82,340]){const glow=c.createRadialGradient(x,64,0,x,64,64);glow.addColorStop(0,'rgba(255,246,221,.85)');glow.addColorStop(1,'rgba(255,246,221,0)');c.fillStyle=glow;c.fillRect(x-64,0,128,128);}
 paintEnvironment=new THREE.CanvasTexture(canvas);paintEnvironment.mapping=THREE.EquirectangularReflectionMapping;paintEnvironment.colorSpace=THREE.SRGBColorSpace;return paintEnvironment;
}
