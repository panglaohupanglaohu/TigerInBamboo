// Read-only capture from the normal production game, not an invented bridge.
// One rigid rotation presents the actual neighborhood in the review camera.
export async function loadRailContext(T){
 const response=await fetch('./actual-rail-context.json');if(!response.ok)throw Error('Actual rail context unavailable');
 const data=await response.json(),ref=new T.Vector3().fromArray(data.input.referencePoint),first=data.curves.red;
 let nearest=0,best=Infinity;first.points.forEach((p,i)=>{const d=new T.Vector3().fromArray(p).distanceToSquared(ref);if(d<best){best=d;nearest=i}});
 const up=new T.Vector3().fromArray(first.points[nearest]).normalize();
 const tangent=new T.Vector3().fromArray(first.points[(nearest+1)%first.points.length]).sub(new T.Vector3().fromArray(first.points[(nearest-1+first.points.length)%first.points.length]));
 tangent.addScaledVector(up,-tangent.dot(up)).normalize();const side=new T.Vector3().crossVectors(tangent,up).normalize();
 const rotation=new T.Matrix4().makeBasis(tangent,up,side).invert();
 const point=p=>new T.Vector3().fromArray(p).applyMatrix4(rotation);
 class ActualSampledRail extends T.Curve{
  constructor(record){super();this.points=record.points.map(point);this.length=record.length;this.closed=true;}
  getPointAt(u,target=new T.Vector3()){const f=((u%1+1)%1)*this.points.length,i=Math.floor(f);return target.copy(this.points[i]).lerp(this.points[(i+1)%this.points.length],f-i)}
  getPoint(u,target){return this.getPointAt(u,target)}
  getTangentAt(u,target=new T.Vector3()){return target.copy(this.getPointAt(u+1/this.points.length)).sub(this.getPointAt(u-1/this.points.length)).normalize()}
  getLength(){return this.length}
 }
 const railCurves=Object.fromEntries(Object.entries(data.curves).map(([name,record])=>[name,new ActualSampledRail(record)]));
 function meshFrom(record,ocean=false){const positions=record.positions.slice();
  for(let i=0;i<positions.length;i+=3){const p=point(positions.slice(i,i+3));positions[i]=p.x;positions[i+1]=p.y;positions[i+2]=p.z}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  if(!ocean)g.setAttribute('color',new T.Float32BufferAttribute(record.colors,3));g.computeVertexNormals();g.computeBoundingSphere();
  const material=new T.MeshStandardMaterial({color:ocean?0x208aab:0xffffff,vertexColors:!ocean,roughness:.85,side:T.DoubleSide});
  const mesh=new T.Mesh(g,material);mesh.name=ocean?'actual-game-ocean-triangle-crop':'actual-game-rail-deck-support-crop';mesh.userData.source=data.summary;mesh.receiveShadow=true;return mesh;
 }
 const ocean=meshFrom(data.ocean,true),railMeshes=data.snapshots.map(s=>meshFrom(s));ocean.updateMatrixWorld(true);
 const ray=new T.Raycaster();
 const waterAt=p=>{const direction=p.clone().normalize();ray.set(direction.clone().multiplyScalar(data.input.radius+100),direction.clone().negate());ray.far=data.input.radius+100;return ray.intersectObject(ocean,false)[0]?.point};
 const result={radius:data.input.radius,referencePoint:ref.applyMatrix4(rotation),railCurves,railPoints:Object.values(railCurves).flatMap(c=>c.points),providesOcean:true,waterAt,
  install(scene){
   const group=new T.Group();group.name='actual-game-rail-context';group.add(...railMeshes,ocean);
   // Background only: below every captured ocean vertex, never an authority
   // for rock seating or a replacement of the actual local ocean triangles.
   let minR=Infinity;for(let i=0;i<data.ocean.positions.length;i+=3)minR=Math.min(minR,Math.hypot(...data.ocean.positions.slice(i,i+3)));
   const backdrop=new T.Mesh(new T.SphereGeometry(minR-.5,96,48),new T.MeshStandardMaterial({color:0x208aab,roughness:.85}));backdrop.name='review-background-water-below-captured-surface';group.add(backdrop);scene.add(group);
   const label=document.createElement('div');label.id='rail-context-truth';label.style.cssText='position:fixed;left:12px;bottom:12px;background:#fffffff2;padding:8px;z-index:4;max-width:600px;font-size:12px';
   label.textContent='实轨：正式游戏钢轨／桥面／桥墩截段，红蓝线路采样；仅整体旋转机位，未移动铁路。'+data.summary.staticTriangles+'个桥轨三角面。';document.body.append(label);
   group.userData.source=data.summary;group.userData.transform='single rigid rotation, no scaling or route warping';return group;
  }};
 return result;
}
