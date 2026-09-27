## 交汇处古堡 · 装饰与港池检查更新（2026-09-21）

- Blender细化已回接8931：退台花槽、庭院树、立面窗框与檐口、码头货物及蓝棚；生产资产26网格、27024三角面，同步Godot GLB。
- 修正主堡底层檐口遮挡门洞；原碰撞求解器的码头→拱门→庭院→主堡合成路线再次通过，11.62秒、终点标高6.59；恢复原编辑对象通过。不是完整手动通关。
- 原海床在此过浅。新增可逆港池候选仅在junctionHarbor=1启用，不影响普通入口。候选两侧实际船体泊位通过；港池出口到两侧接近点的局部路线分别17.08/10.25米，均通过现有导航求解。未派发船、未验证上下船和跨地区航线；海床候选未同步Godot。
- 实景：artifacts/pipeline/canal-junction-target/dressed-final.png；步行证据route-check.json；港池证据harbor-probe.json，原海床基线harbor-before.json。
- 下一步：实际船体沿接近曲线连续行驶及上下船检查，再决定正式启用港池；继续按目标图调整建筑退台层次和氛围。不能将当前块面细化称为目标图完整复刻。

# 当前交付更新 · 2026-09-21

已完成第一批原模块细化、Web接入与Godot视觉同步。以下旧章节保留布局样板的历史记录。

- 生产数据：`assets/models/optimized/canal-junction/junctionTargetData.js`，21网格20438三角面。
- 原构建器 `buildCitadelTownAssembly`：11建筑组开启WFC，11组求解均成功；屋顶随后按目标图在Blender另行细化，不宣称坡顶全部由WFC产生。
- Blender：`canal-junction-target-v1.blend`，Godot `assets/art-pilots/canal-junction-target-v1.glb`。
- Web默认无自定义布局时启用；`?autostart=1&junctionReview=1` 在码头开始本次验收，不写存档。
- 保存的自定义城堡优先；显式验收链接可临时显示新资产。调用原城堡/地形编辑重建入口时，恢复原对象并释放新资产。新烘焙模型尚不支持逐格编辑。
- 原碰撞系统合成路线检查通过，终点入口Y=6.5900，11.62秒；编辑恢复检查通过。`route-check.json`。
- Godot精确源匹配、变换、其他区域保留、重复绑定与解绑恢复测试通过，`godot-check.json`。这只是视觉同步，未宣称Godot完整游玩。
- 差距：退台花园、建筑立面细节、周边道具与图像氛围仍需迭代。港外船舶起航端点及水深并未验证，不能派发航船冒充完成。

## 可重复管线

1. `build_junction_layout_blender.py`：在隔离场景导出基础与路径几何。
2. `build_junction_modules.mjs`：真实浏览器调用原Townscaper模块及WFC，记录求解结果、原几何。
3. `refine_junction_blender.py`：Blender细化屋顶/配色，保留窗饰与模块，按材质与碰撞语义合批，同时导出Web和Godot。
4. `test_junction_route.mjs`：码头到主堡及恢复原模型；`capture_canal_junction.mjs integrated-final`：实际场景截图。
5. 单个Godot进程导入后运行 `res://tests/test_canal_junction_target_adapter.gd`。
6. 更新此页和实景对照；不覆盖目标图及布局历史。

---

# 交汇古堡目标构建

## 2026-09-21 当前状态

目标 `assets/concepts/canal-junction/target-v1.png` 已生成；用户随后说“继续”，按开始空间样板推进，尚无明确逐项美术审定。图像不是实景。

已读取原加载、运河地基、默认层表及 WFC 接线；通过真实8931获取默认城堡基线。Blender `TM_Junction_Layout_Study` 产出布局研究 `.blend` / `.glb` 与实际渲染，未替换游戏或玩家存档。该样板没有运行WFC，不能称为最终城堡。

## 空间约束

- 原水域分配44×36米；布局先在附近收敛，不全城等比放大。
- 码头标高0.65，庭院3.35，主堡入口6.59，均为样板局部标高，不是原世界水深测量。
- 主门净宽4米，内梯3.8米，庭院13×7.6米，主堡梯4.2米。
- 保持庭院与通路留白；货物、摊位及植物必须在确认通路后添加。

## 后续实施顺序

1. 从原模块导出实际几何，使用原Townscaper/WFC完成塔、坡顶、拱廊与退台，保留每竖户色彩连续。
2. 修整环岸平台、泊位和门内外踏面。当前样板仅有粗略承托，不是可行走碰撞验收。
3. 在原世界真实球面水域采样吃水与船体包络；历史文档已记录此处起航端点失败，不能假设生成图中的船可通航。
4. Blender细化、平直法线与材质检查后，同时输出Web几何和Godot资产。
5. 接回运行时，保留用户存档，做同机位前后对照、码头至主堡行走和昼夜检查。

## 文件

- `tools/pipeline/capture_canal_junction.mjs`：默认实景与节点基线，独立浏览器。
- `tools/pipeline/build_junction_layout_blender.py`：隔离命名场景，不覆盖前台主文件。
- `assets/models/optimized/canal-junction/junction-layout-v1.blend` / `.glb`：空间研究样板，非生产资产。
- `artifacts/pipeline/canal-junction-target/index.html`：目标、基线、样板。


