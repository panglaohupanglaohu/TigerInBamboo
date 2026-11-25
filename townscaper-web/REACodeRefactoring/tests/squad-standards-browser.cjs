// 827216768783495168 残差·竖旗横杆 + 金饰盾纹本地替身浏览器验收（非原图集/原作美术）：
// squad-banners.html 勾选「竖旗横杆 + 金饰盾纹」→ g3 standards 真替换 Bezier 旗与单色盾面，像素差分验收。
const{chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}),p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],reports=[];p.on('pageerror',e=>errors.push(e.message));try{await p.goto('http://localhost:8769/squad-banners.html');
for(const kind of ['quad','mixed']){if(kind==='mixed')await p.click('#mixed');await p.waitForFunction(()=>window.squadBannerReview?.battle?.squads.length===3,null,{timeout:90000});await p.evaluate(()=>{squadBannerReview.battle.paused=true;squadBannerReview.battle.update(0);});
 const before=await p.evaluate(()=>{const b=squadBannerReview.battle;return{units:JSON.stringify(b.units.map(u=>[u.hp,u.kind,u.x,u.y,u.z,u.navFloor])),flags:b.squads.map(s=>s.flag.visible),shields:b.g3.shieldFaces.count}});
 await p.check('#standards');await p.waitForFunction(()=>squadBannerReview.battle.g3.on.standards===true);
 const on=await p.evaluate(()=>{const b=squadBannerReview.battle;b.update(0);const alive=b.units.filter(u=>u.team===0&&!u.dead&&!u.onBoat&&!u.fall).length;
  const st=[...b.g3.standards.values()].map(g=>({visible:g.visible,finial:g.children.some(c=>c.geometry?.type==='SphereGeometry'),barY:g.userData.pivot.position.y,clothTop:g.userData.cloth.getWorldPosition(new g.position.constructor()).y-g.position.y,yaw:g.userData.billboard?.yaw}));
  return{units:JSON.stringify(b.units.map(u=>[u.hp,u.kind,u.x,u.y,u.z,u.navFloor])),flags:b.squads.map(s=>s.flag.visible&&s.flag.userData.cloth.visible),standards:b.g3.standards.size,shieldFaces:b.g3.shieldFaces.count,alive,st}});
 assert.equal(on.units,before.units,'单位状态不变');
 assert.deepEqual(on.flags,[false,false,false],'Bezier 旗被替换');
 assert.equal(on.standards,3);assert.equal(on.shieldFaces,on.alive,'每守军一张金饰盾面');
 assert.ok(on.st.every(s=>s.visible&&s.finial&&Math.abs(s.yaw)<=40.001),'竖旗结构+偏航±40° '+JSON.stringify(on.st));
 // 像素级：standards on vs off 渲染差分（同机位 RT 对拍）
 const pixels=await p.evaluate(async()=>{const r=squadBannerReview,T=await import('/vendor/three.module.js'),renderer=r.view.renderer,b=r.battle,rt=new T.WebGLRenderTarget(1024,768),old=renderer.getRenderTarget(),a=new Uint8Array(1024*768*4),c=new Uint8Array(a.length);try{renderer.setRenderTarget(rt);b.update(0);renderer.render(r.view.scene,r.view.camera);renderer.readRenderTargetPixels(rt,0,0,1024,768,a);b.g3.set('standards',false);b.update(0);renderer.render(r.view.scene,r.view.camera);renderer.readRenderTargetPixels(rt,0,0,1024,768,c);b.g3.set('standards',true);b.update(0);let changed=0;for(let i=0;i<a.length;i+=4)if(a[i]!==c[i]||a[i+1]!==c[i+1]||a[i+2]!==c[i+2])changed++;return changed}finally{renderer.setRenderTarget(old);rt.dispose()}});
 assert.ok(pixels>0,'standards visible in render');
 await p.screenshot({path:`artifacts/coverage/squad-standards-${kind}.png`});
 await p.uncheck('#standards');await p.waitForFunction(()=>squadBannerReview.battle.g3.on.standards===false);
 const off=await p.evaluate(()=>{const b=squadBannerReview.battle;b.update(0);return{flags:b.squads.map(s=>s.flag.visible),shieldFaces:b.g3.shieldFaces.count}});
 assert.deepEqual(off.flags,[true,true,true],'关掉恢复原旗');assert.equal(off.shieldFaces,0);
 reports.push({kind,standards:on.standards,shieldFaces:on.shieldFaces,changedPixels:pixels,restored:true});}
assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/coverage/squad-standards-browser.json',JSON.stringify({reports,errors},null,2));console.log('squad-standards-browser PASS',JSON.stringify(reports))}finally{await browser.close()}})().catch(e=>{console.error(e);process.exit(1)});
