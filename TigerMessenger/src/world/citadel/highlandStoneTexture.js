import * as THREE from 'three';
// Deterministic mineral wash, created locally; no external image/model service.
export function highlandStoneTexture(){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle='#f5f2e8';ctx.fillRect(0,0,512,512);
 let seed=38457;const random=()=>((seed=(seed*1664525+1013904223)>>>0)/4294967296);
 for(let i=0;i<2400;i++){ctx.fillStyle=i%3?'rgba(132,112,77,.023)':'rgba(255,255,255,.09)';ctx.beginPath();ctx.ellipse(random()*512,random()*512,1+random()*14,1+random()*5,random()*6,0,Math.PI*2);ctx.fill();}
 const pixels=ctx.getImageData(0,0,512,512);for(let i=0;i<pixels.data.length;i+=4){const grain=(random()-.5)*8;for(let c=0;c<3;c++)pixels.data[i+c]+=grain;}ctx.putImageData(pixels,0,0);
 const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.anisotropy=4;texture.name='highland-limestone-mineral-wash';return texture;
}
export function stoneProjectionUV(geometry){const p=geometry.attributes.position,n=geometry.attributes.normal,uv=[];for(let i=0;i<p.count;i++){const nx=Math.abs(n.getX(i)),ny=Math.abs(n.getY(i)),nz=Math.abs(n.getZ(i));uv.push((nx>nz?p.getZ(i):p.getX(i))/6,(ny>.7?p.getZ(i):p.getY(i))/6);}geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));}
