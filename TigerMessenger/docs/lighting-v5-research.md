# Tiger Messenger 光照重构 V5 · 参考材料调研（K0）

- 调研日期：2026-08-22
- 调研人：Kimi
- 用途：PLAN.md 第九章（光照系统 V5）K0 阶段的事实底座。V5 方案引用的每个外部来源在此核对一手表述，**一手表述（原文）、媒体整理（转述）、项目推断（对 TigerMessenger 的工程推导）分三栏记录**；抓不到的内容如实记"未能验证"，不编造。
- 对应 PLAN 章节：`TigerMessenger/PLAN.md` 第九章（本次调研时约 1057–1330 行），重点是 9.1 的来源清单与"约 46 分钟处"的声明。

---

## 来源 1：Oskar Stålberg「Beyond Townscapers」演讲（YouTube）

- URL：https://www.youtube.com/watch?v=Uxeo9c-PX-w
- 抓取状态：**部分成功**（元数据已验证；字幕/演讲内容**未能验证**）

已验证事实：

- oEmbed（www.youtube.com/oembed）确认该视频为 **"SGC21- Oskar Stålberg - Beyond Townscapers"**，频道 Sweden Game Arena，缩略图可访问。即 URL 指向的确实是 PLAN 所称的那场 2021 Sweden Game Conference 演讲。
- Invidious 实例 inv.nadeko.net 的 captions API 确认该视频**存在一条英文自动字幕轨**（`English (auto-generated)`），但字幕内容接口返回 0 字节空响应。

抓取失败记录（如实）：

- `yt-dlp`（2026.03.17，多 player client）被 YouTube 反爬拦截：`Sign in to confirm you're not a bot`；无 cookie 可用。
- 直接 curl 观看页拿到的是 LOGIN_REQUIRED 版本 HTML，不含 `captionTracks`、`lengthSeconds`、`shortDescription`、`publishDate`。
- 第三方字幕站 youtubetotranscript.com 返回 403；youtubetranscript.com 只回首页；多个 Invidious/Piped 实例 502/空响应/验证码。
- 因此视频时长未知，**PLAN 9.1 所称"约 46 分钟处展示动态光照调试模式、voxel AO 烘进切片 atlas"的全部细节本次未能验证**。

| 一手表述（原文摘要+引用） | 媒体整理（转述） | 项目推断（V5 可验证技术点） |
|---|---|---|
| 未能验证。字幕未能获取，演讲口述内容本次无法引用原文。 | 未能验证。未找到该演讲的第三方文字整理。 | PLAN 中"voxel AO 烘进 slice atlas、编辑时快速重投影、shadow mapping + 调试模式"等说法在拿到字幕或人工看视频前**只能视为待验证声明**；V5 的 voxelAoAtlas 设计（`PLAN.md` 9.7）应标注为项目推导，不得写成"Oskar 在演讲中如是说"。 |
| — | — | 可验证的仅剩：演讲存在性、标题、频道（oEmbed）。建议主人本地打开视频人工确认 46 分钟附近内容后回填本节。 |

## 来源 2：Technically Art Issue 129（2022-10-14，Harry Alisavakis）

- URL：https://halisavakis.com/technically-art-issue-129-14-10-2022/
- 抓取状态：**成功**（页面正文完整抓取）

该期是推文集锦，末尾收录 Oskar Stålberg 2022-10-14 的推文（配视频 pic.twitter.com/pIwXBBdQc6），推文原文完整可见：

> "I always write my own lighting solutions. I've had some really naive ad hoc color bleeding in my (very fake) GI before, but this is my first decent attempt to actually have the light *bounce*" — Oskar Stålberg (@OskSta), October 14, 2022

| 一手表述（原文摘要+引用） | 媒体整理（转述） | 项目推断（V5 可验证技术点） |
|---|---|---|
| Oskar 自述：一贯自写光照方案；此前的 GI 是"非常 fake"的、朴素 ad hoc 的 color bleeding；这条推文展示的是他**第一次真正让光"bounce"（反弹）**的像样尝试。 | 该推文是 80.lv 文章（来源 3）所报道实验的原帖；两者指向同一个 Unity 光照实验（2022-10 中旬）。 | 1) "fake GI / color bleeding"与"真正 bounce"是两个代际，V5 的 `indirectBounce.js`（单次反弹，PLAN 9.8）对齐的是后者——属高画质可选档，不应成为默认；2) Oskar 明说此前方案"naive ad hoc"，即 Townscaper/Bad North 级别的 fake GI 不需要物理正确，V5 走 AO+单次反弹路线与此一致；3) 推文未提 voxel、slice atlas、SDF 细节，细节以 80.lv 报道为准。 |

## 来源 3：80.lv「A Custom Lighting Solution Set Up in Unity」（2022-10-21）

- URL：https://80.lv/articles/a-custom-lighting-solution-set-up-in-unity
- 抓取状态：**成功**（正文完整；Oskar 推文视频与 breakdown 细节页面未展开，视为部分）

正文确认的关键表述：

> "Oskar Stålberg presented an amazing lighting solution created in Unity. According to the Twitter post shared by Oskar, the setup was created using Unity's Signed Distance Field, 3D textures, a UV mapping algorithm, Depth Map Shadows, lighting math, and vector math. The author commented that this cool-looking setup is the first time he managed to 'have the light bounce.'"

