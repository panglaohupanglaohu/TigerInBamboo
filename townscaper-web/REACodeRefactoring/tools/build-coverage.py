# coding: utf-8
"""Inventory is source-oriented: every original module appears exactly once.
Mappings describe responsibility, not proof of feature parity. Explicit gaps take precedence.
"""
from pathlib import Path
import re,json,html,collections,datetime
r=Path(__file__).resolve().parents[1]; old=r.parent/'REACode'
groups={
'core/grid.js':'grid quadgrid halfedge topoline gridmodes',
'core/spatial.js':'barycentric', 'core/trigraph.js':'triGraph', 'core/infinite.js':'piperepair',
'core/world.js':'town', 'core/meshwriter.js':'mesh', 'core/palette.js':'palette',
'core/atlas.js':'rectpack spritepack', 'core/obb.js':'boxtest', 'core/noise.js':'noise',
'build/buildings.js':'townmesh props roofs looptown tileplace',
'world/app.js':'app trace propanim', 'world/townDemo.js':'demo', 'world/save.js':'save savestring',
'world/view.js':'scene smear reflstreak floatprobe', 'world/worldmesh.js':'lightingcache',
'world/navgraph.js':'navgraph navgrid frontier', 'world/navlayer.js':'rayvis',
'world/outline.js':'outline backlit', 'world/scenes.js':'fusion splice spherefusion',
'terrain/generate.js':'terrain mesa rivers triisland', 'terrain/terrainmesh.js':'terrainmesh', 'terrain/shape.js':'cage edgesmooth normalsmooth',
'light/bake.js':'lighting voxelao voxelshadow', 'light/lightvolume.js':'bouncegi lightvol',
'water/shore.js':'shore shorefield waves reflection', 'water/watervol.js':'watervol', 'water/waterfall.js':'waterfall',
'life/birds.js':'birds', 'life/decor.js':'butterflies flags', 'life/atmosphere.js':'wind fog snow voxelflow',
'life/vegetation.js':'grasscards edgeplant surfacedeco bnbrush bncanopy blobrelax',
'life/impostor.js':'impostor', 'life/effects.js':'splash',
'badnorth/island.js':'islands', 'badnorth/battle.js':'ballistic traffic infograph unitbatch',
'badnorth/flowfield.js':'flowfield triflow', 'campaign/campaign.js':'grouping borderpath snapshot',
'sphere/planet.js':'sphere relax spheretown spherehouse vertexlight worldmap',
'ui/learnpanel.js':'learnpanel',
'@textures.html':'blotch contrast colorgamut patchblend quadtex repeatbreak texelsnap paintnormal mountainlight mipcustom mipfilter wobbletex surfaceshadow surface dfgrow ornament mandala',
'@ui.html':'portrait partsprites', '@grids.html':'dual march meshcheck',
}
byname={name:target for target,names in groups.items() for name in names.split()}
# Partial means a known mechanism is absent, even when a related demo exists.
gaps={
'adjacency':'缺少从实际模块网格抽取接口并查询可拼装邻接的工具。',
'blobrelax':'现有球团树冠与外壳描边未覆盖硬边橡皮筋/内部气球的迭代松弛。',
'borderpath':'战役节点分组存在，沿三角边绕节点的前线边境生成未核实。',
'cheesenav':'现有寻路仅取柱顶，缺少洞内多层可站点。',
'voxelnav':'现有寻路仅取柱顶，缺少洞内多层可站点。',
'holenav':'缺少洞口 portal 图与楼层内部连通性。',
'coroutine':'缺少可预算执行、嵌套/递归及取消的通用生成器调度器。',
'dirsprites':'3D 小人不等于单方向精灵的视觉朝向约束。',
'doodlewall':'缺少走廊墙板与涂鸦演示。',
'dual':'有对偶图演示，植被落点尚未统一使用顶点对偶区域。',
'flowdemo':'缺少共享体素碰撞/软法线/风场的独立量化验收页。',
'frontier':'区域合并导航存在，未覆盖坍缩边缘候选 tile 的增量枚举。',
'gridwfc':'缺少不规则格上的确定性约束传播与回溯求解。',
'tileforce':'压平台地放教堂不能替代先生成特定模块所需局部网格。',
'tilerepair':'未覆盖更改占用后的局部 WFC 修复。',
'gridmodes':'四边形/混合演示存在，纯六边形地形对照未覆盖。',
'infograph':'战斗流场存在，单位知识的动态节点通信图未覆盖。',
'lighting':'共享体素烘焙已迁移；碰撞与体素软法线用途需继续核查。',
'march':'岸线绘制存在，marching squares 独立等值线与端点一致性未覆盖。',
'mipcustom':'贴图实验未覆盖自定义 mipmap 的实际构建和采样。',
'mipfilter':'贴图实验未覆盖自定义 mipmap 的实际构建和采样。',
'mountainlight':'地面笔触不能替代山体斜率烘焙贴图。',
'paintnormal':'缺少手绘法线与表面光照演示。',
'rayvis':'导航线不等于近似视线遮挡查询。',
'los':'缺少导航图上的近似视线扇形查询。',
'spherefusion':'星球演示与平面 World 分离，球面建筑/地形融合尚未覆盖。',
'spherehouse':'缺少球面上的建筑形变与放置。',
'splice':'有融合造型，未覆盖预制多格 tile 的完整约束拼接。',
'surface':'顶面混色存在，手动 UV 与投射贴图混合未完整覆盖。',
'surfaceshadow':'未覆盖投射高度与深度测试高度解耦的表面阴影。',
'voxelshadow':'AO/阴影存在，逐顶点体素方向阴影未核实。',
'vertexlight':'缺少低分辨率高度立方体贴图单次查询光照。',
'voxelflow':'风场已迁移，碰撞/体素软法线接口未完整覆盖。',
'worldmap':'缺少球面三维噪声世界地图贴图演示。',
'unitbatch':'单位尚用独立对象，未覆盖批量实例化与剔除。',
'floatprobe':'缺少32位浮点渲染目标跨平台能力实测。',
'bncanopy':'缺少 surface nets 树冠与硬边松弛的完整烘焙输入。',
'bnbrush':'着色笔触存在，预烘笔触图与轮廓能量对照未完整迁移。',
'contour':'缺少不规则格等值线跨边连接验收。',
}
rows=[]
newtexts={str(p.relative_to(r)):p.read_text(errors='replace') for p in list((r/'src').rglob('*.js'))+list(r.glob('*.html'))}
for folder in ['src','engine']:
 for p in sorted((old/folder).glob('*.js')):
  s=p.read_text();stem=p.stem;target=byname.get(stem)
  targets=[] if not target else [target[1:] if target.startswith('@') else 'src/'+target]
  ids=list(dict.fromkeys(re.findall(r'\b\d{16,20}\b',s)))
  refs=[f for f,t in newtexts.items() if any(id in t for id in ids)]
  status='部分覆盖' if stem in gaps and targets else '未覆盖' if not targets else '已合并/迁移（静态确认）'
  detail=gaps.get(stem,'按职责合并到目标模块；保留已有重构成果，具体行为等价性按学习任务验收。' if targets else '暂无明确职责落点，安排后续学习与迁移。')
  exports=re.findall(r'export\s+(?:async\s+)?(?:function|class|const|let)\s+(\w+)',s)
  rows.append(dict(source=str(p.relative_to(old)),targets=targets,status=status,gap=detail,clips=ids,sourceExports=exports,idReferences=refs,frameReview=False))
