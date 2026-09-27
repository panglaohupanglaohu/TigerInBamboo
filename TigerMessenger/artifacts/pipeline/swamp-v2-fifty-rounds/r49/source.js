import {applySwampTigerV2} from '../assets/characters/swampTigerV2.js';
import * as THREE from 'three';
export const SWAMP_V2_ROUND=49;
export function applySwampV2Art(swamp){
 if(new URLSearchParams(globalThis.location?.search||'').get('swampV2')==='0')return;
 swamp.userData.swampV2Round=SWAMP_V2_ROUND;
 applySwampTigerV2(swamp.userData.tiger);
 // Keep objects and random sequence intact; only suspend visible lianas for the approved build scope.
 swamp.traverse(o=>{if(o.name.startsWith('swamp-vine-')||o.name==='swamp-cross-tree-vine')o.visible=false;});
 const tree=swamp.getObjectByName('swamp-ancient-world-tree'),trunk=tree?.getObjectByName('world-tree-trunk');
 if(!trunk)return;
 // Replace the six-sided pole with a continuous tapered, gently curved trunk at the same anchor.
 const g=new THREE.CylinderGeometry(1.5,4.2,58,20,16),a=g.attributes.position;
 for(let i=0;i<a.count;i++){
  const y=a.getY(i),t=(y+29)/58,angle=Math.atan2(a.getZ(i),a.getX(i));
  const ridge=1-.32*Math.pow(1-t,3)*(.5+.5*Math.sin(angle*7))+.035*Math.sin(angle*7+t*2);
  a.setXYZ(i,a.getX(i)*ridge+Math.sin(t*3.3)*.9,y,a.getZ(i)*ridge+Math.sin(t*4)*.45);
 }
 g.computeVertexNormals();trunk.geometry=g;
 trunk.material=new THREE.MeshBasicMaterial({color:0x52767a});
 for(const child of trunk.children)if(child.isMesh)child.visible=false;
 const bark=new THREE.LineBasicMaterial({color:0x294855,transparent:true,opacity:.65});
 for(let k=0;k<14;k++){
  const angle=k/14*Math.PI*2,pts=[];
  for(let j=0;j<=28;j++){const t=j/28,r=THREE.MathUtils.lerp(4.2,1.5,t)*(1-.32*Math.pow(1-t,3)*(.5+.5*Math.sin(angle*7))+.035*Math.sin(angle*7+t*2));pts.push(new THREE.Vector3(Math.cos(angle)*r+Math.sin(t*3.3)*.9,-29+t*58,Math.sin(angle)*r+Math.sin(t*4)*.45));}
  const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),bark);line.name='v2-bark-line';trunk.add(line);
 }
 // Branch forks support the former floating crown volumes without changing tree anchoring.
 const branchMat=new THREE.MeshBasicMaterial({color:0x52767a});
 const crowns=tree.children.filter(o=>o.isMesh&&o.geometry?.type==='IcosahedronGeometry');
 for(const [i,crown]of crowns.entries()){
  const theta=i*2.399;
  const tip=new THREE.Vector3(-8+Math.cos(theta)*(i===6?2:9+i%3),60+i*3,-7+Math.sin(theta)*(i===6?2:9+i%3)),start=new THREE.Vector3(-8,49+i*.9,-7),mid=start.clone().lerp(tip,.55);mid.x+=Math.sin(i*2.4)*2.5;
  const curve=new THREE.CatmullRomCurve3([start,mid,tip]);
  const branch=new THREE.Mesh(new THREE.TubeGeometry(curve,18,.55,8,false),branchMat);branch.name='v2-world-tree-branch';tree.add(branch);
  crown.geometry=new THREE.IcosahedronGeometry(1,2);crown.scale.set(5.2+(i%3),2.5,4.5+(i%2));
  crown.material=new THREE.MeshBasicMaterial({color:[0x638780,0x769487,0x527a76][i%3]});
  for(const child of crown.children)child.visible=false;
  crown.visible=false;
  for(let k=0;k<18;k++){
   const a=k*2.399,rad=1.5+Math.sqrt(k/18)*4.5;
   const leaf=new THREE.Mesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:[0x537b73,0x729589,0x8b9f88,0x406a67][k%4]}));
   leaf.name='v2-crown-cluster';leaf.position.copy(tip).add(new THREE.Vector3(Math.cos(a)*rad,Math.sin(k*1.7)*1.2,Math.sin(a)*rad*.8));leaf.scale.set(2.8,1.7,2.3);
   const lp=leaf.geometry.attributes.position,colors=[];const base=new THREE.Color([0x537b73,0x729589,0x8b9f88,0x406a67][k%4]);
   for(let v=0;v<lp.count;v++){const c=base.clone().multiplyScalar(.76+.24*(lp.getY(v)+1)/2);colors.push(c.r,c.g,c.b);}
   leaf.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));leaf.material.color.setHex(0xffffff);leaf.material.vertexColors=true;tree.add(leaf);
  }
 }

 // Low rounded buttress roots stay on the lake floor, below the whale swimming layer.
 const rootMat=new THREE.MeshBasicMaterial({color:0x52767a});
 for(let k=0;k<6;k++){
  const angle=k*Math.PI/3+.25, radial=(r,y,twist=0)=>new THREE.Vector3(-8+Math.cos(angle+twist)*r,y,-7+Math.sin(angle+twist)*r);
  const curve=new THREE.CatmullRomCurve3([radial(2.3,13),radial(4,11.8,.06),radial(6,10.65,.13),radial(8,10.25,.2)]);
  const geo=new THREE.TubeGeometry(curve,24,1,10,false),p=geo.attributes.position;
  for(let j=0;j<=24;j++){
   const center=curve.getPointAt(j/24),radius=1.15*(1-j/24)+.08;
   for(let n=0;n<=10;n++){
    const i=j*11+n;
    p.setXYZ(i,center.x+(p.getX(i)-center.x)*radius,center.y+(p.getY(i)-center.y)*radius*.6,center.z+(p.getZ(i)-center.z)*radius);
   }
  }
  geo.computeVertexNormals();const root=new THREE.Mesh(geo,rootMat);root.name='v2-floor-root';tree.add(root);
 }

 // Rim trees retain their anchors and branches; replace wafer foliage with rounded leaf masses.
 swamp.traverse(o=>{
  if(o.name!=='swamp-towering-tree')return;
  let n=0;
  for(const child of o.children){
   if(!child.isMesh||child.geometry?.type!=='IcosahedronGeometry')continue;
   child.geometry=new THREE.IcosahedronGeometry(.55,2);
   const verts=child.geometry.attributes.position;
   for(let j=0;j<verts.count;j++){const x=verts.getX(j),y=verts.getY(j),z=verts.getZ(j);const ripple=1+.16*Math.sin(x*29+z*17)*Math.cos(y*23-z*19);verts.setXYZ(j,x*ripple,y*ripple,z*ripple);}
   child.geometry.computeVertexNormals();
   child.scale.y*=5.0;child.scale.x*=1.35;child.scale.z*=1.35;
   child.material=new THREE.MeshBasicMaterial({color:[0x56766a,0x748875,0x3d605c][n++%3]});
   for(const shell of child.children)shell.visible=false;
   child.name='v2-rim-crown';
  }
 });

 // Small clustered leaves break the smooth blob silhouettes without thin hanging vines.
 const leafShape=new THREE.IcosahedronGeometry(1,0);
 const leaves=new THREE.InstancedMesh(leafShape,new THREE.MeshBasicMaterial({color:0xffffff}),126*24);
 leaves.name='v2-world-tree-leaflets';
 const pose=new THREE.Object3D();let leafIndex=0;
 for(const crown of tree.children.filter(o=>o.name==='v2-crown-cluster')){
  for(let k=0;k<24;k++){
   const phi=k*2.399,z=1-2*(k+.5)/24,r=Math.sqrt(1-z*z);
   pose.position.copy(crown.position).add(new THREE.Vector3(Math.cos(phi)*r*2.8,z*1.7,Math.sin(phi)*r*2.3));
   pose.rotation.set(z*.4,phi,.2*Math.sin(k));pose.scale.set(.65,.25,.42);pose.updateMatrix();
   leaves.setMatrixAt(leafIndex,pose.matrix);
   leaves.setColorAt(leafIndex,new THREE.Color([0x537368,0x708778,0x91a18b,0x45665f][k%4]));leafIndex++;
  }
 }
 leaves.count=leafIndex;leaves.instanceMatrix.needsUpdate=true;leaves.instanceColor.needsUpdate=true;tree.add(leaves);

 const water=swamp.getObjectByName('swamp-underground-waterline');
 if(water){
  water.material=water.material.clone();water.material.color.setHex(0x397f9c);water.material.opacity=.57;
  water.material.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 swampWaterPosition;').replace('#include <begin_vertex>','#include <begin_vertex>\nswampWaterPosition=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 swampWaterPosition;').replace('#include <color_fragment>',`#include <color_fragment>
    float wave=sin(swampWaterPosition.x*2.1+sin(swampWaterPosition.z*.8)*1.5);
    float broken=step(.25,sin(swampWaterPosition.z*3.7+swampWaterPosition.x*.24));
    float aa=max(fwidth(wave),.015);
    float ink=smoothstep(.94-aa,.99+aa,wave)*broken;
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.38,.73,.79),ink*.5);`);
  };
  water.material.customProgramCacheKey=()=> 'swamp-v2-water-ink-6';
 }

 // Treads span across the entrance; their short axis follows the descent.
 for(const step of swamp.userData.tigerWalkSurfaces||[]){
  step.rotation.set(0,Math.PI/2-.5,0);
  const positions=[],normals=[];
  for(let k=-1;k<=1;k++){
   const shape=new THREE.Shape();shape.moveTo(-4.2,-.4);shape.lineTo(4.2,-.4);shape.lineTo(4.2,.4);shape.lineTo(-4.2,.4);shape.closePath();
   const tread=new THREE.ExtrudeGeometry(shape,{depth:.54,bevelEnabled:true,bevelSegments:1,bevelSize:.05,bevelThickness:.05,steps:1});tread.translate(0,0,-.27);
   tread.translate(0,k*2.5/3,k*12/21);
   positions.push(...tread.attributes.position.array);normals.push(...tread.attributes.normal.array);tread.dispose();
  }
  const stair=new THREE.BufferGeometry();stair.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));stair.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  const shades=[];const base=new THREE.Color(0x87988d);for(let j=0;j<normals.length;j+=3){const c=base.clone().multiplyScalar(normals[j+1]>.5?1.12:.73);shades.push(c.r,c.g,c.b);}
  stair.setAttribute('color',new THREE.Float32BufferAttribute(shades,3));step.geometry=stair;
  step.material=new THREE.MeshBasicMaterial({vertexColors:true});
  for(const outline of step.children)outline.visible=false;
  step.name='v2-entrance-tread';
 }

 // Open the bowl shell at the entrance: the existing stairs otherwise pass
 // behind its continuous opaque inner face, hiding the tiger on descent.
 const entranceWall=swamp.getObjectByName('swamp-sinkhole-wall');
 if(entranceWall){
  const src=entranceWall.geometry.index?entranceWall.geometry.toNonIndexed():entranceWall.geometry;
  const p=src.attributes.position,keep=[];
  for(let i=0;i<p.count;i+=3){
   const x=(p.getX(i)+p.getX(i+1)+p.getX(i+2))/3,z=(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2))/3;
   const a=Math.atan2(Math.sin(Math.atan2(z,x)-.5),Math.cos(Math.atan2(z,x)-.5));
   if(Math.abs(a)>.25)keep.push(i,i+1,i+2);
  }
  const cut=new THREE.BufferGeometry();
  for(const [name,attr]of Object.entries(src.attributes)){
   const values=new Float32Array(keep.length*attr.itemSize);
   keep.forEach((index,j)=>{for(let k=0;k<attr.itemSize;k++)values[j*attr.itemSize+k]=attr.array[index*attr.itemSize+k];});
   cut.setAttribute(name,new THREE.BufferAttribute(values,attr.itemSize));
  }
  cut.computeBoundingSphere();entranceWall.geometry=cut;
  for(const outline of entranceWall.children)outline.visible=false;
 }

 for(const flower of swamp.userData.giantFlowers||[]){
  let petalIndex=0;
  for(const petal of flower.children.slice(0,7)){
   if(!petal.isMesh)continue;
   const angle=petalIndex++*Math.PI*2/7,positions=[],colors=[],indices=[];
   for(let row=0;row<=10;row++)for(let col=0;col<=6;col++){
    const t=row/10,u=col/3-1,r=.35+t*3.7,width=Math.sin(Math.PI*t)*1.25;
    positions.push(Math.cos(angle)*r-Math.sin(angle)*u*width,.12+1.1*t*t+.35*u*u*Math.sin(Math.PI*t),Math.sin(angle)*r+Math.cos(angle)*u*width);
    const c=new THREE.Color(0xb47e98).lerp(new THREE.Color(0xe3c8ce),t);colors.push(c.r,c.g,c.b);
    if(row<10&&col<6){const a=row*7+col;indices.push(a,a+7,a+1,a+1,a+7,a+8);}
   }
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.setIndex(indices);geo.computeVertexNormals();
   petal.geometry=geo;petal.position.set(0,0,0);petal.rotation.set(0,0,0);petal.material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide});petal.name='v2-cupped-petal';
   for(const outline of petal.children)outline.visible=false;
  }
 }

 for(const flower of swamp.userData.giantFlowers||[]){
  const stamen=new THREE.Group();stamen.name='v2-luminous-stamens';
  for(let k=0;k<5;k++){
   const angle=k*Math.PI*2/5,x=Math.cos(angle)*.36,z=Math.sin(angle)*.36,h=1.3+(k%2)*.3;
   const filament=new THREE.Mesh(new THREE.CylinderGeometry(.035,.085,h,7),new THREE.MeshBasicMaterial({color:0xc4a57e}));filament.position.set(x,h/2+.35,z);stamen.add(filament);
   const anther=new THREE.Mesh(new THREE.SphereGeometry(.14,8,6),flower.userData.core.material);anther.position.set(x,h+.35,z);anther.scale.set(.8,1.6,.8);stamen.add(anther);
  }
  flower.add(stamen);
 }

 for(const rimTree of swamp.userData.towerTrees||[]){
  for(const segment of rimTree.children.slice(0,6)){
   if(!segment.isMesh)continue;
   segment.geometry.computeBoundingBox();const b=segment.geometry.boundingBox;
   const height=b.max.y-b.min.y,r=Math.max(b.max.x-b.min.x,b.max.z-b.min.z)*.5;
   const geo=new THREE.CylinderGeometry(r*.88,r,height,14,5),p=geo.attributes.position;
   for(let i=0;i<p.count;i++){const y=p.getY(i),t=(y+height/2)/height,a=Math.atan2(p.getZ(i),p.getX(i)),v=1+.09*Math.sin(Math.PI*t)*Math.sin(a*5);p.setX(i,p.getX(i)*v);p.setZ(i,p.getZ(i)*v);}
   geo.computeVertexNormals();segment.geometry=geo;segment.material=new THREE.MeshBasicMaterial({color:0x64786e});
   for(const outline of segment.children)outline.visible=false;
  }
 }

 for(const rimTree of swamp.userData.towerTrees||[]){
  const crowns=rimTree.children.filter(o=>o.name==='v2-rim-crown');
  const detail=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,0),new THREE.MeshBasicMaterial({color:0xffffff}),crowns.length*32);detail.name='v2-rim-leaflets';
  const pose=new THREE.Object3D();let n=0;
  for(const crown of crowns){crown.updateMatrix();for(let k=0;k<32;k++){
   const z=1-2*(k+.5)/32,r=Math.sqrt(1-z*z),a=k*2.399;
   pose.position.set(Math.cos(a)*r*.55,z*.55,Math.sin(a)*r*.55).applyMatrix4(crown.matrix);
   pose.rotation.set(.2*Math.sin(k),a,.3*z);pose.scale.set(1.1,.55,.75);pose.updateMatrix();detail.setMatrixAt(n,pose.matrix);detail.setColorAt(n,new THREE.Color([0x506e60,0x748773,0x829582,0x3d6055][k%4]));n++;
  }}
  detail.count=n;rimTree.add(detail);
 }

 const barkMeshes=[trunk,...(swamp.userData.towerTrees||[]).flatMap(t=>t.children.slice(0,6))];
 for(const mesh of barkMeshes){
  mesh.material=mesh.material.clone();mesh.material.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vSwampBark;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSwampBark=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vSwampBark;').replace('#include <color_fragment>',`#include <color_fragment>
    float a=atan(vSwampBark.z,vSwampBark.x);
    float v=sin(a*23.+sin(vSwampBark.y*.53+a*3.)*.65);
    float aa=max(fwidth(v),.01);
    float line=smoothstep(.94-aa,1.+aa,v);
    float interrupted=smoothstep(-.7,.2,sin(vSwampBark.y*.82+a*11.));
    diffuseColor.rgb*=1.-line*interrupted*.37;`);
  };mesh.material.customProgramCacheKey=()=> 'v2-bark-ink-13';
 }

 if(entranceWall){
  const p=entranceWall.geometry.attributes.position,positions=[],colors=[];
  const emit=(v,c)=>{positions.push(...v);colors.push(c.r,c.g,c.b);};
  for(let i=0;i<p.count;i+=6){
   const r=Math.hypot(p.getX(i),p.getZ(i)),x=p.getX(i)*(r-.08)/r,y=p.getY(i)+entranceWall.position.y+.2,z=p.getZ(i)*(r-.08)/r,a=Math.atan2(z,x);
   if(y<31||y>42||Math.abs(Math.atan2(Math.sin(a-.5),Math.cos(a-.5)))<.38)continue;
   for(let k=0;k<7;k++){
    const dir=k*2.399+a,len=2.3+(k%3)*.35,col=new THREE.Color([0x557a69,0x739181,0x3b6259][k%3]);
    const v=(t,side)=>{const r=t*len,w=Math.sin(Math.PI*t)*.38*(.8+.2*Math.cos(t*40));return [x+Math.cos(dir)*r-Math.sin(dir)*w*side,y+Math.sin(t*Math.PI*.8)*1.5,z+Math.sin(dir)*r+Math.cos(dir)*w*side];};
    for(let j=0;j<8;j++){const t=j/8,u=(j+1)/8;for(const q of [v(t,-1),v(u,-1),v(t,1),v(t,1),v(u,-1),v(u,1)])emit(q,col);}
   }
  }
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));geo.computeVertexNormals();
  const fern=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));fern.name='v2-bank-ferns';swamp.add(fern);
 }


 if(entranceWall){
  const geo=new THREE.CylinderGeometry(34,13,30,48,8,true).toNonIndexed(),p=geo.attributes.position,positions=[],colors=[];
  for(let i=0;i<p.count;i+=3){
   const angle=Math.atan2(p.getZ(i)+p.getZ(i+1)+p.getZ(i+2),p.getX(i)+p.getX(i+1)+p.getX(i+2));
   if(Math.abs(Math.atan2(Math.sin(angle-.5),Math.cos(angle-.5)))<.25)continue;
   for(let k=0;k<3;k++){
    const j=i+k,a=Math.atan2(p.getZ(j),p.getX(j)),y=p.getY(j),r=Math.hypot(p.getX(j),p.getZ(j));
    const bulge=.8*Math.sin(a*9)+.45*Math.sin(a*17+y*.23);
    positions.push(Math.cos(a)*(r+bulge),y,Math.sin(a)*(r+bulge));
    const c=new THREE.Color(0x294c5d).lerp(new THREE.Color(0x527887),(y+15)/30);c.multiplyScalar(.9+.1*Math.sin(angle*11));colors.push(c.r,c.g,c.b);
   }
  }
  const shaped=new THREE.BufferGeometry();shaped.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));shaped.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));shaped.computeVertexNormals();entranceWall.geometry=shaped;
 }
 if(entranceWall){
  entranceWall.material=entranceWall.material.clone();entranceWall.material.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vBankStone;').replace('#include <begin_vertex>','#include <begin_vertex>\nvBankStone=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vBankStone;').replace('#include <color_fragment>',`#include <color_fragment>
    float a=atan(vBankStone.z,vBankStone.x);
    float q=sin(a*113.+sin(vBankStone.y*.72+a*13.)*.45);
    float aa=max(fwidth(q),.015);
    float fissure=smoothstep(.97-aa,1.+aa,q)*smoothstep(-.3,.7,sin(vBankStone.y*.47+a*19.));
    diffuseColor.rgb*=1.-fissure*.4;
    float mossPattern=sin(a*17.+vBankStone.y*.34)*sin(a*29.-vBankStone.y*.7)+sin(a*51.+vBankStone.y*1.7)*.25;
    float moss=smoothstep(.32,.68,mossPattern)*smoothstep(-3.,12.,vBankStone.y);
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.15,.25,.19),moss*.55);
    float wet=1.-smoothstep(-1.,1.5,vBankStone.y);diffuseColor.rgb*=1.-wet*.14;`);
  };entranceWall.material.customProgramCacheKey=()=> 'v2-rock-moss-34';
 }

 const volume=swamp.getObjectByName('swamp-water-volume');
 if(volume){
  volume.material=volume.material.clone();volume.material.opacity=.32;
  const p=volume.geometry.attributes.position,c=volume.geometry.attributes.color;
  for(let i=0;i<p.count;i++){const t=THREE.MathUtils.clamp((p.getY(i)+7.5)/15,0,1),color=new THREE.Color(0x21495e).lerp(new THREE.Color(0x70a9b7),t);c.setXYZ(i,color.r,color.g,color.b);}c.needsUpdate=true;
 }

 const lakeFloor=swamp.getObjectByName('swamp-lake-floor');
 if(lakeFloor){
  const geo=new THREE.CylinderGeometry(13.5,15,1.2,48,3),p=geo.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),z=p.getZ(i),band=.5+.5*Math.sin(x*.7+Math.sin(z*.5));
   const c=new THREE.Color(0x284b5b).lerp(new THREE.Color(0x557c7f),band);colors.push(c.r,c.g,c.b);
  }
  geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));lakeFloor.geometry=geo;lakeFloor.material=new THREE.MeshBasicMaterial({vertexColors:true});for(const shell of lakeFloor.children)shell.visible=false;
 }
 const pebbles=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,1),new THREE.MeshBasicMaterial({color:0x688686}),32);pebbles.name='v2-bed-pebbles';
 const stonePose=new THREE.Object3D();
 for(let i=0;i<32;i++){const a=i*2.399,r=7+(i%6);stonePose.position.set(Math.cos(a)*r,10.5,Math.sin(a)*r);stonePose.rotation.set(.1,a,.1);stonePose.scale.set(.65+(i%3)*.15,.25,.5);stonePose.updateMatrix();pebbles.setMatrixAt(i,stonePose.matrix);}swamp.add(pebbles);

 const grassVertices=[],grassColors=[];
 for(let i=0;i<30;i++){
  const angle=i*2.399,r=6+(i%6),x=Math.cos(angle)*r,z=Math.sin(angle)*r;
  for(let f=0;f<3;f++){
   const a=angle+f*2.1,height=2+(i%4)*.6;
   const point=(t,side)=>[x+Math.cos(a)*(.6*Math.sin(t*2.2)+side*.22*Math.sin(t*Math.PI)),10.5+t*height,z+Math.sin(a)*(.6*Math.sin(t*2.2)+side*.22*Math.sin(t*Math.PI))];
   for(let j=0;j<8;j++){const t=j/8,u=(j+1)/8,c=new THREE.Color(0x254c59).lerp(new THREE.Color(0x5b978a),u);for(const v of [point(t,-1),point(u,-1),point(t,1),point(t,1),point(u,-1),point(u,1)]){grassVertices.push(...v);grassColors.push(c.r,c.g,c.b);}}
  }
 }
 const grassGeo=new THREE.BufferGeometry();grassGeo.setAttribute('position',new THREE.Float32BufferAttribute(grassVertices,3));grassGeo.setAttribute('color',new THREE.Float32BufferAttribute(grassColors,3));grassGeo.computeVertexNormals();
 const grass=new THREE.Mesh(grassGeo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,fog:false}));grass.name='v2-underwater-grass';swamp.add(grass);

 const barge=swamp.userData.shipyard?.barge;
 if(barge){
  const wood=new THREE.MeshBasicMaterial({color:0x796b53}),rope=new THREE.MeshBasicMaterial({color:0xa99872});
  for(const z of [-.55,.55]){
   const log=new THREE.Mesh(new THREE.CylinderGeometry(.18,.2,4.7,10),wood);log.rotation.z=Math.PI/2;log.position.set(0,-.25,z);log.name='v2-barge-float';barge.add(log);
   for(const x of [-1.8,1.8]){const band=new THREE.Mesh(new THREE.TorusGeometry(.21,.035,5,16),rope);band.rotation.y=Math.PI/2;band.position.set(x,-.25,z);barge.add(band);}
  }
  const ink=new THREE.LineBasicMaterial({color:0x4b5147});
  for(let board=0;board<3;board++)for(let strand=0;strand<4;strand++){
   const points=[];for(let j=0;j<=16;j++)points.push(new THREE.Vector3(-2.35+j*4.7/16,.081,(board-1)*.58+(strand-1.5)*.12+.018*Math.sin(j*.9+strand)));
   const grain=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),ink);grain.name='v2-deck-grain';barge.add(grain);
  }
  for(const x of [-2.25,2.25])for(const z of [-.76,.76]){const post=new THREE.Mesh(new THREE.CylinderGeometry(.075,.09,.65,8),wood);post.position.set(x,.28,z);post.name='v2-mooring-post';barge.add(post);}
 }

 // Open a working bay beyond the bow-side oar bank, without changing the ship or its crew.
 if(barge){
  const ship=swamp.userData.shipyard.dock;
  barge.position.copy(new THREE.Vector3(6.5,0,2.7).applyAxisAngle(new THREE.Vector3(0,1,0),ship.rotation.y).add(ship.position));barge.position.y=25.1;
  const frame=new THREE.Group();frame.name='v2-repair-workbench';frame.position.set(-.6,.15,.1);
  const mat=new THREE.MeshBasicMaterial({color:0x847960});
  const top=new THREE.Mesh(new THREE.BoxGeometry(1.5,.12,.6),mat);top.position.y=.65;frame.add(top);
  for(const x of [-.6,.6])for(const z of [-.22,.22]){const leg=new THREE.Mesh(new THREE.BoxGeometry(.1,.65,.1),mat);leg.position.set(x,.325,z);frame.add(leg);}
  barge.add(frame);
 }

 // Swamp V2 owns its tall forest silhouette; the city marsh pass must not flatten it again.
 for(const rimTree of swamp.userData.towerTrees||[])rimTree.userData.swampV2KeepCanopy=true;

 // Replace flattened crown discs with overlapping, vertically staggered foliage lobes.
 for(const rimTree of swamp.userData.towerTrees||[]){
  const crowns=rimTree.children.filter(o=>o.name==='v2-rim-crown');
  const oldLeaves=rimTree.getObjectByName('v2-rim-leaflets');if(oldLeaves)oldLeaves.visible=false;
  const foliage=new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1,2),new THREE.MeshBasicMaterial({color:0xffffff}),crowns.length*7);foliage.name='v2-rim-foliage-lobes';let index=0;
  const fp=foliage.geometry.attributes.position,fc=[];
  for(let v=0;v<fp.count;v++){const x=fp.getX(v),y=fp.getY(v),z=fp.getZ(v),wave=1+.14*Math.sin(x*21+z*7)*Math.cos(z*19-y*9);fp.setXYZ(v,x*wave,y*wave,z*wave);const shade=.65+.35*(y+1)/2;fc.push(shade,shade,shade);}
  foliage.geometry.setAttribute('color',new THREE.Float32BufferAttribute(fc,3));foliage.material.vertexColors=true;
  const pose=new THREE.Object3D();
  for(const [ci,crown]of crowns.entries()){
   crown.visible=false;crown.updateMatrix();
   for(let k=0;k<7;k++){
    const a=k*2.399+ci,r=k===0?0:.28;
    pose.position.set(Math.cos(a)*r,Math.sin(k*2.7)*.35,Math.sin(a)*r).applyMatrix4(crown.matrix);
    pose.quaternion.copy(crown.quaternion);pose.scale.copy(crown.scale).multiply(new THREE.Vector3(.30,.43,.31));pose.updateMatrix();foliage.setMatrixAt(index,pose.matrix);foliage.setColorAt(index,new THREE.Color([0x476c61,0x6e8d77,0x819780,0x547a69][(ci+k)%4]));index++;
   }
  }rimTree.add(foliage);
 }

 // Exposed bank roots: bowed, tapered wood instead of rectangular sticks.
 for(const rimTree of swamp.userData.towerTrees||[]){
  for(const [ri,root]of rimTree.children.slice(6,12).entries()){
   if(!root.isMesh)continue;root.geometry.computeBoundingBox();const box=root.geometry.boundingBox,len=box.max.x-box.min.x;
   const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(.7,4,0),new THREE.Vector3(2.2,1.1,.12),new THREE.Vector3(4,-.12,.08)]);
   const geo=new THREE.TubeGeometry(curve,12,1,8,false),p=geo.attributes.position;
   for(let j=0;j<=12;j++){const c=curve.getPointAt(j/12),r=.32*(1-j/12)+.04;for(let k=0;k<=8;k++){const n=j*9+k;p.setXYZ(n,c.x+(p.getX(n)-c.x)*r,c.y+(p.getY(n)-c.y)*r*.7,c.z+(p.getZ(n)-c.z)*r);}}
   geo.computeVertexNormals();root.geometry=geo;root.material=new THREE.MeshBasicMaterial({color:0x586e63});root.position.set(0,0,0);root.rotation.set(0,ri*Math.PI/3,0);root.name='v2-rim-bowed-root';for(const outline of root.children)outline.visible=false;
  }
 }

 // Curved pointed leaves replace polyhedral confetti on the central crown.
 const leafVertices=[],leafColors=[];
 for(let j=0;j<8;j++){
  const point=(t,side)=>[(t-.5)*2,.3*Math.sin(t*Math.PI)+Math.abs(side)*.06,side*Math.sin(t*Math.PI)*.52*(1+.08*Math.sin(t*48))];
  const t=j/8,u=(j+1)/8;
  for(const [v,side]of [[point(t,0),0],[point(u,-1),-1],[point(t,-1),-1],[point(t,0),0],[point(u,0),0],[point(u,-1),-1],[point(t,0),0],[point(t,1),1],[point(u,1),1],[point(t,0),0],[point(u,1),1],[point(u,0),0]]){leafVertices.push(...v);const c=side===0?1:side<0?.72:.87;leafColors.push(c,c,c);}
 }
 const pointedLeaf=new THREE.BufferGeometry();pointedLeaf.setAttribute('position',new THREE.Float32BufferAttribute(leafVertices,3));pointedLeaf.setAttribute('color',new THREE.Float32BufferAttribute(leafColors,3));pointedLeaf.computeVertexNormals();
 leaves.geometry=pointedLeaf;leaves.material.vertexColors=true;leaves.material.side=THREE.DoubleSide;

 // Fine silhouette ink, batched for the central crown rather than 126 extra draw calls.
 const centralCrowns=tree.children.filter(o=>o.name==='v2-crown-cluster');
 if(centralCrowns.length){
  const geo=centralCrowns[0].geometry.clone(),p=geo.attributes.position,colors=[];
  for(let i=0;i<p.count;i++){const c=.76+.24*(p.getY(i)+1)/2;colors.push(c,c,c);}geo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  const batch=new THREE.InstancedMesh(geo,new THREE.MeshBasicMaterial({vertexColors:true}),centralCrowns.length),ink=new THREE.InstancedMesh(geo,new THREE.MeshBasicMaterial({color:0x294c51,side:THREE.BackSide}),centralCrowns.length),pose=new THREE.Object3D();batch.name='v2-central-crown-batch';ink.name='v2-central-crown-ink';
  centralCrowns.forEach((c,i)=>{c.updateMatrix();batch.setMatrixAt(i,c.matrix);batch.setColorAt(i,new THREE.Color([0x537b73,0x729589,0x8b9f88,0x406a67][i%4]));pose.position.copy(c.position);pose.quaternion.copy(c.quaternion);pose.scale.copy(c.scale).multiplyScalar(1.018);pose.updateMatrix();ink.setMatrixAt(i,pose.matrix);c.visible=false;});tree.add(batch,ink);
 }
 for(const rimTree of swamp.userData.towerTrees||[]){const foliage=rimTree.getObjectByName('v2-rim-foliage-lobes');if(!foliage)continue;
  const ink=new THREE.InstancedMesh(foliage.geometry,new THREE.MeshBasicMaterial({color:0x294c51,side:THREE.BackSide}),foliage.count),matrix=new THREE.Matrix4(),expand=new THREE.Matrix4().makeScale(1.015,1.015,1.015);ink.name='v2-rim-crown-ink';
  for(let i=0;i<foliage.count;i++){foliage.getMatrixAt(i,matrix);ink.setMatrixAt(i,matrix.multiply(expand));}rimTree.add(ink);
 }

 // Rebuild the remaining angular branch segments, keeping every fork endpoint fixed.
 for(const rimTree of swamp.userData.towerTrees||[]){
  for(const branch of rimTree.children.slice(12)){
   if(!branch.isMesh||branch.name||branch.geometry?.attributes.position.count!==72)continue;
   const p=branch.geometry.attributes.position;branch.geometry.computeBoundingBox();const h=branch.geometry.boundingBox.max.y-branch.geometry.boundingBox.min.y;let top=0,bottom=0;
   for(let i=0;i<p.count;i++){const r=Math.hypot(p.getX(i),p.getZ(i));if(p.getY(i)>0)top=Math.max(top,r);else bottom=Math.max(bottom,r);}
   const geo=new THREE.CylinderGeometry(top,bottom,h,12,6),v=geo.attributes.position;
   for(let i=0;i<v.count;i++){const t=(v.getY(i)+h/2)/h;v.setX(i,v.getX(i)+Math.sin(t*Math.PI)*Math.min(.22,h*.025));}geo.computeVertexNormals();branch.geometry=geo;
   branch.material=trunk.material.clone();branch.material.onBeforeCompile=trunk.material.onBeforeCompile;branch.material.customProgramCacheKey=trunk.material.customProgramCacheKey;branch.name='v2-curved-rim-branch';for(const outline of branch.children)outline.visible=false;
  }
 }

 // Low masonry cheeks hold the entrance cut open while leaving the full tread width clear.
 const stairCheeks=new THREE.Group();stairCheeks.name='v2-entry-stone-cheeks';
 for(const [i,step]of (swamp.userData.tigerWalkSurfaces||[]).entries())for(const side of [-1,1]){
  const block=new THREE.Mesh(new THREE.BoxGeometry(.65,3.65,1.8),new THREE.MeshBasicMaterial({color:i%2?0x8f9e95:0xa4afa1}));
  block.position.copy(step.position).add(new THREE.Vector3(-Math.sin(.5)*side*4.65,-.85,Math.cos(.5)*side*4.65));block.rotation.y=step.rotation.y;stairCheeks.add(block);
  const seam=new THREE.LineSegments(new THREE.EdgesGeometry(block.geometry),new THREE.LineBasicMaterial({color:0x50665e}));block.add(seam);
 }swamp.add(stairCheeks);

 // Brass glass lamps identify the descent without covering the tiger's walking lane.
 const entryLamps=new THREE.Group();entryLamps.name='v2-entry-lamps';
 for(const i of [0,3,6]){
  const step=swamp.userData.tigerWalkSurfaces[i],lamp=new THREE.Group();lamp.position.copy(step.position).add(new THREE.Vector3(-Math.sin(.5)*4.65,1.05,Math.cos(.5)*4.65));
  const brass=new THREE.MeshBasicMaterial({color:0x9b8962}),stem=new THREE.Mesh(new THREE.CylinderGeometry(.07,.12,2.3,10),brass);stem.position.y=1.15;lamp.add(stem);
  const globe=new THREE.Mesh(new THREE.SphereGeometry(.38,16,10),new THREE.MeshBasicMaterial({color:0xc9e5bf,transparent:true,opacity:.72}));globe.position.y=2.55;lamp.add(globe);
  for(const axis of [0,1]){const hoop=new THREE.Mesh(new THREE.TorusGeometry(.39,.025,5,24),brass);hoop.position.y=2.55;if(axis)hoop.rotation.y=Math.PI/2;lamp.add(hoop);}
  const cap=new THREE.Mesh(new THREE.ConeGeometry(.23,.22,12),brass);cap.position.y=3.02;lamp.add(cap);entryLamps.add(lamp);
 }swamp.add(entryLamps);

 // Rooted broad fronds grow outward from the masonry, preserving a clear central stair lane.
 const frondGeo=pointedLeaf.clone();frondGeo.translate(1,0,0);
 const entryFronds=new THREE.InstancedMesh(frondGeo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}),8*2*6),frondPose=new THREE.Object3D();entryFronds.name='v2-entry-fronds';let fi=0;
 for(const [i,step]of swamp.userData.tigerWalkSurfaces.entries())for(const side of [-1,1])for(let k=0;k<6;k++){
  frondPose.position.copy(step.position).add(new THREE.Vector3(-Math.sin(.5)*side*4.9,1,Math.cos(.5)*side*4.9));
  frondPose.rotation.set(0,-.5-Math.PI/2+(side<0?Math.PI:0)+(k-2.5)*.2,.35+(k%3)*.2);frondPose.scale.set(.7+(k%3)*.2,1,.65);frondPose.updateMatrix();entryFronds.setMatrixAt(fi,frondPose.matrix);entryFronds.setColorAt(fi,new THREE.Color([0x315f5c,0x527e6b,0x7c9880][(i+k)%3]));fi++;
 }swamp.add(entryFronds);

 // Broken rock shelves interrupt the artificial bowl silhouette above the swimming layer.
 const ledgeP=[],ledgeC=[];
 const tri=(a,b,c,color)=>{for(const v of [a,b,c]){ledgeP.push(...v);ledgeC.push(color.r,color.g,color.b);}};
 for(let level=0;level<3;level++)for(let i=0;i<12;i++){
  const angle=(i+level*.3)*Math.PI/6,y=28+level*4.2+Math.sin(i*3.1+level)*1.1;
  if(Math.abs(Math.atan2(Math.sin(angle-.5),Math.cos(angle-.5)))<.38)continue;
  const point=(a,inset,h)=>{const radius=13+(y-10)*.7+.8*Math.sin(a*9)+.45*Math.sin(a*17+(y-25)*.23);return [Math.cos(a)*(radius-inset),y+h,Math.sin(a)*(radius-inset)];};
  for(let k=0;k<6;k++){
   const a=angle-.065+k*.13/6,b=a+.13/6,w=.35+1.1*Math.sin(Math.PI*(k+.5)/6),A=point(a,-.2,0),B=point(b,-.2,0),C=point(a,w,0),D=point(b,w,0),E=point(a,-.2,-1.6),F=point(b,-.2,-1.6);
   const top=new THREE.Color(0x76887c),face=new THREE.Color(0x496771);tri(A,C,B,top);tri(B,C,D,top);tri(C,E,D,face);tri(D,E,F,face);
  }
 }
 const ledgeGeo=new THREE.BufferGeometry();ledgeGeo.setAttribute('position',new THREE.Float32BufferAttribute(ledgeP,3));ledgeGeo.setAttribute('color',new THREE.Float32BufferAttribute(ledgeC,3));ledgeGeo.computeVertexNormals();const ledges=new THREE.Mesh(ledgeGeo,new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide}));ledges.name='v2-bank-rock-shelves';swamp.add(ledges);

}

// Resolve the final spherical road after the city assembler has placed it.
export function finishSwampV2Art({scene,swamp}){
 const inner=swamp.userData.inner||swamp;if(!inner.userData.swampV2Round)return;
 const road=scene.getObjectByName('v7-continuous-swamp-promenade');if(!road)return;
 scene.updateMatrixWorld(true);const ray=new THREE.Raycaster();
 for(const tree of inner.userData.towerTrees||[])for(const root of tree.children.filter(o=>o.name==='v2-rim-bowed-root')){
  const end=root.localToWorld(new THREE.Vector3(4,-.12,.08)),up=end.clone().normalize();ray.set(end.clone().addScaledVector(up,10),up.clone().negate());const hit=ray.intersectObject(road,false)[0];
  if(!hit){root.visible=false;continue;}
  const local=root.worldToLocal(hit.point.clone()),p=root.geometry.attributes.position;
  for(let j=0;j<=12;j++)for(let k=0;k<=8;k++){const n=j*9+k;p.setY(n,p.getY(n)+(local.y+.12)*Math.pow(j/12,2));}
  p.needsUpdate=true;root.geometry.computeVertexNormals();root.geometry.computeBoundingSphere();root.userData.roadRooted=true;
 }
 road.material=new THREE.MeshBasicMaterial({color:0xb4b6a5,side:THREE.DoubleSide});
 road.material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vPaving;').replace('#include <begin_vertex>','#include <begin_vertex>\nvPaving=uv;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vPaving;').replace('#include <color_fragment>',`#include <color_fragment>
   vec2 q=(vPaving-.5)*43.;float a=atan(q.y,q.x);float row=floor(length(q));
   vec2 cell=vec2(a*16.+mod(row,2.)*.5,length(q));vec2 edge=abs(fract(cell)-.5);vec2 aa=max(fwidth(cell),vec2(.003));
   float grout=max(smoothstep(.48-aa.x,.5,edge.x),smoothstep(.48-aa.y,.5,edge.y));
   diffuseColor.rgb*=1.-grout*.42;
   diffuseColor.rgb*=.96+.04*sin(floor(cell.x)*13.+row*7.);`);
 };road.material.customProgramCacheKey=()=> 'swamp-v2-paving-29';

}
