import * as T from 'three';
import {quatYToDir} from './sphereMath.js';
import {chooseMorrisIslandSite} from './morrisIslandSite.js';
import {createMorrisHorse,animateMorrisHorse} from './morrisHorse.js';
import {createMorrisFlora} from './morrisFlora.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export function createMorrisIsland({scene,R=160,obstacles=[],curves=[]}={}){
 const site=chooseMorrisIslandSite({obstacles,curves,R}),root=new T.Group();root.name='morris-brocade-flower-island';root.position.copy(site.direction).multiplyScalar(R);root.quaternion.copy(quatYToDir(site.direction));scene?.add(root);
 let seed=74291;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
 const edge=a=>22*(1+.055*Math.sin(a*3+.7)+.028*Math.cos(a*7));
 function radialHeight(x,z){const r=Math.hypot(x,z),u=r/edge(Math.atan2(z,x));if(u>=1)return null;const t=T.MathUtils.smoothstep(u,.73,1);return 1.65+.2*Math.sin(x*.18)*Math.cos(z*.22)-2.3*t;}
 const heightAt=(x,z)=>{const h=radialHeight(x,z);return Math.sqrt(Math.max(1,(R+(h??-.65))**2-x*x-z*z))-R;};
 const p=[],colors=[],ix=[],rings=28,segments=144,c1=new T.Color(0x486f51),c2=new T.Color(0xc8b88d),col=new T.Color();
 for(let j=0;j<=rings;j++)for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2,r=edge(a)*j/rings,x=Math.cos(a)*r,z=Math.sin(a)*r,y=heightAt(x,z);p.push(x,y,z);col.copy(c1).lerp(c2,T.MathUtils.smoothstep(j/rings,.78,.95));colors.push(col.r,col.g,col.b);}
 for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;ix.push(a,b,a+1,b,b+1,a+1);}
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(p,3));geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.setIndex(ix);geo.computeVertexNormals();geo.computeBoundingSphere();const ground=new T.Mesh(geo,new T.MeshStandardMaterial({vertexColors:true,roughness:1,side:T.DoubleSide}));ground.name='morris-island-real-spherical-ground';ground.receiveShadow=true;root.add(ground);
 // The sandy S-walk is deliberately open; blooms grow in interlaced bands around it.
 const pathX=z=>Math.sin((z+4)*.16)*3.7,pathDistance=(x,z)=>Math.abs(x-pathX(z));
 const pathP=[],pathI=[];for(let i=0;i<=100;i++){const z=-20+i*.39,x=pathX(z);for(const side of[-1,1]){const xx=x+side*1.05;pathP.push(xx,heightAt(xx,z)+.018,z);}if(i<100){const a=i*2;pathI.push(a,a+2,a+1,a+1,a+2,a+3);}}
 const pg=new T.BufferGeometry();pg.setAttribute('position',new T.Float32BufferAttribute(pathP,3));pg.setIndex(pathI);pg.computeVertexNormals();const walk=new T.Mesh(pg,new T.MeshStandardMaterial({color:0xc4af7e,roughness:1,side:T.DoubleSide}));walk.name='morris-open-winding-footpath';root.add(walk);
 const flora=createMorrisFlora({group:root,heightAt,pathDistance,random}),horses=[];
 for(const[i,x,z,yaw]of[[0,-6,1,0],[1,6,-2,-.55],[2,1,8,1.1]]){const horse=createMorrisHorse({coat:[0xe7dec4,0xb8a584,0x655044][i],cloth:[0x8c303c,0x1b5261,0x77513f][i],seed:i});horse.position.set(x,heightAt(x,z),z);horse.rotation.y=yaw;root.add(horse);horses.push(horse);}
 // Fruit trees, hand-worked looking leaf masses and perching birds frame the meadow.
 const trees=[];for(const[x,z]of[[-13,12],[12,12],[-14,-10]]){const tree=new T.Group();tree.position.set(x,heightAt(x,z),z);root.add(tree);const wood=new T.MeshStandardMaterial({color:0x77634a,roughness:1}),leaf=new T.MeshStandardMaterial({color:0x264f42,roughness:1}),geos=[];
  for(const side of[-1,0,1]){const curve=new T.CatmullRomCurve3([V(),V(side*.4,2,.15),V(side*1.4,3.9,0),V(side*2.5,4.8,.2)]);const branch=new T.Mesh(new T.TubeGeometry(curve,14,side===0?.22:.13,6,false),wood);tree.add(branch);for(let k=0;k<5;k++){const q=curve.getPoint(.62+k*.08),g=new T.SphereGeometry(1,10,7);g.scale(1.15,.48,.8);g.translate(q.x,q.y,q.z+(k%2?-.5:.5));geos.push(g);}}
  const crown=new T.Mesh(mergeGeometries(geos,false),leaf);tree.add(crown);for(let i=0;i<12;i++){const fruit=new T.Mesh(new T.SphereGeometry(.12,7,5),new T.MeshStandardMaterial({color:0xb54d35,roughness:.8}));fruit.position.set((random()-.5)*4,3.4+random()*1.3,(random()-.5)*1.4);tree.add(fruit);}trees.push(tree);}
 const ray=new T.Raycaster(),worldUp=new T.Vector3();
 const report={revision:'morris-island-v1-20261026',style:'Arts and Crafts / William Morris inspired original geometry',site:site.report,flowers:flora.flowerCount,curledLeafClumps:flora.acanthusClumps,horses:3,pathWidth:2.1,oldSceneMoved:false,navigationTraversalVerified:false};
 const api={root,ground,horses,report,heightAt,radialHeight,
  sampleGroundRadius(position){root.updateWorldMatrix(true,false);const local=root.worldToLocal(position.clone());if(Math.hypot(local.x,local.z)>23||local.y< -12||local.y>35)return null;const h=radialHeight(local.x,local.z);if(h===null)return null;worldUp.copy(position).normalize();ray.set(worldUp.clone().multiplyScalar(R+12),worldUp.clone().negate());ray.far=30;const hit=ray.intersectObject(ground,false)[0];return hit?.point.length()??null;},
  update(dt,time){horses.forEach(h=>animateMorrisHorse(h,time));},
  dispose(){root.removeFromParent();const gs=new Set(),ms=new Set();root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>ms.add(m));});gs.forEach(g=>g.dispose());ms.forEach(m=>m.dispose());}
 };
 root.userData.morrisIsland=report;return api;
}
