// melee-feel-browser.cjs — 1022573208590057472 "the look and feel of the basic meat and potato melee combat"
// 验收：近战命中 = 挨打方被推开一点 + 喷 4 滴抛物线血滴（飞行中要真的画出来）+ 受伤后 soak 染色
//       + 血滴落地留血斑 + 死亡留尸体。
const{chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,
    args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  const p=await browser.newPage({viewport:{width:1440,height:1000}});
  const errors=[]; p.on('pageerror',e=>errors.push(e.message));
  try{
    await p.goto('http://127.0.0.1:8769/index.html?scene=badnorth&grid=quad');
    await p.waitForFunction(()=>window.rea?.battle?.running,{timeout:90000});
    // 第一段：摆一对近战单位 → 打一下 → 血滴还在空中，暂停并取近景
    const a=await p.evaluate(()=>{
      const b=rea.battle, w=b.world;
      b.paused=false; b.scale=1; b.wave=2; b.t=4; b.nextWave=3; b.update(0); b.nextWave=999;
      const boat=b.boats[0]; boat.state='unload'; boat.wait=.4; b.update(0);
      const def=b.units.find(u=>u.team===0&&!u.onBoat), vik=b.units.find(u=>u.team===1&&!u.onBoat);
      if(!def||!vik) throw Error('no melee pair');
      const c=w.cells.find(c=>w.top(c)>=1&&w.top(c)===w.ground(c)&&c.edgeNeighbors.every(id=>id>=0&&w.top(w.cells[id])===w.top(c)));
      const y=w.top(c)*b.L;
      for(const[u,dx]of[[def,0],[vik,0.15]]){u.x=c.cx+dx;u.z=c.cz;u.y=y;u.navFloor=w.top(c);u.cd=0;u.face=0;u.thrust=null;u.spearRecovery=null;u.stunRemaining=0;}
      b.units=[def,vik];
      const d0=Math.hypot(def.x-vik.x,def.z-vik.z), hp0=def.hp, blood0=b.blood.count;
      b.update(1/60);                                   // 双方 cd=0 → 这一帧互相命中
      for(let i=0;i<9;i++) b.update(1/60);              // 血滴飞离身体，成串
      const firstFrame={hp:def.hp,drops:b.drops.length,soak:def.soak,
        dist:Math.hypot(def.x-vik.x,def.z-vik.z),stun:def.stunRemaining,
        drawnDrops:b.dropPoints.geometry.drawRange.count,dropVisible:b.dropPoints.visible};
      b.paused=true;
      const v=rea.view; v.target.set((def.x+vik.x)/2,y+0.16,(def.z+vik.z)/2); v.distance=1.9; v.pitch=0.85; v.updateCamera();
      window.__melee={b,def,vik,cx:c.cx,cz:c.cz,y};
      return {firstFrame,d0,hp0,blood0};
    });
    await p.waitForTimeout(800);
    await p.screenshot({path:'artifacts/coverage/melee-feel-spray.png'});
    // 第二段：恢复时间 → 血滴落地 → 打到死 → 近景 + 地面全景
    const z=await p.evaluate(()=>{
      const {b,def,vik,cx,cz,y}=window.__melee;
      b.paused=false;
      def.cd=999; vik.cd=999; def.stunRemaining=0; vik.stunRemaining=0;   // 停手，只让血滴飞完
      for(let i=0;i<180;i++){ def.cd=999; vik.cd=999; b.update(1/60); }
      const afterLanding={blood:b.blood.count,drops:b.drops.length,drawnDrops:b.dropPoints.geometry.drawRange.count};
      for(let i=0;i<300&&!def.dead;i++){ vik.cd=0; vik.stunRemaining=0; b.update(1/60); }
      const corpse={dead:def.dead,hp:def.hp,blood:b.blood.count};
      const v=rea.view; v.target.set((def.x+vik.x)/2,y+0.16,(def.z+vik.z)/2); v.distance=2.9; v.pitch=0.95; v.updateCamera();
      return {afterLanding,corpse,cell:{cx,cz,y}};
    });
    await p.waitForTimeout(700);
    await p.screenshot({path:'artifacts/coverage/melee-feel.png'});
    await p.evaluate(({cx,cz,y})=>{const v=rea.view;v.target.set(cx,y+.1,cz);v.distance=6.0;v.pitch=.72;v.updateCamera();},z.cell);
    await p.waitForTimeout(600);
    await p.screenshot({path:'artifacts/coverage/melee-feel-ground.png'});

    const f=a.firstFrame;
    console.log(JSON.stringify({...a,...z},null,2));
    assert.ok(f.hp===a.hp0-1,'命中应扣 1 血，实得 '+(a.hp0-f.hp));
    assert.ok(f.drops>=4,'命中应喷 4 滴血，实得 '+f.drops);
    assert.ok(f.drawnDrops>=4,'飞行血滴应被画出，实得 '+f.drawnDrops);
    assert.ok(f.dropVisible,'飞行血滴点云应可见');
    assert.ok(f.soak>0,'受伤后 soak 应 >0，实得 '+f.soak);
    assert.ok(f.dist>a.d0+0.03,'挨打应被推开，实得 Δ='+(f.dist-a.d0));
    assert.ok(f.stun>0,'受伤应进入硬直，实得 '+f.stun);
    assert.ok(z.afterLanding.blood>a.blood0,'血滴落地应留血斑，实得 +'+(z.afterLanding.blood-a.blood0));
    assert.ok(z.afterLanding.drops===0,'血滴应全部落地');
    assert.equal(z.afterLanding.drawnDrops,0,'落地后不应再画血滴');
    assert.ok(z.corpse.dead&&z.corpse.hp===0,'应打死并留尸体');
    assert.deepEqual(errors,[]);
    fs.writeFileSync('artifacts/coverage/melee-feel-browser.json',JSON.stringify({...a,...z,errors},null,2));
    console.log('PASS melee feel: 扣血+推开 '+((f.dist-a.d0)*1000).toFixed(0)+'mm / 飞行血滴 '+f.drawnDrops+' 点 / soak '+f.soak.toFixed(2)+' / 落地血斑 +'+(z.afterLanding.blood-a.blood0)+' / 尸体 ok');
  }finally{await browser.close();}
})().catch(e=>{console.error('FAIL',e.message);process.exit(1)});
