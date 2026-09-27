import fs from 'node:fs';
import * as T from '../../vendor/three.module.js';
import {buildRig,pose,snapshot,clips} from '../../artifacts/pipeline/courier-production-v2/rig.js';
import data from '../../assets/models/optimized/human-courier-production-v2/head-8/geometry.js';
const r=buildRig(data),fps=24,report={fps,units:'metres',rounds:{}};
for(const round of [3,4,5,6,7]){
 const out={fps,round,clips:[]};report.rounds[round]={};
 for(const name of (round===5||round===6?['vault']:Object.keys(clips))){
  const actualRound=name==='vault'?round:Math.min(round,4),frames=[],count=Math.round(clips[name].duration*fps);
  const metrics={actualRound,maxFootIK:0,maxHandIK:0,maxContactSoleGap:0,maxSupportPalmGap:0,wallVertexSamples:0,finite:true};
  for(let i=0;i<=count;i++){
   const m=pose(r,name,i/count*clips[name].duration,actualRound);metrics.maxFootIK=Math.max(metrics.maxFootIK,m.footError);metrics.maxHandIK=Math.max(metrics.maxHandIK,m.handError);
   for(const side of ['L','R'])if(r.feet[side].contact){const foot=r.feet[side],y=Math.min(...foot.points.map(p=>p.clone().applyMatrix4(foot.ankle.matrixWorld).y));metrics.maxContactSoleGap=Math.max(metrics.maxContactSoleGap,Math.abs(y))}
   if(name==='vault')for(const mesh of r.meshes){
    if(!/^(Boot_|Trouser_|Forearm|Palm_)/.test(mesh.name))continue;
    const a=mesh.geometry.attributes.position;let minY=Infinity;
    for(let j=0;j<a.count;j++){const p=new T.Vector3().fromBufferAttribute(a,j).applyMatrix4(mesh.matrixWorld);minY=Math.min(minY,p.y);if(Math.abs(p.x)<1.5&&Math.abs(p.z)<.12&&p.y>0&&p.y<1.05)metrics.wallVertexSamples++}
    if(m.contactHands&&mesh.name.startsWith('Palm_R'))metrics.maxSupportPalmGap=Math.max(metrics.maxSupportPalmGap,Math.abs(minY-1.05));
   }
   const f=snapshot(r);metrics.finite&&=f.nodes.every(n=>[...n.position,...n.quaternion].every(Number.isFinite));frames.push(f);
  }
  out.clips.push({name,actualRound,duration:count/fps,frames});report.rounds[round][name]=metrics;
 }
 fs.writeFileSync(`assets/models/optimized/human-courier-production-v2/motion-round-${round}.json`,JSON.stringify(out));
}
fs.writeFileSync('artifacts/pipeline/courier-production-v2/verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
