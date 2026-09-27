import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import * as T from '../../vendor/three.module.js';
import {buildRig,pose,snapshot,clips} from '../../artifacts/pipeline/courier-production/rig.js';
import data from '../../assets/models/optimized/human-courier-production/head-3/geometry.js';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const dest=path.join(base,'assets/models/optimized/human-courier-production');
const r=buildRig(data),fps=24,report={fps,units:'metres',rounds:{}};
for(const round of [1,2]){
  const out={fps,round,rest:snapshot(r),clips:[]};report.rounds[round]={};
  for(const [name,clip] of Object.entries(clips)){
    const frames=[],count=Math.round(clip.duration*fps),metrics={maxFootIK:0,maxHandIK:0,minContactSoleY:1,maxContactSoleY:-1,maxPalmGap:0,limbWallVertices:0,finite:true};
    for(let i=0;i<=count;i++){
      const m=pose(r,name,i/count*clip.duration,round,round);
      metrics.maxFootIK=Math.max(metrics.maxFootIK,m.footError);metrics.maxHandIK=Math.max(metrics.maxHandIK,m.handError);
      for(const side of ['L','R']){const foot=r.feet[side];if(foot.contact){const min=Math.min(...foot.points.map(p=>p.clone().applyMatrix4(foot.ankle.matrixWorld).y));metrics.minContactSoleY=Math.min(metrics.minContactSoleY,min);metrics.maxContactSoleY=Math.max(metrics.maxContactSoleY,min)}
        if(m.contactHands){const o=r.nodes.get('Palm_'+side);let min=Infinity;o.traverse(mesh=>{if(mesh.isMesh){const a=mesh.geometry.attributes.position;for(let k=0;k<a.count;k++)min=Math.min(min,new T.Vector3().fromBufferAttribute(a,k).applyMatrix4(mesh.matrixWorld).y)}});metrics.maxPalmGap=Math.max(metrics.maxPalmGap,Math.abs(min-1.05))}
      }
      if(name==='vault')for(const mesh of r.meshes){if(!/^(Boot_|Trouser_|Forearm|Palm_)/.test(mesh.name))continue;const a=mesh.geometry.attributes.position;for(let k=0;k<a.count;k++){const p=new T.Vector3().fromBufferAttribute(a,k).applyMatrix4(mesh.matrixWorld);if(Math.abs(p.x)<.60&&Math.abs(p.z)<.12&&p.y>0&&p.y<1.05)metrics.limbWallVertices++}}
      const f=snapshot(r);metrics.finite&&=f.nodes.every(n=>[...n.position,...n.quaternion].every(Number.isFinite));frames.push(f);
    }
    out.clips.push({name,duration:count/fps,frames});report.rounds[round][name]=metrics;
  }
  fs.writeFileSync(path.join(dest,`motion-round-${round}.json`),JSON.stringify(out));
}
fs.writeFileSync(path.join(base,'artifacts/pipeline/courier-production/verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
