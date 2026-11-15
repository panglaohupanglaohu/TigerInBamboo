/** 1120036868966502401: diagnostic isolines, not the deformed foam shoreline.
 *  第 46 轮：原片主体是「格集合 → 沿格边的区域边界」（红色、只走格边、闭环 / 开放端 / 捏点），
 *  marching squares 等值线（橙）只是子问题。这里同屏再画一层：每个高度层 h，集合 = top ≥ h 的格，
 *  边界段画在 h × levelHeight 高度（core/region-boundary.js）。
 *  第 53 轮（原尺寸复核 frame-0210 / frame-0300 的放大裁切）：
 *   · 网格线框是白色 **1px**（硬件 gl.LINES，本文件的两层本来就是 LineSegments，宽度天然 1px）；
 *   · 选中的那一格是**粗 ~3px 的金黄闭合折线**，套在格边外侧、粗细不随远近变（屏幕空间定宽），
 *     格子内部只有很淡的填充；
 *   · 格角上有小白点；右上方还有一个 **RGB 三轴移动 gizmo**（红/绿/蓝箭头 + 两个半透明方块手柄），
 *     它的大小也是屏幕空间恒定的（离得越远世界尺寸越大）。
 *  这里补「定宽金黄选中折线」与「屏幕恒定 gizmo」两件，原先只有一层半透明填充。 */
import * as THREE from 'three';
import {marchGrid} from '../core/contour.js';
import {regionBoundary,cellOutline} from '../core/region-boundary.js';
import {regionComponentIds} from '../core/region-ids.js';

/** 定宽折线：把折线在 xz 平面法向外扩 side×uWidth 像素。uPixScale 由 renderer 每帧给（2·tan(fov/2)/画布高）。 */
const THICK_VERT = `
attribute float aSide; attribute vec3 aPosA; attribute vec3 aPosB;
uniform float uWidth; uniform float uHalfPx; uniform float uAspect;
void main(){
  vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 ca = projectionMatrix * modelViewMatrix * vec4(aPosA, 1.0);
  vec4 cb = projectionMatrix * modelViewMatrix * vec4(aPosB, 1.0);
  vec2 sa = ca.xy / max(1e-5, ca.w), sb = cb.xy / max(1e-5, cb.w);
  vec2 d = (sb - sa) * vec2(uAspect, 1.0);
  if (length(d) < 1e-6) { d = vec2(1.0, 0.0); }
  d = normalize(d);
  vec2 nrm = vec2(-d.y, d.x) / vec2(uAspect, 1.0);   // 屏幕空间法向（像素均匀）
  c.xy += nrm * aSide * uWidth * uHalfPx * c.w;       // uHalfPx = 2/画布高 → 定像素宽
  gl_Position = c;
}`;
const THICK_FRAG = `uniform vec3 uColor; uniform float uOpacity; void main(){ gl_FragColor = vec4(uColor, uOpacity); }`;
/** 第 67 轮：区域边界也是「屏幕定宽」——原片 460 宽的片子里红线横截面中位 2px（p75 5px 是斜线走的台阶），
 *  本仓 LineBasicMaterial 恒 1 设备像素，投影到 1440 宽只有 0.3% 视宽（原片 0.43%）→ 读起来细一圈。
 *  复用上面那套屏幕法向外扩，但颜色逐顶点来自 aColor（每条边界段按区域 id 上色）。 */
export const THICK_COLOR_VERT = `
attribute float aSide; attribute vec3 aPosA; attribute vec3 aPosB; attribute vec3 aColor;
uniform float uWidth; uniform float uHalfPx; uniform float uAspect;
varying vec3 vColor;
void main(){
  vColor = aColor;
  vec4 c = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  vec4 ca = projectionMatrix * modelViewMatrix * vec4(aPosA, 1.0);
  vec4 cb = projectionMatrix * modelViewMatrix * vec4(aPosB, 1.0);
  vec2 sa = ca.xy / max(1e-5, ca.w), sb = cb.xy / max(1e-5, cb.w);
  vec2 d = (sb - sa) * vec2(uAspect, 1.0);
  if (length(d) < 1e-6) { d = vec2(1.0, 0.0); }
  d = normalize(d);
  vec2 nrm = vec2(-d.y, d.x) / vec2(uAspect, 1.0);
  c.xy += nrm * aSide * uWidth * uHalfPx * c.w;
  gl_Position = c;
}`;
export const THICK_COLOR_FRAG = `uniform float uOpacity; varying vec3 vColor; void main(){ gl_FragColor = vec4(vColor, uOpacity); }`;

