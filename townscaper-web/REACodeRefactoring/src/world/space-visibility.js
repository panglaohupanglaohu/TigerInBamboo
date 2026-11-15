import * as THREE from 'three';
import {sampleWorldVisibility,bakeWorldVisibility} from '../core/space-visibility.js';
export class SpaceVisibilityOverlay{
 constructor(world,index,{levelHeight=.5}={}){this.world=world;this.index=index;this.L=levelHeight;this.point=null;this.version=-1;this.group=new THREE.Group();this.group.visible=false;this.lines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#d7cb58',depthTest:false,transparent:true,opacity:.8}));this.lines.frustumCulled=false;this.lines.renderOrder=10;this.group.add(this.lines);}
 setPoint(point){if(![point?.x,point?.y,point?.z].every(Number.isFinite))throw new TypeError('finite point required');this.point={...point};this.version=-1;this.refresh();}
 setVisible(on){this.group.visible=on;this.refresh();}
 refresh(){if(!this.group.visible||this.version===this.world.version)return;const c=this.world.cells.reduce((a,b)=>!a||Math.hypot(b.cx,b.cz)<Math.hypot(a.cx,a.cz)?b:a,null),p=this.point??(c&&{x:c.cx,y:this.world.top(c)*this.L+.08,z:c.cz});if(!p)return;this.result=sampleWorldVisibility(this.world,this.index,p,{levelHeight:this.L,count:64});const data=this.result.rays.flatMap(r=>[p.x,p.y,p.z,r.x,r.y,r.z]);this.lines.geometry.dispose();this.lines.geometry=new THREE.BufferGeometry();this.lines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(data,3));this.version=this.world.version;}
 /** 798580832906739712（G5）：整楼灰度场——每个地面采样点一个灰点（室内暗、室外亮），世界变了才重烘。 */
 bake({count=32,maxDist=4}={}){this.baked=bakeWorldVisibility(this.world,this.index,{count,maxDist,levelHeight:this.L});const pos=[],col=[];for(const s of this.baked.samples){pos.push(s.x,s.y,s.z);col.push(s.value,s.value,s.value);}
  if(!this.field){this.field=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({size:9,sizeAttenuation:false,vertexColors:true,depthTest:false}));this.field.renderOrder=11;this.field.frustumCulled=false;this.group.add(this.field);}
  this.field.geometry.dispose();this.field.geometry=new THREE.BufferGeometry();this.field.geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));this.field.geometry.setAttribute('color',new THREE.Float32BufferAttribute(col,3));this.bakedVersion=this.world.version;return this.baked.stats;}
 setFieldVisible(on){if(on&&this.bakedVersion!==this.world.version)this.bake();if(this.field)this.field.visible=!!on;this.group.visible=this.group.visible||!!on;}
 dispose(){this.lines.geometry.dispose();this.lines.material.dispose();this.field?.geometry.dispose();this.field?.material.dispose();}
}