| 一手表述（原文摘要+引用） | 媒体整理（转述） | 项目推断（V5 可验证技术点） |
|---|---|---|
| 一手部分是 Oskar 推文本身（"have the light bounce"，与来源 2 互证）；页面另有其 breakdown 链接，正文未复述细节。 | 80.lv 转述：方案由 **SDF + 3D textures + UV 映射算法 + Depth Map Shadows + 光照/向量数学** 组成；属"实验展示"性质。 | 1) "3D textures"与 PLAN 9.7 的 slice atlas/体素 AO 方向相容——WebGL2 有 `THREE.Data3DTexture`，或可用 2D 切片 atlas 模拟，两者都是合理工程推导，但"Oskar 用切片 atlas"仍未证实；2) SDF 是其实验的输入之一，V5 若不做 SDF 而用 occupancy voxel，属主动简化，文档中应写清差异；3) depth-map shadows 支持 V5 的"主方向光 + 稳定 shadow map"路线（PLAN 9.6）；4) 该实验是 2022 年的高画质探索，**不等于 Townscaper 发售版的运行时光照**，PLAN 9.1 的这一区分成立。 |

## 来源 4（可选补充）：The Story of Townscaper 与 How Townscaper Works

### 4a. The Story of Townscaper（Konsoll）

- URL：https://konsoll.org/talks/the-story-of-townscaper/
- 抓取状态：**失败**。官网直抓只得 cookie 声明；Wayback Machine 快照被验证墙拦截。页面中与光照/AO 相关的内容**未能验证**。

### 4b. How Townscaper Works（Game Developer，AI and Games 专栏，含 Oskar 访谈）

- URL：https://www.gamedeveloper.com/game-platforms/how-townscaper-works-a-story-four-games-in-the-making
- 抓取状态：**成功**（长文完整抓取）。说明：该文主题是生成算法（Marching Cubes、WFC、不规则网格），光照/AO 着墨很少，以下只列与渲染/视觉相关的可核实点。

| 一手表述（原文摘要+引用） | 媒体整理（转述） | 项目推断（V5 可验证技术点） |
|---|---|---|
| 文中作者转述 + Oskar 访谈引文：窗户不建在 tile 网格里，而是放置后用 **stencil buffer 从网格上挖除**（"he uses a stencil buffer to cut them out of the mesh"）；另有"optimisations to the rendering to minimise aliasing and ensure outlines of shapes and structures continue to look crisp yet detailed at any angle or distance"；岛屿生成后"merged into one mesh to minimise draw calls"。 | 文章确认 Townscaper 的视觉可读性依赖抗锯齿与轮廓清晰度的专门优化，且几何合批是既有实践。 | 1) V5 的"背景对比/深度差控制轮廓"思路（PLAN 9.9 debug view、V4 G8）与"轮廓保持 crisp"的公开表述方向一致，但具体实现是项目推导；2) stencil/cutout 门洞比深色贴片更能形成真实暗部，对 V5 AO 验收点（门洞、支架下）有参考价值；3) 合批减 draw call 与 V5 局部灯预算（PLAN 9.8）同属性能纪律。 |

## 来源 5：Bad North 配色分析（deathisawhale.com）

按任务要求不重复调研；PLAN 第七章（7.1–7.7）已有其结论与项目化推导。V5 仅继承其"环境柔色托底、反馈色高优先"的层级原则。

---

## 可验证技术点清单（每条标注来源与可信度）

| # | 技术点 | 来源 | 可信度 |
|---|---|---|---|
| 1 | voxel AO 烘进切片 atlas（slice atlas）、编辑时快速重投影、约 46 分钟处动态光照调试模式 | PLAN 9.1 对来源 1 的转述；字幕抓取失败 | **未能验证（低）**——需人工看视频确认后方可引用 |
| 2 | Oskar 自述此前 GI 为"very fake"的朴素 color bleeding；2022-10 实验是首次真正的 light bounce | 来源 2 推文原文 | **高** |
| 3 | 该实验使用 SDF + 3D textures + UV 映射 + Depth Map Shadows + 光照/向量数学 | 来源 3（80.lv 转述 Oskar 推文与 breakdown） | **高（媒体转述层）** |
| 4 | 单次 bounce（而非多次迭代 GI）即可作为风格化游戏的"光反弹"上限 | 来源 2+3 互证（"first decent attempt… light bounce"） | **高**；V5 `indirectBounce.js` 只传播一次的设计与之对齐（PLAN 9.8） |
| 5 | 主方向光 + depth-map shadow 是合法的基础阴影路线 | 来源 3（"Depth Map Shadows"） | **高（存在性）**；texel snapping/focus bounds 等稳定化细节为**项目推导**（PLAN 9.6），无来源支持 |
| 6 | 窗户用 stencil buffer 从网格挖除而非贴片 | 来源 4b | **高** |
| 7 | 渲染层专门优化抗锯齿与轮廓清晰度；生成后合mesh减 draw call | 来源 4b | **高** |
| 8 | "fake GI 不需要物理正确，风格化游戏可先用 AO+单次反弹" | 来源 2 的语气 + 项目归纳 | **中**（属合理归纳，非原话） |
| 9 | 2D 切片 atlas 模拟 3D 纹理以兼容 WebGL | 无来源 | **项目推导（低）**——80.lv 只确认"3D textures"，切片方案是 TigerMessenger 的工程选择 |

### 给 V5 的直接结论

1. PLAN 9.1 中关于演讲"约 46 分钟"的两条声明（动态光照调试模式、voxel AO slice atlas）**本次未能验证**，V5 文档引用时必须标"待人工确认"。
2. "先 AO+稳定阴影、单次反弹为可选高档"的路线有来源 2/3 互证支持，可推进。
3. shadow map 稳定化（texel snapping、focus bounds）、occupancy voxel 取代 SDF、slice atlas 模拟 3D 纹理，均为项目推导，文档与代码注释中须与来源事实分开（PLAN 9.10 已如此要求）。
