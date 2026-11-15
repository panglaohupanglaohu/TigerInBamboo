// flow-color-browser.cjs — 流场调试配色的两条片子
//   902069261304287232 "visualization of data inheritance in my flow/distance/influence fields"
//     → view.flowColorBy='unit'：一支守军一个颜色，每格到父格一段（继承树）
//   901842167508992000 "fields even smarter ... it can now tell you what type they are"
//     → view.flowColorBy='type'：颜色 = 最近单位的兵种（步兵/矛兵/弓手），同兵种同色
// 验收：两档配色下全岛出现的颜色种类数分别等于「源个数」「兵种个数」；颜色按亮度归一后与 fade 无关。
const{chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');

/** 归一化颜色（fade 是整条线同比例压暗，按最大分量除回去就还原调色板） */
const paletteOf=(page,mode)=>page.evaluate((mode)=>{
  const bt=window.rea.battle; bt.view.flowColorBy=mode; bt.view.setDebug('flow',true);
  bt.flowT=0; bt.update(1/120);            // 强制重算流场 + 重画
  const g=bt.flowLines.geometry, col=g.attributes.color.array, pos=g.attributes.position.array;
  const buckets=new Map();
  // 第 68 轮：color 属性在 r66 之后是 4 分量（rgb + alpha），旧写法按 3 跨步读会把 alpha 混进 rgb，
  // 归一化后算出几十种「颜色」。这里按 itemSize 跨步，只取 rgb。
  const stride=g.attributes.color.itemSize;
  for(let i=0;i<col.length;i+=stride){
    const c=[col[i],col[i+1],col[i+2]], mx=Math.max(...c)||1;
    const k=[c[0]/mx,c[1]/mx,c[2]/mx].map(v=>Math.round(v*20)/20).join(',');
    buckets.set(k,(buckets.get(k)||0)+1);
  }
  const sources=bt.flowDef.sources.map(s=>({type:s.type,squad:s.squad}));
  const squads=[...new Set(sources.map(s=>s.squad))];
  return {mode,segments:pos.length/6,colors:[...buckets.keys()],counts:[...buckets.values()],
    sources:sources.length,squads,types:[...new Set(sources.map(s=>s.type))],visible:bt.flowLines.visible};
},mode);

(async()=>{
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,
    args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  const p=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.goto('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad');
    await p.waitForFunction(()=>window.rea?.battle?.running,{timeout:90000});
    // 造两支不同兵种的守军 + 一支同兵种的第二队，验证 unit 档能分开、type 档合并
    const setup=await p.evaluate(()=>{
      const b=window.rea.battle; b.paused=false; b.wave=2; b.t=0; b.nextWave=999;
      b.update(0);
      const defs=b.squads.filter(s=>s.alive&&s.members.some(u=>!u.dead));
      if(defs.length<2) throw Error('需要至少两支存活守军，实得 '+defs.length);
      // 第二队改成同兵种，第三队保留原兵种
      const s0=defs[0], s1=defs[1];
      s1.archer=s0.archer; s1.pike=s0.pike;
      b.flowT=0; b.update(1/120);
      return {squads:defs.map(s=>({id:s.id,archer:!!s.archer,pike:!!s.pike})),
        sources:b.flowDef.sources.map(s=>s.type)};
    });
    const unit=await paletteOf(p,"unit");
    await p.evaluate(()=>{
      const b=window.rea.battle,v=window.rea.view;
      const us=b.flowDef.sources.map(s=>s.unit).filter(Boolean);
      const cx=us.reduce((a,u)=>a+u.x,0)/us.length, cz=us.reduce((a,u)=>a+u.z,0)/us.length;
      v.target.set(cx,b.L*2,cz); v.distance=15; v.pitch=1.02; v.updateCamera();
    });
    await p.waitForTimeout(900);
    await p.screenshot({path:'artifacts/coverage/flow-color-unit.png'});
    const type=await paletteOf(p,"type");
    await p.waitForTimeout(700);
    await p.screenshot({path:'artifacts/coverage/flow-color-type.png'});
    // 关掉调试，确认几何不受影响（不残留在画面里）
    const off=await p.evaluate(()=>{window.rea.view.setDebug('flow',false);return window.rea.battle.flowLines.visible;});

    console.log(JSON.stringify({setup,unit,type,off},null,2));
    assert.ok(unit.visible,'unit 档流场线应可见');
    assert.equal(unit.segments>0,true,'应有继承树线段');
    assert.equal(type.segments,unit.segments,'两档只改配色，线段数应一致');
    assert.equal(unit.colors.length,unit.squads.length,'unit 档颜色数应等于守军队伍数 '+unit.squads.length+'，实得 '+unit.colors.length);
    assert.equal(type.colors.length,type.types.length,'type 档颜色数应等于兵种数 '+type.types.length+'，实得 '+type.colors.length);
    assert.ok(type.types.length>=2,'场景里应至少两种兵种，实得 '+type.types.length);
    assert.ok(type.colors.length<unit.colors.length,'同兵种的两支队伍在 type 档应合并成同色（'+type.colors.length+' < '+unit.colors.length+'）');
    assert.equal(off,false,'关掉 flow 后线应不可见');
    assert.deepEqual(errors,[]);
    fs.writeFileSync('artifacts/coverage/flow-color-browser.json',JSON.stringify({setup,unit,type,off,errors},null,2));
    console.log('PASS flow color: unit 档 '+unit.colors.length+' 色 / type 档 '+type.colors.length+' 色（兵种 '+type.types.join('/')+'） / 线段 '+unit.segments);
  }finally{await browser.close();}
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
