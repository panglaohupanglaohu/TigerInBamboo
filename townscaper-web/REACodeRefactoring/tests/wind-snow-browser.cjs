const{chromium}=require('playwright'),fs=require('fs'),path=require('path'),assert=require('assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});let page=await browser.newPage({viewport:{width:1440,height:1000}});const errors=[],reports=[],out=path.resolve(__dirname,'../artifacts/coverage'),base=process.env.REA_TEST_URL||'http://localhost:8769';
 page.on('pageerror',e=>(errors.push(e.message),console.error('PAGE',e.message)));
 try{
  await page.goto(base+'/flow.html');
  for(const grid of ['mixed','quad']){console.log('GRID',grid);
   if(grid==='quad')await page.uncheck('#mixed');
   await page.waitForFunction(()=>flowReview?.ready&&document.querySelector('#scene').contentWindow.rea.gridKind===(document.querySelector('#mixed').checked?'mixed':'quad'),null,{timeout:60000});
   await page.click('#open');
   const report=await page.evaluate(()=>{
    const r=document.querySelector('#scene').contentWindow.rea,a=r.view.atmosphere,w=r.world,L=r.view.levelHeight,c=w.cells.reduce((a,b)=>Math.hypot(a.cx,a.cz)<Math.hypot(b.cx,b.cz)?a:b),P=a.snowPos;
    const beforeVersion=w.version,oldVisible=a.snow.visible,oldP=P.slice(),y=L*1.5,dt=1/60,t=a.uTime.value;
    a.snow.visible=true;
    function step(){P.set([c.cx,y,c.cz],0);const v=a.sample(c.cx,y,c.cz),expected=[c.cx+(v.x*.9+Math.sin(t*2.3)*.15)*dt,y+(v.y*.6-.32)*dt,c.cz+(v.z*.9+Math.cos(t*1.9)*.12)*dt];a.update(dt);const actual=Array.from(P.slice(0,3));return {expected,actual,error:Math.hypot(...actual.map((v,i)=>v-expected[i])),wind:[v.x,v.y,v.z]};}
    const open=step(),oldHeight=a.groundAt(c.cx,c.cz);
    // Live edit is intentionally not followed by wind rebuild: occupancy must
    // read World bits immediately rather than relying on the cached column top.
    w.setSolid(c,2,true,{rock:true});const closed=step();
    w.setSolid(c,2,false);const reopened=step();
    a.rebuild(w,r.view.index);a.setWindDirection(180);const reverse=step();a.setWindDirection(0);const forward=step();
    a.showSnow=true;let seededInSolid=0;for(let k=0;k<a.snowN;k++)if(a.probes.occupied(...[P[k*3],P[k*3+1],P[k*3+2]]))seededInSolid++;const frozen=P.slice();a.update(0);const zeroFrozen=frozen.every((v,i)=>v===P[i]);const badDt=[];for(const dt of [-1,NaN,Infinity]){const saved=P.slice();let rejected=false;try{a.update(dt)}catch{rejected=true}badDt.push({rejected,unchanged:saved.every((v,i)=>Object.is(v,P[i]))});P.set(saved);}
    P.set(oldP);a.snow.visible=oldVisible;
    return {grid:r.gridKind,beforeVersion,afterVersion:w.version,oldHeight,y,open,closed,reopened,reverse,forward,badDt,seededInSolid,zeroFrozen,fieldVersion:a.field.worldVersion};
   });
   assert.ok(report.oldHeight>report.y,'fixture contains roof above particle');
   assert.ok(report.open.error<1e-6,'snow must survive open roofed tunnel '+JSON.stringify(report.open));
   assert.ok(report.closed.error>.1,'snow must respawn on live solid layer');
   assert.ok(report.reopened.error<1e-6,'snow must survive immediately reopened tunnel');
   assert.ok(report.reverse.actual[0]<report.reverse.expected[0]+1e-6&&report.reverse.wind[0]<0);
   assert.ok(report.forward.wind[0]>0,'actual shared field follows new direction');
   assert.ok(report.badDt.every(x=>x.rejected&&x.unchanged),'invalid dt must not corrupt particles');
   assert.equal(report.seededInSolid,0);assert.ok(report.zeroFrozen);assert.equal(report.fieldVersion,report.afterVersion);
   await page.check('#wind');await page.check('#snow');await page.click('#look');await page.waitForTimeout(650);await page.screenshot({path:path.join(out,'wind-snow-'+grid+'-tunnel.png')});
   reports.push(report);
  }
  for(const scene of ['town','terrain','fusion']){console.log('SCENE',scene);await page.close();page=await browser.newPage({viewport:{width:1440,height:1000}});page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE',e.message)});
   await page.goto(base+'/index.html?scene='+scene);await page.waitForFunction(()=>window.rea?.view,null,{timeout:60000});
   await page.check('[data-environment="snow"]');await page.check('[data-environment="wind"]');await page.waitForTimeout(700);
   assert.ok(await page.evaluate(()=>rea.view.atmosphere.snow.visible&&rea.view.atmosphere.arrows.visible));
   await page.screenshot({path:path.join(out,'wind-snow-regression-'+scene+'.png')});
  }
  fs.writeFileSync(path.join(out,'wind-snow-browser.json'),JSON.stringify({reports,errors},null,2));assert.deepEqual(errors,[]);console.log('PASS shared Atmosphere snow/live World occupancy + shared wind + 3 scenes',reports);
 }finally{console.log('FINAL URL',page.url());fs.writeFileSync(path.join(out,'wind-snow-last-page.txt'),await page.locator('body').innerText().catch(()=>''));fs.writeFileSync(path.join(out,'wind-snow-browser.json'),JSON.stringify({reports,errors},null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
