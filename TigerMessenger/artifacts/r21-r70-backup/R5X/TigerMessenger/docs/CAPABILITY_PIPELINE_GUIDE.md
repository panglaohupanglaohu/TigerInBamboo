# 能力树 × 游戏构建管线：接手 Guide

写于 2026-11-23。给任何接手的模型（SWE-2 等）：不依赖聊天记忆，读完本文件就能继续。
本文件只管「两库 → 能力树 → 管线 → 实景」这条主线；双工坊的周期测试规则仍在 `WORKSHOP_GUIDE.md` / `WORKSHOP_TEST.md`，逐轮证据在 `WORKSHOP_LOG.md`。

文中的数字都是 2026-11-23 20:10 重算的结果。上游一直在变：写这份文件的两个小时里，原版就从 306 变成 309 又变成 313 个文件，补学队列从 80 变成 76 又变成 75 项。**用数字前先按 §5 重算，不要抄本文件**。

---

## 1. 本项目的目的、我的理解、业界做法、本系统的创新

### 1.1 目的

**做一个具备自主学习能力树的游戏构建管线系统。**（用户原话）

### 1.2 我对这句话的理解

一句话：**一台会自己长出新指令的游戏构建编译器。**

- 管线是程序，能力是指令。「把高山圣城做出山的模样」是一段程序：保护带 → 山体隆起 → 侵蚀 → 圆润 → 岩屑坡 → 着色。
- 普通的程序化管线，指令集是技术美术手写的，写完就固定了。本系统的指令集是**学来的，而且一直在长**：作者每发一条新帖、原版库每多一个文件，都可能变成一条新指令。
- 能力树是这台编译器的「指令集手册 + 学习计划」。它同时回答三个问题：现在有哪些指令能用；每条指令有几代、哪代最好；下一条最该学哪条。
- 「自主」的意思是这个循环不靠人推：系统自己发现上游变了、自己归类、自己排出下一步学什么、自己在真实场景里试、自己验证、失败了自己调整学习顺序。人只做一件事：看结果，决定采不采用。

所以它有三个转速不同的环，必须咬合：

| 环 | 周期 | 输入 → 输出 | 现在的状态 |
|---|---|---|---|
| 学习环 | 天 | 帖子 / 视频 / 两个代码库 → 能力树上的新能力和新代际 | 能算、能排队；重算和归线要人手动触发 |
| 构建环 | 分钟 | 目标 + 场景 → 管线 → 候选 → 验证 | 7 层管线能跑；管线要人手动拼 |
| 采用环 | 秒 | 候选 → 实景对照 → 用户采用 → 进游戏 | 能预览对照；没有一个候选被采用 |

咬合点有两个：学习环产出的能力必须**当轮**进构建环（现在做到了）；构建环的失败和采用环的拒绝必须回到学习环改变学习顺序（规则写了，没有在真实运行里验证过）。

### 1.3 业界怎么做（2026-11-23 查证，来源在本节末尾）

| 做法 | 谁 | 核心机制 | 本系统借什么、哪里不同 |
|---|---|---|---|
| **规则链式的世界生成** | Ubisoft《Far Cry 5》（GDC 2018，Étienne Carrier） | 一组 Houdini 工具依次运行：淡水 → 道路 → 围栏电线 → 悬崖 → 生物群系；**每个工具写出遮罩，后面的工具读它**。每晚在构建机上无人值守重建整个世界；同样输入必须同样输出；美术能覆盖程序结果 | 借：遮罩链、确定性、夜间重建、人工覆盖优先。不同：他们的工具集是固定的 |
| **任务依赖图** | SideFX Houdini PDG / TOPs | 把流程拆成带依赖的小任务（work item），只重算变了的部分，可并行、可分发 | 借：按依赖增量重算。我们的重算现在是全量、串行、手动 |
| **节点图 + 种子确定性** | Unreal Engine PCG 框架 | 采样 → 过滤 → 变换 → 生成，点带属性在节点间流动；同种子同结果；子图可复用 | 借：能力之间传带属性的数据，而不是各自重新扫描场景 |
| **会长大的技能库** | Voyager（NVIDIA 等，2023，Minecraft 里的终身学习智能体） | 三件套：**自动课程**（按当前水平和世界状态提出下一个任务）、**可执行代码的技能库**（学会就存，以后检索复用）、**带环境反馈和自我验证的迭代**。解锁科技树里程碑比之前的方法快很多 | 这是和本项目最像的一个。借：三件套的结构。不同：它的技能是打游戏的动作，对错由游戏状态判；我们的能力是造游戏的方法，「好不好看」没有现成的裁判 |
| **看分布，不看单张** | 表达范围分析（Smith & Whitehead，2010） | 评价一个生成器，要跑一大批结果，用与输入参数无关的指标画出它能产出的范围 | 借：整个方法。我们现在每个候选只看一个种子、一两个机位 |
| **不规则网格 + 模块拼接** | Oskar Stålberg（Townscaper、Bad North） | 松弛过的不规则四边形网格 + 手工模块 + 约束求解（他自己说更接近 model synthesis）。程序管摆放，美术管模块 | 这是本项目学习的对象本身，两个库都是照他的公开帖子做的 |

**业界没有现成答案的地方**，也就是本系统要自己想的地方：

1. 工具集固定的管线（Far Cry、PCG）不会自己长；会自己长的技能库（Voyager）是打游戏不是造游戏。**把「会长的技能库」接到「造世界的管线」上，没有看到现成的做法。**
2. 造世界的结果没有客观对错。业界靠美术总监看；我们要让系统在人看之前先筛掉大部分不行的。
3. 我们有一个别人没有的条件：**同一个能力有两份实现**（原版和重构版）。这通常被当成负担，其实可以当成资产。

### 1.4 本系统的创新（我的设计）

每条写明：想法、为什么、现在有多少、落在哪一轮。**没做的就写没做。**

**创新 1：原版当裁判。**
两个库对同一个能力各有一份实现。给两边喂同样的种子和输入，比较输出：一致，就把状态从「导出名对得上」升到「行为等价」；不一致，差异就是一条自动生成的缺口，带着可复现的输入进补学队列。这样原版的「广」变成重构版的验收标准，重构版的「干净」变成交付物，对账不再靠人读代码或靠名字猜。
现状：导航第一例已做（待验收）。R33：`TigerMessenger/src/system-workshop/battle/nav-parity.js`（原版 cheesenav / holenav 只读 import，对 vendor 副本 layerednav / BattleNavigation；「同判据」与「战役判据」两种口径），`tools/refactor/nav-parity.mjs` 写 `catalog/parity/navigation.json`、三个导航能力各一份 ④ 证据、`navigation-demand.json`（export-learn-queue 默认并入补学队列）；战役侧栏现算显示。其余能力线的对账仍只比导出名。
落点：R33 先在导航上做第一例（原版 `cheesenav` / `holenav` 对重构版 `layerednav` 的连通块统计），R41–R50 推广到地形。

