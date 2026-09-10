import { register } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
const root = new URL('../../', import.meta.url);
const threeUrl = new URL('vendor/three.module.js', root).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s,c,next){ if(s==='three') return {url:${JSON.stringify(threeUrl)},shortCircuit:true}; return next(s,c); }`), import.meta.url);
const THREE = await import('three');
const {buildImpastoMossyGround} = await import('../../src/assets/terrain/mossyGround.js');
const results = [];
for (const footprint of [{rx:18.4,rz:11.6,segments:48}, null]) {
  const group = buildImpastoMossyGround({dir:new THREE.Vector3(0,1,0),planetRadius:160,seed:9101,yaw:0.6,footprint,baseLift:0.62,heightScale:0.55});
  group.updateMatrixWorld(true);
  const mesh = group.getObjectByName('mossy-terrain');
  const normals = mesh.geometry.attributes.normal;
  let downward = 0;
  for(let i=0;i<normals.count;i++) if(normals.getY(i)<=0) downward++;
  let hits = 0;
  for(const x of [-3,0,3]) for(const z of [-3,0,3]) {
    const dir = new THREE.Vector3(x,160,z).normalize();
    const ray = new THREE.Raycaster(dir.clone().multiplyScalar(174),dir.clone().negate());
    if(ray.intersectObject(mesh,false).length) hits++;
  }
  results.push({kind:footprint?'organic-saihoji':'legacy-square',normals:normals.count,downward,top_ray_hits:hits,passed:downward===0 && hits===9});
}
const report = {passed:results.every(r=>r.passed),results,scope:'Actual original factory; visible front-face raycasts from above, organic and unchanged legacy branches'};
const out=new URL('artifacts/pipeline/saihoji-terrain/',root);mkdirSync(out,{recursive:true});
writeFileSync(new URL('winding-report.json',out),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
process.exitCode=report.passed?0:1;
