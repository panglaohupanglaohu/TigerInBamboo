// 维京远征 · 十二门徒主场浏览器验收（2026-11-16 用户：战役主场从苔庭改到十二门徒）。
//   ?vikingMuster=1 集结 → 强制离港 → sail-apostles → hold-apostles（霸天同步窗口：舰队未出征时兜底 30 s 开打）
//   → apostles 之战：ReaBattleStage scale 5 / gridRadius 18（sceneBattle PRESETS 实测口径）+ REA 默认 3 队守军 + 维京波次登陆。
// 无头 swiftshader 帧率低：登船/战役钟用 api.update 手动快进（与主循环驱动同一条 update 路径，不绕过阶段机）。
// 断言：routeMeta 每条腿 source !== 'straight-fallback'（直线兜底会穿岩柱）；phase id 带 -apostles；守军 3 队。
import {createRequire} from 'node:module';import fs from 'node:fs';import path from 'node:path';
const require=createRequire(import.meta.url),{chromium}=require('/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const out=path.resolve('TigerMessenger/artifacts/viking-apostles-e2e/run-'+Date.now());fs.mkdirSync(out,{recursive:true});
const report={out,steps:{},errors:[]};
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--mute-audio']});
const ctx=await browser.newContext({viewport:{width:1600,height:1000}});
const page=await ctx.newPage();
page.on('pageerror',e=>report.errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')report.errors.push('console: '+m.text().slice(0,300));});
const url='http://localhost:8931/TigerMessenger/?autostart=1&vikingMuster=1&vikingSpeed=250&tour=apostles-battle&battleFocus=0';
// 手动快进：主循环也在调 api.update，重复调用只是多走几帧，安全
const tick=(n=120)=>page.evaluate(k=>{try{globalThis.__tmVikingBoarding?.update(0.1);for(let i=0;i<k;i++)globalThis.__tmVikingCampaign?.update(0.1);}catch(e){return 'tick-err: '+e.message;}return null;},n);
const phase=()=>page.evaluate(()=>globalThis.__tmVikingCampaign?.phase||null);
const snap=()=>page.evaluate(()=>globalThis.__tmVikingCampaign?.stats?.()||null);
const waitPhase=async(re,ms,label)=>{const t0=Date.now();while(Date.now()-t0<ms){const p=await phase();if(re.test(p||''))return p;await tick(60);await page.waitForTimeout(400);}throw Error('phase 超时 '+label+' 现值='+(await phase()));};
try{
 await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!globalThis.__tm?.scene&&!!globalThis.__tm?.camera,{},{timeout:300000});
 report.steps.worldReady='ok';
 // 集结登船（pedestrians 就绪后自动开始）；先让真实登船走一段，再强制离港
 await page.waitForFunction(()=>!!globalThis.__tmVikingCampaign&&!!globalThis.__tmVikingBoarding?.active,{},{timeout:240000});
 report.steps.muster={site:await page.evaluate(()=>globalThis.__tmVikingCampaign.battleSite)};
 // 真登船一段时间（镇民步行上船）；sim 预算 ~960s，到 ≥8 人即强制离港，如实记录登船数
 for(let i=0;i<240;i++){const st=await page.evaluate(()=>globalThis.__tmVikingBoarding.stats());const c=st.ships.reduce((a,s)=>a+s.count,0);if(c>=8){report.steps.boardStat={i,...st};break;}if(i%20===0)report.steps['board'+i]={count:c,walking:st.walking,refillLeft:st.refillLeft};await tick(40);await page.waitForTimeout(120);}
 report.steps.boarded=await page.evaluate(()=>globalThis.__tmVikingBoarding.stats().ships.map(s=>({id:s.id,count:s.count})));
 if(!report.steps.boarded.some(s=>s.count>0))throw Error('集结 960s sim 零登船: '+JSON.stringify(report.steps));
 await page.evaluate(()=>globalThis.__tmVikingBoarding.depart());
 // 航线：preplanSite 与离港赛跑——routeMeta 可能 null（现算兜底分支不写 routeMeta），改读 report().ships[].voyage.source
 report.steps.sailPhase=await waitPhase(/^sail-apostles$/,120000,'sail-apostles');
 const rm=await page.evaluate(()=>globalThis.__tmVikingCampaign.routeMeta);
 const legs=await page.evaluate(()=>{const r=globalThis.__tmVikingCampaign.stats();return(r?.ships||[]).map(s=>({id:s.id,source:s.voyage?.source,len:s.voyage?.len,blocked:s.voyage?.blocked}));});
 report.steps.route={routeMeta:rm,legs};
 if(legs.some(l=>l.source==='straight-fallback'))throw Error('航线退成直线兜底会穿岩柱: '+JSON.stringify(legs));
 if(legs.every(l=>l.source===undefined))throw Error('两船均无 voyage 计划: '+JSON.stringify(legs));
 // 锚地待命 + 霸天同步窗口（霸天未自动出征：舰队 idle → 兜底 30 s 开打）
 report.steps.holdPhase=await waitPhase(/^hold-apostles$/,240000,'hold-apostles');
 report.steps.gate=await page.evaluate(()=>globalThis.__tmBatianMossGate?.()||null);
 // 开战
 report.steps.battlePhase=await waitPhase(/^apostles$/,240000,'apostles-battle');
 const stage0=await page.evaluate(()=>{const s=globalThis.__tmVikingBattleStage;if(!s)return null;const b=s.battle;return{name:s.name,scale:s.scale,gridRadius:s.gridRadiusN,defSquads:(b.squads||[]).filter(q=>(q.members||[]).some(m=>m.team===0)).length,defUnits:b.units.filter(u=>u.team===0&&!u.dead).length,atkUnits:b.units.filter(u=>u.team===1&&!u.dead).length,wave:b.wave,houses:b.houses?.length};});
 report.steps.stage=stage0;
 if(stage0?.name!=='viking-apostles-battle')throw Error('舞台名不对: '+stage0?.name);
 if(stage0.scale!==5||stage0.gridRadius!==18)throw Error('舞台口径不符 PRESETS scale5/r18: '+JSON.stringify({s:stage0.scale,r:stage0.gridRadius}));
 if(stage0.defSquads!==3)throw Error('守军应为 REA 默认 3 队，实际 '+stage0.defSquads);
 await page.screenshot({path:path.join(out,'battle-start.png')});
 // 等第一波登陆（维京人真打起来）
 const t0=Date.now();let wave1=null;
 while(Date.now()-t0<180000){await tick(90);const s=await snap();const u=await page.evaluate(()=>{const b=globalThis.__tmVikingBattleStage?.battle;if(!b)return null;return{wave:b.wave,boats:b.boats?.length,vikLanded:b.units.filter(u=>u.team===1&&!u.dead&&!u.onBoat).length,vikTotal:b.units.filter(u=>u.team===1&&!u.dead).length,def:b.units.filter(u=>u.team===0&&!u.dead).length};});
  if(u&&u.wave>=1&&(u.vikLanded>0||u.boats>0)){wave1={units:u,campaign:s?.battle||null};break;}await page.waitForTimeout(400);}
 if(!wave1)throw Error('180s 内无维京波次/登陆');
 report.steps.wave1=wave1;
 await page.waitForTimeout(800);await page.screenshot({path:path.join(out,'battle-wave1.png')});
 // 打到守军有战损（近战真的跑）——上限 4 分钟快进
 const t1=Date.now();let melee=null;
 while(Date.now()-t1<240000){await tick(90);const d=await page.evaluate(()=>globalThis.__tmVikingBattleStage?.battle.units.filter(u=>u.team===0&&!u.dead).length);if(d!=null&&d<report.steps.stage.defUnits){melee={defBefore:report.steps.stage.defUnits,defNow:d};break;}const ph=await phase();if(ph!=='apostles'){melee={phaseLeft:ph};break;}await page.waitForTimeout(400);}
 report.steps.melee=melee;
 await page.screenshot({path:path.join(out,'battle-late.png')});
 report.steps.final=await snap();
 report.pass=!report.errors.length;
}catch(e){report.pass=false;report.failure=String(e.stack||e).slice(0,900);await page.screenshot({path:path.join(out,'fail.png')}).catch(()=>{});}
finally{await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2).slice(0,4000));console.log('OUT',out);}
process.exit(report.pass?0:1);
