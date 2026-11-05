// Read-only startup diagnosis in a fresh browser; never attaches to user storage.
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
if(!process.argv[2])throw Error('Provide a new evidence directory');
const out=path.resolve(process.argv[2]);fs.mkdirSync(path.dirname(out),{recursive:true});fs.mkdirSync(out);
const report={startedAt:new Date().toISOString(),isolation:'new non-persistent context',samplingIntervalUs:1000,status:'RUNNING',errors:[],scope:'CPU samples with profiler overhead; not gameplay/performance acceptance'};
let browser,cdp,profiling=false;
function save(){fs.writeFileSync(path.join(out,'profile-summary.json'),JSON.stringify(report,null,2));}
save();
try{
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addInitScript(()=>{globalThis.workshopStartupTasks=[];try{new PerformanceObserver(list=>{for(const e of list.getEntries())globalThis.workshopStartupTasks.push({startMs:Math.round(e.startTime),durationMs:Math.round(e.duration)});globalThis.workshopStartupTasks.sort((a,b)=>b.durationMs-a.durationMs);globalThis.workshopStartupTasks.length=Math.min(20,globalThis.workshopStartupTasks.length);}).observe({type:'longtask',buffered:true});}catch{}});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
 cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:report.samplingIntervalUs});await cdp.send('Profiler.start');profiling=true;
 const started=Date.now();await page.goto((process.env.WORKSHOP_BASE_URL||'http://localhost:8931')+'/TigerMessenger/pipeline.html#learning');
 await page.waitForFunction(()=>document.querySelector('#connection')?.textContent.includes('游戏已连接'),null,{timeout:90000});
 report.connectedAfterMs=Date.now()-started;
 const {profile}=await cdp.send('Profiler.stop');profiling=false;
 const metrics=await cdp.send('Performance.getMetrics');report.navigationStartSeconds=metrics.metrics.find(m=>m.name==='NavigationStart')?.value||null;
 fs.writeFileSync(path.join(out,'startup.cpuprofile'),JSON.stringify(profile));
 const nodes=new Map(profile.nodes.map(n=>[n.id,{...n,selfUs:0,totalUs:0}])),parents=new Map();
 for(const n of profile.nodes)for(const child of n.children||[])parents.set(child,n.id);
 let sampledUs=0;const timeline=[];for(let i=0;i<(profile.samples||[]).length;i++){const delta=profile.timeDeltas?.[i]||0;sampledUs+=delta;timeline.push({id:profile.samples[i],delta,timeMs:(profile.startTime+sampledUs)/1000-(report.navigationStartSeconds||0)*1000});const row=nodes.get(profile.samples[i]);if(row)row.selfUs+=delta;let id=profile.samples[i];const seen=new Set();while(nodes.has(id)&&!seen.has(id)){seen.add(id);nodes.get(id).totalUs+=delta;id=parents.get(id);}}
 const present=n=>({name:n.callFrame.functionName||'(anonymous)',url:n.callFrame.url.split('?')[0],line:n.callFrame.lineNumber+1,selfMs:Math.round(n.selfUs/1000),inclusiveMs:Math.round(n.totalUs/1000)});
 report.sampledMs=Math.round(sampledUs/1000);report.samples=profile.samples?.length||0;
 report.topSelf=[...nodes.values()].sort((a,b)=>b.selfUs-a.selfUs).slice(0,25).map(present);
 report.topInclusive=[...nodes.values()].filter(n=>n.callFrame.url).sort((a,b)=>b.totalUs-a.totalUs).slice(0,30).map(present);
 report.frames=await Promise.all(page.frames().map(frame=>frame.evaluate(()=>({url:location.pathname,tasks:globalThis.workshopStartupTasks||[],stages:globalThis.__tmStartup?.stages||[]}))));
 // CDP profile timestamps and NavigationStart share monotonic seconds. Long-task
 // entries use document-relative milliseconds. Samples approximate each interval.
 report.longTaskStacks=report.navigationStartSeconds?(report.frames[0]?.tasks||[]).slice(0,5).map(task=>{
  const rows=new Map();let samples=0;
  for(const point of timeline){if(point.timeMs<task.startMs||point.timeMs>=task.startMs+task.durationMs)continue;samples++;let id=point.id;const seen=new Set();while(nodes.has(id)&&!seen.has(id)){seen.add(id);const node=nodes.get(id);if(node.callFrame.url){const row=rows.get(id)||{...node,selfUs:0,totalUs:0};row.totalUs+=point.delta;if(id===point.id)row.selfUs+=point.delta;rows.set(id,row);}id=parents.get(id);}}
  return {...task,samples,topCallers:[...rows.values()].sort((a,b)=>b.totalUs-a.totalUs).slice(0,25).map(present)};
 }):null;
 await page.screenshot({path:path.join(out,'profile-learning.png')});report.status=report.errors.length?'FAIL':'CAPTURED';
}catch(error){report.status='FAIL';report.error=error.message;}
finally{if(profiling)try{const {profile}=await cdp.send('Profiler.stop');fs.writeFileSync(path.join(out,'partial-startup.cpuprofile'),JSON.stringify(profile));}catch{}await browser?.close();report.finishedAt=new Date().toISOString();save();}
console.log(JSON.stringify({status:report.status,output:out,connectedAfterMs:report.connectedAfterMs}));if(report.status!=='CAPTURED')process.exitCode=1;