overrides=json.loads((r/'learn/coverage-overrides.json').read_text()) if (r/'learn/coverage-overrides.json').exists() else {}
for row in rows:
 if row['source'] in overrides: row.update(overrides[row['source']])
assert len(rows)==len(list((old/'src').glob('*.js')))+len(list((old/'engine').glob('*.js')))
report={'updatedAt':datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(timespec='seconds'),'scope':'原版 src + engine 的全部 JS；vendor、页面内联脚本与工具另列后续范围。','modules':rows,'counts':dict(collections.Counter(x['status'] for x in rows))}
(r/'learn/coverage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
md='# 原版模块 → 重构模块映射\n\n'+report['scope']+' 映射按职责人工分组，代码引用作辅助；已合并/迁移是静态确认，不等于完整行为验收。\n\n'+str(report['counts'])+'\n\n| 原版模块 | 重构落点 | 状态 | 缺口 / 说明 | 对应视频 |\n|---|---|---|---|---|\n'
for x in rows:md+='| `'+x['source']+'` | '+', '.join('`'+t+'`' for t in x['targets'])+' | '+x['status']+' | '+x['gap']+' | '+', '.join(x['clips'])+' |\n'
(r/'MODULE-MAP.md').write_text(md)
print(report['counts'], 'total',len(rows))
