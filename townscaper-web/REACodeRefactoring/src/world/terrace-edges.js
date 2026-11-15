import * as THREE from 'three';
import {terraceEdges,finalSegments} from '../core/terrace-edges.js';
import {softCorners} from '../terrain/soft-tops.js';
/** Same polygon endpoints and live cage projection across all three passes.
 * r55: endpoints come from core/terrace-edges.js finalSegments — the exact rim the terrain mesh draws
 * (cage slice + soft-top corner heights), so the line pass sits on the final bevelled geometry; steps that
 * soft tops turned into seamless slopes are not drawn. Roof/overhang geometry is still not traced.
 */
export class TerraceEdgeOverlay{
 constructor(view){this.view=view;this.mode='off';this.version=-1;this.shape=null;this.lines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#f8bc55',depthTest:false,transparent:true,opacity:.85}));this.lines.visible=false;this.lines.frustumCulled=false;this.lines.renderOrder=9;}
 setMode(mode){if(!['off','steps','wire','shore'].includes(mode))throw new RangeError('terrace edge mode');if(mode!==this.mode){this.mode=mode;this.version=-1;}this.lines.visible=mode!=='off';this.refresh();}
 refresh(){if(this.mode==='off')return;const v=this.view,shape=v.worldMesh.shape,soft=!!v.town.softTops;if(this.version===v.town.version&&this.shape===shape&&this.soft===soft)return;this.result=terraceEdges(v.town);const L=v.levelHeight,at=(p,s)=>shape?shape.at(p,s):[p.x,p.z];
  const fin=finalSegments(v.town,this.result[this.mode],{at,L,soft:soft?softCorners(v.town,{L}):null});this.final=fin;const pos=[];for(const g of fin.segments){pos.push(g.a[0],g.a[1]+.025,g.a[2],g.b[0],g.b[1]+.025,g.b[2]);}
  this.lines.geometry.dispose();this.lines.geometry=new THREE.BufferGeometry();this.lines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));this.version=v.town.version;this.shape=shape;this.soft=soft;}
 dispose(){this.lines.geometry.dispose();this.lines.material.dispose();}
}
