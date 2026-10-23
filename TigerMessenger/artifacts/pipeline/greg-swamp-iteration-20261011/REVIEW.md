# Greg 湖沼目标迭代 · 正式游戏验收 2026-10-11

本批四个生产模块默认接入；不是只修改工厂检查页。目标为 `../greg-swamp-target-20261010/target-v3-current-courier.png`，保留当前短外套信使。

## 结果
- 连贯青绿叶面、冷暖树冠与灰绿叶背，矿物斑/潮湿渗痕 shader。详细源件、哈希与恢复开关见 ENVIRONMENT.md。
- 主代理复跑四专项：34/34，通过日志 root-verification.txt。
- CUA 新建内嵌浏览器页成功，正式 index.html 在 iframe 内运行。旧 X 标签绑定曾超时；未绕过浏览器控制限制。
- 同一 middle 机位：middle-before.jpg 为两个本批开关关闭；middle-after.jpg 为默认新版。不同启动相位，动物和船位置不作像素差对照。beauty 静态成片通过现有机位工具导出，非实时截图。
- live-middle-t1.jpg / t2.jpg 是正常实时游戏；泳者位置、长船/桨姿态变化可见，保留当前角色模型。没有完成所有动物周期或输入碰撞验收。
- 捕获错误日志为空；这不是完整 WebGL 错误探测。屏幕 HUD 第一时点14.9 FPS/4164 calls，第二时点10.2 FPS/3611 calls；是完整场景两次抽样，不能归因于本批 shader，也不能称性能达标。

## 人眼判断与下一步
新版墙藤叶色比旧亮绿更平缓，当前镜头矿斑变化很弱；中央大树遮挡主体，墙面仍像大平面，瀑流过亮，水下根系层次不足。与目标明显有差距，未给予90分或整体验收。下一批优先诊断完整场景绘制成本，再处理近镜头遮挡、低亮细瀑流与水下层次。没有修改物种/动作/碰撞，也没有提交发布。

## 查看
review.html 汇集目标、前后和实时证据；runner.html#middle:live 跑正式游戏中层机位，主游戏仍为 /TigerMessenger/。


## 01:13后五小时接续（截止北京时间06:13）
用户最新实景要求继续，Greg中央冠v8收拢横伸约43%、浅弧叶面，35项环境测试通过。root瀑流缩至原约40%宽，opacity1→.52，低亮白青；swampWaterfalls专测1/1。middle-canopy-falls-v2.jpg正式GPU可见低亮瀑流，rim-canopy-v8.jpg仍近岸植物遮挡。一次日志MutationObserver.observe参数Node异常，来源未确认；不能称该页零错误。源码备份source-before/waterfall-restraint和canopy-correction。下一批Greg正在安全合批岸根，GPU未验。
自动任务greg-jakub每20分钟唤醒，截止06:13删除并交付；不是保证连续无间隔算力。当前性能审查：湖沼CPU可提交938节点/117.5万三角，截图11932draw属全场景；树干/冠/小花已有合批，不能重复计收益。
Jakub已保存当前正式书店镇current-entry.jpg/current-overview-close.jpg；阶段目标图生成中。X动态web403、root新建X标签30秒超时、worker IAB unavailable，实际观看0秒/全量未知；图按可访问研究与实际场景，不得声称全部学完。


## 01:30 检查点
岸根54→9渲染批省45draw，保留真实道路拟合/原节点射线，42/42环境整合测试通过。GPU重载正式rim-root-batch-final.jpg渲染成功，但该视角被岸植物遮挡、露根不清晰；只能称正式场景成功运行，不能称露根近景已验收或帧率提升。仍捕获MutationObserver.observe异常，来源未确认，后续定位。
书店镇阶段目标已实际生成：artifacts/pipeline/jakub-bookshop-20261011/target-v1.png及target.html/TARGET_RESULT.md。以本日正式截图和历史场景为依据，X动态仍0秒，不能称全部学完。目标球面/铁路/机器人岗位有艺术偏差，未生产实施。
下一轮：优先root-batch近景同机位A/B、60帧性能窗口及整场景不可见裁剪成本；再处理坑缘近镜头厚植物遮挡与水下根系，不重复做冠/树干/小花批处理。截止06:13临时自动greg-jakub删除交付。


