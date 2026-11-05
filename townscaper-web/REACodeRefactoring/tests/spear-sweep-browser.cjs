const{chromium}=require('playwright'),fs=require('fs');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}),p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],reports=[];p.on('pageerror',e=>errors.push(e.message));try{for(const grid of ['quad','mixed']){await p.goto('http://localhost:8769/index.html?scene=badnorth&grid='+grid);await p.waitForFunction(()=>window.rea?.battle?.running);reports.push({grid,...await p.evaluate(()=>{
 const b=rea.battle,w=b.world,u=b.units.find(u=>u.squad?.pike),c=w.cells.find(c=>w.top(c)>=1&&w.top(c)===w.ground(c)&&c.edgeNeighbors.every(id=>id>=0&&w.top(w.cells[id])===w.top(c)));
 if(!c)throw Error('no flat fixture');b.paused=true;b.nextWave=Infinity;u.x=c.cx;u.z=c.cz;u.y=w.top(c)*b.L;u.navFloor=w.top(c);u.cd=0;
 const enemy=(dx,dz,dy=0)=>({...u,squad:null,team:1,x:u.x+dx,z:u.z+dz,y:u.y+dy,hp:5,max:5,cd:100,stunRemaining:10});const a=enemy(.27,0),far=enemy(.39,0),side=enemy(.2,.3),above=enemy(.3,0,b.L*2);b.units=[u,a,far,side,above];
 b.paused=false;b.update(.05);if(!u.thrust||a.hp!==5)throw Error('not a timed thrust');
 b.paused=true;b.update(0);if(u.thrust.age!==0)throw Error('pause advanced thrust');b.paused=false;for(let i=0;i<6;i++)b.update(.05);b.paused=true;
 if(a.hp!==4||far.hp!==4||side.hp!==5||above.hp!==5)throw Error('wrong spear targets '+[a.hp,far.hp,side.hp,above.hp]);
 a.x=u.x+.27;a.z=u.z;a.y=u.y;a.fall=null;far.x=u.x+.39;far.z=u.z;far.y=u.y;far.fall=null;u.cd=0;b.paused=false;b.update(.05);for(let i=0;i<6;i++)b.update(.05);b.paused=true;if(a.hp!==3)throw Error('next attack failed '+JSON.stringify({hp:a.hp,fall:a.fall,thrust:u.thrust,stun:u.stunRemaining}));
 // Fast lateral crossing: both endpoints lie outside the fixed shaft radius.
 a.x=u.x+.15;a.z=u.z+.3;a.y=u.y;a.fall=null;a.stunRemaining=10;b.units=[u,a,far];u.cd=0;u.thrust=null;
 // Trigger toward a temporary straight-ahead target, then move it out of the way.
 far.x=u.x+.27;far.z=u.z;far.y=u.y;far.fall=null;
 b.paused=false;b.update(.05);b.paused=true;if(!u.thrust)throw Error('missing crossing thrust');
 b.units=[u,a];const health=a.hp;a.z=u.z-.3;
 b.paused=false;b.update(.05);b.paused=true;
 // On the first short extension the crossing can occur ahead of the tip; a second
 // crossing during a longer extension must be detected with neither endpoint inside.
 if(a.hp===health){a.z=u.z+.3;b.paused=false;b.update(.05);b.paused=true;}
 if(a.hp!==health-1)throw Error('fast crossing tunneled through spear');
 // A nonlethal hit during an active thrust must cancel the attack.
 u.stunRemaining=.7;b.update(0);if(u.thrust)throw Error('stun did not cancel thrust');
 rea.view.target.set(u.x,u.y+.1,u.z);rea.view.distance=2.2;rea.view.pitch=1.2;rea.view.updateCamera();return{frontHealth:a.hp,sideHealth:side.hp,otherFloorHealth:above.hp,oneHitPerThrust:true,newThrustCanHit:true,pausePreserved:true,stunCancels:true,fastCrossingHit:true};
 })});await p.screenshot({path:'artifacts/coverage/spear-sweep-'+grid+'.png'})}}finally{await browser.close()}fs.writeFileSync('artifacts/coverage/spear-sweep-browser.json',JSON.stringify({reports,errors},null,2));if(errors.length)throw Error(errors.join('\n'));console.log('PASS actual Battle spear',reports)})().catch(e=>{console.error(e);process.exit(1)});
