const{chromium}=require('playwright'),fs=require('fs'),path=require('path');
(async()=>{
 const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}),p=await b.newPage({viewport:{width:1440,height:1100}}),errors=[],reports=[],out=path.resolve(__dirname,'../artifacts/coverage'),base=process.env.REA_TEST_URL||'http://localhost:8769';
 p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,400))});
 await p.goto(base+'/smoke.html');
 for(const grid of ['quad','mixed']){
  if(grid==='mixed')await p.check('#mixed');
  await p.waitForFunction(()=>window.smokeReview?.ready&&document.querySelector('#scene').contentWindow.rea.view.smoke.p.length>10,{},{timeout:60000});
  await p.selectOption('#debug','cards');await p.uncheck('#scroll');await p.uncheck('#mip');
  const f=p.frames().find(f=>f.url().includes('index.html?'));
  const r=await f.evaluate(async()=>{
   const T=await import('./vendor/three.module.js'),{Smoke}=await import('./src/life/smoke.js');
   const scene=new T.Scene(),clock={value:0},s=new Smoke({scene,uTime:clock}),camera=new T.OrthographicCamera(-2,2,.65,-.65,.1,20);camera.position.z=5;camera.lookAt(0,0,0);camera.updateMatrixWorld();
   const renderer=new T.WebGLRenderer({antialias:false});renderer.setSize(512,160);const target=new T.WebGLRenderTarget(512,160);renderer.setRenderTarget(target);
   s.p=[.05,.5,.95].map((age,i)=>({serial:i,x:(i-1)*1.3,y:0,z:0,age,life:10,seed:.17,dir:i===1?-1:1,vy:0}));s.update(0,new T.Vector3(),camera);s.setPasses({back:false,front:true});s.setDebug('cards');
   // Equal screen size isolates LOD changes from geometry size and opacity.
   const m=new T.Matrix4();for(let i=0;i<3;i++){m.makeTranslation((i-1)*1.3,0,0);s.front.setMatrixAt(i,m)}s.front.instanceMatrix.needsUpdate=true;
   const capture=(time,scroll,mip)=>{clock.value=time;s.setSampling({scroll,mip});renderer.render(scene,camera);const data=new Uint8Array(512*160*4);renderer.readRenderTargetPixels(target,0,0,512,160,data);return data};
   const delta=(a,b,cx)=>{let sum=0,n=0;for(let y=42;y<118;y++)for(let x=cx-40;x<cx+40;x++){sum+=Math.abs(a[(y*512+x)*4]-b[(y*512+x)*4]);n++}return sum/n};
   const variation=(a,cx)=>{let sum=0,sq=0,n=0;for(let y=42;y<118;y++)for(let x=cx-40;x<cx+40;x++){const v=a[(y*512+x)*4];sum+=v;sq+=v*v;n++}return sq/n-(sum/n)**2};
   const off0=capture(0,false,false),off1=capture(.2,false,false),roll=capture(.2,true,false),mip=capture(0,false,true);
   const centers=[90,256,422],frozen=centers.map(c=>delta(off0,off1,c)),moving=centers.map(c=>delta(off0,roll,c)),sharp=centers.map(c=>variation(off0,c)),blur=centers.map(c=>variation(mip,c));
   // Verify +/- directions on the SAME card by swapping only aDir.
   s.aDir.setX(0,1);s.aDir.needsUpdate=true;const plus=capture(.2,true,false);s.aDir.setX(0,-1);s.aDir.needsUpdate=true;const minus=capture(.2,true,false),opposed=delta(plus,minus,90);
   // Check camera-projected motion and sorted attribute pairing on real particles.
   const wind=new T.Vector3(3,0,-2);s.p.forEach((p,i)=>{p.vy=.5;p.z=i*.1});s.update(0,wind,camera);
   const alignment=s.drawOrder.every((serial,i)=>{const p=s.p.find(p=>p.serial===serial),e=camera.matrixWorldInverse.elements,vx=wind.x*.6*p.age,vy=p.vy*(1-p.age*.6),vz=wind.z*.6*p.age,fx=e[0]*vx+e[4]*vy+e[8]*vz,fy=e[1]*vx+e[5]*vy+e[9]*vz,len=Math.hypot(fx,fy);return Math.abs(s.aFlow.getX(i)-fx/len)<1e-6&&Math.abs(s.aFlow.getY(i)-fy/len)<1e-6});
   const shared=s.back.material.uniforms.uMip===s.front.material.uniforms.uMip&&s.back.material.uniforms.uScroll===s.front.material.uniforms.uScroll;
   s.dispose();target.dispose();renderer.dispose();return{frozen,moving,sharp,blur,opposed,shared,alignment};
  });
  if(r.frozen.some(x=>x!==0)||r.moving.some(x=>x<1)||r.opposed<1||!r.shared||!r.alignment||r.blur[2]>=r.sharp[2]*.9||r.blur[2]>=r.blur[0])throw Error('sampling regression '+JSON.stringify(r));
  await p.check('#mip');await p.check('#scroll');await p.waitForTimeout(1800);await p.screenshot({path:path.join(out,'smoke-sampling-'+grid+'.png')});reports.push({grid,...r});
 }
 fs.writeFileSync(path.join(out,'smoke-sampling-browser.json'),JSON.stringify({reports,errors},null,2));await b.close();if(errors.length)throw Error(errors.join('\n'));console.log('PASS GPU texture scroll/opposed directions/mipmap sampling',reports);
})().catch(e=>{console.error(e);process.exit(1)});
