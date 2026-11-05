const{chromium}=require('playwright'),fs=require('fs');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}),p=await browser.newPage({viewport:{width:1440,height:1000}}),reports=[],errors=[];p.on('pageerror',e=>errors.push(e.message));try{for(const grid of ['quad','mixed']){
 await p.goto('http://localhost:8769/index.html?scene=badnorth&grid='+grid);await p.waitForFunction(()=>window.rea?.battle?.running);
 const r=await p.evaluate(async()=>{const T=await import('three'),b=rea.battle;b.paused=true;b.nextWave=Infinity;const u=b.units[0],w=b.world,c=w.cells.find(c=>w.top(c)>=1&&w.top(c)===w.ground(c)&&b.houses.every(h=>Math.hypot(h.cell.cx-c.cx,h.cell.cz-c.cz)>1.1));if(!c)throw Error('no open fixture cell');u.x=c.cx;u.z=c.cz;u.y=w.top(c)*b.L;u.navFloor=w.top(c);const foe={...u,team:1,squad:null,x:u.x+.15,cd:100,hp:20,max:20};b.units=[u,foe];u.hp=u.max=3;u.cd=100;
 const y=u.y+.08,mesh=new T.Object3D();b.group.add(mesh);b.arrows.push({mesh,t:1,dur:1,from:[u.x,y,u.z],to:[u.x,y,u.z],shot:{v:3,th:Math.PI/2},target:u,stuck:false});b.update(0);
 if(u.hp!==2||u.stunRemaining!==.7)throw Error('surviving hit did not stun');u.cd=0;const x=u.x,z=u.z,hp=foe.hp;
 b.update(0);if(u.stunRemaining!==.7)throw Error('pause consumed stun');
 b.paused=false;for(let i=0;i<10;i++)b.update(1/30);b.paused=true;
 if(u.x!==x||u.z!==z||u.cd!==0||foe.hp!==hp||u.stunRemaining<=0)throw Error('stunned unit acted');
 const remaining=u.stunRemaining;rea.view.target.set(u.x,u.y+.1,u.z);rea.view.distance=2;rea.view.pitch=1.2;rea.view.updateCamera();window.stunFixture={unit:u,foe,healthBefore:hp};return{health:u.hp,remainingDuringStun:remaining,movementBlocked:true,attackBlocked:true,pausePreserved:true};});
 await p.screenshot({path:'artifacts/coverage/stun-'+grid+'.png'});
 const recovered=await p.evaluate(()=>{const b=rea.battle,{unit:u,foe,healthBefore}=stunFixture;rea.view.goreOff=true;b.paused=false;for(let i=0;i<20;i++)b.update(1/30);b.paused=true;if(u.stunRemaining!==0||foe.hp!==healthBefore-1)throw Error('did not resume attack');return{remaining:u.stunRemaining,resumedAttack:true,goreIndependent:true}});reports.push({grid,...r,...recovered});
 }}finally{await browser.close()}fs.writeFileSync('artifacts/coverage/stun-browser.json',JSON.stringify({reports,errors},null,2));if(errors.length)throw Error(errors.join('\n'));console.log('PASS actual Battle stun',reports)})().catch(e=>{console.error(e);process.exit(1)});
