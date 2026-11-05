/** 1120036868966502401: diagnostic isolines, not the deformed foam shoreline. */
import * as THREE from 'three';
import {marchGrid} from '../core/contour.js';
export class ContourOverlay{
  constructor(world){this.world=world;this.version=-1;this.mesh=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#ffbe58',depthTest:false,transparent:true,opacity:.9}));this.mesh.visible=false;this.mesh.renderOrder=8;this.mesh.frustumCulled=false;}
  refresh(){if(!this.mesh.visible||this.version===this.world.version)return;this.result=marchGrid(this.world.cells,c=>this.world.isLand(c)?1:0);const arr=this.result.levels[0].segs.flatMap(s=>[s[0],.035,s[1],s[2],.035,s[3]]);this.mesh.geometry.dispose();this.mesh.geometry=new THREE.BufferGeometry();this.mesh.geometry.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));this.version=this.world.version;}
  setVisible(on){this.mesh.visible=on;this.refresh();}
  dispose(){this.mesh.geometry.dispose();this.mesh.material.dispose();}
}
