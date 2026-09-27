import {chromium} from '/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const out='TigerMessenger/assets/models/optimized/moebius-v10';await mkdir(out,{recursive:true});
const b=await chromium.launch({channel:'chrome',headless:true});
try{const p=await b.newPage();await p.goto('http://localhost:8931/TigerMessenger/?autostart=1&crystalV10=10');await p.waitForFunction(()=>window.__tm?.messenger?.landmarks?.abandonedGate?.userData?.seatRoot?.userData.moebiusV10,null,{timeout:180000});
const data=await p.evaluate(async()=>{
 const t=window.__tm,T=t.THREE,l=t.messenger.landmarks;t.scene.updateMatrixWorld(true);
 // Restore distance-culled visibility before capturing the complete authored assemblies.
 t.distanceCulling?.recollect();
 const {exportWorldGLB}=await import('/TigerMessenger/tools/world/export_world_glb.js');
 function copy(o){if(!o.visible||o.userData.isOutline||o.isLight)return null;const c=o.isMesh?new T.Mesh(o.geometry,o.material):new T.Group();c.name=o.name;c.position.copy(o.position);c.quaternion.copy(o.quaternion);c.scale.copy(o.scale);for(const a of o.children){const x=copy(a);if(x)c.add(x);}return c;}
 const result={};
 for(const kind of ['city','gate']){
  const sc=new T.Scene(),anchor=kind==='gate'?l.abandonedGate.userData.seatRoot:l.moebiusSwamp;
  const origin=anchor.getWorldPosition(new T.Vector3()),up=origin.clone().normalize(),q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),up),inv=new T.Matrix4().compose(origin,q,new T.Vector3(1,1,1)).invert();
  const sources=kind==='gate'?[l.abandonedGate.userData.seatRoot,l.abandonedGate.userData.seatRoot.userData.siteRoot]:[...l.moebius.crystals.map(r=>r.group),l.moebiusSwamp,l.moebius.v7Shores];
  for(const source of sources){const c=copy(source);inv.clone().multiply(source.matrixWorld).decompose(c.position,c.quaternion,c.scale);sc.add(c);}
  const r=exportWorldGLB(sc,T,{});let binary='';for(let i=0;i<r.bytes.length;i+=8192)binary+=String.fromCharCode(...r.bytes.subarray(i,i+8192));result[kind]={data:btoa(binary),manifest:r.manifest};
 }
 return result;
});
for(const [kind,r] of Object.entries(data)){await writeFile(`${out}/${kind}-r10.glb`,Buffer.from(r.data,'base64'));await writeFile(`${out}/${kind}-r10-manifest.json`,JSON.stringify(r.manifest,null,2));console.log(kind,r.manifest.meshes,r.manifest.bytes);}
}finally{await b.close()}
