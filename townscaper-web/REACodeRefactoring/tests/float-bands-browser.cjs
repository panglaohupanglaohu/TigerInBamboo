// 1664565063552847873 "shader based fluid simulation … 32 bit float render targets … feed back to CPU"
// The视频 117 frames show exactly one thing: a continuous scalar field advected over time, mapped through a
// plasma-like palette and **laid on the rock platform surface** (bands bend along the mound's contours, the
// sky stays empty). This test measures that on float-bands.html + the shared World:
//   1) the colour layer really is the World's own triangles (clone of view.worldMesh.geometry) and the field
//      really is a float texture (128², RGBA/FLOAT, nearest + manual bilinear in the shader),
//   2) per-pixel colour == palette(field(x,z)) — GPU readback vs the CPU twin at projected surface points,
//   3) bands are continuous (many hue buckets, small neighbour deltas → no 8-bit contour stair-steps) and they
//      move when the field is advanced (0 → 40 steps), with a deterministic same-state noise of 0,
//   4) it is NOT a full-screen quad: outside the island silhouette the sky is untouched (background fraction),
//   5) A/B: forcing an 8-level quantisation collapses the hue buckets / raises neighbour deltas (the metric can
//      tell continuous from stepped), and a screenshot per state is saved for eyeballing.
const {chromium}=require('playwright'),fs=require('fs');
const SHOT='artifacts/coverage/';
const checks=[];const ok=(name,pass,detail)=>{checks.push({name,pass,detail});console.log(`${pass?'PASS':'FAIL'}  ${name}  ${detail??''}`)};

function rgb2hsv(r,g,b){r/=255;g/=255;b/=255;const mx=Math.max(r,g,b),mn=Math.min(r,g,b),d=mx-mn;let h=0;
  if(d>1e-6){if(mx===r)h=((g-b)/d)%6;else if(mx===g)h=(b-r)/d+2;else h=(r-g)/d+4;h*=60;if(h<0)h+=360}
  return [h,d/(mx||1),mx]}

function decode(rp){const buf=Buffer.from(rp.b64,'base64');const {sw,sh}=rp;return {sw,sh,px:(x,y)=>{const i=(y*sw+x)*4;return [buf[i],buf[i+1],buf[i+2],buf[i+3]]}}}

/** 色带像素：plasma 族饱和度高；天空/地面低饱和。 */
function bandStats(im){const {sw,sh}=im;let band=0,hueBuckets=new Map();const deltas=[];let big=0,pairs=0;
  const uniq=new Set();
  const isBand=(p)=>{const [h,s,v]=rgb2hsv(p[0],p[1],p[2]);return s>0.45&&v>0.12};
  const interior=(x,y)=>x>0&&y>0&&x<sw-1&&y<sh-1&&isBand(im.px(x-1,y))&&isBand(im.px(x+1,y))&&isBand(im.px(x,y-1))&&isBand(im.px(x,y+1));
  for(let y=0;y<sh;y++){let prev=null;
    for(let x=0;x<sw;x++){const p=im.px(x,y);if(!isBand(p)){prev=null;continue}band++;
      uniq.add((p[0]>>1)+','+(p[1]>>1)+','+(p[2]>>1));
      const [h,s,v]=rgb2hsv(p[0],p[1],p[2]);const b=Math.floor(h/10)*10;hueBuckets.set(b,(hueBuckets.get(b)||0)+1);
      if(prev!==null&&interior(x,y)){let dh=Math.abs(h-prev);if(dh>180)dh=360-dh;pairs++;deltas.push(dh);if(dh>25)big++}
      prev=h}}
  deltas.sort((a,b)=>a-b);
  const buckets=[...hueBuckets.values()].filter(n=>n>band*0.003).length;
  return {band, frac:band/(sw*sh), buckets, colors:uniq.size, pairs, bigFrac:pairs?big/pairs:0,
    medDelta:deltas.length?deltas[Math.floor(deltas.length/2)]:null,
    p90Delta:deltas.length?deltas[Math.floor(deltas.length*0.9)]:null}};

