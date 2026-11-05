/** 810878197134950401: shared World graph visibility diagnostic. */
import * as THREE from 'three';
import {buildLayeredNav} from './layerednav.js';
import {castNavVisibility} from '../core/nav-visibility.js';
export class VisibilityOverlay{
  constructor(world,{levelHeight=.5}={}){this.world=world;this.L=levelHeight;this.version=-1;this.group=new THREE.Group();this.group.visible=false;this.lines=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#ce514d',depthTest:false,transparent:true,opacity:.65}));this.group.add(this.lines);}
  refresh(){if(!this.group.visible||this.version===this.world.version)return;this.graph=buildLayeredNav(this.world,{maxStep:1});const source=this.graph.nodes.reduce((a,b)=>!a||Math.hypot(b.x,b.z)<Math.hypot(a.x,a.z)?b:a,null);this.result=castNavVisibility(this.graph,source?.id??-1,{maxRange:10});const o=this.result.origin,arr=o?this.result.rays.flatMap(r=>[o.x,o.floor*this.L+.04,o.z,r.x,this.graph.nodes[r.node].floor*this.L+.04,r.z]):[];this.lines.geometry.dispose();this.lines.geometry=new THREE.BufferGeometry();this.lines.geometry.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));this.lines.frustumCulled=false;this.lines.renderOrder=9;this.version=this.world.version;}
  setVisible(on){this.group.visible=on;this.refresh();}
  dispose(){this.lines.geometry.dispose();this.lines.material.dispose();}
}
