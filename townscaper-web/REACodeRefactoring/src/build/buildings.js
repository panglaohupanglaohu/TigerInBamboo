import {archFloorBudget,openingPierce} from '../core/arch-floor-budget.js';
import {solveWallDecoration,solveFacadeDecoration} from '../core/surface-decoration.js';
import { archProfile, archVoussoirs, deformedArchError } from '../core/arch-profile.js';
import { buildingComponents } from '../core/building-components.js';
import { hipRoof, regionRings, skeletonRoof } from '../core/hip-roof.js';
import { seatChimney, PITCHES, THATCH } from '../core/house-kit.js';
import { offsetRing } from '../core/straight-skeleton.js';
import { openingFootprint, OPENING_FRAME, WINDOW_SILL_SCALE, placeProps } from '../core/opening-footprint.js';
/**
 * buildings.js — 建筑管线（Townscaper）：体素列 → 墙 / 基座 / 屋顶 / 支撑 / 门窗 / 后院。
 *
 * 只处理 World 里"非岩石"的实心层；岩石层交给 terrain/terrainmesh.js。两者遮挡关系
 * 统一看 solid，所以房子盖在悬崖上、贴着山体时，贴住的那面墙自然不出。
 *
 * 依据（帖子 ID）：
 *  1197909675443916803 / 1189908238566903808  每格一栋窄房子、陡坡双坡顶，单宽排屋端头是山墙；
 *                                            屋顶永远陶土色，调色板只上墙
 *  1258421104756097029 / 1215642481162887168  码头：灰石基座入水外鼓、深红压顶、深灰铺地、栏杆
 *  1189902695303458816                        悬空的方块站在深色钢架上
 *  1189908238566903808                        两侧都有支撑时出现拱
 *  1238474550511308800                        围合的地面变成后院
 *  1176516621223043073                        白框小窗，临步道的一面开门
 */

import { classifyCourtyards } from '../core/courtyards.js';
import { gardenPaths } from '../core/garden-paths.js';
import { BUILD } from '../core/palette.js';
import { hash01, mix, clamp } from '../core/noise.js';
import { UP, DOWN, edgeOut } from '../core/meshwriter.js';
import { emitSteelFrame } from './steel-r56.js';                 // r56 C05：world.steelFrame（默认关）
import { planYardWalls, drawYardWalls } from './yard-r56.js';    // r56 C05：world.yardWalls / propAnimYard（默认关）
import { canalBridgeFace } from './canal-bridge-r56.js';          // r56 C05·C：world.canalBridges（默认关）
import { churchNiches } from './church-niche-r56.js';            // r56 C05·C：world.churchDoors（默认关）
import { drawYardProp } from './yard-prop-art-r56.js';           // r56 C05·C：world.yardPropArt（默认关）
import { planGardenC07, drawGardenCellC07 } from './garden-plots-c07.js';   // r56 C07：world.gardenPlots 草地块 + 门优先细石板小径（默认关）

/**
 * @param {import('../core/meshwriter.js').MeshWriter} w
 * @param {import('../core/world.js').World} world
 * @returns {{ posts: {x:number,z:number}[], yards:number }}
 */
