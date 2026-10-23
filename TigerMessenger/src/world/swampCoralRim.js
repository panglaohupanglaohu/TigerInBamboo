import * as THREE from 'three';
import {GREG_LAKE_PALETTE as P} from './swampGregVisuals.js';
import {createSwampCoralOuterCliff} from './swampCoralOuterCliff.js';

const TAU=Math.PI*2;
// 2026-10-10 用户：坑缘步道加宽一倍（原约 5.3 → 约 10.6，向外加宽，坑内侧不动）。?swampRimWidth=1 回原宽。
export const SWAMP_RIM_WIDTH=(()=>{const v=Number(new URLSearchParams(globalThis.location?.search||'').get('swampRimWidth'));return v>0&&v<=3?v:2;})();
export const swampRimOuter=a=>40.8+(SWAMP_RIM_WIDTH-1)*5.3+.45*Math.sin(a*5)+.24*Math.sin(a*11+.7);
export const SWAMP_RIM_OUTER_MAX=40.8+(SWAMP_RIM_WIDTH-1)*5.3+.69;
const cross=(a,b)=>a.x*b.z-a.z*b.x;

// Read the final rendered rim edges in the inner frame, rather than rebuilding
// the old theoretical cylinder. Only the authored entrance may lack an edge.
function topBoundary(inner,wall){
  inner.updateWorldMatrix(true,true);
  const matrix=inner.matrixWorld.clone().invert().multiply(wall.matrixWorld);
  const p=wall.geometry?.attributes.position,index=wall.geometry?.index;
  if(!p)return null;
  const vertices=Array.from({length:p.count},(_,i)=>new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(matrix));
  const y=Math.max(...vertices.map(v=>v.y)),edges=[],seen=new Set();
  for(let i=0,n=index?index.count:p.count;i<n;i+=3){
    const ids=[0,1,2].map(j=>index?index.getX(i+j):i+j);
    for(let j=0;j<3;j++){
      const a=vertices[ids[j]],b=vertices[ids[(j+1)%3]];
      if(Math.abs(a.y-y)>1e-4||Math.abs(b.y-y)>1e-4||a.distanceToSquared(b)<1e-8)continue;
      const key=[a,b].map(v=>`${v.x.toFixed(4)},${v.z.toFixed(4)}`).sort().join('|');
      if(!seen.has(key)){seen.add(key);edges.push([a,b]);}
    }
  }
  if(edges.length<8||Math.abs(y-40)>.25)return null;
  function radius(angle){
    const d={x:Math.cos(angle),z:Math.sin(angle)};
    for(const [a,b]of edges){
      const e={x:b.x-a.x,z:b.z-a.z},den=cross(d,e);
      if(Math.abs(den)<1e-10)continue;
      const r=cross(a,e)/den,t=cross(a,d)/den;
      if(r>0&&t>=-1e-6&&t<=1+1e-6)return r;
    }
    return null;
  }
  return {y,edges,radius};
}

