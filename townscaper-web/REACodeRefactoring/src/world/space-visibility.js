import * as THREE from 'three';
import {sampleWorldVisibility} from '../core/space-visibility.js';
export class SpaceVisibilityOverlay{
 constructor(world,index,{levelHeight=.5}={}){this.world=world;this.index=index;this.L=levelHeight;this.point=null;this.version=-1;this.group=new THREE.Group();this.group.visible=false;this.lines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#d7cb58',depthTest:false,transparent:true,opacity:.8}));this.lines.frustumCulled=false;this.lines.renderOrder=10;this.group.add(this.lines);}
 setPoint(point){if(![point?.x,point?.y,point?.z].every(Number.isFinite))throw new TypeError('finite point required');this.point={...point};this.version=-1;this.refresh();}
 setVisible(on){this.group.visible=on;this.refresh();}
 refresh(){if(!this.group.visible||this.version===this.world.version)return;const c=this.world.cells.reduce((a,b)=>!a||Math.hypot(b.cx,b.cz)<Math.hypot(a.cx,a.cz)?b:a,null),p=this.point??(c&&{x:c.cx,y:this.world.top(c)*this.L+.08,z:c.cz});if(!p)return;this.result=sampleWorldVisibility(this.world,this.index,p,{levelHeight:this.L,count:64});const data=this.result.rays.flatMap(r=>[p.x,p.y,p.z,r.x,r.y,r.z]);this.lines.geometry.dispose();this.lines.geometry=new THREE.BufferGeometry();this.lines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(data,3));this.version=this.world.version;}
 dispose(){this.lines.geometry.dispose();this.lines.material.dispose();}
}
