// ledge-knock-browser.cjs — 870296307889573889 "Units can now get knocked off ledges"
// 片子：台地边上被打退的兵越过后沿直接掉下去，沿崖面滚过中间一级，最后摔在下面一层沙地上、留尸体和血。
// 验收：① 崖边挨打会进入 fall；② 下坠沿崖面（水平位移小），不是往崖外抛；
//       ③ 两级台地会接着滚（一次跌落跨 ≥2 层），落差 ≥3 层摔死；④ 落地留血。
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
      const R=Math.random; Math.random=()=>0.1;            // 击飞判定 0.6 概率：固定必中，测试可复现
      try{
        b.paused=false; b.scale=1; b.wave=2; b.t=4; b.nextWave=3; b.update(0); b.nextWave=999;
        const boat=b.boats[0]; if(boat){boat.state='unload';boat.wait=.4;b.update(0);}   // 先让第一船维京人上岸
        // 收集所有「c → a（低 2 层）→ b2（再低 ≥1 层）」台地链，逐个试着打，直到真的把人打下去
        const cands=[];
        for(const c of w.cells){
          if(!b.navigation.pick(c,w.top(c)*L))continue;
          for(let i=0;i<c.n&&cands.length<400;i++){
            const ia=c.edgeNeighbors[i]; if(ia<0)continue;
            const a=w.cells[ia];
            if(w.top(c)-w.top(a)<2||!b.navigation.pick(a,w.top(a)*L))continue;
            let b2=null;
            for(let j=0;j<a.n;j++){
              const ib=a.edgeNeighbors[j]; if(ib<0||ib===c.id)continue;
              const cand=w.cells[ib];
              if(w.top(a)-w.top(cand)>=1&&b.navigation.pick(cand,w.top(cand)*L)){b2=cand;break;}
            }
            if(b2)cands.push({c,a,b2});
          }
        }
        if(!cands.length)throw Error('没找到两段崖壁');
        const vik0=b.units.find(u=>u.team===1&&!u.onBoat&&!u.fall)||b.units.find(u=>u.team===1);
        const def0=b.units.find(u=>u.team===0&&!u.onBoat&&!u.fall);
        if(!vik0||!def0)throw Error('场上没有可摆位的敌我单位');
        let hitAt=null;
        for(const cand of cands){
          const {c,a}=cand;
          const dx=a.cx-c.cx, dz=a.cz-c.cz, dl=Math.hypot(dx,dz), nx=dx/dl, nz=dz/dl;
          const topY=w.top(c)*L;
          const vik=vik0, def=def0;
          vik.dead=false; vik.hp=6; vik.fall=null;
          vik.x=c.cx+nx*0.18; vik.z=c.cz+nz*0.18; vik.y=topY; vik.navFloor=w.top(c); vik.cd=0; vik.stunRemaining=0; vik.thrust=null; vik.spearRecovery=null;
          def.x=c.cx-nx*0.06; def.z=c.cz-nz*0.06; def.y=topY; def.navFloor=w.top(c); def.cd=0; def.stunRemaining=0; def.thrust=null; def.spearRecovery=null;
          b.units=[def,vik];
          if(!b.navigation.canMelee(def,vik))continue;
          b.update(1/60);
          if(vik.fall){hitAt=cand;break;}
        }
        if(!hitAt)throw Error('所有崖边候选格都没把单位打下去');
        const {c,a,b2}=hitAt;
        const vik=b.units.find(u=>u.team===1), def=b.units.find(u=>u.team===0);
        const entered=!!vik.fall;
        const blood0=b.blood.count, startFloor=w.top(c), x0=vik.x, z0=vik.z, topY=w.top(c)*L;
        const trail=[]; const vkX=vik.x, vkZ=vik.z;
        for(let i=0;i<240&&!vik.dead;i++){
          if(!vik.fall&&vik.y<topY-0.05)break;
          def.cd=999;                                  // 只留第一次击退，后面让物理自己走
          b.update(1/60);
          if(vik.fall)trail.push({x:+vik.x.toFixed(3),y:+vik.y.toFixed(3),z:+vik.z.toFixed(3)});
        }
        const res={startFloor,endFloor:vik.navFloor??Math.round(vik.y/L),endY:+vik.y.toFixed(3),
          entered,steps:trail.length,dead:!!vik.dead,blood:b.blood.count-blood0,
          drift:+Math.hypot(vik.x-x0,vik.z-z0).toFixed(3),
          trailY:trail.map(t=>t.y),cell:{c:c.id,a:a.id,b2:b2.id},tops:[w.top(c),w.top(a),w.top(b2)]};
        b.paused=true;
        // 让还在空中的血滴落完，再对着尸体拍一张，画面里要看得到崖壁、尸体、血斑
        b.paused=false; for(let i=0;i<90;i++){ def.cd=999; b.update(1/60); } b.paused=true;
        const v=window.rea.view;
        v.setDebug('gore',true);
        v.target.set(vik.x, vik.y+0.12, vik.z); v.distance=4.5; v.pitch=1.02; v.updateCamera();
        res.bloodAfterDrops=b.blood.count-blood0; res.vikEnd={x:+vik.x.toFixed(2),y:+vik.y.toFixed(2),z:+vik.z.toFixed(2)}; res.cx=+c.cx.toFixed(2); res.cz=+c.cz.toFixed(2);
        return res;
      }finally{Math.random=R;}
    });
    await p.waitForTimeout(900);
    await p.screenshot({path:'artifacts/coverage/ledge-knock.png'});
    console.log(JSON.stringify(out,null,2));
    assert.ok(out.entered,'崖边挨打应进入 fall（被打下台沿）');
    assert.ok(out.endFloor<=out.startFloor-2,'应一次跌落跨 ≥2 层：'+out.startFloor+' → '+out.endFloor);
    assert.ok(out.drift<1.1,'应沿崖面下落而不是抛到崖外：水平位移 '+out.drift);
    assert.ok(out.dead,'落差 ≥3 层应摔死');
    assert.ok(out.blood>0,'落地应留血，实得 +'+out.blood);
    assert.ok(out.steps>8,'应有多帧下坠轨迹，实得 '+out.steps);
    assert.deepEqual(errors,[]);
    fs.writeFileSync('artifacts/coverage/ledge-knock-browser.json',JSON.stringify({...out,errors},null,2));
    console.log('PASS ledge knock: '+out.startFloor+' 层 → '+out.endFloor+' 层（跨 '+(out.startFloor-out.endFloor)+' 层）/ 下坠 '+out.steps+' 帧 / 水平位移 '+out.drift+' / 摔死 / 血 +'+out.blood);
  }finally{await browser.close();}
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
