/** 959530111187013632 "multiple grass types per level".
 * Local palette policy inspired by REACode/levelflora, not recovered original species.
 * Two colors per level; repeating palettes above four levels deliberately allowed.
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
/** Terrace rank (0 = lowest grass level) → species for one cell. `perLevel` binds species to
 * height so foliage reads as a height legend; `global` is the lab's comparison mode. */
export function levelFloraSpecies(rank,cellId,{seed=11,mode='perLevel'}={}){
 if(!Number.isSafeInteger(rank)||rank<0||!Number.isSafeInteger(cellId)||cellId<0||!Number.isSafeInteger(seed)||!['perLevel','global'].includes(mode))throw new RangeError('Invalid level flora query');
 const set=mode==='perLevel'?LEVEL_SETS[Math.min(LEVEL_SETS.length-1,rank)]:GLOBAL_SET;
 let h=Math.imul(cellId+1,2654435761)^Math.imul(seed,40503);h=Math.imul(h^(h>>>15),2246822519);h^=h>>>13;
 const key=set[(h>>>0)%set.length];return{key,...LEVEL_SPECIES[key],colors:[LEVEL_SPECIES[key].col,LEVEL_SPECIES[key].hi]};
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
