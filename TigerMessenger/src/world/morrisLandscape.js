import {createMorrisLandformProfile} from './morrisLandformProfile.js?v=three-view-r9';
import * as T from 'three';
import {createMorrisMountainRoute} from './morrisRoute30.js?v=three-view-r3';
import {dressMorrisFacadeVines} from './morrisFlora.js?v=morris-route-r35-20261026';
import {dressMorrisBridge,installMorrisRockShoulders,installMorrisCoastRocks} from './morrisLandscapeDetails.js?v=seeded-irregular-rock-r11-20261030';
import {createMorrisCastle} from './morrisCastle.js?v=highland-citadel-style-r7';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),smooth=T.MathUtils.smoothstep;
export function createMorrisTerrain(R,edge){
 const expansion=Math.max(1,Math.min(Math.SQRT2,edge(0)/(22*Math.sqrt(7)*(1+.055*Math.sin(.7)))));
 const musicCourt={x:30,z:12,radialHeight:7.2,rx:7,rz:6};
 const mouthAngle=Math.atan2(75,6),mouthRadius=edge(mouthAngle)*1.015,mouth=[Math.cos(mouthAngle)*mouthRadius,Math.sin(mouthAngle)*mouthRadius];
 const streamPoints=[[-12,-12],[2,-4],[21,8],[20,22],[24,34],[27,50],[20,66],mouth],levels=[19.2,14.2,8.4,5.6,3.1,1.3,.3,-.6],stream=[],course=new T.CatmullRomCurve3(streamPoints.map(([x,z])=>V(x,0,z)));
 // Monotone Hermite elevation: continuous slope through authored water levels,
 // rather than repeated horizontal shelves and abrupt 0.65m drops.
 const slopes=levels.slice(1).map((h,k)=>h-levels[k]);
 const tangents=levels.map((_,k)=>k===0?slopes[0]:k===levels.length-1?slopes.at(-1):2*slopes[k-1]*slopes[k]/(slopes[k-1]+slopes[k]));
 for(let k=0;k<streamPoints.length-1;k++)for(let j=0;j<24;j++){
  const t=j/24,q=course.getPoint((k+t)/(streamPoints.length-1)),t2=t*t,t3=t2*t;
  const h=(2*t3-3*t2+1)*levels[k]+(t3-2*t2+t)*tangents[k]+(-2*t3+3*t2)*levels[k+1]+(t3-t2)*tangents[k+1];
  // Bend the upper valley around its shoulders; retain the lower bridge reach.
  const upper=(k+t)/3, bend=upper<1?5.2*Math.sin(upper*Math.PI*3)*Math.sin(upper*Math.PI)**2:0;
  stream.push({x:q.x+bend,z:q.z,h});
 }
 // Project onto segments so the bed uses the same continuous water profile.
 function nearestWater(x,z){let best={p:stream[0],d:Infinity};for(let k=1;k<stream.length;k++){
  const a=stream[k-1],b=stream[k],dx=b.x-a.x,dz=b.z-a.z,t=T.MathUtils.clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz),0,1);
  const px=a.x+dx*t,pz=a.z+dz*t,d=Math.hypot(x-px,z-pz);if(d<best.d)best={p:{x:px,z:pz,h:T.MathUtils.lerp(a.h,b.h,t)},d};
 }return best;}
 const streamMouth=streamPoints.at(-1);stream.push({x:streamMouth[0],z:streamMouth[1],h:-.6});
 // Start at the foot-of-slope spring. The removed high reach crossed a
 // near-vertical rock face; it was a water ribbon, not a plausible riverbed.
 stream.splice(0,48);
 const naturalElevation=createMorrisLandformProfile({R,edge,expansion,musicCourt,castle:{x:-14,z:5,radialHeight:10.5}});
 // Water follows the actual valley rather than spanning above its low saddle.
 for(const p of stream){const ground=naturalElevation(p.x,p.z);if(ground!=null)p.h=Math.min(p.h,ground-.22);}
 for(let pass=0;pass<3;pass++){
  const hs=stream.map(p=>p.h);
  for(let k=1;k<stream.length-1;k++)stream[k].h=Math.min(hs[k],(hs[k-1]+2*hs[k]+hs[k+1])/4);
 }
 for(let k=1;k<stream.length;k++)stream[k].h=Math.min(stream[k].h,stream[k-1].h-.0001);
 const plateauProtected=(x,z)=>(x>=-21&&x<=-7&&z>=0&&z<=10);
 const route=createMorrisMountainRoute({R,stream,naturalElevation,plateauProtected,expansion});
 const sightEye=route.at(route.bridge.s-28),sightEnd=route.bridge;
 function sightDistance(x,z){const dx=sightEnd.x-sightEye.x,dz=sightEnd.z-sightEye.z,t=T.MathUtils.clamp(((x-sightEye.x)*dx+(z-sightEye.z)*dz)/(dx*dx+dz*dz),0,1);return Math.hypot(x-sightEye.x-dx*t,z-sightEye.z-dz*t);}
 const bridgeSightline=(x,z)=>sightDistance(x,z)<2.8;
 function elevation(x,z){let h=naturalElevation(x,z);if(h==null)return null;if(plateauProtected(x,z))return h;
  const road=route.nearest(x,z),shoulder=Math.max(route.shoulder,Math.min(14,3+Math.abs(h-road.h)*1.6)),water=nearestWater(x,z),width=1.25+.4*Math.sin(water.p.z*.08)**2;
  // Carve a broad concave valley, not a narrow channel laid on a ridge.
  const valley=6.5,bed=water.p.h-.5;
  if(water.d<width+valley)h=T.MathUtils.lerp(h,Math.min(h,bed),1-smooth(water.d,width,width+valley));
  // Roads are graded into actual terrain, not suspended coloured ribbons.
  if(road.distance<shoulder&&(water.d>width+.3||(!road.isBranch&&route.isBridge(road.s)))){
   if(road.isBranch||!route.isBridge(road.s))h=T.MathUtils.lerp(h,road.h-.04,1-smooth(road.distance,2.1,shoulder));else h=Math.min(h,T.MathUtils.lerp(road.h-.4,h,smooth(road.distance,2.1,4)));
  }
  // Open the actual bank in the approach view, retaining the road deck and
  // foundations. A low glade replaces the intervening earth mound.
  const sx=sightEnd.x-sightEye.x,sz=sightEnd.z-sightEye.z,st=T.MathUtils.clamp(((x-sightEye.x)*sx+(z-sightEye.z)*sz)/(sx*sx+sz*sz),0,1),sd=sightDistance(x,z);
  if(st>.10&&st<.94&&sd<4.2&&road.distance>2.5){const ceiling=T.MathUtils.lerp(sightEye.h+1.9,stream[route.bridge.k].h+.6,st)-.4;h=T.MathUtils.lerp(h,Math.min(h,ceiling),1-smooth(sd,1.9,4.2));}
  if(water.d<width+.15)h=bed; // keep a continuous physical bed after road/sightline cuts
  return h;
 }
 const height=(x,z,h=elevation(x,z))=>Math.sqrt(Math.max(1,(R+(h??-.75))**2-x*x-z*z))-R;
 return{expansion,elevation,naturalElevation,height,stream,levels,route,nearestWater,bridgeSightline,musicCourt,castle:{x:-14,z:5},landformReport:naturalElevation.report,layers:[{name:'外圈花草坪',range:'外围低地径向约1.4–4m'},{name:'环绕溪流缓丘',range:'中圈约4–9m'},{name:'中央山肩城堡',range:'城基径向10.5m'},{name:'中央错位主峰',range:'后置主峰、相连石脊与宽鞍部约25m；尖圆主峰、斜向短岩阶与五组错位宽肩向四周降低'}]};
}
function mesh(root,g,color,name){const m=new T.Mesh(g,new T.MeshStandardMaterial({color,roughness:.96,side:T.DoubleSide}));m.name=name;root.add(m);m.castShadow=true;m.receiveShadow=true;return m;}
function box(root,p,size,color,name){const m=mesh(root,new T.BoxGeometry(...size),color,name);m.position.set(...p);return m;}
function roof(root,x,y,z,w,d,h,color){const p=[-w/2,0,-d/2,w/2,0,-d/2,0,h,-d/2,-w/2,0,d/2,w/2,0,d/2,0,h,d/2],g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex([0,2,1,3,4,5,0,3,5,0,5,2,1,2,5,1,5,4]);g.computeVertexNormals();const m=mesh(root,g,color,'castle-handcrafted-gable-roof');m.position.set(x,y,z);}
export function installMorrisLandscape({root,terrain,heightAt,R,edge,pathX=()=>10,canDress=()=>true,canFace=canDress}){
 const waterP=[],waterI=[],waterUv=[],waterDrop=[],bankP=[],bankI=[],stream=terrain.stream;
 for(let i=0;i<stream.length;i++){const p=stream[i],a=stream[Math.max(0,i-1)],b=stream[Math.min(stream.length-1,i+1)],dx=b.x-a.x,dz=b.z-a.z,len=Math.hypot(dx,dz)||1,nx=-dz/len,nz=dx/len;for(const s of [-1,1]){const riverWidth=(.92+.30*Math.sin(p.z*.17+.4)**2+.13*Math.sin(p.z*.61))*(.14+.86*smooth(i,0,9)),x=p.x+nx*s*riverWidth,z=p.z+nz*s*riverWidth;waterP.push(x,terrain.height(x,z,p.h)+.025,z);waterUv.push((s+1)/2,i/(stream.length-1));waterDrop.push(Math.max(0,a.h-b.h));bankP.push(p.x+nx*s*1.65,heightAt(p.x+nx*s*1.65,p.z+nz*s*1.65)+.03,p.z+nz*s*1.65);}if(i<stream.length-1){const n=i*2;waterI.push(n,n+2,n+1,n+1,n+2,n+3);bankI.push(n,n+2,n+1,n+1,n+2,n+3);}}
 // A dense cross-section riverbed joins the flowing surface to both real banks.
 // The submerged core follows the same authority as collision; outer edges fade
 // into the existing ground, so no water ribbon can span an empty saddle.
 const bedP=[],bedC=[],bedI=[],cross=[-5,-3.2,-2.1,-1.4,0,1.4,2.1,3.2,5];
 for(let i=0;i<stream.length;i++){
  const p=stream[i],a=stream[Math.max(0,i-1)],b=stream[Math.min(stream.length-1,i+1)],len=Math.hypot(b.x-a.x,b.z-a.z)||1,nx=-(b.z-a.z)/len,nz=(b.x-a.x)/len;
  for(const offset of cross){const x=p.x+nx*offset,z=p.z+nz*offset,ground=heightAt(x,z),waterY=terrain.height(x,z,p.h),d=Math.abs(offset);
   const y=d<=1.4?Math.min(ground,waterY-.24):ground+.018;
   bedP.push(x,y,z);const wet=new T.Color(0x8b9477),dry=new T.Color(0xc9b784);wet.lerp(dry,T.MathUtils.smoothstep(d,1.4,4));bedC.push(wet.r,wet.g,wet.b);
  }
  if(i<stream.length-1)for(let j=0;j<cross.length-1;j++){const n=i*cross.length+j;bedI.push(n,n+cross.length,n+1,n+1,n+cross.length,n+cross.length+1);}
 }
 const bedGeo=new T.BufferGeometry();bedGeo.setAttribute('position',new T.Float32BufferAttribute(bedP,3));bedGeo.setAttribute('color',new T.Float32BufferAttribute(bedC,3));bedGeo.setIndex(bedI);bedGeo.computeVertexNormals();
 const riverbed=new T.Mesh(bedGeo,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));riverbed.name='morris-continuous-joined-creek-bed';riverbed.receiveShadow=true;root.add(riverbed);
 const wg=new T.BufferGeometry();wg.setAttribute('position',new T.Float32BufferAttribute(waterP,3));wg.setIndex(waterI);wg.setAttribute('morrisCreekUv',new T.Float32BufferAttribute(waterUv,2));wg.setAttribute('morrisCreekDrop',new T.Float32BufferAttribute(waterDrop,1));wg.computeVertexNormals();const water=mesh(root,wg,0x438c98,'morris-real-downhill-creek');water.material.roughness=.35;water.material.metalness=.1;water.castShadow=false;
 const creekTime={value:0};water.material.customProgramCacheKey=()=>"morris-creek-joined-valley-r21";water.material.onBeforeCompile=shader=>{shader.uniforms.uMorrisCreekT=creekTime;shader.vertexShader="attribute vec2 morrisCreekUv; attribute float morrisCreekDrop; varying vec2 vMorrisCreekUv; varying float vMorrisCreekDrop;\n"+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvMorrisCreekUv=morrisCreekUv;vMorrisCreekDrop=morrisCreekDrop;');shader.fragmentShader="uniform float uMorrisCreekT; varying vec2 vMorrisCreekUv; varying float vMorrisCreekDrop;\n"+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 {float mcU=vMorrisCreekUv.x,mcV=vMorrisCreekUv.y*200.0-uMorrisCreekT*1.6;float mcFlow=sin(mcV*.35+sin(mcU*11.0)*.3)*.5+.5;float mcEdge=smoothstep(.32,.49,abs(mcU-.5));float mcFoam=smoothstep(.84,.98,sin(mcV*4.1+sin(mcU*31.0+sin(mcV*.31)))* .5+.5)*(mcEdge*.35+.025);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.24,.57,.63),mcFlow*.09);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.88,.96,.93),mcFoam*.3);}
 `);};
 // Three-dimensional travelling ripple strokes; no global ocean alteration.
 const ripples=[];for(let i=0;i<6;i++){const line=mesh(root,new T.BoxGeometry(.6,.018,.07),0xb5d3be,'creek-moving-ripple');line.castShadow=false;ripples.push(line);}
 const bridge=new T.Group();bridge.name='morris-creek-stone-arch-bridge';const crossing=terrain.route.bridge.k,p=stream[crossing],a=stream[Math.max(0,crossing-1)],b=stream[Math.min(stream.length-1,crossing+1)],angle=Math.atan2(-(b.z-a.z),b.x-a.x);bridge.position.set(p.x,terrain.height(p.x,p.z,p.h)+1.2,p.z);bridge.rotation.y=angle;bridge.scale.z=1.5;root.add(bridge);
 const ends=[-4,4].map(z=>{const x=p.x+Math.sin(angle)*z*1.5,zz=p.z+Math.cos(angle)*z*1.5;return heightAt(x,zz)+.035-bridge.position.y;});
 const deckY=z=>T.MathUtils.lerp(ends[0],ends[1],(z+4)/8)+.75*Math.cos(z/4*Math.PI/2);
 const dp=[],di=[];for(let i=0;i<=24;i++){const z=-4+i/3,y=deckY(z);for(const x of[-1.6,1.6])dp.push(x,y,z);if(i<24){const n=i*2;di.push(n,n+2,n+1,n+1,n+2,n+3);}}
 const dg=new T.BufferGeometry();dg.setAttribute('position',new T.Float32BufferAttribute(dp,3));dg.setIndex(di);dg.computeVertexNormals();const deck=mesh(bridge,dg,0xc4ad80,'stone-bridge-walkable-deck');
 for(const x of[-1.78,1.78]){const pts=[];for(let j=0;j<=24;j++){const z=-4+j/3;pts.push(V(x,deckY(z)+.7,z));}mesh(bridge,new T.TubeGeometry(new T.CatmullRomCurve3(pts),24,.22,7,false),0xb9a37d,'bridge-low-stone-parapet');for(const z of[-3.3,3.3])box(bridge,[x,-.65,z],[.5,1.7,.9],0xb9a37d,'bridge-bank-footing');}
 // Farm gate remains open and leaves a clear central passage.
 const gate=new T.Group();gate.name='morris-farm-open-gate';const gatePoint=terrain.route.at(terrain.route.farmGateS??terrain.route.bridge.s+9);gate.position.set(gatePoint.x,heightAt(gatePoint.x,gatePoint.z),gatePoint.z);gate.rotation.y=Math.atan2(gatePoint.tx,gatePoint.tz);root.add(gate);for(const x of[-2.4,2.4]){box(gate,[x,1,0],[.5,2,.5],0xc6b38a,'gate-stone-post');const ball=mesh(gate,new T.SphereGeometry(.34,10,7),0xbca578,'gate-stone-finial');ball.position.set(x,2.14,0);for(const y of[.45,1,1.5]){const rail=box(gate,[x+(x>0?1:-1),y,.6],[2,.11,.12],0x78613e,'farm-open-wood-rail');rail.rotation.y=x>0?-.6:.6;}}
 // Irregular embedded bank masses, not a necklace of loose pebbles.
 let bankSeed=930127;const bankRandom=()=>{bankSeed=(Math.imul(bankSeed,1664525)+1013904223)>>>0;return bankSeed/4294967296;};
 const rockPoints=[];for(let i=4;i<stream.length-4;i+=2+Math.floor(bankRandom()*5)){
  const p=stream[i],a=stream[i-1],b=stream[i+1],d=Math.hypot(b.x-a.x,b.z-a.z)||1;
  for(const side of[-1,1]){
   if(bankRandom()<.28)continue;
   const offset=1.6+bankRandom()*1.0,jitter=(bankRandom()-.5)*1.8,x=p.x-(b.z-a.z)/d*side*offset+(b.x-a.x)/d*jitter,z=p.z+(b.x-a.x)/d*side*offset+(b.z-a.z)/d*jitter;
   const size=.5+bankRandom()*.85;
   if(terrain.route.nearest(x,z).distance<3.8||!canDress(x,z))continue;
   if(Array.from({length:8},(_,j)=>canDress(x+Math.cos(j*Math.PI/4)*size,z+Math.sin(j*Math.PI/4)*size)).some(v=>!v))continue;
   rockPoints.push({x,z,i,side,size});
  }
 }
 const bankRockGeometry=new T.IcosahedronGeometry(1,1),bp=bankRockGeometry.attributes.position;
 for(let j=0;j<bp.count;j++){const x=bp.getX(j),y=bp.getY(j),z=bp.getZ(j),r=1+.055*Math.sin(x*7+z*4)*Math.cos(y*6);bp.setXYZ(j,x*r,y*r,z*r);}bankRockGeometry.computeVertexNormals();
 const creekStones=new T.InstancedMesh(bankRockGeometry,new T.MeshStandardMaterial({color:0xd3b886,roughness:1}),rockPoints.length),rockDummy=new T.Object3D();creekStones.name='morris-real-creek-bank-boulders';
 rockPoints.forEach((p,i)=>{const y=heightAt(p.x,p.z),ex=.35,normal=V(heightAt(p.x-ex,p.z)-heightAt(p.x+ex,p.z),2*ex,heightAt(p.x,p.z-ex)-heightAt(p.x,p.z+ex)).normalize();
  rockDummy.position.set(p.x,y-.22,p.z);rockDummy.quaternion.setFromUnitVectors(V(0,1,0),normal);rockDummy.rotateY(p.i*.8);rockDummy.scale.set(p.size,.62*p.size,.84*p.size);rockDummy.updateMatrix();creekStones.setMatrixAt(i,rockDummy.matrix);
  creekStones.setColorAt(i,new T.Color().setHex(i%3===0?0xc8ac7b:i%3===1?0xdac492:0xceb88c));
 });creekStones.computeBoundingSphere();creekStones.castShadow=creekStones.receiveShadow=true;root.add(creekStones);
 const bridgeDetail=dressMorrisBridge({bridge,deckY});bridgeDetail.authoredLocalSpan=bridgeDetail.span;bridgeDetail.span*=bridge.scale.z;bridgeDetail.walkWidth*=bridge.scale.x;const shoulders=installMorrisRockShoulders({root,heightAt,R,canDress,canFace});
 const coast=edge?installMorrisCoastRocks({root,heightAt,edge,R,canDress}):null;
 const c=terrain.castle,castleBuild=createMorrisCastle({root,position:V(c.x,heightAt(c.x,c.z)+.025,c.z)}),castle=castleBuild.castle;
 const facadePlants=dressMorrisFacadeVines(castle);
 const musicCourt={...terrain.musicCourt,position:V(terrain.musicCourt.x,heightAt(terrain.musicCourt.x,terrain.musicCourt.z),terrain.musicCourt.z),routeS:terrain.route.report.marks.eastEnd};
 // A short ground-following approach lets mounted visitors reach the lower court
 // without cutting the castle foundation or placing a stair across the ride.
 const courtApproach=terrain.route.branch.map(p=>({x:p.x,z:p.z,y:heightAt(p.x,p.z,p.h)+.065}));
 // The full court branch is drawn together with the main road in MorrisIsland.
 const courtWalk=new T.Group();courtWalk.name='morris-court-branch-marker';root.add(courtWalk);
 musicCourt.routeS=terrain.route.patrolCourtS;musicCourt.approach=courtApproach;musicCourt.entry=courtApproach.at(-1);musicCourt.approachWidth=3.2;
 const supports=[riverbed,deck,...castleBuild.supports,shoulders.mesh,...(coast?[coast.mesh]:[])];root.updateWorldMatrix(true,true);
 let bridgeMaxRadialGrade=0;for(let j=1;j<=80;j++){const za=-4+(j-1)*.1,zb=-4+j*.1,a=bridge.localToWorld(V(0,deckY(za),za)),b=bridge.localToWorld(V(0,deckY(zb),zb)),dr=b.length()-a.length(),d=a.distanceTo(b);bridgeMaxRadialGrade=Math.max(bridgeMaxRadialGrade,Math.abs(dr)/Math.sqrt(Math.max(1e-8,d*d-dr*dr)));}

 return{water,bridge,deck,gate,castle,musicCourt,supports,report:{landformRevision:terrain.landformReport.revision,layers:terrain.layers,musicCourt:{x:musicCourt.x,z:musicCourt.z,radialHeight:musicCourt.radialHeight,castleHeightDifference:10.5-musicCourt.radialHeight,routeS:musicCourt.routeS,approachWidth:musicCourt.approachWidth,entry:musicCourt.entry,mode:'actual lower eastern shoulder, original musician ensemble'},mountainRoute:terrain.route.report,stream:'monotone continuous descent and segment-projected joined riverbed r21',streamLevels:terrain.levels,creekBankBoulders:rockPoints.length,bridgeDetail,bridgeCrownRise:.75,bridgeMaxRadialGrade,facadePlants,creekFlow:"local animated UV flow and broken bank foam",rockShoulderGroups:shoulders.count,coastRockGroups:coast?.count??0,bridge:'real curved deck and stone parapets',farmGate:'open wooden rails between stone posts',castle:'preserved modular keep, stepped wings and open arch; independent Morris lower music shoulder',castleDesign:castleBuild.report,wholeNavigationVerified:false},update(t){creekTime.value=t;ripples.forEach((m,i)=>{const q=stream[Math.floor((t*7+i*6)%stream.length)];m.position.set(q.x,terrain.height(q.x,q.z,q.h)+.045,q.z);m.rotation.y=Math.sin(i)*.3;});}};
}