## 岸根正式对照补证
root-close.html同世界定点A/B，root-production-comparison.json。真实道路拟合后36根→9批，实际省27draw（54→9省45仅fixture）；定点GPU手工单帧reset后226→224calls，三角相同1,391,909。不能把此值当全场景FPS；近景仍被叶遮挡，根材质视觉尚未验收。临时两根测试页已关闭。新镜头让路v3移除网点，11专项通过；首次beauty快照未等缓动，已改检查runner等1s再抓，稳定后腿/步道可见但右叶仍遮屏。正在窄调近镜保护。


## 01:48 heartbeat检查点 · 仍在五小时窗口内
- 实施swampOcclusionFade v4：镜头视线clean clip代替Bayer网点，2.2world贴镜保护，实时间.16/.22s过渡；actor/几何/碰撞/opaque/depth保持。旧v2网点和v3小贴镜可query比较。原源/11专测见OCCLUSION_APERTURE.md/OCCLUSION_NEAR_REFINEMENT.md。
- GPU一次首次beauty孔未展开，记录不删除；runner已改等待实际1s再截图。最终rim-aperture-v4-final.jpg右侧巨大浅绿叶让出更多壁/花空间，人物腿和通路清楚、网点消失；左大叶和上方叶仍占大量画面，硬开口边/真实行走稳定性尚未验收。
- 八专项整合54/54（heartbeat-integration-tests.txt）。
- 正式根道路拟合后36→9batch实际省27draw，54→9省45是fixture。root-close.html定点手工单次GPU：226→224calls、1,391,909tris相同；根仍被植物遮挡不宣称材质完全验收；两对照页已关闭。
- 单运行页60真实帧窗口：v3 9.6FPS/103.74ms/5880calls；v4 9.9FPS/101.47ms/5878calls，样本60/windowFulltrue。相位与资源数量不同不作因果帧率提升结论，整体仍低帧率。两性能原文rim-perf-window.txt/rim-perf-v4-window.txt；临时游戏页已关，避免持续耗GPU。
- 控制台仍记录MutationObserver.observe Node参数异常，src/index全文rg未见该API，来源未确认，不称无错误。
- Jakub新增官方Kuba作者文本研究docs/jakub/SOURCE_FOLLOWUP.md，候选视频无字幕/播放，动态0秒；阶段目标已出不重复生成。
- 下一批：读PERF_NEXT.md整场景非湖沼绘制/裁剪只读审查（greg_perf_audit正在写），先验证最小可逆优化；随后水下根系层次与真实玩家环绕机位遮挡。截止06:13交付并删除greg-jakub。


## 04:40接续检查点（截止06:13）
- 02:13两代理因工作区额度耗尽报错；没有把02:13–04:33称持续完成工作。主代理已接续收尾已写巡逻裁剪：harborLogistics.js调用独立harborPatrolFrustum.js，4/4实际工厂专项通过，保存原入口与PATROL_FRUSTUM.md。未知变形保持原false；query harborPatrolFrustum=0可回退。54/54旧环境整合不重复运行。
- 正式rim自然剧情前/默认都0巡逻、0callback，不能说省608draw。本次60帧默认10.5FPS/95.66ms/6844calls；不同相位不作因果改善结论。临时游戏页已关；截图patrol-default-rim.jpg人物可见，但厚近岸植被还遮湖。MutationObserver.observe异常仍来源不明。
- 新实际单次GPU提交分布render-topology-rim.json：7111calls，主camera回调6670、shadow36；robot-operations-live占4005主回调，bookshop-steampunk-robots873，moebius-metropolis759，swamp364。不能将callback份额当CPU/GPU耗时。forced-draw-rim.json仅66forced，非主提交来源。主代理临时仪表全部恢复hook、不隐藏场景、不改剧情。
- 下一优先：针对机器人重复生产实例绘制合批，而非乱裁湖沼/隐藏书店镇。runtime.js template.clone(true)共享各型geometry/material，robotArticulation已经按关节merge，不重复静态焊死动作。可研究按共享geometry/material/rigid joint做实例批，并每帧跟原关节矩阵；必须保留模型节点/ID、raycast/碰撞/炮口/库存/卸车/战斗与存档；近景/远景/multi时点GPU验证后才能默认启用。尚未实施，地平线审查未完成不贸然上。
- Jakub目标v1已出且未运行时实施；X动态仍0秒。不要重复宣称全量学习或重复生成目标。review.html已更新实际验证范围；截止06:13保存结果删除greg-jakub。


