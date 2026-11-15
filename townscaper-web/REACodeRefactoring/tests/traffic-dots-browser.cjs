// 886199305522085890 "Dotted lines to mark narrow passages" — the markers must be
// readable, not just present. Reference dots are near-opaque white on the terrain;
// the first reimplementation emitted cream 4.5px dots whose median contrast was
// 15/255 (only 42% of them cleared +20 over their own surroundings), i.e. invisible
// in game. This test measures real rendered pixels at each projected dot centre.
const{chromium}=require('playwright');const fs=require('fs');const path=require('path');const zlib=require('zlib');

function decodePng(buf){
  let p=8,w=0,h=0,ch=0,idat=[];
  while(p<buf.length){const len=buf.readUInt32BE(p);const type=buf.toString('ascii',p+4,p+8);const data=buf.subarray(p+8,p+8+len);
    if(type==='IHDR'){w=data.readUInt32BE(0);h=data.readUInt32BE(4);if(data[8]!==8)throw Error('expect 8-bit');
      ch=data[9]===6?4:(data[9]===2?3:0);if(!ch)throw Error('unsupported color type '+data[9]);}
    else if(type==='IDAT')idat.push(data);else if(type==='IEND')break;
    p+=12+len;}
  const raw=zlib.inflateSync(Buffer.concat(idat));const bpp=ch,stride=w*bpp,out=Buffer.alloc(h*stride);
  for(let y=0;y<h;y++){const f=raw[y*(stride+1)];const line=raw.subarray(y*(stride+1)+1,y*(stride+1)+1+stride);const cur=out.subarray(y*stride,y*stride+stride);
    for(let x=0;x<stride;x++){const a=x>=bpp?cur[x-bpp]:0,b=y?out[(y-1)*stride+x]:0,c=(x>=bpp&&y)?out[(y-1)*stride+x-bpp]:0;let v=line[x];
      if(f===1)v+=a;else if(f===2)v+=b;else if(f===3)v+=(a+b)>>1;else if(f===4){const pp=a+b-c,pa=Math.abs(pp-a),pb=Math.abs(pp-b),pc=Math.abs(pp-c);v+=(pa<=pb&&pa<=pc)?a:(pb<=pc?b:c);}
      cur[x]=v&255;}}
  return {w,h,ch,data:out};
}
const lum=(im,x,y)=>{const i=(y*im.w+x)*im.ch;return .299*im.data[i]+.587*im.data[i+1]+.114*im.data[i+2];};

(async()=>{
const b=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true,args:['--enable-unsafe-swiftshader','--use-gl=angle','--use-angle=swiftshader']});
const p=await b.newPage({viewport:{width:1440,height:1000}});
const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
const r=path.resolve(__dirname,'../artifacts/coverage')+path.sep;
await p.goto((process.env.REA_TEST_URL||'http://localhost:8769')+'/index.html?scene=badnorth');
await p.waitForFunction(()=>window.rea?.battle?.running&&rea.battle.passageStats?.dots>0,{timeout:60000});
await p.waitForTimeout(1500);
const geo=await p.evaluate(async()=>{
  const THREE=await import('three');const dots=rea.battle.passageDots;dots.updateMatrixWorld(true);
  const cam=rea.view.camera;cam.updateMatrixWorld(true);
  const arr=dots.geometry.getAttribute('position').array;const v=new THREE.Vector3();const pts=[];
  for(let i=0;i<arr.length;i+=3){v.set(arr[i],arr[i+1],arr[i+2]).applyMatrix4(dots.matrixWorld);v.project(cam);
    if(v.z>1)continue;pts.push([Math.round((v.x*.5+.5)*1440),Math.round((-v.y*.5+.5)*1000)]);}
  const m=dots.material;
  return {pts,color:m.color.getHexString(),size:m.size,alphaTest:m.alphaTest,toneMapped:m.toneMapped,stats:rea.battle.passageStats};
});
const shot=r+'traffic-dots-on.png';await p.screenshot({path:shot});
await p.evaluate(()=>rea.view.setDebug('passages',false));
if(await p.evaluate(()=>rea.battle.passageDots.visible))throw Error('passages toggle off failed');
await p.evaluate(()=>rea.view.setDebug('passages',true));
if(!await p.evaluate(()=>rea.battle.passageDots.visible))throw Error('passages toggle on failed');
const im=decodePng(fs.readFileSync(shot));
const deltas=[],peaks=[];
for(const [x,y] of geo.pts){
  if(x<14||y<14||x>=im.w-14||y>=im.h-14)continue;
  let c=0;for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++)c=Math.max(c,lum(im,x+dx,y+dy));
  const ring=[];
  for(let dy=-13;dy<=-8;dy++)for(let dx=-13;dx<=13;dx++)ring.push(lum(im,x+dx,y+dy));
  for(let dy=8;dy<=13;dy++)for(let dx=-13;dx<=13;dx++)ring.push(lum(im,x+dx,y+dy));
  for(const dy of [-7,0,7])for(const dx of [-13,-12,-11,11,12,13])ring.push(lum(im,x+dx,y+dy));
  ring.sort((a,b)=>a-b);peaks.push(c);deltas.push(c-ring[ring.length>>1]);
}
deltas.sort((a,b)=>a-b);
const median=deltas[deltas.length>>1], readable=deltas.filter(d=>d>20).length, white=peaks.filter(v=>v>=215).length;
// The composer's final tone-mapping pass caps every white at ~226, so "renders white" means
// hitting that ceiling; 240+ is unreachable anywhere in this pipeline.
const peakMedian=peaks.slice().sort((a,b)=>a-b)[peaks.length>>1];
const out={color:geo.color,size:geo.size,alphaTest:geo.alphaTest,toneMapped:geo.toneMapped,dots:geo.stats.dots,segments:geo.stats.segments,
  measured:deltas.length,medianContrast:+median.toFixed(1),readableShare:+(readable/deltas.length).toFixed(3),
  whiteShare:+(white/deltas.length).toFixed(3),peakMedian:+peakMedian.toFixed(1),errors};
