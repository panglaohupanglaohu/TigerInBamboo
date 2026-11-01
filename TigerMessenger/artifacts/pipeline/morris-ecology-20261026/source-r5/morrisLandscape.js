import * as T from 'three';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),smooth=T.MathUtils.smoothstep;
export function createMorrisTerrain(R,edge){
 const streamPoints=[[-32,-17],[-24,-10],[-10,-1],[7,10],[24,14],[39,11],[55,3]],levels=[5,3.7,2.1,1.35,.9,.35,-.6],stream=[],course=new T.CatmullRomCurve3(streamPoints.map(([x,z])=>V(x,0,z)));
 for(let k=0;k<streamPoints.length-1;k++)for(let j=0;j<24;j++){const t=j/24,q=course.getPoint((k+t)/(streamPoints.length-1));stream.push({x:q.x,z:q.z,h:T.MathUtils.lerp(levels[k],levels[k+1],t)});}
 stream.push({x:55,z:3,h:-.6});
 const gaussian=(x,z,a,b,wx,wz)=>Math.exp(-(((x-a)/wx)**2+((z-b)/wz)**2));
 function elevation(x,z){const r=Math.hypot(x,z),u=r/edge(Math.atan2(z,x));if(u>=1)return null;const fade=1-smooth(u,.86,1);
 let h=1.65+.18*Math.sin(x*.18)*Math.cos(z*.22)+4*smooth(-z,-1,27)+2.2*gaussian(x,z,-25,-16,17,14);
 h+=Math.max(22*gaussian(x,z,-12,-41,14,9),16*gaussian(x,z,19,-39,13,10),10*gaussian(x,z,-35,-30,12,10));
 // A wide castle shoulder seats a horizontal foundation; it blends into hills.
 const pad=Math.sqrt(((x-14)/11)**2+((z+20)/9)**2),padH=Math.sqrt(167.5**2-x*x-z*z)-R,targetY=Math.sqrt(167.5**2-14**2-20**2)-R;
 if(pad<1.8){const w=1-smooth(pad,1,1.8);const plateauR=Math.sqrt(x*x+z*z+(R+targetY)**2)-R;h=T.MathUtils.lerp(h,plateauR,w);}
 let closest=Infinity,q=null;for(const p of stream){const d=(p.x-x)**2+(p.z-z)**2;if(d<closest){closest=d;q=p;}}
 const d=Math.sqrt(closest);if(d<3.3){const bed=q.h-.55,w=1-smooth(d,.8,3.3);h=T.MathUtils.lerp(h,bed,w);}
 return (h-1.65)*fade+1.65-2.4*smooth(u,.9,1);
 }
 const height=(x,z,h=elevation(x,z))=>Math.sqrt(Math.max(1,(R+(h??-.75))**2-x*x-z*z))-R;
 return{elevation,height,stream,levels,castle:{x:14,z:-20},layers:[{name:'花草坪',range:'前场径向约1.4–2m'},{name:'溪流缓丘',range:'中场约2–7m'},{name:'城堡山肩',range:'城基径向7.5m'},{name:'背景高山',range:'主峰径向约27m'}]};
}
function mesh(root,g,color,name){const m=new T.Mesh(g,new T.MeshStandardMaterial({color,roughness:.96,side:T.DoubleSide}));m.name=name;root.add(m);m.castShadow=true;m.receiveShadow=true;return m;}
function box(root,p,size,color,name){const m=mesh(root,new T.BoxGeometry(...size),color,name);m.position.set(...p);return m;}
function roof(root,x,y,z,w,d,h,color){const p=[-w/2,0,-d/2,w/2,0,-d/2,0,h,-d/2,-w/2,0,d/2,w/2,0,d/2,0,h,d/2],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4]);g.computeVertexNormals();const m=mesh(root,g,color,'castle-handcrafted-gable-roof');m.position.set(x,y,z);}
export function installMorrisLandscape({root,terrain,heightAt,R}){
 const waterP=[],waterI=[],bankP=[],bankI=[],stream=terrain.stream;
 for(let i=0;i<stream.length;i++){const p=stream[i],a=stream[Math.max(0,i-1)],b=stream[Math.min(stream.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;for(const s of [-1,1]){const x=p.x+nx*s*1.1,z=p.z+nz*s*1.1;waterP.push(x,terrain.height(x,z,p.h)+.025,z);bankP.push(p.x+nx*s*1.65,heightAt(p.x+nx*s*1.65,p.z+nz*s*1.65)+.03,p.z+nz*s*1.65);}if(i<stream.length-1){const n=i*2;waterI.push(n,n+2,n+1,n+1,n+2,n+3);bankI.push(n,n+2,n+1,n+1,n+2,n+3);}}
 const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(waterP,3));wg.setIndex(waterI);wg.computeVertexNormals();const water=mesh(root,wg,0x447e87,'morris-real-downhill-creek');water.material.roughness=.35;water.material.metalness=.1;water.castShadow=false;
 // Three-dimensional travelling ripple strokes; no global ocean alteration.
 const ripples=[];for(let i=0;i<24;i++){const line=mesh(root,new T.BoxGeometry(.6,.018,.07),0xb5d3be,'creek-moving-ripple');line.castShadow=false;ripples.push(line);}
 const bridge=new T.Group();bridge.name='morris-creek-stone-arch-bridge';const p=stream[75],a=stream[74],b=stream[76],angle=Math.atan2(-(b.z-a.z),b.x-a.x);bridge.position.set(p.x,terrain.height(p.x,p.z,p.h)+1.2,p.z);bridge.rotation.y=angle;root.add(bridge);
 const ends=[-4,4].map(z=>{const x=p.x+Math.sin(angle)*z,zz=p.z+Math.cos(angle)*z;return heightAt(x,zz)+.035-bridge.position.y;});
 const deckY=z=>T.MathUtils.lerp(ends[0],ends[1],(z+4)/8)+.35*Math.cos(z/4*Math.PI/2);
 const dp=[],di=[];for(let i=0;i<=24;i++){const z=-4+i/3,y=deckY(z);for(const x of[-1.6,1.6])dp.push(x,y,z);if(i<24){const n=i*2;di.push(n,n+2,n+1,n+1,n+2,n+3);}}
 const dg=new T.BufferGeometry();dg.setAttribute('position',new T.Float32BufferAttribute(dp,3));dg.setIndex(di);dg.computeVertexNormals();const deck=mesh(bridge,dg,0xc4ad80,'stone-bridge-walkable-deck');
 for(const x of[-1.78,1.78]){const pts=[];for(let j=0;j<=24;j++){const z=-4+j/3;pts.push(V(x,deckY(z)+.7,z));}mesh(bridge,new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.22,7,false),0xb9a37d,'bridge-low-stone-parapet');for(const z of[-3.3,3.3])box(bridge,[x,-.65,z],[.5,1.7,.9],0xb9a37d,'bridge-bank-footing');}
 // Farm gate remains open and leaves a clear central passage.
 const gate=new T.Group();gate.name='morris-farm-open-gate';gate.position.set(p.x,heightAt(p.x,p.z+6),p.z+6);root.add(gate);for(const x of[-2.4,2.4]){box(gate,[x,1,0],[.5,2,.5],0xc6b38a,'gate-stone-post');const ball=mesh(gate,new T.SphereGeometry(.34,10,7),0xbca578,'gate-stone-finial');ball.position.set(x,2.14,0);for(const y of[.45,1,1.5]){const rail=box(gate,[x+(x>0?1:-1),y,.6],[2,.11,.12],0x78613e,'farm-open-wood-rail');rail.rotation.y=x>0?-.6:.6;}}
 const castle=new T.Group();castle.name='morris-hillside-cream-stone-castle';const c=terrain.castle;castle.position.set(c.x,heightAt(c.x,c.z)+.025,c.z);root.add(castle);
 box(castle,[0,.2,0],[14,.4,10],0xb9aa88,'castle-low-foundation');for(const[x,z,w,d,h]of[[0,0,5.2,5,11],[-4,1,4,5,6],[4,1.5,4.2,4.8,7],[0,-3,4.6,3.5,8]]){box(castle,[x,h/2+.4,z],[w,h,d],0xd3c09a,'castle-limestone-wing');roof(castle,x,h+.4,z,w+.7,d+.7,h>9?4:1.5,0x995c43);for(let j=0;j<Math.floor(h/2);j++)for(const side of[-1,1]){box(castle,[x+side*w*.26,1.7+j*2,z+d/2+.015],[.38,.75,.045],0x465957,'castle-recessed-window');}}
 box(castle,[0,1.2,2.54],[1.2,1.6,.05],0x66563c,'castle-timber-door');
 const supports=[deck];root.updateWorldMatrix(true,true);
 return{water,bridge,deck,gate,castle,supports,report:{layers:terrain.layers,stream:'authored descending radial levels, carved real bed',streamLevels:terrain.levels,bridge:'real curved deck and stone parapets',farmGate:'open wooden rails between stone posts',castle:'cream stone keep and offset wings with russet gables',wholeNavigationVerified:false},update(t){ripples.forEach((m,i)=>{const q=stream[Math.floor((t*7+i*6)%stream.length)];m.position.set(q.x,terrain.height(q.x,q.z,q.h)+.045,q.z);m.rotation.y=Math.sin(i)*.3;});}};
}
