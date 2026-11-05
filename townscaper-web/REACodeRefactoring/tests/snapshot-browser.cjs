const{chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}),p=await b.newPage({viewport:{width:1440,height:1200}}),errors=[],runs=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});try{
for(const mixed of [true,false]){
 if(mixed){await p.goto('http://localhost:8769/snapshot.html')}else{await p.uncheck('#mixed')}
 await p.waitForFunction(()=>window.snapshotReview?.ready);const report=await p.evaluate(async()=>{
  const T=await import('three'),{snapshotMaterial,createIslandSnapshot,snapshotTexture}=await import('./src/world/island-snapshot.js');
  const review=snapshotReview,{world,view}=document.querySelector('#scene').contentWindow.rea,renderer=view.renderer;
  const summary={size:review.size,occupied:review.occupied,vertices:review.vertices,versionBefore:review.versionBefore,versionAfter:review.versionAfter};
  if(summary.occupied<100||summary.occupied>4000||summary.vertices<1000||summary.versionBefore!==summary.versionAfter)throw Error('not a real transparent World capture');
  const snapshotState=()=>({target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mip:renderer.getActiveMipmapLevel(),viewport:renderer.getViewport(new T.Vector4()).toArray(),scissor:renderer.getScissor(new T.Vector4()).toArray(),test:renderer.getScissorTest(),clear:renderer.getClearColor(new T.Color()).getHex(),alpha:renderer.getClearAlpha(),auto:renderer.autoClear,xr:renderer.xr.enabled});
  const prior=snapshotState(),oldTarget=new T.WebGLRenderTarget(13,17);renderer.setRenderTarget(oldTarget);renderer.setViewport(2,3,8,9);renderer.setScissor(1,2,5,6);renderer.setScissorTest(true);renderer.setClearColor(0x246789,.37);renderer.autoClear=false;
  const expected=snapshotState(),scene=new T.Scene(),background=new T.Color('red');scene.background=background;const visible=new T.Object3D(),hidden=new T.Object3D();hidden.visible=false;scene.add(visible,hidden);
  const check=()=>{const a=snapshotState();if(a.target!==expected.target||a.clear!==expected.clear||JSON.stringify({...a,target:null})!==JSON.stringify({...expected,target:null})||scene.background!==background||!visible.visible||hidden.visible)throw Error('capture leaked renderer/scene state')};
  review.capture.capture(scene,{hide:[visible,hidden,visible]});check();
  const render=renderer.render;renderer.render=()=>{throw Error('injected render failure')};let failed=false;
  try{review.capture.capture(scene,{hide:[visible,hidden]})}catch(e){failed=e.message==='injected render failure'}finally{renderer.render=render}if(!failed)throw Error('failure not exercised');check();
  renderer.setRenderTarget(prior.target,prior.face,prior.mip);renderer.setViewport(...prior.viewport);renderer.setScissor(...prior.scissor);renderer.setScissorTest(prior.test);renderer.setClearColor(prior.clear,prior.alpha);renderer.autoClear=prior.auto;renderer.xr.enabled=prior.xr;oldTarget.dispose();
  const scratch=new T.WebGLRenderer({alpha:true}),camera=new T.OrthographicCamera(-1,1,1,-1,.1,10);camera.position.z=2;const geometry=new T.PlaneGeometry(2,2),s=new T.Scene(),mesh=new T.Mesh(geometry);s.add(mesh);
  const sizes=[128,256,512],samples=[];
  for(const size of sizes){const target=new T.WebGLRenderTarget(size,size);scratch.setSize(size,size);for(const crisp of [false,true]){const m=snapshotMaterial(review.texture,{crisp});mesh.material=m;scratch.setRenderTarget(target);scratch.setClearColor(0,0);scratch.render(s,camera);const data=new Uint8Array(size*size*4);scratch.readRenderTargetPixels(target,0,0,size,size,data);let on=0,transition=0,rgb=0;for(let i=0;i<data.length;i+=4){if(data[i+3]>127)on++;if(data[i+3]>10&&data[i+3]<245)transition++;rgb+=data[i]+data[i+1]+data[i+2]}
   if(on<100||rgb===0)throw Error('blank cross-context snapshot');samples.push({size,crisp,on,transition,rgb});m.dispose()};target.dispose()}
  // Filtered transparent samples must retain straight white, not darken twice.
  const rgba=new Uint8Array(8*8*4);for(let y=0;y<8;y++)for(let x=0;x<4;x++)rgba.fill(255,(y*8+x)*4,(y*8+x+1)*4);
  const white=snapshotTexture({pixels:rgba,size:8}),fringes=[];
  for(const crisp of [false,true]){const target=new T.WebGLRenderTarget(128,64),m=snapshotMaterial(white,{crisp});mesh.material=m;scratch.setRenderTarget(target);scratch.render(s,camera);const row=new Uint8Array(128*4);scratch.readRenderTargetPixels(target,0,32,128,1,row);let tested=0;for(let i=0;i<row.length;i+=4)if(row[i+3]>10&&row[i+3]<245){if(Math.abs(row[i]-row[i+3])>1)throw Error('dark alpha fringe');tested++}if(!tested)throw Error('no alpha fringe exercised');fringes.push({crisp,tested});m.dispose();target.dispose()};white.dispose();
  // Analytic derivative reference: one-pixel integrated line at three scales.
  const line=new T.ShaderMaterial({vertexShader:'varying vec2 v;void main(){v=uv;gl_Position=vec4(position,1.);}',fragmentShader:'varying vec2 v;void main(){float x=(v.x-.5)*7.;float a=1.-smoothstep(0.,fwidth(x),abs(x));gl_FragColor=vec4(1.,1.,1.,a);}'});mesh.material=line;const lines=[];
  for(const size of [32,64,128]){const target=new T.WebGLRenderTarget(size,4);scratch.setRenderTarget(target);scratch.render(s,camera);const row=new Uint8Array(size*4);scratch.readRenderTargetPixels(target,0,1,size,1,row);let width=0;for(let i=3;i<row.length;i+=4)width+=row[i]/255;if(Math.abs(width-1)>.02)throw Error('fwidth line width drift '+width);lines.push({size,width});target.dispose()}
  line.dispose();geometry.dispose();scratch.dispose();const disposed=createIslandSnapshot(renderer);disposed.dispose();let rejected=false;try{disposed.capture(scene)}catch(e){rejected=true}if(!rejected)throw Error('disposed capture accepted');
  return{...summary,stateRestored:true,failureRestored:true,samples,lines,fringes};
 });
 for(const size of [128,256,512]){const a=report.samples.find(x=>x.size===size&&!x.crisp),c=report.samples.find(x=>x.size===size&&x.crisp);assert(c.transition<a.transition*.9,'threshold should narrow the bilinear alpha fringe')}
 runs.push({mixed,...report});await p.click('#capture');await p.screenshot({path:`artifacts/coverage/snapshot-${mixed?'mixed':'quad'}.png`});
}
assert.equal(errors.length,0,errors.join('\n'));fs.writeFileSync('artifacts/coverage/snapshot-browser.json',JSON.stringify({runs,errors},null,2));console.log('PASS actual dual-grid snapshot, state/failure restoration, alpha narrowing, derivative line widths',runs);
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
