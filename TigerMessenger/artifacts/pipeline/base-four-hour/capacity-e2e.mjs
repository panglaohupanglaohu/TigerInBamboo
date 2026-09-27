import assert from 'node:assert/strict';import{chromium}from'/Users/panglaohu/Downloads/TigerInBamboo/tools/shot/node_modules/playwright/index.mjs';import{writeFile}from'node:fs/promises';import{execFileSync}from'node:child_process';
const dir='artifacts/pipeline/base-four-hour';const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal','--disable-background-timer-throttling']});try{const p=await b.newPage({viewport:{width:1400,height:950}}),errors=[];p.on('pageerror',e=>errors.push(e.stack));await p.goto('http://localhost:8931/TigerMessenger/?autostart=1&baseReview=1&robotOps=1');await p.waitForFunction(()=>window.__tm?.robotOperations,null,{timeout:180000});await p.waitForTimeout(1500);const start=p.getByRole('button',{name:'开始送信',exact:true});if(await start.isVisible())await start.click();await p.evaluate(()=>{__tm.robotOperations.panel.element.hidden=true;__tm.robotOperations.focus('field')});

const report=await p.evaluate(()=>{
 const o=__tm.robotOperations,t=__tm.messenger.landmarks.tramSystem;t.seekFreight('blue',.08);const batches=[],shipments=[];
 for(let round=0;round<3;round++){
  if(round){shipments.push(o.receiveShipment());o.update(28);}
  o.update(271);
  for(const kind of ['locust','ant','beetle']){
   if(o.logistics.factoryStock(kind).length<3)continue;
   const s=t.freightServices[0],load=s.loadingStops.find(x=>x.name===kind);t.seekFreight('red',load.progress-.001);t.update(1);const reserved=o.logistics.trains.red.job?.ids.slice()||[];o.update(38);
   const unload=s.loadingStops.find(x=>x.name==='frontline');t.seekFreight('red',unload.progress-.001);t.update(1);o.update(62);
   batches.push({round,kind,ids:reserved,invariants:o.logistics.assertInvariants()});
  }
 }
 const before=o.logistics.snapshot(),save=o.save(),restore=o.load();o.update(.01);return{shipments,batches,save,restore,invariants:o.logistics.assertInvariants(),sameIds:JSON.stringify(before.units.map(u=>u.id))===JSON.stringify(o.logistics.units.map(u=>u.id)),counts:Object.fromEntries(['locust','ant','beetle'].map(k=>[k,o.logistics.units.filter(u=>u.kind===k).length])),factories:o.logistics.snapshot().factories,units:o.logistics.snapshot().units};
});
await writeFile(`${dir}/capacity-e2e.json`,JSON.stringify({mode:'accelerated integration diagnostic: two actual shipment requests, 28-second material unload, parallel factory production and physical train loading/unloading. No manual unit insertion.',report,errors},null,2));console.log(JSON.stringify({counts:report.counts,invariants:report.invariants,batches:report.batches.length,save:report.save,restore:report.restore,errors}));
assert.equal(report.invariants.total,24);assert.equal(report.invariants.counts.deployed,24);assert.equal(report.batches.length,8);assert(report.batches.every(b=>b.ids.length===3));assert(report.shipments.every(Boolean));assert.equal(report.sameIds,true);assert.equal(report.save,true);assert.equal(report.restore,true);assert.deepEqual(errors,[]);
}finally{await b.close()}
