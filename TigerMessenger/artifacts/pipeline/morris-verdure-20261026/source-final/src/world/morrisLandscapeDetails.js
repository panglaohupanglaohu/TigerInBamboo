import * as T from 'three';
import {mergeGeometries}from'three/addons/utils/BufferGeometryUtils.js';
// Bridge remains tied to the existing walkable deck; stone is real geometry.
export function dressMorrisBridge({bridge,deckY}){
 const buckets=new Map();function add(g,color,name){g.deleteAttribute('uv');if(!buckets.has(color))buckets.set(color,{name,geos:[]});buckets.get(color).geos.push(g);}
 for(const m of [...bridge.children])if(m.name==='bridge-low-stone-parapet'){bridge.remove(m);m.geometry.dispose();m.material.dispose();}
 const archBottom=z=>deckY(0)-.72-1.5*(z/3.8)**2;
 for(const side of[-1,1]){const x=side*1.65,p=[],ix=[];for(let j=0;j<=24;j++){const z=-3.8+j/24*7.6;p.push(x,archBottom(z),z,x,deckY(z)-.06,z);if(j<24){const n=j*2;ix.push(n,n+1,n+2,n+1,n+3,n+2);}}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();add(g,0xbda780,'bridge-stone-arch-spandrels');
  // Solid parapet, built as two adjoining longitudinal courses and separate caps.
  for(let j=0;j<20;j++){const z=-3.8+(j+.5)*7.6/20,y=deckY(z);for(let row=0;row<2;row++){const block=new T.BoxGeometry(.38,.29,.36);block.translate(side*1.78,y+.2+row*.3,z);add(block,row?0xbfa780:0xab9877,'bridge-mortared-parapet-courses');}const cap=new T.BoxGeometry(.49,.12,.39);cap.translate(side*1.78,y+.76,z);add(cap,0xd0b98f,'bridge-flat-stone-coping');}
  // Voussoirs follow the actual arch rather than a straight plank silhouette.
  for(let j=0;j<18;j++){const z=-3.6+(j+.5)*7.2/18,y=archBottom(z)+.18,block=new T.BoxGeometry(.12,.38,.37);block.rotateX(Math.atan(-3*z/3.8**2));block.translate(side*1.72,y,z);add(block,j%3===0?0xcdbc99:0xa99575,'bridge-radial-arch-stones');}}
 const p=[],ix=[];for(let j=0;j<=24;j++){const z=-3.8+j/24*7.6;for(const x of[-1.65,1.65])p.push(x,archBottom(z),z);if(j<24){const n=j*2;ix.push(n,n+2,n+1,n+1,n+2,n+3);}}const barrel=new T.BufferGeometry();barrel.setAttribute('position',new T.Float32BufferAttribute(p,3));barrel.setIndex(ix);barrel.computeVertexNormals();add(barrel,0x9d8e73,'bridge-arched-stone-barrel');
 for(const[color,b]of buckets){const g=mergeGeometries(b.geos,false);b.geos.forEach(g=>g.dispose());const m=new T.Mesh(g,new T.MeshStandardMaterial({color,roughness:.89,side:T.DoubleSide}));m.name=b.name;m.castShadow=m.receiveShadow=true;bridge.add(m);}
 return{archBarrel:true,solidParapets:true,archStones:36,mergedStoneBatches:buckets.size};
}
function weatheredRockGeometry(){const p=[],c=[],ix=[],rings=[[-1,.42],[-.85,.8],[-.42,1],[.15,.98],[.65,.8],[1.04,.2]],rock=new T.Color(0xa8a18c),dark=new T.Color(0x7e8370),grass=new T.Color(0x7a8450);for(let j=0;j<rings.length;j++)for(let k=0;k<12;k++){const a=k/12*Math.PI*2,r=rings[j][1]*(1+.09*Math.sin(k*2.3+j*.4));p.push(Math.cos(a)*r,rings[j][0]+.045*Math.sin(k*2+j),Math.sin(a)*r);const col=dark.clone().lerp(rock,.35+.3*(Math.sin(k*1.8+j*.3)+1)/2).lerp(grass,j===5?.36:0);c.push(col.r,col.g,col.b);if(j<rings.length-1){const n=j*12+k,b=j*12+(k+1)%12;ix.push(n,n+12,b,b,n+12,b+12);}}const top=p.length/3;p.push(0,1.08,0);c.push(grass.r,grass.g,grass.b);for(let k=0;k<12;k++)ix.push(top,(rings.length-1)*12+(k+1)%12,(rings.length-1)*12+k);const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(c,3));g.setIndex(ix);g.computeVertexNormals();return g;}
export function installMorrisRockShoulders({root,heightAt,canDress=()=>true}){
 const points=[];for(const[x,z,s]of[[-9,-9,3.7],[-16,-7,3],[-5,-17,2.7],[0,-10,2.5],[-20,-16,2.8],[-10,3,2.2],[-25,-4,2],[-17,6,1.8]])if(canDress(x,z))points.push({x,z,s});
 const mesh=new T.InstancedMesh(weatheredRockGeometry(),new T.MeshStandardMaterial({vertexColors:true,roughness:.97}),points.length),d=new T.Object3D();mesh.name='morris-embedded-weathered-central-rock-shoulders';points.forEach((p,i)=>{d.position.set(p.x,heightAt(p.x,p.z)+p.s*.06,p.z);d.rotation.set(.1*Math.sin(i),i*2.1,.1*Math.cos(i));d.scale.set(p.s,p.s*.85,p.s*.8);d.updateMatrix();mesh.setMatrixAt(i,d.matrix);});mesh.computeBoundingSphere();mesh.castShadow=mesh.receiveShadow=true;root.add(mesh);return{mesh,count:points.length};
}