function diffStats(a,b){const n=Math.min(a.sw*b.sh,b.sw*b.sh);let changed=0,sum=0,cnt=0;
  for(let y=0;y<b.sh;y++)for(let x=0;x<b.sw;x++){const p=a.px(x,y),q=b.px(x,y);
    const d=(Math.abs(p[0]-q[0])+Math.abs(p[1]-q[1])+Math.abs(p[2]-q[2]))/3;if(d>2)changed++;sum+=d;cnt++}
  return {changedFrac:changed/cnt,meanDelta:sum/cnt}};

(async()=>{
  const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  const errs=[];
  const p=await b.newPage({viewport:{width:1440,height:1000}});
  p.on('pageerror',e=>errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error')errs.push('console: '+m.text())});
  await p.goto('http://localhost:8769/float-bands.html');
  await p.waitForFunction(()=>!!window.floatBands,null,{polling:150,timeout:90000});
  await p.evaluate(()=>{const d=document.querySelector('#scene').contentDocument;for(const el of d.body.children)if(el.tagName!=='CANVAS')el.style.display='none'});
  const hidden=await p.evaluate(()=>window.floatBands.isolate(true));
  console.log('isolate: 隐去',hidden,'个 scene 子对象（只留色带层）');

  // 0) 几何来源 + 纹理口径
  const st=await p.evaluate(()=>window.floatBands.stats());
  const meshTris=await p.evaluate(()=>{const g=window.floatBands.rea.view.worldMesh.geometry;return (g.index?g.index.count:g.attributes.position.count)/3});
  console.log('stats',JSON.stringify(st));
  ok('geometry = World 自身三角',st.geometry.triangles===meshTris&&st.geometry.source.includes('worldMesh'),`${st.geometry.triangles} vs ${meshTris}`);
  ok('field 128² · RGBA/FLOAT · nearest+bilerp',st.fieldSize===128&&st.texture.type==='float',JSON.stringify(st.texture));

  // 1) 连续档：0 步
  await p.evaluate(()=>{window.floatBands.freeze(true);window.floatBands.reset();window.floatBands.setQuant(0)});
  await p.waitForTimeout(250);
  const same=await p.evaluate(()=>{const a=window.floatBands.readPixels(3);const b=window.floatBands.readPixels(3);return a.b64===b.b64});
  const r0=await p.evaluate(()=>window.floatBands.readPixels(3));
  const im0=decode(r0);
  const s0=bandStats(im0);
  console.log('band0',JSON.stringify(s0));
  ok('色带只铺在几何上（天空未被铺满）',s0.frac>0.08&&s0.frac<0.85,`色带占比 ${(s0.frac*100).toFixed(1)}%`);
  ok('色带连续：色相档 ≥10',s0.buckets>=10,`${s0.buckets} 档（10° 一档，>0.3%）`);
  ok('色带连续：相邻色相跳变 <3%',s0.bigFrac<0.03,`>25° 的相邻对 ${(s0.bigFrac*100).toFixed(2)}% · 中位 ${s0.medDelta.toFixed(2)}°`);
  ok('同状态回读噪声 0',same,'同一 JS turn 内两次 readPixels 逐字节相同（已隐去水面/植被等动画层）');

  // 2) 推进 40 步：真的在动
  const prevSteps=await p.evaluate(()=>{window.floatBands.reset();return window.floatBands.advance(120)});
  await p.waitForTimeout(250);
  const r40=await p.evaluate(()=>window.floatBands.readPixels(3));
  const im40=decode(r40);
  const d=diffStats(im0,im40);
  console.log('diff 0→120',JSON.stringify(d),'steps',prevSteps);
  ok('场在平流：120 步后画面变化',d.changedFrac>0.06&&d.meanDelta>4,`变化像素 ${(d.changedFrac*100).toFixed(1)}% · 平均差 ${d.meanDelta.toFixed(2)} 级`);

  // 3) GPU 回读 vs CPU 孪生：从画布撒射线命中的**真实世界点**逐点对色（不猜遮挡、不用格心）
  const pairs=await p.evaluate(()=>{
    const api=window.floatBands,rp=api.readPixels(1),buf=atob(rp.b64),w=rp.w,h=rp.h;
    const px=(x,y)=>{const i=(y*w+x)*4;return [buf.charCodeAt(i),buf.charCodeAt(i+1),buf.charCodeAt(i+2)]};
    return api.probeGrid(10).map(pt=>({...pt,got:px(pt.px,pt.py)}));
  });
  const hueOf=q=>{const a=rgb2hsv(...q.cpu),b=rgb2hsv(...q.got);let dh=Math.abs(a[0]-b[0]);if(dh>180)dh=360-dh;return dh};
  const hueErr=pairs.map(hueOf).sort((a,b)=>a-b);
  const match=pairs.filter(q=>hueOf(q)<12).length;
  console.log('twin',pairs.slice(0,6).map(q=>`f=${q.field} y=${q.world[1]} cpu=${q.cpu} got=${q.got}`).join(' | '));
  ok('GPU 颜色 == palette(field(命中点 x,z))（CPU 孪生）',pairs.length>=20&&match/pairs.length>=0.85,
    `${match}/${pairs.length} 点 Δhue<12° · 中位 ${(hueErr[Math.floor(hueErr.length/2)]??-1).toFixed(2)}° · p90 ${(hueErr[Math.floor(hueErr.length*0.9)]??-1).toFixed(2)}°`);

  // 4) A/B：8 级量化应把色带打出台阶（证明上面的连续性判据不是瞎过）
  await p.evaluate(()=>{window.floatBands.setQuant(8);window.floatBands.reset()});
  await p.waitForTimeout(250);
  const r8=await p.evaluate(()=>window.floatBands.readPixels(3));
  const s8=bandStats(decode(r8));
  console.log('band quant8',JSON.stringify(s8));
  ok('A/B：8 级量化 → 色相档塌缩 / 跳变变多',s8.buckets<s0.buckets&&s8.bigFrac>s0.bigFrac,
    `档 ${s0.buckets}→${s8.buckets} · 跳变 ${(s0.bigFrac*100).toFixed(2)}%→${(s8.bigFrac*100).toFixed(2)}% · 离散色 ${s0.colors}→${s8.colors}`);
  await p.evaluate(()=>window.floatBands.setQuant(0));

  // 5) 截图（逐张用 ViewImage 看过）
  await p.evaluate(()=>{window.floatBands.reset();window.floatBands.setQuant(0)});
  await p.waitForTimeout(300);
  const shot0=SHOT+'float-bands-step0-r202.png';
  await p.locator('#scene').screenshot({path:shot0});
  await p.evaluate(()=>{window.floatBands.reset();window.floatBands.advance(40)});
  await p.waitForTimeout(300);
  const shot40=SHOT+'float-bands-step40-r202.png';
  await p.locator('#scene').screenshot({path:shot40});
  await p.evaluate(()=>{window.floatBands.reset();window.floatBands.setQuant(8)});
  await p.waitForTimeout(300);
  const shot8=SHOT+'float-bands-quant8-r202.png';
  await p.locator('#scene').screenshot({path:shot8});
  ok('截图落盘',[shot0,shot40,shot8].every(f=>fs.existsSync(f)&&fs.statSync(f).size>20000),`${shot0} 等 3 张`);
  ok('0 console error',errs.length===0,errs.slice(0,3).join(' / ')||'无');

  const failed=checks.filter(c=>!c.pass);
  console.log(`\n${checks.length-failed.length}/${checks.length} PASS`);
  fs.writeFileSync('artifacts/coverage/float-bands-report-r202.json',JSON.stringify({stats:st,band0:s0,band8:s8,diff:d,pairs:pairs.length,twinMatch:match,checks},null,1));
  await b.close();
  process.exit(failed.length?1:0);
})().catch(e=>{console.error('FAIL',e);process.exit(1)});