**创新 2：能力带契约，管线自己拼。**
每个能力声明三样：读什么（高度场、陆地遮罩、轨道遮罩……）、写什么、保证不动什么（建筑保护带、轨道净空、海岸线）。有了契约：能力之间像 Far Cry 那样传遮罩而不是各扫各的；给一个目标，系统能沿契约自己拼出管线，不用人去左栏一个个拖；验证 Worker 的检查项直接从「保证不动什么」生成，不会漏。
现状：部分有。山形能力有 `requires` 前置和保护遮罩，「圣城山形」一条目标路径能一键装好；但契约没有统一格式，别的层没有，管线默认是空的。
落点：R22 用现有的 `match` 做场景自动预装；R51–R60 统一契约格式并做自动拼装。

**创新 3：代际要过擂台。**
「A+ 必定比 A 好」不能靠说。每条能力线配一个固定的考场（固定种子的测试岛 + 一组指标 + 固定机位），新一代必须在考场上赢过上一代才能挂上 A+ 的名字；以后任何改动让成绩退步，测试直接红。指标要选和输入参数无关的，例如地形线用中等坡占比、竖崖占比、排水率、硬边位移。
现状：有一个样例。硬边平滑的三档对照就是这种形式（分层平滑硬边位移 0.013，普通平滑 0.121）。没有形成制度，树上的代际现在只按发帖时间排。
落点：R26–R27 给地形线建第一个考场，R41 起每嫁接一条线就配一个。

**创新 4：九级成熟度，每级一份机器能查的证据。**
现在的四档（学了 / 有代码 / 可执行 / 进游戏）太粗，所以才会出现「可执行 39 / 55 / 64」三个数。改成九级，每升一级必须有一个文件作证，由脚本检查而不是人填：
① 看过来源 → ② 原版有实现 → ③ 重构版有落点 → ④ 行为等价或差异已登记（创新 1）→ ⑤ 封装成可执行能力且有单元测试 → ⑥ 实景端到端跑通且有截图 → ⑦ 过了擂台（创新 3）→ ⑧ 用户采用 → ⑨ 默认进游戏。
树上每条线显示它最高到了第几级，「看不见的新功能」会直接表现为一堆停在第 5、6 级的能力。
现状：已做（待验收）。R23：纯逻辑 `REACodeRefactoring/src/core/capability-maturity.js`（级别 = 达到的最高级，缺口照写成「L6（缺 ④）」；每级证据路径由脚本重新校验，证据被删或被改就掉级），生成器 `tools/refactor/build-capability-maturity.mjs`（§5.2 第 ⑦ 步）写 `catalog/capability-maturity.json`；能力树每条线显示最高级与九级分布，左栏每个 ⚙ 能力带徽章。④⑦⑧⑨ 的证据位置已定（`catalog/parity/<能力ID>.json`、`catalog/arena/<能力ID>.json`、`catalog/adoptions.json`、`catalog/defaults.json`），现在都还没有文件，所以这四级是 0、多数能力显示「缺 ④」。测试与端到端 NOT_RUN，待 Kiro。
落点：R23。

**创新 5：课程由实景差距驱动。**
Voyager 的课程看「当前水平 + 世界状态」。我们的世界状态是真实场景里量出来的差距：圣城竖崖占比 14% 超过阈值 12%、峰高掉了 10 米、十二门徒顶面太平——这些验证指标和用户的每一次「放弃」，都应该直接换算成对某条能力线某一代的需求分，推高它在补学队列里的位置。这样「下一步学什么」由游戏现在哪里最难看决定，而不只是由帖子的时间顺序决定。
现状：部分有。管线里放了但不能执行的节点会进需求，验证失败会加分。R40（待验收）接上了「指标离阈值多远」：验证检查项带 `metric`（数值 / 阈值 / 方向），夜间重建收集成 `catalog/verification-metrics.json`，`export-learn-queue.mjs` 按 `tools/refactor/metric-gap.mjs` 的公式（越线 2 + 10·相对差距，封顶 6；一成以内临界 0–1；按线取最高）加分重排。现在指标只来自 Node 合成场地上的目标路径（表现层为主），实景指标（圣城竖崖占比等）要等各层 verify / 端到端写 metric 才进来。「用户放弃」没接。
落点：R40 接指标差距（已写，待验收），R81–R90 接用户放弃并做成自动。

**创新 6：看分布，不看单张。**
每条管线跑完后，再用 20–50 个种子各跑一遍，画出指标分布，报告「这条管线稳定能产出什么范围」，并自动挑出最好、最差、最典型的三张给人看。一张好看的截图可能是运气，分布不会。
现状：没做。
落点：R28 先给山形管线做，R61–R70 推广。

**创新 7：三级判断，贵的只干贵的活。**
- 确定性检查（免费）：碰撞、净空、连通、面数。有一项不过就直接否决，不问任何模型。
- JEV（很便宜）：重复的小判断——归类、筛选、是或否。
- 开发模型（贵）：写代码、看图、做设计决定。
规矩：凡是「对一批东西逐个做同一种判断」的活，开发模型不许自己逐个读，先交给 JEV 筛，只复核低置信度的那部分。
现状：已做。通用入口 `tools/jev/ask.py`，按单项缓存（§5.4）。本文件 §8 的「补学队列里多少是看得见的功能」就是用它算的。

**创新 8：夜间重建和晨报。**
学 Far Cry 的夜间烘焙：每晚无人值守跑一遍——漂移检查、重算能力树、JEV 归线、每个场景的每条目标路径各跑一次、和昨天的结果比。早上给出一页报告：新增了什么能力、哪条线升了级、哪个场景的候选变好或变差了，附同机位前后对照图。「自主学习」和「看得见新增功能」在这一页上合到一起。
现状：第一版已写（R40，待验收）：`TigerMessenger/tools/nightly/run-nightly.mjs` 一条命令跑完漂移检查、§5.2 ①–⑦、JEV 归线、每条目标路径各一次（纯数据的层在 Node 里用合成场地跑，其余记 NOT_RUN）、单元测试，和上一次快照比，写晨报 `artifacts/nightly/<日期>/morning-report.md`；管线页顶部「夜间晨报」面板读 `artifacts/nightly/latest.json`。还没有：同机位前后对照图（浏览器端到端不在夜间跑）、定时触发。用法见 §5.5。
落点：R40 出第一版脚本（已写，待验收），R81–R90 变成定时任务。

