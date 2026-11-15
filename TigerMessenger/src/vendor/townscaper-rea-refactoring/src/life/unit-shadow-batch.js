import * as THREE from 'three';
import {unitShadow} from '../core/unit-shadow.js';
export class UnitShadowBatch{
 constructor(limit=260){
  this.enabled=false;this.count=0;this.capacity=limit*96;
  this.geometry=new THREE.BufferGeometry();
  for(const [name,size] of [['position',3],['local',2],['opacity',1]])this.geometry.setAttribute(name,new THREE.BufferAttribute(new Float32Array(this.capacity*size),size).setUsage(THREE.DynamicDrawUsage));
  this.material=new THREE.ShaderMaterial({transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,side:THREE.DoubleSide,
   vertexShader:'attribute vec2 local;attribute float opacity;varying vec2 vLocal;varying float vOpacity;void main(){vLocal=local;vOpacity=opacity;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
   fragmentShader:'varying vec2 vLocal;varying float vOpacity;void main(){float a=vOpacity*(1.0-smoothstep(.2,1.0,length(vLocal)));if(a<.002)discard;gl_FragColor=vec4(.08,.10,.12,a);}'
  });this.mesh=new THREE.Mesh(this.geometry,this.material);this.mesh.frustumCulled=false;this.mesh.visible=false;this.geometry.setDrawRange(0,0);
 }
 update(world,units,navigation,L){
  if(!this.enabled){this.clear();return;}let cursor=0,count=0;
  for(const u of units){if(u.dead||u.onBoat||u.fall)continue;const node=navigation.unitNode(u);if(!node)continue;
   const data=unitShadow({x:u.x,z:u.z,footY:u.y,groundY:node.floor*L,footprint:node.cell.pts,radius:.12*(u.bodyScale??1)}),n=data.position.length/3;if(!n||cursor+n>this.capacity)continue;
   this.geometry.attributes.position.array.set(data.position,cursor*3);this.geometry.attributes.local.array.set(data.local,cursor*2);this.geometry.attributes.opacity.array.fill(data.alpha,cursor,cursor+n);cursor+=n;count++;
  }
  for(const a of Object.values(this.geometry.attributes))a.needsUpdate=true;
  this.geometry.setDrawRange(0,cursor);this.mesh.visible=count>0;this.count=count;
 }
 clear(){this.mesh.visible=false;this.geometry.setDrawRange(0,0);this.count=0;}
 dispose(){this.geometry.dispose();this.material.dispose();}
}
