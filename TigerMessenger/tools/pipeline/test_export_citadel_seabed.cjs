const {chromium}=require('../../../tools/e2e/node_modules/playwright-core');
const fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--use-angle=metal']});try{
 const p=await b.newPage();await p.goto('http://localhost:8931/TigerMessenger/?autostart=1');await p.waitForFunction(()=>window.__tm?.scene.getObjectByName('planet-surface')?.__citadelSeabedSource,null,{timeout:180000});
 const result=await p.evaluate(async()=>{
  const T=await import('three'),tm=window.__tm,planet=tm.scene.getObjectByName('planet-surface'),city=tm.scene.getObjectByName('highland-west-city');
  const original=new T.Mesh(planet.__citadelSeabedSource,planet.material);original.matrixAutoUpdate=false;original.matrixWorld.copy(planet.matrixWorld);
  const ray=new T.Raycaster();ray.layers.enableAll();ray.far=100;
  const radialRadius=(mesh,w)=>{const d=w.clone().normalize();ray.set(d.clone().multiplyScalar(200),d.clone().negate());const h=ray.intersectObject(mesh,false)[0];if(!h)throw Error('Missing seabed ray');return h.point.length();};
  let outside=0,maxOutsideError=0;const positions=original.geometry.attributes.position,idx=original.geometry.index;
  for(let i=0;i<idx.count;i+=3){const w=new T.Vector3();for(let j=0;j<3;j++)w.add(new T.Vector3().fromBufferAttribute(positions,idx.getX(i+j)));w.multiplyScalar(1/3).applyMatrix4(planet.matrixWorld);const q=city.worldToLocal(w.clone());
   if(q.y>-60&&q.y<10&&q.x>14&&q.x<41.5&&q.z>-8&&q.z<73)continue;
   maxOutsideError=Math.max(maxOutsideError,Math.abs(radialRadius(original,w)-radialRadius(planet,w)));outside++;
  }
  const depths=[];for(const x of [22,29,32,34])for(const z of [4,24,44,62]){const w=city.localToWorld(new T.Vector3(x,-5,z));depths.push(radialRadius(original,w)-radialRadius(planet,w));}
  const passed=outside>2000&&maxOutsideError<.001&&Math.min(...depths)>2.5&&Math.max(...depths)<3.6;
  const a=planet.geometry.attributes;
  return {report:{...planet.userData.citadelHarborSeabed,outsideSamples:outside,maxOutsideError,depths,passed,scope:'Actual original and modified planet radial rays; outside harbor unchanged, interior deepened; not safe ship docking'},data:{source:'8931 planet-surface with local harbor dredging',positions:Array.from(a.position.array),normals:Array.from(a.normal.array),colors:Array.from(a.color.array),matrix:planet.matrixWorld.toArray()}};
 });
 fs.writeFileSync('TigerMessenger/artifacts/pipeline/citadel-plaza-horse/seabed-web.json',JSON.stringify(result.report,null,2));console.log(result.report);if(!result.report.passed)throw Error('Seabed invariant failed');fs.writeFileSync('TigerMessenger/godot/data/citadel-seabed.json',JSON.stringify(result.data));
}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1});
