// 1671808851895627776 overhangs (303 frames): the video flaunts a mushroom rock — a wide cap standing on a
// narrow stem, its dark soffit visible from a low camera, with an open slot between stem and cap you can look
// through. This test measures exactly those three things on overhang.html + the shared World:
//   1) voxel/roof facts (rockTopology / measureOverhang) — the cap is a roof over 3 levels of open air,
//   2) every downward soffit triangle near the cap is inside the frame and unoccluded from the camera,
//   3) pixels: the band under the cap is darker than both the lit top face and what the same band shows once
//      the cap is removed (A/B), plus a see-through ray through the slot that reaches the stem's inner wall.
// It also closes "thin lip collapses under smooth deformation": with the area/edge guard on the soffit area is
// kept, with the guard off it shrinks.
const {chromium}=require('playwright'),fs=require('fs');
const SHOT='artifacts/coverage/';
(async()=>{
  const b=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
  const reports=[],errors=[];
  const open=async(kind)=>{
    const p=await b.newPage({viewport:{width:1440,height:1000}});
    p.on('pageerror',e=>errors.push(e.message));
    p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
    await p.goto('http://localhost:8769/overhang.html');
    if(kind==='quad')await p.selectOption('#grid','quad');
    await p.waitForFunction(k=>window.overhangReview?.api?.gridKind===k,kind,{polling:150,timeout:60000});
    await p.waitForFunction(()=>!!window.__overhangProbe,null,{polling:150,timeout:60000});
    // 片里没有任何 UI：给 iframe 内除画布外的浮层全关掉，截图量的是纯场景
    await p.evaluate(()=>{const d=document.querySelector('#scene').contentDocument;for(const el of d.body.children)if(el.tagName!=='CANVAS')el.style.display='none';});
    await p.waitForTimeout(500);
    // 冻帧（r145/r151 教训）：主场景自己 rAF 循环，setAnimationLoop(null) 管不到 → 换掉 v.render
    await p.evaluate(()=>{const v=window.overhangReview.api.view;v.__origRender??=v.render.bind(v);v.render=()=>{};v.__origRender(0)});
    await p.waitForTimeout(200);
    return p;
  };
  const refresh=async(p)=>{await p.evaluate(()=>window.overhangReview.api.view.__origRender(0));await p.waitForTimeout(150)};
  const shot=async(p)=>{await p.evaluate(()=>window.overhangReview.api.view.__origRender(0));await p.waitForTimeout(120);return (await (await p.$('#scene')).screenshot()).toString('base64')};
  const pixel=evaluatePixels;
  try{
    for(const kind of ['mixed','quad']){
      const p=await open(kind);
      const a=await p.evaluate(()=>window.__overhangProbe());
      if(a.topo.undersides!==1||a.topo.cavityColumns!==1||a.topo.unsupported!==0)throw Error(kind+' rock topology '+JSON.stringify(a.topo));
      if(a.overhang.soffits<1||a.overhang.coveredAir<3||a.overhang.reachableCoveredAir!==a.overhang.coveredAir)throw Error(kind+' overhang measure '+JSON.stringify(a.overhang));
      if(JSON.stringify(a.cavity.section)!==JSON.stringify(['RR','.R','.R','.R','RR']))throw Error(kind+' column section '+a.cavity.section);
      if(!(a.camera.y<a.eaveY-.5))throw Error(kind+' camera not below eave '+JSON.stringify(a.camera)+' eave '+a.eaveY);
      if(a.soffits.count<1||a.soffits.inFrame!==a.soffits.count||a.soffits.unoccluded!==a.soffits.count)throw Error(kind+' soffits not visible '+JSON.stringify(a.soffits));
      for(const g of a.cavity.band)if(g.lipSolid||!g.reachesPillar||!(g.clear>0))throw Error(kind+' slot blocked at level '+g.level+' '+JSON.stringify(g));
      const A=await shot(p);
      fs.writeFileSync(`${SHOT}overhang-soffit-${kind}-r152.png`,Buffer.from(A,'base64'));
      const A2=await shot(p);
      await p.check('#nocap');
      await refresh(p);
      const c=await p.evaluate(()=>window.__overhangProbe());
      if(c.soffits.count!==0||c.overhang.soffits!==0||c.topo.cavityColumns!==0)throw Error(kind+' cap still there '+JSON.stringify({s:c.soffits,o:c.overhang,t:c.topo}));
      const B=await shot(p);
      if(kind==='mixed')fs.writeFileSync(`${SHOT}overhang-soffit-nocap-r152.png`,Buffer.from(B,'base64'));
      const px=await pixel(p,{a:A,b:B,a2:A2,samples:a.soffits.samples});
      if(px.noise!==0)throw Error(kind+' same-state noise '+px.noise);
      if(px.diff<200)throw Error(kind+' cap A/B too small '+px.diff);
      if(!(px.underP10<px.behindP10-10))throw Error(kind+' darkest decile under the cap not darker than behind '+JSON.stringify(px));
      if(!(px.darkUnder>=.08&&px.darkUnder>px.darkBehind+.06))throw Error(kind+' no dark soffit band under the cap '+JSON.stringify(px));
      await p.uncheck('#nocap');
      await p.check('#skinny');
      await refresh(p);
      const guarded=await p.evaluate(()=>window.__overhangProbe());
      if(kind==='mixed')fs.writeFileSync(`${SHOT}overhang-soffit-skinny-guard-r152.png`,Buffer.from(await shot(p),'base64'));
      await p.uncheck('#guard');
      await refresh(p);
      const unguarded=await p.evaluate(()=>window.__overhangProbe());
      // 参照：不平滑（格状几何）时的朝下面面积 —— guard 开是否把平滑吃掉的那部分还回来
      await p.check('#guard');
      await p.uncheck('#smooth');
      await refresh(p);
      const flat=await p.evaluate(()=>window.__overhangProbe());
      if(kind==='mixed')fs.writeFileSync(`${SHOT}overhang-soffit-skinny-unguard-r152.png`,Buffer.from(await shot(p),'base64'));
      reports.push({kind,topo:a.topo,overhang:a.overhang,camera:a.camera,eaveY:a.eaveY,soffits:a.soffits,cavity:a.cavity.band,section:a.cavity.section,pixels:px,capOff:{triangles:c.soffits.count,measure:c.overhang.soffits,columns:c.topo.cavityColumns},thin:{guardedArea:guarded.soffits.area,unguardedArea:unguarded.soffits.area,flatArea:flat.soffits.area,guardedTris:guarded.soffits.count,unguardedTris:unguarded.soffits.count,flatTris:flat.soffits.count}});
      await p.close();
    }
    if(errors.length)throw Error(errors.join('\n'));
    fs.writeFileSync('artifacts/coverage/overhang-soffit-browser.json',JSON.stringify({reports,errors},null,2));
    console.log('PASS overhang soffit visible + slot see-through + cap A/B + thin-lip guard',JSON.stringify(reports.map(r=>({kind:r.kind,tris:r.soffits.count,area:r.soffits.area,inFrame:r.soffits.inFrame,underP10:r.pixels.underP10,behindP10:r.pixels.behindP10,underP50:r.pixels.underP50,darkUnder:r.pixels.darkUnder,darkBehind:r.pixels.darkBehind,diff:r.pixels.diff,noise:r.pixels.noise,thin:r.thin}))));
  }finally{await b.close()}
})().catch(e=>{console.error(e);process.exit(1)});

