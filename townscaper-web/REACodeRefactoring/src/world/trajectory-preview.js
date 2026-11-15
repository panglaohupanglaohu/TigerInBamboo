import * as THREE from 'three';import {traceArc} from '../core/trajectory-trace.js';
/** Trace against the actual rendered shared World mesh. No voxel or gameplay writes. */
export function mountTrajectoryPreview(view){
 const group=new THREE.Group();group.name='current-world-trajectory-preview';group.visible=false;view.scene.add(group);
 let geometry=new THREE.BufferGeometry(),hitGeo=new THREE.BufferGeometry();const material=new THREE.LineBasicMaterial({color:0x7ef6e6}),line=new THREE.LineSegments(geometry,material);line.userData.overlayOnly=true;group.add(line);
 const hitMat=new THREE.PointsMaterial({color:0xffbf6c,size:7,sizeAttenuation:false}),hits=new THREE.Points(hitGeo,hitMat);group.add(hits);
 let options={speed:7.61,drag:.2,dragModel:'linear'},stamp='',stats=null;
 function replaceGeometry(pos,points){geometry.dispose();hitGeo.dispose();geometry=new THREE.BufferGeometry();hitGeo=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));hitGeo.setAttribute('position',new THREE.Float32BufferAttribute(points,3));geometry.computeBoundingSphere();hitGeo.computeBoundingSphere();line.geometry=geometry;hits.geometry=hitGeo;}
 function refresh(){if(!group.visible)return;const v=view.town?.version+'|'+view.mesh.geometry.uuid+'|'+JSON.stringify(options);if(v===stamp)return;
  const world=view.town,L=view.levelHeight,cell=world.cells.filter(c=>world.top(c)>0).sort((a,b)=>Math.hypot(a.cx+3,a.cz)-Math.hypot(b.cx+3,b.cz))[0];if(!cell){replaceGeometry([],[]);stats={arcs:0,hits:0};stamp=v;return;}
  view.mesh.updateWorldMatrix(true,false);const origin=[cell.cx,world.top(cell)*L+.25,cell.cz],pos=[],points=[],rays=[],ray=new THREE.Raycaster(),start=new THREE.Vector3(),direction=new THREE.Vector3();
  const segmentHit=(a,b)=>{start.fromArray(a);direction.set(b[0]-a[0],b[1]-a[1],b[2]-a[2]);const length=direction.length();if(length<1e-10)return null;direction.multiplyScalar(1/length);ray.set(start,direction);ray.near=0;ray.far=length;const h=ray.intersectObject(view.mesh,false)[0];return h?{u:h.distance/length,kind:'world-mesh',faceIndex:h.faceIndex}:null;};
  for(const angleDeg of [15,30,45,60,75]){const trace=traceArc({...options,angleDeg,origin,dt:1/60,maxTime:6,segmentHit});rays.push(trace);for(let i=1;i<trace.points.length;i++)pos.push(...trace.points[i-1],...trace.points[i]);if(trace.hit)points.push(...trace.hit.point);}
  replaceGeometry(pos,points);stats={arcs:rays.length,hits:rays.filter(r=>r.reason==='world-mesh').length,groundHits:rays.filter(r=>r.reason==='ground').length,origin,dragModel:options.dragModel,segments:pos.length/6};stamp=v;
 }
 return{setVisible(on){group.visible=!!on;refresh();},get visible(){return group.visible;},refresh,setOptions(p){const next={...options,...p};traceArc({...next,maxTime:.01});options=next;stamp='';refresh();},get stats(){return stats;},dispose(){group.removeFromParent();geometry.dispose();hitGeo.dispose();material.dispose();hitMat.dispose();}};
}
