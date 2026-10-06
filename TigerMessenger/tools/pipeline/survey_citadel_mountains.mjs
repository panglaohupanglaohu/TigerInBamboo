import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFileSync} from 'node:fs';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']}),p=await b.newPage({viewport:{width:1500,height:1000}});
await p.goto('http://localhost:8931/TigerMessenger/?autostart=1');await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('highland-gate'),null,{timeout:120000});await p.waitForTimeout(7000);
const report=await p.evaluate(()=>{
 const t=__tm,T=t.THREE,c=t.scene.getObjectByName('castleContainer');c.updateWorldMatrix(true,true);const inv=c.matrixWorld.clone().invert();
 t.cameraRig.update=()=>{};t.camera.position.copy(c.localToWorld(new T.Vector3(9,28,104)));t.camera.up.set(0,1,0).transformDirection(c.matrixWorld);t.camera.lookAt(c.localToWorld(new T.Vector3(8,26,-15)));t.camera.fov=47;t.camera.updateProjectionMatrix();t.camera.updateMatrixWorld(true);
 const meshes=[],plants=[];t.scene.traverse(o=>{if(o.isMesh&&!o.userData.isOutline&&o.geometry?.attributes.position)meshes.push(o);if(o.isGroup&&/tree|plant|cypress|pine|grove|vegetation/.test(o.name))plants.push({name:o.name,parents:[o.parent?.name,o.parent?.parent?.name],kind:o.userData.kind,world:o.getWorldPosition(new T.Vector3()).toArray(),local:c.worldToLocal(o.getWorldPosition(new T.Vector3())).toArray()});});
 const ray=new T.Raycaster();ray.layers.enableAll();const probes=[];
 for(const xy of[[675,604],[677,671],[1010,640],[975,642],[539,604],[1018,659],[1131,550]]){
  ray.setFromCamera(new T.Vector2(xy[0]/750-1,1-xy[1]/500),t.camera);const hits=ray.intersectObjects(meshes,false).filter(h=>!h.object.material?.transparent);
  probes.push({xy,hits:hits.slice(0,3).map(h=>({name:h.object.name,parents:[h.object.parent?.name,h.object.parent?.parent?.name],local:h.point.clone().applyMatrix4(inv).toArray(),face:h.face,material:h.object.material.name,instanceId:h.instanceId}))});
 }
 const peaks=[];const terrain=c.getObjectByName('citadel-oskar-grid-mountain-surface'),a=terrain.geometry.attributes.position;
 for(let i=0;i<a.count;i++){const v=new T.Vector3().fromBufferAttribute(a,i).applyMatrix4(terrain.matrixWorld).applyMatrix4(inv);if(v.y<25)continue;const found=peaks.find(p=>Math.hypot(p[0]-v.x,p[2]-v.z)<6);if(!found)peaks.push(v.toArray());else if(v.y>found[1])found.splice(0,3,...v.toArray());}
 const rail=t.messenger.landmarks.tramSystem.curves.red;return {probes,plants,peaks,rail:[3219,3233,3245,3260].map(i=>({i,world:rail.getPointAt(i/3600).toArray(),local:c.worldToLocal(rail.getPointAt(i/3600)).toArray()}))};
});writeFileSync(new URL('../../artifacts/pipeline/citadel-mountain-two-hour/survey.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({probes:report.probes,peaks:report.peaks}));await b.close();
