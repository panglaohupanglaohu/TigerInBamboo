import * as THREE from 'three';
import {unitShadow, LIGHT_DIR} from '../core/unit-shadow.js';
/** 第 53 批（G5）：软盘裁剪到「自己格 + 共顶点的同层可站格」（跨格连续），逐顶点贴实际地面（楼梯踏面），
 * 在楼梯上沿坡向拉长，离地时沿主光偏移（REACode blobshadow）。lightDir 可由调用方换成场景主光的水平分量。 */
export class UnitShadowBatch{
 constructor(limit=260){
  this.enabled=false;this.count=0;this.capacity=limit*96*3;this.lightDir=[...LIGHT_DIR];this.stats={pieces:0,multiCell:0,onStairs:0};
  this.geometry=new THREE.BufferGeometry();
  for(const [name,size] of [['position',3],['local',2],['opacity',1]])this.geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(this.capacity*size),size).setUsage(THREE.DynamicDrawUsage));
  this.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,side:THREE.DoubleSide,
   vertexShader:'attribute vec2 local;attribute float opacity;varying vec2 vLocal;varying float vOpacity;void main(){vLocal=local;vOpacity=opacity;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:'varying vec2 vLocal;varying float vOpacity;void main(){float a=vOpacity*(1.0-smoothstep(.2,1.0,length(vLocal)));if(a<.002)discard;gl_FragColor=vec4(.08,.10,.12,a);}'
  });this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.frustumCulled=false;this.mesh.visible=false;this.geometry.setDrawRange(0,0);
 }
 /** 同层可站、与本格共一个顶点的格（含本格）。没有顶点表的网格退回边邻格。 */
 footprints(world,navigation,node){
  const g=navigation.graph,ids=new Set([node.cell.id]),vc=world.grid?.vertexCells;
  if(vc)for(const p of node.cell.pts)for(const id of vc.get(p.id)??[])ids.add(id);else for(const id of node.cell.edgeNeighbors)if(id>=0)ids.add(id);
  const out=[];for(const id of ids){const c=world.cells[id];if(c.id!==node.cell.id&&g.at(c,node.floor)<0)continue;out.push({cell:c,node:g.nodes[g.at(c,node.floor)]});}
  return out;
 }
 update(world,units,navigation,L){
  if(!this.enabled){this.clear();return;}let cursor=0,count=0,pieces=0,multiCell=0,onStairs=0,fitted=0;this.ranges=[];
  for(const u of units){if(u.dead||u.onBoat||u.fall)continue;const node=navigation.unitNode(u);if(!node)continue;
   const parts=this.footprints(world,navigation,node),stair=navigation.stairAt?.(u.x,u.z,node);
   // 楼梯上：软盘贴楼梯的平均坡面（原版「贴的是地面不是水平面」），夹在上下两层之间；平地上就是本层水平面
   // 第 55 批 G3：groundSampler（Battle shadowFit）= 射线采样**渲染出来的形变网格**拟合平面，影子贴实际斜面 / 形变崖边
   const fit=this.groundSampler?.(u,node.floor*L,node.floor*L+L*(stair?.rise??1))??null;if(fit){const data=unitShadow({x:u.x,z:u.z,footY:u.y,groundY:fit.groundY,footprints:parts.map(p=>p.cell.pts),radius:.12*(u.bodyScale??1),light:this.lightDir,slope:fit.slope,groundAt:fit.groundAt}),n=data.position.length/3;if(n&&cursor+n<=this.capacity){this.ranges.push({unit:u,start:cursor,count:n,floor:node.floor,stair:!!stair,fit:true,slopeDeg:fit.slope?.deg??0});this.geometry.attributes.position.array.set(data.position,cursor*3);this.geometry.attributes.local.array.set(data.local,cursor*2);this.geometry.attributes.opacity.array.fill(data.alpha,cursor,cursor+n);cursor+=n;count++;pieces+=data.pieces;if(data.pieces>1)multiCell++;if(stair)onStairs++;fitted++;}continue;}
   const base=node.floor*L,grad=stair?.slope?Math.tan(stair.slope.deg*Math.PI/180):0;
   const groundAt=stair?.slope?(x,z)=>Math.max(base,Math.min(base+L*(stair.rise??1),stair.tread+grad*((x-u.x)*stair.slope.x+(z-u.z)*stair.slope.z))):null;
   const data=unitShadow({x:u.x,z:u.z,footY:u.y,groundY:stair?.tread??node.floor*L,footprints:parts.map(p=>p.cell.pts),radius:.12*(u.bodyScale??1),light:this.lightDir,slope:stair?.slope??null,groundAt}),n=data.position.length/3;if(!n||cursor+n>this.capacity)continue;
   this.ranges.push({unit:u,start:cursor,count:n,floor:node.floor,stair:!!stair});
   this.geometry.attributes.position.array.set(data.position,cursor*3);this.geometry.attributes.local.array.set(data.local,cursor*2);this.geometry.attributes.opacity.array.fill(data.alpha,cursor,cursor+n);cursor+=n;count++;
   pieces+=data.pieces;if(data.pieces>1)multiCell++;if(stair)onStairs++;
  }
  for(const a of Object.values(this.geometry.attributes))a.needsUpdate=true;
  this.geometry.setDrawRange(0,cursor);this.mesh.visible=count>0;this.count=count;this.stats={pieces,multiCell,onStairs,fitted};
 }
 clear(){this.mesh.visible=false;this.geometry.setDrawRange(0,0);this.count=0;}
 dispose(){this.geometry.dispose();this.material.dispose();}
}
