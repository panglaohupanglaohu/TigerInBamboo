import * as THREE from 'three';

// Closed, smoothly tapered living tubes. The original TubeGeometry ring layout
// remains intact so the local fine-ink helper can limit outline width per ring.
export function faunaTube(points,radiusAt,segments=36,sides=10){
  const curve=new THREE.CatmullRomCurve3(points.map(p=>p.isVector3?p:new THREE.Vector3(...p)));
  const geometry=new THREE.TubeGeometry(curve,segments,1,sides,false),p=geometry.attributes.position;
  for(let i=0;i<=segments;i++){
    const center=curve.getPointAt(i/segments),radius=radiusAt(i/segments);
    for(let j=0;j<=sides;j++){const k=i*(sides+1)+j,point=new THREE.Vector3().fromBufferAttribute(p,k).sub(center).multiplyScalar(radius).add(center);p.setXYZ(k,point.x,point.y,point.z);}
  }
  const index=Array.from(geometry.index.array),end=segments*(sides+1);
  for(let j=1;j<sides-1;j++){index.push(0,j,j+1);index.push(end,end+j+1,end+j);}
  geometry.setIndex(index);geometry.computeVertexNormals();geometry.computeBoundingSphere();return geometry;
}
