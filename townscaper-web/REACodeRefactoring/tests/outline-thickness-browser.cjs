// outline-thickness-browser.cjs — 1017355723171344385 "Making some thicker outlines for all you 4k high ballers"
// 验收：墨线宽度按「设备像素比 × 渲染高度 / 1080」放大（相对观感不变，不会在 4K 上变细），
//       thickness=2 时再整体翻倍；两种分辨率下各截一张图供肉眼看线宽。
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('fs');
(async()=>{
  const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  const p=await b.newPage({viewport:{width:960,height:540},deviceScaleFactor:1});
  const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.goto('http://127.0.0.1:8769/index.html?scene=fusion&grid=quad');
    await p.waitForFunction(()=>window.rea?.view?.outline?.inkMat,{timeout:90000});
    await p.waitForTimeout(1200);
    const probe=()=>p.evaluate(()=>{
      const v=rea.view, o=v.outline;
      const size=v.renderer.getDrawingBufferSize(new (o.common.uRes.value.constructor)());
      return {w:size.x,h:size.y,dpr:v.renderer.getPixelRatio(),
        ink:o.inkMat.uniforms.uWidth.value, rim:o.rimMat.uniforms.uWidth.value,
        thick:o.thickness??1, visible:o.ink.visible};
    });
    const at540=await probe();
    await p.setViewportSize({width:1920,height:1080}); await p.waitForTimeout(500);
    const at1080=await probe();
    await p.screenshot({path:'artifacts/coverage/outline-thickness-1080.png'});
    await p.setViewportSize({width:3840,height:2160}); await p.waitForTimeout(700);
    const at2160=await probe();
    await p.screenshot({path:'artifacts/coverage/outline-thickness-2160.png'});
    // thickness=2（代码里的「粗描边」路径，view.setLayer('thickoutline', true)）
    await p.evaluate(()=>rea.view.setDebug('thickoutline',true));
    await p.waitForFunction(()=>rea.view.outline.inkMat.uniforms.uWidth.value>2.8+1e-6,{timeout:30000});
    const thick2=await probe();
    await p.evaluate(()=>rea.view.setDebug('thickoutline',false));
    await p.waitForFunction(()=>Math.abs(rea.view.outline.inkMat.uniforms.uWidth.value-2.8)<1e-6,{timeout:30000});
    const back=await probe();

    const rel=(x,px)=>x/px;      // 设备像素宽 / 像素比 → CSS 像素观感
    const r1080=at1080.ink/at1080.dpr, r2160=at2160.ink/at2160.dpr, r540=at540.ink/at540.dpr;
    console.log(JSON.stringify({at540,at1080,at2160,thick2,back,rel:{r540,r1080,r2160}},null,2));
    // 1) 1080 高为基准：1080 时 px=1 → ink 1.4
    assert.ok(Math.abs(at1080.ink-1.4)<1e-6,'1080 基准应为 1.4，实得 '+at1080.ink);
    // 2) 2160 高 → 2 倍
    assert.ok(Math.abs(at2160.ink/at1080.ink-2)<1e-6,'2160 应比 1080 粗 2 倍，实得 '+(at2160.ink/at1080.ink));
    // 3) 540 高不比 1080 细（下限 max(1,...) 兜住）
    assert.ok(at540.ink>=1.4-1e-6,'540 高不应比 1080 细，实得 '+at540.ink);
    // 4) thickness=2 翻倍，关掉复原
    assert.ok(Math.abs(thick2.ink/at2160.ink-2)<1e-6,'粗描边应翻倍，实得 '+(thick2.ink/at2160.ink));
    assert.ok(Math.abs(back.ink-at2160.ink)<1e-6,'粗描边关掉应复原');
    // 5) 观感不变：线宽 / 画布高度 恒定（4K 上不会变细）
    const frac1080=at1080.ink/at1080.h, frac2160=at2160.ink/at2160.h;
    assert.ok(Math.abs(frac2160-frac1080)<1e-9,'线宽/画布高应恒定，实得 '+(frac2160/frac1080));
    assert.deepEqual(errors,[]);
    fs.writeFileSync('artifacts/coverage/outline-thickness-browser.json',JSON.stringify({at540,at1080,at2160,thick2,back,errors},null,2));
    console.log('PASS outline thickness: 1080→1.4px, 2160→2.8px, thick→5.6px, 恢复 2.8px');
  }finally{await b.close();}
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