## 05:08机器人候选检查点（截止06:13）
主代理独占src/gameplay/robotOps/{runtime.js,renderBatch.js}、src/assets/robotSurfaceDetail.js、tests/robotOps/renderBatch.test.mjs。本批共享rigid几何实例化已接正式入口，但默认关闭（robotRenderBatch=1显式试用）；38/38机器人相关专项通过。三种真实工厂矩阵/碰撞/叶节点/角色身份保持，三人包围球，source-before/robot-render-batch可恢复。详情ROBOT_RENDER_BATCH.md。
GPU全局204批三角升到9.24M没有FPS改善，保留失败证据不采用；三人1224批主robot回调4005→2358，约6.31Mtris、10FPS，仍未帧率达标。近景同坐标原版/候选已拍，轮、炮口与装甲无明显缺件，但没有全动作交互验收。实际profile60帧robot.update~7.98ms，pose+defense5.90ms、batch1.98ms，不能把它说成100ms帧耗时主因。候选默认关闭，正常游戏沿原绘制，已有湖沼改进保持。
下一批优先真实GPU遮挡/昂贵fragment计时；可试不透明planet-surface提前绘制的单页可逆诊断（不能破坏坑洞discard、贴面/透明与地标），验证有益才改生产。暂无GPU分段结论。所有临时游戏标签已关。Jakub目标维持v1、X动态0秒，未全量学完。06:13须交付验证边界并删greg-jakub。


## 05:33 成本定位检查点（截止06:13）
root本轮新增main.js明确opt-in frameCpuProfile=1（正常无计时记录）与本地frame-cpu-probe.html，备份source-before/frame-cpu-profile。实际GPU timer扩展可用，单相位ABBA地表顺序实验4–10ms，手工CPU render23–26ms，没有生产改序。60真实帧主sceneUpdates53–56ms，正式老虎update约41.6ms；全局intersectObjects约433次/帧、42.4ms/帧，九个支撑面都有bbox，整圈岩面1540tri，热点是反复真实支撑射线，不是树冠draw或鼻部矩阵。FRAME_COST.md与各JSON有证据，重复包含范围不能相加。
鼻部单矩阵候选实际924点等价误差7.37e-14但没有明显FPS收益，已保存候选并恢复正式原targetV1（不是回退别人）。4类虎专项7/9通过，support两失败；完全原始targetV1 baseline support测试正在后台exec session89077，日志tiger-support-original-tests.txt，下一turn先读结果，不虚报通过/既有缺陷。Node无GLTFLoader走classic fallback，GPU实际skinV3=true。本轮所有游戏诊断标签已关，MutationObserver异常仍存在。
下一优先：创建真正保留17点足底/腹底全部采样的静态支撑空间索引（ray triangle候选加速），逐点与原Raycaster对齐、旋转湖沼/材质side/重建矩阵/几何version变化兼容，未知回退；先CPU差分与足底姿态验证再开默认/GPU。不要单纯缩采样或停虎。只40分钟窗口，若验证不足保持候选OFF，06:13保存剩余差距删除greg-jakub并交付。Jakubtarget-v1已有、X动态仍0秒，不重复生成。


## 05:47 正式老虎支撑索引检查点（截止06:13）
root已将精确静态三角空间索引接入正式默认：swampGroundRayIndex.js、moebiusTiger.js、tigerTargetV1.js；tigerGroundIndex=0保留原路径，source-before/tiger-ray-index保存原源。17点足底/腹底全部原采样、原更新频率及路径动作保留，未知变形/倾斜/材质组回退原raycast。5040点逐命中差分与2700帧完整饮水巡逻轨迹对照共3专项通过；原始support baseline同样2失败，不能称原套件全通过。Node classic不覆盖GPU V3。
正式默认单页60真实帧：18.6FPS/53.90ms、tiger.update3.14ms、主岛17.31ms（此前虎41.6ms、约10.5FPS）。相位/资源有差异，不叫像素同步A/B；真实命中差分与分段成本支持瓶颈改善。tiger-index-default-rim.json及TIGER_GROUND_INDEX.md有原证。V3正常默认两真实时点相隔5.2秒，位置与四足步态改变，四足各17样本支撑；tiger-default-t1/t2.jpg已实看。V3爪皮与旧代理有视觉间距未改，不能称贴地完全验收。MutationObserver异常仍未定位。
机器人候选仍默认关闭；在虎成本已减轻后正在单页重测组合收益，未经证实不默认启用。整体仍未达到流畅/90分，近岸叶面/水下根层次有差距。Jakubtarget-v1已出，X动态仍0秒。06:13保存交付并删greg-jakub。


