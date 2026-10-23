# Mœbius 游戏创作者研究：水晶城、湖沼、叹息之门

> 2026-10-07 更新：已按用户要求建立 Greg team，并开始湖沼首轮实现。最新[小时计划](greg-team/PLAN.md)、[TODO](greg-team/TODOS.md)、[团队分工](greg-team/TEAM.md)。GDC 学习覆盖现已扩展为全篇634条英语字幕逐段阅读＋32真实关键帧核对，见[时间轴与实施拆解](greg-team/GDC_SABLE_TIMELINE.md)；不是连续完整音画观看。下文“仅官方摘要”为初次研究时的历史状态，不能代替最新报告。


研究日期：2026-10-07。范围：公开作者访谈、制作文字、官方演讲摘要；本轮未完整观看演讲或实际运行这些游戏，不把网页图片当动态验收。本文件是研究与提案，不表示 Three.js 风格系统或顾问配置已经部署。

## 结论与证据分级

推荐以 **Gregorios Kythreotis / Sable 的空间叙事、Antoine Dekerle / Rollerdrome 的明确美术规则、Vito Salamone / Synergy 的生态城市**为主线；湖沼补充 **Patric Fallon / Aquamarine、Niklas Åkerblad / Ultros**。**Charles Boury / Caravan SandWitch**是经 Sable 传递的间接参考，不应冒充本人明确宣称直接师承 Mœbius。

- A：具名作者或制作团队直接说出参考、方法；访谈答复属于第一手陈述，记者自己的形容不自动属于 A。
- B：团队说明间接影响链，或访谈记者归纳已有采访；保留限制。
- C：仅外观相似。不能据此断言作者影响、shader 或生成算法。
- “项目提案”是本项目推断，和上述作者陈述分别书写。

## 六组值得持续学习的创作者

| 人物 / 团队（制作时身份） | 游戏 | 影响证据 | 本项目最适用部分 |
|---|---|---|---|
| Gregorios “Greg” Kythreotis、Daniel Fineberg / Shedworks | Sable | 采访明确记录 Mœbius 来源；空间方法有作者原话，GDC 有本人演讲摘要 | 水晶城尺度、叹息之门地标与抵达过程 |
| Antoine Dekerle（主美）、Paul Rabbitte（创意总监）/ Roll7 | Rollerdrome | A；主美详细讲 Mœbius 与 Hergé 及制作规则 | 色板、描线、快速移动时场景可读性 |
| Patric Fallon / Moebial Studios | Aquamarine | A；本人指定《The World of Edena》 | 湖沼异星生态、宁静与未知并存 |
| Niklas “El Huervo” Åkerblad / Hadoque | Ultros | A；导演说明美术总监的 Mœbius 等参考 | 湖沼有机形态与植物的通行作用 |
| Vito Salamone / Leikir Studio | Synergy | A；美术总监直接确认 | 水晶城居住逻辑、自然与人工共存 |
| Charles Boury、Emi、Adrien / Plane Toast | Caravan SandWitch | B；创始人说明 Boury 参考 Sable，后者受 Mœbius 影响 | 真实地域观察转化为原创幻想环境 |

### 1. Sable：建筑先承载生活与方向，再成为奇观

