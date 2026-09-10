import {chromium} from '../../../tools/shot/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const out='artifacts/pipeline/warship-web-navigation/'+new Date().toISOString().replaceAll(':','-');await mkdir(out,{recursive:true});
const files=['src/world/warshipNavigation.js','src/world/saihojiPhalanx.js','src/assets/harbor.js','src/assets/warshipV6.js','src/assets/warshipV6Data.js'];
const hash=async()=>Object.fromEntries(await Promise.all(files.map(async f=>[f,createHash('sha256').update(await readFile(f)).digest('hex')])));const before=await hash();const expected=JSON.parse(await readFile('assets/models/optimized/warship-runtime.json','utf8'));
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});let result;const errors=[];
try{const p=await browser.newPage({viewport:{width:1100,height:800}});p.on('pageerror',e=>errors.push(e.message));
await p.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=cb=>cb.name==='animate'?0:raf(cb);localStorage.setItem('tm.rescue.campaign.v1',JSON.stringify({version:1,chapter:2}));});
await p.goto('http://localhost:8931/TigerMessenger/',{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>!!window.__tm?.rescueCampaign,null,{timeout:180000});await p.locator('#start-btn').click();
console.log('actual page ready');
result=await p.evaluate(async(expected)=>{
 const {THREE:T,scene,messenger,rescueCampaign:campaign,camera,renderer}=window.__tm;
 const N=await import('/TigerMessenger/src/world/warshipNavigation.js');const battle=messenger.landmarks.saihojiPhalanx;
 const checks=[],check=(name,passed,detail={})=>checks.push({name,passed:!!passed,detail});
 const stats={outbound:{},return:{}};const dockingTransitions=[];const previous=new Map(),captures={};let time=0;
 const aggregate=(bucket,key,value)=>{const s=bucket[key]??={count:0,min:Infinity,max:-Infinity,sum:0};s.count++;s.min=Math.min(s.min,value);s.max=Math.max(s.max,value);s.sum+=value;};
 function observe(kind){battle.root.updateMatrixWorld(true);for(const b of battle.root.children.filter(o=>o.userData.kind==='saihoji-troopship'&&o.visible)){
  const position=b.getWorldPosition(new T.Vector3()),q=b.getWorldQuaternion(new T.Quaternion()),up=position.clone().normalize(),fwd=new T.Vector3(1,0,0).applyQuaternion(q).normalize();
  const prior=previous.get(b.uuid);if(prior&&prior.kind===kind){const velocity=position.clone().sub(prior.position);velocity.addScaledVector(up,-velocity.dot(up));if(velocity.length()>1e-7){aggregate(stats[kind],'forwardVelocityDot',fwd.dot(velocity.normalize()));aggregate(stats[kind],'quaternionLength',b.quaternion.length());aggregate(stats[kind],'upDot',new T.Vector3(0,1,0).applyQuaternion(q).dot(up));
   const prow=b.getObjectByName('hull-prow').getWorldPosition(new T.Vector3()).sub(position).normalize();aggregate(stats[kind],'actualProwVelocityDot',prow.dot(velocity));
   if(!captures[kind]&&stats[kind].forwardVelocityDot.count>200){const side=new T.Vector3(0,0,1).applyQuaternion(q);camera.position.copy(position).addScaledVector(up,10).addScaledVector(side,12).addScaledVector(fwd,7);camera.up.copy(up);camera.lookAt(position);renderer.render(scene,camera);captures[kind]=renderer.domElement.toDataURL('image/png');}
  }}previous.set(b.uuid,{position,kind});}}
 for(let i=0;i<4200;i++){time+=1/60;campaign.update(1/60);battle.update(1/60,time);observe('outbound');if(battle.root.userData.saihojiAmbush.state.stage==='concealed')break;}
 const actualShips=battle.root.children.filter(o=>o.userData.kind==='saihoji-troopship');check('actual chapter 2 voyage produced two selected saved Blender ships',actualShips.length===2&&actualShips.every(o=>o.userData.warshipV6?.sha256===expected.sha256));
 // Diagnostic original story callback: start return without simulating the entire whale battle.
 battle.root.userData.whaleReturned();previous.clear();
 for(let i=0;i<2600;i++){time+=1/60;campaign.update(1/60);battle.update(1/60,time);if(battle.root.userData.campaignStatus.phase==='siege'){for(const b of battle.root.children.filter(o=>o.userData.kind==='saihoji-troopship')){const prior=previous.get(b.uuid);if(prior)dockingTransitions.push({boat:b.name,delta:b.getWorldPosition(new T.Vector3()).distanceTo(prior.position),scope:'Original beginSiege docking placement; not sailing and not accepted by this direction test'});}break;}observe('return');}
 for(const [name,s] of Object.entries(stats)){
  for(const v of Object.values(s))v.mean=v.sum/v.count;
  check(name+' actual ship +X follows travel',s.forwardVelocityDot?.count>1000&&s.forwardVelocityDot.min>.9&&s.forwardVelocityDot.mean>.999,s);
  check(name+' unit quaternion and radial deck up',Math.abs(s.quaternionLength?.min-1)<1e-10&&s.upDot?.min>1-1e-10);
  check(name+' actual bronze prow leads',s.actualProwVelocityDot?.min>.9);
 }
 // Original route forms, all rotations and stationary/end segments, independent analytical velocity.
 const fixture=[];for(let r=0;r<12;r++){
  const rot=new T.Quaternion().setFromEuler(new T.Euler(r*.31,r*.17,r*.23));
  const a=new T.Vector3(.2,1,-.2).normalize().applyQuaternion(rot),j=new T.Vector3(.1,1,.1).normalize().applyQuaternion(rot),z=new T.Vector3(-.2,1,.3).normalize().applyQuaternion(rot),east=new T.Vector3(1,0,0).applyQuaternion(rot);
  for(const [name,legs,offset] of [['out',[[a,j,.44],[j,j,.12],[j,z,.44]],0],['back',[[z,j,.44],[j,j,.12],[j,a,.44]],0],['red',[[j,a,1]],0],['blue-left',[[j,a,1]],.03],['blue-right',[[j,a,1]],-.03]]){
   const boat=new T.Group(),d=new T.Vector3(),h=new T.Vector3();let min=1,maxHoldTurn=0,oldMin=1,oldNormError=0,movingCount=0;let priorQ=null;
   for(let k=0;k<=1000;k++){const progress=k/1000,moving=N.sampleWarshipRoute(legs,progress,d,h);if(offset)d.copy(j).lerp(a,progress).addScaledVector(east,offset).normalize();N.placeWarshipOnSphere(boat,d,140.18,moving?h:null);
    if(moving){const tangent=h.clone().addScaledVector(d,-h.dot(d)).normalize(),f=new T.Vector3(1,0,0).applyQuaternion(boat.quaternion);min=Math.min(min,f.dot(tangent));movingCount++;
      const wrongSide=new T.Vector3().crossVectors(d,tangent).normalize(),wrong=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(tangent,d,wrongSide));oldMin=Math.min(oldMin,new T.Vector3(1,0,0).applyQuaternion(wrong).normalize().dot(tangent));oldNormError=Math.max(oldNormError,Math.abs(wrong.length()-1));
    }else if(priorQ)maxHoldTurn=Math.max(maxHoldTurn,boat.quaternion.angleTo(priorQ));priorQ=boat.quaternion.clone();
   }fixture.push({rotation:r,name,min,maxHoldTurn,oldMin,oldNormError,movingCount});
  }
 }
 check('all four route forms incl both blue lanes keep +X tangent',fixture.every(v=>v.min>1-1e-10),{samples:fixture.length*1001,min:Math.min(...fixture.map(v=>v.min))});
 check('stationary junction retains heading',fixture.every(v=>v.maxHoldTurn<1e-6),{max:Math.max(...fixture.map(v=>v.maxHoldTurn))});
 check('reproduces old reflected frame failure',fixture.some(v=>v.oldMin<0)&&fixture.some(v=>v.oldNormError>.1),{oldMin:Math.min(...fixture.map(v=>v.oldMin)),maxOldQuaternionError:Math.max(...fixture.map(v=>v.oldNormError))});
 return {checks,stats,fixture,captures,dockingTransitions,phase:battle.root.userData.campaignStatus.phase,scope:'Actual 8931 page, chapter2 restored, deterministic original battle updates. Return invoked via original whaleReturned story callback (diagnostic, not natural full battle). Red/blue reinforcements validated as route-math fixtures across 12 rotations, not live siege. Actual public createFisherBoat now instantiates the selected saved Blender revision; original campaign scheduling retained. No passenger, collision, or docking continuity acceptance.'};
},expected);for(const [name,data]of Object.entries(result.captures)){await writeFile(out+'/'+name+'.png',Buffer.from(data.split(',')[1],'base64'));}delete result.captures;
}finally{await browser.close();}
const after=await hash();const report={...result,errors,sourceBefore:before,sourceAfter:after,sourceStable:JSON.stringify(before)===JSON.stringify(after)};report.passed=report.sourceStable&&errors.length===0&&report.checks.every(c=>c.passed);await writeFile(out+'/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,out,failed:report.checks.filter(c=>!c.passed)}));if(!report.passed)process.exitCode=1;
