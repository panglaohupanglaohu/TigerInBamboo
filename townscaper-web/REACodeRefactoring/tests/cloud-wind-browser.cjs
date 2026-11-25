// r214（1852334860137849222）：近云 GPU 验收——裁判云风材质（三轴异频起伏/实例位置相位）、
// 前景云深度视差层（1/cd）、默认关时逐位等同旧漂移、蓬松云顶点色片元、真实落点深度分层。
const{chromium}=require('playwright'),fs=require('fs'),assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}),reports=[],errors=[];try{
 for(const grid of ['mixed','quad']){
  const p=await b.newPage({viewport:{width:1440,height:1000}});p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error'&&!m.location().url.endsWith('/favicon.ico'))errors.push(m.text())});
  await p.goto('http://localhost:8769/impostors.html');if(grid==='quad')await p.selectOption('#grid','quad');await p.waitForFunction(()=>window.impostorReview?.api.gridKind===document.querySelector('#grid').value,null,{timeout:60000});
  const report=await p.evaluate(async()=>{
   const api=impostorReview.api,v=api.view,T=await document.querySelector('#scene').contentWindow.eval("import('three')"),r=v.renderer,F=v.vegetation.cloudField,actual=F.material,version=api.world.version;
   if(actual.uniforms.uTime!==v.waterUniforms.uTime)throw Error('近云没接共享水时钟');
   if(actual.uniforms.uTex.value!==v.vegetation.backdrop.material.uniforms.uTex.value)throw Error('近云/远云图集不共享');
   if(!actual.fragmentShader.includes('c.rgb / max(c.a, 0.05)'))throw Error('近云片元未走烘焙顶点色（蓬松云）');
   if(actual.uniforms.uWindAmt.value!==.6||actual.uniforms.uCloudParallax.value!==1)throw Error('裁判风材质/视差未开 '+JSON.stringify({a:actual.uniforms.uWindAmt.value,p:actual.uniforms.uCloudParallax.value}));
   // 真实落点深度分层：内缘 1 → 外缘 ≤1.8，且不只一档
   const depths=[];for(let i=0;i<F.mesh.count;i++)depths.push(+F.depth.getX(i).toFixed(6));
   const dMin=Math.min(...depths),dMax=Math.max(...depths);
   if(dMin<1||dMax<=dMin||dMax>1.8+1e-6)throw Error('近云深度层缺失 '+JSON.stringify({dMin,dMax,n:depths.length}));
   // GPU 探针：把 center 输出到 1×1 RT（同 clouds-browser 的做法）
   const uniforms={...actual.uniforms,uTime:{value:0}},vertex='varying vec4 probe;\n'+actual.vertexShader.replace('gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);','probe=vec4(center,1.);gl_Position=vec4(position.xy*2.,0.,1.);'),mat=new T.ShaderMaterial({uniforms,defines:{...actual.defines},vertexShader:vertex,fragmentShader:'varying vec4 probe;void main(){gl_FragColor=probe;}',depthTest:false,depthWrite:false,blending:T.NoBlending}),geo=F.mesh.geometry.clone(),mesh=new T.InstancedMesh(geo,mat,1),m=new T.Matrix4();F.mesh.getMatrixAt(0,m);mesh.setMatrixAt(0,m);mesh.frustumCulled=false;const scene=new T.Scene();scene.add(mesh);const target=new T.WebGLRenderTarget(1,1,{type:T.FloatType,format:T.RGBAFormat,depthBuffer:false}),oldTarget=r.getRenderTarget();
   const read=t=>{uniforms.uTime.value=t;r.setRenderTarget(target);r.render(scene,v.camera);const f=new Float32Array(4);r.readRenderTargetPixels(target,0,0,1,1,f);if(f[3]!==1||!Array.from(f).every(Number.isFinite))throw Error('GPU probe empty/nonfinite');return Array.from(f).slice(0,3);};
   const cloudDrift=(t,y)=>((t*.12+y*7)%40+40)%40-20,yaw=F.yaw.getX(0),e=m.elements,uc=actual.uniforms.uCenter.value;
   // center = im·uCenter（列主序）：含 yaw 旋转与缩放，不能只加平移
   const xform=(el,v)=>[el[0]*v.x+el[4]*v.y+el[8]*v.z+el[12],el[1]*v.x+el[5]*v.y+el[9]*v.z+el[13],el[2]*v.x+el[6]*v.y+el[10]*v.z+el[14]];
   const base=xform(e,uc);
   const model=(t,depth,amt,par)=>{const cd=1+par*Math.max(0,depth-1),ph=e[12]*.13+e[14]*.17,b=[Math.sin(t*.11+ph)*amt,Math.sin(t*.15+ph*.7)*amt*.25,Math.cos(t*.09+ph*1.3)*amt*.6];return[base[0]+cloudDrift(t,yaw)/cd+b[0]/cd,base[1]+b[1]/cd,base[2]+b[2]/cd];};
   let bob,parallax,defaults,regress;
   try{
    // ① 开着裁判风材质+视差：GPU 位置与 CPU 模型逐分量一致（真实 aCloudDepth 落点）
    const d0=F.depth.getX(0),ps=[0,5,9.3].map(t=>read(t));
    bob=ps.map((p,i)=>{const exp=model([0,5,9.3][i],d0,.6,1),err=Math.hypot(p[0]-exp[0],p[1]-exp[1],p[2]-exp[2]);return{t:[0,5,9.3][i],p,err}});
    if(bob.some(x=>x.err>2e-4))throw Error('GPU 位移偏离 CPU 模型 '+JSON.stringify(bob));
    if(Math.abs(ps[1][1]-ps[0][1])<1e-5&&Math.abs(ps[2][1]-ps[0][1])<1e-5)throw Error('云没有 y 向起伏（旧材质回归）');
    // ② 视差：同一实例改 aCloudDepth=2.5 → 漂移增量按 1/cd 缩小
    const gattr=geo.attributes.aCloudDepth;
    const disp=(t0,t1,depth)=>{gattr.setX(0,depth);gattr.needsUpdate=true;const a=read(t0);return read(t1)[0]-a[0]};
    const w=[2,6],d1=disp(w[0],w[1],1),d25=disp(w[0],w[1],2.5);
    parallax={d1,d25,ratio:d25/d1,expected:(1)/(1+1.5)};
    if(Math.abs(parallax.ratio-parallax.expected)>1e-3)throw Error('深度视差比例错 '+JSON.stringify(parallax));
    // ③ 关掉风材质与视差 → 逐位回到旧漂移公式（y/z 纹丝不动）
    uniforms.uWindAmt={value:0};uniforms.uCloudParallax={value:0};gattr.setX(0,1);gattr.needsUpdate=true;
    const seq=[0,10,30].map(t=>({t,p:read(t)}));
    defaults=seq.map(({t,p})=>({t,err:Math.hypot(p[0]-(base[0]+cloudDrift(t,yaw)),p[1]-base[1],p[2]-base[2])}));
    if(defaults.some(x=>x.err>2e-4))throw Error('默认档漂移不再是旧公式 '+JSON.stringify(defaults));
    // ④ 实例相位：换个实例位置 → 起伏相位按新位置重算（不是一块板一起滑）
    const old=e.slice();m.setPosition(old[12]+4,old[13],old[14]-6);mesh.setMatrixAt(0,m);mesh.instanceMatrix.needsUpdate=true;uniforms.uWindAmt={value:.6};uniforms.uCloudParallax={value:1};
    const other=read(5),e2=mesh.instanceMatrix.array,ph2=e2[12]*.13+e2[14]*.17,b2=[Math.sin(5*.11+ph2)*.6,Math.sin(5*.15+ph2*.7)*.6*.25,Math.cos(5*.09+ph2*1.3)*.6*.6],base2=xform(e2,uc);
    const exp2=[base2[0]+cloudDrift(5,yaw)+b2[0],base2[1]+b2[1],base2[2]+b2[2]],err2=Math.hypot(other[0]-exp2[0],other[1]-exp2[1],other[2]-exp2[2]);
    regress={moved:Math.hypot(other[0]-ps[1][0],other[1]-ps[1][1],other[2]-ps[1][2]),err:err2};
    if(err2>2e-4)throw Error('换实例位置后 GPU 相位不跟 '+JSON.stringify(regress));
    gattr.setX(0,d0);gattr.needsUpdate=true;
   }finally{r.setRenderTarget(oldTarget);target.dispose();geo.dispose();mat.dispose();}
   if(api.world.version!==version)throw Error('Cloud motion changed World');
   return{grid:api.gridKind,count:F.mesh.count,depths:{min:dMin,max:dMax,n:depths.length,spread:+((dMax-dMin).toFixed(3))},windAmt:actual.uniforms.uWindAmt.value,parallax:actual.uniforms.uCloudParallax.value,bob,parallaxReport:parallax,defaults,regress,fluffyFragment:true,sharedClock:true,sharedAtlas:true,worldUnchanged:true};
  });
  reports.push(report);
  await p.screenshot({path:`artifacts/coverage/cloud-wind-${grid}.png`});
  await p.close();
 }
 assert.deepEqual(errors,[]);fs.writeFileSync('artifacts/coverage/cloud-wind-browser.json',JSON.stringify({reports,errors},null,2));console.log('PASS near-cloud GPU engine wind bob + 1/cd depth parallax + defaults regression + fluffy baked colours',JSON.stringify(reports.map(r=>({grid:r.grid,count:r.count,depths:r.depths})),null,1));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