**这八条合起来就是 §1.2 那三个环的咬合方式**：创新 1、4 让学习环的产出可信；创新 2、8 让构建环不靠人拼、不靠人催；创新 3、6 让「好」有据可查；创新 5 把采用环的结果送回学习环；创新 7 让整件事跑得起。

### 1.5 衡量标准

**一条完整流程在真实游戏里跑通，并且用户在管线页面上能看到新增的功能。** 页面能打开、导出名对得上、单元测试通过，都不算。

### 1.6 来源

- Far Cry 5：GDC 2018《Procedural World Generation of Far Cry 5》（Étienne Carrier）；PlayStation Blog 2018-03-22 同名文章 `https://blog.playstation.com/2018/03/22/the-procedural-world-generation-of-far-cry-5/`
- Houdini PDG / TOPs：SideFX 文档 `https://www.sidefx.com/docs/houdini/tops/intro.html`
- Unreal Engine PCG：Epic 开发者文档 `https://dev.epicgames.com/documentation/unreal-engine/API/Plugins/PCG/UPCGGraph`
- Voyager：`https://voyager.minedojo.org/`
- 表达范围分析：Smith & Whitehead, *Analyzing the Expressive Range of a Level Generator*, 2010 `https://users.soe.ucsc.edu/~ejw/papers/smith-pcg-2010.pdf`
- Oskar Stålberg：SGC21《Beyond Townscapers》`https://www.youtube.com/watch?v=Uxeo9c-PX-w`；Konsoll 2021《The Story of Townscaper》

我读的是这些页面的摘要和讲稿片段，没有通看完整演讲视频。

---

## 2. 用户的要求（原话，优先级从高到低）

接手后这些就是你的要求，不用再问用户。

| 用户原话 | 含义 |
|---|---|
| 「目的是：具备自主学习能力树的游戏构建管线系统」 | 见 §1。 |
| 「REACode 中的代码能力覆盖能力更广，但是里面可能会有瑕疵，因为它没有经过重构。REACodeRefactoring 代码虽然是重构的，但是能力范围有限。所以两个目录需要你综合起来看。并且创造性的形成本系统的能力树。」 | 见 §3。两库必须合着看，不能只用其中一个。 |
| 「这颗能力树，你必须参考业界最牛的知识能力及创新的构造方法，这是本系统的科技狠活的基石。」 | 能力树的结构方法见 §4。它是全系统最重要的部件。 |
| 「别忘记了，这个最重要，因为能力现在是不停止的学习，不停止的添加」 | 每一轮都要维护能力树（§5），不能做完一次就放着。 |
| 「想到 A，然后是 A plus，必定 A plus 要比 A 更好。」 | 代际必须有可比的证据：同机位对照或数值指标，说明新一代好在哪。 |
| 「如果一个流程都没跑通，你这个 fable 5.2 就是徒有其表」 | 先跑通一条完整流程，再铺开。 |
| 「需要完善本系统的管线 pipeline，构建游戏管线……把高山圣城的地形优化交给你来做……当前场景中山形构造太差，没有山的模样。你需要善于运用 low poly 及自身已经具备的强大能力树将高山圣城的地形做好。」 | 高山圣城山形是第一条必须跑通并交付的游戏管线，而且必须用能力树上的能力来做。 |
| 「同意按 Bad North，配色你参考 bad north 配色或者 townscaper 配色」 | 圣城山形的美术方向已定：连绵、边缘圆润；配色二选一。 |
| 「我没看到你任何的新增功能，我认为这个管线上应该有很多的新增加功能」 | **当前最大的欠账。** 见 §6。以后每轮的产出必须在管线页面上看得见。 |
| 「你要节省 Token，JEV 的技能你需要考虑」「JEV 这个能力，也是目前你这个模型需要使用的，要不你很快就没有 quota 了」 | 开发模型自己干活也要用 JEV：批量的分类、筛选、是否判断先交给它（§5.4）。 |
| 「你就不能写你的思路及业界如何做的？你就不能给我看到你的创新能力？」 | 文档和方案不能只复述用户的话。要写出自己的理解、查证过的业界做法、以及本系统与众不同的设计（§1.2–§1.4）。 |
| 「这些建议不用问我」「对，直接开干」「你继续 20 轮优化，别停止」 | 常规执行不用请示。只有不可逆操作和「采用为默认」需要用户点头。 |
| 「点击进入游玩的按钮后可以全屏」 | 已做，见 §6.3。 |

---

## 3. 两个目录怎么综合看

| | `townscaper-web/REACode` | `townscaper-web/REACodeRefactoring` |
|---|---|---|
| 是什么 | 原版。按作者帖子逐个做出来的实验 | 重构版。整理成模块的库 |
| 长处 | **覆盖广**：309 个代码文件 | **结构好**：377 个模块，有测试，接口清楚 |
| 短处 | 没重构过，可能有瑕疵；很多是单页演示 | **范围有限**：原版里很多能力没带过来，或只带了一部分接口 |
| 能不能改 | **不能改**。只读，是参考和对账的基准 | 可以改。新能力落在这里 |
| 谁在更新 | 另一个学习自动任务持续往里加文件 | 同上，也在变 |

还有**第三份**容易漏掉：`TigerMessenger/src/vendor/townscaper-rea-refactoring/`，是重构库在 2026-10-31 前后的旧副本。**游戏实际运行的是这份副本**，不是最新库。它和最新库有 344 个文件不同（例如 `badnorth/battle.js` 副本 821 行、最新 1533 行；副本里没有 `world/fine-portals.js`、`terrain/river-network.js`、`terrain/drainage.js`、`core/depression-fill.js`）。所以「库里已经实现」不等于「游戏里在用」。R33 起导航一小组（`world/battle-navigation.js`、`layerednav.js`、`navgraph.js`、`fine-portals.js`、`navmesh-flow.js`、`core/path-samples.js`、`core/arch-floor-budget.js`）已换成最新库逐字副本，其余照旧；换了什么记在 `tools/refactor/scene-consumer-notes.json` 的 `battle` 键。

### 3.1 综合看的规则

1. **找一个能力，两边都要查。** 先查重构库有没有；没有或不全，去原版找覆盖更广的实现；原版有瑕疵的地方，重构时修掉而不是照抄。
2. **用五个词描述一个能力的状态，不能混用：**
   - 只在原版：重构库没有落点。
   - 有落点、接口不全：重构库有对应模块，但原版的一部分导出没带过来。
   - 导出名对得上：**不代表行为等价**。
   - 可执行：已封装成能力代码，能拖进管线跑。
   - 已进游戏：实景里真的在用（要看 vendor 副本还是最新库）。
