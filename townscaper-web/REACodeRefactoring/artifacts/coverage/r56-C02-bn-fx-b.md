# 第 56 批 · C02 组：Bad North 特效 B + 生命 / 导航 / 水（16 条）

端口 8802；截图在 `artifacts/coverage/shots-r56/<id>-*.png`，全部用 Read 打开看过并与联系表 / 原尺寸帧对照；控制台零 error（只有 three 的 `toNonIndexed` 警告，基线页同样有）。

## 结论

- done 15 条，partial 1 条（880853661936734211：弯心短暂贴身、拥挤 / 体型重路由未做）。
- 多条旧 note 已过时（第 55 批已补）：906207 雾软片 + 风场平流、816748 导航面接 Battle / 通口前视 / World 自动生成、906425 / 797119 精细门户、959530 物种几何、901469 环境船 Kelvin 泡沫、820977 坡面软影 —— 本轮核实后补可视化 / 战斗接入并截图验收。

## 改动边界

- **新文件**：`src/badnorth/battle-c02.js`（12 个开关，全部默认关）、`src/badnorth/island-caves.js`（洞穴岛变体，默认关）、`tests/c02-bn-fx-b.mjs`、`tests/c02-traffic-curves.mjs`、16 份 `artifacts/coverage/<id>-r56.md`、本报告。
- **battle.js（热点）只加 6 行挂钩**：import、构造 `this.c02 = new BattleC02(this)`、`start()` / `stop()` 各一行、`#hit` 末尾 `this.c02.onHit(v, by)`、`c01.afterDraw` 之后 `this.c02.afterDraw(dt)`。每次编辑前重读；与 C01 / C03 的挂钩并存。
- **island.js**：1 行 import + 签名加可选 `{ caves = cavesFromUrl() }` + 1 行挂钩；node 里 / 无 URL 参数时 caves=0，旧行为不变（battle 全部旧测试通过）。
- **damage-numbers.js**：只新增 `kickDamageNumber` / `stepDamageKick` 两个导出，旧 add/step 不变。
- **traffic.js**：试加 `after` 参数后实测无改善，已逐字撤回，文件与开工前一致。
- 没碰 view.js / worldmesh.js / app.js / index.html；没写 learn/*、CHANGELOG、PIPELINE、MODULE-REFACTOR-STATUS、GAP-PRIORITIES；没跑 record-review；没 git。
- 开关：URL `?c02=bloodShape,scorch,dmgKick,flowGrid,flowFaces,tumble,wakes,navmesh,rain,swingArc,footprint,passageWorld`（或 `c02=all`），运行时 `rea.battle.c02.set(name, on)`；洞穴岛 `?bncaves=1..6`。
- 废片：`shots-r56/870296307889573889-tumble-450.png` / `-1300.png` 是一次超时调用留下的半成品，未引用（按红线不删）。

## 测试

- `node tests/c02-bn-fx-b.mjs` PASS：血斑边界变异系数 0.41 + 卫星斑边长边外移；焦痕 4 片 + 余烬；飘字沿受击方向 +0.147、击杀上浮 0.18 > 伤害 0.11；底网段数 = Σ(陆地格边 + 四边形对角线)（quad 2065 / mixed 1197）、格面数 = 被覆盖节点数（406 / 312）、图例 3 行、格面色属兵种三色；翻滚最大倾角 177°、落地扬尘、0.7 s 爬起；长船泡沫 131 / 喷溅 10、86% 舷侧泡沫在船后、旧尾迹隐藏；导航面一节点一面；雨 1600 丝 / 溅点 / 4 团云 / 斜向；挥砍弧出现并 0.22 s 消失；三队轮廓；点线世界尺寸可恢复；洞穴岛 quad 3 洞 6/6 格叠层、mixed 3 洞 8/8 格叠层、洞底连到洞外、900 帧战斗无 NaN；默认全关时什么都不画、血材质不变。
- `node tests/c02-traffic-curves.mjs` PASS：L / Z / T 三种走廊 × 30/60/120 Hz 全部到达、无人出走廊；迎面最小间距 .012–.041（记录，见 880853 剩余）。
- 全量：`tests/*.mjs` 280 个，分批（-P 4、单个 95 s 超时）跑完 **0 FAIL**。

## 逐条

| id | 原文要点 | 片子机制 | 原缺 | 本轮做了什么 | 判定 | 落点 | 测试 | 截图 |
|---|---|---|---|---|---|---|---|---|
| 912691357440978945 | 战斗合集：近战、血从台面抹到崖壁、崖脚积血、小屋着火（两次火光） | 近战流血；血泊形状不规则、会往外渗开、相邻连片；崖壁竖向流挂；小屋失守起火后留焦黑 | 烧焦痕；血泊不规则扩散（原来是圆片 + 等比放大） | battle-c02 `bloodShape`：血斑改用程序化分瓣 + 卫星滴 alpha 贴图（边界半径变异系数 0.41），每摊新地面血泊旁错开起始放 2–3 片卫星斑，边长边沿随机方向外移（渗开前沿是一瓣瓣鼓出去的）；总池 600 里给主血斑留 160 额度。`scorch`：小屋 lost 后在屋基 + 同高邻格铺不规则焦黑斑（同一套分瓣贴图），并持续冒余烬火星（加色点，随风偏、闪烁熄灭）。 | done | src/badnorth/battle-c02.js（bloodShape / scorch）· index.html?scene=badnorth&c02=bloodShape,scorch | tests/c02-bn-fx-b.mjs | shots-r56/912691357440978945-blood-scorch.png、shots-r56/912691357440978945-blood-scorch-zoom.png |
| 906425294533394432 | 紫色厚岩岛被掏出多个拱洞，单位在洞底和洞顶两层同时活动、穿洞 | 同一格上下两层可走面；穿洞寻路；精细门户 / 侧壁 | 旧 note：精细门户 / 形变侧壁 / 脚高插值（第 55 批 G3 fine-portals、G5 footHeight 已补）；北境岛本身没有洞，Battle 里看不到 | 新增 `src/badnorth/island-caves.js` 洞穴岛变体（`?bncaves=N`，默认关）：从紧挨低地（f=1/2）的厚台崖脚往里挖 f+1、f+2 两层，优先走向另一侧也有低地的格（穿山拱），台不够厚时补 1 层岩做洞顶。共享 BattleNavigation 自动在洞格生成「洞底 + 洞顶」两层节点（quad 6/6、mixed 8/8 格叠层，3/3 条穿山），洞底与洞外连通；真实 Battle 900 帧无 NaN。 | done | src/badnorth/island-caves.js · src/badnorth/island.js（1 行挂钩）· src/world/fine-portals.js · navigation.html · index.html?scene=badnorth&bncaves=3 | tests/c02-bn-fx-b.mjs、tests/fine-portals.mjs | shots-r56/906416813810049025-caves.png、shots-r56/797119718477991936-navigation-fine.png |
| 906416813810049025 | 新洞穴 tileset：厚岩拱洞 + 多层战斗 + 长船登陆 | 洞穴关卡：岩体里有洞、洞顶可站，战斗在多层进行 | 旧 note 只学习、未实现洞穴关卡 | 同 906425：北境 `?bncaves=N` 洞穴岛变体，挖洞写进共享 World，网格 / 导航 / 战斗走原管线；洞顶不够厚补 1 层岩（岩包鼓起）。 | done | src/badnorth/island-caves.js · src/badnorth/island.js · index.html?scene=badnorth&bncaves=3 | tests/c02-bn-fx-b.mjs | shots-r56/906416813810049025-caves.png |
| 906207980802252801 | 「For background effects, subtlety is key」：岛周近水面低对比雾斑缓慢漂移 | 背景雾：柔边软片、随风漂、绕开岩体、低对比 | 旧 note：原 FogLayer 软片 / 风场平流 / 遮挡（已过时：atmosphere.js 已有 makeFogWisps 软片 + 共享风场平流 + 体素绕行，tests/wind-flow.mjs 覆盖） | 本轮未改码，核实现状并做 GPU 验收：雾开 / 关对照 + 差分。 | done | src/life/atmosphere.js（fogSheets / makeFogWisps）· src/core/fog-envelope.js · index.html（风与天气 → 岛周薄雾） | tests/wind-flow.mjs | shots-r56/906207980802252801-fog.png、shots-r56/906207980802252801-fog-off.png、shots-r56/906207980802252801-fog-diff.png |
| 903647529203634176 | 长矛近战；挨打单位头顶跳 +4，击杀金色 +10 | 伤害飘字：只给掉血的单位、不同单位不合并、被打出去的方向感；击杀 +10 上浮更快 | 按受击方向抖动；+10 独立上浮速度 | damage-numbers.js 新增 `kickDamageNumber`（沿攻击者→受击者方向初速 0.9、指数衰减 + 阻尼正弦抖动）与 `stepDamageKick`（击杀额外上浮 0.35/s）；battle-c02 `dmgKick` 在 #hit 末尾给本帧新飘字加 kick，并把抖动直接叠到同帧精灵上（不慢一帧）。旧 add/step 口径不变。 | done | src/badnorth/damage-numbers.js · src/badnorth/battle-c02.js（dmgKick）· index.html?scene=badnorth&c02=dmgKick | tests/c02-bn-fx-b.mjs、tests/damage-numbers.mjs、tests/damage-numbers-kind.mjs | shots-r56/903647529203634176-kick-1.png、shots-r56/903647529203634176-kick-0.png |
| 902069261304287232 | 暗底俯视：四边形网格线（细灰线 + 对角线）上叠三棵按队伍着色的继承树 | 流场每格连父格，颜色 = 继承自哪支队伍；底下铺网格线框 | 底下的四边形网格线框 | battle-c02 `flowGrid`：flowDebug 打开时为每个陆地格画轮廓线，四边形格加对角线（灰、半透明、不挡树线），世界版本变才重建。 | done | src/badnorth/battle-c02.js（flowGrid）· battle.js #drawFlow · index.html?scene=badnorth&c02=flowGrid（面板开 flow） | tests/c02-bn-fx-b.mjs | shots-r56/902069261304287232-tree-grid.png |
| 901842167508992000 | 影响场每格携带最近单位兵种：格面 + 刻线按兵种三色成团 | 按兵种着色的影响区（格面 + 方向须）+ 兵种可读 | 格面着色与色卡图例；不可走格不上色 | battle-c02 `flowFaces`：每个被源覆盖的可走节点画一块圆角格面（向格心收 14% + 切角），颜色与 #drawFlow 同一套兵种 / 队伍色、按距离淡出；未覆盖 / 不可走不画；右下角 HTML 色卡（兵种模式 3 行，队伍模式按队伍）。 | done | src/badnorth/battle-c02.js（flowFaces）· index.html?scene=badnorth&c02=flowGrid,flowFaces（面板开 flow + flowunit） | tests/c02-bn-fx-b.mjs | shots-r56/901842167508992000-type-faces.png |
| 880853661936734211 | 窄道会车卡死 → 左行解决 | 窄道两向分道左行、不卡死 | 弯道、多岔、复杂拥挤 / 体型重路由 | 新测试 tests/c02-traffic-curves.mjs：L 弯、Z 双弯、T 三向岔口，两 / 三队迎面对穿，共享 leftLaneTarget + localSeparation，30/60/120Hz 全部到达、无人出走廊。试做「拐角取进出两段左侧之和」的 after 参数，实测迎面最小间距无改善，已撤回（traffic.js 未改）。 剩余：弯心两条左行车道仍会短暂贴身（迎面最小间距 .012–.041 < 半径和 .11，靠软分离挤过）；拥挤 / 体型重路由未做 | partial | src/world/traffic.js（未改）· tests/c02-traffic-curves.mjs | tests/c02-traffic-curves.mjs、tests/traffic.mjs | — |
| 870296307889573889 | 被顶出沿口 → 贴崖下坠 → 逐级滚落 → 落地倒地留血 | 击退落崖 + 坠落姿态 + 落地反馈 | 翻滚姿态与落地扬尘（以及存活者爬起） | battle-c02 `tumble`：下落中按速度绕「垂直于下落水平方向」的水平轴翻滚（枢轴身体中段），落地瞬间扬尘 9 团（落水改白水花），存活者 0.7 s 内从躺倒 smoothstep 爬起；实例矩阵在 #draw 之后、LOD 之前改写，不碰 battle 落崖逻辑。 | done | src/badnorth/battle-c02.js（tumble / #puffs / tumbleMatrix）· index.html?scene=badnorth&c02=tumble | tests/c02-bn-fx-b.mjs | shots-r56/870296307889573889-tumble-a.png、shots-r56/870296307889573889-tumble-b.png |
| 797119718477991936 | WFC 生成的城堡模块上，白点单位沿多层平台、穿拱门导航 | 在生成的多层模块上做多层导航（门户 / 层间连接） | 旧 note：预制模块精细内部 portal 与战斗接入（第 55 批 fine-portals + Battle 接入已补） | 本轮核实：navigation.html 精细门户实走穿洞到达；Battle 侧补洞穴岛（见 906425）让多层导航在真实战斗里可见。 | done | src/world/layerednav.js · src/world/battle-navigation.js · src/world/fine-portals.js · navigation.html · src/badnorth/island-caves.js | tests/fine-portals.mjs、tests/c02-bn-fx-b.mjs | shots-r56/797119718477991936-navigation-fine.png、shots-r56/906416813810049025-caves.png |
| 886199305522085890 | 窄通道上白色点线，被建筑挡住整段淡出 | 窄道点线 + 遮挡淡出 + 点距:点径≈2:1 | 通用调试层（只挂 badnorth）；近景点距略疏 | battle-c02 `passageWorld`：点改世界尺寸（点径 0.14 = 点距 0.28 的一半，任何距离 1:2 成立），远景按 4 px 下限钳住；关掉逐值恢复。通用调试层不属于本片（片中只有北境岛），未做。 | done | src/badnorth/battle-c02.js（passageWorld）· src/world/traffic.js · battle.js refreshPassages · index.html?scene=badnorth&c02=passageWorld | tests/c02-bn-fx-b.mjs、tests/traffic.mjs、tests/traffic-sight.mjs | shots-r56/886199305522085890-near-compare.png、shots-r56/886199305522085890-mid-1.png |
| 820977247083528192 | 动画参考请求；片中一个持剑盾单位：待机举剑、挥砍时一道白色月牙拖影、脚下软影圆盘 | 挥砍月牙拖影 + 软影 | 旧 note：原动画 / 坡面 / 参数（坡面已由 G3 shadowFit 补） | battle-c02 `swingArc`：直砍（非矛非弓）在竖直面里画一道从头后上方劈到身前下方的月牙（尾透明、刀位实，加色白），0.26 s 消失；G3 扫掠中则按 a0→当前角铺水平扇带。 | done | src/badnorth/battle-c02.js（swingArc）· src/core/unit-shadow.js · index.html?scene=badnorth&c02=swingArc | tests/c02-bn-fx-b.mjs、tests/battle-g3.mjs | shots-r56/820977247083528192-swing-arc.png |
| 821321422140309504 | 选中小队地面白色外轮廓 + 登台 + 混战 + 血与尸体 | 小队地面轮廓随队形变化；战斗流血 / 尸体 | 旧 note：仅学习；轮廓没接进 Battle | battle-c02 `footprint`：每支在场守军队按成员外扩 4 点求凸包，画白色外轮廓 + 角点小方块（squad-footprint.js 同一套），随队形每帧更新。 | done | src/badnorth/battle-c02.js（footprint）· src/badnorth/squad-footprint.js · index.html?scene=badnorth&c02=footprint | tests/c02-bn-fx-b.mjs、tests/squad-footprint.mjs | shots-r56/821321422140309504-footprint.png |
| 959530111187013632 | 关卡支持多种草型；109 帧硬切到雨天关卡（深色雨云、雨丝） | 每关多草型 + 雨景 | 物种几何（第 55 批 G2 flora-species 已补）；雨景未复现 | battle-c02 `rain`：岛周 1600 根斜雨丝（风向偏斜，落地回收并在落点溅白点）+ 岛上空 4 团深灰积云缓慢漂移；配合北境主题 3（雨）与 `fx=levelflora` 多草型。 | done | src/badnorth/battle-c02.js（rain）· src/life/flora-species.js · src/badnorth/theme.js · index.html?scene=badnorth&c02=rain&fx=levelflora（按 3 切雨天） | tests/c02-bn-fx-b.mjs、tests/flora-species.mjs | shots-r56/959530111187013632-rain.png |
| 901469409579061248 | 两条载人长船靠岸，船后两道外张白线、交错泡沫、舷侧浅片 | Kelvin V 形泡沫 + 船头喷溅 + 靠岸船 | 旧 note：断续泡沫、舷侧喷溅、靠岸船行为、独立 Wake 接口、KELVIN 角（环境船 boats.js 已接 makeWakeParticles） | battle-c02 `wakes`：战斗长船（真正靠岸卸人的那批）按实际位移求速度喂 core/wake-sampling.makeWakeParticles（舷侧两发射器 Kelvin 角 + 中线薄纱 + 方块喷溅），旧白点尾迹让位；靠岸停住即停发。 | done | src/badnorth/battle-c02.js（wakes）· src/core/wake-sampling.js · src/life/boats.js · index.html?scene=badnorth&c02=wakes | tests/c02-bn-fx-b.mjs、tests/wake-particles.mjs | shots-r56/901469409579061248-wakes.png |
| 816748103193817088 | 灰模地形上画导航面（黑线三角网 + 红顶点），百人在面上连续流动 | 导航面 + 面内连续流向 | 旧 note：接进 battle.js、通口前视、共享 World 自动生成导航面（均已由 G5 / 第 55 批补：navMeshFromLayeredGraph + flowAim + guardedFlowAt）；缺可视化 | battle-c02 `navmesh`：把 BattleNavigation 由共享分层图自动生成的导航面画成黑线 + 红顶点（多边形边 + 扇形对角线），与 `?continuousFlow=1` 一起看连续流。 | done | src/badnorth/battle-c02.js（navmesh）· src/world/navmesh-flow.js · src/world/battle-navigation.js · index.html?scene=badnorth&grid=mixed&c02=navmesh&continuousFlow=1 | tests/c02-bn-fx-b.mjs、tests/layered-continuous-flow.mjs、tests/flow-saddle-guard.mjs | shots-r56/816748103193817088-navmesh.png |

## 截图对照要点

- **912691357440978945**：截图：台地上一片带卫星滴的不规则血泊（不再是硬边圆片），小屋墙面竖向血条（旧 #bleedWall），屋右侧地面不规则焦黑斑；与原片 0140–0400 的「血泊连片 + 起火处焦黑」一致。程序化贴图，非原作血迹美术。
- **906425294533394432**：截图：岩体下方挖出的洞口（深色凹进）里站着守军，洞顶台面上另一队矛兵 —— 同格两层同时作战；navigation.html 精细门户页实走穿洞到达。洞形是体素直壁，不是原片圆拱 tileset。
- **906416813810049025**：截图与原片 0200–0290「厚岩下开洞、洞里与洞顶都有人」机制一致；原 tileset 的圆拱造型 / 紫色主题未复刻（程序化体素洞代替，颜色由 1–6 号主题决定）。
- **906207980802252801**：开雾后背景一圈柔边、成片的淡雾带（差分图可见团块状软片，均值 +1.0 灰阶、12.6% 像素 >3），岛体不受影响；与原片「低对比、柔和、只在背景」一致。仍是平面软片，不是体积雾；原片速度来自加速 gif，未推断。
- **903647529203634176**：同一组 8 次命中（攻击者都在 -x 侧）：开时 +4 整体朝 +x 偏、击杀 +20 上浮 0.06 > 伤害 0.037；关时数字原地上浮、kill 与 damage 同速。
- **902069261304287232**：截图：全岛灰色格网 + 对角线，其上按队伍着色的继承树（3 队 / 24 源 / 1098 段）；与原片 0100–0200 的「网格线框 + 彩色树」一致（原片暗底，本仓北境底色）。
- **901842167508992000**：截图：岛面铺满圆角格面，粉（步兵）/ 黄绿（矛兵）/ 青（弓手）三团连续区域 + 图例；与原片 0200–0290 三色成团一致。
- **880853661936734211**：本轮无新截图（沿用第 53 批 body-separation 浏览器验收）。
- **870296307889573889**：a：三人下坠中身体翻转（头盔朝镜头，累计 355°）；b：落到下一级后周围一圈浅色尘团、人从躺倒爬起。原片 0210–0290 下坠与落地留血一致；原片动作是 sprite 动画，本仓是刚体翻滚。
- **797119718477991936**：navigation.html：多层体素块中绿色路径穿过拱洞到达（拱 1、平底 4、门户收窄 8、封死 0）；与原片白点沿多层平台走一致。原 WFC 城堡美术未复刻。
- **886199305522085890**：近景对照：开（左）点随距离放大、保持与点距 1:2，关（右）固定 7px 显得稀疏；中景窄台边仍是一串白点。与原片 200–399 近景一致。
- **820977247083528192**：截图：守军头顶 4 道白色月牙拖影（同 0000 / 0023 / 0024 帧的白月牙），脚下软影；原片的逐帧手绘 sprite 动画无素材，本仓刚体单位 + 程序化拖影代替。
- **821321422140309504**：截图：小屋前守军外围一圈白色多边形 + 角点方块，远处另两队各一圈；与原片 0100–0160 的白色轮廓一致（原片是灰模场景）。
- **959530111187013632**：截图：灰白雨天主题、岛顶一团深色雨云、斜雨丝、地面多种草丛；与原片 0109–0199 雨景一致。雨云是程序化积云，非原美术。
- **901469409579061248**：截图：进港长船后方两道外张白色泡沫线 + 中间一片散点；与原片 0000–0099 一致。
- **816748103193817088**：截图：混合网格岛面铺满黑线三角网 + 红顶点（343 面 / 472 顶 / 104 跨层链），小队站在面上；与原片 0128 原尺寸一致。连续流仍默认关（第 55 批 quad 上实测略慢）。
