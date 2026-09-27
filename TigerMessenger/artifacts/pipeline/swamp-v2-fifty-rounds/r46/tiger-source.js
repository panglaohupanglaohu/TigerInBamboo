import * as THREE from 'three';
// An opt-in V2 coat on the existing articulated tiger. Original Blender data stays intact.
export function applySwampTigerV2(tiger){
 if(tiger.userData.swampTigerV2Ready)return;
 tiger.userData.swampTigerV2Ready=Promise.resolve(tiger.userData.tigerAnatomy?.ready).then(()=>{
  const materials=new Map(),textures=new Map();
  tiger.traverse(node=>{
   if(!node.isMesh||node.userData.isOutline)return;
   const recolor=source=>{
    if(materials.has(source))return materials.get(source);
    let result=source;
    if(/Tiger_V3_.*(Pattern|Striped)/.test(source.name)&&source.map?.image){
     let map=textures.get(source.map);
     if(!map){const img=source.map.image,canvas=document.createElement('canvas');canvas.width=img.width;canvas.height=img.height;const ctx=canvas.getContext('2d');ctx.drawImage(img,0,0);const pixels=ctx.getImageData(0,0,img.width,img.height);
      for(let i=0;i<pixels.data.length;i+=4){const mix=THREE.MathUtils.smoothstep(pixels.data[i],10,43);for(let c=0;c<3;c++)pixels.data[i+c]=Math.round([25,30,31][c]*(1-mix)+[198,127,58][c]*mix);}
      ctx.putImageData(pixels,0,0);map=new THREE.CanvasTexture(canvas);map.flipY=source.map.flipY;map.wrapS=source.map.wrapS;map.wrapT=source.map.wrapT;map.repeat.copy(source.map.repeat);map.offset.copy(source.map.offset);map.colorSpace=THREE.SRGBColorSpace;textures.set(source.map,map);
     }
     result=new THREE.MeshBasicMaterial({map,color:0xffffff,side:source.side,fog:false});result.name='V2_'+source.name;
    }else if(source.name==='Tiger_V3_Ivory'){result=new THREE.MeshBasicMaterial({color:0xeee6d0,side:source.side,fog:false});result.name='V2_Ivory';}
    materials.set(source,result);return result;
   };
   node.material=Array.isArray(node.material)?node.material.map(recolor):recolor(node.material);
  });
  const byId=new Map();tiger.traverse(n=>{if(n.userData.blenderSourceNode)byId.set(n.userData.blenderSourceNode,n);});
  const head=byId.get('n8');if(head)head.scale.multiplyScalar(.86);
  for(const id of ['n2','n6']){
   const mesh=byId.get(id);if(!mesh?.geometry)continue;mesh.geometry=mesh.geometry.clone();const p=mesh.geometry.attributes.position,colors=[];
   for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),muscle=id==='n2'?1.05-.12*Math.exp(-Math.pow((z+.4)/.8,2)):1.08;p.setXYZ(i,x*muscle,id==='n6'?y*.88:y,z*(id==='n2'?1.1:1));const c=.66+.34*THREE.MathUtils.smoothstep(y,-1,1.2);colors.push(c,c,c);}
   p.needsUpdate=true;mesh.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere();mesh.material=mesh.material.clone();mesh.material.vertexColors=true;
  }
  // Adult face: compact almond eyes, a lower forehead and paired whisker pads.
  const edit=(id,fn)=>{const m=byId.get(id);if(!m?.geometry)return;m.geometry=m.geometry.clone();const p=m.geometry.attributes.position;for(let i=0;i<p.count;i++)fn(p,i);p.needsUpdate=true;m.geometry.computeVertexNormals();m.geometry.computeBoundingSphere();return m;};
  edit('n9',(p,i)=>{const y=p.getY(i);if(y>0){p.setY(i,y*.82);p.setX(i,p.getX(i)*.95);}});
  for(const [id,side]of [['n19',-1],['n21',1]]){
   const eye=edit(id,(p,i)=>{p.setX(i,side*.59+(p.getX(i)-side*.59)*.7);p.setY(i,.09+(p.getY(i)-.09)*.55);});if(eye)eye.material=new THREE.MeshBasicMaterial({color:0xb68b3f,fog:false});
   const brow=byId.get('add:Tiger_Heavy_Brow_'+id);if(brow){brow.geometry=brow.geometry.clone();brow.geometry.computeBoundingBox();const c=brow.geometry.boundingBox.getCenter(new THREE.Vector3());brow.geometry.translate(-c.x,-c.y,-c.z).scale(.8,.38,.65).translate(c.x,c.y-.035,c.z-.10);}
   const pupil=byId.get('add:Tiger_Round_Pupil_'+id);if(pupil){pupil.geometry=pupil.geometry.clone();pupil.geometry.computeBoundingBox();const c=pupil.geometry.boundingBox.getCenter(new THREE.Vector3());pupil.geometry.translate(-c.x,-c.y,-c.z).scale(.5,.55,1).translate(c.x,c.y,c.z);}
  }
  const bridge=byId.get('add:Tiger_Broad_Nasal_Bridge');if(bridge)bridge.material=new THREE.MeshBasicMaterial({color:0xb68148,fog:false});
  const muzzle=byId.get('n23');if(muzzle){muzzle.geometry=muzzle.geometry.clone();muzzle.geometry.scale(.9,.85,1);}
  if(head)for(const side of [-1,1]){const pad=new THREE.Mesh(new THREE.SphereGeometry(1,16,10),new THREE.MeshBasicMaterial({color:0xeee6d0,fog:false}));pad.scale.set(.29,.20,.22);pad.position.set(side*.24,-.37,1.18);pad.name='v2-tiger-whisker-pad';head.add(pad);}
  // Upper-leg mass, narrow wrists and bent hind hocks; retain all four animated pivots.
  for(const id of ['n53','n60','n67','n74']){
   edit(id,(p,i)=>{const y=p.getY(i),rear=id==='n67'||id==='n74',muscle=rear?.72+.52*THREE.MathUtils.smoothstep(y,-1.3,.5):.72+.4*THREE.MathUtils.smoothstep(y,-1.5,.4);p.setX(i,p.getX(i)*muscle);if(rear)p.setZ(i,p.getZ(i)-.20*Math.exp(-Math.pow((y+1.1)/.4,2))+.12*THREE.MathUtils.smoothstep(y,-.5,.5));else p.setZ(i,p.getZ(i)*muscle);});
  }
  for(const id of ['n55','n62','n69','n76']){
   const paw=edit(id,(p,i)=>{p.setX(i,p.getX(i)*.84);p.setZ(i,.22+(p.getZ(i)-.22)*.86);});if(!paw)continue;
   const p=paw.geometry.attributes.position,colors=[];for(let i=0;i<p.count;i++){const c=new THREE.Color(0xe4d9bd).lerp(new THREE.Color(0xc18a4b),THREE.MathUtils.smoothstep(p.getY(i),-2.09,-1.83));colors.push(c.r,c.g,c.b);}paw.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));paw.material=new THREE.MeshBasicMaterial({vertexColors:true,fog:false});
  }
  // Pale throat and belly remain part of the skin, not separate white armour pieces.
  for(const id of ['n2','n6']){const mesh=byId.get(id);if(!mesh)continue;mesh.material.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vTigerSkin;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTigerSkin=position;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vTigerSkin;').replace('#include <color_fragment>',`#include <color_fragment>
    float belly=1.-smoothstep(-.82,-.35,vTigerSkin.y);
    float throat=smoothstep(1.7,2.3,vTigerSkin.z)*(1.-smoothstep(-.3,.35,vTigerSkin.y));
    diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.77,.72,.60),max(belly,throat)*.9);`);
  };mesh.material.customProgramCacheKey=()=> 'swamp-tiger-belly-40';}
  for(const id of ['n47','n50']){const tip=byId.get(id);if(tip)tip.material=new THREE.MeshBasicMaterial({color:0x222b2b,fog:false});}
  // Muzzle relief: a defined chin, lip cleft and shaded whisker pads.
  const chin=byId.get('add:Tiger_Ivory_Chin');if(chin){chin.geometry=chin.geometry.clone();chin.geometry.computeBoundingBox();const c=chin.geometry.boundingBox.getCenter(new THREE.Vector3());chin.geometry.translate(-c.x,-c.y,-c.z).scale(.8,.55,.84).translate(c.x,c.y+.045,c.z);}
  if(head){
   const lipMat=new THREE.LineBasicMaterial({color:0x37372f,fog:false});
   for(const pts of [[[0,-.36,1.4],[0,-.48,1.405]], [[-.34,-.47,1.34],[-.18,-.52,1.40],[0,-.48,1.405],[.18,-.52,1.40],[.34,-.47,1.34]]]){const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts.map(p=>new THREE.Vector3(...p))),lipMat);line.name='v2-tiger-lip';head.add(line);}
   head.traverse(n=>{if(!n.isMesh||n.name!=='v2-tiger-whisker-pad')return;const p=n.geometry.attributes.position,colors=[];for(let i=0;i<p.count;i++){const shade=.7+.3*THREE.MathUtils.smoothstep(p.getY(i),-1,.8);colors.push(shade,shade,shade);}n.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));n.material=n.material.clone();n.material.vertexColors=true;});
  }

  // Small, cupped tiger ears with pale inner fur instead of upright black discs.
  for(const id of ['n15','n17']){
   const ear=byId.get(id);if(!ear)continue;ear.geometry=ear.geometry.clone();ear.geometry.computeBoundingBox();const c=ear.geometry.boundingBox.getCenter(new THREE.Vector3());
   for(const n of [ear,byId.get('add:Tiger_Round_Ear_Inner_'+id)]){if(!n?.geometry)continue;n.geometry=n.geometry.clone();const p=n.geometry.attributes.position;for(let i=0;i<p.count;i++){p.setX(i,c.x+(p.getX(i)-c.x)*.87);p.setY(i,c.y+(p.getY(i)-c.y)*.72-.075);}p.needsUpdate=true;n.geometry.computeVertexNormals();n.geometry.computeBoundingSphere();}
   const inner=byId.get('add:Tiger_Round_Ear_Inner_'+id);if(inner){const p=inner.geometry.attributes.position,col=[];for(let i=0;i<p.count;i++){const shade=.5+.5*THREE.MathUtils.smoothstep(p.getY(i),c.y-.2,c.y+.12);const color=new THREE.Color(0xc0a88d).multiplyScalar(shade);col.push(color.r,color.g,color.b);}inner.geometry.setAttribute('color',new THREE.Float32BufferAttribute(col,3));inner.material=new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide,fog:false});}
  }

  // Cheek ruff follows the jaw in overlapping fur lobes rather than a spherical face edge.
  if(head)for(const side of [-1,1]){
   const old=byId.get(side<0?'n11':'n13');if(old)old.visible=false;
   for(let j=0;j<4;j++){
    const g=new THREE.SphereGeometry(1,14,10),p=g.attributes.position,col=[];
    for(let i=0;i<p.count;i++){const y=p.getY(i),x=p.getX(i),z=p.getZ(i);p.setXYZ(i,x*(.14+j*.014),y*(.28-j*.018),z*.18);const c=new THREE.Color(j===0?0xc48b4f:0xded9c5).multiplyScalar(.73+.27*THREE.MathUtils.smoothstep(y,-1,.7));col.push(c.r,c.g,c.b);}
    g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));g.computeVertexNormals();const fur=new THREE.Mesh(g,new THREE.MeshBasicMaterial({vertexColors:true,fog:false}));fur.name='v2-tiger-cheek-ruff';fur.position.set(side*(.80+j*.027),-.08-j*.13,.33+j*.055);fur.rotation.z=side*.35;head.add(fur);
   }
  }

  // Unequal tapered and forked flank stripes, drawn in the existing torso UVs.
  const skin=byId.get('n2')?.material.map;
  if(skin){
   const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle='#c67f3a';ctx.fillRect(0,0,1024,512);ctx.fillStyle='#202727';
   for(let j=-1;j<19;j++){
    const phase=j*1.731,base=j*59+8*Math.sin(j*4.1),height=512,width=8+6*(.5+.5*Math.sin(j*2.4));
    const center=v=>base+12*Math.sin(v*.009+phase)+7*Math.sin(v*.019+phase*.4);
    ctx.beginPath();for(let y=0;y<=height;y+=4){const taper=.28+.72*Math.pow(Math.abs(Math.sin(y/height*Math.PI+phase*.15)),.65);ctx.lineTo(center(y)-width*taper,y);}for(let y=height;y>=0;y-=4){const taper=.28+.72*Math.pow(Math.abs(Math.sin(y/height*Math.PI+phase*.15)),.65);ctx.lineTo(center(y)+width*taper,y);}ctx.closePath();ctx.fill();
    if(j%3!==0){const y=130+(j*71%250);ctx.beginPath();ctx.moveTo(center(y),y);ctx.bezierCurveTo(center(y)+25,y+18,center(y+90)+25,y+75,center(y+110)+20,y+110);ctx.bezierCurveTo(center(y+90)+18,y+72,center(y)+9,y+20,center(y)-3,y+12);ctx.closePath();ctx.fill();}
   }
   const map=new THREE.CanvasTexture(canvas);map.flipY=skin.flipY;map.wrapS=skin.wrapS;map.wrapT=skin.wrapT;map.repeat.copy(skin.repeat);map.offset.copy(skin.offset);map.colorSpace=THREE.SRGBColorSpace;for(const id of ['n2','n6']){const m=byId.get(id);if(m){m.material.map=map;m.material.needsUpdate=true;}}
  }

  // Restrained ink-and-flat-colour facial planes make cheekbones and nose readable.
  for(const id of ['n9','n23','n25','add:Tiger_Broad_Nasal_Bridge']){
   const m=byId.get(id);if(!m?.isMesh)continue;m.material=m.material.clone();m.material.onBeforeCompile=shader=>{
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vTigerFaceNormal;').replace('#include <begin_vertex>','#include <begin_vertex>\nvTigerFaceNormal=normalize(normal);');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vTigerFaceNormal;').replace('#include <color_fragment>',`#include <color_fragment>
     float lightPlane=dot(normalize(vTigerFaceNormal),normalize(vec3(-.35,.65,.7)));
     diffuseColor.rgb*=.7+.3*smoothstep(-.12,.45,lightPlane);`);
   };m.material.customProgramCacheKey=()=> 'swamp-tiger-face-planes-46';
  }

  tiger.userData.refreshTigerFootGeometry?.();
  tiger.userData.swampTigerV2Coat=true;
 });
}