3. **嫁接 = 把原版的能力带进重构库再封装成可执行能力。** 能力树的「嫁接队列」（§4）告诉你下一个该嫁接哪个文件。
4. **嫁接前先查是不是已经嫁接了、只是换了名字。** 例：原版 `src/depfill.js` 在重构库是 `core/depression-fill.js`，原版 `src/edgesmooth.js` 是 `terrain/edge-square-relax.js`。嫁接队列按「没对上的导出名」算分，所以改过名的会一直留在队列前面。遇到这种情况要去补对账别名（`tools/refactor/reacode-target-aliases.json`），不是重写一遍。

### 3.2 嫁接一个原版文件的标准步骤

1. 读原版文件全文和它对应的帖子记录（`REACodeRefactoring/learn/data.js`），弄清它解决什么问题、可观察的行为是什么。
2. 在重构库里搜同名、近义名和相同算法；确认是「没有」「不全」还是「已有但改名」。
3. 把缺的行为写进重构库的模块，带单元测试。原版的瑕疵写在模块头注释里：修了什么、哪里和原版不同。
4. 封装成可执行能力（§7.2 的清单）。
5. 在真实场景里跑一次管线，同机位对照截图，实际看图。
6. 重算能力树（§5），确认这个文件从嫁接队列里降下去、对应能力线出现 ⚙。
7. 记 `WORKSHOP_LOG.md`：证据目录、没做到的部分、下一步。

---

## 4. 能力树

页面：`http://localhost:8931/TigerMessenger/pipeline.html?learningView=tree#learning`（学习工坊第一个页签；默认页签是「能力地图」）。

**结构**：7 枝 × 27 条能力线。

| 枝 | 能力线 id |
|---|---|
| 空间基座 | grid、wfc、sphere、tools |
| 地貌 | terrain、shore、sediment、water-effects |
| 构筑 | building、hallway |
| 光影与画面 | light、shadows、reflection、lines、palette、atlas、camera |
| 生命与天气 | plants、animals、wind、smoke、fire |
| 玩法 | navigation、combat、projectiles、campaign |
| 表达 | ui-decoration |

每条线左边是原版文件，右边是重构模块。

**四种构造方法**（借用的成熟做法，改规则时不要丢）：

1. 科技树的前置解锁：一条线的前置都能执行，它才进「解锁前沿」。
2. 成熟度阶梯：线级是学了 → 有代码 → 可执行 → 已进游戏；能力级是九级（§1.4 创新 4，R23），每级一份证据文件。
3. 作者时间线的 A → A+ 代际：按帖子发布时间排，后一代要比前一代好。
4. 两库逐文件对账：每个原版文件对应到重构库的落点和缺的接口。

**树给出三样可以直接行动的东西**：

- **嫁接队列**（现在 162 项）：下一个该从原版带进来的文件。公式在 `REACodeRefactoring/src/core/capability-tree.js` 的 `GRAFT_FORMULA`。
- **解锁前沿**（R37–R39 之前 4 条线：fire、hallway、sediment、projectiles）：代码已有、还不能执行的线。R37–R39 在表现层封装了 `fx.fire` / `fx.hallway` / `fx.sediment` / `fx.projectiles`，重算后应为空、27 / 27 条线带 ⚙（`tests/frontier-unlock.test.mjs` 断言，待 Kiro 跑）。
- **目标路径**：做一件事要串起哪些可执行能力。现在只有「圣城山形」一条有专用管线（学习页一键 → 系统工坊切到高山圣城并装好 6 个能力）。

**另一份队列：补学队列**（`src/scene-authoring/catalog/learn-queue.json`，现在 76 项 + 2 条适配）。它按帖子记录里「还差什么」排，嫁接队列按文件排，两个都要看。现在补学队首是：导航 A 的精细门户与侧壁碰撞、网格 A+5 的多格 prefab/socket、导航 A++ 的窄道会车、导航 A+++ 的穿洞与脚高插值、模块约束 A+9。

**代码位置**

| 东西 | 路径 |
|---|---|
| 树的计算 | `townscaper-web/REACodeRefactoring/src/core/capability-tree.js` |
| 谱系 / 队列的计算 | `townscaper-web/REACodeRefactoring/src/core/capability-lineage.js` |
| 九级成熟度的判定（R23） | `townscaper-web/REACodeRefactoring/src/core/capability-maturity.js`；生成 `TigerMessenger/tools/refactor/build-capability-maturity.mjs` → `catalog/capability-maturity.json` |
| 树的界面 | `townscaper-web/REACodeRefactoring/src/ui/capability-tree.js`、`.css` |
| 学习工坊宿主 | `TigerMessenger/src/scene-authoring/learning-workshop.js` |
| 重算入口 | `TigerMessenger/tools/refactor/build-capability-lineage.mjs`（`computeLineage`） |
| 生成的数据 | `TigerMessenger/src/scene-authoring/catalog/*.json` |
| 生成的文档 | `docs/CAPABILITY_LINEAGE.md`、`docs/REACODE_REFACTOR_STATUS.md` |

---

## 5. 每一轮都要做的：让能力树保持是活的

上游两个库随时在变。本文件写作期间原版就从 306 变成了 309 个文件，导致测试变红、队列过期。**每轮开工先做 5.1，收工前做 5.2。**

### 5.1 开工：检查漂移

在**仓库根** `/Users/panglaohu/Downloads/TigerInBamboo` 运行：

```sh
NODE=/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node
$NODE --test TigerMessenger/tests/reacode-file-status.test.mjs TigerMessenger/tests/capability-tree.test.mjs TigerMessenger/tests/capability-lineage.test.mjs TigerMessenger/tests/capability-evolution.test.mjs
```

`reacode-file-status` 失败并列出多出或少掉的文件名，就是上游漂移了，按 5.2 重算。
`capability-evolution` 失败说明某条帖子记录变了、对应批注失效：要按新记录**重新评审**那几条（`learn/pipeline.js` 的 `evolution.completionReviews`），不能只改证据字段让测试通过。

### 5.2 重算（顺序不能乱，注意每条命令的工作目录）

```sh
# ① 在仓库根
cd /Users/panglaohu/Downloads/TigerInBamboo
NODE_PATH_BIN=$NODE python3 TigerMessenger/tools/scene-authoring/build_reacode_file_status.py

# ②–⑦ 必须在 TigerMessenger 目录里
cd TigerMessenger
$NODE tools/refactor/build-system-catalog.mjs ../townscaper-web/REACode ../townscaper-web/REACodeRefactoring
$NODE tools/refactor/scan-code-library.mjs
$NODE tools/refactor/scan-scene-consumers.mjs
$NODE tools/refactor/build-capability-lineage.mjs
$NODE tools/refactor/export-learn-queue.mjs
$NODE tools/refactor/build-capability-maturity.mjs   # ⑦ 九级成熟度 + 统一计数表 → catalog/capability-maturity.json（R23）
```

