import * as T from 'three';

/** Lake-only water-constrained oars. Original crew identities, shoulders, source
 * meshes and authored torso poses remain; forearms meet the actual new grips. */
export function installSwampWarshipRowing(boat,inner){
 const api=boat.userData.warshipV6;if(!api)return null;
 const previous=api.posePostProcess,nodes=api.nodes,records=[],up=new T.Vector3(0,1,0),dir=new T.Vector3(),v=new T.Vector3(),elbow=new T.Vector3(),handPoint=new T.Vector3(),q=new T.Quaternion(),invQ=new T.Quaternion();
 boat.updateWorldMatrix(true,true);
 for(let i=0;i<26;i++){
  const oar=nodes.get('n'+(63+i*5)),blade=nodes.get('n'+(66+i*5)),hands=[];
  for(const side of ['L','R']){
   const hand=nodes.get(`add:hand-${i}${side}`),forearm=nodes.get(`add:forearm-${i}${side}`);
   hand.getWorldPosition(v);oar.worldToLocal(v);oar.getWorldQuaternion(invQ).invert();hand.getWorldQuaternion(q);
   hands.push({hand,forearm,grip:v.clone(),rotation:invQ.clone().multiply(q),baseScale:forearm.scale.clone()});
  }
  records.push({oar,blade,hands,side:i<13?-1:1,stroke:'rest',targetY:25.42});
 }
 const report={version:1,records,waterY:25};
 api.posePostProcess=()=>{
  previous?.();boat.updateWorldMatrix(true,true);
  const speed=boat.userData.oarSpeed,phase=boat.userData.oarPhase/6.2*Math.PI*2;
  for(let i=0;i<records.length;i++){
   const r=records[i],row=boat.userData.crew.userData.rows[i];if(!row.embarked||row.sedateT>0)continue;
   const moving=speed>.02,p=phase+i%13*.018,s=Math.sin(p),blend=.5+.5*Math.tanh(s*4);
   r.stroke=moving?(s>=0?'power':'recovery'):'rest';r.targetY=moving?25.42-.64*blend:25.42;
   // Blade origin is 1.585 units from the actual oarlock. Solve its water
   // height with current hull bob and scale instead of pitching the hull.
   r.oar.getWorldPosition(v);inner.worldToLocal(v);
   const length=r.blade.position.y,dx=moving?.28*Math.cos(p):.12,roll=boat.rotation.z,dy=(r.targetY-v.y)/(boat.scale.y*length*Math.cos(roll))-Math.tan(roll)*dx;
   dir.set(dx,dy,r.side*Math.sqrt(Math.max(.01,1-dx*dx-dy*dy))).normalize();r.oar.quaternion.setFromUnitVectors(up,dir);r.oar.updateWorldMatrix(true,true);
   for(const h of r.hands){
    // Forearm geometry's original endpoints are y +/- .055. Keep its
    // elbow endpoint on the authored upper arm; change the wrist endpoint.
    elbow.set(0,-.055,0);h.forearm.localToWorld(elbow);h.forearm.parent.worldToLocal(elbow);
    handPoint.copy(h.grip);r.oar.localToWorld(handPoint);h.hand.parent.worldToLocal(handPoint);h.hand.position.copy(handPoint);
    r.oar.getWorldQuaternion(q).multiply(h.rotation);h.hand.parent.getWorldQuaternion(invQ).invert();h.hand.quaternion.copy(invQ).multiply(q);
    dir.subVectors(handPoint,elbow);h.forearm.position.copy(elbow).addScaledVector(dir,.5);h.forearm.quaternion.setFromUnitVectors(up,v.copy(dir).normalize());h.forearm.scale.copy(h.baseScale);h.forearm.scale.y=dir.length()/.11;
   }
  }
 };
 report.dispose=()=>{api.posePostProcess=previous;};boat.userData.swampRowing=report;return report;
}

/** Last 15% of the original arc eases into the radial exit tangent. */
export function sampleSwampDeparture(k,out,tangent){
 let angle,radius,da,dr=6;
 if(k<=1){const u=k*k*(3-2*k);radius=16+6*u;angle=1.1-.8*u;da=-.8;
  if(u>.85){const s=(u-.85)/.15,s2=s*s,s3=s2*s;angle=(2*s3-3*s2+1)*.42+(s3-2*s2+s)*(-.12)+(-2*s3+3*s2)*.3+(s3-s2)*.005;da=((6*s2-6*s)*.42+(3*s2-4*s+1)*(-.12)+(-6*s2+6*s)*.3+(3*s2-2*s)*.005)/.15;}
 }else{angle=.3+(k-1)*.05;radius=22+(k-1)*9;da=.05;dr=9;}
 out.set(Math.cos(angle)*radius,25.02,Math.sin(angle)*radius);
 tangent?.set(dr*Math.cos(angle)-radius*Math.sin(angle)*da,0,dr*Math.sin(angle)+radius*Math.cos(angle)*da);
}