/** 格角方块贴图（第 66 轮）：16×16，1px 亮边 + 深芯。原片 4× 放大复核 frame-0120（浅灰地面）与 frame-0080（深色岛体）
 *  都是「小方块、深色芯、一圈亮边」，不是纯白圆点。用 NearestFilter 保证缩小后仍是硬边方块。
 *  第 76 轮：`tests/contour-regions.mjs` 自第 66 轮起在 Node 下挂掉（`document is not defined`），
 *  因为这一行无条件建 canvas。这里改成「有 DOM 就走 canvas，没有就用同图案的 DataTexture」——
 *  像素排列完全一致（外圈 #f2f7f4 / 内芯 #1b2320），浏览器里的观感不变，纯 node 测试也能实例化。
 *  `cornerTextureSource` 记录走了哪条路，测试用它断言降级分支真的被走过。 */
function cornerSquarePixels(){
  const S=16,data=new Uint8Array(S*S*4),rim=[0xf2,0xf7,0xf4],core=[0x1b,0x23,0x20];
  for(let y=0;y<S;y++)for(let x=0;x<S;x++){
    const inner=x>=2&&x<S-2&&y>=2&&y<S-2,c=inner?core:rim,o=(y*S+x)*4;
    data[o]=c[0];data[o+1]=c[1];data[o+2]=c[2];data[o+3]=255;
  }
  return {S,data};
}
export function makeCornerSquare(){
  const S=16,src=cornerSquarePixels();
  let t;
  if(typeof document!=='undefined'&&document.createElement){
    const c=document.createElement('canvas');c.width=c.height=S;
    const g=c.getContext('2d');g.clearRect(0,0,S,S);
    g.fillStyle='#f2f7f4';g.fillRect(0,0,S,S);
    g.fillStyle='#1b2320';g.fillRect(2,2,S-4,S-4);
    t=new THREE.CanvasTexture(c);
    t.userData={source:'canvas'};
  }else{
    t=new THREE.DataTexture(src.data,S,S,THREE.RGBAFormat);
    t.needsUpdate=true;
    t.userData={source:'data'};
  }
  t.magFilter=THREE.NearestFilter;t.minFilter=THREE.NearestFilter;t.generateMipmaps=false;
  if(THREE.SRGBColorSpace)t.colorSpace=THREE.SRGBColorSpace;
  return t;
}

