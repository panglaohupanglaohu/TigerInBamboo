const{chromium}=require('playwright'),fs=require('fs');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}),p=await browser.newPage({viewport:{width:1440,height:1000}}),reports=[],errors=[];p.on('pageerror',e=>errors.push(e.message));try{for(const grid of ['quad','mixed']){
await p.goto('http://localhost:8769/index.html?scene=badnorth&grid='+grid);await p.waitForFunction(()=>window.rea?.battle?.running);
reports.push({grid,...await p.evaluate(async()=>{const T=await import('three'),b=rea.battle,w=b.world;b.paused=true;b.wave=2;b.t=4;b.nextWave=3;b.update(0);const boat=b.boats[0],big=boat.crew.find(u=>u.kind==='big'),small=b.units.find(u=>u.team===0);if(!big||boat.crew.filter(u=>u.kind==='big').length!==1)throw Error('wave three profile missing');
boat.state='unload';boat.wait=.4;b.update(0);if(big.onBoat)throw Error('big unit did not unload');
const c=w.cells.find(c=>w.top(c)>=1&&w.top(c)===w.ground(c)&&c.edgeNeighbors.every(id=>id>=0&&w.top(w.cells[id])===w.top(c)));if(!c)throw Error('no fixture');
for(const[u,dx]of[[big,0],[small,-.3]]){u.x=c.cx+dx;u.z=c.cz;u.y=w.top(c)*b.L;u.navFloor=w.top(c);u.cd=100}b.units=[big,small];
const hit=u=>{const y=u.y+.08*u.bodyScale,mesh=new T.Object3D();b.group.add(mesh);b.arrows.push({mesh,t:1,dur:1,from:[u.x,y,u.z],to:[u.x,y,u.z],shot:{v:3,th:Math.PI/2},target:u,stuck:false});b.update(0)};
for(let i=0;i<3;i++)hit(big);hit(small);
if(big.hp!==3||big.soak!==.5||big.stunRemaining!==0||small.stunRemaining!==.7)throw Error('profile health/stun distinction failed');
const m=new T.Matrix4();b.mBody.getMatrixAt(0,m);const scale=new T.Vector3().setFromMatrixScale(m);if(Math.abs(scale.x-1.5)>1e-6||Math.abs(b.aSoak.getX(0)-.5)>1e-6)throw Error('3d scale/soak missing');
rea.view.setDebug('unitsprites',true);b.update(0);const sizes=b.spriteBatch.pool.slice(0,2).map(m=>Math.abs(m.scale.x));if(Math.abs(sizes[0]-.36)>1e-9||Math.abs(sizes[1]-.24)>1e-9)throw Error('sprite size lost');rea.view.setDebug('unitsprites',false);b.update(0);
rea.view.target.set(c.cx-.1,big.y+.12,c.cz);rea.view.distance=2.2;rea.view.pitch=1.2;rea.view.updateCamera();window.profileFixture={big,hit,b,T};
return{wave:3,bigMax:big.max,bigHealth:big.hp,soak:big.soak,bigScale:scale.x,bigRadius:big.radius,smallStunned:true,bigResistsStun:true,spriteSizes:sizes};})});
await p.screenshot({path:'artifacts/coverage/combat-profile-'+grid+'.png'});
await p.evaluate(()=>{const{big,hit,b,T}=profileFixture;for(let i=0;i<3;i++)hit(big);if(!big.dead||big.hp!==0||big.soak!==1)throw Error('big death failed');const m=new T.Matrix4();b.mBody.getMatrixAt(0,m);if(Math.abs(new T.Vector3().setFromMatrixScale(m).x-1.5)>1e-6)throw Error('corpse lost scale')});
}}finally{await browser.close()}fs.writeFileSync('artifacts/coverage/combat-profile-browser.json',JSON.stringify({reports,corpseRetainsScale:true,errors},null,2));if(errors.length)throw Error(errors.join('\n'));console.log('PASS actual combat profiles',reports)})().catch(e=>{console.error(e);process.exit(1)});
