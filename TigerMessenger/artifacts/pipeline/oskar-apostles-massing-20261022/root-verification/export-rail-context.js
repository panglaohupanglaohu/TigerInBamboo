// Local test-page action: reads the actual normal-game objects; no state edits.
export function exportRailContext(t){
 if(!t?.scene||!t?.messenger?.landmarks?.tramSystem)throw Error('正式场景尚未就绪');
 const T=t.THREE,tram=t.messenger.landmarks.tramSystem,rocks=[];
 t.scene.updateMatrixWorld(true);t.scene.traverse(o=>{if(o.isMesh&&o.userData.apostleMass)rocks.push(o)});
 const report=t.scene.userData.twelveApostlesTarget;if(!report?.input?.referencePoint)throw Error('缺实际工厂referencePoint诊断');
 const box=new T.Box3();for(const r of rocks)box.union(new T.Box3().setFromObject(r));box.expandByScalar(12);
 const excluded=new Set((tram.freightServices||[]).flatMap(s=>[s.tram,...s.wagons||[],...s.couplers||[]]));
 const excludedObject=o=>{for(let p=o;p;p=p.parent)if(excluded.has(p)||p.userData.isOutline||/freight-coupler/.test(p.name))return true;return false;};
 const snapshots=[];let sourceMeshes=0;
 function snapshot(root,kind){const positions=[],colors=[],names=new Set();
 root.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes.position||excludedObject(o))return;
  const g=o.geometry,p=g.attributes.position,c=g.attributes.color,idx=g.index,n=idx?idx.count:p.count;
  if(!g.boundingBox)g.computeBoundingBox();const instances=o.isInstancedMesh?o.count:1;
  const m=new T.Matrix4(),a=new T.Vector3(),b=new T.Vector3(),v=new T.Vector3(),triBox=new T.Box3();
  for(let instance=0;instance<instances;instance++){
   if(o.isInstancedMesh){o.getMatrixAt(instance,m);m.premultiply(o.matrixWorld)}else m.copy(o.matrixWorld);
   if(!g.boundingBox.clone().applyMatrix4(m).intersectsBox(box))continue;
   let used=false;
   for(let i=0;i<n;i+=3){const ids=[0,1,2].map(j=>idx?idx.getX(i+j):i+j);a.fromBufferAttribute(p,ids[0]).applyMatrix4(m);b.fromBufferAttribute(p,ids[1]).applyMatrix4(m);v.fromBufferAttribute(p,ids[2]).applyMatrix4(m);triBox.setFromPoints([a,b,v]);if(!triBox.intersectsBox(box))continue;
    const gi=g.groups?.find(q=>i>=q.start&&i<q.start+q.count),mat=Array.isArray(o.material)?o.material[gi?.materialIndex||0]:o.material,col=mat?.color||new T.Color(0xc8bdab);
    for(const [j,point]of [a,b,v].entries()){positions.push(...point.toArray().map(x=>+x.toFixed(6)));colors.push(...[0,1,2].map(k=>+((k===0?col.r:k===1?col.g:col.b)*(c?(k===0?c.getX(ids[j]):k===1?c.getY(ids[j]):c.getZ(ids[j])):1)).toFixed(5)))}used=true;
   }if(used){names.add(o.name||o.type);sourceMeshes++}
  }
 });return {kind,positions,colors,names:[...names],triangles:positions.length/9};}
 snapshots.push(snapshot(tram.group,'actual-tram-static'));
 const ocean=t.scene.getObjectByName('planet-v8-curved-ocean');if(!ocean)throw Error('缺正式海面');
 const oceanSnapshot=snapshot(ocean,'actual-ocean-triangles');
 const N=4096,curves={};let maxInterpolationError=0;
 for(const [name,curve]of Object.entries(tram.curves)){
  const points=Array.from({length:N},(_,i)=>curve.getPointAt(i/N).toArray());
  for(let i=0;i<N;i++){const midpoint=new T.Vector3().fromArray(points[i]).lerp(new T.Vector3().fromArray(points[(i+1)%N]),.5);maxInterpolationError=Math.max(maxInterpolationError,midpoint.distanceTo(curve.getPointAt((i+.5)/N)))}
  curves[name]={points,length:curve.getLength()};
 }
 const summary={entry:t.renderer.domElement.ownerDocument.location.pathname,exportPage:location.pathname,sourceVersion:report.version,staticTriangles:snapshots.reduce((n,s)=>n+s.triangles,0),oceanTriangles:oceanSnapshot.triangles,sourceMeshes,maxInterpolationError,sourceRoot:tram.group.name,rootVisible:tram.group.visible,scope:'Actual game static rail/deck/support triangle crop and curve samples. Vehicles excluded. Not newly authored bridge geometry.'};
 return {schema:1,input:report.input,region:{min:box.min.toArray(),max:box.max.toArray()},curves,snapshots,ocean:oceanSnapshot,summary};
}
