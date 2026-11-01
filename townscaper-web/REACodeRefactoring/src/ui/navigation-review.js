import * as THREE from 'three';
import {buildMixedGrid,buildQuadGrid} from '../core/grid.js';
import {World,MAX_LEVEL} from '../core/world.js';
import {buildLayeredNav} from '../world/layerednav.js';
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor('#c6d9d8');
const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(42,1,.1,100);
scene.add(new THREE.HemisphereLight('#fff9df','#536d82',2.5));const sun=new THREE.DirectionalLight('#ffedd8',3);sun.position.set(-6,12,4);scene.add(sun);
const worldGroup=new THREE.Group(),roofGroup=new THREE.Group();scene.add(worldGroup,roofGroup);
let angle=.65,pitch=.65,distance=24,drag=null,nav,world,route=[],line,traveler;
function dispose(group){for(const o of [...group.children]){group.remove(o);o.geometry?.dispose();o.material?.dispose()}}
function rebuild(){
 dispose(worldGroup);dispose(roofGroup);if(line){scene.remove(line);line.geometry.dispose();line.material.dispose()}if(traveler){scene.remove(traveler);traveler.geometry.dispose();traveler.material.dispose()}
 const mixed=document.querySelector('#mixed').checked;
 const grid=mixed?buildMixedGrid({radius:4,hexSize:1,mergeRate:.55,seed:5}):buildQuadGrid({radius:4,hexSize:1,seed:5});world=new World(grid);
 for(const c of world.cells){world.fill(c,1,{rock:true});if(Math.abs(c.cx)<1.4)world.setSolid(c,3,true,{rock:true})}
 nav=buildLayeredNav(world,{maxStep:0,headroom:document.querySelector('#tall').checked?2:1});
 for(const c of world.cells)for(let lv=1;lv<=MAX_LEVEL;lv++){
  if(!world.isSolid(c,lv))continue;
  const s=new THREE.Shape();c.pts.forEach((p,i)=>i?s.lineTo(p.x,-p.z):s.moveTo(p.x,-p.z));s.closePath();
  const geo=new THREE.ExtrudeGeometry(s,{depth:.5,bevelEnabled:false});geo.rotateX(-Math.PI/2);geo.translate(0,(lv-1)*.5,0);
  const mesh=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({color:lv===1?'#c4d6a3':'#a99dbb',roughness:1,flatShading:true}));(lv>1?roofGroup:worldGroup).add(mesh);
 }
 const left=world.cells.reduce((a,b)=>b.cx<a.cx?b:a),right=world.cells.reduce((a,b)=>b.cx>a.cx?b:a);
 const heightmap=document.querySelector('#heightmap').checked;
 if(heightmap){for(let i=0;i<nav.adj.length;i++){const a=nav.nodes[i];nav.adj[i]=a.floor===world.top(a.cell)?nav.adj[i].filter(e=>nav.nodes[e.to].floor===world.top(nav.nodes[e.to].cell)):[]}}
 route=nav.search(nav.at(left,1),nav.at(right,1)).path;
 const positions=route.map(id=>{const n=nav.nodes[id];return new THREE.Vector3(n.x,n.floor*.5+.07,n.z)});
 line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(positions),new THREE.LineBasicMaterial({color:'#0b947b',depthTest:false}));line.renderOrder=10;scene.add(line);
 traveler=new THREE.Mesh(new THREE.SphereGeometry(.12,12,8),new THREE.MeshStandardMaterial({color:'#fff3c7'}));traveler.visible=route.length>0;scene.add(traveler);
 roofGroup.visible=document.querySelector('#roof').checked;
 document.querySelector('#stats').textContent=`${mixed?'混合网格':'四边形网格'} · ${world.cells.length} 格 · ${nav.nodes.length} 可站点 · ${route.length?`路径 ${route.length} 节点，穿过下层洞口`:'无可达路径'} · ${heightmap?'仅柱顶':'多层图'}`;
 window.navReview={world,nav,route,rebuild};
}
for(const id of ['mixed','heightmap','tall'])document.querySelector('#'+id).onchange=rebuild;
document.querySelector('#roof').onchange=e=>roofGroup.visible=e.target.checked;
const canvas=renderer.domElement;canvas.onpointerdown=e=>{drag=[e.clientX,e.clientY];canvas.setPointerCapture(e.pointerId)};canvas.onpointermove=e=>{if(!drag)return;angle-=(e.clientX-drag[0])*.006;pitch=Math.max(.15,Math.min(1.3,pitch+(e.clientY-drag[1])*.006));drag=[e.clientX,e.clientY]};canvas.onpointerup=()=>drag=null;canvas.onwheel=e=>{e.preventDefault();distance=Math.max(8,Math.min(40,distance+e.deltaY*.015))};
function resize(){renderer.setSize(innerWidth,innerHeight);camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix()}addEventListener('resize',resize);resize();rebuild();
renderer.setAnimationLoop(t=>{camera.position.set(Math.sin(angle)*Math.cos(pitch)*distance,Math.sin(pitch)*distance,Math.cos(angle)*Math.cos(pitch)*distance);camera.lookAt(0,.5,0);if(route.length){const f=(t/450)%(route.length-1),i=Math.floor(f),a=nav.nodes[route[i]],b=nav.nodes[route[Math.min(i+1,route.length-1)]];traveler.position.set(a.x+(b.x-a.x)*(f-i),a.floor*.5+.14,a.z+(b.z-a.z)*(f-i))}renderer.render(scene,camera)});
