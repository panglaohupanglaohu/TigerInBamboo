import {registerScannedCapabilities} from './capability-scanner.js';
import {CAPABILITY_SOURCES} from './capability-sources.js';
const NODES=[
 {id:'terrain.preserve',kind:'地形',icon:'△',color:'#c6b48a',name:'地形与承托',description:'保留现有湖面和建筑基础；在原编辑器中编辑体素。',mode:'editor',source:'src/world/morrisTownscaper.js',checks:'承托 / 坡度 / 连通性'},
 {id:'building.edit',kind:'建筑',icon:'▥',color:'#e0a482',name:'建筑与空间',description:'复用建造、拆除与刷色，保留你的湖上建筑群。',mode:'editor',source:'src/world/morrisTownscaperMenu.js',checks:'编码 / 建筑保留 / 通行'},
 {id:'water.surface',kind:'水',icon:'≈',color:'#78bdce',name:'水面与岸浪',description:'实时控制现有岸浪和倒影。',mode:'live',source:'src/world/morrisTownStage.js',checks:'水岸接缝 / 倒影',controls:['waves','reflection']},
 {id:'light.time',kind:'光',icon:'☼',color:'#edcf83',name:'光照与时间',description:'使用游戏现有日间、黄昏和夜间光照。',mode:'live',source:'src/world/morrisTownStage.js',checks:'昼夜可读性',controls:['time']},
 {id:'world.ink',kind:'世界',icon:'◎',color:'#9ab4da',name:'世界接口 · 描线与网格',description:'实时调整描线与调试网格，不替换场景。',mode:'live',source:'src/world/morrisTownStage.js',checks:'轮廓 / 空间可读性',controls:['outline','grid']},
 {id:'life.layers',legacy:true,kind:'生命',icon:'❧',color:'#9aca9b',name:'植物与飞鸟',description:'控制现有植被与鸟群；物种和位置编辑待接入。',mode:'live',source:'src/world/morrisTownStage.js',checks:'栖息 / 遮挡 / 动态',controls:['vegetation','birds']},
 {id:'weather.atmosphere',kind:'天气',icon:'☁',color:'#a6bccf',name:'天气与风场',description:'实时开关现有雾与风雪；风场箭头仅是调试，不作为天气开关。',mode:'live',source:'src/life/atmosphere.js',checks:'风雪绕障 / 雾可读性',controls:['fog','snow']},
 {id:'vegetation.layers',kind:'植被',icon:'❧',color:'#9aca9b',name:'植被层',description:'控制现有植被显示；落点、草灌木树和impostor是库中独立能力，尚未全部开放。',mode:'live',source:'src/life/vegetation.js',checks:'根部承托 / 视线 / 层级',controls:['vegetation']},
 {id:'animals.birds',kind:'动物',icon:'⌁',color:'#dec896',name:'动物层 · 飞鸟',description:'当前仅接入海鸥显示；蝴蝶来源decor，其他动物不能由此推定已接入。',mode:'live',source:'src/life/birds.js',checks:'栖息 / 起降 / 飞行',controls:['birds']},
 {id:'effects.fire',kind:'火',icon:'♨',color:'#e1a47c',name:'特效层 · 火',description:'控制当前已有火焰显示；不新建火源，不等于点燃建筑。动态火光尚未完成。',mode:'live',source:'src/life/effects.js',checks:'火源 / 生命周期 / 透明混合',controls:['fire']},
 {id:'effects.smoke',kind:'烟',icon:'〰',color:'#acb2b9',name:'特效层 · 烟',description:'库中已有独立烟雾机制；当前游戏stage没有接入Smoke，暂为配方节点。',mode:'recipe',source:'src/life/smoke.js',checks:'双遍混合 / mip / 排序'},
 {id:'vehicles.boats',kind:'船',group:'载具',icon:'≋',color:'#89bfc2',name:'载具层 · 船',description:'库中有Bad North长船与V形航迹；游戏驾驶接口另属boatRide，工坊尚未连接。',mode:'recipe',checks:'浮力/水面约束 / 航迹 / 上下船'},
 {id:'vehicles.aircraft',kind:'飞行器',group:'载具',icon:'✧',color:'#a5bbd1',name:'载具层 · 飞行器',description:'游戏已有飞行与飞艇接口；未在当前REA能力记录中找到对应实现，不能冒称来自REA库。',mode:'recipe',checks:'起降 / 高度 / 碰撞 / 上下机'},
 {id:'vehicles.cars',kind:'车',group:'载具',icon:'▰',color:'#c9b48e',name:'载具层 · 车',description:'游戏已有电车搭乘接口；当前REA能力记录未登记通用车辆执行器。',mode:'recipe',checks:'轨道/道路 / 站点 / 上下车'},
 {id:'combat.encounter',kind:'战斗',icon:'⚑',color:'#d997a6',name:'遭遇与交互',description:'场景战斗执行适配尚未接入；配方中保留目标。',mode:'recipe',source:'REACodeRefactoring/src/badnorth/battle.js',checks:'伤害 / 寻路 / 性能'}
];
export const CAPABILITIES=NODES.map(c=>({...c,source:CAPABILITY_SOURCES[c.id].modules.map(m=>'REACodeRefactoring/'+m.path).concat((CAPABILITY_SOURCES[c.id].gameModules||[]).map(m=>'TigerMessenger/'+m.path)).join(' · '),provenance:CAPABILITY_SOURCES[c.id]}));
export const DEFAULT_SETTINGS={waves:true,reflection:true,time:'day',outline:true,grid:false,vegetation:true,birds:true,fog:false,snow:false,fire:true};
export function makeRecipe(){return {version:1,scene:'morris-lake',goal:'保留湖上建筑群，探索水、光与生命的组合',nodes:CAPABILITIES.filter(c=>!c.legacy&&!c.scanned&&(!c.code||NODES.some(n=>n.id===c.id))).map(c=>({id:c.id,enabled:true})),settings:{...DEFAULT_SETTINGS}};}
/**
 * 代码能力（REACodeRefactoring/src/capabilities/registry.js describeCapabilities）登记为可执行节点：mode 'code'。
 * 与已有同 ID 的配方节点（如 effects.smoke）合并：保留原来源说明，执行方式升级为代码。
 * 配方里带 recipe.code（所用代码能力的描述），游戏页与恢复旧配方时据此登记，不依赖先扫描。
 */
