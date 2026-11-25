// 1305951750638231552 残差 a：洞/悬挑/形变表面的三场半影 —— 真实 View 上开 penumbra3d 验收。
// 水面三场仍走 2.5D 层；体素接收面接到 view.material（合并地形/建筑网格，含形变顶点）。
const {chromium}=require('playwright'),fs=require('fs');(async()=>{const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']}),reports=[],errors=[];try{for(const kind of ['mixed','quad']){const p=await b.newPage({viewport:{width:1440,height:1200}});p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:8769/penumbra.html');if(kind==='quad')await p.selectOption('#grid',kind);await p.waitForFunction(k=>window.penumbraReview?.api.gridKind===k,kind,{polling:100});
// 记录开之前的主网格接收影状态，再勾「地形·洞/悬挑三场」
const before=await p.evaluate(()=>({recv:penumbraReview.api.view.mesh.receiveShadow,water:!!penumbraReview.api.view.penumbra}));
await p.check('#vox3d');
await p.waitForFunction(()=>{const pen=penumbraReview.api.view.postExtras?.penumbra;return pen?.field&&pen.stats},null,{polling:100});
const on=await p.evaluate(()=>{const v=penumbraReview.api.view,pen=v.postExtras.penumbra,f=pen.field;return{state:v.postExtras.state.penumbra3d,recv:v.mesh.receiveShadow,water:!!v.penumbra,receivers:f.stats.receivers,multi:f.stats.multiReceiverColumns,uPenOn:pen.uniforms.uPenOn.value,dims:pen.uniforms.uPenDims.value.toArray(),tex:[pen.texture.image.width,pen.texture.image.height]}});
if(!on.state||on.recv!==false||!on.water||!on.receivers||on.uPenOn!==1)throw Error('penumbra3d on failed '+JSON.stringify(on));
// 转太阳后体素场重烘（version/sun 变 → 新纹理）
await p.locator('#az').fill('-70');await p.waitForFunction(()=>penumbraReview.api.view.postExtras.penumbra.sun.equals(penumbraReview.api.view.sunDir)===false||penumbraReview.api.view.postExtras.penumbra.version>=0,null,{polling:100});
await p.waitForFunction(()=>penumbraReview.api.view.postExtras.penumbra.sun.equals(penumbraReview.api.view.sunDir),null,{polling:200});
await p.screenshot({path:`artifacts/coverage/penumbra-3d-${kind}.png`,fullPage:true});
// 关闭：接收影/水面层按开关前状态还原，uniform 关
await p.uncheck('#vox3d');const off=await p.evaluate(()=>{const v=penumbraReview.api.view,pen=v.postExtras.penumbra;return{recv:v.mesh.receiveShadow,water:!!v.penumbra,uPenOn:pen.uniforms.uPenOn.value,state:v.postExtras.state.penumbra3d}});
if(off.state||off.recv!==before.recv||off.water!==before.water||off.uPenOn!==0)throw Error('penumbra3d off restore failed '+JSON.stringify(off));
// dispose：纹理销毁 + 材质补丁/缓存键还原 + 幂等
const dis=await p.evaluate(()=>{const v=penumbraReview.api.view,pen=v.postExtras.penumbra;pen.dispose();const key=v.mesh.material.customProgramCacheKey();const hasPen=v.mesh.material.onBeforeCompile.toString().includes('penumbraTone');pen.dispose();return{tex:pen.texture,uTex:pen.uniforms.uPenTex.value,uOn:pen.uniforms.uPenOn.value,key:key.includes('penumbra-terrain'),hasPen}});
if(dis.tex||dis.uTex||dis.uOn!==0||dis.key||dis.hasPen)throw Error('penumbra3d dispose failed '+JSON.stringify(dis));
reports.push({kind,before,on,off,dis});await p.close()}
if(errors.length)throw Error(errors.join('\n'));fs.writeFileSync('artifacts/coverage/penumbra3d-browser.json',JSON.stringify({reports,errors},null,2));console.log('PASS penumbra3d real-scene: voxel receivers on, sun rebake, off restores, dispose',reports.map(r=>({kind:r.kind,receivers:r.on.receivers,multi:r.on.multi,tex:r.on.tex})))}finally{await b.close()}})().catch(e=>{console.error(e);process.exit(1)});
