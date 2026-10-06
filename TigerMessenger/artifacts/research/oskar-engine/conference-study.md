# 大会学习补课：覆盖记录与实现差距

更新：2026-09-29；顾问 `oskar_world_advisor`。按用户要求暂停模型改动，本批仅研究，不修改代码或 Skill。

## 实际看到了什么

这里的“已读”指文字，不等于观看视频。四场官方 YouTube 页面均通过原始页面取得标题、发布者、时长、说明及公开英语自动字幕轨道；字幕地址和普通 timedtext 地址均返回空响应，未取得官方字幕正文。没有下载视频，没有访问私有资料，没有把失败归因于用户没有登录。

| 大会/演讲 | 年份与官方上传日 | 时长 | 本轮实际覆盖 |
|---|---|---:|---|
| [EPC：Wave Function Collapse in Bad North](https://www.youtube.com/watch?v=0bcZb-SsnrA)，BUas Games | 大会2018；上传2018-07-11 | 37:41 | 官方标题/说明已读；视频未看，字幕未读 |
| [Konsoll：Developing The Bad North Look](https://www.youtube.com/watch?v=6JcFbivo8dQ)，Konsoll | 大会2018；上传2019-01-29 | 55:40 | 官方标题/说明已读；视频未看，字幕未读 |
| [IndieCade Europe：Organic Towns From Square Tiles](https://www.youtube.com/watch?v=1hqt8JkYRdI)，IndieCade Europe | 大会2019；上传2020-03-17 | 31:57 | 官方标题/说明已读；视频未看，字幕未读 |
| [SGC：Beyond Townscapers](https://www.youtube.com/watch?v=Uxeo9c-PX-w)，Sweden Game Arena | 大会2021；上传2021-12-08 | 52:01 | 官方说明已读；另读下列镜像字幕00:00–51:03，末58秒缺失，未对照声音/画面 |

[Konsoll 官方讲者档案](https://konsoll.org/speaker/oskar-stalberg/)与[2018档案](https://konsoll.org/talk-year/2018/)核对了讲者、演讲及年份。EPC旧页面不可用时，使用官方BUas视频页面说明，不把当前大会首页当作2018讲义。

机器可读的访问结果、时长、覆盖与缺口见 [conference-coverage.json](conference-coverage.json)。**四场都不能标记“完整看完”；完整官方字幕已读数为0。**

## 能作为事实使用的原始证据

- EPC官方说明明确其主题是用手工瓦片集与 WFC 组装岛屿，并讨论工具流程及美术技术结合。它不能证明每项具体算法细节已核实。[官方视频](https://www.youtube.com/watch?v=0bcZb-SsnrA)
- Organic Towns官方说明直接列出 Marching Cubes 与 WFC 的组合，因此不能把此演讲概括成单纯平滑或仅随机堆叠。[官方视频](https://www.youtube.com/watch?v=1hqt8JkYRdI)
- WFC作者资料阐述选择/传播过程，并记录Bad North有保持导航的启发式；这支持“邻接兼容之外还要关心可通行性”，不支持“WFC自动保证所有路径”。[算法作者仓库](https://github.com/mxgmn/WaveFunctionCollapse)
- Oskar本人2021双网格帖子区分玩法主网格和连续地形表现用的对偶网格；角色和物件不因此自动变成WFC动作系统。[原帖](https://x.com/OskSta/status/1448248658865049605)（本轮读取[文字镜像](https://threadreaderapp.com/scrolly/1448248658865049605)，未观看动画）。
- 作者本人访谈原话说明：Bad North导航启发式有“模块内部可互通”的简化；不可达位置避免放房屋，树林可传达不可进入；Townscaper某些失败可表现为未接好的支架。因此接口相容、玩法连通与失败策略应分开设计。仅将引号内作者自述作为这一条证据，不把记者所有归纳当作者原话。[作者访谈](https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making)

## 2021演讲的字幕待核实索引

以下仅是[镜像自动字幕](https://lilys.ai/ko/notes/356130)中的技术线索，未作音画确认，不提升为已证实的Bad North 2018实现：

| 时间 | 待回看点 |
|---|---|
| 03:10–10:22 | 四边形表现网格、对偶网格、过渡处留足造型空间 |
| 12:07–16:30 | **新实验**混合方形/三角模块、切分、接口与WFC |
| 16:53–22:56 | 外向内生成、可达区域扩展、笼形变及网格平滑；须保护路径宽度 |
| 23:21–24:56 | 道具布置与模块系统分开，避免重叠；不是宣称WFC生成骨骼动作 |
| 34:30–37:34 | 几何边界哈希、按材料语义处理法线；减少人工标记 |
| 38:50–41:14 | 澄清Townscaper网格起点与Delaunay新实验不可混同 |
| 42:27–51:03 | 弱纹理、细线、AO和简化倒影；不是一张通用官方色板 |

末段还有58秒未取得。全文转写有明显词语误识别，不能逐字引用成算法定义。未复制整篇字幕到仓库。

## 我们现在的实现为什么仍远未到位（项目代码审查结论）

当前 `seaStackWfc.js` 的新库只有12个截面模块、6个纵向槽、3条合法组合。`seaStackTerraces.js` 把组合绕单根轴展开；方向退缩能生成真的台面，但本质仍是一根轮廓柱的上下变化。以下能力未实现：

1. **横向拓扑**：不能组合独立峰、分叉山肩、鞍部、海崖转角和与岸线连接的台地。多放几根柱不会补齐此差距。
2. **表达与玩法的分离**：没有用于宏观占据/高度/路径的主网格及用于过渡造型的对偶网格；现有轨道禁入检查是在布局后处理。
3. **丰富模块接口**：现在端口只是半径数值，不描述二维边界曲线、海陆语义、悬崖硬边、台面通道出口；因此通过接口单测不代表自然岩群。
4. **几何拼接与形变**：目前只共享纵向顶点环，没有跨模块横向焊接、硬软区域区别的受限松弛，也没有以路径最小宽度制约形变。
5. **视觉独立验收**：模块合法、网格闭合与看起来像澳洲海蚀海岸是三件事。岩石必须先在无描线、无植被、无云的白模中成立，再验岩色、海面反差与稀疏绿植。

这些是本项目差距和建议，不是假称作者引擎的完整架构。下一步应先补齐四场视频/字幕证据，随后用一小块海崖—岩肩—孤柱模块试验区做横向连接；不要立即把整个场景或城堡交给现有一维求解器重造。现有版本与快照保留，研究期间不继续修改模型。

## 后续执行与覆盖更正（2026-09-29）

实际 Chrome 播放器抽帧未成功：Organic Towns 显示播放错误；Beyond 定位后 readyState=0、videoWidth=0。没有将错误画面计入视频学习，也没有下载远程视频。前文实现差距是研究当时的代码快照。用户后来授权继续施工，现已增加独立 coastal geometry helper，详见 `../../pipeline/twelve-apostles-coast/advisor-geometry-report.md`；仍未实现横向 WFC 或官方引擎复刻。