const CODE_FIELDS=['id','layer','kind','name','summary','kind2','sources','targets','keywords','params','layer3d'];
export function registerCodeCapabilities(target,metas){
 if(!Array.isArray(metas)||metas.length>200)throw Error('代码能力列表无效');
 for(const m of metas){if(typeof m?.id!=='string'||!/^[a-z]+\.[a-z0-9.-]+$/.test(m.id)||typeof m.name!=='string')throw Error('代码能力字段无效');
  const meta=Object.fromEntries(CODE_FIELDS.filter(k=>k in m).map(k=>[k,structuredClone(m[k])]));
  const row={code:true,mode:'code',codeMeta:meta,layerId:meta.layer,kind:meta.kind,name:meta.name,description:meta.summary,icon:meta.kind2==='geometry'?'⚙':'◍',color:meta.kind2==='geometry'?'#e3b36b':'#8fc7c9',controls:[],checks:meta.kind2==='geometry'?'范围 / 手工建筑 / 承托 / 通行 / 几何量（验证 Worker）':'显示层：不改体素，实景观察',sourceVideos:meta.sources||[]};
  const old=target.find(c=>c.id===meta.id);
  if(old){if(!old.code){Object.assign(old,row,{name:old.name.includes('·')?old.name:row.name,provenance:old.provenance});}else Object.assign(old,row);continue;}
  target.push({id:meta.id,...row,source:'REACodeRefactoring/src/capabilities',provenance:{note:'能力代码：REACodeRefactoring/src/capabilities（match / run / 验证）。',modules:[],records:(meta.sources||[]).map(id=>({id,lane:'code',laneName:'能力代码',group:meta.kind,name:meta.name,where:'src/capabilities',status:'代码',project:'REACodeRefactoring'}))}});
 }
}
export const codeMetaOf=recipe=>CAPABILITIES.filter(c=>c.code&&recipe.nodes.some(n=>n.id===c.id)).map(c=>c.codeMeta);
export function validateRecipe(recipe){
 if(recipe?.discovered)registerScannedCapabilities(CAPABILITIES,recipe.discovered);
 if(recipe?.code)registerCodeCapabilities(CAPABILITIES,recipe.code);
 if(recipe?.version!==1||recipe.scene!=='morris-lake'||!Array.isArray(recipe.nodes))throw Error('管线格式或场景不匹配');
 const ids=new Set();for(const n of recipe.nodes){if(!CAPABILITIES.some(c=>c.id===n.id)||ids.has(n.id)||typeof n.enabled!=='boolean')throw Error('能力无效或重复');if(n.params!==undefined&&(typeof n.params!=='object'||Object.values(n.params).some(v=>!Number.isFinite(v))))throw Error('能力参数无效');ids.add(n.id);}
 for(const [k,v]of Object.entries(recipe.settings||{})){if(!(k in DEFAULT_SETTINGS)||(k==='time'?!['day','dusk','night'].includes(v):typeof v!=='boolean'))throw Error('能力参数无效');}
 return recipe;
}
export function effectiveSettings(recipe,baseline){validateRecipe(recipe);const result={...baseline};for(const n of recipe.nodes.filter(n=>n.enabled)){const c=CAPABILITIES.find(c=>c.id===n.id);for(const key of c.controls||[])result[key]=recipe.settings[key]??baseline[key];}return result;}
