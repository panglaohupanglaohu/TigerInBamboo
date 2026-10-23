import * as T from 'three';

// Small shared reflection field: metal remains readable even in scenes without
// a global environment. Does not replace the world's lighting or sky.
let environment;
function metalEnvironment(){
 if(environment)return environment;
 const w=128,h=64,data=new Uint8Array(w*h*4);
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const v=y/(h-1),u=x/w,sky=v<.52,base=sky?[145,166,187]:[49,45,37];
  const key=Math.exp(-(((u-.22)/.065)**2)-((v-.30)/.19)**2),fill=Math.exp(-(((u-.73)/.12)**2)-((v-.37)/.22)**2);
  for(let c=0;c<3;c++)data[(y*w+x)*4+c]=Math.min(255,base[c]+key*120+fill*64);data[(y*w+x)*4+3]=255;
 }
 environment=new T.DataTexture(data,w,h,T.RGBAFormat);environment.mapping=T.EquirectangularReflectionMapping;environment.colorSpace=T.SRGBColorSpace;environment.needsUpdate=true;return environment;
}
export function relicMetalPalette(){
 const make=(name,color,roughness,metalness=1)=>{const m=new T.MeshStandardMaterial({name,color,roughness,metalness,envMap:metalEnvironment(),envMapIntensity:.75});m.userData.preserveCitadelMaterial=true;return m;};
 return {silver:make('relic-brushed-silver',0xb6bfca,.29),edge:make('relic-polished-edges',0xe3e7e9,.22),dark:make('relic-gunmetal-joints',0x252c31,.39),gold:make('relic-aged-gold',0xb59046,.3),bronze:make('relic-weathered-bronze',0x715739,.43),brass:make('relic-horse-brass',0xb48946,.33)};
}
export function relicBuilder(root){
 const mesh=(name,g,m,p=[0,0,0])=>{const o=new T.Mesh(g,m);o.name=name;o.position.set(...p);o.castShadow=o.receiveShadow=true;root.add(o);return o;};
 const ell=(name,p,s,m)=>{const o=mesh(name,new T.SphereGeometry(1,20,12),m,p);o.scale.set(...s);return o;};
 const box=(name,p,s,m)=>mesh(name,new T.BoxGeometry(...s),m,p);
 const rod=(name,a,b,r,m,r2=r)=>{const A=new T.Vector3(...a),B=new T.Vector3(...b),d=B.clone().sub(A);const o=mesh(name,new T.CylinderGeometry(r2,r,d.length(),12),m,A.add(B).multiplyScalar(.5).toArray());o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;};
 const ring=(name,p,r,t,m,axis='z')=>{const o=mesh(name,new T.TorusGeometry(r,t,8,32),m,p);if(axis==='x')o.rotation.y=Math.PI/2;if(axis==='y')o.rotation.x=Math.PI/2;return o;};
 const plate=(name,points,z,depth,m)=>{const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();const o=mesh(name,new T.ExtrudeGeometry(s,{depth,bevelEnabled:true,bevelSize:Math.min(.035,depth*.3),bevelThickness:Math.min(.024,depth*.25),bevelSegments:1,steps:1}),m,[0,0,z]);return o;};
 return {mesh,ell,box,rod,ring,plate};
}
