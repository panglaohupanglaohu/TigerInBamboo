// 931196707236392960 "virtual voxel space": probe/normal diagnostics.
// Loaded inside the rendered iframe: WebGL typed arrays stay in that realm.
import * as THREE from '../../vendor/three.module.js';
window.mountFlowMarkers=view=>{
 const probe=new THREE.Mesh(new THREE.SphereGeometry(.09,12,8),new THREE.MeshBasicMaterial({color:'#409274',depthTest:false}));probe.renderOrder=12;
 const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,1,0),new THREE.Vector3(),.7,'#c39029');view.scene.add(probe,arrow);let hasNormal=false;
 return {set({x,y,z,floor,normal,occupied,showProbe,showNormal}){hasNormal=!!normal;probe.position.set(x,y,z);probe.material.color.set(occupied?'#bd5151':'#409274');probe.visible=showProbe;arrow.position.set(x,floor+.03,z);arrow.visible=showNormal&&!!normal;if(normal)arrow.setDirection(new THREE.Vector3(...normal));},showProbe(on){probe.visible=on},showNormal(on){arrow.visible=on&&hasNormal}};
};