## 2026-09-22 续做：临水防御立面与庭院连接
Blender MCP执行refine_junction_blender.py，在原11组WFC结果上细化：拱门两翼连续砌石墙/垛口、门顶墙头、庭院两侧护墙与花槽、窗台花园、屋檐瓦缝。26网格、29600三角面。不是重新生成WFC布局。Web码头到主堡路线11.62秒通过，支持恢复原编辑对象；Godot重新导入并通过canal_junction_target_adapter。截图structure-final.png/structure-final-front.png。
剩余：建筑体量仍偏排楼，庭园稀疏；叹息之门长桥出现在汇聚城堡背景，需优先核对两区域空间尺度和全程通航。保持已有自定义存档不覆盖；新资产不是逐格可编辑WFC。

## 2026-09-22 续接：退台与区域核查（最新）
- 11组原WFC再次求解全部成功。六栋住宅前/中/后3/4/5层，顶层移除朝水一排单元，形成1.6m退台。基础与通路几何未重建。
- Blender源 `tools/pipeline/refine_junction_blender.py`：六处退台花园、主堡垛口屋顶，移除重复window/balcony源装饰，显式窗框匹配WFC实际占格。Python的round与JS在2.5取整不同，网格宽深统一floor(value+.5)。
- 发布：junctionTargetData.js、canal-junction-target-v1.blend与Godot同名GLB已更新。21合并网格37048三角面；比上批增加7448面，减少5个网格，不能称为实测性能提升。
- 证据：terraces-r01/terraces-r02/terraces-final近景与全景；route-check.json通过（11.62秒合成输入，终点y6.59），Godot visual adapter通过。恢复原城接口检查通过。未验证全剧情/船舶。
- 更正上批推测：左侧密集柱是christchurch-tram-system原桥柱；逐三角面距离测量显示门区桥最近表面距城堡原点52.43m，两中心162.3m。audit_junction_gate_spacing.mjs与regional-spacing.json保存依据；背景可见不等于相交。本轮没有改轨道或门区资产，原门区净空基线保持，但未再次跑门区全测试。
- 残留：远景尖角可见，未确定其全部来源；主堡扶壁与立面节奏、树冠/攀援植物、港口船舶仍欠目标；不以当前完成批次代表全城完成。
- Jev真实文本分类：junction-terraces-evidence/decision.json，建议低置信度转review；不代表图像验收。

### 本批工程复现
1. 布局主源build_junction_layout_blender.py的regions与foundation.json同步；仅调高度时保留foundation.parts已验证通路，不重建地基。
2. node tools/pipeline/build_junction_modules.mjs（仓库根需加TigerMessenger/）运行原WFC；确认11组ok后才进下一步。
3. Blender MCP在独立TM_Junction_Target_v1场景执行refine_junction_blender.py，导出Web数据、blend、GLB；不覆盖其他未保存场景。
4. Godot --headless --path TigerMessenger/godot --editor --import；然后test_canal_junction_target_adapter.gd。串行使用一个Godot进程。
5. test_junction_route.mjs检验码头到主堡；capture_canal_junction.mjs保存同机位实景。全局资产加载完成再截图，不能隐藏远景问题美化结果。
6. 按新图哈希更新Jev文本观察；保存对照及不足，更新本页。用户保存的自定义布局不能自动覆盖，junctionReview仅预览。

## 2026-09-22 汇聚城堡：远景山体封闭与主堡立面
本批保持11组WFC占格、六处退台与基础通路不变。Blender中补主堡渐收扶壁、石材压顶、门框拱券、角石、蓝旗与顶部花槽；移除入口重叠的旧支撑/拱廊装饰。资产21网格37372三角面。

### 山体根因与修复
实际像素射线审计定位到gate-canyon-site-blender的canyon-shoulder网格。15m轨道避让硬边界在相邻采样点产生陡降，外缘两格过渡过窄；此外地形仅上表面和裙边，没有闭合底面，从汇聚城堡方向看到背面破片。
- build_gate_site_blender.py：内侧15m保持原净空上限，15–40m平滑释放；按实际距离计算外缘24m/纵向28m渐退。
- 封底使用与顶面相同网格密度的原地形采样，每点低于顶面至少1m，三角化封闭，不能恢复旧的跨整片非平面大多边形封底。
- 全部两侧山体拓扑无边界边、无非流形边（slope-topology-check.json）。保留桥轨与门区位置。
- 重跑build_gate_dressing_blender.py让植被贴合新坡面；25个不再符合位置约束的灌木候选被过滤，当前12棵树/125组灌木（不要继续沿用150组旧记录）。
- gate-site-v1.glb / gateSiteData.js / gate-site-placement.json同步，门区场地29744三角面，dressing13184三角面。

### 验证与复现
已完成最终封闭山体的5040条轨道净空检测，0阻挡、门区原碰撞台阶通过、页面错误0。另门区桥到英雄平台合成行走15.8秒通过；Godot门区适配通过，保留132原pod节点。汇聚城堡最终通路和Godot适配证据与实景见本批页面；合成行走不代表完整手动剧情验收。
工程顺序：修改build_gate_site_blender.py → Blender执行场地脚本 → 执行dressing脚本贴地 → 同步placement三角计数 → Godot导入 → capture_gate_target.mjs site-junction-closed和test_gate_site_ground.mjs；城堡refine_junction_blender.py独立导出并跑test_junction_route.mjs与Godot适配。截图使用相同镜头，不能通过隐藏背景代替修复。

仍待：目标中的更丰富石材、攀援植物、港池船舶与暖光；当前主堡仍明显简化，不能称完整目标图还原或全游戏优化完成。
