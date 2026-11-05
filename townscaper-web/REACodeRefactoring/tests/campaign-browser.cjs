const { chromium } = require('playwright'), fs = require('fs'), assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  const page = await browser.newPage({viewport:{width:1440,height:900}}), errors=[], runs=[];
  page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error') errors.push(m.text());});
  try {
    await page.goto('http://localhost:8769/campaign.html'); await page.waitForFunction(()=>typeof window.campaign==='function');
    for(let i=0;i<16;i++) {
      const c=await page.evaluate(()=>campaign());
      assert.equal(c.route[0],c.start); assert.equal(c.route.at(-1),c.end);
      assert.equal(new Set(c.route).size,c.route.length);
      for(let k=1;k<c.route.length;k++) assert(c.adjacency[c.route[k-1]].includes(c.route[k]));
      runs.push({nodes:c.nodes,main:c.main,bridges:c.bridges});
      if(i===0) for(const s of [1,2,3,4,5]) { await page.click(`[data-s="${s}"]`); if([2,3,5].includes(s)) await page.screenshot({path:`artifacts/coverage/campaign-stage-${s}.png`}); }
      await page.click('#reseed');
    }
    assert((await page.locator('#graph-status').textContent()).includes('起终点连通'));
    assert.equal(errors.length,0,errors.join('\n'));
    fs.writeFileSync('artifacts/coverage/campaign-browser.json',JSON.stringify({runs,errors},null,2));
    console.log('PASS actual campaign page, five-stage switching and 16 reseeds',runs);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exit(1);});
