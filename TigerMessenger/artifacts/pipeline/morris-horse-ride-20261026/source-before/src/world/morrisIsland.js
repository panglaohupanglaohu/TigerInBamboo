import {createMorrisTerrain,installMorrisLandscape} from './morrisLandscape.js?v=morris-route-r27';
import * as T from 'three';
import {quatYToDir} from './sphereMath.js';
import {chooseMorrisIslandSite} from './morrisIslandSite.js?v=morris-route-r27';
import {createMorrisHorse,animateMorrisHorse} from './morrisHorse.js';
import {installMorrisBotany} from './morrisBotany.js?v=morris-route-r27';
import {createMorrisWildlife} from './morrisWildlife.js?v=morris-route-r27';
import {createMorrisFlora} from './morrisFlora.js?v=morris-route-r27-20261026';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export function createMorrisIsland({scene,R=160,obstacles=[],curves=[],near=null,route=null,birdAudio=null,anchor=null,sourceSample=null,protectedSites=[]}={}){
 const linearScale=Math.sqrt(7),radius=22*linearScale;
 const site=chooseMorrisIslandSite({obstacles,curves,R,near,footprintRadius:radius,route,anchor}),root=new T.Group();root.name='morris-brocade-flower-island';root.position.copy(site.direction).multiplyScalar(R);root.quaternion.copy(quatYToDir(site.direction));
 if(route){const up=site.direction.clone(),front=route.departure.clone().normalize();front.addScaledVector(up,-front.dot(up)).normalize();const right=new T.Vector3().crossVectors(up,front).normalize();root.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,front));}
 scene?.add(root);
 let seed=74291;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const edge=a=>radius*(1+.055*Math.sin(a*3+.7)+.028*Math.cos(a*7));
 const terrain=createMorrisTerrain(R,edge),rawElevation=terrain.elevation;
 root.updateWorldMatrix(true,false);const inverse=root.matrixWorld.clone().invert();
 const keepouts=protectedSites.map(s=>{const q=s.position.clone().applyMatrix4(inverse);return{x:q.x,z:q.z,r:s.radius??2,h:(s.floorRadius??s.position.length())-R};}).filter(s=>Math.hypot(s.x,s.z)<radius+10);
 const railKeepouts=curves.filter(c=>c?.getSpacedPoints).flatMap(c=>c.getSpacedPoints(1200)).map(p=>{const q=p.clone().applyMatrix4(inverse);return{x:q.x,z:q.z,r:4.5,h:p.length()-R-.12};}).filter(s=>Math.hypot(s.x,s.z)<radius+8);
 const oldGroundCache=new Map();
 const originalGround=(x,z,h)=>{if(!sourceSample)return null;const key=x.toFixed(3)+','+z.toFixed(3);if(oldGroundCache.has(key))return oldGroundCache.get(key);const y=Math.sqrt(Math.max(1,(R+(h??.6))**2-x*x-z*z))-R;const r=sourceSample(root.localToWorld(new T.Vector3(x,y,z)));oldGroundCache.set(key,r);return r;};
 const radialHeight=(x,z)=>{let h=rawElevation(x,z);if(h==null)return null;for(const s of [...keepouts,...railKeepouts]){const d=Math.hypot(x-s.x,z-s.z);if(d<s.r+2){const w=1-T.MathUtils.smoothstep(d,s.r,s.r+2);h=T.MathUtils.lerp(h,Math.min(h,s.h),w);}}
 const u=Math.hypot(x,z)/edge(Math.atan2(z,x));if(u>.82){const r=originalGround(x,z,h);if(Number.isFinite(r))h=T.MathUtils.lerp(h,r-R,T.MathUtils.smoothstep(u,.82,1));}return h;};
 const heightAt=(x,z,h=radialHeight(x,z))=>Math.sqrt(Math.max(1,(R+(h??-.75))**2-x*x-z*z))-R;
 terrain.elevation=radialHeight;terrain.height=heightAt;
 const p=[],colors=[],ix=[],rings=56,segments=192,c1=new T.Color(0x738349),c2=new T.Color(0xc8b88d),col=new T.Color();
 for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,r=edge(a)*j/rings,x=Math.cos(a)*r,z=Math.sin(a)*r,y=heightAt(x,z);p.push(x,y,z);const join=j/rings>.82&&Number.isFinite(originalGround(x,z,radialHeight(x,z)));col.copy(c1).lerp(new T.Color(0x999171),T.MathUtils.smoothstep(radialHeight(x,z)??0,9,24)).lerp(c2,join?0:T.MathUtils.smoothstep(j/rings,.92,.985));colors.push(col.r,col.g,col.b);}
 for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;ix.push(a,b,a+1,b,b+1,a+1);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(ix);geo.computeVertexNormals();const slopeNormal=geo.attributes.normal,slopePos=geo.attributes.position,slopeColors=geo.attributes.color,stone=new T.Color(0xa8a18b),shadeStone=new T.Color(0x858b78),surfaceColor=new T.Color();for(let k=0;k<slopePos.count;k++){const pos=new T.Vector3().fromBufferAttribute(slopePos,k),normal=new T.Vector3().fromBufferAttribute(slopeNormal,k),up=pos.clone().add(new T.Vector3(0,R,0)).normalize(),weight=T.MathUtils.smoothstep(1-Math.abs(normal.dot(up)),.18,.55);surfaceColor.fromBufferAttribute(slopeColors,k);const rockColor=shadeStone.clone().lerp(stone,.5+.15*Math.sin(pos.y*2+pos.x*.12+pos.z*.1));surfaceColor.lerp(rockColor,weight*.9);slopeColors.setXYZ(k,surfaceColor.r,surfaceColor.g,surfaceColor.b);}geo.computeBoundingSphere();const ground=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));ground.name='morris-island-real-spherical-ground';ground.receiveShadow=true;root.add(ground);
 // The sandy S-walk is deliberately open; blooms grow in interlaced bands around it.
 const routePlan=terrain.route,pathDistance=(x,z)=>routePlan.nearest(x,z).distance,pathX=z=>routePlan.points.reduce((p,q)=>Math.abs(q.z-z)<Math.abs(p.z-z)?q:p).x;
 const canPlant=(x,z)=>!railKeepouts.some(s=>Math.hypot(x-s.x,z-s.z)<s.r+1)&&!keepouts.some(s=>Math.hypot(x-s.x,z-s.z)<s.r+1)&&(radialHeight(x,z)??99)<24&&Math.abs((radialHeight(x+.6,z)??99)-(radialHeight(x-.6,z)??99))<2&&Math.abs((radialHeight(x,z+.6)??99)-(radialHeight(x,z-.6)??99))<2&&Math.hypot(x-14,z-5)>12&&!terrain.stream.some(p=>Math.hypot(x-p.x,z-p.z)<3.2);
 const pathP=[],pathI=[],roadCenters=[];for(let j=0;j<routePlan.points.length;j++){const p=routePlan.points[j],a=routePlan.points[Math.max(0,j-1)],b=routePlan.points[Math.min(routePlan.points.length-1,j+1)],dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz)||1,nx=-dz/d,nz=dx/d;for(const side of[-1,1]){const x=p.x+side*nx*1.6,z=p.z+side*nz*1.6;pathP.push(x,heightAt(x,z,p.h)+.065,z);}roadCenters.push(new T.Vector3(p.x,heightAt(p.x,p.z,p.h)+.065,p.z));if(j<routePlan.points.length-1&&!routePlan.isBridge((p.s+routePlan.points[j+1].s)/2)){const n=j*2;pathI.push(n,n+2,n+1,n+1,n+2,n+3);}}
 const pg=new T.BufferGeometry();pg.setAttribute('position',new T.Float32BufferAttribute(pathP,3));pg.setIndex(pathI);pg.computeVertexNormals();const walk=new T.Mesh(pg,new T.MeshStandardMaterial({color:0xc4af7e,roughness:1,side:T.DoubleSide}));walk.name='morris-real-switchback-mountain-approach';walk.receiveShadow=true;root.add(walk);
 let actualMaxGrade=0;for(let j=1;j<roadCenters.length;j++){if(routePlan.isBridge(routePlan.points[j].s))continue;const a=roadCenters[j-1].clone().add(new T.Vector3(0,R,0)),b=roadCenters[j].clone().add(new T.Vector3(0,R,0)),dr=b.length()-a.length(),dist=a.distanceTo(b),tangent=Math.sqrt(Math.max(1e-8,dist*dist-dr*dr));actualMaxGrade=Math.max(actualMaxGrade,Math.abs(dr)/tangent);}
 routePlan.report.actualRoadMaxRadialGrade=actualMaxGrade;routePlan.report.surface='real graded ground shoulders plus raycast-supported winding road mesh';
 const landscape=installMorrisLandscape({root,terrain,heightAt,R,pathX,canDress:(x,z)=>!railKeepouts.some(s=>Math.hypot(x-s.x,z-s.z)<s.r+5)&&!keepouts.some(s=>Math.hypot(x-s.x,z-s.z)<s.r+5)&&Math.hypot(x-14,z-5)>14&&pathDistance(x,z)>5});
 landscape.supports.push(walk);
 const flora=createMorrisFlora({group:root,heightAt,pathDistance,random,linearScale,canPlant}),horses=[];
 for(const[i,x,z,yaw]of[[0,-24,20,0],[1,40,26,-.55],[2,-10,37,1.1]]){const horse=createMorrisHorse({coat:[0xe7dec4,0xb8a584,0x655044][i],cloth:[0x8c303c,0x1b5261,0x77513f][i],seed:i});horse.scale.multiplyScalar(.45);horse.position.set(x,heightAt(x,z),z);horse.rotation.y=yaw;root.add(horse);
  // Seat each hoof on the actual authored slope, without tilting the whole horse.
  horse.updateMatrix();
  for(const leg of horse.userData.horse.legs){const foot=new T.Vector3(0,-1.59,.1).add(leg.position).applyMatrix4(horse.matrix);leg.position.y+=(heightAt(foot.x,foot.z)-foot.y)/horse.scale.y;}
  horses.push(horse);}
 const canTree=(x,z)=>radialHeight(x,z)!=null&&pathDistance(x,z)>4&&!railKeepouts.some(s=>Math.hypot(x-s.x,z-s.z)<s.r+3)&&!keepouts.some(s=>Math.hypot(x-s.x,z-s.z)<s.r+3)&&Math.hypot(x-14,z-5)>14&&!terrain.stream.some(p=>Math.hypot(x-p.x,z-p.z)<3.5);
 const botany=installMorrisBotany({root,heightAt,pathDistance,canPlant,canTree});
 const wildlife=createMorrisWildlife({root,heightAt,trees:botany.trees,safeSite:(x,z)=>canPlant(x,z)&&pathDistance(x,z)>3,playBird:(kind,position)=>birdAudio?.play(kind,position)??false});
 const ray=new T.Raycaster(),worldUp=new T.Vector3();
 const report={revision:'morris-route-r27-20261026',style:'Arts and Crafts / William Morris inspired original geometry',site:site.report,flowers:flora.flowerCount,bouquetClumps:flora.bouquetClumps,floraRevision:flora.revision,curledLeafClumps:flora.acanthusClumps,horses:3,animalScaleRatio:.45,animalRelativeToV2:.6,plantScaleRatio:.85,treeHeightRatio:1.9,terrainLayout:"central highland, asymmetric shoulders, low surrounding meadows",planarAreaRatio:7,linearScale,radius,diameter:radius*2,pathWidth:3.2,protectedExistingSites:keepouts.length,protectedRailSamples:railKeepouts.length,originalShoreJoin:!!sourceSample,...landscape.report,...botany.report,rabbits:8,robins:4,cuckoos:3,oldSceneMoved:false,navigationTraversalVerified:false};
 const api={root,ground,survey:site.survey,horses,botany,wildlife,landscape,route:routePlan,walk,near,report,heightAt,radialHeight,previewListening:false,requestBird:null,audioStatus:()=>birdAudio?.status()??null,
  sampleGroundRadius(position){root.updateWorldMatrix(true,false);const local=root.worldToLocal(position.clone());if(Math.hypot(local.x,local.z)>radius*1.085||local.y< -24||local.y>70)return null;const h=radialHeight(local.x,local.z);if(h===null)return null;worldUp.copy(position).normalize();ray.set(worldUp.clone().multiplyScalar(R+50),worldUp.clone().negate());ray.far=95;const hit=ray.intersectObjects([ground,...landscape.supports],false)[0];return hit?.point.length()??null;},
  update(dt,time){horses.forEach(h=>animateMorrisHorse(h,time));wildlife.update(dt,time);landscape.update(time);if(api.requestBird){wildlife.call(api.requestBird);api.requestBird=null;}},
  dispose(){root.removeFromParent();const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ms.add(m));});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}
 };
 root.userData.morrisIsland=report;return api;
}
