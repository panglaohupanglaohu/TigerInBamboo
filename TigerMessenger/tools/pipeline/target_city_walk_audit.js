/** Finite read-only physics sampling of actual attached candidate meshes. */
export function auditTargetCityWalking({THREE:T,castle,candidate,provider}){
 castle.updateWorldMatrix(true,true);const root=candidate.root,rows=[],contacts=[],timings=[];
 const toWorld=(o,p)=>new T.Vector3(...p).applyMatrix4(o.matrixWorld);
 const inverseCastle=castle.matrixWorld.clone().invert(),surveyedTreads=candidate.report.newCityStairs?.surveyed?.selected?.treads||[];
 const inside=(x,z,p)=>{let c=false;for(let i=0,j=p.length-1;i<p.length;j=i++)if((p[i][1]>z)!==(p[j][1]>z)&&x<(p[j][0]-p[i][0])*(z-p[i][1])/(p[j][1]-p[i][1])+p[i][0])c=!c;return c;};
 const checkGround=(id,surface)=>{
  const up=surface.clone().normalize(),feet=surface.clone().addScaledVector(up,.1);let expectedRadius=surface.length(),overlaidPublicStep=null;
  // Plaza samples under a surveyed tread have an explicit higher public floor.
  // Compute its radial intersection from the authored polygon/plane, independently
  // of the provider's hit. Never excuse a generic ground residual by tolerance.
  if(id.startsWith('plaza-')){const local=surface.clone().applyMatrix4(inverseCastle),dir=up.clone().transformDirection(inverseCastle);for(let i=0;i<surveyedTreads.length;i++){
   const t=surveyedTreads[i],d=(t.top-local.y)/dir.y;if(!Number.isFinite(d)||d<0||d>.25)continue;
   const q=local.clone().addScaledVector(dir,d);if(!inside(q.x,q.z,t.polygon))continue;
   const r=q.applyMatrix4(castle.matrixWorld).length();if(r>expectedRadius){expectedRadius=r;overlaidPublicStep={index:i,top:t.top,heightOverPaving:r-surface.length()};}
  }}
  const at=performance.now(),radius=provider.ground(feet);timings.push(performance.now()-at);const residual=radius===null?null:radius-expectedRadius;
  rows.push({id,world:surface.toArray(),radius,expectedRadius,pavingRadius:surface.length(),overlaidPublicStep,residual,source:provider.report().lastGround,passed:residual!==null&&Math.abs(residual)<.04});
 };
 const main=root.getObjectByName('citadel-target-new-city-main'),old=root.getObjectByName('citadel-target-old-city');
 for(const[asset,points]of[[main,[[0,1.2,0],[0,1.2,5],[0,1.2,-5]]],[old,[[0,.3,14.5],[0,.3,12.5]]]])if(asset)for(const p of points)checkGround(asset.name+':'+p.join(','),toWorld(asset,p));
 for(const tread of candidate.report.newCityStairs?.surveyed?.selected?.treads||[]){const x=tread.polygon.reduce((a,p)=>a+p[0],0)/tread.polygon.length,z=tread.polygon.reduce((a,p)=>a+p[1],0)/tread.polygon.length;checkGround(tread.id||'stair-'+rows.length,toWorld(castle,[x,tread.top,z]));}
 const plaza=root.getObjectByName('target-plaza-paving-surface');if(plaza){const g=plaza.geometry,p=g.attributes.position;for(let i=0;i<p.count;i+=Math.max(3,Math.floor(p.count/60/3)*3)){if(i+2>=p.count)break;const q=new T.Vector3();for(let j=0;j<3;j++)q.add(new T.Vector3().fromBufferAttribute(p,i+j));q.multiplyScalar(1/3).applyMatrix4(plaza.matrixWorld);checkGround('plaza-triangle-'+i/3,q);}}
 // Sample newly-built external public surfaces from their real triangles,
 // independently of the adapter's own mesh selection. This catches missing
 // registration of bridge decks, rail promenade, waterfront treads. Private house links remain non-public.
 const externalPrefixes=['bay-bridge-walking-deck-','bridge-stair-connector-cell-','front-bay-promenade-stone-deck','old-waterfront-continuous-stair-decks','old-waterfront-twisted-rail-landing'];
 const externalMeshes=[];
 root.traverse(mesh=>{if(mesh.isMesh&&externalPrefixes.some(prefix=>mesh.name.startsWith(prefix)))externalMeshes.push(mesh);});
 for(const mesh of externalMeshes){
   const geo=mesh.geometry,p=geo.attributes.position,index=geo.index,triCount=(index?.count??p.count)/3,normalMatrix=new T.Matrix3().getNormalMatrix(mesh.matrixWorld),step=Math.max(1,Math.floor(triCount/16));
   for(let face=0;face<triCount;face+=step){
     const vertices=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(p,index?index.getX(face*3+k):face*3+k));
     const normal=vertices[1].clone().sub(vertices[0]).cross(vertices[2].clone().sub(vertices[0])).normalize().applyMatrix3(normalMatrix).normalize();
     const centre=vertices.reduce((sum,v)=>sum.add(v),new T.Vector3()).multiplyScalar(1/3).applyMatrix4(mesh.matrixWorld);
     if(normal.dot(centre.clone().normalize())<.5)continue;
     checkGround('external:'+mesh.name+':'+face,centre);
   }
 }
 function move(id,asset,a,b,expected){const previous=toWorld(asset,a),next=toWorld(asset,b),velocity=next.clone().sub(previous).normalize(),at=performance.now(),blocked=provider.walls(previous,next,velocity);timings.push(performance.now()-at);contacts.push({id,blocked,expected,passed:blocked===expected,contact:provider.report().lastWall});}
 if(main){const entry=candidate.report.newCity.geometry.entry,y=entry.position[1],z=entry.position[2],x=entry.clearWidth/2+.8;move('new-main-open-arch',main,[0,y,z+.5],[0,y,z-1.8],false);move('new-main-solid-pier',main,[x,y,z+.5],[x,y,z-1.8],true);}
 if(old){move('old-gate-open-arch',old,[0,.3,17],[0,.3,14],false);move('old-gate-solid-pier',old,[3,.3,17],[3,.3,14],true);}
 const sorted=[...timings].sort((a,b)=>a-b);return{version:'target-city-walk-audit-4',at:new Date().toISOString(),externalMeshes:externalMeshes.map(m=>m.name),ground:rows,contacts,failedRows:rows.filter(r=>!r.passed),failures:rows.filter(r=>!r.passed).length+contacts.filter(r=>!r.passed).length,profile:{queries:timings.length,meanMs:timings.reduce((a,b)=>a+b,0)/Math.max(1,timings.length),p95Ms:sorted[Math.floor(sorted.length*.95)]??null},provider:provider.report(),actualPlayerWalked:false,productionInstalled:false,accepted:false,limitations:['Finite ray/support probes on actual current meshes; no real player trajectory, jump, camera or gameplay simulation.','Runtime game collision pipeline and legacy platforms not replaced by this read-only audit.']};
}
