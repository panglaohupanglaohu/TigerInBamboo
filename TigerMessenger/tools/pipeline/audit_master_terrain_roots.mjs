import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {writeFile} from 'node:fs/promises';
const baseline=process.argv.includes('--baseline');
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
try{
 const p=await b.newPage();await p.goto('http://localhost:8931/TigerMessenger/?autostart=1'+(baseline?'':'&citadelMasterTerrain=5'));
 await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('citadel-retaining-planting'),null,{timeout:180000});
 if(!baseline)await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('castleContainer')?.userData.masterTerrainCandidate?.status==='ready',null,{timeout:180000});
 const report=await p.evaluate(()=>{
  const {scene,THREE:T}=window.__tm,c=scene.getObjectByName('castleContainer'),city=c.getObjectByName('highland-west-city');c.updateWorldMatrix(true,true);
  const meshes=['citadel-oskar-grid-mountain-surface','highland-ravine-wall-west','citadel-coastal-cliff-seal','new-city-rock-shoulder','old-shore-blender-rock-support'].map(n=>c.getObjectByName(n)).filter(Boolean);
  const ray=new T.Raycaster();ray.layers.enableAll();ray.far=400;const up=new T.Vector3(0,1,0).transformDirection(c.matrixWorld),rows=[];
  const check=(name,index,position,frame)=>{const world=frame.localToWorld(new T.Vector3(...position));ray.set(world.clone().addScaledVector(up,150),up.clone().negate());const hit=ray.intersectObjects(meshes,false)[0];rows.push({name,index,position,gap:hit?world.clone().sub(hit.point).dot(up):null});};
  const mountain=c.getObjectByName('citadel-mountain-cypress-groves');for(const row of mountain?.userData.planting?.cypress||[])check('mountain-cypress',row.index,row.root,c);
  const retaining=c.getObjectByName('citadel-retaining-planting');for(const [i,row]of(retaining?.userData.planting?.planted||[]).entries())check('retaining-'+row.kind,i,[row.x,row.y,row.z],city);
  const grove=c.getObjectByName('highland-mountain-slope-vegetation');for(const tree of grove?.children||[])if(tree.visible&&tree.userData.role==='mountain-slope-vegetation')check('original-tree',tree.name,tree.position.toArray(),grove);
  return {rows,scope:'known mountain cypress, retaining plants and original unmerged mountain trees; other vegetation not included'};
 });
 await writeFile(new URL('../../artifacts/pipeline/citadel-master-terrain/'+(baseline?'baseline-roots.json':'r05-roots.json'),import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify({total:report.rows.length,needsCheck:report.rows.filter(r=>r.gap===null||r.gap>.2||r.gap<-.4)}));
}finally{await b.close();}