**作者陈述。** Kythreotis 在 2019 年访谈中强调好奇、惊奇与孤独感；稀疏环境使导航地标突出。建筑研究关注人如何生活、如何被环境引导。采访列出的建筑参考包括 Carlo Scarpa、Álvaro Siza、Archigram、日本新陈代谢派；不能把这些都笼统归入“莫比斯 shader”。同篇采访将 Mœbius 漫画列为影响来源，但这句是记者归纳，和作者逐句回答分开看。[Sable: Exploration Through Line-Art，2019](https://www.cookandbecker.com/en/article/170/sable-exploration-through-line-art.html)

**演讲证据。** Kythreotis 的 GDC 2022 演讲主题直接包括小团队限制、手作感、3D 世界的 2D 表达与游戏可读性。本轮只读官方摘要，未看完整视频，不声称掌握全部渲染实现。[GDC：The Art of Sable](https://www.gdcvault.com/play/1027721/The-Art-of-Sable-Imperfection)

**项目提案。** 水晶城先做“有人使用的台地—桥—门—室内”连续尺度，再安排少数统领轮廓的晶体。叹息之门用开阔前场衬托门体，保留穿门后另一层空间；近处门把、阶梯、灯和人提供尺度参照。不要把宏伟理解成每个构件都放大。

### 2. Rollerdrome：可执行的视觉语法，而非笼统滤镜

**作者陈述。** Dekerle 直接说明 Mœbius / Hergé 来源：色块及阴影边界都有恒定屏幕宽度的黑线，平色而非渐变，远处减少细节；环境通常围绕四至五种主色。材料用少量线与斑点表达，并用繁简区域对比保证高速运动可读性。这些是 **Rollerdrome 自己的规则**，不是所有 Mœbius 作品的普遍定律。[主美完整文字问答，2022-09-26](https://www.gamedeveloper.com/art/deep-dive-rollerdrome-art-direction-q-a)

**交叉证据。** Roll7 创作者 AMA 也明确将两位漫画作者的节制细节与高速可读性联系起来。[Roll7 开发者 AMA，2022](https://www.reddit.com/r/Games/comments/x8zxpb/were_roll7_developers_behind_rollerdrome_ask_us/)

**项目提案。** 每区先定义石材、阴面、植被、水、交互强调色的语义角色；角色与危险物不淹没在墙线里。叹息之门远景只保留洞口、外轮廓和关键接缝，近景再显露材料刻痕。先试局部线条，不直接改全游戏后处理。

### 3. Aquamarine：从《Edena》学异星自然与探索节奏

**作者陈述。** Fallon 说最初开发冲动来自 Mœbius 的《The World of Edena》，后来玩法由早期 roguelite 转向探索与生存；回合制为玩家提供观察和思考时间。异星海洋与脆弱陆地是其叙事环境。不能把他当时“想做第一个”的个人回忆转述成游戏史事实。[创始人访谈，2020-03-11](https://indiegamepicks.wordpress.com/2020/03/11/aquamarine-interview/)

**项目提案。** 湖沼采用清晰水面、少数有辨识度的生物和植株群，围绕浅水、栖息、遮蔽、可走岸线建立生态层次。每类奇异植物需要可解释的结构关系，不把随机彩色球堆满岸边。保留看得见下一处安全落脚点的间隔。

**后续研究入口。** [Moebial 自己的开发日志](https://moebial.itch.io/aquamarine/devlog)包含多年开发片段与解说演示索引；本轮未完整观看这些视频。

### 4. Ultros：植物可以组织空间，但不必照搬全屏高饱和

**团队陈述。** 导演 Mårten Brüggemann 指出 Åkerblad 的个人参考包括 Mœbius、Stan Sakai；Ultros 的有机科幻还受 Giger 与《风之谷》影响。种植与探索相互作用，玩家理解植物后改变通行方式。这是多源融合，并非单一“莫比斯标准”。[导演问答，2024-02-05](https://www.pushsquare.com/features/interview-how-castlevania-studio-ghibli-inspired-the-action-gardening-of-ultros)

**补充来源。** 官方 PlayStation 采访同样将自然、植物行为与循环主题联系起来，并提及 Mœbius 和 Ernst Haeckel。[官方开发者访谈，2024-02-12](https://blog.playstation.com/?p=389260)

**项目提案。** 湖沼可借鉴植物的根—茎—冠连接、有机孔洞、重复但非均匀的生长节奏。饱和色留给少量花、果、危险或可互动节点；水与地面保持安静。先保证玩家与步行边界读得清，再增加繁茂程度。

### 5. Synergy：适合水晶城的生态聚落逻辑

**作者陈述。** 美术总监 Vito Salamone 直接确认 Mœbius 的梦幻科幻与清晰线条是重要来源，也提到法比漫画、七八十年代科幻和既美丽又令人不安的自然。导演 Sébastien Perouffe 强调观察、理解环境与规划，创意总监 Aurélien Loos 强调合作。[三位制作负责人的问答，2025-04-24](https://www.cheatcc.com/articles/synergy-interview/)

**项目提案。** 水晶城的供水、庇阴、居住、运输功能应在空间上成立：建构物围合可用的公共空间，晶体与街道之间有尺度过渡。采用“人工体块有秩序、生态形态有差异”的分工，避免所有建筑都成为同一种尖晶柱。

### 6. Caravan SandWitch：间接影响，值得学的是采风和取舍

**团队陈述 / 证据限制。** 创始人 Emi、Adrien 说明美术方向由 Charles Boury 推进，参考 Firewatch、Ghibli、Sable；访谈把 Mœbius 放在 Sable 的影响链上。他们也谈到普罗旺斯实地经验、徒步与 Cézanne 的色彩。没有取得 Boury 本人关于直接 Mœbius 来源或 shader 的完整陈述，因此列为 B。[创始人访谈文字稿，2024-09](https://www.pointnthink.fr/en/emi-and-adrien-creators-of-caravan-sandwitch/)

**项目提案。** 湖沼先观察真实湿地的树根、岸边侵蚀、水位印记；水晶城和叹息之门先观察真实构造厚度与入口过渡，再做科幻转译。以地域和功能补足原创性，比收集一堆相似截图更能约束施工。

## 技术补充：不要将第三方实验当成 Sable 源码

Jan Kaluza 的 **Moebius Style Shading** 是 2017 年受 Sable 早期视频启发的 UE4 个人实验：平色硬分界着色模型，加后处理边缘检测；粗糙度参与高光控制。作者公开说明源码在 UE4.17 分支，访问需要关联 Unreal 账号。本轮未取得、编译或验证其源码，不能说可以直接移植到 Three.js，更不能说这是 Shedworks 的实现。[作者技术页面](https://jan.games/personal-work/moebius-style-shading)

## 三个区域的首轮最小试验（项目方案，未实施）

| 区域 | 只做一个最小样区 | 主要视觉关系 | 必须保留的玩法边界 |
|---|---|---|---|
| 水晶城 | 一段有门洞、桥头及晶体背景的街道 | 远处晶体统领轮廓，中景建筑围合，近景人尺度 | 现有交通、出入口与落脚面；不因改材质使可走面误读成玻璃虚空 |
| 湖沼 | 一段岸线、两组植被与一处浅水 | 安静水面衬托有结构的异星植物；稀疏强调色 | 水陆边界、路径、现有飞艇与故事触发范围 |
| 叹息之门 | 门洞和两侧各一个完整体量 | 留白前场、深门洞、实体厚度、次级细线 | 门前后连续通行、舰船或车辆净空、现有开闭关系 |

验收采用同机位、同时间、同曝光的近中远景，以及沿真实路径移动的录屏。先关闭新增描线/雾看体量，再灰阶检查主体和背景，最后检查昼夜色彩。远处线不能合并成黑面；近处不能靠描边补不存在的厚度。说明帧时、draw calls、显存的实际测量条件，不先写“性能达标”。

代码定位已确认 `src/scenes/messenger/loadMoebius.js` 调用水晶城构建、V7/V9 后处理路径；`src/world/moebiusCity.js` 有晶体物理材质与实例。未来实施必须沿真实调用链确认当前启用版本，不能只修改旧工厂。此次未全面审计三区运行时，不宣称画面已符合提案。

## 风格顾问的建议职责

建议名：**Mœbius 世界风格研究顾问**。定位为研究与评审代理，明确不是 Mœbius 本人，也不代表上述作者。初始知识入口为本文件；不要冒称六位创作者共同认可的方法。

1. 每项意见分成“作者陈述 / 画面观察 / 本项目推断 / 待验证”，记录来源、日期及实际阅读或观看范围。
2. 首先审查轮廓、空间留白、色彩层级、生活尺度和可读路径，之后才建议材质与描线。不能用滤镜遮掩错误几何。
3. 水晶城、湖沼、叹息之门共享简洁色块与选择性细节，但保持各自生态、材料和功能。不得将全部区域做成 Sable 黄沙、Ultros 荧光或高山圣城彩色屋顶。
4. 每次只给一个可验证样区：现状证据、所选参考、明确修改点、复用代码、固定边界、视觉与功能验收。不擅自扩张到铁路、玩家控制和任务系统。
5. 研究阶段不自动等于实施授权；获明确施工授权后按范围执行。多代理修改先约定文件所有权，保留现有用户布局与快照。
6. 不虚构作者参数、图形算法或风格相似度分数；文档保存不等于顾问安装、截图不等于GPU实测。

## 尚未覆盖

- GDC Sable 完整演讲音画与逐段技术记录；目前只有官方摘要。
- 六款游戏在相同镜头运动、日夜或环境条件下的直接运行比较。
- Charles Boury 本人关于 Mœbius 来源与技术实现的进一步第一手说明。
- 本项目三地区的最新实景基线、用户认可目标与实际渲染耗时。它们决定提案是否适用；研究来源不能替代实景验收。

## 项目顾问配置

已创建项目级 `.codex/agents/moebius_world_advisor.toml`，按官方 [自定义代理配置](https://learn.chatgpt.com/docs/agent-configuration/subagents) 的 name/description/developer_instructions 格式保存。未指定新模型或扩大权限。本会话工具角色列表尚未包含此角色，未声称已经热加载；当前研究由既有子代理按上述职责完成。
