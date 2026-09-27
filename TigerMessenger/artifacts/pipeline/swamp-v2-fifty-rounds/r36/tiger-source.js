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
  });tiger.userData.swampTigerV2Coat=true;
 });
}
