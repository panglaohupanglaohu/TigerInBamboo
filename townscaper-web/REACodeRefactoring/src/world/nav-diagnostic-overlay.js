import * as THREE from 'three';import {navDiagnosticGeometry} from '../core/nav-diagnostic-geometry.js';
export function mountNavDiagnosticOverlay(view){
 const group=new THREE.Group();group.name='shared-world-navigation-diagnostics';view.scene.add(group);let stamp='',stats=null;
 const corners=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({color:0xff4b40,size:4,sizeAttenuation:false,depthTest:false})),background=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x638c8b,transparent:true,opacity:.45})),typed=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({vertexColors:true,depthTest:false}));
 const layers={walkcorners:corners,navbackground:background,gridtyped3d:typed};for(const obj of Object.values(layers)){obj.visible=false;obj.renderOrder=21;obj.userData.overlayOnly=true;group.add(obj);}
 function refresh(){if(!Object.values(layers).some(x=>x.visible))return;const key=view.town.version+'|'+view.mesh.geometry.uuid;if(key===stamp)return;
  const nav=view.navLayer.nav,shape=view.worldMesh.shape,data=navDiagnosticGeometry(view.town,{nav,levelHeight:view.levelHeight,at:(p,h)=>shape?shape.at(p,h):[p.x,p.z]});
  for(const [obj,pos,color]of [[corners,data.corners],[background,data.background],[typed,data.typed,data.colors]]){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));if(color)g.setAttribute('color',new THREE.Float32BufferAttribute(color,3));g.computeBoundingSphere();obj.geometry.dispose();obj.geometry=g;}stats=data.stats;stamp=key;
 }
 return{set(key,on){if(!layers[key])throw new Error('unknown diagnostic layer');layers[key].visible=!!on;refresh();},get(key){return!!layers[key]?.visible;},refresh,get stats(){return stats;},dispose(){group.removeFromParent();for(const obj of Object.values(layers)){obj.geometry.dispose();obj.material.dispose();}}};
}
