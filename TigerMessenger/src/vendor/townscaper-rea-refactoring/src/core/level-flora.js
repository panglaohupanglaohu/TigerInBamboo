/** 959530111187013632 "multiple grass types per level".
 * Local palette policy inspired by REACode/levelflora, not recovered original species.
 * Two colors per level; repeating palettes above four levels deliberately allowed.
 *
 * r74 补全：FLORA_JUDGE 是只读裁判 REACode/src/levelflora.js buildFlora 的成丛参数
 * 原样移植（presence/items/radius/scale）；SURFACE_DENSITY 表面型调制与 RAIN_COLORS
 * 雨生态色组是本地近似（帧 109+ 紫/灰白岛），与裁判参数分开记录。
 */
const PALETTES = Object.freeze([
  Object.freeze(['#9cc48a','#b8d9a6']), Object.freeze(['#7fae6a','#5f9a63']),
  Object.freeze(['#3f7a52','#b6a0d8']), Object.freeze(['#2e6248','#a8b0a4']),
]);
export function levelFloraPalette(level) {
  if (!Number.isSafeInteger(level) || level < 0) throw new RangeError('nonnegative integer level required');
  return PALETTES[level % PALETTES.length];
}

/** REACode levelflora.js SPECIES/PALETTES/buildFlora/measure on the shared World.
 * Each terrace level owns two species; a cell is one cluster of a single species (the clip's
 * "one clump ≈ 2-3 cells" reads as uniform patches, not per-tuft colour noise). Species
 * colours are the lab's; geometry per species (dots/blade/fan/conifer) is not modelled.
 */
export const LEVEL_SPECIES=Object.freeze({
 meadow:Object.freeze({name:'白花草甸',shape:'dots',col:'#f4f6ee',hi:'#dfe8d2'}),clover:Object.freeze({name:'三叶矮草',shape:'tuft',col:'#9cc48a',hi:'#b8d9a6'}),
 tallgrass:Object.freeze({name:'高草',shape:'blade',col:'#7fae6a',hi:'#a6c98c'}),fern:Object.freeze({name:'蕨',shape:'fan',col:'#5f9a63',hi:'#82bd83'}),
 shrub:Object.freeze({name:'圆叶灌木',shape:'puff',col:'#3f7a52',hi:'#61a06f'}),heather:Object.freeze({name:'石南',shape:'dots',col:'#b6a0d8',hi:'#cdbdea'}),
 pine:Object.freeze({name:'松',shape:'conifer',col:'#2e6248',hi:'#3f7a5c'}),rock:Object.freeze({name:'裸岩苔',shape:'tuft',col:'#a8b0a4',hi:'#c4cbc0'}),
});
const LEVEL_SETS=Object.freeze([['meadow','clover'],['tallgrass','fern'],['shrub','heather'],['pine','rock']].map(Object.freeze));
const GLOBAL_SET=Object.freeze(['meadow','fern','shrub']);
/* ------------------------------------------------------------ r74：裁判参数 / 表面型 / 生态
 * 只读裁判 REACode/src/levelflora.js buildFlora：
 *   每格至多一丛、丛内统一物种（层绑 set 内均匀选一）；
 *   presence：d = density·(0.55+0.45·h)，h2 ≤ d 才有丛（默认 density .55 → 期望 ≈0.426）；
 *   丛内 4–9 个；丛半径 .20–.46 格；个体缩放 .55–1.25；丛径 = 2·最大半径 + .35。
 * SURFACE_DENSITY 与 RAIN_COLORS 不在裁判里：表面型调制（岸/崖边/内部）与
 * 帧 109+ 紫色雨景生态是本地近似，和裁判参数分开记账。 */
export const FLORA_JUDGE=Object.freeze({density:.55,items:Object.freeze([4,9]),radius:Object.freeze([.2,.46]),scale:Object.freeze([.55,1.25]),spreadPad:.35});
export const FLORA_SURFACES=Object.freeze(['interior','edge','shore']);
/** 表面型密度系数（近似）：最低层临水格稍密、开阔台地内部偏稀；崖顶边=基准。 */
export const SURFACE_DENSITY=Object.freeze({interior:.8,edge:1,shore:1.2});
/** 草丛广告牌的各向异性缩放（形状提示）：dots 贴地、blade/fan 高挑/宽、conifer 最高。 */
export const FLORA_SHAPE_SCALE=Object.freeze({dots:Object.freeze({xz:1.05,y:.5}),tuft:Object.freeze({xz:1,y:.8}),blade:Object.freeze({xz:.8,y:1.5}),fan:Object.freeze({xz:1.35,y:.95}),puff:Object.freeze({xz:1.25,y:1.05}),conifer:Object.freeze({xz:.9,y:1.9})});
/** 帧 109+ 第二生态（紫色雨景岛）：同一批物种键/形状，只换色组——紫树冠、灰白直立地被。程序近似，原美术未迁。 */
export const FLORA_ECOLOGIES=Object.freeze(['meadow','rain']);
export const RAIN_COLORS=Object.freeze({meadow:Object.freeze(['#eceee8','#f8faf4']),clover:Object.freeze(['#98a29a','#b4bcb0']),tallgrass:Object.freeze(['#9d97ba','#bcb4d6']),fern:Object.freeze(['#6f6390','#8d80b2']),shrub:Object.freeze(['#5e4f7e','#7a68a0']),heather:Object.freeze(['#b6a0d8','#cdbdea']),pine:Object.freeze(['#4c3f66','#63527f']),rock:Object.freeze(['#a9a9b2','#c6c6cf'])});
/** 雨生态下树冠色（紫冠）；仅生态切换用，不改变种树规则。 */
export const RAIN_CROWN=Object.freeze(['#6a5a8c','#5a4a78','#7a6a9a','#8a7aa8']);
/** Terrace rank (0 = lowest grass level) → species for one cell. `perLevel` binds species to
 * height so foliage reads as a height legend; `global` is the lab's comparison mode.
 * `ecology:'rain'` 只换色组（帧 109+ 雨景生态近似），物种键/形状不变。 */
