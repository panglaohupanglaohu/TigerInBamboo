import * as T from 'three';
import {guardMountainDisplacement} from './guardMountainDisplacement.js';
import {buildMountainSurfaceIndex} from './mountainSurfaceIndex.js';
import {finishMountainRockSurface} from './mountainRockSurfaceFinish.js';
/** Reorient the exterior, below-deck skirt toward actual planetary up.
 * Final-stage only. The measured column crest and all upper support stay fixed.
 * This is geometry relocation, not a normal-only treatment. */
export function reshapeHorseSideRadialCliff(source,{toChart,castleMatrix,enabled=false}={}){
 const report={version:'horse-side-radial-cliff-1',enabled,movedVertices:0,maxDisplacement:0,topSupportFixed:true,visualVerified:false};
 if(!enabled)return{geometry:source.clone(),report};
 const proxy=new T.Mesh(source,new T.MeshBasicMaterial({side:T.DoubleSide}));proxy.matrixAutoUpdate=false;proxy.matrix.copy(toChart);proxy.updateMatrixWorld(true);
 const index=buildMountainSurfaceIndex([proxy]),geometry=source.clone(),p=geometry.attributes.position,fromChart=toChart.clone().invert(),fromWorld=castleMatrix.clone().invert(),q=new T.Vector3(),ray=new T.Ray(new T.Vector3(),new T.Vector3(0,-1,0)),columns=new Map(),moved=new Set();
 for(let i=0;i<p.count;i++){
  q.fromBufferAttribute(p,i).applyMatrix4(toChart);
  const region=T.MathUtils.smoothstep(q.x,35,43)*(1-T.MathUtils.smoothstep(q.x,110,118))*T.MathUtils.smoothstep(q.z,16,25)*(1-T.MathUtils.smoothstep(q.z,108,116));if(!region)continue;
  const key=q.x.toFixed(5)+','+q.z.toFixed(5);let top=columns.get(key);
  if(top===undefined){ray.origin.set(q.x,220,q.z);top=index.sample(ray,0,1000)?.point.y??null;columns.set(key,top);}if(top===null||q.y>top-1)continue;
  const amount=region*T.MathUtils.smoothstep(top-q.y,1,7);
  const world=q.clone().applyMatrix4(castleMatrix),crest=new T.Vector3(q.x,top,q.z).applyMatrix4(castleMatrix),r=world.length();
  if(r>=crest.length()||crest.length()<1)continue;
  const target=crest.setLength(r).applyMatrix4(fromWorld),next=q.clone().lerp(target,amount),distance=next.distanceTo(q);
  if(distance<1e-5)continue;report.maxDisplacement=Math.max(report.maxDisplacement,distance);report.movedVertices++;moved.add(i);next.applyMatrix4(fromChart);p.setXYZ(i,next.x,next.y,next.z);
 }
 report.displacementGuard=guardMountainDisplacement(source.attributes.position,p,source.index);report.maxDisplacement=report.displacementGuard.maxDisplacement;report.movedVertices=report.displacementGuard.movedCorners;
 moved.clear();for(let i=0;i<p.count;i++)if(new T.Vector3().fromBufferAttribute(p,i).distanceToSquared(new T.Vector3().fromBufferAttribute(source.attributes.position,i))>1e-10)moved.add(i);
 proxy.material.dispose();p.needsUpdate=true;
 const smooth=finishMountainRockSurface(geometry,{enabled:true,relax:false,toCastle:toChart}),norm=smooth.geometry.attributes.normal.clone(),old=source.attributes.normal;
 if(old)for(let i=0;i<p.count;i++)if(!moved.has(i))norm.setXYZ(i,old.getX(i),old.getY(i),old.getZ(i));geometry.setAttribute('normal',norm);report.normalDomains={softEdges:smooth.report.softEdges,hardEdges:smooth.report.hardEdges,semanticBarriers:smooth.report.semanticBarriers,changedCorners:smooth.report.changedCorners};smooth.geometry.dispose();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 const ix=source.index,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),oldNormal=new T.Vector3(),newNormal=new T.Vector3();let newlyDegenerate=0,orientationReversals=0;
 for(let f=0;f<(ix?.count??p.count);f+=3){const ids=[0,1,2].map(k=>ix?ix.getX(f+k):f+k);a.fromBufferAttribute(source.attributes.position,ids[0]);b.fromBufferAttribute(source.attributes.position,ids[1]);c.fromBufferAttribute(source.attributes.position,ids[2]);oldNormal.crossVectors(b.sub(a),c.sub(a));a.fromBufferAttribute(p,ids[0]);b.fromBufferAttribute(p,ids[1]);c.fromBufferAttribute(p,ids[2]);newNormal.crossVectors(b.sub(a),c.sub(a));if(oldNormal.lengthSq()>1e-12&&newNormal.lengthSq()<1e-12)newlyDegenerate++;if(oldNormal.dot(newNormal)<-1e-10)orientationReversals++;}
 report.newlyDegenerate=newlyDegenerate;report.orientationReversals=orientationReversals;
 report.beforeTriangles=report.afterTriangles=(source.index?.count??p.count)/3;report.columns=columns.size;geometry.userData={...source.userData,horseSideRadialCliff:report};return{geometry,report};
}
