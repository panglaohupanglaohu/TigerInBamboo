import * as THREE from 'three';
export const TIGER_TARGET_ROUND=14;
export function applyTigerTargetV1(tiger){
 const nodes=new Map();tiger.traverse(n=>{if(n.userData.blenderSourceNode)nodes.set(n.userData.blenderSourceNode,n);});
 const head=nodes.get('n8'),body=nodes.get('n1'),neck=nodes.get('n6');if(!head||!body||!neck)return;
 const edit=(id,fn)=>{const n=nodes.get(id);if(!n?.geometry)return;n.geometry=n.geometry.clone();const p=n.geometry.attributes.position;for(let i=0;i<p.count;i++)fn(p,i);p.needsUpdate=true;n.geometry.computeVertexNormals();n.geometry.computeBoundingSphere();return n;};
 edit('n2',(p,i)=>{const z=p.getZ(i);if(z>1.25){const k=(z-1.25)/1.335;p.setZ(i,1.25+(z-1.25)*.40);p.setX(i,p.getX(i)*(1-.30*k));}});
 // The nape and throat form one continuous, bending loft, from scapula to skull.
 const rings=24,sides=28,positions=new Float32Array((rings+1)*(sides+1)*3),uvs=[],indices=[];
 for(let i=0;i<=rings;i++)for(let j=0;j<=sides;j++){uvs.push(j/sides,i/rings);if(i<rings&&j<sides){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,a+1,b,b,a+1,b+1);}}
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(positions,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.setIndex(indices);neck.geometry=geo;
 // Preserve the approved coat shader; remove stale pre-loft vertex shading.
 neck.material=nodes.get('n2').material.clone();neck.material.vertexColors=false;
 neck.material.onBeforeCompile=nodes.get('n2').material.onBeforeCompile;neck.material.customProgramCacheKey=()=> 'tiger-target-neck-1';
 const p0=new THREE.Vector3(0,.16,.40),p1=new THREE.Vector3(0,.36,1.30),p2=new THREE.Vector3(),p3=new THREE.Vector3(),point=new THREE.Vector3(),tangent=new THREE.Vector3(),up=new THREE.Vector3(),endDir=new THREE.Vector3();
 const curve=new THREE.CubicBezierCurve3(p0,p1,p2,p3);
 const updateNeck=()=>{head.updateMatrix();p3.set(0,-.1,-.43).applyMatrix4(head.matrix);endDir.set(0,0,1).transformDirection(head.matrix);p2.copy(p3).addScaledVector(endDir,-.42);
  for(let i=0;i<=rings;i++){const u=i/rings,s=u*u*(3-2*u);curve.getPoint(u,point);curve.getTangent(u,tangent);up.set(0,tangent.z,-tangent.y).normalize();const rx=THREE.MathUtils.lerp(.86,.54,s),ry=THREE.MathUtils.lerp(.89,.59,s);
   for(let j=0;j<=sides;j++){const a=j/sides*Math.PI*2,k=(i*(sides+1)+j)*3;positions[k]=Math.cos(a)*rx;positions[k+1]=point.y+Math.sin(a)*ry*up.y;positions[k+2]=point.z+Math.sin(a)*ry*up.z;}}
  geo.attributes.position.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere();
 };
 tiger.userData.updateTargetNeck=updateNeck;updateNeck();
 // Throat fur follows the neck's underside even when it bends down, rather than a world-Y bib.
 const neckShader=neck.material.onBeforeCompile;
 neck.material.onBeforeCompile=shader=>{neckShader(shader);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vNeckUv; varying vec3 vNeckNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvNeckUv=uv;vNeckNormal=normal;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vNeckUv; varying vec3 vNeckNormal;').replace('float belly=1.-smoothstep(-.82,-.35,vTigerSkin.y);','float belly=0.;').replace('float throat=smoothstep(1.7,2.3,vTigerSkin.z)*(1.-smoothstep(-.3,.35,vTigerSkin.y));','float throat=(1.-smoothstep(-.65,-.15,sin(vNeckUv.x*6.2831853)+.045*sin(vNeckUv.y*180.)))*smoothstep(.1,.7,vNeckUv.y);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>','outgoingLight*=.77+.23*smoothstep(-.3,.5,dot(normalize(vNeckNormal),normalize(vec3(-.3,.7,.5))));\n#include <opaque_fragment>');
 };
 neck.material.customProgramCacheKey=()=> 'tiger-target-throat-2';

 // Ease the lower drinking steps: the previous rise exceeded a tiger foreleg.
 const swamp=tiger.parent;
 const grade=y=>y<=30?25.3+(y-25)*.30:26.8+(y-30)*1.32;
 if(swamp?.userData.tigerWalkSurfaces&&!swamp.userData.tigerLandingGraded){
  for(const step of swamp.userData.tigerWalkSurfaces){
   step.geometry=step.geometry.clone();const p=step.geometry.attributes.position;
   for(let i=0;i<p.count;i++)p.setY(i,grade(step.position.y+p.getY(i))-step.position.y);
   p.needsUpdate=true;step.geometry.computeVertexNormals();step.geometry.computeBoundingSphere();
  }
  const cheeks=swamp.getObjectByName('v2-entry-stone-cheeks');
  for(const block of cheeks?.children||[]){const old=block.position.y;block.position.y=grade(old);block.scale.y=(grade(old+1.825)-grade(old-1.825))/3.65;}
  for(const lamp of swamp.getObjectByName('v2-entry-lamps')?.children||[])lamp.position.y=grade(lamp.position.y-1.05)+1.05;
  const fronds=swamp.getObjectByName('v2-entry-fronds');if(fronds){const m=new THREE.Matrix4();for(let i=0;i<fronds.count;i++){fronds.getMatrixAt(i,m);m.elements[13]=grade(m.elements[13]-1)+1;fronds.setMatrixAt(i,m);}fronds.instanceMatrix.needsUpdate=true;fronds.computeBoundingSphere();}
  swamp.userData.tigerLandingGraded=true;
 }
 const route=tiger.userData.tigerRoam;
 if(route?.steps?.length){const last=route.steps[route.steps.length-1],r=Math.hypot(last.x,last.z);if(r>0){last.x*=1+.85/r;last.z*=1+.85/r;}}
 // Use actual step support for the drinking stance, not a horizontal body buried in the risers.
 tiger.rotation.order='YXZ';
 const oldUpdate=tiger.userData.update,ray=new THREE.Raycaster(),local=new THREE.Vector3(),world=new THREE.Vector3(),down=new THREE.Vector3(),nosePoint=new THREE.Vector3();let drinkBlend=0;
 const legIds=['n52','n59','n66','n73'],legRest=legIds.map(id=>nodes.get(id).position.clone());
 const paws=['n55','n62','n69','n76'].map(id=>nodes.get(id));
 const support=(swamp,paw)=>{tiger.updateWorldMatrix(true,true);paw.geometry.computeBoundingBox();local.set(0,paw.geometry.boundingBox.min.y,.30);paw.localToWorld(local);swamp.worldToLocal(local);const foot=local.clone();world.copy(local);world.y=55;swamp.localToWorld(world);down.set(0,-1,0).transformDirection(swamp.matrixWorld);ray.set(world,down);const hit=ray.intersectObjects(swamp.userData.tigerWalkSurfaces||[],false)[0];return {foot,height:hit?swamp.worldToLocal(hit.point.clone()).y:null};};
 tiger.userData.update=function(dt,t,runtime){legIds.forEach((id,i)=>nodes.get(id).position.copy(legRest[i]));oldUpdate.call(this,dt,t,runtime);const swamp=tiger.parent;
  drinkBlend+=(Number(!!tiger.userData._drinking)-drinkBlend)*Math.min(1,dt*4);tiger.rotation.x=0;
  tiger.userData.updateTargetForelimbs?.(drinkBlend);
  if(drinkBlend<.01||!swamp?.userData.tigerWalkSurfaces)return;
  swamp.updateWorldMatrix(true,false);for(const step of swamp.userData.tigerWalkSurfaces)step.updateWorldMatrix(true,false);
  const fore=support(swamp,paws[0]),rear=support(swamp,paws[2]);if(fore.height==null||rear.height==null)return;
  const span=Math.hypot(fore.foot.x-rear.foot.x,fore.foot.z-rear.foot.z),pitch=THREE.MathUtils.clamp(Math.atan2(rear.height-fore.height,Math.max(.1,span)),0,.22)*drinkBlend;tiger.rotation.x=pitch;
  // Front limbs remain substantially upright as the back inclines down the steps.
  for(const id of ['n52','n59','n66','n73']){const leg=nodes.get(id);if(leg)leg.rotation.x-=pitch*.8;}
  const feet=paws.map(p=>support(swamp,p)).filter(p=>p.height!=null);if(feet.length)tiger.position.y+=Math.max(...feet.map(p=>p.height+.015-p.foot.y));
  // Each limb settles independently on its sampled tread; avoid dangling forefeet.
  tiger.updateWorldMatrix(true,true);
  paws.forEach((paw,i)=>{const f=support(swamp,paw);if(f.height==null)return;const from=tiger.worldToLocal(swamp.localToWorld(f.foot.clone())),to=f.foot.clone();to.y=f.height+.015;const delta=tiger.worldToLocal(swamp.localToWorld(to)).sub(from);nodes.get(legIds[i]).position.add(delta.multiplyScalar(drinkBlend));});
  // Reach beyond the forefeet rather than folding the face between them.
  body.position.y-=.45*drinkBlend;
  head.position.z+=.70*drinkBlend;
  head.rotation.x=THREE.MathUtils.lerp(head.rotation.x,.62-pitch-body.rotation.x,drinkBlend);
  tiger.updateWorldMatrix(true,true);const nose=nodes.get('n25'),a=nose.geometry.attributes.position;let min=Infinity,best=new THREE.Vector3();
  for(let i=0;i<a.count;i++){nosePoint.fromBufferAttribute(a,i);nose.localToWorld(nosePoint);swamp.worldToLocal(nosePoint);if(nosePoint.y<min){min=nosePoint.y;best.copy(nosePoint);}}
  if(drinkBlend>.8){const from=body.worldToLocal(swamp.localToWorld(best.clone())),to=best.clone();to.y=25.02;body.worldToLocal(swamp.localToWorld(to));head.position.add(to.sub(from));}
  updateNeck();tiger.userData.tigerTargetSupport={pitch,feet:paws.map(p=>support(swamp,p)).map(p=>({height:p.height,foot:p.foot.toArray()})),noseBefore:min};
 };

 // Continuous adult cranium: broad temples, narrowed lower jaw and softened forehead.
 const skull=nodes.get('n9'),skullGeo=new THREE.SphereGeometry(1,48,32),skullP=skullGeo.attributes.position;
 for(let i=0;i<skullP.count;i++){
  const y=skullP.getY(i),jaw=1-.15*(1-THREE.MathUtils.smoothstep(y,-.7,-.05));
  skullP.setXYZ(i,skullP.getX(i)*.95*jaw,y*.75-.025,skullP.getZ(i)*.92+.10);
 }
 skullGeo.computeVertexNormals();skullGeo.computeBoundingSphere();skull.geometry=skullGeo;

 // Anatomical face markings use skull-local projection, independent of remeshing UV seams.
 const faceCanvas=document.createElement('canvas');faceCanvas.width=1024;faceCanvas.height=1024;
 const faceCtx=faceCanvas.getContext('2d');faceCtx.fillStyle='#c88c4b';faceCtx.fillRect(0,0,1024,1024);
 const fx=x=>(x+1)*512,fy=y=>(.8-y)/1.6*1024;
 const stroke=(points,w,color)=>{faceCtx.strokeStyle=color;faceCtx.lineWidth=w;faceCtx.lineCap='round';faceCtx.beginPath();points.forEach(([x,y],i)=>i?faceCtx.lineTo(fx(x),fy(y)):faceCtx.moveTo(fx(x),fy(y)));faceCtx.stroke();};
 for(const side of[-1,1]){
  faceCtx.fillStyle='#e7e1c9';faceCtx.beginPath();faceCtx.ellipse(fx(side*.59),fy(.12),96,68,side*.1,0,Math.PI*2);faceCtx.fill();
  faceCtx.beginPath();faceCtx.ellipse(fx(side*.77),fy(-.42),120,145,side*-.35,0,Math.PI*2);faceCtx.fill();
  for(let k=0;k<4;k++){
   const y=.60-k*.11;
   stroke([[side*.035,y],[side*.16,y+.02],[side*(.24+k*.07),y+.10]],13-k,'#262b29');
   stroke([[side*(.97-k*.025),-.05-k*.16],[side*.74,-.08-k*.14],[side*(.49+k*.025),-.14-k*.14]],17-k*2,'#252b29');
  }
  stroke([[side*.42,.16],[side*.59,.22],[side*.78,.16]],14,'#242925');
  stroke([[side*.45,.00],[side*.62,-.025],[side*.78,.045]],8,'#242925');
 }
 // Sparse short fur strokes soften the edge without adding geometry noise.
 faceCtx.strokeStyle='rgba(82,59,36,.20)';faceCtx.lineWidth=1;
 for(let k=0;k<3000;k++){const x=(k*271.73)%1024,y=(k*137.39)%1024;faceCtx.beginPath();faceCtx.moveTo(x,y);faceCtx.lineTo(x+Math.sin(k)*2,y+4);faceCtx.stroke();}
 const faceMap=new THREE.CanvasTexture(faceCanvas);faceMap.colorSpace=THREE.SRGBColorSpace;
 const sp=skull.geometry.attributes.position,suv=skull.geometry.attributes.uv;
 for(let i=0;i<sp.count;i++)suv.setXY(i,(sp.getX(i)+1)/2,(sp.getY(i)+.8)/1.6);suv.needsUpdate=true;
 skull.material=skull.material.clone();skull.material.map=faceMap;skull.material.vertexColors=false;skull.material.needsUpdate=true;

 // Joined muzzle with a modest nasal pad; remove the two ball-like whisker pads.
 for(const o of head.children)if(o.name==='v2-tiger-whisker-pad')o.visible=false;
 const muzzle=nodes.get('n23'),mg=new THREE.SphereGeometry(1,40,24),mp=mg.attributes.position;
 for(let i=0;i<mp.count;i++){const x=mp.getX(i),y=mp.getY(i),z=mp.getZ(i);mp.setXYZ(i,x*.52,y*.215-.355,z*.32+1.065-.04*Math.exp(-x*x*30));}
 mg.computeVertexNormals();muzzle.geometry=mg;muzzle.material=new THREE.MeshBasicMaterial({color:0xe6dfca,fog:false});
 const nose=nodes.get('n25'),ns=new THREE.Shape();ns.moveTo(-.18,-.265);ns.quadraticCurveTo(0,-.235,.18,-.265);ns.lineTo(.135,-.35);ns.quadraticCurveTo(0,-.445,-.135,-.35);ns.closePath();
 const ng=new THREE.ExtrudeGeometry(ns,{depth:.035,bevelEnabled:true,bevelSize:.012,bevelThickness:.009,bevelSegments:2,curveSegments:12});ng.translate(0,0,1.355);nose.geometry=ng;nose.material=new THREE.MeshBasicMaterial({color:0xb88070,fog:false});
 for(const side of[-1,1]){const nostril=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),new THREE.MeshBasicMaterial({color:0x342b28,fog:false}));nostril.scale.set(.045,.022,.009);nostril.position.set(side*.125,-.30,1.40);nostril.name='target-tiger-nostril';head.add(nostril);}

 // A continuous tapered cheek mantle replaces the stacked spherical ruff.
 for(const o of head.children)if(o.name==='v2-tiger-cheek-ruff')o.visible=false;
 for(const side of[-1,1]){
  const fg=new THREE.SphereGeometry(1,32,24),p=fg.attributes.position,col=[];
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i),t=(y+1)/2,tuft=1+.035*Math.sin(Math.atan2(z,x)*19+y*21);
   p.setXYZ(i,side*(.77+(x*.20+.035*(1-t))*tuft),-.27+y*.49,.39+z*.31);
   const c=new THREE.Color(t>.76?0xc28a4d:0xe4dfce).multiplyScalar(.83+.17*t);col.push(c.r,c.g,c.b);
  }
  fg.setAttribute('color',new THREE.Float32BufferAttribute(col,3));fg.computeVertexNormals();const fur=new THREE.Mesh(fg,new THREE.MeshBasicMaterial({vertexColors:true,fog:false}));fur.name='target-tiger-cheek-mantle';head.add(fur);
  const marks=[];for(let i=0;i<23;i++){const y=-.68+i*.033,x=side*(.91+.025*Math.sin(i*2.)),z=.51+.025*Math.sin(i);marks.push(new THREE.Vector3(x,y,z),new THREE.Vector3(x-side*.07,y+.055,z+.025));}
  const hatch=new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(marks),new THREE.LineBasicMaterial({color:0x6d6452,transparent:true,opacity:.5,fog:false}));head.add(hatch);
 }

 // Smooth shoulder/ribcage/rump loft; retains original limb pivots and the deforming neck.
 const profile=[[-3.08,.04,.08,.15],[-2.70,.76,.88,.10],[-2.15,1.04,1.19,.10],[-1.3,.86,1.02,.22],[-.5,.90,1.12,.12],[.3,1.04,1.26,.11],[1.1,1.09,1.32,.16],[1.65,.72,.93,.23],[1.80,.08,.14,.25]];
 const bp=[],bi=[],bu=[],ringsB=72,sidesB=40;
 for(let k=0;k<=ringsB;k++){
  const z=-3.08+4.88*k/ringsB;let j=0;while(j<profile.length-2&&z>profile[j+1][0])j++;
  const a=profile[j],b=profile[j+1],prev=profile[Math.max(0,j-1)],next=profile[Math.min(profile.length-1,j+2)],u=(z-a[0])/(b[0]-a[0]);
  const smooth=c=>{const m0=(b[c]-prev[c])/(b[0]-prev[0])*(b[0]-a[0]),m1=(next[c]-a[c])/(next[0]-a[0])*(b[0]-a[0]);return (2*u*u*u-3*u*u+1)*a[c]+(u*u*u-2*u*u+u)*m0+(-2*u*u*u+3*u*u)*b[c]+(u*u*u-u*u)*m1;};
  const rx=Math.max(.035,smooth(1)),ry=Math.max(.06,smooth(2)),cy=smooth(3);
  for(let n=0;n<=sidesB;n++){const angle=n/sidesB*Math.PI*2;bp.push(Math.cos(angle)*rx,cy+Math.sin(angle)*ry,z);bu.push(k/ringsB,n/sidesB);if(k<ringsB&&n<sidesB){const v=k*(sidesB+1)+n,w=v+sidesB+1;bi.push(v,v+1,w,w,v+1,w+1);}}
 }
 const bg=new THREE.BufferGeometry();bg.setAttribute('position',new THREE.Float32BufferAttribute(bp,3));bg.setAttribute('uv',new THREE.Float32BufferAttribute(bu,2));bg.setIndex(bi);bg.computeVertexNormals();bg.computeBoundingSphere();nodes.get('n2').geometry=bg;nodes.get('n2').material.vertexColors=false;nodes.get('n2').material.needsUpdate=true;

 // Fine, broken and forked body stripes instead of evenly spaced rings.
 const coatCanvas=document.createElement('canvas');coatCanvas.width=1024;coatCanvas.height=512;const cc=coatCanvas.getContext('2d');cc.fillStyle='#c78943';cc.fillRect(0,0,1024,512);cc.fillStyle='#252b28';
 for(let j=-1;j<26;j++){
  const base=j*42+9*Math.sin(j*2.8),phase=j*1.91,width=3+4*(.5+.5*Math.sin(j*3.3));
  const center=y=>base+13*Math.sin(y*.013+phase)+5*Math.sin(y*.035+phase);
  const w=y=>width*(.15+.85*Math.pow(Math.abs(Math.sin(y/512*Math.PI+phase*.08)),.6))*(1+.10*Math.sin(y*1.7+j));
  cc.beginPath();for(let y=0;y<=512;y+=2)cc.lineTo(center(y)-w(y),y);for(let y=512;y>=0;y-=2)cc.lineTo(center(y)+w(y),y);cc.closePath();cc.fill();
  if(j%3!==0){const y0=70+(j*47%240);cc.beginPath();cc.moveTo(center(y0),y0);cc.bezierCurveTo(center(y0)+20,y0+30,center(y0+90)+25,y0+55,center(y0+140)+20,y0+140);cc.bezierCurveTo(center(y0+90)+15,y0+75,center(y0)+5,y0+28,center(y0)-2,y0+9);cc.fill();}
 }
 cc.strokeStyle='rgba(53,42,31,.16)';cc.lineWidth=.65;
 for(let i=0;i<9500;i++){const x=i*137.21%1024,y=i*73.91%512;cc.beginPath();cc.moveTo(x,y);cc.lineTo(x+2+Math.sin(i),y+1.5);cc.stroke();}
 const coatMap=new THREE.CanvasTexture(coatCanvas);coatMap.colorSpace=THREE.SRGBColorSpace;coatMap.wrapS=THREE.RepeatWrapping;coatMap.wrapT=THREE.RepeatWrapping;
 for(const id of ['n2','n6','n53','n60','n67','n74']){const m=nodes.get(id);if(m?.material){m.material.map=coatMap;m.material.needsUpdate=true;}}
 skull.material.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 headP;varying vec3 headN;').replace('#include <begin_vertex>','#include <begin_vertex>\nheadP=position;headN=normal;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 headP;varying vec3 headN;').replace('#include <map_fragment>',`#include <map_fragment>
   float side=1.-smoothstep(.15,.65,headP.z);
   float stripe=smoothstep(.76,.94,sin(headP.z*18.+headP.y*7.+sin(headP.y*17.)*.24));
   vec3 sideCoat=mix(vec3(.57,.28,.085),vec3(.020,.025,.021),stripe);
   sideCoat=mix(sideCoat,vec3(.76,.73,.63),(1.-smoothstep(-.55,-.31,headP.y))*.85);
   diffuseColor.rgb=mix(diffuseColor.rgb,sideCoat,side);
   diffuseColor.rgb*=.83+.17*smoothstep(-.4,.6,dot(normalize(headN),normalize(vec3(-.3,.8,.5))));`);
 };skull.material.customProgramCacheKey=()=> 'target-tiger-head-local-coat-9';skull.material.needsUpdate=true;

 // Adult ears have a cupped rim and a recessed pale inner surface, rather than flat discs.
 for(const [id,side]of [['n15',-1],['n17',1]]){
  const ear=nodes.get(id);if(!ear)continue;
  const eg=new THREE.SphereGeometry(1,32,24);const ep=eg.attributes.position;
  for(let i=0;i<ep.count;i++){const x=ep.getX(i),y=ep.getY(i),z=ep.getZ(i);ep.setXYZ(i,side*.77+x*.185,.595+y*.20,-.43+z*.115);}
  eg.computeVertexNormals();eg.computeBoundingSphere();ear.geometry=eg;
  const old=head.getObjectByName('add:Tiger_Round_Ear_Inner_'+id);if(old)old.visible=false;
  const inner=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),new THREE.MeshBasicMaterial({color:0xd4c7ac}));inner.name='v10-cupped-ear-inner';inner.position.set(side*.77,.61,-.326);inner.scale.set(.119,.137,.028);head.add(inner);
 }
 // Amber almond eyes, dark rounded pupils and restrained brow volume.
 for(const [id,side]of [['n19',-1],['n21',1]]){
  const eye=nodes.get(id);if(!eye)continue;
  const eg=new THREE.SphereGeometry(1,32,20),ep=eg.attributes.position;
  for(let i=0;i<ep.count;i++)ep.setXYZ(i,side*.59+ep.getX(i)*.147,.09+ep.getY(i)*.080,.827+ep.getZ(i)*.057);
  eg.computeVertexNormals();eg.computeBoundingSphere();eye.geometry=eg;eye.material=new THREE.MeshBasicMaterial({color:0xc9a455});
  const pupil=head.getObjectByName('add:Tiger_Round_Pupil_'+id);if(pupil)pupil.visible=false;
  const p=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),new THREE.MeshBasicMaterial({color:0x17221f}));p.name='v10-tiger-round-pupil';p.position.set(side*.59,.09,.884);p.scale.set(.043,.051,.014);head.add(p);
  const shine=new THREE.Mesh(new THREE.SphereGeometry(.013,8,6),new THREE.MeshBasicMaterial({color:0xeee7cb}));shine.position.set(side*.59-.017,.11,.899);head.add(shine);
 }

 // Forelimbs have a shoulder, a rearward elbow and a forward-reaching wrist.
 const foreMeshes=['n53','n60'].map(id=>nodes.get(id));
 const limbRings=36,limbSides=24,limbIndices=[],limbUV=[];
 for(let i=0;i<=limbRings;i++)for(let j=0;j<=limbSides;j++){limbUV.push(j/limbSides,i/limbRings);if(i<limbRings&&j<limbSides){const a=i*(limbSides+1)+j,b=a+limbSides+1;limbIndices.push(a,b,a+1,a+1,b,b+1);}}
 for(const m of foreMeshes){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array((limbRings+1)*(limbSides+1)*3),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(limbUV,2));g.setIndex(limbIndices);m.geometry=g;}
 const forePose=(bend)=>{
  const joints=[new THREE.Vector3(0,.60-.40*bend,0),new THREE.Vector3(0,-.58,-.16-.52*bend),new THREE.Vector3(0,-1.36,.03),new THREE.Vector3(0,-1.85,.22)];
  const centerline=new THREE.CatmullRomCurve3(joints);const q=new THREE.Vector3();
  for(const m of foreMeshes){const p=m.geometry.attributes.position;
   for(let i=0;i<=limbRings;i++){const u=i/limbRings;centerline.getPoint(u,q);const r=THREE.MathUtils.lerp(.45,.19,THREE.MathUtils.smoothstep(u,.08,.82));
    for(let j=0;j<=limbSides;j++){const a=j/limbSides*Math.PI*2;p.setXYZ(i*(limbSides+1)+j,Math.cos(a)*r,q.y,q.z+Math.sin(a)*r);}}
   p.needsUpdate=true;m.geometry.computeVertexNormals();m.geometry.computeBoundingSphere();
  }
  const upper=joints[0].clone().sub(joints[1]),lower=joints[3].clone().sub(joints[1]);tiger.userData.foreElbowFlexDegrees=180-THREE.MathUtils.radToDeg(upper.angleTo(lower));
 };
 tiger.userData.updateTargetForelimbs=forePose;forePose(0);

 tiger.userData.tigerTargetRound=TIGER_TARGET_ROUND;
}