05:49组合复测：虎精确索引默认开启后的robotRenderBatch=1候选，60真实帧17.9FPS/55.71ms，calls4832/tris5775593，render26.84ms、robot8.29ms；默认原绘制18.6FPS/53.90ms，render27.52ms、robot约6ms。减少提交仍没有总帧收益，机器人候选继续默认关闭。证据tiger-index-robot-candidate-rim.json/jpg，临时页已关。


05:51最新正式默认中层：latest-default-middle-perf.json，60真实帧20.9FPS/47.94ms，3215calls/4103465tris；这是中层镜头而非rim同机位对比，不将20.9当全场景保证。当前信使短外套、长船/花船、真实游泳者均在正式页面可见，截图latest-default-middle-t1/t2.jpg。仍有亮平台/根系层次/近叶边缘与稳定帧率差距，未达90分。下轮截止交付保持机器人候选OFF，无须重复生成目标或运行已通过差分。


## 05:58真实输入行走补证
player-walk-live.html只在起点使用rim机位放置，随后实际派发KeyW按住9秒，正式physics/camera/frame loop运行，四个墙钟时点21:56:33/36/39/42 UTC保存player-walk-live.json、player-walk-t0…t3.jpg和player-walk-sheet.jpg。不是逐镜头传送或手工增加模拟时间。根位置/速度确实改变，四图人物在各阶段可见，fade权重保持近1；叶面的局部裁切仍出现硬边，且右前叶仍占画面。没有覆盖整个环路、转身、所有天气或碰撞边界，不作完整通路验收。起点局部开口使远背景暴露，需要进一步艺术调整。诊断页已关。

### 截止交付的透明验收口径
| 维度 | 本阶段证据 | 状态 |
|---|---|---|
| 目标一致性 | 缩小冠、叶背、岩壁、细瀑流实际入正式；近景目标根系/平台/叶形有差距 | 未通过90分验收 |
| 动作可信 | 正式两时点船/游泳者/V3虎；2700帧虎支撑原版差分 | 部分验证；V3爪底间距待修 |
| 生态互动 | 保留鲸/虎/猴/花船正式活动链 | 本轮未覆盖全部互动周期 |
| 环境层次 | 岸根保留合批，冠遮挡缩减，斑驳与水色实看 | 水下根层次与硬开口待改善 |
| 稳定性 | 54环境、4巡逻、3精确支撑专项通过 | 原虎2失败及MutationObserver异常未解决 |
| 性能 | 正式60帧岸缘18.6、中层20.9FPS | 未稳定30FPS；不称流畅 |
| 信使 | 正式短外套身份保持 | 未重建/未完成90分模型验收 |

不将缺少动态资料或未覆盖机位折算成臆造评分；整体与信使都没有超过90/100的验收结论。剩余阶段不启用没有帧收益的机器人批处理，保持正式精确支撑索引已验证默认。


## 截止收尾 · 北京时间2026-10-11 06:15
授权实施截止06:13；本次06:14调度触发只保存交付与清理临时任务，没有继续生产修改。正式默认源、source-before恢复源、CPU日志、GPU多时点/行走证据已保存。查看正式游戏 http://localhost:8931/TigerMessenger/ ，湖沼交付 http://localhost:8931/TigerMessenger/artifacts/pipeline/greg-swamp-iteration-20261011/review.html ，Jakub阶段目标 http://localhost:8931/TigerMessenger/artifacts/pipeline/jakub-bookshop-20261011/target.html 。
整体与信使未通过90/100验收。岸缘18.6、中层20.9FPS只是60帧样本，不保证稳定；近叶硬边、水下根层次、V3爪底视觉间距、原虎2个support失败及MutationObserver异常仍在。机器人批处理继续默认OFF。X动态0秒、全量研究未完成，书店镇目标尚未实施。不提交、不发布、不外发。临时自动greg-jakub在本次收尾删除；若清理失败以工具返回为准，不误称已删除。

06:15清理确认：自动任务greg-jakub返回deleteStatus=deleted，临时调度已删除。
