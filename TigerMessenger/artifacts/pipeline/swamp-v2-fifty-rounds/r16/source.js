import * as THREE from 'three';
export const SWAMP_V2_ROUND=16;
export function applySwampV2Art(swamp){
 if(new URLSearchParams(globalThis.location?.search||'').get('swampV2')==='0')return;
 swamp.userData.swampV2Round=SWAMP_V2_ROUND;
 // Keep objects and random sequence intact; only suspend visible lianas for the approved build scope.
 swamp.traverse(o=>{if(o.name.startsWith('swamp-vine-')||o.name==='swamp-cross-tree-vine')o.visible=false;});
 const tree=swamp.getObjectByName('swamp-ancient-world-tree'),trunk=tree?.getObjectByName('world-tree-trunk');
 if(!trunk)return;
 // Replace the six-sided pole with a continuous tapered, gently curved trunk at the same anchor.
 const g=new THREE.CylinderGeometry(1.5,4.2,58,20,16),a=g.attributes.position;
 for(let i=0;i<a.count;i++){
  const y=a.getY(i),t=(y+29)/58,angle=Math.atan2(a.getZ(i),a.getX(i));
  const ridge=1+.08*Math.sin(angle*7+t*2);
  a.setXYZ(i,a.getX(i)*ridge+Math.sin(t*3.3)*.9,y,a.getZ(i)*ridge+Math.sin(t*4)*.45);
 }
 g.computeVertexNormals();trunk.geometry=g;
 trunk.material=new THREE.MeshBasicMaterial({color:0x52767a});
 for(const child of trunk.children)if(child.isMesh)child.visible=false;
 const bark=new THREE.LineBasicMaterial({color:0x294855,transparent:true,opacity:.65});
 for(let k=0;k<14;k++){
  const angle=k/14*Math.PI*2,pts=[];
  for(let j=0;j<=28;j++){const t=j/28,r=THREE.MathUtils.lerp(4.2,1.5,t)*(1+.08*Math.sin(angle*7+t*2));pts.push(new THREE.Vector3(Math.cos(angle)*r+Math.sin(t*3.3)*.9,-29+t*58,Math.sin(angle)*r+Math.sin(t*4)*.45));}
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
   const tread=new THREE.BoxGeometry(8.5,.9,.64).toNonIndexed();
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
    diffuseColor.rgb*=1.-fissure*.4;`);
  };entranceWall.material.customProgramCacheKey=()=> 'v2-rock-fissures-16';
 }

}
