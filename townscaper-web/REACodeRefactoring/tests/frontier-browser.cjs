const{chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true}),p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[],runs=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});try{
 await p.goto('http://localhost:8769/campaign.html');await p.waitForFunction(()=>typeof campaign==='function');assert.equal(await p.evaluate(()=>campaign().frontier),null);await p.check('#frontier');
 for(let seed=0;seed<8;seed++){
  for(const pos of [-8,0,8]){await p.locator('#frontier-step').fill(String(pos));await p.locator('#frontier-step').dispatchEvent('input');const f=await p.evaluate(()=>campaign().frontier);assert(f.ok,f.reason);assert(f.edgePath.length>1);assert(f.path.length>f.polyline.length);runs.push({seed,pos,edges:f.edgePath.length,samples:f.path.length,length:f.length});}
  if(seed===0){await p.click('[data-s="2"]');await p.screenshot({path:'artifacts/coverage/frontier-graph.png'});await p.click('[data-s="5"]');await p.screenshot({path:'artifacts/coverage/frontier-map.png'});}
  await p.click('#reseed');
 }
 await p.uncheck('#frontier');assert.equal(await p.evaluate(()=>campaign().frontier),null);assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync('artifacts/coverage/frontier-browser.json',JSON.stringify({runs,errors},null,2));console.log('PASS actual optional campaign frontier, 24 positions, reseed and toggle');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
