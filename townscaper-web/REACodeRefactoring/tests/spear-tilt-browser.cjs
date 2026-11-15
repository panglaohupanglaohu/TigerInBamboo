// 903647529203634176 · 长矛待机斜举（40°）/ 刺出压平
// 直接按实例矩阵的 Z 轴读数（那是矛杆方向），不靠截图目测。
const{chromium}=require('playwright'),fs=require('fs');
(async()=>{const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}),p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],reports=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
try{for(const grid of ['quad','mixed']){
  await p.goto('http://localhost:8769/index.html?scene=badnorth&grid='+grid);
  await p.waitForFunction(()=>window.rea?.battle?.running);
  await p.evaluate(async()=>{const{beginSpearThrust}=await import('./src/core/spear-thrust.js'),b=rea.battle,u=b.units.find(u=>u.squad?.pike);if(!u)throw Error('no pike unit');const w=b.world,c=w.cells.find(c=>w.top(c)>=1&&w.top(c)===w.ground(c)&&c.edgeNeighbors.every(id=>id>=0&&w.top(w.cells[id])===w.top(c)));if(!c)throw Error('no open fixture');
    u.x=c.cx;u.z=c.cz;u.y=w.top(c)*b.L;u.navFloor=w.top(c);u.face=0;u.cd=100;b.units=[u];b.nextWave=Infinity;b.paused=true;u.thrust=null;u.spearRecovery=null;
    window.tilt={b,u,beginSpearThrust,T:null,reading:null};await import('three').then(T=>tilt.T=T);
    rea.view.setDebug('unitsprites',false);b.update(0);});
  // 待机
  const idle=await p.evaluate(()=>{const{T,b,u}=tilt;b.update(0);const m=new T.Matrix4();b.mSpear.getMatrixAt(0,m);const d=new T.Vector3(0,0,1).transformDirection(m);
    rea.view.target.set(u.x,u.y+.1,u.z);rea.view.distance=1.8;rea.view.pitch=1.15;rea.view.updateCamera();
    return{deg:Math.asin(d.y)*180/Math.PI,count:b.mSpear.count};});
  if(!(idle.deg>34&&idle.deg<46))throw Error('idle pike not ~40° up: '+idle.deg);
  await p.screenshot({path:'artifacts/coverage/spear-tilt-'+grid+'-idle.png'});
  // 刺出
  const thrust=await p.evaluate(()=>{const{T,b,u,beginSpearThrust}=tilt;u.thrust=beginSpearThrust(u,{x:1,z:0});b.paused=false;b.update(.05);b.paused=true;const m=new T.Matrix4();b.mSpear.getMatrixAt(0,m);const d=new T.Vector3(0,0,1).transformDirection(m);return{deg:Math.asin(d.y)*180/Math.PI,len:d.length(),active:!!u.thrust};});
  if(Math.abs(thrust.deg)>1.5)throw Error('thrust not horizontal: '+thrust.deg);
  await p.screenshot({path:'artifacts/coverage/spear-tilt-'+grid+'-thrust.png'});
  // 收矛回斜
  const recover=await p.evaluate(()=>{const{T,b,u}=tilt;u.thrust=null;u.spearRecovery={remaining:.06,duration:.12,dx:1,dz:0,length:.44};b.update(0);const m=new T.Matrix4();b.mSpear.getMatrixAt(0,m);const d=new T.Vector3(0,0,1).transformDirection(m);const half=Math.asin(d.y)*180/Math.PI;u.spearRecovery={remaining:.12,duration:.12,dx:1,dz:0,length:.44};b.update(0);b.mSpear.getMatrixAt(0,m);d.set(0,0,1).transformDirection(m);const tail=Math.asin(d.y)*180/Math.PI;u.spearRecovery=null;b.update(0);return{half,tail};});
  if(!(recover.tail<recover.half&&recover.tail<2&&recover.half>15))throw Error('recovery pitch not ramping back: '+JSON.stringify(recover));
  reports.push({grid,idleDeg:+idle.deg.toFixed(2),thrustDeg:+thrust.deg.toFixed(2),spearCount:idle.count,halfRecoverDeg:+recover.half.toFixed(2),tailRecoverDeg:+recover.tail.toFixed(2)});
}}
finally{await browser.close()}
fs.writeFileSync('artifacts/coverage/spear-tilt-browser.json',JSON.stringify({reports,errors},null,2));
if(errors.length)throw Error(errors.join('\n'));
console.log('PASS spear idle tilt',JSON.stringify(reports));
})().catch(e=>{console.error(e);process.exit(1)});
