import * as T from 'three';
import {createMorrisMountainRoute} from './morrisMountainRoute.js?v=morris-area2-final-r1';
import {dressMorrisFacadeVines} from './morrisFlora.js?v=morris-route-r35-20261026';
import {dressMorrisBridge,installMorrisRockShoulders} from './morrisLandscapeDetails.js?v=oskar-area2-final-r1';
import {createMorrisCastle} from './morrisCastle.js?v=oskar-target-r2';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),smooth=T.MathUtils.smoothstep;
export function createMorrisTerrain(R,edge){
 const expansion=Math.max(1,Math.min(Math.SQRT2,edge(0)/(22*Math.sqrt(7)*(1+.055*Math.sin(.7)))));
 const musicCourt={x:30,z:12,radialHeight:7.2,rx:7,rz:6};
 const mouthAngle=Math.atan2(70,35),mouthRadius=edge(mouthAngle)*1.025,mouth=[Math.cos(mouthAngle)*mouthRadius,Math.sin(mouthAngle)*mouthRadius];
 const streamPoints=[[-20,-10],[-24,0],[-22,12],[-12,24],[8,32],[28,31],...(expansion>1.2?[[40,41],[42,59],[35,70],mouth]:[[55,16]])],levels=[15.8,11.8,7.5,4.5,2.3,1.2,...(expansion>1.2?[.7,.1,-.2,-.6]:[-.6])],stream=[],course=new T.CatmullRomCurve3(streamPoints.map(([x,z])=>V(x,0,z)));
 for(let k=0;k<streamPoints.length-1;k++)for(let j=0;j<24;j++){const t=j/24,q=course.getPoint((k+t)/(streamPoints.length-1));const drop=levels[k]-levels[k+1],steps=Math.max(1,Math.round(drop/.65)),f=t*steps,whole=Math.floor(f),part=f-whole,descent=(whole+smooth(part,.65,1))/steps;stream.push({x:q.x,z:q.z,h:levels[k]-drop*descent});}
 const streamMouth=streamPoints.at(-1);stream.push({x:streamMouth[0],z:streamMouth[1],h:-.6});
 const gaussian=(x,z,a,b,wx,wz)=>Math.exp(-(((x-a)/wx)**2+((z-b)/wz)**2));
 function naturalElevation(x,z){const r=Math.hypot(x,z),u=r/edge(Math.atan2(z,x));if(u>=1)return null;const fade=1-smooth(u,expansion>1.2?.93:.86,1);
 let h=1.65+.14*Math.sin(x*.18)*Math.cos(z*.22)+5.2*Math.exp(-(x*x+z*z)/(32*32));
 h+=3.5*Math.exp(-(((x-5)/22)**2+((z-15)/16)**2))+4.5*Math.exp(-(((x-20)/26)**2+((z-19)/20)**2));
 // New area is authored low meadow shoulders, not a flat circular skirt.
 const outerWeight=smooth(r,38,53)*Math.min(1,(expansion-1)/.30),a=Math.atan2(z,x),lowland=1.45+2.5*gaussian(x,z,-42,43,23,17)+2.2*gaussian(x,z,45,43,20,14)+2.7*gaussian(x,z,-40,-40,23,19)+2.4*gaussian(x,z,0,63,27,13)+1.0*gaussian(x,z,51,-31,20,16)-.9*gaussian(x,z,-15,55,8,19)-.7*gaussian(x,z,26,52,9,20);
 // Target v1: one narrow rear summit descends through offset shoulders.
 // Rounded ridge kernels have no flat summit discs; the saddles are real ground.
 const smax=(a,b,k)=>Math.max(a,b)+Math.max(k-Math.abs(a-b),0)**2/(4*k);
 const ridge=(cx,cz,wx,wz,top,phase)=>{const a=Math.atan2(z-cz,x-cx),warp=1+.10*Math.sin(a*3+phase)+.055*Math.cos(a*5-phase),q=(((x-cx)/wx)**2+((z-cz)/wz)**2)/(warp*warp);return top*Math.exp(-Math.pow(q,.82));};
 const shoulderGrow=1+(expansion-1)*.8,main=ridge(-13,-18,10*shoulderGrow,12*shoulderGrow,20.0,.2),rear=ridge(-2,-24,10*shoulderGrow,10*shoulderGrow,12.8,1.2),west=ridge(-28,-7,13*shoulderGrow,14*shoulderGrow,10.4,2.1),front=ridge(-16,7,13*shoulderGrow,10*shoulderGrow,7.3,.7),saddle=ridge(1,-2,14*shoulderGrow,11*shoulderGrow,7.0,1.6);
 h+=(expansion-1)*3.6*gaussian(x,z,-29,-24,29,28);
 h+=smax(smax(main,rear,2.5),smax(smax(west,front,2.0),saddle,2.3),2.5);
 const upper=gaussian(x,z,-13,-10,28,26),gullies=Math.max(0,Math.cos(x*.39+z*.23))**8;
 h+=upper*(.65*Math.sin(x*.34+z*.16)+.43*Math.cos(z*.42-x*.18)-1.05*gullies);
 // Short oblique rock steps, not a single quantised high table mountain.
 const phaseOffset=.35*Math.sin(x*.24)+.26*Math.sin(z*.3),step=2.8,band=(h+phaseOffset)/step,b0=Math.floor(band),f=band-b0;
 h=T.MathUtils.lerp(h,(b0+smooth(f,.22,.62))*step-phaseOffset,upper*.84*(1-.85*gaussian(x,z,-13,-18,3.8,4.2)));
 // The two hairpin interiors are broad flower shoulders, not cone-shaped
 // islands cut out by the road. These levels are below the castle platform.
 const lowerBench=Math.hypot((x+6)/8.4,(z-17)/8.0),middleBench=Math.hypot((x-20)/8.0,(z-22)/7.0);
 if(lowerBench<1.45)h=T.MathUtils.lerp(h,Math.min(h,7.1+.26*Math.sin(x*.23+z*.17)),1-smooth(lowerBench,.64,1.45));
 if(middleBench<1.35)h=T.MathUtils.lerp(h,Math.min(h,8.3+.20*Math.sin(x*.2-z*.16)),1-smooth(middleBench,.65,1.35));
 h=T.MathUtils.lerp(h,T.MathUtils.clamp(lowland,1.25,4.5),outerWeight);
 const cove=Math.max(0,Math.sin(a*5+.7))**6;h-=outerWeight*cove*1.65*smooth(u,.76,.98);
 // The original musician ensemble occupies a real lower eastern shoulder.
 // Its level floor is 3.3m below the castle in radial elevation, not a colour band.
 const ca=Math.atan2(z-musicCourt.z,x-musicCourt.x),court=(Math.abs((x-musicCourt.x)/musicCourt.rx)**4+Math.abs((z-musicCourt.z)/musicCourt.rz)**4)**.25/(1+.075*Math.sin(ca*3+.6)),courtY=Math.sqrt((R+musicCourt.radialHeight)**2-musicCourt.x**2-musicCourt.z**2)-R;
 if(court<2.85){const w=1-smooth(court,.92,2.85),planeR=Math.sqrt(x*x+z*z+(R+courtY)**2)-R;h=T.MathUtils.lerp(h,planeR,w);}
 // Two broad, offset foothills support the court instead of a cylindrical rim.
 const courtApron=Math.max(3.5*gaussian(x,z,39,18,8,9),1.9*gaussian(x,z,43,26,7,8));
 if(x>31&&z>10)h=Math.max(h,courtApron+1.5);
 // A wide castle shoulder seats a horizontal foundation; it blends into hills.
 const pa=Math.atan2(z-5,x-14),pad=Math.sqrt(((x-14)/11)**2+((z-5)/9)**2)/(1+.08*Math.sin(pa*3)+.045*Math.cos(pa*5)),padH=Math.sqrt(170.5**2-x*x-z*z)-R,targetY=Math.sqrt(170.5**2-14**2-5**2)-R;
 if(pad<1.55){const w=1-smooth(pad,1,1.55);const plateauR=Math.sqrt(x*x+z*z+(R+targetY)**2)-R;h=T.MathUtils.lerp(h,plateauR,w);}
 let closest=Infinity,q=null;for(const p of stream){const d=(p.x-x)**2+(p.z-z)**2;if(d<closest){closest=d;q=p;}}
 const d=Math.sqrt(closest),pool=Math.exp(-((x-8)**2+(z-32)**2)/(14*14)),bedWidth=1.05+1.3*pool,bankWidth=5.0+2.6*pool;if(d<bankWidth){const bed=q.h-.55,w=1-smooth(d,bedWidth,bankWidth);h=T.MathUtils.lerp(h,bed,w);}
 return (h-1.65)*fade+1.65-2.4*smooth(u,.9,1);
 }
 const plateauProtected=(x,z)=>(x>=7&&x<=21&&z>=0&&z<=10);
 const route=createMorrisMountainRoute({R,stream,naturalElevation,plateauProtected,expansion});
 const sightEye=route.at(route.bridge.s-15),sightEnd=route.bridge;
 function sightDistance(x,z){const dx=sightEnd.x-sightEye.x,dz=sightEnd.z-sightEye.z,t=T.MathUtils.clamp(((x-sightEye.x)*dx+(z-sightEye.z)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-sightEye.x-dx*t,z-sightEye.z-dz*t);}
 const bridgeSightline=(x,z)=>sightDistance(x,z)<2.8;
 function elevation(x,z){const raw=naturalElevation(x,z);if(raw==null||plateauProtected(x,z))return raw;const road=route.nearest(x,z),shoulder=route.shoulder+1.35*Math.sin(x*.18+z*.11)*Math.cos(z*.17);let h=raw;if(road.distance<shoulder){const riverDistance=Math.min(...stream.map(p=>Math.hypot(p.x-x,p.z-z))),pool=Math.exp(-((x-8)**2+(z-32)**2)/(14*14)),inner=1.3+pool;if(riverDistance>=inner){const coreWater=smooth(riverDistance,inner,Math.max(2.5,inner+1.25)),bankWater=smooth(riverDistance,inner,5.0+2.6*pool),preserveWater=T.MathUtils.lerp(coreWater,bankWater,smooth(road.distance,1.75,3.1)),weight=(1-smooth(road.distance,1.75,shoulder))*preserveWater;h=T.MathUtils.lerp(raw,road.h,weight);}}
 // Between route ribbons, eroded depressions break the large continuous green wall.
 const outside= smooth(road.distance,2.0,3.25),upland=smooth(h,5,12)*(1-smooth(h,23,30)),groove=(.5+.5*Math.cos(x*.52+z*.18))**5;h-=outside*upland*groove*2.8;
 // The lower music shoulder descends in two asymmetric rock-and-grass ledges.
 // Keep the level musician core and the complete riding ribbon untouched.
 const courtOuter=smooth(Math.hypot((x-30)/7,(z-12)/6),1.12,1.6),courtBand=(1-smooth(Math.abs(x-35),11,17))*(1-smooth(Math.abs(z-21),6,12))*courtOuter*smooth(road.distance,2.05,3.8);
 if(courtBand>0){const step=2.5,q=(h+.25*Math.sin(x*.3))/step,b=Math.floor(q),f=q-b,ledges=(b+smooth(f,.15,.82))*step-.25*Math.sin(x*.3);h=T.MathUtils.lerp(h,ledges,courtBand*.5);h-=courtBand*(1.9*Math.exp(-(((x-39)/3.4)**2+((z-23)/4.7)**2))+.9*Math.exp(-(((x-30)/3.2)**2+((z-27)/2.8)**2)));}
 // Cut two broad ravines through the outside court embankment. Their mouths
 // alternate with real lower buttresses; the riding ribbon and musician core stay fixed.
 const free=smooth(road.distance,2.0,3.4),coreGap=smooth(Math.hypot((x-30)/7,(z-12)/6),1.05,1.6);
 if(x>27&&z>17){const cuts=4.2*Math.exp(-(((x-37)/4.0)**2+((z-25)/5.2)**2))+3.0*Math.exp(-(((x-27)/4.0)**2+((z-30)/4.5)**2));h-=cuts*free*coreGap;}
 // Fracture the real cut faces below the road shoulder. This changes the
 // surface vertices through the authoritative height sampler, not just colour.
 const face=outside*smooth(Math.abs(raw-road.h),1.0,3.2)*smooth(h,3.6,7.0)*(1-smooth(h,24,29));
 h+=face*(.72*Math.sin(x*1.05+z*.21)+.48*Math.sin(z*.91-x*.34)+.35*Math.sin(h*2.7+x*.19));
 // A low near bank reveals the actual arch from the curved walking approach.
 const notch=(1-smooth(sightDistance(x,z),1.6,4.2))*smooth(road.distance,1.7,3.2);if(notch>0)h=T.MathUtils.lerp(h,Math.min(h,stream[route.bridge.k].h+.15),notch);return h;}
 const height=(x,z,h=elevation(x,z))=>Math.sqrt(Math.max(1,(R+(h??-.75))**2-x*x-z*z))-R;
 return{expansion,elevation,naturalElevation,height,stream,levels,route,bridgeSightline,musicCourt,castle:{x:14,z:5},layers:[{name:'外圈花草坪',range:'外围低地径向约1.4–4m'},{name:'环绕溪流缓丘',range:'中圈约4–9m'},{name:'中央山肩城堡',range:'城基径向10.5m'},{name:'中央错位主峰',range:'后置主峰、相连石脊与宽鞍部约25m；尖圆主峰、斜向短岩阶与五组错位宽肩向四周降低'}]};
}
function mesh(root,g,color,name){const m=new T.Mesh(g,new T.MeshStandardMaterial({color,roughness:.96,side:T.DoubleSide}));m.name=name;root.add(m);m.castShadow=true;m.receiveShadow=true;return m;}
function box(root,p,size,color,name){const m=mesh(root,new T.BoxGeometry(...size),color,name);m.position.set(...p);return m;}
function roof(root,x,y,z,w,d,h,color){const p=[-w/2,0,-d/2,w/2,0,-d/2,0,h,-d/2,-w/2,0,d/2,w/2,0,d/2,0,h,d/2],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4]);g.computeVertexNormals();const m=mesh(root,g,color,'castle-handcrafted-gable-roof');m.position.set(x,y,z);}
export function installMorrisLandscape({root,terrain,heightAt,R,pathX=()=>10,canDress=()=>true,canFace=canDress}){
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
 const rockPoints=[];for(let i=6;i<stream.length-5;i+=2+(i%5)){const p=stream[i],a=stream[i-1],b=stream[i+1],d=Math.hypot(b.x-a.x,b.z-a.z)||1;for(const side of[-1,1]){const x=p.x-(b.z-a.z)/d*side*2.15,z=p.z+(b.x-a.x)/d*side*2.15;if(terrain.route.nearest(x,z).distance<3.8)continue;rockPoints.push({x,z,i,side});}}
 const creekStones=new T.InstancedMesh(new T.DodecahedronGeometry(1,0),new T.MeshStandardMaterial({color:0xb8b09b,roughness:1}),rockPoints.length),rockDummy=new T.Object3D();creekStones.name='morris-real-creek-bank-boulders';rockPoints.forEach((p,i)=>{rockDummy.position.set(p.x,heightAt(p.x,p.z)+.18,p.z);rockDummy.rotation.set(.15*Math.sin(p.i),p.i*.8,p.side*.2);rockDummy.scale.set(.38+.28*Math.sin(p.i*1.7)**2,.25+.18*Math.sin(p.i*.8)**2,.43+.32*Math.cos(p.i*.9)**2);rockDummy.updateMatrix();creekStones.setMatrixAt(i,rockDummy.matrix);});creekStones.computeBoundingSphere();creekStones.castShadow=creekStones.receiveShadow=true;root.add(creekStones);
 const bridgeDetail=dressMorrisBridge({bridge,deckY}),shoulders=installMorrisRockShoulders({root,heightAt,canDress,canFace});
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
