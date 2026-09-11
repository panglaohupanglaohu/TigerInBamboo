import * as THREE from 'three';

// Fits the reserved WFC doorway: the opening remains empty all the way through.
export function buildUpperTowerPortal(material){
  const group=new THREE.Group();group.name='upper-tower-pointed-portal';
  function opening(shape){
    shape.moveTo(-1.25,0);shape.lineTo(-1.25,1.42);
    shape.quadraticCurveTo(-1.25,1.75,0,2.04);
    shape.quadraticCurveTo(1.25,1.75,1.25,1.42);
    shape.lineTo(1.25,0);
  }
  function extrude(shape,depth,z,name){
    const geometry=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:false,curveSegments:12});
    const mesh=new THREE.Mesh(geometry,material);mesh.position.z=z;
    mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);
  }
  const wall=new THREE.Shape();opening(wall);
  wall.lineTo(1.8,0);wall.lineTo(1.8,2.1);wall.lineTo(-1.8,2.1);wall.lineTo(-1.8,0);wall.closePath();
  extrude(wall,.30,-.30,'upper-portal-spandrel');
  const frame=new THREE.Shape();opening(frame);
  frame.lineTo(1.44,0);frame.lineTo(1.44,1.42);
  frame.quadraticCurveTo(1.44,1.93,0,2.24);
  frame.quadraticCurveTo(-1.44,1.93,-1.44,1.42);
  frame.lineTo(-1.44,0);frame.closePath();
  extrude(frame,.14,.015,'upper-portal-stone-surround');
  return group;
}
