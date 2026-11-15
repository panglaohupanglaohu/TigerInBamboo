import {WORKSHOPS} from './catalog-build.js';
const RULES={core:['scene','style'],world:['scene','building'],terrain:['scene','terrain'],build:['scene','building'],life:['object','model'],badnorth:['scene','activity'],ui:['scene','camera'],light:['scene','atmosphere'],sphere:['planet','grid'],capabilities:['scene','style'],water:['scene','water'],tools:['object','performance'],render:['scene','style'],campaign:['scene','activity']};
const RECIPES=[
 ['world','共享世界与建筑','scene','World 数据 → 地形/建筑网格 → 环境遮蔽 → 场景渲染',['src/core/world.js','src/world/worldmesh.js','src/world/world-mesh.js','src/build/buildings.js','src/terrain/generate.js','src/world/view.js']],
 ['water','水面、岸线与流动','scene','共享网格提供岸线和碰撞；水面与岸浪需要渲染上下文',['src/water/water.js','src/water/shore.js','src/water/waterfall.js','src/water/waves.js']],
 ['vegetation','植被造型与路径布置','object','路径平滑/弧长采样 → 分枝/冠层 → 植被消费者',['src/core/path-samples.js','src/core/canopy.js','src/life/vegetation.js','src/terrain/shrub-band.js']],
 ['combat','导航、弹道与战斗反馈','scene','World 导航/碰撞 → 轨迹求解 → 战斗/特效消费者',['src/core/ballistic-table.js','src/core/trajectory-trace.js','src/core/nav-diagnostic-geometry.js','src/badnorth/battle.js']],
 ['style','感知颜色与描线','scene','感知色彩/色域 → 材质适配 → 描线/后期渲染',['src/core/oklab.js','src/core/gamut.js','src/world/outline.js','src/light/mip-ground.js']],
 ['video','视频学习与数值验证','object','解码抽样 → 灰度数据 → 帧差与频谱Worker → 测量回执',['src/core/video-cycle-metrics.js','src/tools/video-cycle-capture.js','src/tools/video-cycle-worker.js']],
 ['atlas','图集、精灵与预算','object','图集分配 → 精灵消费者 → 渲染/资源释放',['src/core/atlas.js','src/core/sprite-atlas.js','src/core/impostor.js','src/light/mip-chain.js']],
];
export function buildCodeCatalog(manifest,{learningCatalog=null,codeCaps=[],executionAdapters=[]}={}){
 if(manifest?.schemaVersion!==2||!Array.isArray(manifest.modules)||!manifest.modules.length)throw Error('代码库清单版本或模块无效');
 const modules=new Map();for(const m of manifest.modules){if(!/^src\/[\w./-]+\.(?:m?js)$/.test(m.path)||m.path.includes('..')||!/^[a-f0-9]{64}$/.test(m.sha256)||!Array.isArray(m.exports)||modules.has(m.path))throw Error('无效或重复代码模块');modules.set(m.path,{...m,adapters:executionAdapters.filter(a=>a.modules?.includes(m.path)).map(a=>({id:a.id,name:a.name,tier:a.tier,params:a.params,modules:a.modules}))});}
 const catalog={schemaVersion:2,generatedAt:manifest.generatedAt,snapshotId:manifest.snapshotId,sourceMode:'physical-code',evolution:manifest.evolution,evolutionSources:manifest.evolutionSources,sources:{...learningCatalog?.sources,physicalCode:manifest.counts,codeCapabilities:codeCaps.length},modules:[...modules.values()],alignment:manifest.alignment,learningMethods:learningCatalog?.workshops||[],shared:[],workshops:WORKSHOPS.map(w=>({...w,domains:w.domains.map(([id,name])=>({id,name,counts:{total:0,library:0},nodes:[]}))}))};
 for(const m of modules.values()){
  let [tier,domain]=RULES[m.directory]||['object','performance'];
  const s=m.path.toLowerCase(),file=s.split('/').pop();
  if(m.directory==='core'){
   if(/^(?:grid|quad|halfedge|trigraph|wfc|vertex-dual|adjacency|infinite|world\.)/.test(file)){tier='planet';domain='grid';}
   else if(/^(?:terrain|terrace|rock-|mountain|sediment|depression|field-|contour|marching|voxel-distance)/.test(file)){tier='scene';domain='terrain';}
   else if(/^(?:arch-|house-|hip-roof|courtyards|building-|module-|opening-|ladder|doodle|edge-inset|straight-skeleton)/.test(file)){tier='scene';domain='building';}
   else if(/^(?:shore-|wave-|wake-|river-|float-advect)/.test(file)){tier='scene';domain='water';}
   else if(/^(?:nav-|combat-|melee-|spear-|trajectory-|ballistic-|campaign-|smoke-|portal-|swarm)/.test(file)){tier='scene';domain='activity';}
   else if(/^(?:canopy|leaf-|level-flora|ornament|surface-decoration|prop-anim|part-random)/.test(file)){tier='object';domain='model';}
   else if(/^(?:spatial|obb|platform-anchor|garden-path|route-|wire-route|path-)/.test(file)){tier='object';domain='placement';}
   else if(/^(?:video-|qa-|snapshot-|node-|minheap|coroutine)/.test(file)){tier='object';domain='performance';}
  }
  if(/(?:^|[\/-])(?:cloud|fog|snow|wind|rain)(?:[.-]|$)/.test(s)){tier='scene';domain='atmosphere';}else if(/camera|perspective|orbit/.test(s)){tier='scene';domain='camera';}else if(/atlas|mip|impostor|lod/.test(s)){tier='object';domain='performance';}else if(/path|placement|scatter/.test(s)){tier='object';domain='placement';}
  const bucket=catalog.workshops.find(w=>w.id===tier).domains.find(d=>d.id===domain);
  bucket.nodes.push({id:m.id,exec:'library',domain,title:m.path.slice(4),date:m.evolution?.lastPostAt||null,scannedAt:manifest.generatedAt,text:`导出：${m.exports.join(', ')||'入口/副作用模块'}；${m.context}；依赖 ${m.dependencies.length} 项。`,code:[],module:m,refactored:{label:'物理代码已存在',where:m.path,status:'code-present'},original:null});bucket.counts.total++;bucket.counts.library++;
 }
 catalog.combinations=RECIPES.map(([id,name,tier,goal,seeds])=>{
  const roots=seeds.filter(p=>modules.has(p)),order=[],seen=new Set(),visiting=new Set(),cycles=[],missing=[];
  function visit(p){if(visiting.has(p)){cycles.push(p);return;}if(seen.has(p))return;const m=modules.get(p);if(!m){missing.push(p);return;}visiting.add(p);for(const d of m.dependencies)visit(d.path);visiting.delete(p);seen.add(p);order.push(p);}
  roots.forEach(visit);return{id:'library-combination:'+id,name,tier,goal,roots,moduleOrder:order,cycles:[...new Set(cycles)],missing:[...new Set(missing)],evolutionFamilies:[...new Set(order.flatMap(p=>modules.get(p)?.evolution?.families||[]))],evolutionClips:[...new Set(order.flatMap(p=>modules.get(p)?.evolution?.clips||[]))],execution:'adapter-required',adapted:executionAdapters.filter(a=>a.modules?.some(p=>seen.has(p))).sort((a,b)=>['scene.oklab-palette','scene.oklab-contrast'].indexOf(a.id)-['scene.oklab-palette','scene.oklab-contrast'].indexOf(b.id)).map(a=>({id:a.id,name:a.name,tier:a.tier,modules:a.modules})),acceptance:'需绑定目标快照、上下文、参数、独立验证和预览恢复；依赖图不是可执行管线。'};
 }).filter(r=>r.roots.length);
 return catalog;
}
