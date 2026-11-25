// 827215002448846848 残差·升级机制浏览器验收（本地机制，非原作复现）：
// unit-tiers.html 勾选「击杀升级」→ 真 Battle 里近战记账 → 升档 → 头盔/盾实例色真的换掉（像素差分）。
const{chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}),p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],reports=[];p.on('pageerror',e=>errors.push(e.message));try{await p.goto('http://localhost:8769/unit-tiers.html');
for(const kind of ['quad','mixed']){if(kind==='mixed')await p.click('#mixed');await p.waitForFunction(()=>window.unitTierReview?.rea.battle.running,null,{timeout:90000});
 await p.check('#promo');await p.waitForFunction(()=>unitTierReview.rea.battle.promotion===true);
 // 放维京人上岸（页面里同步推进仿真，与 Node 层 unit-promotion.mjs 同口径）；上岸后冻结时间轴再强制两杀
 const landed=await p.evaluate(()=>{const b=unitTierReview.rea.battle;b.paused=false;b.nextWave=.5;for(let k=0;k<1500&&b.units.filter(u=>u.team===1&&!u.onBoat&&!u.dead).length<8;k++)b.update(1/30);b.paused=true;return b.units.filter(u=>u.team===1&&!u.onBoat&&!u.dead).length});
 assert.ok(landed>=7,'viking landed '+landed);
 const kills=await p.evaluate(()=>{const b=unitTierReview.rea.battle,def=b.units.find(u=>u.team===0&&!u.dead&&!(u.kills>0))??b.squads[0].members.find(u=>!u.dead),vs=b.units.filter(u=>u.team===1&&!u.onBoat&&!u.dead);
  const st0={...b.promotionStats};
  vs[0].hp=1;b.applyHit(vs[0],def);const after1={kills:def.kills,level:def.level,tier:def.appearanceTier??null};
  vs[1].hp=1;b.applyHit(vs[1],def);const after2={kills:def.kills,level:def.level,tier:def.appearanceTier??null};
  for(let i=2;i<5;i++){vs[i].hp=1;b.applyHit(vs[i],def);}
  const after5={kills:def.kills,level:def.level,tier:def.appearanceTier??null,hp:[def.hp,def.max,def.soak,def.kind],stats:{...b.promotionStats},promotedDelta:b.promotionStats.promoted-st0.promoted,creditedDelta:b.promotionStats.credited-st0.credited};
  return{after1,after2,after5,uid:def.uid}});
 assert.deepEqual(kills.after1,{kills:1,level:1,tier:null});
 assert.deepEqual(kills.after2,{kills:2,level:2,tier:2});
 assert.deepEqual({kills:kills.after5.kills,level:kills.after5.level,tier:kills.after5.tier},{kills:5,level:3,tier:3});
 assert.equal(kills.after5.promotedDelta,2,'两次升档');assert.equal(kills.after5.creditedDelta,5,'五杀各记一次');
 // 实例色：def 的盾/头在实例批里的颜色 = unit-tier 二档色
 const colors=await p.evaluate(async(uid)=>{const b=unitTierReview.rea.battle;b.paused=true;b.update(0);
  const w=document.querySelector('iframe').contentWindow,T=await w.eval("import('three')"),UT=await w.eval("import('/src/core/unit-tier.js')");
  const def=b.units.find(u=>u.uid===uid);
  let idx=-1,n=0;for(const u of b.units){if(n>=260)break;if(u.dead&&b.view.goreOff)continue;if(u===def){idx=n;break;}n++;}
  const want={helmet:new T.Color(UT.unitTierAppearance(3).helmet),shield:new T.Color(UT.unitTierAppearance(3).shield)};
  return{got:{helmet:[...b.mHead.instanceColor.array.slice(idx*3,idx*3+3)],shield:[...b.mShield.instanceColor.array.slice(idx*3,idx*3+3)],idx},want:{helmet:[want.helmet.r,want.helmet.g,want.helmet.b],shield:[want.shield.r,want.shield.g,want.shield.b]}}},kills.uid);
 assert.ok(colors.got.idx>=0,'promoted unit drawn');
 for(const part of ['helmet','shield'])for(let i=0;i<3;i++)assert.ok(Math.abs(colors.got[part][i]-colors.want[part][i])<1e-3,part+' '+JSON.stringify(colors));
 // 像素级：升档外观 vs 原档渲染差分（同机位同光照 RT 对拍）
 const pixels=await p.evaluate(async(uid)=>{const{rea:r,setUnitAppearanceTier:set}=unitTierReview,w=document.querySelector('iframe').contentWindow,T=await w.eval("import('three')"),renderer=r.view.renderer,b=r.battle,rt=new T.WebGLRenderTarget(1024,768),old=renderer.getRenderTarget(),a=new w.Uint8Array(1024*768*4),c=new w.Uint8Array(a.length);const def=b.units.find(u=>u.uid===uid),cam=r.view.camera,cam0={pos:cam.position.clone(),q:cam.quaternion.clone()};try{b.unitLodEnabled=false;cam.position.set(def.x+.001,def.y+2.2,def.z+.001);cam.lookAt(def.x,def.y,def.z);cam.updateMatrixWorld(true);renderer.setRenderTarget(rt);b.update(0);renderer.render(r.view.scene,cam);renderer.readRenderTargetPixels(rt,0,0,1024,768,a);for(const u of b.units)set(u,null);b.update(0);renderer.render(r.view.scene,cam);renderer.readRenderTargetPixels(rt,0,0,1024,768,c);let changed=0;for(let i=0;i<a.length;i+=4)if(a[i]!==c[i]||a[i+1]!==c[i+1]||a[i+2]!==c[i+2])changed++;return changed}finally{cam.position.copy(cam0.pos);cam.quaternion.copy(cam0.q);cam.updateMatrixWorld(true);b.unitLodEnabled=null;renderer.setRenderTarget(old);rt.dispose()}},kills.uid);
 assert.ok(pixels>0,'promoted gear visible in render');
 await p.screenshot({path:`artifacts/coverage/unit-promotion-${kind}.png`});
 reports.push({kind,landed,kills:{...kills.after5,uid:kills.uid},instanceIdx:colors.got.idx,changedPixels:pixels});}
assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/coverage/unit-promotion-browser.json',JSON.stringify({reports,errors},null,2));console.log('unit-promotion-browser PASS',JSON.stringify(reports))}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