// 886199305522085890：原片点距 ≈ 2.2 倍点径（点是一颗颗分开的），不是连成珠子。
// 直接按「同一段路上相邻点的投影间距」量：段长投影 / 该段点数；最近邻会被并行/交汇的另一段污染。
const pitch=await p.evaluate(async()=>{
  const {passageMarkers}=await import('/src/world/traffic.js'),{buildNav}=await import('/src/world/navgraph.js');
  const T=await import('three');const b=rea.battle,nav=buildNav(b.world);
  const m=passageMarkers(b.world,nav,{levelHeight:b.L});const cam=rea.view.camera;cam.updateMatrixWorld(true);
  const pr=(x,y,z)=>new T.Vector3(x,y,z).project(cam);
  const out=[];
  for(const s of m.segments){const A=b.world.cells.find(c=>c.id===s.a),B=b.world.cells.find(c=>c.id===s.b);if(!A||!B||s.count<2)continue;
    const pa=pr(A.cx,(nav.hgt[A.id]??0)*b.L+.035,A.cz),pb=pr(B.cx,(nav.hgt[B.id]??0)*b.L+.035,B.cz);
    if(pa.z>1||pb.z>1)continue;
    const px=Math.hypot((pa.x-pb.x)*.5*innerWidth,(-pa.y+pb.y)*.5*innerHeight);
    out.push(px/s.count);}
  return out;});
pitch.sort((a,b)=>a-b);const spacingPx=pitch.length?pitch[pitch.length>>1]:0, ratio=spacingPx/geo.size;
out.segPitchSamples=pitch.length;out.spacingPx=+spacingPx.toFixed(2);out.spacingRatio=+ratio.toFixed(2);
out.pitchMin=+(pitch[0]??0).toFixed(2);out.pitchMax=+(pitch[pitch.length-1]??0).toFixed(2);
fs.writeFileSync(r+'traffic-dots-check.json',JSON.stringify(out,null,2));
await b.close();
if(errors.length)throw Error(errors.join('\n'));
if(geo.color!=='ffffff')throw Error('markers must be pure white, got #'+geo.color);
if(!(geo.size>=7))throw Error('marker size too small: '+geo.size);
// 第 54 轮：spacing 0.265→0.28 把点距/点径从 2.08 调到原片的 2.2，同图点数随之 182→173。
// 点数下限跟着放到 165（仍然远多于「每段只有 1 个点」），但比例必须收在原片口径里。
if(!(geo.stats.dots>=165))throw Error('too few markers: '+geo.stats.dots);
if(!(ratio>=2.0&&ratio<=2.6))throw Error('dot pitch/diameter ratio off reference 2.2: '+ratio.toFixed(2));
if(geo.toneMapped!==false)throw Error('markers should bypass tone mapping');
if(!(median>=35))throw Error('markers not readable, median contrast '+median);
if(!(readable/deltas.length>=0.65))throw Error('only '+(readable/deltas.length*100).toFixed(1)+'% of markers clear +20 contrast');
console.log('PASS passage dots readable',JSON.stringify(out));
})().catch(e=>{console.error(e);process.exit(1)});