export function buildBuildings(w, world, { L, debugModules = false }) {
  let archCount=0,archSegments=0,archWedges=0,decoSolved=0,decoFailures=0;
  const archBudgets=[],archVoussoirLog=[],decoDrawn={},decoPlacements=[];
  let decoDropped=0;
  const lintels=[],archHoles=[],archCuts=[];
  const canalBridges=[],churchDoorLog=[],openingLog=[];   // r56 C05·C
  const cells = world.cells;
  const grid = world.grid;
  const n = cells.length;
  const tops = new Int32Array(n);
  for (const c of cells) tops[c.id] = world.top(c);
  const nbr = (c, i) => world.neighbor(c, i);
  const solid = (c, lv) => c !== null && world.isSolid(c, lv);
  const built = (c, lv) => c !== null && world.isBuilt(c, lv);
  const wallColor = (c) => w.c(world.color[c.id] >= 0 ? world.palette.colors[world.color[c.id]] ?? BUILD.plaster : BUILD.plaster);

  /* ---- 模块签名调试色（1279107097108635649 "the puzzle pieces that make up Townscaper. To date, there are 545"）
   * 每段墙所在的"拼图块"由它周围的占用决定：这一格边数 n、上一层 / 下一层是否实心、每条边外面同层是否实心。
   * 打开 toggle 'modules' 后，同一种签名涂同一种颜色 —— 一眼看出哪些位置在用同一块拼图、一共用到多少种。 */
  const sigs = new Map();
  const moduleSigs = new Set();
  const moduleSig = (c, lv) => {
    let sig = c.n * 4 + (solid(c, lv + 1) ? 2 : 0) + (solid(c, lv - 1) ? 1 : 0);
    for (let i = 0; i < c.n; i++) sig = sig * 2 + (solid(nbr(c, i), lv) ? 1 : 0);
    return sig;
  };
  const sigColor = (sig) => {
    let col = sigs.get(sig);
    if (!col) {
      const hue = (hash01(sig * 2654435761 + 11) * 360) | 0, lit = 52 + ((hash01(sig + 5) * 18) | 0);
      col = w.c(`hsl(${hue}, 62%, ${lit}%)`);
      sigs.set(sig, col);
    }
    return col;
  };

  const K = Object.fromEntries(Object.entries(BUILD).map(([k, v]) => [k, w.c(v)]));

  /* ---- 码头外轮廓的逐顶点外法线：基座外鼓时相邻格不开缝 ------------------------ */
  const quayN = new Map();
  for (const c of cells) {
    if (!built(c, 1)) continue;
    for (let i = 0; i < c.n; i++) {
      if (solid(nbr(c, i), 1)) continue;
      const [nx, nz] = edgeOut(c, i);
      for (const p of [c.pts[i], c.pts[(i + 1) % c.n]]) {
        const v = quayN.get(p.id) || [0, 0];
        v[0] += nx; v[1] += nz;
        quayN.set(p.id, v);
      }
    }
  }
  const flare = (p, amount) => {
    const v = quayN.get(p.id);
    if (!v) return [p.x, p.z];
    const l = Math.hypot(v[0], v[1]) || 1;
    const k = amount * Math.min(1.35, Math.max(1, l));
    return [p.x + (v[0] / l) * k, p.z + (v[1] / l) * k];
  };

  /* ---- 后院：地面层（顶=1 的码头格）连通块碰不到水 / 网格边 ------------------- */
  const courtyard = classifyCourtyards(world, { tops });
  const yard = courtyard.mask;
  const yardComps = courtyard.components;
  const path = new Uint8Array(n);

  // Local graph reconstruction: connect PCA endpoints through garden cells.
  // Source video shows paths, not PCA or this algorithm. Never bridge a hole.
  for (const comp of yardComps) {
    const plan = gardenPaths(comp, c => Array.from({length:c.n},(_,i)=>nbr(c,i)));
    for (const id of plan.path) path[id] = 1;
  }

  /* ---- 墙面零件 ------------------------------------------------------------- */
  const plinth = (c, i) => {
    if (world.canalBridges && canalBridgeFace(w, world, c, i, { L, K, flare, log: canalBridges })) return;   // r56 C05·C 运河拱桥
    const a = c.pts[i], b = c.pts[(i + 1) % c.n];
    const [nx, nz] = edgeOut(c, i);
    const out = [nx, 0, nz];
    const rows = [[0.0, 0.085], [0.1 * L, 0.06], [0.3 * L, 0.022], [0.62 * L, 0.004], [L - 0.055, 0.0]];
    for (let r = 0; r < rows.length - 1; r++) {
      const [y0, f0] = rows[r];
      const [y1, f1] = rows[r + 1];
      const a0 = flare(a, f0), b0 = flare(b, f0), a1 = flare(a, f1), b1 = flare(b, f1);
      const shade = (0.86 + 0.05 * r) * (0.96 + 0.08 * hash01(c.id * 7 + i * 3 + r));
      w.quad([a0[0], y0, a0[1]], [b0[0], y0, b0[1]], [b1[0], y1, b1[1]], [a1[0], y1, a1[1]], out, r < 2 ? K.stoneDark : K.stone, shade);
    }
    const o = 0.012, ya = L - 0.055, yb = L + 0.006;
    w.quad([a.x + nx * o, ya, a.z + nz * o], [b.x + nx * o, ya, b.z + nz * o], [b.x + nx * o, yb, b.z + nz * o], [a.x + nx * o, yb, a.z + nz * o], out, K.band, 1);
    w.quad([a.x, ya, a.z], [b.x, ya, b.z], [b.x + nx * o, ya, b.z + nz * o], [a.x + nx * o, ya, a.z + nz * o], DOWN, K.band, 0.7);
    w.quad([a.x, yb, a.z], [b.x, yb, b.z], [b.x + nx * o, yb, b.z + nz * o], [a.x + nx * o, yb, a.z + nz * o], UP, K.band, 1.05);
  };

  /* ---- 门窗 = 道具放置：尽量多放、互不重叠（1205416648397721601） ----------------
   * "It tries to place as many props as it can without overlap. I use it for doors and windows too,
   *  which means they are no longer skewed when placed on skewed tiles"
   * 每层一张已放置列表（世界坐标中点 + 半宽）；新开口离已有的太近、或离墙边端点太近（拐角）就放弃。
   * 开口始终是沿墙边的正矩形，不随格子歪斜。 */
  const placed = new Map();   // lv → [[x, z, halfWidth]]
  const GAP = 0.05, CORNER = 0.035;
  const tryPlace = (c, i, t, lv, width, isDoor = false) => {
    const a = c.pts[i], b = c.pts[(i + 1) % c.n];
    const footprint = openingFootprint(a,b,t,width,{door:isDoor,corner:CORNER});
    if (!footprint) return false;
    const {x,z,halfWidth:hw} = footprint;
    const list = placed.get(lv) || placed.set(lv, []).get(lv);
    for (const [px, pz, ph] of list) if (Math.hypot(px - x, pz - z) < ph + hw + GAP) return false;
    list.push([x, z, hw]);
    return true;
  };

  /* ---- 本地表面装饰分组：沿实际建筑体素连通，码头与岩石不并楼。
   * 悬空/断开的楼层也有独立身份；同一组同层共享窗型。
   * 118146配文明确有独立小WFC；本地哈希/门候选规则还不是该求解器。 */
  const decoration=buildingComponents(world);
  const house=Int32Array.from(cells,c=>decoration.at(c,2));
  const windowStyle = (c, lv) => (hash01((decoration.at(c,lv) + 7) * 977 + lv * 131) * 3) | 0;
  const door = new Map();   // house → 'cellId:edge'
  for (const c of cells) {
    if (house[c.id] < 0) continue;
    for (let i = 0; i < c.n; i++) {
      const nb = nbr(c, i);
      if (!nb || !world.isBuilt(c, 2) || solid(nb, 2) || tops[nb.id] !== 1 || world.bottom(nb) !== 1) continue;
      const len = Math.hypot(c.pts[(i + 1) % c.n].x - c.pts[i].x, c.pts[(i + 1) % c.n].z - c.pts[i].z);
      if (len < 0.3) continue;
      const k = hash01(c.id * 131 + i * 17), cur = door.get(house[c.id]);
      if (!cur || k < cur.k) door.set(house[c.id], { k, key: c.id + ':' + i });
    }
  }
  const gardenC07 = world.gardenPlots ? planGardenC07(world, yardComps, door, nbr, path) : null;   // r56 C07（默认关）

  /* r55 piercefloor: lintel block above an opening (world.lintels). Thickness ≤ the slab budget
   * (world.archSlab, default .05) and the block never crosses the storey line above. */
  const lintel = (c, i, t, yTop, width, kind) => {
    if (!world.lintels) return;
    const a = c.pts[i], b = c.pts[(i + 1) % c.n], [nx, nz] = edgeOut(c, i), len = Math.hypot(b.x - a.x, b.z - a.z) || 1, slab = world.archSlab ?? .05;
    const lh = Math.min(world.lintelHeight ?? .03, slab * .9), hw = (width / 2 + OPENING_FRAME + .012) / len, o = .022, lv = Math.floor(yTop / L + 1e-9) + 1;
    const y0 = yTop, y1 = Math.min(yTop + lh, lv * L - slab), P = (tt, y, oo) => [mix(a.x, b.x, tt) + nx * oo, y, mix(a.z, b.z, tt) + nz * oo], ex = (b.x - a.x) / len, ez = (b.z - a.z) / len;
    if (y1 <= y0 + 1e-6) return;
    w.quad(P(t - hw, y0, o), P(t + hw, y0, o), P(t + hw, y1, o), P(t - hw, y1, o), [nx, 0, nz], K.stone, 1.02);
    w.quad(P(t - hw, y1, 0), P(t + hw, y1, 0), P(t + hw, y1, o), P(t - hw, y1, o), UP, K.stone, 1.08);
    w.quad(P(t - hw, y0, 0), P(t + hw, y0, 0), P(t + hw, y0, o), P(t - hw, y0, o), DOWN, K.stone, .7);
    w.quad(P(t - hw, y0, 0), P(t - hw, y0, o), P(t - hw, y1, o), P(t - hw, y1, 0), [-ex, 0, -ez], K.stone, .9);
    w.quad(P(t + hw, y0, 0), P(t + hw, y0, o), P(t + hw, y1, o), P(t + hw, y1, 0), [ex, 0, ez], K.stone, .9);
    lintels.push({ cell: c.id, edge: i, level: lv, kind, y0, y1, thickness: y1 - y0, slab, storeyTop: lv * L, width: 2 * hw * len, t });
  };
  const opening = (c, i, t, y0, width, height, isDoor, cross = true) => {
    const a = c.pts[i], b = c.pts[(i + 1) % c.n];
    const [nx, nz] = edgeOut(c, i);
    const out = [nx, 0, nz];
    const P = (tt, y, o) => [mix(a.x, b.x, tt) + nx * o, y, mix(a.z, b.z, tt) + nz * o];
    const len = Math.hypot(b.x - a.x, b.z - a.z) || 1;
    const hw = width / 2 / len, fw = OPENING_FRAME / len, ft = OPENING_FRAME;
    const t1 = t - hw, t2 = t + hw, y1 = y0 + height;
    w.quad(P(t1 - fw, y0 - ft, 0.008), P(t2 + fw, y0 - ft, 0.008), P(t2 + fw, y1 + ft, 0.008), P(t1 - fw, y1 + ft, 0.008), out, K.frame, 1);
    w.quad(P(t1, y0, 0.012), P(t2, y0, 0.012), P(t2, y1, 0.012), P(t1, y1, 0.012), out, isDoor ? K.door : K.glass, 1, isDoor ? 0 : 1);
    openingLog.push({ cell: c.id, edge: i, t, y0, y1, width, height, door: !!isDoor, ax: a.x, az: a.z, bx: b.x, bz: b.z, nx, nz });   // r56 C05·C：模板挖洞层用
    if (!isDoor) {
      const mw = 0.006 / len;
      w.quad(P(t - mw, y0, 0.016), P(t + mw, y0, 0.016), P(t + mw, y1, 0.016), P(t - mw, y1, 0.016), out, K.frame, 1);
      // 横档：1176516621223043073 放大帧里窗格是白框 + 竖横各一道组成「十」字，
      // 分成四块深色玻璃；另有只带竖档的两格窗。这里用 cross 区分这两种窗型。
      if (cross) {
        const ym = y0 + height * 0.5, mh = 0.005;
        w.quad(P(t1, ym - mh, 0.016), P(t2, ym - mh, 0.016), P(t2, ym + mh, 0.016), P(t1, ym + mh, 0.016), out, K.frame, 1);
      }
      w.quad(P(t1 - fw * WINDOW_SILL_SCALE, y0 - ft * WINDOW_SILL_SCALE, 0.03), P(t2 + fw * WINDOW_SILL_SCALE, y0 - ft * WINDOW_SILL_SCALE, 0.03), P(t2 + fw * WINDOW_SILL_SCALE, y0 - ft * 0.6, 0.03), P(t1 - fw * WINDOW_SILL_SCALE, y0 - ft * 0.6, 0.03), out, K.frame, 0.95);
    }
    lintel(c, i, t, y1 + ft, width, isDoor ? 'door' : 'window');
  };

  const shutterPanel=(c,i,t,y,width,height)=>{
    const a=c.pts[i],b=c.pts[(i+1)%c.n],[nx,nz]=edgeOut(c,i),len=Math.hypot(b.x-a.x,b.z-a.z),hw=width/len/2;
    const P=(tt,yy,o)=>[mix(a.x,b.x,tt)+nx*o,yy,mix(a.z,b.z,tt)+nz*o];
    w.quad(P(t-hw,y,.018),P(t+hw,y,.018),P(t+hw,y+height,.018),P(t-hw,y+height,.018),[nx,0,nz],K.door,.9);
    for(let k=1;k<5;k++){const yy=y+height*k/5;w.quad(P(t-hw,yy-.003,.023),P(t+hw,yy-.003,.023),P(t+hw,yy+.003,.023),P(t-hw,yy+.003,.023),[nx,0,nz],K.frame,.8);}
  };
  const archedEntry=(c,i,t,y,width,height,cut=false)=>{
    const a=c.pts[i],b=c.pts[(i+1)%c.n],[nx,nz]=edgeOut(c,i),len=Math.hypot(b.x-a.x,b.z-a.z),rad=width/2,spring=y+height-rad,frame=OPENING_FRAME;
    const P=(x,yy,o)=>[mix(a.x,b.x,t+x/len)+nx*o,yy,mix(a.z,b.z,t+x/len)+nz*o],out=[nx,0,nz];
    for(const side of[-1,1]){const x=side*rad,xx=side*(rad+frame);w.quad(P(Math.min(x,xx),y,.008),P(Math.max(x,xx),y,.008),P(Math.max(x,xx),spring,.008),P(Math.min(x,xx),spring,.008),out,K.frame,1);}
    if(!cut)w.quad(P(-rad,y,.012),P(rad,y,.012),P(rad,spring,.012),P(-rad,spring,.012),out,K.door,1);
    for(let k=0;k<12;k++){const a=k*Math.PI/12,b=(k+1)*Math.PI/12,p=(angle,r,o)=>P(Math.cos(angle)*r,spring+Math.sin(angle)*r,o);
      if(!cut)w.tri(P(0,spring,.012),p(a,rad,.012),p(b,rad,.012),out,K.door,1);
      w.quad(p(a,rad,.008),p(a,rad+frame,.008),p(b,rad+frame,.008),p(b,rad,.008),out,K.frame,1);
    }
    if(cut){
      // r55 surfacedeco: real hole — the wall body skips this shape (wallStrip); here the recess:
      // jambs, intrados, sill and a dark back face at depth d inside the building volume.
      const d=world.archCutDepth??.07,ex=(b.x-a.x)/len,ez=(b.z-a.z)/len,back=K.door.clone().multiplyScalar(.45),reveal=wallColor(c).clone().multiplyScalar(.62);
      w.quad(P(-rad,y,0),P(-rad,y,-d),P(-rad,spring,-d),P(-rad,spring,0),[ex,0,ez],reveal,1);
      w.quad(P(rad,y,0),P(rad,y,-d),P(rad,spring,-d),P(rad,spring,0),[-ex,0,-ez],reveal,1);
      w.quad(P(-rad,y,0),P(rad,y,0),P(rad,y,-d),P(-rad,y,-d),UP,K.stone,.8);
      w.quad(P(-rad,y,-d),P(rad,y,-d),P(rad,spring,-d),P(-rad,spring,-d),out,back,1);
      for(let k=0;k<12;k++){const t0=Math.PI-k*Math.PI/12,t1=Math.PI-(k+1)*Math.PI/12,q=(an,o)=>P(Math.cos(an)*rad,spring+Math.sin(an)*rad,o),mid=(t0+t1)/2;
        w.quad(q(t0,0),q(t1,0),q(t1,-d),q(t0,-d),[-Math.cos(mid)*ex,-Math.sin(mid),-Math.cos(mid)*ez],reveal,.85);
        w.tri(P(0,spring,-d),q(t0,-d),q(t1,-d),out,back,1);}
    }
    lintel(c,i,t,y+height+frame,width,'arch-entry');
  };
  /* Wall strip with an optional arch-shaped hole (hole: {t, y, width, height}); without a hole
   * it is exactly wallBody. Rectangles left/right of the hole, below its sill, and a fan of strips
   * between the semicircle (12 chords, same as the frame ring) and the strip top. */
  /* r113 真洞口账本：墙面原本 (yB-yA)*len，挖洞后实画面积逐块累加，差额必须等于拱形面积
   * 2r*(h-r)+πr²/2（拱洞=矩形+半圆）。这是「真洞口」区别于贴片拱门的唯一硬证据。 */
  const wallStrip=(c,i,yA,yB,col,shade,hole)=>{
    if(!hole){wallBody(c,i,yA,yB,col,shade);return;}
    const a=c.pts[i],b=c.pts[(i+1)%c.n],len=Math.hypot(b.x-a.x,b.z-a.z),[nx,nz]=edgeOut(c,i),out=[nx,0,nz],Q=(s,y)=>[a.x+(b.x-a.x)*s/len,y,a.z+(b.z-a.z)*s/len];
    let drawn=0;
    const rect=(s0,s1,y0,y1)=>{if(s1-s0>1e-9&&y1-y0>1e-9){w.quad(Q(s0,y0),Q(s1,y0),Q(s1,y1),Q(s0,y1),out,col,shade);drawn+=(s1-s0)*(y1-y0);}};
    const r=hole.width/2,sc=hole.t*len,xl=sc-r,xr=sc+r,spring=hole.y+hole.height-r,cl=y=>Math.max(yA,Math.min(yB,y));
    rect(0,xl,yA,yB);rect(xr,len,yA,yB);rect(xl,xr,yA,Math.min(yB,hole.y));
    for(let k=0;k<12;k++){const t0=Math.PI-k*Math.PI/12,t1=Math.PI-(k+1)*Math.PI/12,x0=sc+r*Math.cos(t0),x1=sc+r*Math.cos(t1),y0=cl(spring+r*Math.sin(t0)),y1=cl(spring+r*Math.sin(t1));
      if(y0>=yB-1e-12&&y1>=yB-1e-12)continue;w.quad(Q(x0,y0),Q(x1,y1),Q(x1,yB),Q(x0,yB),out,col,shade);drawn+=(x1-x0)*((yB-y0)+(yB-y1))/2;}
    const wallArea=(yB-yA)*len,missing=Math.max(0,wallArea-drawn);
    archCuts.push({cell:c.id,edge:i,level:Math.round(yA/L),len:+len.toFixed(4),wallArea:+wallArea.toFixed(6),drawn:+drawn.toFixed(6),missing:+missing.toFixed(6),depth:world.archCutDepth??.07});
  };

  const wallBody = (c, i, y0, y1, color, shade) => {
    const a = c.pts[i], b = c.pts[(i + 1) % c.n];
    const [nx, nz] = edgeOut(c, i);
    w.quad([a.x, y0, a.z], [b.x, y0, b.z], [b.x, y1, b.z], [a.x, y1, a.z], [nx, 0, nz], color, shade);
  };

  /* ---- 跨格整立面（surfacedeco，1181464374839521280）：同一平面上连续的墙段串成一条
   * facade run，一次解小 WFC，水平规则（同类窗不并排、百叶贴窗）跨格成立。门所在墙段不入串。 */
  const facadeRuns = new Map(), facadeRunList = [], placedRunSlots = new Set(), deferredShutters = [], facadeLoneDoor = new Set();
  if (world.surfaceWFC && world.surfaceFacade && world.surfaceFacadeRuns) {
    const spans = [], byStart = new Map();
    for (const c of cells) {
      const h = tops[c.id]; if (h < 2) continue;
      for (let i = 0; i < c.n; i++) {
        const nb = nbr(c, i), a = c.pts[i], b = c.pts[(i + 1) % c.n], edgeLen = Math.hypot(b.x - a.x, b.z - a.z);
        let lo = 2;
        while (lo <= h) {
          if (!world.isBuilt(c, lo) || solid(nb, lo)) { lo++; continue; }
          let hi = lo; while (hi < h && world.isBuilt(c, hi + 1) && !solid(nb, hi + 1)) hi++;
          const hasDoor = lo === 2 && door.get(house[c.id])?.key === c.id + ':' + i;
          // r55 surfacedeco: world.surfaceFacadeDoors lets the door span join the run (entry pinned at its slot).
          if ((!hasDoor || world.surfaceFacadeDoors) && hi - lo < 12) {
            const sp = { c, i, lo, hi, a, b, door: hasDoor, width: edgeLen >= .70 ? 3 : hasDoor ? 1 : edgeLen >= .46 ? 2 : 1, dir: [(b.x - a.x) / edgeLen, (b.z - a.z) / edgeLen] };
            spans.push(sp); const k = a.id + ':' + lo + ':' + hi; (byStart.get(k) ?? byStart.set(k, []).get(k)).push(sp);
          }
          lo = hi + 1;
        }
      }
    }
    const next = new Map(), prev = new Map(), maxTurn = Math.cos(25 * Math.PI / 180);
    const cornerLink = new Set();
    for (const sp of spans) {
      let best = null, bestDot = maxTurn;
      for (const q of byStart.get(sp.b.id + ':' + sp.lo + ':' + sp.hi) ?? []) { const d = sp.dir[0] * q.dir[0] + sp.dir[1] * q.dir[1]; if (q !== sp && d > bestDot) { best = q; bestDot = d; } }
      // r55 surfacedeco: world.surfaceFacadeCorners continues the run around a building corner
      // (scored below every straight continuation, so straight links always win).
      if (!best && world.surfaceFacadeCorners) for (const q of byStart.get(sp.b.id + ':' + sp.lo + ':' + sp.hi) ?? []) { const d = sp.dir[0] * q.dir[0] + sp.dir[1] * q.dir[1] - 2; if (q !== sp && q.c !== sp.c && (best === null || d > bestDot)) { best = q; bestDot = d; } }
      if (best && bestDot < -1) cornerLink.add(best);
      if (best && (!prev.has(best) || prev.get(best).dot < bestDot)) { if (prev.has(best)) next.delete(prev.get(best).sp); prev.set(best, { sp, dot: bestDot }); next.set(sp, best); }
    }
    const seen = new Set();
    const heads = [...spans.filter(sp => !prev.has(sp)), ...spans];
    for (const head of heads) {
      if (seen.has(head)) continue;
      const chain = []; for (let sp = head; sp && !seen.has(sp); sp = next.get(sp)) { seen.add(sp); chain.push(sp); }
      // split into runs that fit the facade solver width budget
      for (let k = 0; k < chain.length;) {
        const part = []; let width = 0, doors = 0;
        while (k < chain.length && width + chain[k].width <= 12 && !(doors && chain[k].door)) { if (chain[k].door) doors++; part.push(chain[k]); width += chain[k].width; k++; }
        if (part.length < 2) { if (part.length === 1 && part[0].door) facadeLoneDoor.add(part[0]); continue; }
        const levels = part[0].hi - part[0].lo + 1, id = facadeRunList.length;
        let off = 0, entryAt = null, entry = null; const breaks = [];
        for (const [j, sp] of part.entries()) { if (j && cornerLink.has(sp)) breaks.push(off); if (sp.door) { entryAt = off + Math.floor(sp.width / 2); entry = hash01(sp.c.id * 31 + sp.i) < .5 ? 'arch' : 'door'; } off += sp.width; }
        const solved = solveFacadeDecoration(levels, { width, seed: part[0].c.id * 131 + part[0].i * 17 + part[0].lo * 7 + 99991, entry, entryAt, breaks });
        const run = { id, lo: part[0].lo, hi: part[0].hi, width, levels, ok: solved.ok && !solved.violations.length, styles: solved.styles, violations: solved.violations, spans: [], breaks, entry, entryAt };
        facadeRunList.push(run);
        if (!run.ok) { decoFailures++; continue; }
        decoSolved++;
        let offset = 0;
        for (const sp of part) {
          run.spans.push({ cell: sp.c.id, edge: sp.i, offset, width: sp.width, door: !!sp.door, corner: cornerLink.has(sp) && offset > 0 });
          facadeRuns.set(sp.c.id + ':' + sp.i + ':' + sp.lo, { run, offset, width: sp.width });
          offset += sp.width;
        }
      }
    }
  }

  /* ---- 逐格：墙、顶、底 ------------------------------------------------------ */
  // r56 C05·C：教堂高拱龛（world.churchDoors，默认关）——先占 2、3 层的门窗排斥位并画龛体，墙体交给 wallStrip(hole)
  const churchHole = world.churchDoors ? churchNiches(w, world, { L, K, door, house, placed, wallColor, log: churchDoorLog }) : null;
  const railings = [];
  const posts = [];
  const postSeen = new Set(), steelJobs = [];

  for (const c of cells) {
    const h = tops[c.id];
    if (h === 0) continue;
    w.at?.(c);   // 分块：这一格的三角形写进它所在的块（world/worldmesh.js）
    const wall = wallColor(c);
    const mosaic = 0.965 + 0.07 * hash01(c.id * 2654435761 + 3);

    for (let i = 0; i < c.n; i++) {
      const nb = nbr(c, i);
      const nbTop = nb ? tops[nb.id] : 0;
      const edgeLen = Math.hypot(c.pts[(i + 1) % c.n].x - c.pts[i].x, c.pts[(i + 1) % c.n].z - c.pts[i].z);
      const wallDeco=new Map(),wallRun=new Map();
      if(world.surfaceWFC){
        let lo=2;
        while(lo<=h){
          if(!world.isBuilt(c,lo)||solid(nb,lo)){lo++;continue;}
          let hi=lo;while(hi<h&&world.isBuilt(c,hi+1)&&!solid(nb,hi+1))hi++;
          const runHit=facadeRuns.get(c.id+':'+i+':'+lo);
          if(runHit){const{run,offset,width}=runHit;for(let lv=lo;lv<=hi;lv++){const row=run.styles.slice((lv-lo)*run.width,(lv-lo+1)*run.width);wallDeco.set(lv,row.slice(offset,offset+width));wallRun.set(lv,runHit);}lo=hi+1;continue;}
          const hasDoor=lo===2&&door.get(house[c.id])?.key===c.id+':'+i;
          const width=world.surfaceFacade?(edgeLen>=.70?3:hasDoor?1:edgeLen>=.46?2:1):2;
          const solved=world.surfaceFacade?solveFacadeDecoration(hi-lo+1,{width,seed:c.id*131+i*17+lo*7,entry:hasDoor?(hash01(c.id*31+i)<.5?'arch':'door'):null}):solveWallDecoration(hi-lo+1,{width,seed:c.id*131+i*17+lo*7,doors:hasDoor?[0]:[]});
          if(solved.ok&&solved.violations.length===0){decoSolved++;for(let lv=lo;lv<=hi;lv++)wallDeco.set(lv,solved.styles.slice((lv-lo)*width,(lv-lo+1)*width));}else decoFailures++;
          lo=hi+1;
        }
      }
      for (let lv = 1; lv <= h; lv++) {
        if (!world.isBuilt(c, lv) || solid(nb, lv)) continue;
        if (lv === 1) { plinth(c, i); continue; }
        const y0 = (lv - 1) * L, y1 = lv * L;
        const runStart = !world.isBuilt(c, lv - 1) || lv === 2 || solid(nb, lv - 1);
        const sig = moduleSig(c, lv);
        moduleSigs.add(sig);
        const wc = debugModules ? sigColor(sig) : wall;
        // r55 surfacedeco: world.archCutout — an arch entry on this wall cuts a real hole, so the body waits for the slot pass.
        const cutArch = !!(world.archCutout && world.surfaceFacade && wallDeco.get(lv)?.includes('arch'));
        let archHole = null;
        const drawBody = (hole) => {
          if (runStart) {
            wallStrip(c, i, y0, y0 + 0.045, wc, 0.55, hole);       // 深色勒脚
            wallStrip(c, i, y0 + 0.045, y1, wc, mosaic, hole);
          } else {
            wallStrip(c, i, y0, y1, wc, mosaic, hole);
          }
        };
        if (!cutArch) drawBody(churchHole?.get(c.id + ':' + i) ?? null);
        const hk = c.id * 131 + i * 17 + lv * 7;
        const isDoor = lv === 2 && door.get(house[c.id])?.key === c.id + ':' + i;
        if(world.surfaceFacade&&wallDeco.has(lv)){
          const placedSlots=new Set();
          const slots=[...wallDeco.get(lv).entries()].sort((a,b)=>Number(a[1].startsWith('shutter'))-Number(b[1].startsWith('shutter')));
          for(const[x,style]of slots){
            if(style==='none')continue;
            const t=(x+.5)/wallDeco.get(lv).length,entry=style==='door'||style==='arch',shutter=style.startsWith('shutter'),tall=style==='window2',ww=entry?.12:shutter?.05:tall?.075:.085;
            const partner=style==='shutterL'?x-1:x+1,rh=wallRun.get(lv),rowLen=wallDeco.get(lv).length;
            if(shutter&&rh&&(partner<0||partner>=rowLen)){deferredShutters.push({c,i,t,lv,ww,y:y0+L*.4,key:rh.run.id+':'+lv+':'+(rh.offset+partner),slot:x,style,run:rh.run.id,global:rh.offset+x});continue;}
            if(shutter&&!placedSlots.has(partner)){decoDropped++;continue;}
            if(!tryPlace(c,i,t,lv,ww,entry)){decoDropped++;continue;}
            placedSlots.add(x);
            if(rh)placedRunSlots.add(rh.run.id+':'+lv+':'+(rh.offset+x));
            if(style==='arch'){archedEntry(c,i,t,y0+.03,.12,.22,cutArch);if(cutArch){archHole={t,y:y0+.03,width:.12,height:.22};archHoles.push({cell:c.id,edge:i,level:lv,...archHole,y0,y1,len:edgeLen,depth:world.archCutDepth??.07});decoDrawn.archHole=(decoDrawn.archHole??0)+1;}}
            else if(shutter)shutterPanel(c,i,t,y0+L*.4,ww,.14);
            else opening(c,i,t,y0+(entry?.03:L*(tall?.28:.35)),ww,entry?.22:tall?.13:.095,entry,!tall);
            decoPlacements.push({cell:c.id,edge:i,level:lv,slot:x,style,partner:shutter?partner:null,run:rh?rh.run.id:null,global:rh?rh.offset+x:null});
            const kind=shutter?'shutter':style;decoDrawn[kind]=(decoDrawn[kind]??0)+1;
          }
        } else if (isDoor) {
          if (tryPlace(c, i, 0.5, lv, 0.12, true)) opening(c, i, 0.5, y0 + 0.03, 0.12, 0.22, true);
        } else if(wallDeco.has(lv)){
          for(const[x,style]of wallDeco.get(lv).entries()){
            if(style==='blank')continue;
            const t=x===0?.25:.75,tall=style==='tall',ww=tall?.075:.085,hh=tall?.13:.095;
            if(tryPlace(c,i,t,lv,ww))opening(c,i,t,y0+L*(tall?.28:.35),ww,hh,false,!tall);
          }
        } else if (hash01(hk + 1) < 0.85) {
          // Local component/layer hash, not a full surface-decoration WFC; placement checks remain separate.
          const st = windowStyle(c, lv), wy = y0 + L * 0.35;
          // 1176516621223043073：窗接近正方（0.085 宽 ≈ 0.095 高），不是 1:1.65 的窄条
          const cand = st === 1 ? [[0.3, 0.082, 0.095], [0.7, 0.082, 0.095]]
            : st === 2 ? [[0.5, 0.075, 0.13]]
            : [[0.5, 0.09, 0.095]];
          // 双窗放不下（墙短）就退成单窗；单窗还放不下就算了
          let any = false;
          for (const [t, ww, hh] of cand) if (tryPlace(c, i, t, lv, ww)) { opening(c, i, t, st === 2 ? y0 + L * 0.28 : wy, ww, hh, false, st !== 2); any = true; }
          if (!any && st === 1 && tryPlace(c, i, 0.5, lv, 0.085)) opening(c, i, 0.5, wy, 0.085, 0.095, false, true);
        }
        if (cutArch) drawBody(archHole ?? churchHole?.get(c.id + ':' + i) ?? null);
      }
    }

    for (let lv = 1; lv <= h; lv++) {
      if (!world.isBuilt(c, lv)) continue;
      const runTop = !world.isSolid(c, lv + 1);
      const runBottom = lv > 1 && !world.isSolid(c, lv - 1);
      if (runTop && lv < h) {
        const y = lv * L;
        w.poly(c.pts.map((p) => [p.x, y, p.z]), UP, lv === 1 ? K.paving : wall, 0.92);
      }
      if (runTop && lv === h && h === 1) {
        const y = L + 0.006;
        if (gardenC07 && yard[c.id]) drawGardenCellC07(w, c, y, gardenC07, K, nbr);   // r56 C07
        else if (yard[c.id] && path[c.id]) {
          // 小径：浅色石板，四周留一道缝
          w.poly(c.pts.map((p) => [p.x, y, p.z]), UP, K.pavingAlt, 0.82);
          w.poly(c.pts.map((p) => [mix(p.x, c.cx, 0.1), y + 0.003, mix(p.z, c.cz, 0.1)]), UP, K.stone, 1.12 + 0.06 * hash01(c.id));
        } else if (yard[c.id]) {
          w.poly(c.pts.map((p) => [p.x, y, p.z]), UP, hash01(c.id * 5) < 0.5 ? K.lawn : K.lawnAlt, 0.97 + 0.06 * hash01(c.id));
        } else {
          const pc = hash01(c.id * 5) < 0.5 ? K.paving : K.pavingAlt;
          w.poly(c.pts.map((p) => [p.x, y, p.z]), UP, pc, 0.78);           // 砖缝
          const ins = c.pts.map((p) => [mix(p.x, c.cx, 0.07), y + 0.003, mix(p.z, c.cz, 0.07)]);
          w.poly(ins, UP, pc, 0.97 + 0.08 * hash01(c.id));
        }
        for (let i = 0; i < c.n; i++) {
          const nb = nbr(c, i);
          if (nb === null || tops[nb.id] === 0) railings.push([c, i]);
        }
      }
      if (runBottom) underside(c, lv, wall);
    }
  }

  /** 悬空段的底部：两侧（对边）在下一层都有支撑 → 拱；否则平底 + 钢架。 */
  function underside(c, lv, wall) {
    const yBase = (lv - 1) * L;
    let floorLv = 0;
    for (let l = lv - 1; l >= 1; l--) if (world.isSolid(c, l)) { floorLv = l; break; }
    const yFloor = floorLv * L;
    const below = lv - 1;

    // 拱要有一对对边：只有方格有（三角格没有对边 → 平底 + 钢架）
    const axis = c.n === 4 ? [0, 1].find((i) => solid(nbr(c, i), below) && solid(nbr(c, i + 2), below)) : undefined;
    if (axis !== undefined) {
      const i = axis;
      const A0 = c.pts[i], A1 = c.pts[(i + 1) % 4], B1 = c.pts[(i + 2) % 4], B0 = c.pts[(i + 3) % 4];
      const P = (u, v, y) => {
        const x0 = mix(A0.x, B0.x, u), z0 = mix(A0.z, B0.z, u), x1 = mix(A1.x, B1.x, u), z1 = mix(A1.z, B1.z, u);
        return [mix(x0, x1, v), y, mix(z0, z1, v)];
      };
      const budget=archFloorBudget({base:yBase,floor:yFloor,storey:L,slab:world.archSlab??.05});
      const {rise,crown}=budget;
      const span=Math.max(Math.hypot(B0.x-A0.x,B0.z-A0.z),Math.hypot(B1.x-A1.x,B1.z-A1.z));
      const profile=archProfile(span,rise,{tolerance:world.archTolerance??.0025});
      // Error measured after the actual cage map on both open faces, not only in the flat profile.
      const deformedError=Math.max(...[0,1].map(v=>deformedArchError(profile,rise,(u,h)=>P(u,v,crown-rise+h))));
      const pierce=openingPierce(budget,{storey:L});
      archBudgets.push({cell:c.id,level:lv,...budget,segments:profile.segments,errorBound:profile.errorBound,deformedError,slabsCut:pierce.slabsCut,corniceContinuous:pierce.corniceContinuous,span,axis:i,floorLevel:floorLv,points:profile.points,quad:[A0,A1,B1,B0].map(p=>[p.x,p.z])});
      // r55 piercefloor lintel: the slab band between crown and voxel base on each open face (thickness = slab budget).
      if (world.lintels && !world.archVoussoirs) for (const [v, ei] of [[0, (i + 3) % 4], [1, (i + 1) % 4]]) {
        if (solid(nbr(c, ei), below)) continue;
        const [nx, nz] = edgeOut(c, ei), o = .012, Pm = (u, y, oo) => { const p = P(u, v, y); return [p[0] + nx * oo, y, p[2] + nz * oo]; };
        w.quad(Pm(0, crown, o), Pm(1, crown, o), Pm(1, yBase, o), Pm(0, yBase, o), [nx, 0, nz], K.stone, 1.02);
        w.quad(Pm(0, crown, 0), Pm(1, crown, 0), Pm(1, crown, o), Pm(0, crown, o), DOWN, K.stone, .7);
        lintels.push({ cell: c.id, edge: ei, level: lv, kind: 'arch', y0: crown, y1: yBase, thickness: yBase - crown, slab: budget.slab, storeyTop: yBase, width: span });
      }
      archCount++;archSegments+=profile.segments;
      const soffit = wall.clone().multiplyScalar(0.72);
      for (let s = 0; s < profile.segments; s++) {
        const p0=profile.points[s],p1=profile.points[s+1],u0=p0.u,u1=p1.u;
        const y0=crown-rise+p0.height,y1=crown-rise+p1.height;
        w.quad(P(u0, 0, y0), P(u1, 0, y1), P(u1, 1, y1), P(u0, 1, y0), [0, -1, 0], soffit, 0.9);
        for (const [v, ei] of [[0, (i + 3) % 4], [1, (i + 1) % 4]]) {
          if (solid(nbr(c, ei), below)) continue;
          const [nx, nz] = edgeOut(c, ei);
          w.quad(P(u0, v, y0), P(u1, v, y1), P(u1, v, yBase), P(u0, v, yBase), [nx, 0, nz], wall, 0.97);
        }
      }
      // Optional archvoid wedge ring on each open face; thickness stays inside the slab budget.
      if (world.archVoussoirs) {
        const ring=archVoussoirs(span,rise,{thickness:Math.min(world.archVoussoirThickness??.04,budget.slab*.999),count:world.archVoussoirCount??9});
        for (const [v, ei, o] of [[0, (i + 3) % 4, -1], [1, (i + 1) % 4, 1]]) {
          if (solid(nbr(c, ei), below)) continue;
          const [nx, nz] = edgeOut(c, ei), off = .006;
          const Q = (q) => { const p = P(q.u, v, crown - rise + q.y); return [p[0] + nx * off, p[1], p[2] + nz * off]; };
          for (const wd of ring.wedges) {
            const key = wd === ring.keystone;
            w.quad(Q(wd.quad[0]), Q(wd.quad[3]), Q(wd.quad[2]), Q(wd.quad[1]), [nx, 0, nz], key ? K.stoneDark : K.frame, key ? 1 : .94 + .06 * (wd.index % 2));
            archWedges++;
            archVoussoirLog.push({cell:c.id,level:lv,face:v,wedge:wd.index,keystone:key,maxY:Math.max(...wd.quad.map(q=>crown-rise+q.y)),base:yBase,dir:o});
          }
        }
      }
      return;
    }

    w.poly(c.pts.map((p) => [p.x, yBase, p.z]), DOWN, wall.clone().multiplyScalar(0.6), 1);
    if (world.steelFrame) { steelJobs.push({ c, lv }); return; }
    const legs = [];
    for (let k = 0; k < c.n; k++) {
      const p = c.pts[k];
      const sharing = grid.vertexCells.get(p.id) || [];
      if (sharing.some((id) => world.isSolid(cells[id], below))) continue;  // 角上已有墙托着
      legs.push(k);
      const key = p.id * 64 + lv;
      if (postSeen.has(key)) continue;
      postSeen.add(key);
      const x = mix(p.x, c.cx, 0.06), z = mix(p.z, c.cz, 0.06);
      w.beam([x, yFloor, z], [x, yBase, z], 0.045, K.steel, 1);
      if (floorLv === 0) posts.push({ x, z });
    }
    for (let e = 0; e < c.n; e++) {
      const k0 = e, k1 = (e + 1) % c.n;
      if (!legs.includes(k0) || !legs.includes(k1)) continue;
      const p0 = c.pts[k0], p1 = c.pts[k1];
      const a = [mix(p0.x, c.cx, 0.06), mix(p0.z, c.cz, 0.06)];
      const b = [mix(p1.x, c.cx, 0.06), mix(p1.z, c.cz, 0.06)];
      const yg = yBase - 0.05;
      const drop = Math.min(0.25, (yBase - yFloor) * 0.4);
      w.beam([a[0], yg, a[1]], [b[0], yg, b[1]], 0.035, K.steel, 0.95);
      w.beam([a[0], yg - drop, a[1]], [mix(a[0], b[0], 0.3), yg, mix(a[1], b[1], 0.3)], 0.022, K.steel, 0.9);
      w.beam([b[0], yg - drop, b[1]], [mix(b[0], a[0], 0.3), yg, mix(b[1], a[1], 0.3)], 0.022, K.steel, 0.9);
    }
  }

  // Cross-cell shutters: drawn only once the partner window in the neighbouring wall segment was actually placed.
  for (const d of deferredShutters) {
    w.at?.(d.c);
    if (!placedRunSlots.has(d.key) || !tryPlace(d.c, d.i, d.t, d.lv, d.ww)) { decoDropped++; continue; }
    shutterPanel(d.c, d.i, d.t, d.y, d.ww, .14);
    decoPlacements.push({ cell: d.c.id, edge: d.i, level: d.lv, slot: d.slot, style: d.style, partner: null, run: d.run, global: d.global, crossCell: true });
    decoDrawn.shutter = (decoDrawn.shutter ?? 0) + 1;
  }

  /* ---- 栏杆 ---------------------------------------------------------------- */
  for (const [c, i] of railings) {
    w.at?.(c);
    const a = c.pts[i], b = c.pts[(i + 1) % c.n];
    const [nx, nz] = edgeOut(c, i);
    const ax = a.x - nx * 0.035, az = a.z - nz * 0.035, bx = b.x - nx * 0.035, bz = b.z - nz * 0.035;
    const y = L;
    w.beam([ax, y + 0.13, az], [bx, y + 0.13, bz], 0.018, K.rail, 1);
    w.beam([ax, y + 0.07, az], [bx, y + 0.07, bz], 0.01, K.rail, 0.95);
    const count = Math.max(2, Math.round(Math.hypot(bx - ax, bz - az) / 0.16) + 1);
    for (let k = 0; k < count; k++) {
      const t = k / (count - 1);
      w.beam([mix(ax, bx, t), y, mix(az, bz, t)], [mix(ax, bx, t), y + 0.13, mix(az, bz, t)], k === 0 || k === count - 1 ? 0.022 : 0.009, K.rail, 1);
    }
  }

  /* ---- 屋顶 ---------------------------------------------------------------- */
  const chimneys = [], roofStats = { gables: 0, hipCells: 0, hipRegions: 0, eaveSpread: 0, hipAudit: [] };
  buildRoofs(w, world, { L, tops, K, wallColor, chimneys, roofStats });
  const steel = world.steelFrame ? emitSteelFrame(w, world, steelJobs, { L, K, posts }) : null;

  /* ---- 后院的树 ------------------------------------------------------------- */
  let yards = 0;
  const yardProps = [];
  for (const c of cells) {
    if (!yard[c.id]) continue;
    w.at?.(c);
    yards++;
    if (path[c.id]) continue;          // 小径上不种树
    const r = hash01(c.id * 977 + 5);
    const y = L + 0.006;
    if (world.yardProps) {
      // 1205416648397721601: saturate the yard cell with non-overlapping rigid props; trees reserve their crown.
      const obstacles = [];
      if (r < 0.7) {
        const s = r < 0.45 ? (r < 0.25 ? 0.15 : 0.11) : 0.09, x = r < 0.45 ? c.cx + (hash01(c.id * 31) - 0.5) * 0.1 : c.cx, z = r < 0.45 ? c.cz + (hash01(c.id * 37) - 0.5) * 0.1 : c.cz;
        obstacles.push({ poly: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => ({ x: x + a * s, z: z + b * s })) });
      }
      const plan = placeProps(c.pts.map(p => ({ x: p.x, z: p.z })), { seed: c.id * 7919 + 13, tries: world.yardPropTries ?? 120, frame: 'std', obstacles });
      for (const p of plan.props) {
        if (world.yardPropArt) { p.kind = drawYardProp(w, p, y, K); continue; }   // r56 C05·C：桌 / 箱 / 盆栽（同一 footprint）
        const hgt = .03 + .05 * hash01(Math.round(p.x * 1e4) ^ Math.round(p.z * 1e4)), top = p.poly.map(q => [q.x, y + hgt, q.z]), bot = p.poly.map(q => [q.x, y, q.z]);
        w.poly(top, UP, K.door, 1.05);
        for (let k = 0; k < 4; k++) { const a = p.poly[k], b = p.poly[(k + 1) % 4], l = Math.hypot(b.x - a.x, b.z - a.z) || 1; w.quad(bot[k], bot[(k + 1) % 4], top[(k + 1) % 4], top[k], [(b.z - a.z) / l, 0, -(b.x - a.x) / l], K.door, .85); }
      }
      yardProps.push({ cell: c.id, count: plan.props.length, coverage: plan.coverage, frameDevMax: plan.frameDevMax, props: plan.props, obstacles });
    }
    if (world.propAnimYard) continue;   // r56：后院植物交给 prop-anim 层（world/prop-anim-layer.js）做出现/消失
    if (r < 0.45) {
      const big = r < 0.25;
      const s = big ? 0.15 : 0.11;
      const x = c.cx + (hash01(c.id * 31) - 0.5) * 0.1, z = c.cz + (hash01(c.id * 37) - 0.5) * 0.1;
      w.beam([x, y, z], [x, y + s * 1.3, z], 0.035, K.trunk, 1);
      w.blob(x, y + s * 1.6, z, s, s * 0.95, big ? K.tree : K.treeLight);
      if (big) w.blob(x + s * 0.35, y + s * 2.25, z - s * 0.2, s * 0.7, s * 0.65, K.treeLight);
    } else if (r < 0.7) {
      w.blob(c.cx, y + 0.05, c.cz, 0.09, 0.07, K.treeLight);
    }
  }

  const yardWalls = world.yardWalls ? drawYardWalls(w, world, planYardWalls(world, { components: yardComps, path }), { L, K }) : null;
  const yardCells = new Set(), pathCells = new Set();
  for (let i = 0; i < n; i++) { if (yard[i]) yardCells.add(i); if (path[i]) pathCells.add(i); }
  return { canalBridges, churchDoors: churchDoorLog, openings: openingLog, steel, yardWalls, lintels, archHoles, archCuts, facadeRuns: facadeRunList,yardProps,roofStats,archBudgets,archWedges,archVoussoirLog,decoPlacements,decoDrawn,decoDropped,decoSolved,decoFailures,archCount,archSegments,decorationGroups: decoration.components.length, posts, yards, yardCells, pathCells, yardOpenings: courtyard.openComponents, chimneys, modules: moduleSigs.size, doors: door.size };
}