**坑**：②③⑥ 把输出写到「当前目录/src/scene-authoring/catalog/」。在仓库根跑会在根目录生成一个多余的 `src/`，而真正的数据没更新。浏览器测试脚本同理，会把 `artifacts/` 写到当前目录。

### 5.3 有新能力时

新能力的 meta 里必须有 `id`、`name`、`domain`、`line`（27 条线之一）、`requires`、`modules`（它真实调用的库模块路径）。缺 `line` 或 `modules`，它在树上就归不了线。然后跑 5.2 的 ⑤⑥。

### 5.4 JEV：开发模型自己也必须用

用户原话：「JEV 这个能力，也是目前你这个模型需要使用的，要不你很快就没有 quota 了，你花费 token 很快的。」

**规矩：凡是「对一批东西逐个做同一种判断」的活，先交给 JEV，开发模型只复核低置信度的。** 不要自己逐个读文件、逐条读队列来分类。

适合交给 JEV 的：文件归到哪条能力线；队列条目属于哪一类；一批日志或报告里哪些需要人看；一批候选的文字指标哪个该先处理。
不能交给 JEV 的：看图（它看不了图）；审源码；写代码；硬性检查（碰撞、净空、连通）；最终验收。

**通用入口**（任何批量判断都用它）：

```sh
python3 TigerMessenger/tools/jev/ask.py request.json --output decisions.json
```

`request.json`：`task`（一句话任务）、`type`（`choice` 选类别，或 `noul` 是否）、`criteria`（类别 id → 判断标准）、`items`（项 id → 紧凑文字字段）、可选 `threshold`（默认 0.85）、`batch`（默认 6）。例子：`artifacts/pipeline/jev/learn-queue-visibility-request.json`。

- 缓存按**单项**算，清单增减不会让别的项重新付费。
- 单项超过 2000 字节会拒绝：先压缩成要点再发。不发密钥、图片、整份源码、聊天记录。
- 不自动重试。失败的批次记在 `usage.errors` 里。
- 每次把 `usage`（请求数、缓存命中、花费）如实写进日志。

**归线专用入口**（内部调用上面的通用入口）：

```sh
cd /Users/panglaohu/Downloads/TigerInBamboo
NODE_PATH_BIN=$NODE python3 TigerMessenger/tools/refactor/jev-classify-tree.py
```

置信度 ≥ 0.85 且不是 `none` 才自动归线。结果写 `catalog/capability-tree-jev.json`，跑完要重做 5.2 的 ⑤⑥。归线结果只用于分类，不能据此说某文件实现了某能力。

**2026-11-23 的实际记录**

| 用途 | 项数 | 请求 | 缓存命中 | 花费 |
|---|---|---|---|---|
| 归线（旧脚本，整批缓存） | 115 | 20 | 0 | 0.052 美元 |
| 归线（改成单项缓存后重跑） | 117 | 1 | 114 | 0.0015 美元 |
| 补学队列 76 项按「做完后用户看得见什么」分类 | 76 | 10 | 0 | 0.013 美元 |

旧脚本的缓存按整批内容算，清单多一个文件就全部错位重付。已改掉。

### 5.5 夜间重建：一条命令跑完 5.1 + 5.2 + JEV + 目标路径 + 测试（R40，创新 8 第一版）

```sh
cd /Users/panglaohu/Downloads/TigerInBamboo/TigerMessenger
$NODE tools/nightly/run-nightly.mjs            # 全量（要 python3；JEV 要网络和额度）
$NODE tools/nightly/run-nightly.mjs --no-jev   # 不跑 JEV 归线
# 其他开关：--skip-drift  --skip-recompute  --skip-tests  --date YYYY-MM-DD  --python <路径>
```

- 每步按上面的工作目录起子进程（① / JEV / 测试在仓库根，②–⑦ 在 TigerMessenger），顺序：5.1 → ①②③④ → JEV → ⑤ → 目标路径各跑一次 → ⑥ → ⑦ → 单元测试。JEV 放在 ⑤ 之前，所以 5.4 说的「跑完要重做 ⑤⑥」自然满足。
- 目标路径：表现层 / 战役 / 山形是纯数据，在 Node 里用合成场地跑一遍并独立验证；别的层要浏览器实景采样，记 NOT_RUN。检查项上的 `metric` 写进 `src/scene-authoring/catalog/verification-metrics.json`，⑥ 用它算「指标差距分」（创新 5，公式在 `tools/refactor/metric-gap.mjs`）。
- 输出：`artifacts/nightly/<日期>/`（`snapshot.json`、`morning-report.md` 一页晨报：新增能力 / 哪条线升级 / 哪个场景候选变好变差 / 测试红绿，`morning-report.json`，`logs/`），以及 `artifacts/nightly/latest.json`（管线页顶部「夜间晨报」面板读它，没有就显示一行提示）。和「比今天早的最近一份 snapshot.json」比。
- 有测试红或步骤失败时退出码为 1。不写用户存档、不设默认；浏览器端到端不在夜间跑。

---

## 6. 现在的真实状态（2026-11-23 页面审计）

审计脚本 `tests/visible-audit-browser.mjs`，证据 `artifacts/visible-audit/run-1795435941396/`。

### 6.1 已经有的

| 项 | 状态 |
|---|---|
| 能力树页面 | 有，7 枝 27 线，可点 |
| 可执行能力 | **对外只用一个数：去重后的可执行能力数** = `catalog/capability-maturity.json` 的 `counts` 里 `unique`（R23 起由 §5.2 ⑦ 生成；本轮 Quick 跑不了脚本，具体数待 Kiro 跑完回填到这里）。其他数的口径见下面「可执行计数口径」表 |
| 能执行的能力线 | 23 / 27 |
| 管线层 | 球系统、场景、物件、通用场景、战役、山形、表现层 |
| 跑通过的完整流程 | ① 圣城山形（6 个能力，实景预览）② 十二门徒战役 ③ 十二门徒表现层（实景线层叠加） |
| 经验与需求回流 | 执行记录带能力线，写 `tm.capability.experience.v2`；各层管线里放了但不能执行的节点进补学队列 |
| 测试 | 统一入口单元组 122 / 122 通过（`--skip-browser`，浏览器套件这次没跑） |

### 6.2 用户说「没看到任何新增功能」——他说得对，原因如下

