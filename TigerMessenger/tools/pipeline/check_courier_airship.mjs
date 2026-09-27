import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import fs from 'node:fs';
const b=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=metal']});
const report={errors:[],entry:'http://localhost:8931/TigerMessenger/'};
try{
 const p=await b.newPage({viewport:{width:1000,height:800}});p.on('pageerror',e=>report.errors.push(e.message));
 await p.goto(report.entry);await p.waitForFunction(()=>window.__tm);await p.getByText('开始送信',{exact:true}).click();
 await p.evaluate(()=>{const t=__tm,a=t.messenger.landmarks.airship,rb=a.userData.rope.getWorldPosition(t.player.position.clone());t.player.position.copy(rb).normalize().multiplyScalar(160);t.player.velocity.set(0,0,0);t.player.onGround=false});
 await p.waitForFunction(()=>__tm.player.onGround,null,{timeout:20000});await p.waitForTimeout(150);
 report.grounded=await p.evaluate(()=>{const t=__tm,a=t.messenger.landmarks.airship,rb=a.userData.rope.getWorldPosition(t.player.position.clone());let source;t.scene.traverse(o=>{if(o.userData.isHumanCourier)source=o.userData.source});return {groundRadius:t.player.position.length(),ropeDistance:rb.distanceTo(t.player.position),onGround:t.player.onGround,source}});
 await p.keyboard.press('f');report.afterF=await p.evaluate(()=>({state:__tm.airshipRide.getState(),riding:__tm.player.riding}));
 await p.waitForFunction(()=>__tm.airshipRide.getState()==='flying',null,{timeout:20000});
 report.boarded=await p.evaluate(()=>({state:__tm.airshipRide.getState(),riding:__tm.player.riding,radius:__tm.player.position.length()}));
 await p.keyboard.press('f');report.exited=await p.evaluate(()=>({state:__tm.airshipRide.getState(),riding:__tm.player.riding}));
 if(report.afterF.state!=='climbing'||!report.boarded.riding||report.exited.state!=='idle'||report.exited.riding||report.errors.length)throw Error('Boarding regression');
 report.passed=true;console.log(report);
}finally{fs.writeFileSync('artifacts/pipeline/courier-cape-drape/airship-check.json',JSON.stringify(report,null,2));await b.close()}
