import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile} from 'node:fs/promises';
const browser=await chromium.launch({channel:'chrome',headless:true});const errors=[];let report;
try {
 const page=await browser.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/campaign-link-fixture',r=>r.fulfill({contentType:'text/html',body:`<script type="importmap">{"imports":{"three":"/TigerMessenger/vendor/three.module.js","three/addons/":"/TigerMessenger/vendor/jsm/"}}</script><body></body>`}));
 await page.goto('http://localhost:8931/campaign-link-fixture');
 report=await page.evaluate(async()=>{
  const T=await import('three'),{createRescueCampaign}=await import('/TigerMessenger/src/story/rescueCampaign.js');
  localStorage.setItem('tm.rescue.campaign.v1',JSON.stringify({version:1,chapter:1}));
  const checks=[],check=(name,passed)=>checks.push({name,passed:!!passed});let started=true;const calls=[];
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(),bookshop=new T.Group();bookshop.position.set(160,0,0);scene.add(bookshop);
  const player={position:new T.Vector3(160,0,0),checkpoint:new T.Vector3(),forward:new T.Vector3(0,0,1),groundR:160};
  const root=new T.Group();root.userData.campaignStatus={phase:'atCastle'};root.userData.saihojiAmbush={state:{stage:'landing'}};
  const battle={root,setCampaignProgress:p=>calls.push({...p})};const fleet=new T.Group();
  const campaign=createRescueCampaign({scene,player,camera,messenger:{landmarks:{bookshop,saihojiPhalanx:battle,aircraftSquad:fleet}},worldLandmarks:[{id:'gate',getDir:()=>new T.Vector3(160,0,0)},{id:'saihoji',getDir:()=>new T.Vector3(160,0,0)}],isStarted:()=>started,isRiding:()=>false,toast:()=>{}});
  const press=()=>window.dispatchEvent(new KeyboardEvent('keydown',{code:'KeyR',bubbles:true}));
  check('restored pact chapter synchronizes before simulation',calls.at(-1).chapter===1);
  press();check('actual R pact completion authorizes chapter 2',campaign.snapshot().chapter===2&&calls.at(-1).chapter===2);
  document.querySelector('[data-power="shield"]').click();check('Achilles protects without sending diversion',campaign.snapshot().protection===12&&campaign.snapshot().chapter===2);
  campaign.update(36);document.querySelector('[data-power="lure"]').click();check('Odysseus protects without silently skipping signal',campaign.snapshot().protection===22&&campaign.snapshot().chapter===2);
  player.position.set(160,28,0);campaign.update(.2);press();check('screenshot distance 28 cannot send signal',campaign.snapshot().chapter===2&&document.querySelector('.rescue-action').disabled);
  root.userData.campaignStatus.phase='sailOut';campaign.update(.2);check('panel explains ships are approaching',document.querySelector('.rescue-battle-status').textContent.includes('乘战船'));
  root.userData.campaignStatus.phase='concealment';root.userData.saihojiAmbush.state.stage='concealed';campaign.update(.2);check('panel explains actual R signal after concealment',document.querySelector('.rescue-battle-status').textContent.includes('按 R'));
  player.position.set(160,0,0);campaign.update(.2);press();check('actual signal advances and syncs chapter 3',campaign.snapshot().chapter===3&&calls.at(-1).chapter===3);
  check('signal progress persists',JSON.parse(localStorage.getItem('tm.rescue.campaign.v1')).chapter===3);
  campaign.update(.2);check('panel describes waiting for real fleet discovery',document.querySelector('.rescue-battle-status').textContent.includes('静候'));
  started=false;campaign.update(.2);check('not started state synchronizes without advancing',calls.at(-1).started===false&&calls.at(-1).chapter===3);
  return {passed:checks.every(c=>c.passed),checks,scope:'Actual campaign DOM/controller with mock battle receiver. Full ship/whale simulation is verified separately.'};
 });
} catch(e){report={passed:false,error:String(e)};}finally{await browser.close();}
report.errors=errors;report.passed&&=errors.length===0;await mkdir('artifacts/pipeline/rescue-battle-link',{recursive:true});await writeFile('artifacts/pipeline/rescue-battle-link/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(!report.passed)process.exitCode=1;
