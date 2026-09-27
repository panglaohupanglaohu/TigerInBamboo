import * as THREE from 'three';

// Small repeatable hand-authored metal wear maps, no external texture dependency.
export function wornMetal(color,kind='paint'){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');
 c.fillStyle='#d5d5d5';c.fillRect(0,0,256,256);let seed=kind==='rust'?127:751;
 const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let i=0;i<6000;i++){const x=rnd()*256,y=rnd()*256,v=130+Math.floor(rnd()*100);c.fillStyle=`rgba(${v},${v},${v},${.05+rnd()*.22})`;c.fillRect(x,y,1+rnd()*5,1+rnd()*3);}
 for(let i=0;i<(kind==='rust'?110:85);i++){const x=rnd()*256,y=rnd()*256,r=1+rnd()*(kind==='rust'?17:3);c.filter=kind==='rust'?'blur(2px)':'none';c.fillStyle=kind==='rust'?`rgba(59,39,25,${.035+rnd()*.095})`:`rgba(47,49,44,${.1+rnd()*.3})`;c.beginPath();for(let j=0;j<7;j++){const a=j*Math.PI/3.5,rr=r*(.4+rnd()*.6);c.lineTo(x+Math.cos(a)*rr,y+Math.sin(a)*rr);}c.closePath();c.fill();}
 c.filter='none';
 for(let i=0;i<100;i++){const x=rnd()*256,y=rnd()*256;c.strokeStyle='rgba(241,226,188,.32)';c.lineWidth=.4+rnd()*.5;c.beginPath();c.moveTo(x,y);c.lineTo(x+1+rnd()*7,y+rnd()*2);c.stroke();}
 const map=new THREE.CanvasTexture(canvas);map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;map.repeat.set(1.6,1.6);map.anisotropy=4;
 return new THREE.MeshStandardMaterial({color,map,roughness:kind==='rust'?.8:.56,metalness:kind==='rust'?.42:.35});
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
 const g=new THREE.SphereGeometry(1,24,14,phi0,phiLength,theta0,thetaLength),m=new THREE.Mesh(g,material);m.position.set(...center);m.scale.set(...scale);m.castShadow=true;m.receiveShadow=true;root.add(m);return m;
}
