import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out='artifacts/pipeline/warship-crew-continuity/'+new Date().toISOString().replaceAll(':','-');
await mkdir(out,{recursive:true});
const files=['src/world/saihojiPhalanx.js','src/world/warshipCrewContinuity.js','src/assets/warshipV6.js','src/assets/warshipV6Data.js','assets/models/optimized/warship-runtime.json'];
const hashes=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));
const expected=JSON.parse(await readFile('assets/models/optimized/warship-runtime.json','utf8'));
const before=await hashes(),errors=[];
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let report;
try {
 const page=await browser.newPage({viewport:{width:1100,height:800}});page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);localStorage.setItem('tm.rescue.campaign.v1',JSON.stringify({version:1,chapter:2}));});
 await page.goto('http://localhost:8931/TigerMessenger/',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>!!window.__tm?.rescueCampaign,null,{timeout:180000});
 await page.locator('#start-btn').click();
 report=await page.evaluate((expected)=>{
  const {messenger,sceneHandles,rescueCampaign:campaign}=window.__tm;
  const battle=messenger.landmarks.saihojiPhalanx,garden=sceneHandles.find(h=>h.id==='saihoji');
  let t=0;const step=()=>{t+=1/60;campaign.update(1/60);garden.update(1/60,t);battle.update(1/60,t);};
  const ships=()=>battle.root.children.filter(o=>o.name.startsWith('saihoji-troopship-'));
  const actors=()=>battle.root.children.filter(o=>o.name.startsWith('saihoji-cohort-')).flatMap(o=>o.children);
  const visible=o=>{for(let p=o;p;p=p.parent)if(!p.visible)return false;return true;};
  const snap=()=>({time:t,phase:battle.root.userData.campaignStatus.phase,ships:ships().map(o=>({name:o.name,source:o.userData.warshipV6.source,sha256:o.userData.warshipV6.sha256,visible:visible(o),seats:o.userData.warshipV6.crewStatus()})),actors:actors().map(o=>({uid:o.userData.uid,uuid:o.uuid,visible:visible(o),embarked:o.userData.embarked}))});
  const checks=[],check=(name,value)=>checks.push({name,passed:!!value});
  for(let i=0;i<1800&&ships().length<2;i++)step();
  const outbound=snap(),original=actors().map(o=>({ref:o,uid:o.userData.uid}));
  check('chapter2 launches original two boats with current runtime revision/hash',outbound.ships.length===2&&outbound.ships.every(o=>String(o.source).includes('v'+expected.revision)&&o.sha256===expected.sha256));
  check('50 unique combat identities already aboard',original.length===50&&new Set(original.map(o=>o.uid)).size===50);
  check('all 25 seats own same identities and central stored weapons',outbound.ships.every(o=>o.seats.slice(0,25).every(s=>s.embarked&&s.weaponStored&&s.weaponNodes>0&&s.identity?.combatant&&original.some(a=>a.uid===s.identity.uid))));
  check('aboard actors do not also appear ashore',outbound.actors.every(a=>!a.visible&&a.embarked));
  for(let i=0;i<9000&&battle.root.userData.saihojiAmbush.state.stage!=='concealed';i++)step();
  const ashore=snap();
  check('original voyage reaches 50 concealed actors',battle.root.userData.saihojiAmbush.state.stage==='concealed'&&ashore.actors.length===50&&ashore.actors.every(a=>a.visible&&!a.embarked));
  check('disembarking removes duplicate seat people and their stored weapons',ashore.ships.every(o=>o.visible&&o.seats.slice(0,25).every(s=>!s.embarked&&!s.weaponStored)));
  check('one noncombat shipkeeper remains per boat',ashore.ships.every(o=>o.seats[25].embarked&&o.seats[25].identity?.combatant===false));
  // Invoke the actual whale-return callback; do not complete/claim the intervening fight.
  battle.root.userData.whaleReturned();
  step();
  check('return hold uses compact carry pose on the same 50 actors',actors().length===50&&actors().every(a=>a.userData.shipCarryActive&&!a.userData.embarked));
  for(let i=0;i<1200;i++){step();if(actors().every(a=>a.userData.embarked))break;}
  const returning=snap();
  check('return callback restores same seats and stows weapons',returning.phase==='return'&&returning.ships.every(o=>o.seats.slice(0,25).every(s=>s.embarked&&s.weaponStored)));
  check('no respawn or extra combat identities on return',actors().length===50&&original.every(a=>actors().includes(a.ref)&&a.ref.userData.uid===a.uid));
  check('return has no simultaneous ground copies',returning.actors.every(a=>!a.visible&&a.embarked));
  check('carry controller releases before seated voyage resumes',actors().every(a=>!a.userData.shipCarryActive));
  return {expected,passed:checks.every(c=>c.passed),checks,outbound,ashore,returning,scope:'Actual 8931 world and runtime-pointer factory; RAF held, original scheduled chapter2 voyage and updates. Explicit real whaleReturned callback tests return identity; intervening fight and physical boarding path are not validated.'};
 },expected);
} finally {await browser.close();}
const after=await hashes();report.sourceStable=JSON.stringify(before)===JSON.stringify(after);report.errors=errors;report.passed&&=report.sourceStable&&errors.length===0;await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,checks:report.checks,errors,out}));if(!report.passed)process.exitCode=1;