// This installer only adds owned geology. The caller registers walkMeshes with
// its ground sampler and tiger footing; no story transforms or route are edited.
export function installSwampCoralRim(swamp,{enabled=new URLSearchParams(globalThis.location?.search||'').get('gregLakeRim')!=='0',entranceAngle=.5,entranceWidth=9,segments=192}={}){
  const inner=swamp.userData.inner||swamp;
  if(inner.userData.gregCoralRim)return inner.userData.gregCoralRim;
  if(!enabled)return null;
  if(!Number.isFinite(entranceAngle)||!Number.isFinite(entranceWidth)||entranceWidth<3||entranceWidth>14||!Number.isInteger(segments)||segments<48||segments>512)return {ok:false,reason:'invalid rim options'};
  const wall=inner.getObjectByName('swamp-sinkhole-wall'),boundary=wall&&topBoundary(inner,wall);
  if(!boundary)return {ok:false,reason:'final horizontal wall crown missing'};
  const half=Math.asin(entranceWidth/2/37.4),start=entranceAngle+half,span=TAU-half*2;
  const vertices=[],colors=[],tops=[],outer=[];
  const point=(a,r,y)=>new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r);
  // Inside the wall's authored opening, interpolate its nearest real endpoints.
  // The walkway entrance itself remains entirely open; no floor is laid over it.
  const around=angle=>{
    let r=boundary.radius(angle);
    if(r!==null)return r;
    if(Math.abs(Math.atan2(Math.sin(angle-entranceAngle),Math.cos(angle-entranceAngle)))>.4)return null;
    let left=null,right=null;
    for(let d=.01;d<.65&&(left===null||right===null);d+=.01){left??=boundary.radius(angle-d);right??=boundary.radius(angle+d);}
    return left!==null&&right!==null?(left+right)/2:null;
  };
  for(let i=0;i<=segments;i++){
    const a=start+span*i/segments,r=around(a);
    if(r===null||r<30||r>36)return {ok:false,reason:'wall crown cannot support a continuous outer rim'};
    const outside=Math.max(r+4.6*SWAMP_RIM_WIDTH,swampRimOuter(a));
    tops.push(point(a,r-.035,boundary.y));outer.push(point(a,outside,boundary.y));
  }
  const topA=new THREE.Color(P.stone),topB=new THREE.Color(P.stoneShade),sideA=new THREE.Color(P.wall),sideB=new THREE.Color(P.wallShade);
  // Deterministic smooth fields sampled in the existing local XZ plane. Shared
  // vertices receive identical colours; there are no sector/block thresholds.
  const smooth=t=>t*t*(3-2*t),lerp=(a,b,t)=>a+(b-a)*t;
  const hash=(x,z)=>{const n=Math.sin(x*127.1+z*311.7+19.3)*43758.5453;return n-Math.floor(n);};
  const field=(x,z)=>{
    const ix=Math.floor(x),iz=Math.floor(z),u=smooth(x-ix),v=smooth(z-iz);
    return lerp(lerp(hash(ix,iz),hash(ix+1,iz),u),lerp(hash(ix,iz+1),hash(ix+1,iz+1),u),v);
  };
  const cool=sideA.clone().lerp(new THREE.Color(0x9ca2a0),.38),wet=new THREE.Color(0x829795),topTints=new Map();
  for(let i=0;i<tops.length;i++)for(const [p,radial]of [[tops[i],0],[outer[i],1]]){
    const broad=field(p.x*.105+.8,p.z*.105-2.1),fine=field(p.x*.24-5.3,p.z*.24+1.7);
    const stoneMix=(1-radial)*(.16+.20*broad)+radial*(.025+.08*fine);
    const damp=(1-radial)*.14*Math.pow(field(p.x*.16+9,p.z*.16-4),3);
    const tint=topA.clone().lerp(topB,.10+.23*fine).lerp(cool,stoneMix).lerp(wet,damp);
    topTints.set(p,tint);
  }
  const topTint=p=>topTints.get(p);
  const tri=(a,b,c,color)=>{for(const v of [a,b,c]){const tint=typeof color==='function'?color(v):color;vertices.push(...v);colors.push(tint.r,tint.g,tint.b);}};
  const quad=(a,b,c,d,color)=>{tri(a,b,c,color);tri(a,c,d,color);};
  for(let i=0;i<segments;i++){
    const a=start+span*i/segments,b=start+span*(i+1)/segments;
    const A=tops[i],B=tops[i+1],C=outer[i+1],D=outer[i];
    const low=(p,angle)=>p.clone().setY(boundary.y-2.2-.25*Math.sin(angle*7));
    const E=low(A,a),F=low(B,b),G=low(C,b),H=low(D,a);
    quad(A,B,C,D,topTint);
    quad(D,C,G,H,Math.floor(i/6)%2?sideA:sideB);
    quad(B,A,E,F,sideA);quad(H,G,F,E,sideB);
    if(i===0)quad(A,D,H,E,sideB);
    if(i===segments-1)quad(C,B,F,G,sideB);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
  const material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,toneMapped:false,fog:false});
  const mesh=new THREE.Mesh(geometry,material);mesh.name='greg-coral-rim-rock-batch';mesh.userData.gregWalkable=true;inner.add(mesh);
  const outerCliff=new URLSearchParams(globalThis.location?.search||'').get('gregLakeOuterCliff')==='0'?null:createSwampCoralOuterCliff(outer);
  if(outerCliff)inner.add(outerCliff.group);
  const report={topColourVersion:3,outerCliff:outerCliff?.report||null,ok:true,version:1,topY:boundary.y,thicknessRange:[1.95,2.45],entranceAngle,entranceWidth,entranceHalfAngle:half,
    wallCrownEdges:boundary.edges.length,renderMeshes:1,triangles:vertices.length/9,walkMeshes:[mesh],rimPatrolRadius:37.4,widthScale:SWAMP_RIM_WIDTH,outerMax:SWAMP_RIM_OUTER_MAX,
    supportScope:'rim outside entrance; caller must retain entrance stair support',dispose(){
      outerCliff?.dispose();
      mesh.removeFromParent();geometry.dispose();material.dispose();
      if(inner.userData.gregCoralRim===report)delete inner.userData.gregCoralRim;
    }};
  inner.userData.gregCoralRim=report;return report;
}
