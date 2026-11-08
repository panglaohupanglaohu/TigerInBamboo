import * as THREE from 'three';
import {terraceEdges} from '../core/terrace-edges.js';
/** Same polygon endpoints and live cage projection across all three passes.
 * Lines describe logical ground caps, not final bevel/roof/overhang geometry.
 */
export class TerraceEdgeOverlay{
 constructor(view){this.view=view;this.mode='off';this.version=-1;this.shape=null;this.lines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#f8bc55',depthTest:false,transparent:true,opacity:.85}));this.lines.visible=false;this.lines.frustumCulled=false;this.lines.renderOrder=9;}
 setMode(mode){if(!['off','steps','wire','shore'].includes(mode))throw new RangeError('terrace edge mode');if(mode!==this.mode){this.mode=mode;this.version=-1;}this.lines.visible=mode!=='off';this.refresh();}
 refresh(){if(this.mode==='off')return;const v=this.view,shape=v.worldMesh.shape;if(this.version===v.town.version&&this.shape===shape)return;this.result=terraceEdges(v.town);const at=(p,h)=>shape?shape.at(p,h):[p.x,p.z],pos=[];for(const s of this.result[this.mode]){for(const p of[s.a,s.b]){const[x,z]=at(p,s.level);pos.push(x,s.level*v.levelHeight+.025,z);}}this.lines.geometry.dispose();this.lines.geometry=new THREE.BufferGeometry();this.lines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));this.version=v.town.version;this.shape=shape;}
 dispose(){this.lines.geometry.dispose();this.lines.material.dispose();}
}
