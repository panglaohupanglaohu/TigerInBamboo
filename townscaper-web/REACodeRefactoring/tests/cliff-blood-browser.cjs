// cliff-blood-browser.cjs — 912691357440978945 "Long time no combat gifs"
// 片子：多级台地上的混战，血不只摊在台面，而是顺着崖壁往下抹成长条、在崖脚积成一片。
// 验收：崖边挨打/阵亡后，血斑实例里出现「竖直贴墙」的那一类（局部 Y 轴水平），并有流挂（高 > 宽）；
//       地面圆斑仍是水平的占多数（不回归）。
const{chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,
    args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  const p=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.goto('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad');
    await p.waitForFunction(()=>window.rea?.battle?.running);
    const out=await p.evaluate(()=>{
      const b=window.rea.battle,w=b.world,L=b.L;
      b.paused=false; b.scale=1; b.wave=2; b.t=4; b.nextWave=3; b.update(0); b.nextWave=999;
      const boat=b.boats[0]; if(boat){boat.state='unload';boat.wait=.4;b.update(0);}
      // 找一处崖边（本格与边邻格落差 ≥2 层）且能站两个人
      let spot=null;
      for(const c of w.cells){
        if(!b.navigation.pick(c,w.top(c)*L))continue;
        for(let i=0;i<c.n;i++){
          const ia=c.edgeNeighbors[i]; if(ia<0)continue;
          const a=w.cells[ia];
          if(w.top(c)-w.top(a)<2)continue;
          spot={c,a};break;
        }
        if(spot)break;
      }
      if(!spot)throw Error('没找到崖边格');
      const {c,a}=spot;
      const vik=b.units.find(u=>u.team===1)||b.units[0];
      const def=b.units.find(u=>u.team===0)||b.units[1];
      const dx=a.cx-c.cx,dz=a.cz-c.cz,dl=Math.hypot(dx,dz),nx=dx/dl,nz=dz/dl,topY=w.top(c)*L;
      // 敌兵站崖沿，守军贴内侧，反复打：血滴会往崖沿外飞、尸体也停在沿口
      vik.x=c.cx-nx*0.12; vik.z=c.cz-nz*0.12; vik.y=topY; vik.navFloor=w.top(c); vik.hp=40;
      def.x=c.cx-nx*0.22; def.z=c.cz-nz*0.22; def.y=topY; def.navFloor=w.top(c);
      b.units=[def,vik];
      const before=b.blood.count;
      const vikCellId=b.view.index.cellAt(c.cx-nx*0.12,c.cz-nz*0.12)?.id;
      const cellAtVik=()=>b.view.index.cellAt(vik.x,vik.z);
      for(let i=0;i<40;i++){
        vik.x=c.cx-nx*0.12; vik.z=c.cz-nz*0.12; vik.y=topY; vik.navFloor=w.top(c);
        vik.fall=null; vik.hp=40; vik.dead=false; vik.cd=0; vik.stunRemaining=0;
        def.x=c.cx-nx*0.22; def.z=c.cz-nz*0.22; def.y=topY; def.navFloor=w.top(c); def.cd=0; def.stunRemaining=0;
        b.update(1/60);
      }
      const el=b.blood.instanceMatrix.array;   // 列主序：col0=局部X, col1=局部Y, col2=局部Z, col3=平移
      let wall=0,ground=0,drips=0;
      const wallSamples=[];
      for(let i=0;i<b.blood.count;i++){
        const o=i*16;
        const ly=[el[o+4],el[o+5],el[o+6]], lyl=Math.hypot(...ly)||1;   // 实例局部 Y 轴（地面圆斑 = 世界竖直）
        const sx=Math.hypot(el[o],el[o+1],el[o+2]), sz=Math.hypot(el[o+8],el[o+9],el[o+10]);
        if(Math.abs(ly[1]/lyl)<0.25){ wall++; if(sz>sx*1.3)drips++; if(wallSamples.length<4)wallSamples.push({x:+el[o+12].toFixed(2),y:+el[o+13].toFixed(2),z:+el[o+14].toFixed(2),w:+sx.toFixed(3),h:+sz.toFixed(3)}); }
        else ground++;
      }
      b.paused=true;
      const v=window.rea.view; v.setDebug('gore',true);
      v.target.set((c.cx+a.cx)/2, (w.top(a)*L)+ (w.top(c)-w.top(a))*L*0.5, (c.cz+a.cz)/2);
      v.distance=6.5; v.pitch=0.42; v.updateCamera();
      return {vikCellId,dbg:{wall:b._dbgWall,noCell:b._dbgNoCell,flat:b._dbgFlat},totals:{before,now:b.blood.count},wall,ground,drips,wallSamples,tops:[w.top(c),w.top(a)],cell:{c:c.id,a:a.id}};
    });
    await p.waitForTimeout(900);
    await p.screenshot({path:'artifacts/coverage/cliff-blood.png'});
    console.log(JSON.stringify(out,null,2));
    assert.ok(out.totals.now>out.totals.before,'应有新血斑，实得 +'+(out.totals.now-out.totals.before));
    assert.ok(out.wall>0,'崖边出血应在崖壁上留竖直血斑，实得 '+out.wall);
    assert.ok(out.drips>0,'崖壁血应竖直拉长成流挂，实得 '+out.drips);
    assert.ok(out.ground>out.wall,'地面圆斑仍应占多数（不回归）：地面 '+out.ground+' / 墙面 '+out.wall);
    assert.deepEqual(errors,[]);
    fs.writeFileSync('artifacts/coverage/cliff-blood-browser.json',JSON.stringify({...out,errors},null,2));
    console.log('PASS cliff blood: 墙面竖斑 '+out.wall+'（流挂 '+out.drips+'）/ 地面圆斑 '+out.ground+' / 共 '+(out.totals.now-out.totals.before)+' 处');
  }finally{await browser.close();}
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
