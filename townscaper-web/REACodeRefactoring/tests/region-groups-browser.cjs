const {chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 const p=await b.newPage({viewport:{width:1440,height:950}}),errors=[],runs=[];
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
 try{
  await p.goto('http://localhost:8769/campaign.html');await p.waitForFunction(()=>typeof campaign==='function');await p.click('[data-s="4"]');
  for(let seed=0;seed<12;seed++){
   const end=await p.evaluate(()=>campaign());assert.equal(end.grouping.actual,6);assert(end.grouping.cutAfter<=end.grouping.cutBefore);assert.equal(end.groupFrame,end.historyLength-1);
   await p.locator('#group-frame').fill('0');await p.locator('#group-frame').dispatchEvent('input');assert.equal((await p.evaluate(()=>campaign())).groupFrame,0);
   if(seed===0)await p.screenshot({path:'artifacts/coverage/region-groups-initial.png'});
   const middle=Math.floor((end.historyLength-1)/2);await p.locator('#group-frame').fill(String(middle));await p.locator('#group-frame').dispatchEvent('input');assert.equal((await p.evaluate(()=>campaign())).groupFrame,middle);
   await p.locator('#group-frame').fill(String(end.historyLength-1));await p.locator('#group-frame').dispatchEvent('input');
   if(seed===0)await p.screenshot({path:'artifacts/coverage/region-groups-final.png'});
   runs.push(end.grouping);await p.click('#reseed');
  }
  await p.click('[data-s="5"]');assert(await p.locator('#group-control').isHidden());
  assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync('artifacts/coverage/region-groups-browser.json',JSON.stringify({runs,errors},null,2));console.log('PASS actual region history slider, 12 reseeds, cut metrics and map switching',runs);
 }finally{await b.close()}
})().catch(e=>{console.error(e);process.exit(1)});
