import * as THREE from 'three';
import {buildMixedGrid,buildQuadGrid} from '../core/grid.js';
import {World,MAX_LEVEL} from '../core/world.js';
import {buildLayeredNav} from '../world/layerednav.js';
import {BattleNavigation} from '../world/battle-navigation.js';
import {decorateCells,buildCellIndex} from '../core/spatial.js';
const Q=new URLSearchParams(location.search);if(Q.get('fine')==='1')document.querySelector('#fine').checked=true;if(Q.get('finenav')==='0')document.querySelector('#finenav').checked=false;if(Q.get('mixed')==='0')document.querySelector('#mixed').checked=false;if(Q.get('roof')==='0')document.querySelector('#roof').checked=false;
const unitHeight=+(Q.get('h')??.3);
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#c6d9d8');
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.1,100);
scene.add(new THREE.HemisphereLight('#fff9df','#536d82',2.5));const sun=new THREE.DirectionalLight('#ffedd8',3);sun.position.set(-6,12,4);scene.add(sun);
const worldGroup=new THREE.Group(),roofGroup=new THREE.Group();scene.add(worldGroup,roofGroup);
let angle=.65,pitch=.65,distance=24,drag=null,nav,world,route=[],line,traveler;
if(Q.get('pitch'))pitch=+Q.get('pitch');if(Q.get('dist'))distance=+Q.get('dist');if(Q.get('angle'))angle=+Q.get('angle');
function dispose(group){for(const o of [...group.children]){group.remove(o);o.geometry?.dispose();o.material?.dispose()}}
function rebuild(){
 dispose(worldGroup);dispose(roofGroup);if(line){scene.remove(line);line.geometry.dispose();line.material.dispose()}if(traveler){scene.remove(traveler);traveler.geometry.dispose();traveler.material.dispose()}
 const mixed=document.querySelector('#mixed').checked;
 const grid=mixed?buildMixedGrid({radius:4,hexSize:1,mergeRate:.55,seed:5}):buildQuadGrid({radius:4,hexSize:1,seed:5});world=new World(grid);
 const fine=document.querySelector('#fine').checked;
 if(!fine){for(const c of world.cells){world.fill(c,1,{rock:true});if(Math.abs(c.cx)<1.4)world.setSolid(c,3,true,{rock:true})}}
 else{ // 拱洞墙：x≈0 一道 4 层墙，隔格挖掉 2 层 → 两侧有支撑的方格成拱（buildings.js 同规则），其余挖口是平底 + 钢柱
  // 墙厚 |x|<.9；两条洞道 = 被水平线 z=z0 穿过的墙格挖掉 2 层（一格宽 → 上下邻格托着 → 拱；否则平底 + 钢柱）
  const wall=world.cells.filter(c=>Math.abs(c.cx)<.9),zr=c=>[Math.min(...c.pts.map(p=>p.z)),Math.max(...c.pts.map(p=>p.z))];
  for(const c of world.cells){world.fill(c,1,{rock:true});}
  for(const c of wall)for(let lv=2;lv<=4;lv++)world.setSolid(c,lv,true,{rock:true});
  for(const c of wall){const [a,b]=zr(c);if([-1.83,1.07].some(z0=>a<z0&&b>z0))world.setSolid(c,2,false);}
 }
 nav=buildLayeredNav(world,{maxStep:0,headroom:document.querySelector('#tall').checked?2:1});
 for(const c of world.cells)for(let lv=1;lv<=MAX_LEVEL;lv++){
  if(!world.isSolid(c,lv))continue;
  const s=new THREE.Shape();c.pts.forEach((p,i)=>i?s.lineTo(p.x,-p.z):s.moveTo(p.x,-p.z));s.closePath();
  const geo=new THREE.ExtrudeGeometry(s,{depth:.5,bevelEnabled:false});geo.rotateX(-Math.PI/2);geo.translate(0,(lv-1)*.5,0);
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:lv===1?'#c4d6a3':'#a99dbb',roughness:1,flatShading:true,transparent:fine&&lv>1,opacity:fine&&lv>1?.38:1,depthWrite:!(fine&&lv>1)}));(lv>1?roofGroup:worldGroup).add(mesh);
 }
 const left=world.cells.reduce((a,b)=>b.cx<a.cx?b:a),right=world.cells.reduce((a,b)=>b.cx>a.cx?b:a);
 const heightmap=document.querySelector('#heightmap').checked;
 if(heightmap){for(let i=0;i<nav.adj.length;i++){const a=nav.nodes[i];nav.adj[i]=a.floor===world.top(a.cell)?nav.adj[i].filter(e=>nav.nodes[e.to].floor===world.top(nav.nodes[e.to].cell)):[]}}
 route=nav.search(nav.at(left,1),nav.at(right,1)).path;
 if(fine)return rebuildFine(grid,left,right,mixed);
 const positions=route.map(id=>{const n=nav.nodes[id];return new THREE.Vector3(n.x,n.floor*.5+.07,n.z)});
 line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(positions),new THREE.LineBasicMaterial({color:'#0b947b',depthTest:false}));line.renderOrder=10;scene.add(line);
 traveler=new THREE.Mesh(new THREE.SphereGeometry(.12,12,8),new THREE.MeshStandardMaterial({color:'#fff3c7'}));traveler.visible=route.length>0;scene.add(traveler);
 roofGroup.visible=document.querySelector('#roof').checked;
 document.querySelector('#stats').textContent=`${mixed?'混合网格':'四边形网格'} · ${world.cells.length} 格 · ${nav.nodes.length} 可站点 · ${route.length?`路径 ${route.length} 节点，穿过下层洞口`:'无可达路径'} · ${heightmap?'仅柱顶':'多层图'}`;
 window.navReview={world,nav,route,rebuild};
}
/** 精细门户：BattleNavigation（finePortals）在同一个 World 上算门户与侧壁；小人用 plan/steerTarget/move 真走一遍，画出实际轨迹。 */
function rebuildFine(grid,left,right,mixed){
 decorateCells(grid);const index=buildCellIndex(grid),on=document.querySelector('#finenav').checked;
 const bn=new BattleNavigation(world,index,{levelHeight:.5,finePortals:on,unitHeight});bn.refresh();
 const probe=on?bn.fine:new BattleNavigation(world,index,{levelHeight:.5,finePortals:true,unitHeight}),fp=on?bn.fine:(probe.refresh(),probe.fine);
 const seg=(pts,color,y)=>{const g=new THREE.BufferGeometry().setFromPoints(pts.flatMap(([a,b])=>[new THREE.Vector3(a.x,y,a.z),new THREE.Vector3(b.x,y,b.z)]));const m=new THREE.LineSegments(g,new THREE.LineBasicMaterial({color,depthTest:false}));m.renderOrder=11;worldGroup.add(m);};
 const green=[],red=[],orange=[];const g=on?bn.graph:probe.graph;
 for(const [from,list] of g.adj.entries()){const n=g.nodes[from];if(!fp.under[from])continue;
  for(const e of list){const f=fp.aperture(from,e.portal.edge),c=n.cell,P0=c.pts[e.portal.edge],P1=c.pts[(e.portal.edge+1)%c.n];
   if(!f||f.width<=0){red.push([P0,P1]);continue;}green.push([f.p,f.q]);if(f.t0>1e-6)red.push([P0,f.p]);if(f.t1<1-1e-6)red.push([f.q,P1]);}
  for(const w of fp.under[from].sideWalls)orange.push(w);
  for(const leg of fp.under[from].legs){const m=new THREE.Mesh(new THREE.CylinderGeometry(leg.r,leg.r,.5,8),new THREE.MeshStandardMaterial({color:'#5d6670'}));m.position.set(leg.x,.75,leg.z);worldGroup.add(m);}
 }
 seg(green,'#18a058',.53);seg(red,'#d63a3a',.535);seg(orange,'#f08a1c',.54);
 // 实走：半径 .055 的小人
 const u={x:left.cx,z:left.cz,y:.5,navFloor:1,radius:.055},trail=[];let ok=false,inside=[];
 for(let k=0;k<2500;k++){const p=bn.plan(u,right,1);if(!p)break;trail.push(new THREE.Vector3(u.x,.57,u.z));if(p.arrived&&Math.hypot(u.x-right.cx,u.z-right.cz)<.25){ok=true;break;}
  const aim=bn.steerTarget(u,p)??p.next,dx=aim.x-u.x,dz=aim.z-u.z,l=Math.hypot(dx,dz)||1,s=Math.min(.03,l);
  if(!bn.move(u,u.x+dx/l*s,u.z+dz/l*s,p))bn.move(u,u.x+dx/l*s,u.z,p)||bn.move(u,u.x,u.z+dz/l*s,p);
  const c=index.cellAt(u.x,u.z),nd=c&&g.nodes[g.at(c,1)];if(nd&&fp.under[nd.id])inside.push({x:u.x,z:u.z,id:nd.id});}
 route=trail.length>1?trail:[];
 line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(trail),new THREE.LineBasicMaterial({color:'#0b947b',depthTest:false}));line.renderOrder=12;scene.add(line);
 traveler=new THREE.Mesh(new THREE.SphereGeometry(.07,12,8),new THREE.MeshStandardMaterial({color:'#fff3c7'}));scene.add(traveler);
 // 穿洞时离被封段 / 侧壁的最近距离（开精细门户应 ≥ 半径）
 const sd=(x,z,a,b)=>{const ex=b.x-a.x,ez=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*ex+(z-a.z)*ez)/(ex*ex+ez*ez||1)));return Math.hypot(x-a.x-ex*t,z-a.z-ez*t);};
 const minClear=inside.length?Math.min(...inside.map(q=>Math.min(Infinity,...red.concat(orange).map(([a,b])=>sd(q.x,q.z,a,b))))):null;
 const st=fp.stats();roofGroup.visible=document.querySelector('#roof').checked;
 document.querySelector('#stats').textContent=`${mixed?'混合网格':'四边形网格'} · 拱 ${st.archNodes} 格（侧壁 ${st.sideWalls}）· 平底 ${st.flatNodes} 格（钢柱 ${st.legs}）· 门户收窄 ${st.narrowed} / 封死 ${st.closed} · 身高 ${unitHeight} · ${on?'按门户走':'按整条格边走（旧）'}：${ok?'到达':'未到达'}，洞内离封段最近 ${minClear==null?'—':minClear.toFixed(3)}`;
 window.navReview={world,nav:bn.graph,fine:st,route:trail.length,ok,minClear,inside:inside.length,on,rebuild};
}
for(const id of ['mixed','heightmap','tall','fine','finenav'])document.querySelector('#'+id).onchange=rebuild;
document.querySelector('#roof').onchange=e=>roofGroup.visible=e.target.checked;
const canvas=renderer.domElement;canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(!drag)return;angle-=(e.clientX-drag[0])*.006;pitch=Math.max(.15,Math.min(1.3,pitch+(e.clientY-drag[1])*.006));drag=[e.clientX,e.clientY]};canvas.onpointerup=()=>drag=null;canvas.onwheel=e=>{e.preventDefault();distance=Math.max(8,Math.min(40,distance+e.deltaY*.015))};
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}addEventListener('resize',resize);resize();rebuild();
renderer.setAnimationLoop(t=>{camera.position.set(Math.sin(angle)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(angle)*Math.cos(pitch)*distance);camera.lookAt(0,.5,0);if(route.length&&route[0].isVector3){traveler.position.copy(route[Math.floor(t/16)%route.length]);}else if(route.length){const f=(t/450)%(route.length-1),i=Math.floor(f),a=nav.nodes[route[i]],b=nav.nodes[route[Math.min(i+1,route.length-1)]];traveler.position.set(a.x+(b.x-a.x)*(f-i),a.floor*.5+.14,a.z+(b.z-a.z)*(f-i))}renderer.render(scene,camera)});
