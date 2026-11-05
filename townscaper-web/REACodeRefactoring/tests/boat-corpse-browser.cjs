const {chromium}=require('playwright'),fs=require('fs');
(async()=>{
 const browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
 const p=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[],reports=[];p.on('pageerror',e=>errors.push(e.message));
 try{for(const grid of ['quad','mixed']){
  await p.goto('http://localhost:8769/index.html?scene=badnorth&grid='+grid);await p.waitForFunction(()=>window.rea?.battle?.running);
  reports.push({grid,...await p.evaluate(async()=>{
   const T=await import('three'),b=rea.battle,error=(a,c)=>Math.max(...a.elements.map((v,i)=>Math.abs(v-c.elements[i])));
   b.paused=true;b.t=4;b.nextWave=3;b.update(0);const boat=b.boats[0],u=boat.crew[0];
   b.group.position.set(2,1,-3);b.group.rotation.y=.4;b.group.scale.setScalar(1.2);b.group.updateMatrixWorld(true);
   const arrow=(target,x,y,z)=>{const mesh=new T.Object3D();b.group.add(mesh);const a={mesh,t:1,dur:1,from:[x,y,z],to:[x,y,z],shot:{v:3,th:Math.PI/2},target,stuck:false};b.arrows.push(a);b.update(0);return a};
   u.hp=1;arrow(u,u.x,u.y+.08,u.z);
   if(!u.dead||!u.corpseAnchor)throw Error('death did not capture pose');
   const anchor=u.corpseAnchor.clone();const getPose=()=>{const m=new T.Matrix4(),index=b.units.filter(v=>!v.dead||!rea.view.goreOff).indexOf(u);b.mBody.getMatrixAt(index,m);return m};
   if(error(getPose(),boat.mesh.matrix.clone().multiply(anchor))>1e-6)throw Error('death pose discontinuity');
   const oldRoll=boat.mesh.rotation.z;
   // Missed arrow must enter the real boat attach branch under a transformed parent.
   const a=arrow({dead:true},boat.x,boat.mesh.position.y+.12,boat.z);
   if(a.mesh.parent!==boat.mesh)throw Error('missed arrow not attached');
   const arrowLocal=a.mesh.matrix.clone();b.paused=false;for(let i=0;i<24;i++)b.update(1/30);b.paused=true;
   const drift=error(getPose(),boat.mesh.matrix.clone().multiply(anchor)),rollChange=Math.abs(oldRoll-boat.mesh.rotation.z);
   b.group.updateMatrixWorld(true);const arrowDrift=error(a.mesh.matrixWorld,boat.mesh.matrixWorld.clone().multiply(arrowLocal));
   if(drift>1e-6||rollChange<.001||arrowDrift>1e-9||!anchor.equals(u.corpseAnchor))throw Error('attachment drift');
   const before=b.mBody.count;rea.view.goreOff=true;b.update(0);if(b.mBody.count!==before-1||b.blood.visible)throw Error('gore off failed');
   rea.view.goreOff=false;b.update(0);if(b.mBody.count!==before||!b.blood.visible)throw Error('gore restore failed');
   b.group.position.set(0,0,0);b.group.rotation.set(0,0,0);b.group.scale.setScalar(1);b.group.updateMatrixWorld(true);
   rea.view.target.copy(boat.mesh.position);rea.view.distance=3.5;rea.view.updateCamera();
   window.boatCorpseFixture={boat,unit:u};
   return {drift,arrowDrift,rollChange,goreRoundTrip:true,deathPoseCaptured:true};
  })});
  await p.screenshot({path:'artifacts/coverage/boat-corpse-'+grid+'.png'});
  await p.evaluate(()=>{const b=rea.battle,{boat,unit}=boatCorpseFixture;boat.state='out';boat.t=1.21;b.update(0);if(b.units.includes(unit)||b.boats.includes(boat))throw Error('departed corpse retained');for(const st of boat.stains){if(b.blood.instanceMatrix.array[st.i*16]!==0)throw Error('departed stain retained')}});
  await p.evaluate(()=>rea.loadScene('town'));await p.waitForFunction(()=>!rea.battle.running);if(await p.evaluate(()=>rea.battle.blood.count!==0))throw Error('battle stop leak');
 }
 }finally{await browser.close()}
 fs.writeFileSync('artifacts/coverage/boat-corpse-browser.json',JSON.stringify({reports,departedCorpseRemoved:true,sceneStopClearsBlood:true,errors},null,2));if(errors.length)throw Error(errors.join('\n'));console.log('PASS corpse/arrow attachments',reports);
})().catch(e=>{console.error(e);process.exit(1)});