1. **没有入口。** 顶部只有「球系统管线 / 场景管线 / 物件管线」三个页签。战役、山形、表现层都塞在「场景管线」页的最下面。
2. **面板很小且是空的。** 选十二门徒时，战役和表现层面板各只有 176 像素高，管线里 0 个节点，要自己去左栏找到能力再双击才会出现内容。
3. **山形面板只在高山圣城出现**，别的场景看不到。
4. **全部是候选，没有一个被采用为默认。** 山形、十二门徒软坡、十二门徒配色、REA 地形都要加网址参数或手动执行才出现，正常进游戏什么都没变。
5. **数字对不上。** 左栏写「可执行 39」，谱系算出 55，能力树摘要写 64，能力树页面顶栏写 105。R23 已查清四个数的口径（下表），对外统一用去重数。

   **可执行计数口径**（定义在 `capability-maturity.js` 的 `COUNT_DEFINITIONS`，数值由 ⑦ 复算写进 json）

   | 数 | 在哪看到 | 数的是什么 | 代码位置 |
   |---|---|---|---|
   | 39 | 系统工坊左栏「可执行 N」 | 当前工坊（默认场景层）能拖进管线的 ⚙ 能力，按 ID 去重；不含球系统、物件层 | `capability-sidebar.js` `renderLineage()` 的 `items.size` |
   | 55 | 能力谱系 `loop.executables` | `computeLineage` 登记的条目（重构库注册表 + 六个工坊层），不含场景管线 editor / live 节点，不去重 | `build-capability-lineage.mjs` → `capability-lineage.js` `execRows.length` |
   | 64 | 能力树摘要（脚本口径） | 27 条线各自的可执行数求和，一个能力归几条线算几次 | `core/capability-tree.js` `summary.executables` |
   | 105 | 能力树页面顶栏（R23 前） | 同上按线求和，但输入是页面 `getExecutables()`，多了场景管线节点，归线更多、重复更多 | `studio.js` `getExecutables` → `ui/capability-tree.js` |
   | **去重数** | 能力树顶栏「可执行（去重）」、左栏「全系统去重」 | 所有来源按能力 ID 合并，每个只数一次（唯一对外数字） | `build-capability-maturity.mjs`（`rows.length`）、`summary.executablesUnique` |
6. **最近十几轮主要在做看不见的东西**：经验存储、队列导出、能力线标注、数据重算。这些是必要的，但不是用户要的「新增功能」。

### 6.3 候选清单（都没有采用）

| 候选 | 怎么看 | 差什么才能采用 |
|---|---|---|
| 圣城连绵圆润山形（`mountain.rolling` 等 6 个能力） | 学习页能力树 → 目标「圣城山形」一键；或场景选高山圣城后执行山形管线 | 玩家碰撞还是原山面；峰高从 77 m 降到 67 m；竖崖 14%（阈值 12%）；只看过一个机位 |
| 十二门徒软坡 | 网址加 `?apostlesLook=soft` | 只看过 2 个机位；植被没跟着新地形检查 |
| 十二门徒库地形色 | `?apostlesLook=palette`，可写 `soft,palette` | 用户还没选 |
| REA 层化地形（圣城） | 桥接命令 `terrain.rea.preview` | 没有面板；视觉偏棋盘，不建议采用 |
| 表现层实景线层 | 十二门徒 → 表现层管线执行 | 只是线框；镜头路径没有驱动镜头 |

十二门徒的完整诊断和五步顺序在 `docs/APOSTLES_TERRAIN_DIAGNOSIS.md`。第 1–4 步的代码已落地，第 5 步（换掉 vendor 旧副本）没做。

**游玩全屏**：系统工坊「游玩检验」按钮点下后，实景画面进入全屏，Esc 退出（`src/scene-authoring/studio.js`）。游戏首页的「开始送信」按钮没有改。

---

## 7. 管线怎么工作

### 7.1 一次执行的流程

扫描真实场景 → 改造 Worker 计算候选 → **另一个** 验证 Worker 独立重算检查 → 实景预览 → 对照原样 → 采用或放弃 → 记经验。

验证必须独立：不能直接相信改造 Worker 的输出。

| 层 | 目录 | 作用对象 |
|---|---|---|
| 球系统 | `src/system-workshop/planet/` | 星球配方、海面、天气 |
| 场景（体素） | `src/scene-authoring/agent/` | 莫西斯湖的体素世界 |
| 通用场景 | `src/system-workshop/gscene/` | 其他场景的材质配色 |
| 物件 | `src/system-workshop/object/` | 物件位置朝向 |
| 战役 | `src/system-workshop/battle/` + `src/world/rea/sceneBattle.js` | Bad North 玩法层 |
| 山形 | `src/system-workshop/mountain/` + `src/world/rea/mountainCandidate.js` | 高山圣城地形 |
| 表现层 | `src/system-workshop/fx/` + `src/world/rea/fxOverlay.js`、`fxLive.js` | 战役分区、镜头（R40 真实驱动镜头飞一圈）、尾迹、装饰、回放；R37–R39 火（life/effects.js）、走廊样板（build/doodle-hallway.js）、崖面层带、箭雨弹道 |

共用部件：`src/system-workshop/tier-workshop.js`（界面与 agent 宿主 `mountTierWorkshop`）、`tier-agent.js`、`src/pipeline-engine/worker-adapters.js`、`src/scene-authoring/pipeline-bridge.js`（工坊页给游戏 iframe 发的命令都在这里登记）、`src/scene-authoring/studio.js`（把各层挂到页面上）。

本机存储键：`tm.<层>.pipeline.v2`（管线草稿）、`tm.capability.experience.v2`（经验）、`tm.mountain.adopted.v1`、`tm.battle.adopted.v1:<场景>`、`tm.fx.plan.v1:<场景>`、`tm.apostles.look.v1`、`tm.planet.final.v1`。

### 7.2 新增一个可执行能力的清单

1. `src/system-workshop/<层>/capabilities.js`：登记 meta（§5.3 的字段）、`match`、`run`。`run` 里**真实 import 并调用**重构库模块，不写空壳。
2. `<层>/verify.js`：加独立检查，至少一条会在结果被破坏时判失败。
3. `tests/<层>-pipeline.test.mjs`：正常通过、确定性、破坏判失败三类用例。
4. 需要改实景的：在 `src/world/rea/` 写预览 / 对照 / 回退 / 采用四个函数，在 `pipeline-bridge.js` 登记命令。
5. 新的一层还要：`worker-adapters.js` 注册、`studio.js` 挂载、`build-capability-lineage.mjs` 的 `computeLineage` 里把这一层的能力加进去（漏了这步，树上就没有它）。
6. 新测试文件名加进 `tools/scene-authoring/test_workshops.py` 的单元清单。
7. 浏览器端到端脚本：`tests/<层>-<场景>-browser.mjs`，要断言实景状态并截图，然后**实际打开截图看**。
8. §5.2 的 ⑤⑥，记日志。

---

## 8. 调研结论：后面应该关注哪些功能

依据有五样：页面审计（§6.2）、补学队列、嫁接队列、场景对 vendor 副本的依赖扫描（`catalog/scene-consumers.json`）、业界做法（§1.3）。