/**
 * 双坡顶：每个体量（同高相邻的建筑顶）在半格点阵（格角、边中点、格心）上算
 * "到檐口的距离"，屋顶高度 = 距离 × 坡度。一格宽排屋的远端、孤立格的两条短边
 * 不算檐口 → 屋脊直通到那里，补一块墙色的山墙三角。
 */
function buildRoofs(w, world, { L, tops, K, wallColor, chimneys = [], roofStats = {} }) {
  const { regions } = world.regions();
  const slope = 1.3, cap = 0.27, overhang = 0.055, thick = 0.045;
  const nbr = (c, i) => world.neighbor(c, i);

  for (const region of regions) {
    const h = region.h;
    if (h < 2) continue;
    const base = h * L;
    const inRegion = new Set(region.cells.map((c) => c.id));
    // r55 housekit: per-region pitch from the REACode 8-step pool (village spec or hashed pool); default keeps 1.3.
    const spec = roofSpecFor(world, region);
    const slopeR = spec ? Math.tan(spec.pitch * Math.PI / 180) : slope;
    if (world.hipSkeleton) { skeletonRegionRoof(w, world, region, { L, base, slope: slopeR, spec, cap: world.hipSkeletonCap ?? cap, overhang, thick, K, chimneys, roofStats, inRegion }); continue; }

    // 每条边：1 = 檐口，2 = 山墙，0 = 内部 / 贴着更高的墙
    const flags = new Map();
    for (const c of region.cells) {
      w.at?.(c);
      const f = new Array(c.n).fill(0);
      for (let i = 0; i < c.n; i++) {
        const nb = nbr(c, i);
        if (nb && inRegion.has(nb.id)) continue;
        if (nb && tops[nb.id] > h) continue;
        f[i] = 1;
      }
      const cnt = f.reduce((a, b) => a + b, 0);
      // 山墙规则只对方格成立（要有"对边"）；三角格的屋顶是小四坡 / 三坡顶
      if (c.n !== 4) { /* 保持全部是檐口 */ }
      // hipRoofsJoined: row ends keep their eave, so the shared equal-pitch
      // distance-to-eave field closes multi-cell blocks with hipped ends (no gable walls).
      else if (cnt === 3 && !world.hipRoofsJoined) {
        const ge = (f.indexOf(0) + 2) % 4;
        if (f[(ge + 1) % 4] && f[(ge + 3) % 4]) f[ge] = 2;
      } else if (cnt === 4 && !world.hipRoofs && !world.hipRoofsJoined) {
        const m = (i) => [(c.pts[i].x + c.pts[(i + 1) % 4].x) / 2, (c.pts[i].z + c.pts[(i + 1) % 4].z) / 2];
        const d02 = Math.hypot(m(0)[0] - m(2)[0], m(0)[1] - m(2)[1]);
        const d13 = Math.hypot(m(1)[0] - m(3)[0], m(1)[1] - m(3)[1]);
        if (d02 >= d13) { f[0] = 2; f[2] = 2; } else { f[1] = 2; f[3] = 2; }
      }
      flags.set(c.id, f);
    }

    const eaves = [];
    for (const c of region.cells) {
      w.at?.(c);
      const f = flags.get(c.id);
      for (let i = 0; i < c.n; i++) if (f[i] === 1) eaves.push([c.pts[i], c.pts[(i + 1) % c.n]]);
    }

    const roofTris = new Map(region.cells.map(c => [c.id, []]));
    const pts = new Map();
    const pt = (key, x, z) => {
      let p = pts.get(key);
      if (!p) pts.set(key, (p = { x, z, nx: 0, nz: 0, onEdge: false, y: 0, ox: x, oz: z }));
      return p;
    };
    const lat = new Map();
    for (const c of region.cells) {
      w.at?.(c);
      const cs = c.pts.map((p) => pt('v' + p.id, p.x, p.z));
      const ms = c.pts.map((_, i) => {
        const a = c.pts[i], b = c.pts[(i + 1) % c.n];
        return pt(a.id < b.id ? `e${a.id}_${b.id}` : `e${b.id}_${a.id}`, (a.x + b.x) / 2, (a.z + b.z) / 2);
      });
      const ctr = pt('c' + c.id, c.cx, c.cz);
      lat.set(c.id, { cs, ms, ctr });
      const f = flags.get(c.id);
      for (let i = 0; i < c.n; i++) {
        if (!f[i]) continue;
        const [nx, nz] = edgeOut(c, i);
        for (const p of [cs[i], ms[i], cs[(i + 1) % c.n]]) { p.nx += nx; p.nz += nz; p.onEdge = true; }
      }
    }
    for (const p of pts.values()) {
      let best = Infinity;
      for (const [a, b] of eaves) best = Math.min(best, segDist(p.x, p.z, a.x, a.z, b.x, b.z));
      const d = eaves.length ? best : 0.3;
      p.y = base + Math.min(d, cap) * slopeR;
      if (p.onEdge) {
        const l = Math.hypot(p.nx, p.nz) || 1;
        p.ox = p.x + (p.nx / l) * overhang;
        p.oz = p.z + (p.nz / l) * overhang;
        if (d < 1e-3) p.y -= 0.02;
      }
    }
    if (roofStats.hipAudit) {
      let gables = 0, lo = Infinity, hi = -Infinity;
      for (const f of flags.values()) gables += f.filter(x => x === 2).length;
      for (const c of region.cells) { const f = flags.get(c.id); for (let i = 0; i < c.n; i++) if (f[i] === 1) for (const q of [c.pts[i], c.pts[(i + 1) % c.n]]) { const y = pts.get('v' + q.id).y; lo = Math.min(lo, y); hi = Math.max(hi, y); } }
      roofStats.gables += gables;
      if (hi >= lo) roofStats.eaveSpread = Math.max(roofStats.eaveSpread, hi - lo);
      if (!gables) { roofStats.hipRegions++; roofStats.hipCells += region.cells.length; }
      roofStats.hipAudit.push({ h, cells: region.cells.length, gables, eaveLo: lo, eaveHi: hi, base });
    }

    for (const c of region.cells) {
      w.at?.(c);
      const { cs, ms, ctr } = lat.get(c.id);
      const shade = 0.96 + 0.08 * hash01(c.id * 977 + 11);
      const roof = hash01(c.id * 13) < 0.5 ? K.roof : K.roofAlt;
      const P = (p) => [p.ox, p.y, p.oz];
      // Optional four-eave roof on isolated quads only. Existing joined roofs stay intact.
      if ((world.hipRoofs || world.hipRoofsJoined) && c.n === 4 && flags.get(c.id).every(f => f === 1)) {
        roofStats.isolatedHips = (roofStats.isolatedHips ?? 0) + 1;
        const edgeLength=i=>Math.hypot(cs[i].ox-cs[(i+1)%4].ox,cs[i].oz-cs[(i+1)%4].oz);
        const width=(edgeLength(0)+edgeLength(2))/2, depth=(edgeLength(1)+edgeLength(3))/2;
        const rise=Math.min(Math.min(width,depth)/2,cap)*slopeR;
        const hip=hipRoof(width,depth,rise);
        const map=([u,v,y])=>{
          const weights=[(1-u)*(1-v),u*(1-v),u*v,(1-u)*v];
          return [cs.reduce((sum,p,i)=>sum+p.ox*weights[i],0),base-.02+y,cs.reduce((sum,p,i)=>sum+p.oz*weights[i],0)];
        };
        for(const face of hip.faces)for(let i=1;i<face.length-1;i++){w.tri(map(face[0]),map(face[i]),map(face[i+1]),UP,roof,shade);roofTris.get(c.id).push([map(face[0]),map(face[i]),map(face[i+1])]);}
        ctr.y=base-.02+rise;
      } else for (let i = 0; i < c.n; i++) {
        w.tri(P(cs[i]), P(ms[i]), P(ctr), UP, roof, shade);
        w.tri(P(cs[i]), P(ctr), P(ms[(i + c.n - 1) % c.n]), UP, roof, shade);
        roofTris.get(c.id).push([P(cs[i]), P(ms[i]), P(ctr)], [P(cs[i]), P(ctr), P(ms[(i + c.n - 1) % c.n])]);
      }
    }

    for (const c of region.cells) {
      w.at?.(c);
      const { cs, ms } = lat.get(c.id);
      const f = flags.get(c.id);
      const wall = wallColor(c);
      for (let i = 0; i < c.n; i++) {
        if (!f[i]) continue;
        const [nx, nz] = edgeOut(c, i);
        const out = [nx, 0, nz];
        const seq = [cs[i], ms[i], cs[(i + 1) % c.n]];
        for (let s = 0; s < 2; s++) {
          const p = seq[s], q = seq[s + 1];
          w.quad([p.ox, p.y, p.oz], [q.ox, q.y, q.oz], [q.ox, q.y - thick, q.oz], [p.ox, p.y - thick, p.oz], out, K.roofTrim, 1);
          w.quad([p.ox, p.y - thick, p.oz], [q.ox, q.y - thick, q.oz], [q.x, q.y - thick - 0.01, q.z], [p.x, p.y - thick - 0.01, p.z], DOWN, K.roofTrim, 0.6);
        }
        if (f[i] === 2) {
          const a = c.pts[i], b = c.pts[(i + 1) % c.n], mid = ms[i];
          w.tri([a.x, base, a.z], [b.x, base, b.z], [mid.x, mid.y - thick, mid.z], out, wall, 0.98);
          const wy = base + (mid.y - base) * 0.32;
          const P2 = (t, y, o) => [mix(a.x, b.x, t) + nx * o, y, mix(a.z, b.z, t) + nz * o];
          if (mid.y - base > 0.16) {
            w.quad(P2(0.44, wy - 0.012, 0.006), P2(0.56, wy - 0.012, 0.006), P2(0.56, wy + 0.1, 0.006), P2(0.44, wy + 0.1, 0.006), out, K.frame, 1);
            w.quad(P2(0.465, wy, 0.01), P2(0.535, wy, 0.01), P2(0.535, wy + 0.08, 0.01), P2(0.465, wy + 0.08, 0.01), out, K.glass, 1, 1);
          }
        }
      }
    }

    for (const c of region.cells) {
      w.at?.(c);
      if (hash01(c.id * 4099 + h) > 0.12) continue;
      const { ctr, ms } = lat.get(c.id);
      if (world.houseKit) {
        // housekit constraint 4: chimney sits on a slope, base on the drawn roof surface.
        const f = flags.get(c.id), e = f.findIndex(x => x === 1);
        const seat = e < 0 ? null : seatChimney(roofTris.get(c.id), [ctr.x, ctr.y, ctr.z], [ms[e].ox, ms[e].y, ms[e].oz]);
        if (seat) {
          const hgt = seat.top - seat.base + .12;
          w.box(seat.x, seat.base, seat.z, seat.half * 2, hgt, seat.half * 2, K.chimney, 1);
          w.box(seat.x, seat.base + hgt, seat.z, seat.half * 2 + .02, 0.025, seat.half * 2 + .02, K.roofTrim, 1);
          chimneys.push({ x: seat.x, y: seat.base + hgt + .03, z: seat.z, cell: c.id, seat });
          continue;
        }
      }
      w.box(ctr.x + 0.05, ctr.y - 0.06, ctr.z, 0.07, 0.16, 0.07, K.chimney, 1);
      w.box(ctr.x + 0.05, ctr.y + 0.1, ctr.z, 0.09, 0.025, 0.09, K.roofTrim, 1);
      chimneys.push({ x: ctr.x + 0.05, y: ctr.y + 0.13, z: ctr.z });   // 火的发射点（effects.js）
    }
  }
}