export function levelFloraSpecies(rank,cellId,{seed=11,mode='perLevel',ecology='meadow'}={}){
 if(!Number.isSafeInteger(rank)||rank<0||!Number.isSafeInteger(cellId)||cellId<0||!Number.isSafeInteger(seed)||!['perLevel','global'].includes(mode)||!FLORA_ECOLOGIES.includes(ecology))throw new RangeError('Invalid level flora query');
 const set=mode==='perLevel'?LEVEL_SETS[Math.min(LEVEL_SETS.length-1,rank)]:GLOBAL_SET;
 let h=Math.imul(cellId+1,2654435761)^Math.imul(seed,40503);h=Math.imul(h^(h>>>15),2246822519);h^=h>>>13;
 const key=set[(h>>>0)%set.length],s=LEVEL_SPECIES[key];
 return{key,...s,colors:ecology==='rain'?[...RAIN_COLORS[key]]:[s.col,s.hi],size:FLORA_SHAPE_SCALE[s.shape],ecology};
}
const fh=(cellId,salt,seed)=>{let h=Math.imul(cellId+1+Math.imul(salt,0x9e3779b9),2654435761)^Math.imul(seed+salt,40503);h=Math.imul(h^(h>>>15),2246822519);h^=h>>>13;return(h>>>0)/4294967296;};
/** 一格的成丛计划（裁判 buildFlora 口径，独立 hash 代替顺序 rnd 流）：物种与
 * levelFloraSpecies 完全一致（同格同键）；present=false 表示该格无丛。
 * items 的 dx/dz 以「格半宽」为单位（±0.46 内），调用方乘本格半径换世界偏移。 */
export function levelFloraCluster(rank,cellId,{seed=11,mode='perLevel',ecology='meadow',surface='interior',density=FLORA_JUDGE.density}={}){
 if(!Number.isSafeInteger(rank)||rank<0||!Number.isSafeInteger(cellId)||cellId<0||!Number.isSafeInteger(seed)||!['perLevel','global'].includes(mode)||!FLORA_ECOLOGIES.includes(ecology)||!FLORA_SURFACES.includes(surface)||typeof density!=='number'||!(density>=0))throw new RangeError('Invalid flora cluster query');
 const sp=levelFloraSpecies(rank,cellId,{seed,mode,ecology});
 const d=density*(0.55+0.45*fh(cellId,1,seed))*(SURFACE_DENSITY[surface]??1);
 const present=fh(cellId,2,seed)<Math.min(1,d);
 const count=FLORA_JUDGE.items[0]+((fh(cellId,3,seed)*(FLORA_JUDGE.items[1]-FLORA_JUDGE.items[0]+1))|0);
 const radius=FLORA_JUDGE.radius[0]+fh(cellId,4,seed)*(FLORA_JUDGE.radius[1]-FLORA_JUDGE.radius[0]);
 const items=[];
 for(let j=0;j<count;j++){
  const a=fh(cellId,5+j*3,seed)*Math.PI*2,rr=Math.sqrt(fh(cellId,6+j*3,seed))*radius;
  items.push(Object.freeze({dx:Math.cos(a)*rr,dz:Math.sin(a)*rr,scale:FLORA_JUDGE.scale[0]+fh(cellId,7+j*3,seed)*(FLORA_JUDGE.scale[1]-FLORA_JUDGE.scale[0])}));
 }
 return{key:sp.key,shape:sp.shape,name:sp.name,colors:sp.colors,size:sp.size,ecology,surface,present,count,radius,items:Object.freeze(items)};
}
/** Distinct grass levels in a World, lowest first (rank = index). */
export function levelFloraRanks(levels){const u=[...new Set(levels)].filter(l=>Number.isInteger(l)&&l>0).sort((a,b)=>a-b);return new Map(u.map((l,i)=>[l,i]));}
/** measure(): shared species across levels and how well species alone predicts the level. */
export function measureLevelFlora(rows){
 if(!Array.isArray(rows)||!rows.length)throw new RangeError('No flora rows');
 const perLevel=new Map(),vote=new Map();
 for(const {level,key}of rows){if(!perLevel.has(level))perLevel.set(level,new Set());perLevel.get(level).add(key);if(!vote.has(key))vote.set(key,new Map());vote.get(key).set(level,(vote.get(key).get(level)||0)+1);}
 const seen=new Map();for(const s of perLevel.values())for(const k of s)seen.set(k,(seen.get(k)||0)+1);
 const guess=new Map([...vote].map(([k,m])=>[k,[...m].sort((a,b)=>b[1]-a[1])[0][0]]));
 const hit=rows.filter(r=>guess.get(r.key)===r.level).length;
 return{levels:perLevel.size,speciesUsed:seen.size,sharedSpecies:[...seen.values()].filter(v=>v>1).length,levelFromSpecies:hit/rows.length,baseline:1/perLevel.size};
}