**补学队列里有多少是用户看得见的功能**（JEV 分类，`artifacts/pipeline/jev/learn-queue-visibility.json`，76 项里 39 项置信度 ≥ 0.85，其余是低置信度的倾向）：做完后改变游戏画面的 45 项，改变游玩行为的 17 项，新增编辑动作的 8 项，纯内部的只有 6 项。也就是说**队列本身九成是看得见的功能**，问题不在选题，在于做到「可执行」就停了、没有推到实景和页面上。队首 4 项里 3 项是看得见的导航行为（置信度 0.98–1.0）。

| 关注点 | 依据 | 为什么排这个位置 |
|---|---|---|
| **1. 让已有的 55 个能力在页面上看得见、一键能跑** | 审计：面板 176 像素、0 节点、无入口 | 用户最新的不满就在这里。不需要新算法，回报最快 |
| **2. 把候选做到能采用** | 5 个候选 0 个采用 | 「跑通」的终点是用户进游戏就看到变化 |
| **3. 高山圣城山形** | 用户点名交办；还差碰撞、峰高、多机位 | 第一条必须交付的游戏管线 |
| **4. 导航** | 补学队列前 5 名里占 4 个；嫁接队列里 `cheesenav`、`holenav`、`cavepath`、`rayvis` 等并列最高分 | 玩法枝最深的缺口。`world/fine-portals.js` 已经写好但游戏没用上 |
| **5. 剩下 4 条线封装** | 解锁前沿：fire、hallway、sediment、projectiles | 做完就是 27 / 27 全线可执行 |
| **6. 多格模块与联合 WFC** | 补学 #2、#6；网格线被多条线依赖 | 构筑枝要长大必须先过这关 |
| **7. 游戏换用最新库** | vendor 副本 344 个文件落后；十二门徒 18 个模块里 17 个不同 | 不换，库里学到的新能力进不了游戏。风险高，必须逐模块换、逐次同机位对照 |
| **8. 光照与大纹理** | 嫁接队列：`lighting.js`、`megatex.js`、`town.js` | 画面质量的主要来源，但依赖前面的地形和建筑稳定 |
| **9. 自主学习闭环自己转** | 现在重算、JEV、队列导出都要人手动跑；业界对照是 Far Cry 5 的夜间无人值守重建和 Voyager 的自动课程 | 「自主」目前名不副实 |
| **10. 让「好」有据可查** | 现在每个候选只看一个种子、一两个机位；业界对照是表达范围分析 | 对应创新 3、6。没有它，A+ 比 A 好只是一句话 |

---

## 9. 后 20 轮（R21–R40）要做到的功能

每轮结束时，用户在页面上应该能看到一样新东西。每 4 轮一组。

**A 组 R21–R24：让能力看得见**
- R21 系统工坊页签增加「战役」「山形」「表现层」直达入口，或把这三块提到场景页上方；面板默认展开到能看清的高度。
- R22 每个场景打开时，自动把「这个场景能跑的能力」预装进管线（不再是 0 节点）；一个「一键执行」按钮跑完整条。（创新 2 的第一步）
- R23 **九级成熟度**（创新 4）：每个能力由脚本按证据文件判定到了第几级，能力树和左栏都按级显示。「可执行 39 / 55 / 64」三个数由此统一成一张分级表。
- R24 管线页加「最近新增」栏：列出最近加入的能力、所属能力线、哪天加的、在哪个场景能跑。数据从能力 meta 和经验记录来。
- 验收：新开浏览器进 `pipeline.html#scene`，不查文档，三次点击内能跑起任一条新管线；截图留档。

**B 组 R25–R28：高山圣城山形做到可采用**
- R25 采用山形后重建玩家地面碰撞，玩家能在新山上走；轨道净空和建筑高差复检仍为 0。
- R26 多机位验收（至少 4 个：正面、侧面、俯视、玩家视角），逐张看图，修破面和穿帮。同时给地形线建**第一个擂台**（创新 3）：固定种子测试岛 + 中等坡占比、竖崖占比、排水率、硬边位移，`mountain.rolling` 这一代必须在数上赢过上一代。
- R27 配色：Bad North 夏季与 Townscaper 两套并排对照，交用户选。草坡面积要够、不偏灰。
- R28 采用后进游戏自动换上新山形；保留一键回到原山形。山形管线加**多种子分布报告**（创新 6）：30 个种子各跑一次，页面上给出指标分布和最好、最差、最典型三张图。
- 验收：不带任何网址参数进游戏，高山圣城是新山形，玩家能走，对照图用户看过。**「设为默认」这一步要用户点头。**
- 峰高问题：可改陆地只有约 1.3 万平方米，加高只会更陡。要更高必须放宽可改范围（向海里或建筑背后多占），这个要问用户。

**C 组 R29–R32：十二门徒地形收尾**
- R29 `soft` 与 `soft,palette` 各拍 4 个有效机位，含崖脚特写，确认没有半透明破面。修掉「场景重建间隙读不到状态」的检测竞态（等 `userData.apostleMass` 的网格稳定出现再读）。
- R30 植被、岸线白沫跟随新地形复检。
- R31 把这两个开关做成工坊里的可执行能力（地形线），不再只是网址参数。
- R32 三套方案并排对照页，交用户决定采用哪套。

**D 组 R33–R36：导航进游戏**
- R33 把最新库的 `world/battle-navigation.js`、`world/fine-portals.js` 及其依赖换进 vendor 副本（只换这一小组），战役行为回归测试。做**原版当裁判**的第一例（创新 1）：同一座岛喂给原版 `cheesenav` / `holenav` 和重构版 `layerednav`，比较连通块数、最大块占比、被覆盖节点数，差异登记为缺口。
- R34 开 `finePortals`：单位从拱洞里穿过而不是穿墙；演示页与实景各验一次。
- R35 窄道会车：弯道、岔口、不同体型重新选路（补学 #3）。
- R36 穿洞与脚高插值（补学 #4）；战役层新增 2–3 个导航类可执行能力，树上导航线 ⚙ 增加。

**E 组 R37–R40：全线可执行**
- R37 火焰（`life/effects.js`）封装为可执行能力，实景里能点着。
- R38 建筑纹理走廊（`build/doodle-hallway.js` 等）封装。
- R39 沉积、抛射物两条线封装。
- R40 `fx.camera` 的路径真实驱动镜头飞一圈。**夜间重建第一版**（创新 8）：一条命令跑完漂移检查、重算、JEV 归线、每条目标路径各一次，产出一页晨报。验证指标离阈值的差距接进补学队列得分（创新 5）。全量重算、统一测试、更新本文件的数字和 §6。
- 验收：能力树 27 / 27 条线带 ⚙，解锁前沿为空。

---

