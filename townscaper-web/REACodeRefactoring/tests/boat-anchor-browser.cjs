const {chromium}=require('playwright'),fs=require('fs');
(async()=>{
const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],reports=[];
page.on('pageerror',e=>errors.push(e.message));
for(const grid of ['quad','mixed']){
 await page.goto('http://localhost:8769/index.html?scene=badnorth&grid='+grid);
 await page.waitForFunction(()=>window.rea?.battle?.running);
 const report=await page.evaluate(async()=>{
  const THREE=await import('three'),{capturePlatformAnchor,resolvePlatformAnchor}=await import('./src/core/platform-anchor.js');
  const b=rea.battle;b.paused=true;b.t=4;b.nextWave=3;b.update(0);
  const boat=b.boats[0];if(!boat)throw Error('no boat');
  // Real arrow hit -> private hit/bleed path. The shot ends at its source height.
  const target=boat.crew[0],y=target.y+.08;
  target.hp=target.max=3;
  const mesh=new THREE.Object3D();b.group.add(mesh);
  b.arrows.push({mesh,t:1,dur:1,from:[target.x,y,target.z],to:[target.x,y,target.z],shot:{v:3,th:Math.PI/2},target,stuck:false});
  b.update(0);
  const stain=boat.stains[0];if(!stain||target.hp!==2)throw Error('real arrow failed to create stain');
  const mark=new THREE.Matrix4();b.blood.getMatrixAt(stain.i,mark);
  const expected=boat.mesh.matrix.clone().invert().multiply(mark);
  const error=(a,c)=>Math.max(...a.elements.map((v,i)=>Math.abs(v-c.elements[i])));
  if(error(stain.local,expected)>1e-6)throw Error('anchor not captured at impact');
  const saved=stain.local.clone(),platform=boat.mesh.matrix.clone();
  b.group.position.set(2,1,-3);b.group.rotation.y=.4;b.group.scale.setScalar(1.2);b.group.updateMatrixWorld(true);
  b.paused=false;for(let i=0;i<12;i++)b.update(1/30);b.paused=true;
  const after=new THREE.Matrix4();b.blood.getMatrixAt(stain.i,after);
  const expectedAfter=boat.mesh.matrix.clone().multiply(saved);
  const drift=error(after,expectedAfter),motion=error(platform,boat.mesh.matrix);
  if(drift>1e-6||motion<.01||error(saved,stain.local)!==0)throw Error('moving parent/boat drift');
  const invalid=new THREE.Matrix4().makeScale(0,1,1);let singularRejected=false;try{capturePlatformAnchor(invalid,mark)}catch{singularRejected=true}
  const source=boat.mesh.matrix.clone(),anchor=capturePlatformAnchor(source,mark);resolvePlatformAnchor(source,anchor);
  if(!source.equals(boat.mesh.matrix)||!singularRejected)throw Error('helper contract');
  b.group.position.set(0,0,0);b.group.rotation.set(0,0,0);b.group.scale.setScalar(1);b.group.updateMatrixWorld(true);
  rea.view.target.copy(boat.mesh.position);rea.view.distance=3.5;rea.view.updateCamera();
  return {stains:boat.stains.length,hitHealth:target.hp,drift,motion,immediateCapture:true,transformedParent:true,singularRejected};
 });
 reports.push({grid,...report});await page.screenshot({path:'artifacts/coverage/boat-anchor-'+grid+'.png'});
}
fs.writeFileSync('artifacts/coverage/boat-anchor-browser.json',JSON.stringify({reports,errors},null,2));await browser.close();if(errors.length)throw Error(errors.join('\n'));console.log('PASS boat anchors',reports);
})().catch(e=>{console.error(e);process.exit(1)});
