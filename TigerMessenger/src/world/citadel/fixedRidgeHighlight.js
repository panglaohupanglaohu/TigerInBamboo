import * as THREE from 'three';
import {nightWeightAt} from '../../render/lighting/highlandLightVolumes.js';
// Geometry-defined convex ridges. No camera position, Fresnel or expanded shell.
export function createFixedRidgeHighlight(castle) {
  let source=null,sourceGeometry=null,version=-1,lines=null;
  const gold=new THREE.Color('#d6aa58'),silver=new THREE.Color('#cad6e7');
  const material=new THREE.LineBasicMaterial({color:gold,transparent:true,opacity:.82,depthTest:true,depthWrite:false,toneMapped:false});
  function rebuild(mesh) {
    source=mesh;sourceGeometry=mesh.geometry;version=sourceGeometry.attributes.position.version;
    if(lines){lines.geometry.dispose();lines.removeFromParent();}
    const positions=sourceGeometry.attributes.position,index=sourceGeometry.index,edges=new Map();
    const key=p=>[p.x,p.y,p.z].map(v=>Math.round(v*1e4)).join(',');
    const n=new THREE.Vector3(),ab=new THREE.Vector3(),ac=new THREE.Vector3();
    const count=index?.count??positions.count;
    for(let i=0;i<count;i+=3){
      const points=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(positions,index?index.getX(i+j):i+j));
      n.crossVectors(ab.subVectors(points[1],points[0]),ac.subVectors(points[2],points[0])).normalize();
      if(n.lengthSq()<.5)continue;
      const center=points[0].clone().add(points[1]).add(points[2]).multiplyScalar(1/3);
      for(let j=0;j<3;j++){
        const a=points[j],b=points[(j+1)%3],ka=key(a),kb=key(b),id=ka<kb?ka+'|'+kb:kb+'|'+ka;
        const edge=edges.get(id);
        if(edge)edge.faces.push({normal:n.clone(),center});
        else edges.set(id,{a,b,faces:[{normal:n.clone(),center}]});
      }
    }
    const vertices=[];
    for(const edge of edges.values()){
      if(edge.faces.length!==2)continue;
      const [a,b]=edge.faces,normal=a.normal.clone().add(b.normal).normalize();
      if(normal.y<.2||a.normal.dot(b.normal)>Math.cos(THREE.MathUtils.degToRad(22)))continue;
      if(a.normal.dot(b.center.clone().sub(a.center))>=-.0001)continue;
      for(const p of [edge.a,edge.b])vertices.push(...p.clone().addScaledVector(normal,.028).toArray());
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));
    lines=new THREE.LineSegments(geometry,material);lines.name='citadel-fixed-ridge-lines';
    lines.userData={skipColliders:true,fixedRidgeHighlight:true,source:'convex mountain creases; gold day, silver night',segments:vertices.length/6};
    mesh.add(lines);
  }
  return {
    get layer(){return lines;},
    update(phase){
      // The approved natural limestone study uses real mineral/normal relief;
      // gold edge strokes would highlight every newly fractured triangle.
      if(castle.userData.mountainStudy?.round>=6){if(lines)lines.visible=false;return;}
      const mesh=castle.getObjectByName('citadel-oskar-grid-mountain-surface');if(!mesh?.geometry?.attributes.position)return;
      if(mesh!==source||mesh.geometry!==sourceGeometry||mesh.geometry.attributes.position.version!==version)rebuild(mesh);
      const night=nightWeightAt(phase);material.color.copy(gold).lerp(silver,night);
      lines.userData.nightWeight=night;
    },
    dispose(){if(lines){lines.geometry.dispose();lines.removeFromParent();}material.dispose();}
  };
}