## 10. 再后 50 轮（R41–R90）要做到的功能

方向性安排。每 10 轮开头按当时的补学队列和嫁接队列重排，下面的顺序不是死的。

**R41–R50 地貌枝长全**（每嫁接一条线，同时配上原版对照和擂台，即创新 1、3 成为制度）：嫁接 `overhangterrain.js`（悬垂）、`islandpasses.js`（岛屿通道）、河流网络与排水；地形管线能生成「软坡 + 硬崖 + 悬垂 + 河谷」的完整山体；原薄台与攀爬（补学 #7）。做到：圣城之外再有一个场景（苔庭或旧港湾）用地形管线重做地形。

**R51–R60 构筑枝**（同时统一能力契约格式，给一个目标系统能自己拼出管线，即创新 2 完成）：多格 prefab / socket、联合 WFC（补学 #2、#6、#9）；建筑管线进高山圣城和水晶城——在山形上按规则摆建筑群，可整体放置、替换、撤回。做到：「地形 → 建筑」两段管线在一个场景里连起来跑。

**R61–R70 光影与生命**（多种子分布报告推广到所有管线，即创新 6 完成）：嫁接 `lighting.js`、`megatex.js`、`town.js`（体素遮蔽、彩色反弹、大纹理）；植物图集全场景共用；动物、风、烟接进场景管线。做到：同一场景「之前 / 之后」同机位对照，画面质量有明确提升并被用户认可。

**R71–R80 游戏换用最新库**：按场景逐模块把 vendor 副本换成最新库，每换一个做一次同机位对照，结论写进 `tools/refactor/scene-consumer-notes.json`。做到：十二门徒与高山圣城对最新库的落后模块数降到 0 或有书面的保留理由。教训：最新库不一定更好看，对照后变差的不换。

**R81–R90 自主学习闭环真正自动**：
- 夜间重建变成定时任务（创新 8 完成）：自己做 §5 的漂移检查、重算、JEV 归线、跑全部目标路径、出晨报，不用人提醒。
- 用户的每一次「放弃」和验证指标的差距自动改变补学顺序（创新 5 完成）。
- 验证失败的经验自动抬高对应缺口在队列里的位置（规则已有，要在真实运行里验证）。
- 经验和队列可导出到另一台机器复算。
- 新增目标路径：从「圣城山形」一条扩到每个场景至少一条，学习页一键进系统工坊。
- 做到：给一个新场景，系统能自己列出可用能力、装好管线、跑出候选、给出验证结果，人只做最后的采用决定。这就是 §1 的目的。

---

## 11. 每轮的规矩

1. 开工：读本文件 §6、`WORKSHOP_LOG.md` 最后三段，做 §5.1。
2. 一轮只做一件能验收的事。先写会失败的测试，再实现。
3. 收工必须有：单元测试结果、真实浏览器端到端结果、**你自己打开看过的截图**、`WORKSHOP_LOG.md` 一段（做了什么、证据目录、没做到的、下一步）。
4. 新能力落地当轮就进树（§5.3）。
5. 用户在页面上看不见的工作，不能连续超过两轮。
6. 数字、状态变了，回来改本文件 §6 和文首日期。

**不许做的事**

- 不改 `townscaper-web/REACode`。
- 不把候选悄悄设成默认；不改用户的存档和湖上建筑。浏览器测试一律用全新的隔离上下文。
- 不把「导出名对得上」说成行为等价，不把「页面能打开」说成功能通过，不把 JEV 归线说成源码审阅。
- 不把线框预览说成最终效果，不把二维图说成三维模型。
- 没执行的测试写 NOT_RUN，依赖缺失写 BLOCKED，不写通过。
- 不为了让测试变绿而放宽断言或只改证据字段。

---

## 12. 验证命令

```sh
cd /Users/panglaohu/Downloads/TigerInBamboo          # 测试都从仓库根跑
NODE=/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin/node

# 全部单元（约 2 秒），结果在 TigerMessenger/artifacts/workshop-tests/<时间戳>/
python3 TigerMessenger/tools/scene-authoring/test_workshops.py --skip-browser
# 全量（含浏览器套件）
python3 TigerMessenger/tools/scene-authoring/test_workshops.py

# 端到端（需要 8931 服务在跑；这几个要 cd TigerMessenger 再跑，证据才落在 TigerMessenger/artifacts/）
cd TigerMessenger
$NODE tests/mountain-citadel-browser.mjs      # 圣城山形；环境变量 ZOOM、VIEWS、COMMIT=0|1
$NODE tests/battle-apostles-browser.mjs       # 十二门徒战役
$NODE tests/fx-apostles-browser.mjs           # 表现层 + 实景线层
$NODE tests/apostles-look-browser.mjs soft    # 十二门徒候选：approved / latest / soft / palette
$NODE tests/visible-audit-browser.mjs         # 页面上实际看得见什么
```

机器上没有 `node`、`rg` 在 PATH 里：用上面的 `$NODE`，搜索用 `grep`。
Playwright 在 `/Users/panglaohu/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright`，浏览器用系统 Chrome。

## 13. 已知的坑

- **工作目录**：见 §5.2 和 §12。跑错目录不会报错，只会把文件写到错的地方。
- **浏览器缓存**：`pipeline.html` 里脚本带 `?v=` 版本号。改了 `studio.js` 或 Worker 文件后要把对应的版本号加一，否则用户的浏览器还在用旧文件，看不到改动。
- **场景 id**：高山圣城是 `citadel`，不是 `highland-citadel`（后者只是星球地图上的锚点名）。
- **实景状态读取竞态**：十二门徒重建场景时 `morrisViewer.scene` 会被换掉，这时读网格数会得到 0。以截图为准，并按 R29 修检测。
- **相机**：端到端脚本用滚轮缩放，缩过头会钻进山体里，截图一片糊。每张图都要看。
- **嫁接队列里改过名的文件**：见 §3.1 第 4 条。
- **JEV**：批量判断一律走 `tools/jev/ask.py`（单项缓存）。不要再写按整批内容算缓存的脚本。

## 14. 相关文件

`docs/WORKSHOP_GUIDE.md`（双工坊周期测试与保护规则）、`docs/WORKSHOP_TEST.md`（测试矩阵）、`docs/WORKSHOP_LOG.md`（逐轮证据）、`docs/WORKSHOP_LOOP_PLAN.md`（闭环的设计与计算规则）、`docs/CAPABILITY_LINEAGE.md`（每条线的明细，生成文件）、`docs/REACODE_REFACTOR_STATUS.md`（原版逐文件状态，生成文件）、`docs/APOSTLES_TERRAIN_DIAGNOSIS.md`（十二门徒诊断）、`docs/JEV_PIPELINE.md`、`../AGENTS.md`。
