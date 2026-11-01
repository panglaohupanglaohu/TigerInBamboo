import * as T from 'three';
import {createMorrisCastle} from './morrisCastle.js?v=morris-tall-r14';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),smooth=T.MathUtils.smoothstep;
export function createMorrisTerrain(R,edge){
 const streamPoints=[[-20,-10],[-24,0],[-22,12],[-12,24],[8,32],[28,31],[55,16]],levels=[10.2,7.2,4.9,3.2,2.3,1.2,-.6],stream=[],course=new T.CatmullRomCurve3(streamPoints.map(([x,z])=>V(x,0,z)));
 for(let k=0;k<streamPoints.length-1;k++)for(let j=0;j<24;j++){const t=j/24,q=course.getPoint((k+t)/(streamPoints.length-1));stream.push({x:q.x,z:q.z,h:T.MathUtils.lerp(levels[k],levels[k+1],t)});}
 stream.push({x:55,z:16,h:-.6});
 const gaussian=(x,z,a,b,wx,wz)=>Math.exp(-(((x-a)/wx)**2+((z-b)/wz)**2));
 function elevation(x,z){const r=Math.hypot(x,z),u=r/edge(Math.atan2(z,x));if(u>=1)return null;const fade=1-smooth(u,.86,1);
 let h=1.65+.14*Math.sin(x*.18)*Math.cos(z*.22)+5.2*Math.exp(-(x*x+z*z)/(32*32));
 h+=Math.max(20*gaussian(x,z,-8,-8,12,11),12*gaussian(x,z,12,-10,14,10),8*gaussian(x,z,-24,0,10,16));
 // A shared level music court joins the castle shoulder, away from the railway.
 const court=Math.sqrt(((x-24)/8)**2+((z-11)/7)**2),courtY=Math.sqrt(170.5**2-14**2-5**2)-R;
 if(court<1.9){const w=1-smooth(court,1,1.9),planeR=Math.sqrt(x*x+z*z+(R+courtY)**2)-R;h=T.MathUtils.lerp(h,planeR,w);}
 // A wide castle shoulder seats a horizontal foundation; it blends into hills.
 const pad=Math.sqrt(((x-14)/11)**2+((z-5)/9)**2),padH=Math.sqrt(170.5**2-x*x-z*z)-R,targetY=Math.sqrt(170.5**2-14**2-5**2)-R;
 if(pad<1.8){const w=1-smooth(pad,1,1.8);const plateauR=Math.sqrt(x*x+z*z+(R+targetY)**2)-R;h=T.MathUtils.lerp(h,plateauR,w);}
 let closest=Infinity,q=null;for(const p of stream){const d=(p.x-x)**2+(p.z-z)**2;if(d<closest){closest=d;q=p;}}
 const d=Math.sqrt(closest);if(d<3.3){const bed=q.h-.55,w=1-smooth(d,.8,3.3);h=T.MathUtils.lerp(h,bed,w);}
 return (h-1.65)*fade+1.65-2.4*smooth(u,.9,1);
 }
 const height=(x,z,h=elevation(x,z))=>Math.sqrt(Math.max(1,(R+(h??-.75))**2-x*x-z*z))-R;
 return{elevation,height,stream,levels,castle:{x:14,z:5},layers:[{name:'外圈花草坪',range:'外围低地径向约1.4–4m'},{name:'环绕溪流缓丘',range:'中圈约4–9m'},{name:'中央山肩城堡',range:'城基径向10.5m'},{name:'中央错位主峰',range:'主峰径向约26m；四周连续降低'}]};
}
function mesh(root,g,color,name){const m=new T.Mesh(g,new T.MeshStandardMaterial({color,roughness:.96,side:T.DoubleSide}));m.name=name;root.add(m);m.castShadow=true;m.receiveShadow=true;return m;}
function box(root,p,size,color,name){const m=mesh(root,new T.BoxGeometry(...size),color,name);m.position.set(...p);return m;}
function roof(root,x,y,z,w,d,h,color){const p=[-w/2,0,-d/2,w/2,0,-d/2,0,h,-d/2,-w/2,0,d/2,w/2,0,d/2,0,h,d/2],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4]);g.computeVertexNormals();const m=mesh(root,g,color,'castle-handcrafted-gable-roof');m.position.set(x,y,z);}
export function installMorrisLandscape({root,terrain,heightAt,R,pathX=()=>10}){
 const waterP=[],waterI=[],bankP=[],bankI=[],stream=terrain.stream;
 for(let i=0;i<stream.length;i++){const p=stream[i],a=stream[Math.max(0,i-1)],b=stream[Math.min(stream.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;for(const s of [-1,1]){const x=p.x+nx*s*1.1,z=p.z+nz*s*1.1;waterP.push(x,terrain.height(x,z,p.h)+.025,z);bankP.push(p.x+nx*s*1.65,heightAt(p.x+nx*s*1.65,p.z+nz*s*1.65)+.03,p.z+nz*s*1.65);}if(i<stream.length-1){const n=i*2;waterI.push(n,n+2,n+1,n+1,n+2,n+3);bankI.push(n,n+2,n+1,n+1,n+2,n+3);}}
 const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(waterP,3));wg.setIndex(waterI);wg.computeVertexNormals();const water=mesh(root,wg,0x447e87,'morris-real-downhill-creek');water.material.roughness=.35;water.material.metalness=.1;water.castShadow=false;
 // Three-dimensional travelling ripple strokes; no global ocean alteration.
 const ripples=[];for(let i=0;i<24;i++){const line=mesh(root,new T.BoxGeometry(.6,.018,.07),0xb5d3be,'creek-moving-ripple');line.castShadow=false;ripples.push(line);}
 const bridge=new T.Group();bridge.name='morris-creek-stone-arch-bridge';const crossing=stream.map((q,k)=>({k,d:q.z>20?Math.abs(q.x-pathX(q.z)):Infinity})).sort((a,b)=>a.d-b.d)[0].k,p=stream[crossing],a=stream[Math.max(0,crossing-1)],b=stream[Math.min(stream.length-1,crossing+1)],angle=Math.atan2(-(b.z-a.z),b.x-a.x);bridge.position.set(p.x,terrain.height(p.x,p.z,p.h)+1.2,p.z);bridge.rotation.y=angle;root.add(bridge);
 const ends=[-4,4].map(z=>{const x=p.x+Math.sin(angle)*z,zz=p.z+Math.cos(angle)*z;return heightAt(x,zz)+.035-bridge.position.y;});
 const deckY=z=>T.MathUtils.lerp(ends[0],ends[1],(z+4)/8)+.35*Math.cos(z/4*Math.PI/2);
 const dp=[],di=[];for(let i=0;i<=24;i++){const z=-4+i/3,y=deckY(z);for(const x of[-1.6,1.6])dp.push(x,y,z);if(i<24){const n=i*2;di.push(n,n+2,n+1,n+1,n+2,n+3);}}
 const dg=new T.BufferGeometry();dg.setAttribute('position',new T.Float32BufferAttribute(dp,3));dg.setIndex(di);dg.computeVertexNormals();const deck=mesh(bridge,dg,0xc4ad80,'stone-bridge-walkable-deck');
 for(const x of[-1.78,1.78]){const pts=[];for(let j=0;j<=24;j++){const z=-4+j/3;pts.push(V(x,deckY(z)+.7,z));}mesh(bridge,new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.22,7,false),0xb9a37d,'bridge-low-stone-parapet');for(const z of[-3.3,3.3])box(bridge,[x,-.65,z],[.5,1.7,.9],0xb9a37d,'bridge-bank-footing');}
 // Farm gate remains open and leaves a clear central passage.
 const gate=new T.Group();gate.name='morris-farm-open-gate';gate.position.set(pathX(p.z+6),heightAt(pathX(p.z+6),p.z+6),p.z+6);root.add(gate);for(const x of[-2.4,2.4]){box(gate,[x,1,0],[.5,2,.5],0xc6b38a,'gate-stone-post');const ball=mesh(gate,new T.SphereGeometry(.34,10,7),0xbca578,'gate-stone-finial');ball.position.set(x,2.14,0);for(const y of[.45,1,1.5]){const rail=box(gate,[x+(x>0?1:-1),y,.6],[2,.11,.12],0x78613e,'farm-open-wood-rail');rail.rotation.y=x>0?-.6:.6;}}
 const rockPoints=[];for(let i=6;i<stream.length-5;i+=5){const p=stream[i],a=stream[i-1],b=stream[i+1],d=Math.hypot(b.x-a.x,b.z-a.z)||1;for(const side of[-1,1]){const x=p.x-(b.z-a.z)/d*side*1.75,z=p.z+(b.x-a.x)/d*side*1.75;if(Math.abs(x-pathX(z))<3.8)continue;rockPoints.push({x,z,i,side});}}
 const creekStones=new T.InstancedMesh(new T.DodecahedronGeometry(1,0),new T.MeshStandardMaterial({color:0xb8b09b,roughness:1}),rockPoints.length),rockDummy=new T.Object3D();creekStones.name='morris-real-creek-bank-boulders';rockPoints.forEach((p,i)=>{rockDummy.position.set(p.x,heightAt(p.x,p.z)+.18,p.z);rockDummy.rotation.set(.15*Math.sin(p.i),p.i*.8,p.side*.2);rockDummy.scale.set(.48+.18*Math.sin(p.i)**2,.4,.6+.2*Math.cos(p.i)**2);rockDummy.updateMatrix();creekStones.setMatrixAt(i,rockDummy.matrix);});creekStones.computeBoundingSphere();creekStones.castShadow=creekStones.receiveShadow=true;root.add(creekStones);
 const c=terrain.castle,castleBuild=createMorrisCastle({root,position:V(c.x,heightAt(c.x,c.z)+.025,c.z)}),castle=castleBuild.castle;
 const supports=[deck,...castleBuild.supports];root.updateWorldMatrix(true,true);
 return{water,bridge,deck,gate,castle,supports,report:{layers:terrain.layers,stream:'authored descending radial levels, carved real bed',streamLevels:terrain.levels,creekBankBoulders:rockPoints.length,bridge:'real curved deck and stone parapets',farmGate:'open wooden rails between stone posts',castle:'Oskar advisor modular keep, stepped wings, open arch and music court',castleDesign:castleBuild.report,wholeNavigationVerified:false},update(t){ripples.forEach((m,i)=>{const q=stream[Math.floor((t*7+i*6)%stream.length)];m.position.set(q.x,terrain.height(q.x,q.z,q.h)+.045,q.z);m.rotation.y=Math.sin(i)*.3;});}};
}
