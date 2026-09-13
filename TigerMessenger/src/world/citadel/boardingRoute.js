import * as THREE from 'three';

/** Build the same bow aisle / hinge / quay route used by native traversal.
 * Call only at the measured berth, with the board fully deployed.
 * Missing floor aborts installation rather than inventing a shore teleport.
 */
export function buildBoardingRoute(boat, city, data, surfaces) {
  const api=boat.userData.warshipV6,root=api.nodes.get('n0'),hinge=api.nodes.get('add:boarding-hinge');
  city.updateWorldMatrix(true,true);boat.updateWorldMatrix(true,true);
  const anchor=root.worldToLocal(hinge.getWorldPosition(new THREE.Vector3()));
  const points=[],up=new THREE.Vector3(0,1,0).transformDirection(city.matrixWorld);
  const ray=new THREE.Raycaster();ray.layers.enableAll();ray.far=.7;
  function floor(local) {
    const point=root.localToWorld(local);
    ray.set(point.clone().addScaledVector(up,.4),up.clone().negate());
    const hit=ray.intersectObjects(surfaces,false)[0];
    if(!hit)throw Error('Boarding route has no deck support');
    points.push(hit.point.clone());
  }
  for(let i=0;i<=10;i++)floor(new THREE.Vector3(THREE.MathUtils.lerp(1,anchor.x,i/10),.664,.36));
  for(let i=1;i<=6;i++)floor(new THREE.Vector3(anchor.x,.664,THREE.MathUtils.lerp(.36,anchor.z-.08,i/6)));
  const seam=hinge.worldToLocal(city.localToWorld(new THREE.Vector3().fromArray(data.native.route[0])));
  const segments=Math.max(1,Math.ceil((seam.z-.03)/.08));
  for(let i=0;i<segments;i++)points.push(hinge.localToWorld(new THREE.Vector3(0,.019,THREE.MathUtils.lerp(.03,seam.z,i/segments))));
  for(const p of data.native.route)points.push(city.localToWorld(new THREE.Vector3().fromArray(p)));
  return points.reverse();
}