export class ContourOverlay{
  constructor(world,{levelHeight=0}={}){this.world=world;this.levelHeight=levelHeight;this.version=-1;this.mesh=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#ffbe58',depthTest:false,transparent:true,opacity:.9}));this.mesh.visible=false;this.mesh.renderOrder=8;this.mesh.frustumCulled=false;
    // 第 60 轮：原片同屏有红 / 粉 / 紫 / 蓝多色区域边界（每层一个颜色），原先全仓单一 #e0473c。
    // 第 83 轮：色板按 frame-0300 / frame-0260 的线段芯中位色标定（不是目测）：
    //   红 #da4728(218,71,40) / 蓝 #2e4ba7(46,75,167) / 黄 #dcdf66(220,223,102)。
    //   旧板把蓝写成 #3f6fd8(63,111,216)（亮 1.3×），且**完全没有黄**——而 frame-0300 里同一高度层
    //   并排躺着黄、蓝两块 patch，说明颜色是「按 patch id」而不是「按高度层」，黄必须进板。
    // 第 85 轮（缺口 ②）：后 4 档降级为「本仓扩展档」—— 第 84 轮用 tools/region-palette-scan.py 全片扫细线，
    //   紫 649px / 青 85px / 粉 6398px 全是蓝线 JPEG 色度振铃与 gizmo 红轴的抗锯齿边，红 26 万 / 蓝 74 万 /
    //   黄 14 万 / 黄绿 11 万（黄绿是植被，不是线）。**原片只有红蓝黄三色**，后 4 档没有原片依据，
    //   留着只是为了让 regionComponentIds 在区域数 >3 时有色可分（区域一多必撞色，也绝不能循环回红蓝黄）。
    this.regionPalette=['#da4728','#2e4ba7','#dcdf66',
      '#e8629f','#a35fd8','#f0902e','#2fae8f'];   // 以上后 4 项 = 本仓扩展档（无原片对应，勿当标定值）
    this.regions=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({vertexColors:true,depthTest:false,transparent:true,opacity:.95}));this.regions.renderOrder=9;this.regions.frustumCulled=false;this.mesh.add(this.regions);this.regionStats=null;
    // 第 67 轮：定宽 2px 的区域边界（uWidth=1 时四边形总宽 2px），1px 线保留在中间当硬芯。
    this.regionWidth=1;   // 半宽，单位 px → 总宽 2×regionWidth
    this.regionThickMat=new THREE.ShaderMaterial({uniforms:{uWidth:{value:this.regionWidth},uHalfPx:{value:.0016},uAspect:{value:1.6},uOpacity:{value:.95}},vertexShader:THICK_COLOR_VERT,fragmentShader:THICK_COLOR_FRAG,transparent:true,depthTest:false,side:THREE.DoubleSide});
    this.regionsThick=new THREE.Mesh(new THREE.BufferGeometry(),this.regionThickMat);this.regionsThick.renderOrder=9;this.regionsThick.frustumCulled=false;this.regionsThick.visible=false;this.mesh.add(this.regionsThick);
    // 候选格黑白棋盘（原片 frame-0160…0170 / 0470…0480）：相邻候选格交替纯白 / 近黑，整格铺满。
    this.candidates=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({vertexColors:true,depthTest:false,transparent:true,opacity:.92,side:THREE.DoubleSide}));this.candidates.renderOrder=10;this.candidates.frustumCulled=false;this.candidates.visible=false;this.mesh.add(this.candidates);this.candidateStats=null;
    // 第 59 轮：注释里一直写着「格角上有小白点」但从来没实现过。片中还有一批「格心彩色点」，
    // 颜色按高度层分档（多数是黄，少数红/绿/蓝），同层同色因而沿等高线排成一条一条 → 就是片里那些「黄色竖列」。
    // 第 66 轮：原片格角不是白点，而是**小方块**——浅色地面上读作深色方块、深色岛体上读作带亮边的方块。
    // 用 16×16 画布贴图（深底 + 1px 亮边）做点精灵：PointsMaterial 默认画方形，带 map 后四角透明 → 仍是方块，
    // 两种底色下都能同时看到「深芯 + 亮边」。size 3→7（原片按 640 宽折算约 6–8px）。
    this.dotSize={corner:7,cell:5};
    this.cornerTex=makeCornerSquare();
    this.cornerTextureSource=this.cornerTex.userData?.source||'unknown';
    this.corners=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({map:this.cornerTex,color:'#ffffff',size:this.dotSize.corner,sizeAttenuation:false,depthTest:false,transparent:true,alphaTest:.35,opacity:1,toneMapped:false}));
    this.corners.renderOrder=13;this.corners.frustumCulled=false;this.mesh.add(this.corners);
    this.dots=new THREE.Points(new THREE.BufferGeometry(),new THREE.PointsMaterial({vertexColors:true,size:this.dotSize.cell,sizeAttenuation:false,depthTest:false,transparent:true,opacity:.95}));
    this.dots.renderOrder=13;this.dots.frustumCulled=false;this.mesh.add(this.dots);
    this.dotStats=null;this.dotsOn=true;
    this.outlineWidth=3.5;this.pixScale=.0016;this.outlineMat=new THREE.ShaderMaterial({uniforms:{uWidth:{value:this.outlineWidth},uHalfPx:{value:this.pixScale},uAspect:{value:1.6},uColor:{value:new THREE.Color('#ffc21a')},uOpacity:{value:1}},vertexShader:THICK_VERT,fragmentShader:THICK_FRAG,transparent:true,depthTest:false,side:THREE.DoubleSide});
    this.depthOccluded=false;   // 第 74 轮：见 setDepthOcclusion()
    this.gizmo=this.#buildGizmo();this.mesh.add(this.gizmo);}
  refresh(){if(!this.mesh.visible||this.version===this.world.version)return;this.result=marchGrid(this.world.cells,c=>this.world.isLand(c)?1:0);const arr=this.result.levels[0].segs.flatMap(s=>[s[0],.035,s[1],s[2],.035,s[3]]);this.mesh.geometry.dispose();this.mesh.geometry=new THREE.BufferGeometry();this.mesh.geometry.setAttribute('position',new THREE.Float32BufferAttribute(arr,3));
    const cells=this.world.cells,top=c=>this.world.top?this.world.top(c):(this.world.isLand(c)?1:0),maxH=Math.max(0,...cells.map(top)),reg=[],regCol=[],stats=[];
    const pal=this.regionPalette.map(h=>new THREE.Color(h));
    // 第 64 轮：颜色从「按高度层循环」改成「按跨层连通分量的区域 id」（core/region-ids.js）。
    // 同一条台地长高时颜色不变，只有分裂/合并才换色 —— 原片 frame-0210 的观感。
    const rc=regionComponentIds(cells,top,{maxH,paletteSize:pal.length});
    this.regionIds=rc;
    for(let h=1;h<=maxH;h++){const r=regionBoundary(cells,c=>top(c)>=h),y=(this.levelHeight?h*this.levelHeight:0)+.04;
      const layer=rc.layers[h-1],colorOf=layer?layer.colorOf:new Map(),perRegion=new Map();
      for(const s of r.segments){const a=r.point(s.a),b=r.point(s.b);
        const ci=colorOf.get(s.cell)??0;const col=pal[ci];const id=layer?.ids.get(s.cell)??0;
        perRegion.set(id,(perRegion.get(id)||0)+1);
        reg.push(a.x,y,a.z,b.x,y,b.z);regCol.push(col.r,col.g,col.b,col.r,col.g,col.b);}
      const top1=[...perRegion.entries()].sort((x,y2)=>y2[1]-x[1]||x[0]-y2[0])[0];
      stats.push({h,segments:r.segments.length,loops:r.loops.length,open:r.open.length,branch:r.branch.length,
        regions:[...perRegion.entries()].map(([id,segments])=>({id,segments,color:this.regionPalette[(id-1)%pal.length]})).sort((x,y2)=>x.id-y2.id),
        color:top1?this.regionPalette[(top1[0]-1)%pal.length]:this.regionPalette[0]});}
    this.regions.geometry.dispose();this.regions.geometry=new THREE.BufferGeometry();
    this.regions.geometry.setAttribute('position',new THREE.Float32BufferAttribute(reg,3));
    this.regions.geometry.setAttribute('color',new THREE.Float32BufferAttribute(regCol,3));
    this.#buildRegionQuads(reg,regCol);
    this.regionStats=stats;
    this.#fillDots(cells,top);
    this.version=this.world.version;}
  /** 边界段（每段 6 个数 = 两端点）→ 每段一个四边形（4 顶点 + 2 三角），带屏幕法向外扩方向 aSide 与逐顶点色。
   *  段数 = reg.length/6；顶点数 = 4×段数；索引数 = 6×段数。 */
  #buildRegionQuads(reg,regCol){
    const segs=reg.length/6, pos=[],side=[],pa=[],pb=[],col=[];
    for(let i=0;i<segs;i++){
      const o=i*6, ax=reg[o],ay=reg[o+1],az=reg[o+2], bx=reg[o+3],by=reg[o+4],bz=reg[o+5];
      const cr=regCol[o],cg=regCol[o+1],cb=regCol[o+2];
      for(const [px,py,pz,sgn]of[[ax,ay,az,-1],[ax,ay,az,1],[bx,by,bz,1],[bx,by,bz,-1]]){
        pos.push(px,py,pz);side.push(sgn);pa.push(ax,ay,az);pb.push(bx,by,bz);col.push(cr,cg,cb);
      }
    }
    const idx=new Uint32Array(segs*6);
    for(let q=0,i=0;q<segs*4;q+=4,i+=6){idx[i]=q;idx[i+1]=q+1;idx[i+2]=q+2;idx[i+3]=q;idx[i+4]=q+2;idx[i+5]=q+3;}
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('aSide',new THREE.Float32BufferAttribute(side,1));
    g.setAttribute('aPosA',new THREE.Float32BufferAttribute(pa,3));
    g.setAttribute('aPosB',new THREE.Float32BufferAttribute(pb,3));
    g.setAttribute('aColor',new THREE.Float32BufferAttribute(col,3));
    g.setIndex(new THREE.BufferAttribute(idx,1));
    g.userData={quads:segs};
    this.regionsThick.geometry.dispose();
    this.regionsThick.geometry=g;
    this.regionsThick.visible=segs>0;
    return {quads:segs,vertices:pos.length/3};
  }
  /** 区域边界半宽（px）：总宽 = 2×px。原片 460 宽实测 2px。 */
  setRegionWidth(px){if(!(px>0&&px<8))throw new RangeError('invalid region width');this.regionWidth=px;this.regionThickMat.uniforms.uWidth.value=px;return px*2;}

  /** 格角白点 + 格心彩色点（第 59 轮）。角点按 (x,y,z) 去重（相邻格共角只留一个）；
   *  格心色按**低频空间分块**取（2.2 单位一块），同块同色 → 相邻格连成一片、沿块界排成一条条「同色成列」，
   *  黄占多数、红/绿/蓝/紫只是零星几块，和片子里「一片黄里夹几条彩色串」的观感一致。
   *  最初试过按高度层分档，但这个场景多数格在高层，紫反而成了主色（实测 0.131 黄 / 紫最多），已改掉。 */
  #fillDots(cells,topAt){
    const cp=[],cc=[],col=[],seen=new Set();
    const hex=['#ffd21a','#e0473c','#5fbf4a','#3f6fd8','#c05fe0'];
    const pal=hex.map(h=>new THREE.Color(h)),counts=new Array(hex.length).fill(0);
    // 坑：早先把黄写成两个槽（0 和 1）再把 counts 收进以 hex 为键的对象，同色键互相覆盖 → 黄的计数被清成 0，
    // 判据误报「黄不是主色」。这里五色各不相同，一槽一色。
    const bucket=(x,z)=>{
      const q=Math.floor(x/2.2)*7.13+Math.floor(z/2.2)*3.71;
      const u=Math.abs(Math.sin(q)*43758.5453)%1;
      return u<0.66?0:u<0.78?1:u<0.88?2:u<0.95?3:4;
    };
    for(const c of cells){
      const h=topAt(c),y=(this.levelHeight?h*this.levelHeight:0)+.05,pts=cellOutline(c);
      if(!pts||pts.length<3)continue;
      for(const p of pts){
        const k=p[0].toFixed(3)+'|'+y.toFixed(3)+'|'+p[1].toFixed(3);
        if(seen.has(k))continue;seen.add(k);cp.push(p[0],y,p[1]);
      }
      const cx=pts.reduce((s,p)=>s+p[0],0)/pts.length,cz=pts.reduce((s,p)=>s+p[1],0)/pts.length;
      const bi=bucket(cx,cz);counts[bi]+=1;
      cc.push(cx,y,cz);const t=pal[bi];col.push(t.r,t.g,t.b);
    }
    const put=(pts,attrs)=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));for(const [n,a,s] of attrs)g.setAttribute(n,new THREE.Float32BufferAttribute(a,s));return g;};
    this.corners.geometry.dispose();this.corners.geometry=put(cp,[]);
    this.dots.geometry.dispose();this.dots.geometry=put(cc,[['color',col,3]]);
    this.corners.visible=this.dots.visible=this.dotsOn;
    this.dotStats={corners:cp.length/3,cells:cc.length/3,colors:Object.fromEntries(hex.map((h,i)=>[h,counts[i]])),on:this.dotsOn};
  }
  /** 调试层是否吃遮挡（第 74 轮）。
   *  原片证据：frame-0445 的彩色分行只画在地台浅色平面上，一跨到深色岛体就断；
   *  frame-0470 的白格线遇方块即停、方块顶面上没有白线；frame-0260 的红边界被块切断。
   *  → 原片的这些层是**走深度缓冲**的，而本仓 mesh / regions / regionThickMat / candidates
   *  / dots / corners / outlineMat 全部 `depthTest:false`，会透穿一切几何。
   *  这里给一个总开关：默认关（保持历史行为，不破已有像素断言），页面按原片口径显式打开。
   *  返回当前状态。 */
  setDepthOcclusion(on = true) {
    this.depthOccluded = !!on;
    const d = this.depthOccluded;
    const mats = [this.mesh?.material, this.regions?.material, this.regionThickMat,
      this.candidates?.material, this.dots?.material, this.corners?.material,
      this.outlineMat, this.selected?.material];
    for (const m of mats) { if (!m) continue; m.depthTest = d; m.needsUpdate = true; }
    this.occlusionLayers = mats.filter(Boolean).length;
    this.depthStats = { occluded: d, layers: this.occlusionLayers };
    return this.depthOccluded;
  }
  /** 候选格黑白棋盘（第 60 轮）：原片切到 WFC 候选阶段时，候选格整格铺成黑白相间的棋盘。
   *  第 64 轮：黑白不再按「格所在低频块的行列奇偶」，改成读 **wfc.js 的逐格 domain 大小**
   *  （`solveWFC(...,{traceLimit})` 每帧快照里的 `domains`）：domain 还有多个候选的格才算候选格，
   *  奇偶由 domain 大小决定 → 棋盘直接编码「这格还剩几个可能」，收缩过程会在画面上逐格翻色。
   *  没给 domains 时退回按域大小未知的空间奇偶（旧观感，回归用）。 */
  setCandidates(list,{domains=null}={}){
    if(list==null){this.candidates.visible=false;this.candidateStats={cells:0,white:0,black:0,on:false};return this.candidateStats;}
    const pos=[],col=[];
    const white=new THREE.Color('#f2f4f2'),black=new THREE.Color('#14181a');
    const sizeOf=(cell)=>{if(!domains)return null;const v=typeof domains.get==='function'?domains.get(cell.id):domains[cell.id];return Number.isFinite(v)?v:(Array.isArray(v)?v.length:null);};
    let w=0,b=0,drop=0;const hist=new Map();
    for(const cell of list){
      const ds=sizeOf(cell);
      // domain 已收敛到 1 个（或空）的格不再是候选格：原片里定下来的格是不铺填充的
      if(ds!=null&&ds<2){drop++;continue;}
      const pts=cellOutline(cell); if(!pts||pts.length<3)continue;
      const cx=pts.reduce((s,p)=>s+p[0],0)/pts.length,cz=pts.reduce((s,p)=>s+p[1],0)/pts.length;
      const parity=ds!=null?(ds&1):((Math.floor(cx/1.4)+Math.floor(cz/1.4))&1);
      if(ds!=null)hist.set(ds,(hist.get(ds)||0)+1);
      const t=parity?white:black; parity?w++:b++;
      const h=this.world.top?this.world.top(cell):0, y=(this.levelHeight?h*this.levelHeight:0)+.055;
      for(let i=1;i<pts.length-1;i++)pos.push(pts[0][0],y,pts[0][1],pts[i][0],y,pts[i][1],pts[i+1][0],y,pts[i+1][1]);
      const n=(pts.length-2)*3;
      for(let i=0;i<n;i++)col.push(t.r,t.g,t.b);
    }
    this.candidates.geometry.dispose();
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('color',new THREE.Float32BufferAttribute(col,3));
    this.candidates.geometry=g;
    this.candidates.visible=true;
    this.candidateStats={cells:list.length,white:w,black:b,on:true,mode:domains?'domain':'spatial',converged:drop,
      domainSizes:domains?[...hist.entries()].sort((a,b2)=>a[0]-b2[0]).map(([size,count])=>({size,count})):null};
    return this.candidateStats;
  }

  /** 第 72 轮：候选棋盘**上到建筑层**。
   *  原片 frame-0162…0169 与 0540…0550 的黑白格不只铺在地面，屋顶体块的顶面上也各铺一块（同一格的不同层
   *  是两块独立的棋盘格，各自一层高度）。`setCandidates` 只会按 `world.top(cell)` 铺地面层，所以这里另开一条
   *  入口：调用方直接给每块的层高 `y`（= (ground+level-1)·levelHeight）与 domain 大小，其余口径（ds<2 剔除、
   *  奇偶定黑白、整格按三角填充）与 `setCandidates` 完全一致，避免出现两套判色规则。 */
  setCandidatesLayered(entries) {
    const white = new THREE.Color('#f2f4f2'), black = new THREE.Color('#14181a');
    if (!entries || !entries.length) {
      this.candidates.visible = false;
      this.candidateStats = { cells: 0, white: 0, black: 0, on: false, layered: true, levels: 0, ground: 0, roof: 0 };
      return this.candidateStats;
    }
    const pos = [], col = [], levels = new Set();
    let w = 0, b = 0, drop = 0, groundN = 0, roofN = 0;
    const hist = new Map();
    for (const e of entries) {
      const ds = e.domain;
      if (ds != null && ds < 2) { drop++; continue; }
      const pts = cellOutline(e.cell); if (!pts || pts.length < 3) continue;
      const parity = ds != null ? (ds & 1) : 0;
      if (ds != null) hist.set(ds, (hist.get(ds) || 0) + 1);
      const t = parity ? white : black; parity ? w++ : b++;
      const lv = e.level ?? 1;
      levels.add(lv);
      if (lv > 1) roofN++; else groundN++;
      const y = Number.isFinite(e.y) ? e.y : (this.levelHeight ? lv * this.levelHeight : 0) + .055;
      for (let i = 1; i < pts.length - 1; i++) pos.push(pts[0][0], y, pts[0][1], pts[i][0], y, pts[i][1], pts[i + 1][0], y, pts[i + 1][1]);
      const n = (pts.length - 2) * 3;
      for (let i = 0; i < n; i++) col.push(t.r, t.g, t.b);
    }
    this.candidates.geometry.dispose();
    if (!pos.length) {
      this.candidates.visible = false;
      this.candidateStats = { cells: entries.length, white: 0, black: 0, on: false, layered: true, levels: levels.size, ground: 0, roof: 0, converged: drop };
      return this.candidateStats;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    this.candidates.geometry = g;
    this.candidates.visible = true;
    this.candidateStats = { cells: entries.length, white: w, black: b, on: true, mode: 'domain', layered: true,
      levels: levels.size, levelList: [...levels].sort((a, b2) => a - b2), ground: groundN, roof: roofN, converged: drop,
      domainSizes: [...hist.entries()].sort((a, b2) => a[0] - b2[0]).map(([size, count]) => ({ size, count })) };
    return this.candidateStats;
  }

  /** 第 69 轮：把 `solveAssembly()` 的真实 `traceLimit` 快照接进候选棋盘。
   *  第 68 轮遗留的缺口是「setCandidates 的逐格 domain 只由夹具喂，没接 wfc.js 的 traceLimit 快照」。
   *  这里做的是纯桥接，不另造数据：
   *    · `solved` = `solveAssembly(world, site, {traceLimit})` 的返回值（带 `trace` / `lattice` / `H`）；
   *    · trace 里 `domains` 的键是**层格** id（`index*H + level-1`），这里只取地面层（level 1）——原片棋盘是整格一块，
   *      不按层叠色；多层里「上层还没定」不等于这格还是候选，所以取地面层最贴近原片读数；
   *    · 映射回世界格后仍走 `setCandidates(list,{domains})`，domain 大小 → 奇偶的规则不变（同一套 60/64 轮口径）。
   *  返回的 stats 额外带 `traceStep/stage/decisions`，页面与测试都用它核对「画面确实对应 trace 的某一帧」。 */
  setCandidatesFromTrace(solved, step = 0, { layered = false, ground = 0 } = {}) {
    const trace = solved?.trace, lat = solved?.lattice;
    if (!Array.isArray(trace) || !trace.length || !lat?.cells) return this.setCandidates(null);
    const i = Math.max(0, Math.min(trace.length - 1, Number(step) | 0));
    const f = trace[i], domains = new Map();
    // 第 72 轮：layered=true 时每一层各自的 domain 都画（屋顶候选格），y 按 site.ground 折算成真层高。
    if (layered) {
      const entries = [];
      for (const lc of lat.cells) {
        const d = f.domains?.[lc.id];
        if (!Array.isArray(d)) continue;
        const cell = this.world.cells[lc.cell];
        if (!cell) continue;
        entries.push({ cell, level: lc.level, domain: d.length,
          y: ((Number(ground) || 0) + lc.level - 1) * (this.levelHeight || 0) + .055 });
      }
      const st = this.setCandidatesLayered(entries);
      return { ...st, traceStep: i, traceFrames: trace.length, stage: f.stage, decisions: f.decisions, steps: f.steps };
    }
    for (const lc of lat.cells) {
      if (lc.level !== 1) continue;
      const d = f.domains?.[lc.id];
      if (Array.isArray(d)) domains.set(lc.cell, d.length);
    }
    const list = [...domains.keys()].map((id) => this.world.cells[id]).filter(Boolean);
    const st = this.setCandidates(list, { domains });
    return { ...st, traceStep: i, traceFrames: trace.length, stage: f.stage, decisions: f.decisions, steps: f.steps };
  }

  /** 点标记开关（片中可单独关掉，便于对照是线框还是点）。 */
  setDots(on=true){this.dotsOn=!!on;this.corners.visible=this.dots.visible=this.dotsOn;if(this.dotStats)this.dotStats.on=this.dotsOn;return this.dotsOn;}
  setDotSize(corner,cell){
    if(!(corner>0&&corner<20)||!(cell>0&&cell<20))throw new RangeError('invalid dot size');
    this.dotSize={corner,cell};this.corners.material.size=corner;this.dots.material.size=cell;return {...this.dotSize};
  }
  /** 第 49 轮：整格选中高亮（原片单格整格黄色填充，三角格按三角）。第 53 轮补外圈定宽金黄折线。 */
  selectCell(cell){
    if(!this.selected){this.selected=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:'#ffd54a',transparent:true,opacity:.28,depthTest:false,side:THREE.DoubleSide}));this.selected.renderOrder=10;this.selected.frustumCulled=false;this.mesh.add(this.selected);}
    if(!this.outline){this.outline=new THREE.Mesh(new THREE.BufferGeometry(),this.outlineMat);this.outline.renderOrder=11;this.outline.frustumCulled=false;this.mesh.add(this.outline);}
    if(!cell){this.selected.visible=false;this.outline.visible=false;this.gizmo.visible=false;this.selectedCell=null;return null;}
    const top=this.world.top?this.world.top(cell):0,y=(this.levelHeight?top*this.levelHeight:0)+.045,pts=cellOutline(cell),pos=[];
    for(let i=1;i<pts.length-1;i++)pos.push(pts[0][0],y,pts[0][1],pts[i][0],y,pts[i][1],pts[i+1][0],y,pts[i+1][1]);
    this.selected.geometry.dispose();this.selected.geometry=new THREE.BufferGeometry();this.selected.geometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    const ring=this.#ringGeometry(pts,y);
    this.outline.geometry.dispose();this.outline.geometry=ring;
    this.selected.visible=true;this.outline.visible=true;
    const cx=pts.reduce((s,p)=>s+p[0],0)/pts.length,cz=pts.reduce((s,p)=>s+p[1],0)/pts.length;
    this.gizmo.position.set(cx,y,cz);this.gizmo.visible=true;
    return {cell:cell.id,triangles:pos.length/9,y,outlineQuads:ring.userData.quads,outlineWidth:this.outlineWidth};
  }
  /** 折线 → 每条边一个四边形（两个三角形），带法向外扩方向 aSide=±1。 */
  #ringGeometry(pts,y){
    const n=pts.length,posArr=[],side=[],pa=[],pb=[];
    const verts=[];
    for(let i=0;i<n;i++){
      const a=pts[i],b=pts[(i+1)%n];
      for(const [p,sgn]of[[a,-1],[a,1],[b,1],[b,-1]])verts.push({p,sgn,a,b});
    }
    const idx=[];
    for(let q=0;q<verts.length;q+=4)idx.push(q,q+1,q+2,q,q+2,q+3);
    for(const v of verts){
      posArr.push(v.p[0],y,v.p[1]);
      side.push(v.sgn);
      pa.push(v.a[0],y,v.a[1]);
      pb.push(v.b[0],y,v.b[1]);
    }
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(posArr,3));
    g.setAttribute('aSide',new THREE.Float32BufferAttribute(side,1));
    g.setAttribute('aPosA',new THREE.Float32BufferAttribute(pa,3));
    g.setAttribute('aPosB',new THREE.Float32BufferAttribute(pb,3));
    g.setIndex(idx);
    g.userData={quads:verts.length/4};
    return g;
  }
  /** 三相轴 gizmo：红 X / 绿 Y / 蓝 Z 箭头 + 两个半透明方块手柄（本地尺寸 1，由 update 按距离缩放）。 */
  #buildGizmo(){
    const g=new THREE.Group();g.visible=false;g.renderOrder=12;
    const axis=(dir,color)=>{
      const m=new THREE.LineBasicMaterial({color,depthTest:false,transparent:true,opacity:.95});
      const lg=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0),new THREE.Vector3(dir[0]*.78,dir[1]*.78,dir[2]*.78)]);
      const line=new THREE.Line(lg,m);line.renderOrder=12;line.frustumCulled=false;g.add(line);
      const cone=new THREE.Mesh(new THREE.ConeGeometry(.14,.3,8),new THREE.MeshBasicMaterial({color,depthTest:false,transparent:true,opacity:.95}));
      cone.position.set(dir[0]*.93,dir[1]*.93,dir[2]*.93);
      if(dir[1])cone.rotation.set(dir[1]>0?0:Math.PI,0,0); else if(dir[0])cone.rotation.set(0,0,-dir[0]*Math.PI/2); else cone.rotation.set(Math.PI/2,0,0);
      cone.renderOrder=12;cone.frustumCulled=false;g.add(cone);
      return {line,cone};
    };
    this.gizmoAxes=[axis([1,0,0],'#e0473c'),axis([0,1,0],'#5fbf4a'),axis([0,0,1],'#3f6fd8')];
    const handle=(c)=>new THREE.Mesh(new THREE.PlaneGeometry(.36,.36),new THREE.MeshBasicMaterial({color:c,depthTest:false,transparent:true,opacity:.22,side:THREE.DoubleSide}));
    const p1=handle('#e0473c');p1.position.set(.26,0,.26);p1.rotation.set(-Math.PI/2,0,0);
    const p2=handle('#3f6fd8');p2.position.set(0,.26,.26);
    for(const m of [p1,p2]){m.renderOrder=12;m.frustumCulled=false;g.add(m);}
    return g;
  }
  /** 每帧：给 uPixScale 与 gizmo 的屏幕恒定尺寸（相机距离 × 视口高）。 */
  update(camera,heightPx,widthPx){
    if(!camera)return;
    this.pixScale=2/Math.max(1,heightPx||1);                       // NDC per pixel
    this.outlineMat.uniforms.uHalfPx.value=this.pixScale;
    this.outlineMat.uniforms.uWidth.value=this.outlineWidth;
    const w=camera.aspect||this.aspect||1.6;
    this.outlineMat.uniforms.uAspect.value=w;
    this.regionThickMat.uniforms.uHalfPx.value=this.pixScale;
    this.regionThickMat.uniforms.uAspect.value=w;
    if(this.gizmo.visible){
      const d=camera.position.distanceTo(this.gizmo.position);
      this.gizmo.scale.setScalar(Math.max(.02,d*0.09));   // ≈ 定屏：gizmo 本地 1 ≈ 屏幕高度的 9%
    }
  }
  setVisible(on){this.mesh.visible=on;this.refresh();}
  setOutlineWidth(px){if(!(px>0.5&&px<12))throw new RangeError('invalid outline width');this.outlineWidth=px;this.outlineMat.uniforms.uWidth.value=px;return px;}
  dispose(){this.mesh.geometry.dispose();this.mesh.material.dispose();this.regions.geometry.dispose();this.regions.material.dispose();this.regionsThick.geometry.dispose();this.regionThickMat.dispose();this.selected?.geometry.dispose();this.selected?.material.dispose();this.outline?.geometry.dispose();this.outlineMat.dispose();this.cornerTex?.dispose();}
}
