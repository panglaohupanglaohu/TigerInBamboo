// Diagnostic injection in independent browsers; never natural-combat evidence.
import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const base=process.env.SOCCO_TEST_BASE_URL||'http://localhost:8931/TigerMessenger';
const stamp=new Date().toISOString().replaceAll(':','-');
const output=path.join(root,'artifacts/pipeline/socco-web-evacuation',stamp);
await mkdir(output,{recursive:true});
const files=['src/world/vanguardAssault.js','src/world/vanguardTrooper.js','src/world/soccoBerth.js','src/world/soccoGroundRoutes.js','src/world/gateHaulerCraft.js'];
const digest=b=>createHash('sha256').update(b).digest('hex');
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,digest(await readFile(path.join(root,f)))])));
const localBefore=await hashes(),cases=[];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
try {
 for(const scenario of ['casualty-normal','casualty-normal-blocked','casualty-emergency-blocked']) {
  const context=await browser.newContext(),page=await context.newPage(),errors=[],served={};
  page.setDefaultTimeout(180000);page.on('pageerror',e=>errors.push(e.message));
  const responseJobs=[];
  page.on('response',response=>{const f=files.find(f=>new URL(response.url()).pathname.endsWith('/'+f));if(f)responseJobs.push(response.body().then(b=>{served[f]=digest(b);}).catch(()=>{}));});
  await page.goto(base+'/',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!!window.__tm?.messenger?.vanguardAssault,null,{timeout:180000});
  const result=await page.evaluate(async({scenario,maxFrames})=>{
   const T=window.__tm.THREE,{scene,messenger}=window.__tm,assault=messenger.vanguardAssault;
   const {saihoujiHubDir}=await import('/TigerMessenger/src/world/saihojiPhalanx.js');
   const {VANGUARD_ASSAULT:rules}=await import('/TigerMessenger/src/world/vanguardAssault.js');
   const {applyVanguardHit,VANGUARD_COMBAT}=await import('/TigerMessenger/src/world/vanguardTrooper.js');
   const {soccoSeatWorldPositions,soccoBoardingPoint}=await import('/TigerMessenger/src/world/gateHaulerCraft.js');
   const checks=[],check=(name,passed,detail)=>checks.push({name,passed:!!passed,...(detail===undefined?{}:{detail:JSON.parse(JSON.stringify(detail))})});
   const fleet=scene.getObjectByName('moebius-aircraft-squad'),troops=new Map();
   scene.traverse(n=>{if(Number.isFinite(n.userData.uid)&&n.userData.parts?.legL)troops.set(n.userData.uid,n);});
   const startPhase=assault.phase(),began=assault.begin(saihoujiHubDir());
   const expectedUIDs=Array.from({length:21},(_,i)=>i+6),fatal=[6,13,20],wounded=[7,14,21],blockUid=8;
   const emergency=scenario.includes('emergency'),blocked=scenario.includes('blocked'),injections=[],returns=[],forced=[],transitions=[];
   const seenRamp=new Set(),seenReturn=new Set(),seenForced=new Set(),deathStates=[];
   let injected=false,withdrawFrame=null,endFrame=null,firstForcedFrame=null,phaseBefore=assault.phase(),lastTransport=[],maxSimTime=0;
   let blockerPosition=null,fleetDepartureFrame=null,fleetBefore=null,fleetAfter=null,blockedFrames=0,normalWithdrawRequested=false;
   const copyTransport=()=>assault.stats().transport.map(h=>({...h,roster:h.roster.map(e=>({...e}))}));
   function hit(uid,count,label) {const tr=troops.get(uid);let last;for(let i=0;i<count;i++)last=applyVanguardHit(tr,'arrow');injections.push({kind:label,uid,arrowHitsInjected:count,result:last});}
   const step=1/60;
   for(let frame=0;frame<maxFrames;frame++) {
    const state=assault.stats(),entries=state.transport.flatMap(h=>h.roster);
    if(!injected&&entries.length===21&&entries.every(e=>e.departed)&&['insert','combat','withdraw'].includes(assault.phase())) {
     injected=true;injections.push({kind:'diagnostic-start',frame,phase:assault.phase(),all21Departed:true});
     for(const uid of fatal)hit(uid,VANGUARD_COMBAT.arrowsPerWound*VANGUARD_COMBAT.vanguardLife,'lethal-real-damage-function');
     for(const uid of wounded)hit(uid,VANGUARD_COMBAT.arrowsPerWound,'one-wound-real-damage-function');
     for(const uid of fatal){const tr=troops.get(uid);deathStates.push({uid,dead:!!tr.userData.dead,life:tr.userData.life});}
     if(blocked) {
      const tr=troops.get(blockUid),up=tr.position.clone().normalize(),tangent=new T.Vector3().crossVectors(up,new T.Vector3(0,1,0)).normalize();
      blockerPosition=tr.position.clone().addScaledVector(tangent,100).normalize().multiplyScalar(tr.position.length());
      injections.push({kind:'persistent-position-blocker',uid:blockUid,reason:'Explicit diagnostic impassable-return substitute, applied before each update until forced or genuinely aboard.',distanceFromStart:tr.position.distanceTo(blockerPosition)});
     }
     if(emergency) {
      fleetBefore=fleet.getWorldPosition(new T.Vector3()).toArray();fleet.position.x+=1000;fleet.updateWorldMatrix(true,true);fleetAfter=fleet.getWorldPosition(new T.Vector3()).toArray();fleetDepartureFrame=frame;
      injections.push({kind:'fleet-root-displacement',frame,before:fleetBefore,after:fleetAfter,reason:'Triggers original fleetLeftStation; no phase override.'});
     }
    }
    if(injected&&!emergency&&!normalWithdrawRequested&&assault.phase()==='combat') {assault.triggerWithdraw();normalWithdrawRequested=true;injections.push({kind:'triggerWithdraw-api',frame});}
    if(blockerPosition&&['combat','withdraw'].includes(assault.phase())&&!troops.get(blockUid).userData.aboard) {troops.get(blockUid).position.copy(blockerPosition);blockedFrames++;}
    const beforePhase=assault.phase();assault.update(step,frame*step);maxSimTime=(frame+1)*step;
    const phase=assault.phase();if(phase!==phaseBefore){transitions.push({frame,seconds:maxSimTime,from:phaseBefore,to:phase});phaseBefore=phase;}
    if(withdrawFrame===null&&(beforePhase==='withdraw'||phase==='withdraw'))withdrawFrame=frame;
    const transport=copyTransport();lastTransport=transport;
    for(const h of transport)for(const e of h.roster) {
     if(e.returningOnRamp)seenRamp.add(e.uid);
     if(e.returned&&!seenReturn.has(e.uid)) {
      seenReturn.add(e.uid);const tr=troops.get(e.uid),craft=scene.getObjectByName(h.name),seats=soccoSeatWorldPositions(craft),seat=seats[e.seat%seats.length];
      returns.push({uid:e.uid,ship:h.name,seat:e.seat,frame,seconds:maxSimTime,departed:e.departed,dead:e.dead,aboard:!!tr.userData.aboard,forced:e.forcedReturn,seenOnRamp:seenRamp.has(e.uid),worldSeatError:tr.getWorldPosition(new T.Vector3()).distanceTo(seat),worldBoardingEndpointError:tr.getWorldPosition(new T.Vector3()).distanceTo(soccoBoardingPoint(craft,e.seat,0)),visible:tr.visible});
     }
     if(e.forcedReturn&&!seenForced.has(e.uid)) {seenForced.add(e.uid);firstForcedFrame??=frame;forced.push({uid:e.uid,ship:h.name,seat:e.seat,frame,seconds:maxSimTime,state:e.forcedState,returned:e.returned,dead:e.dead,seenOnRamp:seenRamp.has(e.uid)});}
    }
    if(phase==='done'){endFrame=frame;break;}
   }
   const roster=lastTransport.flatMap(h=>h.roster),uidSet=new Set(roster.map(e=>e.uid));
   const categories={returned:[],dead:[],forced:[],unresolved:[],ambiguous:[]};
   for(const e of roster){const tags=[e.returned?'returned':null,e.dead?'dead':null,e.forcedReturn?'forced':null].filter(Boolean);categories[tags.length===1?tags[0]:tags.length?'ambiguous':'unresolved'].push(e.uid);}
   const accounting=Object.fromEntries(Object.entries(categories).map(([k,v])=>[k,v.length]));accounting.assigned=roster.length;accounting.departed=roster.filter(e=>e.departed).length;
   const expectedLimit=emergency?12:45;
   check('original 45/12 rules unchanged',rules.withdrawTimeout===45&&rules.withdrawChaseTimeout===12,{normal:rules.withdrawTimeout,emergency:rules.withdrawChaseTimeout});
   check('diagnostic began and reached injection point',began&&injected,{startPhase,began,injected});
   check('same 21 transport identities and unique ship seats',roster.length===21&&expectedUIDs.every(uid=>uidSet.has(uid))&&lastTransport.every(h=>new Set(h.roster.map(e=>e.seat)).size===h.roster.length));
   check('three injected fatalities remain deaths, never recovery',fatal.every(uid=>categories.dead.includes(uid))&&fatal.every(uid=>!seenReturn.has(uid)&&!seenForced.has(uid)),deathStates);
   check('wounded survivors not mistaken for deaths',wounded.every(uid=>!troops.get(uid).userData.dead&&troops.get(uid).userData.life===VANGUARD_COMBAT.vanguardLife-1));
   check('all recovery claims observed on ramp and at actual cabin floor endpoint',returns.every(e=>e.departed&&e.aboard&&!e.dead&&!e.forced&&e.seenOnRamp&&e.worldBoardingEndpointError<.05),{count:returns.length,maxEndpointError:returns.length?Math.max(...returns.map(e=>e.worldBoardingEndpointError)):null,seatCenterOffset:returns.length?Math.max(...returns.map(e=>e.worldSeatError)):null,reason:'Root feet follow the raycast floor at the assigned seat; the seat transform itself can be above this floor.'});
   check('mutually exclusive identity accounting',accounting.unresolved===0&&accounting.ambiguous===0&&accounting.returned+accounting.dead+accounting.forced===21,{accounting,categories});
   if(blocked) {
    check('blocked living soldier explicitly recorded as fallback, not return',categories.forced.includes(blockUid)&&!categories.returned.includes(blockUid),{blockedFrames,forced});
    check('fallback uses exact existing deadline and strict greater-than step',forced.length>0&&forced.every(e=>e.state?.limit===expectedLimit&&e.state.seconds>expectedLimit&&e.state.seconds<=expectedLimit+step*1.1),{expectedLimit,firstForcedFrame,withdrawFrame,forcedSeconds:forced.map(e=>e.state?.seconds)});
   } else check('normal casualties recover all 18 surviving transport troops genuinely',accounting.returned===18&&accounting.forced===0,accounting);
   if(emergency)check('actual fleet displacement triggers withdraw promptly',fleetDepartureFrame!==null&&withdrawFrame!==null&&withdrawFrame<=fleetDepartureFrame+1,{fleetDepartureFrame,withdrawFrame});
   check('mission exits without watchdog or stranded identities',endFrame!==null&&assault.phase()==='done'&&accounting.unresolved===0,{endFrame,phase:assault.phase()});
   const returnPathObservation={positive:roster.filter(e=>e.returnPathLength>0).length,maxLength:Math.max(0,...roster.map(e=>e.returnPathLength||0)),entries:roster.map(e=>({uid:e.uid,status:e.returnPathStatus,length:e.returnPathLength,startCorrection:e.returnPathStartCorrection}))};
   return {scenario,checks,passed:checks.every(c=>c.passed),injections,accounting,categories,returns,forced,transitions,transport:lastTransport,returnPathObservation,withdrawFrame,firstForcedFrame,endFrame,simulatedSeconds:maxSimTime,scope:'Diagnostic begin, injected damage, optional explicit persistent return blocker and fleet displacement; only original assault updater is advanced synchronously. Not natural projectile/fleet-route or complete game loop evidence.'};
  },{scenario,maxFrames:Number(process.env.SOCCO_EVAC_FRAMES||18000)});
  await Promise.all(responseJobs);result.errors=errors;result.servedHashes=served;result.passed&&=errors.length===0;cases.push(result);
  await writeFile(path.join(output,scenario+'.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify({scenario,passed:result.passed,accounting:result.accounting,failed:result.checks.filter(c=>!c.passed),output}));
  await context.close();
 }
} finally {await browser.close();}
const localAfter=await hashes();
const report={passed:cases.every(c=>c.passed),meaningOfPassed:'Diagnostic rule/accounting assertions passed; does not mean every survivor physically returned or a natural full battle passed.',testSha256:digest(await readFile(fileURLToPath(import.meta.url))),localBefore,localAfter,localStable:JSON.stringify(localBefore)===JSON.stringify(localAfter),cases:cases.map(c=>({scenario:c.scenario,passed:c.passed,allSurvivorsGenuinelyReturned:c.accounting.forced===0&&c.accounting.unresolved===0,accounting:c.accounting,failed:c.checks.filter(x=>!x.passed),servedHashes:c.servedHashes,servedMatchesFinalLocal:files.every(f=>c.servedHashes[f]===localAfter[f])})),limits:['Injected casualties and displacement are diagnostic, not naturally triggered combat.','Runs original assault updater on actual scene synchronously; full natural game loop, ground-route revisions and moving obstacles need separate validation.','Hidden or done never count as genuine return; only returned event plus ramp and seat observations do.']};
await writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));
const lines=['# SOCCO 伤亡与撤离诊断', '', '这是一组注入诊断，使用实际 8931 页面和原任务更新器；不是自然受击、自然机队离站或全游戏循环验收。passed 仅表示规则与逐人记账断言通过，兜底不算真实回舱。','', '| 场景 | 真回舱 | 阵亡 | 兜底 | 未解决 | 断言 |','|---|---:|---:|---:|---:|---|',...cases.map(c=>`| ${c.scenario} | ${c.accounting.returned} | ${c.accounting.dead} | ${c.accounting.forced} | ${c.accounting.unresolved} | ${c.passed?'通过':'失败'} |`),'',`本地代码在整轮运行期间${report.localStable?'保持稳定':'发生变化，本轮不能作为最终代码统一验收'}。每场实际 HTTP 模块 SHA256 与测试 SHA256 均保存在 report.json；各场完整注入事件、21人名册、回舱/兜底转变和路径状态保存在同名 JSON。`,'','三人阵亡和三人轻伤均调用 applyVanguardHit 注入箭伤。受阻场景每次更新前把 uid8 固定在远处，这是明确的故障注入，不能当成障碍寻路验证。紧急场景移动实际机队根，让原 fleetLeftStation 判断转入撤离，不直接写 phase。', '',...cases.flatMap(c=>[`- ${c.scenario}：兜底 uid [${c.categories.forced.join(', ')}]；截止记录 [${[...new Set(c.forced.map(f=>f.state?.seconds))].join(', ')}] 秒；回岸长路线（>0.01米）${c.returnPathObservation.entries.filter(e=>e.length>.01).length} 条，最长 ${c.returnPathObservation.maxLength.toFixed(4)} 米。`,...c.checks.filter(x=>!x.passed).map(x=>`  失败：${x.name}`)]),'','回舱须先被观察到通过坡道，再出现 returned 标志，且兵员脚部根到其座位地板路径端点误差<0.05米。单看 aboard、visible=false 或 done 均不算。', '', '剩余依赖：自然战斗造成的位移/伤亡、自然舰队离站、动态障碍和完整回岸寻路由主线另测；本测试不改变45秒/12秒时限，不延长队列时间。'];
await writeFile(path.join(output,'REPORT.md'),lines.join('\n')+'\n');
await writeFile(path.join(output,'README.md'),lines.join('\n')+'\n');
const esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SOCCO 伤亡与撤离诊断</title><style>body{max-width:1000px;margin:40px auto;padding:0 20px;font:16px/1.65 system-ui;color:#25323a;background:#f6f3ea}h1{font-size:28px}table{width:100%;border-collapse:collapse;background:white}td,th{padding:12px;border:1px solid #ccd3d4;text-align:left}code{font-size:12px;overflow-wrap:anywhere}a{color:#175e88}.note{padding:16px;background:#e5edf0;border-left:4px solid #68898f}</style><h1>SOCCO 伤亡与撤离诊断</h1><p class="note">这页展示实际 Web 场景的注入诊断。真实回舱、阵亡和超时兜底分开记账；规则检查通过不代表全部生还者都走回舱内。没有将隐藏兵员或任务结束算成真实回收。</p><table><tr><th>场景</th><th>真回舱</th><th>阵亡</th><th>兜底</th><th>未解决</th><th>撤退时限 / 实测兜底秒</th></tr>${cases.map(c=>`<tr><td><a href="${esc(c.scenario)}.json">${esc({'casualty-normal':'伤亡后正常撤离','casualty-normal-blocked':'伤亡＋受阻，正常撤离','casualty-emergency-blocked':'伤亡＋受阻，机队紧急离站'}[c.scenario])}</a></td><td>${c.accounting.returned}</td><td>${c.accounting.dead}</td><td>${c.accounting.forced}</td><td>${c.accounting.unresolved}</td><td>${c.scenario.includes('emergency')?'12':'45'} 秒 / ${c.forced.length?[...new Set(c.forced.map(f=>f.state.seconds.toFixed(4)))].join(', '):'未用兜底'}</td></tr>`).join('')}</table><p>每场21名运输艇兵。3人阵亡、3人轻伤通过原伤害函数注入；受阻场景持续把 uid8 固定远端，是明确故障注入；紧急场景移动实际机队根，由原离站判断触发撤退。未模拟自然箭弹命中或完整主循环。</p><p>兜底名单：${cases.map(c=>`${esc(c.scenario)} [${c.categories.forced.join(', ')}]`).join('；')}。队列后方也可能随受阻者达到时限，均不算真实回舱。</p><p>规则断言：${report.passed?'全部通过':'存在失败'}；整轮源码：${report.localStable?'稳定':'发生变化，须按逐场hash解读'}。${cases.every(c=>files.every(f=>c.servedHashes[f]===localAfter[f]))?'每场实际下载模块均与最终本地版本一致。':'逐场下载版本详见JSON，不能合称当前版本通过。'}</p><details><summary>所测运行源码 SHA256</summary>${Object.entries(localAfter).map(([f,h])=>`<p>${esc(f)}<br><code>${h}</code></p>`).join('')}</details><p>尚未涵盖自然战斗位移、自然触发、完整回岸寻路与动态障碍。根节点的坡道经过和座位地板端点已检查，不等于全身/脚底 IK 验收。</p><p><a href="report.json">汇总与逐场版本</a> · <a href="README.md">说明及检查边界</a></p></html>`;
await writeFile(path.join(output,'index.html'),html);
console.log(JSON.stringify({passed:report.passed,localStable:report.localStable,output}));
if(!report.passed)process.exitCode=1;
