const {chromium}=require('playwright');
const fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 const reports=[], errors=[];
 try{
 for(const grid of ['mixed','quad']){
 const page=await browser.newPage({viewport:{width:1580,height:780}});
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`http://localhost:8769/index.html?scene=fusion&grid=${grid}`);
 await page.waitForFunction(()=>window.rea?.view.atmosphere.field && document.querySelector('#environment-direction'),{timeout:60000});
 await page.waitForTimeout(800);
 for(const key of ['wind','snow','fog','clouds','flags','waves','waterfalls','birds']){
 const box=page.locator(`[data-environment="${key}"]`);
 await box.setChecked(true);
 assert.equal(await page.evaluate(k=>{const v=rea.view;return ({wind:v.atmosphere.arrows,snow:v.atmosphere.snow,fog:v.atmosphere.fog,clouds:v.vegetation.cloudField.mesh,flags:v.decor.flags,waves:v.waves,waterfalls:v.waterfalls.group,birds:v.birds})[k].visible},key),true,key);
 }
 const wind=await page.evaluate(()=>{const a=rea.view.atmosphere,old=a.field,version=rea.world.version;const slider=document.querySelector('#environment-direction');slider.value=180;slider.dispatchEvent(new Event('input'));slider.dispatchEvent(new Event('change'));return {rebuilt:old!==a.field,x:a.uWind.value.x,z:a.uWind.value.z,worldSame:version===rea.world.version,flow:a.sample(a.field.x0,100,a.field.z0).toArray()}});
 assert.ok(wind.rebuilt&&wind.worldSame&&wind.x<-.99&&Math.abs(wind.z)<1e-8&&wind.flow[0]<0);
 await page.selectOption('#environment-time','night');
 assert.equal(await page.evaluate(()=>rea.view.timeOfDay),'night');
 await page.evaluate(()=>rea.loadScene('town'));
 await page.waitForTimeout(700);
 assert.equal(await page.locator('[data-environment="clouds"]').isChecked(),false);
 await page.evaluate(()=>rea.loadScene('badnorth'));
 await page.waitForTimeout(700);
 assert.ok(await page.locator('#environment-theme-row').isVisible());
 await page.selectOption('#environment-theme','rain');
 assert.equal(await page.evaluate(()=>rea.view.bnTheme.name),'雨（推断）');
 await page.evaluate(()=>rea.loadScene('fusion'));
 await page.waitForTimeout(700);
 assert.equal(await page.locator('#environment-theme-row').isVisible(),false);
 await page.screenshot({path:`artifacts/coverage/environment-panel-${grid}.png`});
 if(grid==='mixed'){
 await page.setViewportSize({width:3181,height:543});
 await page.screenshot({path:'artifacts/coverage/environment-panel-wide.png'});
 await page.setViewportSize({width:390,height:844});
 const bounds=await page.locator('#environment-panel').boundingBox();assert.ok(bounds.x>=0&&bounds.x+bounds.width<=390&&bounds.y+bounds.height<=844);
 await page.screenshot({path:'artifacts/coverage/environment-panel-mobile.png'});
 }
 await page.locator('#environment-learning').click();
 assert.ok(await page.locator('#learnpanel').isVisible());
 assert.equal(await page.locator('#environment-panel').getAttribute('open'),null);
 reports.push({grid,wind,toggles:8,sceneSwitch:true,theme:true});await page.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/coverage/environment-panel-browser.json',JSON.stringify({reports,errors},null,2));console.log('PASS environment controls, field rebuild, scene sync, responsive layout',reports);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