// 檐下带 = 朝下面样本在屏幕上的包围盒；像素统计全在页面内做（整幅 ImageData 不过 CDP）
async function evaluatePixels(p,{a,b,a2,samples}){
  return p.evaluate(async({a,b,a2,ndc})=>{
    const dec=async s=>{const r=await fetch('data:image/png;base64,'+s);return createImageBitmap(await r.blob())};
    const [ia,ib,i2]=await Promise.all([dec(a),dec(b),dec(a2)]);
    const W=ia.width,H=ia.height,cv=new OffscreenCanvas(W,H),cx=cv.getContext('2d',{willReadFrequently:true});
    const grab=async bmp=>{cx.clearRect(0,0,W,H);cx.drawImage(bmp,0,0);return cx.getImageData(0,0,W,H).data};
    const da=await grab(ia),db=await grab(ib),d2=await grab(i2);
    const lum=(d,i)=>(d[i]*.2126+d[i+1]*.7152+d[i+2]*.0722);
    let diff=0,noise=0;
    for(let i=0;i<da.length;i+=4){if(Math.abs(da[i]-db[i])+Math.abs(da[i+1]-db[i+1])+Math.abs(da[i+2]-db[i+2])>12)diff++;
      if(Math.abs(da[i]-d2[i])+Math.abs(da[i+1]-d2[i+1])+Math.abs(da[i+2]-d2[i+2])>12)noise++;}
    const xs=ndc.map(n=>(n[0]+1)/2*W),ys=ndc.map(n=>(1-n[1])/2*H);
    // 朝下面自己的投影框（不算「框下」，那一片在仰视时落到帽檐前壁上）
    const x0=Math.max(0,Math.round(Math.min(...xs))-3),x1=Math.min(W-1,Math.round(Math.max(...xs))+3);
    const y0=Math.max(0,Math.round(Math.min(...ys))-3),y1=Math.min(H-1,Math.round(Math.max(...ys))+3);
    const la=[],lb=[];let umax=0,umin=255;
    for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){const i=(y*W+x)*4;const a=lum(da,i),b=lum(db,i);la.push(a);lb.push(b);umax=Math.max(umax,a);umin=Math.min(umin,a);}
    const pct=(arr,q)=>{const s=[...arr].sort((x,y)=>x-y);return +s[Math.min(s.length-1,Math.floor(q*s.length))].toFixed(2)};
    const mean=a=>+(a.reduce((s,v)=>s+v,0)/a.length).toFixed(2);
    const dark=a=>+(a.filter(v=>v<95).length/a.length).toFixed(3);
    return {W,H,diff,noise,box:[x0,x1,y0,y1],under:mean(la),behind:mean(lb),underP10:pct(la,.1),behindP10:pct(lb,.1),
      underP50:pct(la,.5),behindP50:pct(lb,.5),underMin:+umin.toFixed(1),underMax:+umax.toFixed(1),
      darkUnder:dark(la),darkBehind:dark(lb),px:la.length};
  },{a,b,a2,ndc:samples.map(s=>s.ndc)});
}