/** Region roof spec: explicit village spec (world.roofSpecs, cellId → {pitch, thatch}) wins,
 * then the hashed 8-step pool (world.housePitchPool), else null (legacy slope 1.3). */
function roofSpecFor(world, region) {
  if (world.roofSpecs) for (const c of region.cells) { const sp = world.roofSpecs.get(c.id); if (sp) return sp; }
  if (!world.housePitchPool && !world.thatchRoofs) return null;
  const minId = Math.min(...region.cells.map(c => c.id));
  return { pitch: world.housePitchPool ? PITCHES[Math.floor(hash01(minId * 7919 + region.h * 31) * PITCHES.length) % PITCHES.length] : Math.atan(1.3) * 180 / Math.PI, thatch: !!world.thatchRoofs, pooled: true };
}

/** r55 hiproof/housekit: exact straight-skeleton roof over the whole region (every edge is an
 * eave, courtyards are hole loops, valleys are reflex-vertex trajectories). Optional thatch:
 * faces cut into courses, alternating straw tones, each course's lower edge lifted with a riser. */
function skeletonRegionRoof(w, world, region, { L, base, slope, spec, cap, overhang, thick, K, chimneys, roofStats, inRegion }) {
  const { rings } = regionRings(region.cells, (id) => inRegion.has(id));
  const thatch = !!spec?.thatch, course = thatch ? (world.thatchCourse ?? .06) : 0, lift = thatch ? (world.thatchLift ?? .014) : 0;
  const R = skeletonRoof(rings, { base, slope, overhang, cap, course, lift });
  const minId = Math.min(...region.cells.map(c => c.id));
  const tile = hash01(minId * 13) < 0.5 ? K.roof : K.roofAlt, straw = THATCH.map(x => w.c(x));
  const route = (pts) => { if (!w.at) return; const x = (pts[0][0] + pts[1][0] + pts[2][0]) / 3, z = (pts[0][2] + pts[1][2] + pts[2][2]) / 3; let best = region.cells[0], bd = Infinity; for (const c of region.cells) { const d = (c.cx - x) ** 2 + (c.cz - z) ** 2; if (d < bd) { bd = d; best = c; } } w.at(best); };
  const tris = [];
  for (let k = 0; k < R.tris.length; k++) {
    const t = R.tris[k], m = R.meta[k];
    const shade = m.flat ? 0.93 : 0.95 + 0.08 * hash01(minId * 31 + (m.edge?.index ?? 0) * 7 + (m.edge?.ring ?? 0) * 101);
    route(t);
    w.tri(t[0], t[1], t[2], UP, thatch ? straw[m.flat ? 0 : m.band & 1] : tile, thatch && !m.flat ? shade * (m.band & 1 ? 0.92 : 1.03) : shade);
    tris.push(t);
  }
  let risers = 0;
  if (thatch) for (const pc of R.sk.pieces) {
    if (pc.band < 1) continue;
    const t0 = -overhang + pc.band * course, P = pc.poly;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      if (Math.abs(a.t - t0) > 1e-9 || Math.abs(b.t - t0) > 1e-9 || Math.hypot(b.x - a.x, b.z - a.z) < 1e-6) continue;
      const y = base + Math.min(t0, cap) * slope, q = [[a.x, y, a.z], [b.x, y, b.z], [b.x, y + lift, b.z], [a.x, y + lift, a.z]];
      route(q); w.quad(q[0], q[1], q[2], q[3], [-pc.n[0], 0, -pc.n[1]], straw[2], 0.85); risers++;
    }
  }
  // eave fascia + soffit along the offset outline
  const ye = R.eaveY;
  for (const ring of rings) {
    const off = offsetRing(ring, overhang);
    for (let i = 0; i < ring.length; i++) {
      const j = (i + 1) % ring.length, A = ring[i], B = ring[j], Ao = off[i], Bo = off[j], l = Math.hypot(B.x - A.x, B.z - A.z) || 1, out = [(B.z - A.z) / l, 0, -(B.x - A.x) / l];
      const q = [[Ao.x, ye, Ao.z], [Bo.x, ye, Bo.z], [Bo.x, ye - thick, Bo.z], [Ao.x, ye - thick, Ao.z]];
      route(q);
      w.quad(q[0], q[1], q[2], q[3], out, thatch ? straw[2] : K.roofTrim, 1);
      w.quad([Ao.x, ye - thick, Ao.z], [Bo.x, ye - thick, Bo.z], [B.x, ye - thick - 0.01, B.z], [A.x, ye - thick - 0.01, A.z], DOWN, thatch ? straw[2] : K.roofTrim, 0.6);
    }
  }
  // chimneys seated on the drawn skeleton surface
  for (const c of region.cells) {
    if (hash01(c.id * 4099 + region.h) > 0.12) continue;
    const e = c.edgeNeighbors.findIndex((id) => !(id >= 0 && inRegion.has(id)));
    const a = c.pts[Math.max(0, e)], b = c.pts[(Math.max(0, e) + 1) % c.n];
    const seat = seatChimney(tris, [c.cx, 0, c.cz], e < 0 ? [c.cx + 0.05, 0, c.cz] : [(a.x + b.x) / 2, 0, (a.z + b.z) / 2]);
    if (!seat) continue;
    w.at?.(c);
    const hgt = seat.top - seat.base + .12;
    w.box(seat.x, seat.base, seat.z, seat.half * 2, hgt, seat.half * 2, K.chimney, 1);
    w.box(seat.x, seat.base + hgt, seat.z, seat.half * 2 + .02, 0.025, seat.half * 2 + .02, K.roofTrim, 1);
    chimneys.push({ x: seat.x, y: seat.base + hgt + .03, z: seat.z, cell: c.id, seat, skeleton: true });
  }
  const rec = { h: region.h, cells: region.cells.length, minId, gables: 0, eaveLo: ye, eaveHi: ye, base, slope, pitch: spec?.pitch ?? Math.atan(slope) * 180 / Math.PI, thatch, risers, rings: rings.length, holes: rings.filter(r => r.reduce((s, p, i) => s + p.x * r[(i + 1) % r.length].z - r[(i + 1) % r.length].x * p.z, 0) < 0).length, tris: tris.length, ...R.audit, tris3: tris };
  (roofStats.skeletons ??= []).push(rec);
  if (roofStats.hipAudit) { roofStats.hipRegions++; roofStats.hipCells += region.cells.length; roofStats.hipAudit.push(rec); }
}

function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const len2 = dx * dx + dz * dz;
  if (len2 < 1e-12) return Math.hypot(px - ax, pz - az);
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / len2, 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
