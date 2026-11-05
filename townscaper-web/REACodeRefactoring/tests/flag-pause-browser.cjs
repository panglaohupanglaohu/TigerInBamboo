const{chromium}=require('playwright'),fs=require('fs');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}),p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[],reports=[];p.on('pageerror',e=>errors.push(e.message));try{
 for(const grid of ['mixed','quad']){
  await p.goto('http://localhost:8769/index.html?scene=badnorth&grid='+grid);await p.waitForFunction(()=>window.rea?.battle?.running);
  const report=await p.evaluate(async()=>{const T=await import('three');const b=rea.battle;b.paused=true;b.nextWave=Infinity;b.update(0);const flags=b.squads.filter(s=>s.alive).map(s=>s.flag),snapshot=()=>flags.flatMap(f=>[...f.userData.cloth.geometry.attributes.position.array]),before=snapshot(),clock=b.t;
  for(let i=0;i<30;i++)b.update(1/60);const after=snapshot(),pauseDrift=Math.max(...before.map((v,i)=>Math.abs(v-after[i])));if(pauseDrift>1e-8||b.t!==clock||b._dt!==0)throw Error('paused flag drift '+pauseDrift);
  let samples=0;const field=rea.view.atmosphere,original=field.sample;field.sample=function(...args){samples++;return original.apply(this,args)};
  try{b.paused=false;for(let i=0;i<30;i++)b.update(1/60)}finally{b.paused=true;field.sample=original}
  const moving=snapshot(),motion=Math.max(...after.map((v,i)=>Math.abs(v-moving[i])));if(motion<1e-5||samples<flags.length*30)throw Error('shared wind/animation did not resume');
  let disposed=0;for(const f of flags){const c=f.userData.cloth,m=c.material;if(m.alphaTest!==.5||m.color.getHex()!==0xffffff||!m.map?.userData.banner||c.geometry.attributes.uv.count!==22)throw Error('banner not integrated');for(const r of [c.geometry,m,m.map])r.addEventListener('dispose',()=>disposed++);f.traverse(o=>{if(o.geometry)o.geometry.addEventListener('dispose',()=>disposed++);if(o.material)o.material.addEventListener('dispose',()=>disposed++)})}window.bannerDisposals=()=>disposed;
  let curveError=0,constraintError=0;
  for(const f of flags){const top=f.position.clone();top.y+=.58;const P=f.userData.parts,a=f.userData.cloth.geometry.attributes.position,seg=f.userData.SEG;let prev=top;
   for(const p of P){constraintError=Math.max(constraintError,Math.abs(p.distanceTo(prev)-.075));prev=p}
   for(let i=0;i<=seg;i++){const u=i/seg,v=1-u,expected=top.clone().multiplyScalar(v*v*v).addScaledVector(P[0],3*v*v*u).addScaledVector(P[1],3*v*u*u).addScaledVector(P[2],u*u*u);curveError=Math.max(curveError,Math.hypot(a.getX(i*2)-expected.x,a.getY(i*2)-expected.y,a.getZ(i*2)-expected.z),Math.abs(a.getY(i*2)-a.getY(i*2+1)-.10*(1-.25*u)))}
  }
  if(curveError>1e-6||constraintError>1e-9)throw Error('Bezier/particle constraints drift');
  const view=rea.view;let visibleAngle=null;
  search:for(let flagIndex=0;flagIndex<flags.length;flagIndex++)for(const yaw of [0,Math.PI,Math.PI/2,-Math.PI/2])for(const pitch of [.3,.6,1]){
   const f=flags[flagIndex],center=f.position.clone();center.y+=.5;view.target.copy(center);view.distance=3;view.yaw=yaw;view.pitch=pitch;view.updateCamera();view.scene.updateMatrixWorld(true);
   const direction=center.clone().sub(view.camera.position),dist=direction.length(),ray=new T.Raycaster(view.camera.position,direction.normalize(),0,dist-.08),hits=ray.intersectObject(view.mesh);
   if(!hits.length){visibleAngle={flagIndex,yaw,pitch};break search;}
  }
  if(!visibleAngle)throw Error('no unobstructed flag fixture camera');window.reviewFlags=flags;return{flags:flags.length,pauseDrift,motion,windSamples:samples,curveError,constraintError,visibleAngle};});
  reports.push({grid,...report});await p.screenshot({path:`artifacts/coverage/flag-pause-${grid}.png`});await p.evaluate(()=>rea.loadScene('town'));await p.waitForFunction(()=>!rea.battle.running);await p.evaluate(()=>{for(const f of reviewFlags)if(f.parent||f.userData.cloth.parent)throw Error('flag retained after scene stop');if(bannerDisposals()!==15)throw Error('banner resource cleanup '+bannerDisposals())});
 }
 if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync('artifacts/coverage/flag-pause-browser.json',JSON.stringify({reports,errors},null,2));console.log('PASS actual Battle flags: pause, shared wind, Bezier, constraints and scene removal',reports);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
