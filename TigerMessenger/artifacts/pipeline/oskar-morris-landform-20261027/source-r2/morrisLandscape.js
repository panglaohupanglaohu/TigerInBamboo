import * as T from 'three';
import {createMorrisMountainRoute} from './morrisMountainRoute.js?v=morris-mid-slope-r1';
import {dressMorrisFacadeVines} from './morrisFlora.js?v=morris-route-r35-20261026';
import {dressMorrisBridge,installMorrisRockShoulders} from './morrisLandscapeDetails.js?v=oskar-target-r2';
import {createMorrisCastle} from './morrisCastle.js?v=oskar-target-r2';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),smooth=T.MathUtils.smoothstep;
export function createMorrisTerrain(R,edge){
 const musicCourt={x:30,z:12,radialHeight:7.2,rx:7,rz:6};
 const streamPoints=[[-20,-10],[-24,0],[-22,12],[-12,24],[8,32],[28,31],[55,16]],levels=[10.2,7.2,4.9,3.2,2.3,1.2,-.6],stream=[],course=new T.CatmullRomCurve3(streamPoints.map(([x,z])=>V(x,0,z)));
 for(let k=0;k<streamPoints.length-1;k++)for(let j=0;j<24;j++){const t=j/24,q=course.getPoint((k+t)/(streamPoints.length-1));stream.push({x:q.x,z:q.z,h:T.MathUtils.lerp(levels[k],levels[k+1],t)});}
 stream.push({x:55,z:16,h:-.6});
 const gaussian=(x,z,a,b,wx,wz)=>Math.exp(-(((x-a)/wx)**2+((z-b)/wz)**2));
 function naturalElevation(x,z){const r=Math.hypot(x,z),u=r/edge(Math.atan2(z,x));if(u>=1)return null;const fade=1-smooth(u,.86,1);
 let h=1.65+.14*Math.sin(x*.18)*Math.cos(z*.22)+5.2*Math.exp(-(x*x+z*z)/(32*32));
 h+=3.5*Math.exp(-(((x-5)/22)**2+((z-15)/16)**2))+4.5*Math.exp(-(((x-20)/26)**2+((z-19)/20)**2));
 // Target-guided connected rear massif: a broad lower saddle joins three
 // asymmetric rock shelves, with smooth shoulders rather than isolated domes.
 const shelf=(cx,cz,wx,wz,top,phase)=>{const a=Math.atan2(z-cz,x-cx),rr=Math.sqrt(((x-cx)/wx)**2+((z-cz)/wz)**2)/(1+.065*Math.sin(3*a+phase)+.035*Math.cos(5*a-phase));return top*(1-smooth(rr,.32,1.55));};
 const smax=(a,b,k)=>Math.max(a,b)+Math.max(k-Math.abs(a-b),0)**2/(4*k);
 const main=shelf(-12,-15,9.0,10.5,19.6,.3),back=shelf(2,-19,11,8.5,13.6,1.1),west=shelf(-25,-3,11.5,17,8.8,.8),east=shelf(1,-4,15,12,7.9,1.8);
 h+=smax(smax(main,back,2.8),smax(west,east,2.6),2.5);
 const upper=gaussian(x,z,-10,-12,25,21),channels=Math.max(0,Math.cos(x*.48+z*.19))**6;h+=upper*(.60*Math.sin(x*.39+z*.17)+.42*Math.cos(z*.47-x*.13)-1.25*channels);
 // The original musician ensemble occupies a real lower eastern shoulder.
 // Its level floor is 3.3m below the castle in radial elevation, not a colour band.
 const ca=Math.atan2(z-musicCourt.z,x-musicCourt.x),court=(Math.abs((x-musicCourt.x)/musicCourt.rx)**4+Math.abs((z-musicCourt.z)/musicCourt.rz)**4)**.25/(1+.075*Math.sin(ca*3+.6)),courtY=Math.sqrt((R+musicCourt.radialHeight)**2-musicCourt.x**2-musicCourt.z**2)-R;
 if(court<2.1){const w=1-smooth(court,1,2.1),planeR=Math.sqrt(x*x+z*z+(R+courtY)**2)-R;h=T.MathUtils.lerp(h,planeR,w);}
 // A wide castle shoulder seats a horizontal foundation; it blends into hills.
 const pa=Math.atan2(z-5,x-14),pad=Math.sqrt(((x-14)/11)**2+((z-5)/9)**2)/(1+.08*Math.sin(pa*3)+.045*Math.cos(pa*5)),padH=Math.sqrt(170.5**2-x*x-z*z)-R,targetY=Math.sqrt(170.5**2-14**2-5**2)-R;
 if(pad<1.55){const w=1-smooth(pad,1,1.55);const plateauR=Math.sqrt(x*x+z*z+(R+targetY)**2)-R;h=T.MathUtils.lerp(h,plateauR,w);}
 let closest=Infinity,q=null;for(const p of stream){const d=(p.x-x)**2+(p.z-z)**2;if(d<closest){closest=d;q=p;}}
 const d=Math.sqrt(closest),pool=Math.exp(-((x-8)**2+(z-32)**2)/(14*14)),bedWidth=1.05+1.3*pool,bankWidth=3.3+1.6*pool;if(d<bankWidth){const bed=q.h-.55,w=1-smooth(d,bedWidth,bankWidth);h=T.MathUtils.lerp(h,bed,w);}
 return (h-1.65)*fade+1.65-2.4*smooth(u,.9,1);
 }
 const plateauProtected=(x,z)=>(x>=7&&x<=21&&z>=0&&z<=10);
 const route=createMorrisMountainRoute({R,stream,naturalElevation,plateauProtected});
 const sightEye=route.at(route.bridge.s-15),sightEnd=route.bridge;
 function sightDistance(x,z){const dx=sightEnd.x-sightEye.x,dz=sightEnd.z-sightEye.z,t=T.MathUtils.clamp(((x-sightEye.x)*dx+(z-sightEye.z)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-sightEye.x-dx*t,z-sightEye.z-dz*t);}
 const bridgeSightline=(x,z)=>sightDistance(x,z)<2.8;
 function elevation(x,z){const raw=naturalElevation(x,z);if(raw==null||plateauProtected(x,z))return raw;const road=route.nearest(x,z),shoulder=route.shoulder+1.35*Math.sin(x*.18+z*.11)*Math.cos(z*.17);let h=raw;if(road.distance<shoulder){const riverDistance=Math.min(...stream.map(p=>Math.hypot(p.x-x,p.z-z))),pool=Math.exp(-((x-8)**2+(z-32)**2)/(14*14)),inner=1.3+pool;if(riverDistance>=inner){const preserveWater=smooth(riverDistance,inner,Math.max(2.5,inner+1.25)),weight=(1-smooth(road.distance,1.75,shoulder))*preserveWater;h=T.MathUtils.lerp(raw,road.h,weight);}}
 // Between route ribbons, eroded depressions break the large continuous green wall.
 const outside= smooth(road.distance,2.1,4.2),upland=smooth(h,5,12)*(1-smooth(h,23,30)),groove=(.5+.5*Math.cos(x*.52+z*.18))**5;h-=outside*upland*groove*1.35;
 // A low near bank reveals the actual arch from the curved walking approach.
 const notch=(1-smooth(sightDistance(x,z),1.6,4.2))*smooth(road.distance,1.7,3.2);if(notch>0)h=T.MathUtils.lerp(h,Math.min(h,stream[route.bridge.k].h+.15),notch);return h;}
 const height=(x,z,h=elevation(x,z))=>Math.sqrt(Math.max(1,(R+(h??-.75))**2-x*x-z*z))-R;
 return{elevation,naturalElevation,height,stream,levels,route,bridgeSightline,musicCourt,castle:{x:14,z:5},layers:[{name:'外圈花草坪',range:'外围低地径向约1.4–4m'},{name:'环绕溪流缓丘',range:'中圈约4–9m'},{name:'中央山肩城堡',range:'城基径向10.5m'},{name:'中央错位主峰',range:'后置主峰、相连石脊与宽鞍部约25m；不规则露岩层与缓肩向四周降低'}]};
}
function mesh(root,g,color,name){const m=new T.Mesh(g,new T.MeshStandardMaterial({color,roughness:.96,side:T.DoubleSide}));m.name=name;root.add(m);m.castShadow=true;m.receiveShadow=true;return m;}
function box(root,p,size,color,name){const m=mesh(root,new T.BoxGeometry(...size),color,name);m.position.set(...p);return m;}
function roof(root,x,y,z,w,d,h,color){const p=[-w/2,0,-d/2,w/2,0,-d/2,0,h,-d/2,-w/2,0,d/2,w/2,0,d/2,0,h,d/2],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4]);g.computeVertexNormals();const m=mesh(root,g,color,'castle-handcrafted-gable-roof');m.position.set(x,y,z);}
export function installMorrisLandscape({root,terrain,heightAt,R,pathX=()=>10,canDress=()=>true}){
 const waterP=[],waterI=[],waterUv=[],bankP=[],bankI=[],stream=terrain.stream;
 for(let i=0;i<stream.length;i++){const p=stream[i],a=stream[Math.max(0,i-1)],b=stream[Math.min(stream.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;for(const s of [-1,1]){const riverWidth=1.1+1.1*Math.exp(-((p.x-8)**2+(p.z-32)**2)/(14*14)),x=p.x+nx*s*riverWidth,z=p.z+nz*s*riverWidth;waterP.push(x,terrain.height(x,z,p.h)+.025,z);waterUv.push((s+1)/2,i/(stream.length-1));bankP.push(p.x+nx*s*1.65,heightAt(p.x+nx*s*1.65,p.z+nz*s*1.65)+.03,p.z+nz*s*1.65);}if(i<stream.length-1){const n=i*2;waterI.push(n,n+2,n+1,n+1,n+2,n+3);bankI.push(n,n+2,n+1,n+1,n+2,n+3);}}
 const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(waterP,3));wg.setIndex(waterI);wg.setAttribute('morrisCreekUv',new T.Float32BufferAttribute(waterUv,2));wg.computeVertexNormals();const water=mesh(root,wg,0x438c98,'morris-real-downhill-creek');water.material.roughness=.35;water.material.metalness=.1;water.castShadow=false;
 const creekTime={value:0};water.material.customProgramCacheKey=()=>"morris-creek-flow-r17";water.material.onBeforeCompile=shader=>{shader.uniforms.uMorrisCreekT=creekTime;shader.vertexShader="attribute vec2 morrisCreekUv; varying vec2 vMorrisCreekUv;\n"+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMorrisCreekUv=morrisCreekUv;');shader.fragmentShader="uniform float uMorrisCreekT; varying vec2 vMorrisCreekUv;\n"+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 {float mcU=vMorrisCreekUv.x,mcV=vMorrisCreekUv.y*200.0-uMorrisCreekT*1.6;float mcFlow=sin(mcV+sin(mcU*19.0)*.8)*.5+.5;float mcEdge=smoothstep(.32,.49,abs(mcU-.5));float mcFoam=smoothstep(.84,.98,sin(mcV*4.1+sin(mcU*31.0+sin(mcV*.31)))* .5+.5)*(mcEdge*.35+.025);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.24,.57,.63),mcFlow*.22);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.77,.83,.68),mcFoam*.45);}
 `);};
 // Three-dimensional travelling ripple strokes; no global ocean alteration.
 const ripples=[];for(let i=0;i<6;i++){const line=mesh(root,new T.BoxGeometry(.6,.018,.07),0xb5d3be,'creek-moving-ripple');line.castShadow=false;ripples.push(line);}
 const bridge=new T.Group();bridge.name='morris-creek-stone-arch-bridge';const crossing=terrain.route.bridge.k,p=stream[crossing],a=stream[Math.max(0,crossing-1)],b=stream[Math.min(stream.length-1,crossing+1)],angle=Math.atan2(-(b.z-a.z),b.x-a.x);bridge.position.set(p.x,terrain.height(p.x,p.z,p.h)+1.2,p.z);bridge.rotation.y=angle;root.add(bridge);
 const ends=[-4,4].map(z=>{const x=p.x+Math.sin(angle)*z,zz=p.z+Math.cos(angle)*z;return heightAt(x,zz)+.035-bridge.position.y;});
 const deckY=z=>T.MathUtils.lerp(ends[0],ends[1],(z+4)/8)+.75*Math.cos(z/4*Math.PI/2);
 const dp=[],di=[];for(let i=0;i<=24;i++){const z=-4+i/3,y=deckY(z);for(const x of[-1.6,1.6])dp.push(x,y,z);if(i<24){const n=i*2;di.push(n,n+2,n+1,n+1,n+2,n+3);}}
 const dg=new T.BufferGeometry();dg.setAttribute('position',new T.Float32BufferAttribute(dp,3));dg.setIndex(di);dg.computeVertexNormals();const deck=mesh(bridge,dg,0xc4ad80,'stone-bridge-walkable-deck');
 for(const x of[-1.78,1.78]){const pts=[];for(let j=0;j<=24;j++){const z=-4+j/3;pts.push(V(x,deckY(z)+.7,z));}mesh(bridge,new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.22,7,false),0xb9a37d,'bridge-low-stone-parapet');for(const z of[-3.3,3.3])box(bridge,[x,-.65,z],[.5,1.7,.9],0xb9a37d,'bridge-bank-footing');}
 // Farm gate remains open and leaves a clear central passage.
 const gate=new T.Group();gate.name='morris-farm-open-gate';const gatePoint=terrain.route.at(terrain.route.farmGateS??terrain.route.bridge.s+9);gate.position.set(gatePoint.x,heightAt(gatePoint.x,gatePoint.z),gatePoint.z);gate.rotation.y=Math.atan2(gatePoint.tx,gatePoint.tz);root.add(gate);for(const x of[-2.4,2.4]){box(gate,[x,1,0],[.5,2,.5],0xc6b38a,'gate-stone-post');const ball=mesh(gate,new T.SphereGeometry(.34,10,7),0xbca578,'gate-stone-finial');ball.position.set(x,2.14,0);for(const y of[.45,1,1.5]){const rail=box(gate,[x+(x>0?1:-1),y,.6],[2,.11,.12],0x78613e,'farm-open-wood-rail');rail.rotation.y=x>0?-.6:.6;}}
 const rockPoints=[];for(let i=6;i<stream.length-5;i+=3){const p=stream[i],a=stream[i-1],b=stream[i+1],d=Math.hypot(b.x-a.x,b.z-a.z)||1;for(const side of[-1,1]){const x=p.x-(b.z-a.z)/d*side*2.15,z=p.z+(b.x-a.x)/d*side*2.15;if(terrain.route.nearest(x,z).distance<3.8)continue;rockPoints.push({x,z,i,side});}}
 const creekStones=new T.InstancedMesh(new T.DodecahedronGeometry(1,0),new T.MeshStandardMaterial({color:0xb8b09b,roughness:1}),rockPoints.length),rockDummy=new T.Object3D();creekStones.name='morris-real-creek-bank-boulders';rockPoints.forEach((p,i)=>{rockDummy.position.set(p.x,heightAt(p.x,p.z)+.18,p.z);rockDummy.rotation.set(.15*Math.sin(p.i),p.i*.8,p.side*.2);rockDummy.scale.set(.30+.18*Math.sin(p.i)**2,.23,.42+.2*Math.cos(p.i)**2);rockDummy.updateMatrix();creekStones.setMatrixAt(i,rockDummy.matrix);});creekStones.computeBoundingSphere();creekStones.castShadow=creekStones.receiveShadow=true;root.add(creekStones);
 const bridgeDetail=dressMorrisBridge({bridge,deckY}),shoulders=installMorrisRockShoulders({root,heightAt,canDress});
 const c=terrain.castle,castleBuild=createMorrisCastle({root,position:V(c.x,heightAt(c.x,c.z)+.025,c.z)}),castle=castleBuild.castle;
 const facadePlants=dressMorrisFacadeVines(castle);
 const musicCourt={...terrain.musicCourt,position:V(terrain.musicCourt.x,heightAt(terrain.musicCourt.x,terrain.musicCourt.z),terrain.musicCourt.z),routeS:terrain.route.report.marks.eastEnd};
 // A short ground-following approach lets mounted visitors reach the lower court
 // without cutting the castle foundation or placing a stair across the ride.
 const courtStart=terrain.route.at(musicCourt.routeS),courtCurve=new T.QuadraticBezierCurve3(V(courtStart.x,0,courtStart.z),V(30,0,18),V(30,0,15.5)),courtPath=[],courtIndex=[],courtApproach=[];
 for(let j=0;j<=28;j++){const q=courtCurve.getPoint(j/28),tangent=courtCurve.getTangent(j/28),normal=V(-tangent.z,0,tangent.x).normalize();courtApproach.push({x:q.x,z:q.z,y:heightAt(q.x,q.z)+.035});for(const side of[-1.6,0,1.6]){const x=q.x+normal.x*side,z=q.z+normal.z*side;courtPath.push(x,heightAt(x,z)+.035,z);}if(j<28)for(let k=0;k<2;k++){const n=j*3+k;courtIndex.push(n,n+3,n+1,n+1,n+3,n+4);}}
 const courtGeometry=new T.BufferGeometry();courtGeometry.setAttribute('position',new T.Float32BufferAttribute(courtPath,3));courtGeometry.setIndex(courtIndex);courtGeometry.computeVertexNormals();const courtWalk=mesh(root,courtGeometry,0xbbaa81,'morris-lower-music-court-ground-following-approach');courtWalk.castShadow=false;musicCourt.approach=courtApproach;musicCourt.entry=courtApproach.at(-1);musicCourt.approachWidth=3.2;
 const supports=[deck,...castleBuild.supports,shoulders.mesh,courtWalk];root.updateWorldMatrix(true,true);
 let bridgeMaxRadialGrade=0;for(let j=1;j<=80;j++){const za=-4+(j-1)*.1,zb=-4+j*.1,a=bridge.localToWorld(V(0,deckY(za),za)),b=bridge.localToWorld(V(0,deckY(zb),zb)),dr=b.length()-a.length(),d=a.distanceTo(b);bridgeMaxRadialGrade=Math.max(bridgeMaxRadialGrade,Math.abs(dr)/Math.sqrt(Math.max(1e-8,d*d-dr*dr)));}

 return{water,bridge,deck,gate,castle,musicCourt,supports,report:{layers:terrain.layers,musicCourt:{x:musicCourt.x,z:musicCourt.z,radialHeight:musicCourt.radialHeight,castleHeightDifference:10.5-musicCourt.radialHeight,routeS:musicCourt.routeS,approachWidth:musicCourt.approachWidth,entry:musicCourt.entry,mode:'actual lower eastern shoulder, original musician ensemble'},mountainRoute:terrain.route.report,stream:'authored descending radial levels, carved real bed',streamLevels:terrain.levels,creekBankBoulders:rockPoints.length,bridgeDetail,bridgeCrownRise:.75,bridgeMaxRadialGrade,facadePlants,creekFlow:"local animated UV flow and broken bank foam",rockShoulderGroups:shoulders.count,bridge:'real curved deck and stone parapets',farmGate:'open wooden rails between stone posts',castle:'preserved modular keep, stepped wings and open arch; independent Morris lower music shoulder',castleDesign:castleBuild.report,wholeNavigationVerified:false},update(t){creekTime.value=t;ripples.forEach((m,i)=>{const q=stream[Math.floor((t*7+i*6)%stream.length)];m.position.set(q.x,terrain.height(q.x,q.z,q.h)+.045,q.z);m.rotation.y=Math.sin(i)*.3;});}};
}
