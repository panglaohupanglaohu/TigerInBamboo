const{chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}),p=await b.newPage({viewport:{width:1440,height:1000}}),errors=[];p.on('pageerror',e=>errors.push(e.message));try{
 await p.goto('http://localhost:8769/atlas-live.html');await p.waitForFunction(()=>window.atlasLive?.items.length===2);
 const result=await p.evaluate(async()=>{
  const {renderer:r,baker:b,items,add,remove}=atlasLive,T=await import('./vendor/three.module.js');
  const pixels=()=>{const S=b.rt.width,a=new Uint8Array(S*S*4);r.readRenderTargetPixels(b.rt,0,0,S,S,a);return{a,S}};
  const hash=(px,x,y,w,h)=>{const{a,S}=px;let n=2166136261;for(let j=y;j<y+h;j++)for(let i=x;i<x+w;i++)for(let k=0;k<4;k++)n=Math.imul(n^a[(j*S+i)*4+k],16777619);return n>>>0};
  const rectOf=(it)=>it.frames.slice(0,4).map(x=>Math.round(x*b.size));
  const first=items[0],before=pixels(),liveHash=hash(before,...rectOf(first)),uv=JSON.stringify(first.frames),initial=b.atlas.report();
  add('knot',48);const active=b.atlas.report();if(JSON.stringify(first.frames)!==uv)throw Error('survivor UV moved');const released=items.at(-1),releasedRect=rectOf(released);remove();const after=pixels();let alpha=0;for(let y=releasedRect[1];y<releasedRect[1]+releasedRect[3];y++)for(let x=releasedRect[0];x<releasedRect[0]+releasedRect[2];x++)alpha+=after.a[(y*after.S+x)*4+3];
  const stale=b.release(released),unchanged=hash(after,...rectOf(first))===liveHash;
  // 自动扩容：272²×8 在 512² 至多放 1 个 → 翻倍重排到 1024；存活槽像素逐槽搬运、UV就地更新（策略属本地近似）。
  const fullBefore=b.atlas.report().usedArea,sizeBefore=b.size;add('knot',256);const grew=b.size===sizeBefore*2&&b.growths===1&&b.rt.width===b.size,grownAfter=b.atlas.report().usedArea;
  const survivorAfterGrow=grew&&hash(pixels(),...rectOf(first))===liveHash;
  // 永远放不下的尺寸（extent>maxSize）不扩容直接拒绝，图集无残留
  const rejBefore=b.atlas.report().usedArea;let rejected=false;try{add('knot',b.maxSize)}catch{rejected=true}const rejAfter=b.atlas.report().usedArea;
  const target=new T.WebGLRenderTarget(80,80);target.viewport.set(4,5,30,31);target.scissor.set(6,7,20,21);target.scissorTest=true;r.setRenderTarget(target);r.setClearColor('#593c27',.35);const clear=r.getClearColor(new T.Color()).toArray(),viewport=b.rt.viewport.toArray(),scissor=b.rt.scissor.toArray(),test=b.rt.scissorTest,original=r.render;let calls=0,failed=false;
  r.render=function(scene,camera){if(scene===b.scene&&++calls===3)throw Error('injected bake failure');return original.call(this,scene,camera)};
  try{b.bake(new T.SphereGeometry(1,10,8),32)}catch{failed=true}finally{r.render=original}
  const restored=r.getRenderTarget()===target&&r.getClearAlpha()===.35&&JSON.stringify(r.getClearColor(new T.Color()).toArray())===JSON.stringify(clear)&&JSON.stringify(b.rt.viewport.toArray())===JSON.stringify(viewport)&&JSON.stringify(b.rt.scissor.toArray())===JSON.stringify(scissor)&&b.rt.scissorTest===test;
  const failureArea=b.atlas.report().usedArea;r.setRenderTarget(null);target.dispose();
  const survivorAfterFailure=hash(pixels(),...rectOf(first))===liveHash;
  // 1593215065423245313 残差：release({residue:true}) 留 ×0.38 压暗调试残影（sprite-pack-c09 同口径），不是清透明
  add('sphere',48);const ghost=items.at(-1),grect=rectOf(ghost);const gBefore=pixels();let gAlpha0=0;for(let y=grect[1];y<grect[1]+grect[3];y++)for(let x=grect[0];x<grect[0]+grect[2];x++)gAlpha0+=gBefore.a[(y*gBefore.S+x)*4+3];
  b.release(ghost,{residue:true});const gAfter=pixels();let gAlpha1=0;for(let y=grect[1];y<grect[1]+grect[3];y++)for(let x=grect[0];x<grect[0]+grect[2];x++)gAlpha1+=gAfter.a[(y*gAfter.S+x)*4+3];
  const residue=gAlpha1>0&&gAlpha1<gAlpha0;atlasLive.draw();return{initial,active,alpha,stale,unchanged,grew,survivorAfterGrow,fullBefore,grownAfter,rejected,rejBefore,rejAfter,failed,restored,failureArea,survivorAfterFailure,residue,gAlpha0,gAlpha1};
 });assert.ok(result.unchanged);assert.equal(result.alpha,0);assert.equal(result.stale,false);assert.ok(result.grew&&result.survivorAfterGrow,'512→1024 扩容且存活像素逐位一致');assert.ok(result.rejected&&result.failed&&result.restored&&result.survivorAfterFailure);assert.equal(result.rejBefore,result.rejAfter);assert.equal(result.fullBefore+8*272*272,result.grownAfter);assert.equal(result.grownAfter,result.failureArea);assert.ok(result.residue,'release(residue) 应留压暗残影而非清透明');
 await p.screenshot({path:'artifacts/coverage/atlas-live-gpu.png'});await p.setViewportSize({width:390,height:844});await p.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>{atlasLive.draw();resolve()})));const box=await p.locator('canvas').boundingBox();assert.ok(box.width<=390);await p.screenshot({path:'artifacts/coverage/atlas-live-mobile.png'});
 await p.goto('http://localhost:8769/grids.html?t=atlas');await p.waitForFunction(()=>window.gridLab);await p.evaluate(()=>{gridLab.pauseAtlas();gridLab.resetAtlas()});await p.getByRole('button',{name:'单叶 first-fit'}).click();await p.evaluate(()=>{for(let i=0;i<70;i++)gridLab.atlasStep('add')});const candidates=await p.evaluate(()=>({slots:gridLab.atlas.rects().length,report:gridLab.atlas.report(),query:gridLab.atlas.lastSearch}));assert.ok(candidates.slots>0);assert.ok(candidates.query.tried>0);await p.screenshot({path:'artifacts/coverage/atlas-candidates.png'});
 assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/coverage/atlas-live-browser.json',JSON.stringify({result,candidates,errors},null,2));console.log('PASS real GPU bake/release/zero-alpha, stable survivor pixels+UV, 512→1024 auto-grow with bit-identical pixel migration, oversize rejection, render failure rollback and renderer state, shared cross-leaf candidate page');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
