import {createMorrisTerrain,installMorrisLandscape} from './morrisLandscape.js?v=morris-ecology-r5';
import * as T from 'three';
import {quatYToDir} from './sphereMath.js';
import {chooseMorrisIslandSite} from './morrisIslandSite.js?v=morris-ecology-r5';
import {createMorrisHorse,animateMorrisHorse} from './morrisHorse.js';
import {installMorrisBotany} from './morrisBotany.js?v=morris-ecology-r5';
import {createMorrisWildlife} from './morrisWildlife.js?v=morris-ecology-r5';
import {createMorrisFlora} from './morrisFlora.js?v=morris-ecology-r5-20261026';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export function createMorrisIsland({scene,R=160,obstacles=[],curves=[],near=null,route=null,birdAudio=null}={}){
 const linearScale=Math.sqrt(7),radius=22*linearScale;
 const site=chooseMorrisIslandSite({obstacles,curves,R,near,footprintRadius:radius,route}),root=new T.Group();root.name='morris-brocade-flower-island';root.position.copy(site.direction).multiplyScalar(R);root.quaternion.copy(quatYToDir(site.direction));
 if(route){const up=site.direction.clone(),front=route.departure.clone().normalize();front.addScaledVector(up,-front.dot(up)).normalize();const right=new T.Vector3().crossVectors(up,front).normalize();root.quaternion.setFromRotationMatrix(new T.Matrix4().makeBasis(right,up,front));}
 scene?.add(root);
 let seed=74291;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const edge=a=>radius*(1+.055*Math.sin(a*3+.7)+.028*Math.cos(a*7));
 const terrain=createMorrisTerrain(R,edge),radialHeight=terrain.elevation,heightAt=terrain.height;
 const p=[],colors=[],ix=[],rings=56,segments=192,c1=new T.Color(0x486f51),c2=new T.Color(0xc8b88d),col=new T.Color();
 for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,r=edge(a)*j/rings,x=Math.cos(a)*r,z=Math.sin(a)*r,y=heightAt(x,z);p.push(x,y,z);col.copy(c1).lerp(new T.Color(0x7b8471),T.MathUtils.smoothstep(radialHeight(x,z)??0,9,24)).lerp(c2,T.MathUtils.smoothstep(j/rings,.92,.985));colors.push(col.r,col.g,col.b);}
 for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;ix.push(a,b,a+1,b,b+1,a+1);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(ix);geo.computeVertexNormals();geo.computeBoundingSphere();const ground=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));ground.name='morris-island-real-spherical-ground';ground.receiveShadow=true;root.add(ground);
 // The sandy S-walk is deliberately open; blooms grow in interlaced bands around it.
 const pathX=z=>{if(z<6){const u=T.MathUtils.clamp((6-z)/26,0,1);return 10+4*u+4*Math.sin(u*Math.PI);}return z<17?10:10*Math.cos((z-17)*.06);},pathDistance=(x,z)=>Math.abs(x-pathX(z));
 const canPlant=(x,z)=>z> -25&&Math.hypot(x-14,z+20)>12&&!terrain.stream.some(p=>Math.hypot(x-p.x,z-p.z)<3.2);
 const pathP=[],pathI=[];for(let i=0;i<=180;i++){const z=-17+i*71/180,x=pathX(z);for(const side of[-1,1]){const xx=x+side*1.6;pathP.push(xx,heightAt(xx,z)+.018,z);}if(i<180){const a=i*2;pathI.push(a,a+2,a+1,a+1,a+2,a+3);}}
 const pg=new T.BufferGeometry();pg.setAttribute('position',new T.Float32BufferAttribute(pathP,3));pg.setIndex(pathI);pg.computeVertexNormals();const walk=new T.Mesh(pg,new T.MeshStandardMaterial({color:0xc4af7e,roughness:1,side:T.DoubleSide}));walk.name='morris-open-winding-footpath';root.add(walk);
 const landscape=installMorrisLandscape({root,terrain,heightAt,R});
 const flora=createMorrisFlora({group:root,heightAt,pathDistance,random,linearScale,canPlant}),horses=[];
 for(const[i,x,z,yaw]of[[0,-16,4,0],[1,24,-4,-.55],[2,-7,23,1.1]]){const horse=createMorrisHorse({coat:[0xe7dec4,0xb8a584,0x655044][i],cloth:[0x8c303c,0x1b5261,0x77513f][i],seed:i});horse.position.set(x,heightAt(x,z),z);horse.rotation.y=yaw;root.add(horse);
  // Seat each hoof on the actual authored slope, without tilting the whole horse.
  horse.updateMatrix();
  for(const leg of horse.userData.horse.legs){const foot=new T.Vector3(0,-1.59,.1).add(leg.position).applyMatrix4(horse.matrix);leg.position.y+=(heightAt(foot.x,foot.z)-foot.y)/horse.scale.y;}
  horses.push(horse);}
 const botany=installMorrisBotany({root,heightAt,pathDistance,canPlant});
 const wildlife=createMorrisWildlife({root,heightAt,trees:botany.trees,playBird:(kind,position)=>birdAudio?.play(kind,position)??false});
 const ray=new T.Raycaster(),worldUp=new T.Vector3();
 const report={revision:'morris-ecology-r5-20261026',style:'Arts and Crafts / William Morris inspired original geometry',site:site.report,flowers:flora.flowerCount,curledLeafClumps:flora.acanthusClumps,horses:3,planarAreaRatio:7,linearScale,radius,diameter:radius*2,pathWidth:3.2,...landscape.report,...botany.report,rabbits:8,robins:4,cuckoos:3,oldSceneMoved:false,navigationTraversalVerified:false};
 const api={root,ground,horses,botany,wildlife,landscape,near,report,heightAt,radialHeight,previewListening:false,requestBird:null,audioStatus:()=>birdAudio?.status()??null,
  sampleGroundRadius(position){root.updateWorldMatrix(true,false);const local=root.worldToLocal(position.clone());if(Math.hypot(local.x,local.z)>radius*1.085||local.y< -24||local.y>70)return null;const h=radialHeight(local.x,local.z);if(h===null)return null;worldUp.copy(position).normalize();ray.set(worldUp.clone().multiplyScalar(R+50),worldUp.clone().negate());ray.far=95;const hit=ray.intersectObjects([ground,...landscape.supports],false)[0];return hit?.point.length()??null;},
  update(dt,time){horses.forEach(h=>animateMorrisHorse(h,time));wildlife.update(dt,time);landscape.update(time);if(api.requestBird){wildlife.call(api.requestBird);api.requestBird=null;}},
  dispose(){root.removeFromParent();const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ms.add(m));});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}
 };
 root.userData.morrisIsland=report;return api;
}
