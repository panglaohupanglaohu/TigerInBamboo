const{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),fs=require('fs'),assert=require('node:assert/strict');(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}),p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));const out={solvers:{},errors};
try{
  for(const solver of ['spring','shape','joint']){
    await p.goto(`http://localhost:8769/planet.html?solver=${solver}&modules=all`);
    await p.waitForFunction(()=>window.planetDemo?.sizeReport,{timeout:30000});
    const snap=await p.evaluate(()=>({solver:planetDemo.solver,conflict:planetDemo.conflict,count:planetDemo.sizeReport.count,tris:planetDemo.land.geometry.attributes.position.array.length/3,fin:[...planetDemo.land.geometry.attributes.position.array].every(Number.isFinite)}));
    out.solvers[solver]=snap;
    assert.equal(snap.solver,solver);
    assert.ok(snap.fin,'positions finite');
  }
  const j=out.solvers.joint.conflict,s=out.solvers.spring.conflict;
  assert.ok(j,'joint conflict report present');
  assert.ok(j.disagreeMean<=s.disagreeMean+1e-9,`joint disagreeMean ${j.disagreeMean} <= spring ${s.disagreeMean}`);
  await p.goto('http://localhost:8769/planet.html?solver=joint&modules=all');
  await p.waitForFunction(()=>window.planetDemo?.sizeReport);
  await p.screenshot({path:'artifacts/coverage/sphere-joint-solver.png'});
  assert.deepEqual(errors,[]);
  fs.writeFileSync('artifacts/coverage/sphere-joint-solver-browser.json',JSON.stringify(out,null,2));
  console.log(JSON.stringify(out.solvers,(k,v)=>typeof v==='number'?+v.toFixed?.(4):v,2));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
