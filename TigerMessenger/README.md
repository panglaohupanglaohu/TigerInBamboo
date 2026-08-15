# TigerMessenger · 小星球信使

**TigerInBamboo 子项目**：纯网页、零构建的 3D 送信小游戏。
你是小星球上的**送信智能体**——从发光的寄件人手中接过信，跑过球面、乘电车或航空艇跨越南北半球，
把每一封信送到对的人手上。

- 🌐 在线试玩（GitHub Pages）：<https://panglaohupanglaohu.github.io/TigerInBamboo/TigerMessenger/>
- 🏮 主站入口：展厅 `frontend/home.html` 的「进入二次元」光点（相对路径 `../TigerMessenger/`）

## 玩法

### 送信循环

靠近发光的**寄件人**按 `E` 接信 → 跟随右上角罗盘找到**收件人** → 按 `E` 送达 → 下一单；全部送达即通关。

- 接信与送达都会**刷新检查点**；虚空坠落（掉入球心或飞出太远）回到最近的检查点重生
- 任务面板（左上）：当前状态 / 信件清单 / 投递计分 / 信袋入口；可折叠（`Tab`，状态记忆）
- 本局四封信（顺序固定）：

| 信件 | 寄件人 → 收件人 |
|---|---|
| 竹林邀请函 | 小虎 → 阿竹 |
| 夜色明信片 | 月见 → 星野 |
| 密信 · 检查点 | 驿站 → 远方 |
| 月光回信 | 阿竹 → 月影 |

- 通关后自动打开信袋，toast「全部信件送达 · 你是真正的夜色信使」

### 交通（五种载具 + 一种视角）

**基督城复古电车**（`assets/tram.js` + `world/tramSystem.js`）

- 红 / 蓝双车相向运行：11 路 `CITY TOUR` / 12 路 `COAST LINE`，双线四轨闭合环线
- 线路：北岛避障环线 → 西海岸跨赤道 → 南半球**高架 S 型穿城线**（半楼高巡航，与水晶花厅平视）→ 回北
- 近车按 `F` 上车（窗边乘客座，看风景）；车上按 `C` 切换**司机视野**（广角驾驶室）；再按 `F` 下车
- 登车 BGM：`Tram` 头 16 秒 →《城南花已开》循环；驶入大峡谷前约 10 秒切《風之傳說》，出谷后鸟群送别伴飞
- 阿狸跟随中上车会跳到你身旁卧着

**莫比斯航空艇**（`assets/moebiusAirship.js` + `player/airshipRide.js`）

- 垂绳旁按 `F` 抓绳攀爬登艇（可跳起抓绳）；登艇后 `WASD` 驾驶、`Space` / `Shift` 升降、`C` 驾驶员第一人称、`G` 投烟雾弹、`F` 下艇
- `Q` 召唤航空艇降临到面前（空闲态可用）
- 亲手驾驶后航空艇停留在落点，不再回锚；地图编辑器放置「莫比斯原初湖沼」后，航空艇会自动锚到其正上方

**水晶城巡逻飞行器**（`player/aircraftRide.js`）：按 `V` 进入 / 退出编队领头机**第一人称驾驶舱**（观景不驾驶，与航空艇 / 气泡艇互斥）

**战船**（`player/boatRide.js`）：靠近码头古战船或运河巡游战船按 `F` 上船，`WASD` 驾驶、`F` 下船；运河船下船后吸附回航道继续巡游

**气泡艇**（`assets/bubblePod.js` + `player/bubblePodRide.js`）：近艇按 `F` 登艇，`WASD` 驾驶、`Space` 上浮、`Ctrl` 下潜、`C` 第一 / 第三视角切换，`G` 或**鼠标左键（按住连发）**发射**气泡弹**（十字准星瞄准，高速连发 + 炮口闪光 + 触地爆裂）；水晶城海水湖内可潜行；共 4 艘（3 艘绕水晶城花厅 + 1 艘停泊书店镇上空）

### 星球上的角色

| 角色 | 交互 |
|---|---|
| 送信 NPC ×8（六棱柱 + 光柱/光环/浮球标记，仅当前目标点亮） | `E` 接信 / 送达 |
| 弹琴老人（旧港码头起重机旁，膝上手风琴） | `E` 播放 / 停止八音盒（《黄昏屁》，琴键随音符起伏） |
| 阿狸（营地小火狐，四足、火焰链尾） | `E` 叫醒 / 聊天（一起走 / 回去休息 / 先歇会儿 / 自由输入）；贴地球面尾随，随电车卧身旁 |
| 莫比斯虎（湖沼墨虎，暗紫灰赛博水墨虎，红宝石眼） | 地图编辑器放置「莫比斯湖沼」后出现：巡游饮水；近身自动**灯谜对答**气泡 |
| 剪纸罗马士兵 | 旧港码头装船物流（计数装货 → 满载离港入运河）；深夜随太鼓潜入圣城巡查（见下） |

## 世界：一颗星球，两个半球

星球半径 160（`world/planet.js`，`WORLD_SCALE=4`，旧 R=40 布局等比放大），引力恒指球心，平台 / NPC / 资产全部贴球面放置
（`world/sphereMath.js` / `sphereShell.js`）。北半球是「现实人文」的沉绿大地，南半球是「莫比斯幻想」的淡蓝荒漠；
电车跨赤道时，天空 / 雾 / 光照在 2 秒内平滑过渡为莫比斯粉紫（`main.js` 结界）。

**北半球**

- **信使主岛**（`scenes/messengerIsland.js`）：出生点海岛悬崖瀑布营地（多层海岸 / 荒山山洞 / 崖壁叠瀑 / 太空水环 / 阿狸）、主岛平台、11 座连绵土坡（视觉与碰撞共用高度场）、月牙湖（浅水涉水减速 / 深水阻挡 / 环湖小径）、Hard To Find Bookshop 复古老书店（八角凸窗 / 三角门廊 / 可改烫金招牌）+ 绣球花丛、旧港码头（古战船 / 起重机 / 板条箱 / 纸士兵装船物流）
- **西芳寺 · 苔寺**（`scenes/saihojiGarden.js` + `world/saihoji.js`）：苔海六景——入口苔径 / 主石之庭 / 枯瀑之庭 / 苔海岛群 / 空庭 / 回望石组，环形分布于北半球外围，确定性石组构图 + 古松 + 参道；`?tour=saihoji` 从第一景出生漫游
- **星海运河环线**（`world/canalSystem.js`）：一条闭合的、在球面地面挖出的浅沟，连通书店镇 / 出发营地 / 月亮湖 / 高山圣城 / 水晶城 / 白鲸海水湖 / 叹息之门；10 艘古战船沿运河巡游；与白鲸湖落差处有**阶梯瀑布船道 + 出口升船机**，闭环通航
- **太古高山圣城**（`world/odysseyCitadel.js` + `citadelTown.js` + `citadelRange.js`）：Townscaper 式**规则生成**的圣城——五层贴地台地（每层 25×25 格 × 5 层，ASCII 单元格地图 + 邻接规则自动生成城垛 / 拱窗 / 黄金穹顶 / 正门门廊 / 拱形水门）+ 断崖瀑布 + 护城河（与运河水系打通）+ 梯湖水帘 + 台地鸟群（每台 20 只：白天漩涡 / 夜栖屋顶 / 纸士兵惊飞）
  - **Townscaper 全模拟**（`citadelTown.js`）：**15 色调色板**（白/米白/沙黄/柠黄/橙/砖红/陶土/褐/深褐/蓝灰/石板灰/蓝/藏青/青/松绿，字符 `0-9A-E` + 正门 `G`，旧档 W/L/B/D 自动迁移）+ **每块明度微抖**（5 档哈希）+ **户概念**（竖柱同色一户、户种子定窗密度 0.5/0.7/1.0 与门面朝向）+ **屋顶形状分类**（孤立块→四坡尖顶 / 条带→人字坡 / L 形→转角教堂尖塔 / 十字形→中心教堂尖塔 / 2×2→晒台+矮尖塔 / 大平顶→花园或晒台）+ **旗杆**（≥4 层细柱顶）+ **围合平顶花园**（草地+低栅栏+树+屋顶鸟）+ **底层围合广场**（石板铺装+拼缝）+ **水面小船/灯笼**点缀；每块在编辑器里摆放即自动「长」出全套构件
  - **建筑构件细节**：**楼板檐口线**（每层外露面顶部深色压条）+ **底层墙裙**（基座条）+ **窗台窗楣**（拱窗上下深色压条）+ **转角壁柱**（角格竖柱）——Townscaper 式立面层次；**阳台**（悬挑板+铁艺栏杆，户种子 30% 分布）；**连拱柱廊**（连续悬空段出连续拱+细柱）；**屋顶完善**（人字坡屋脊瓦+两端挑檐+山墙圆窗，教堂尖塔加风向标）——全部静态合并，draw calls 仅 +21
  - **台地-建筑放置闭环**：台地半径/层高可缩放（编辑器滑杆），缩放后越界建筑格**自动裁剪**并即时重建，保证建筑单元始终可放置、无悬空（`trimCitadelGridToTerrain` 纯函数 + `trimCitadelTownToTerrain` 接线）
  - **瀑布独立化**：`cascadePoolsEnabled` 梯湖开关与瀑布正交——关湖后**瀑布独立挂帘**（落差取相邻台地顶差，不依赖湖），五座白石梯湖移除、台面全部让给建筑；开湖恢复五湖四帘
  - **运河交汇古堡**（`world/canalSystem.js` `buildCanalJunctionBox` + `odysseyCitadel` 第二实例）：**运河堤岸方框 = 城堡地基**——在运河环线月亮湖↔白鲸海湖航段，用运河同款立壁/土埂围出矩形干坞（四边高亮描边 + 四角灯塔），**方框内实心平台盖住原地貌**（不穿山不悬空），**金色光罩 + 对角亮线高亮构建区——点高亮区即弹搭建面板并自动切到古堡目标**；方框内是可编辑的 **12 层 Townscaper 高塔**（**无台地模式**：`skipOuterTerrain` 不建外围台地，镇体基座直接落在方框水面平台，trim 裁剪自动跳过）（独立存档键 `tm.citadel.levels.canal-junction.v1`）；搭建面板顶部「目标」下拉切换高山圣城 ⇄ 运河交汇古堡
  - **特洛伊木马**：护城河内第一层瀑布右侧草地，低多边形积木解构；6 名纸士兵系绳班组围马固定；**深夜（入夜后）木马腹舱开启，纸士兵绳降渗透**，沿台地 5→1 巡查（太鼓 BGM 随距离启停）
  - **纳沃纳双栖广场**（`world/navonaPlaza.js`）：港口参天大树正前方，对称喷泉 + 运河同款围边；**雨天蓄洪变水池、晴雪泄回旱季广场**，与天气联动
- **叹息之门**（`world/abandonedGate.js`）：太古双子要塞巨门——三重圆拱 + 左右阶梯巨塔夹道，电车高架从门正中穿行；开发者菜单可**搬到玩家当前位置**（存档 `tm.gateAnchorU.v1`）；城头六组穿行云线（`world/equatorialClouds.js`，设计搁置中，菜单可开关）；**Boids 鸟群**（18 只手绘橙白小鸟，分离/对齐/凝聚三定律，随门迁徙城头低空盘旋）

**南半球**

- **莫比斯水晶大都会**（`world/moebiusCity.js`）：成片玻璃巨晶（InstancedMesh 合并 draw call，透射玻璃晶林）+ 3 座中央母皇花厅塔 + 晶根金黄能量海；晶林沿峡谷阶地扎根；空中有人字形**巨蜂鸟飞行器编队**（5 架，水晶城母塔 ↔ 书店低速往返，发现湖沼落花俯冲吸蜜）
- **大峡谷**（`world/canyon.js`）：lat -50° / lon -112° 的阶梯塌陷深渊，7 级谷壁，谷底可行走；电车高架桥墩落谷底跨谷
- **白鲸海水湖**（`world/citySeaLake.js`）：水晶城旁的大型海水湾，沉入谷底、花厅塔自湖心拔起；培育白鲸 / 鳗 / 发光带鱼 / 管虫 / 贝壳；**气泡艇潜行**的舞台；开发者菜单可整湖搬离水晶城（`tm.seaLakeDir.v1`，减轻同屏负担）
- **莫比斯原初湖沼**（`world/moebiusSwamp.js`）：Y 轴锁死分层（地面 40 / 水面 25 / 湖底 10），遮天大树顶棚，仅萤火虫与发光花蕊照明的深蓝绿平涂世界；珍珠瓷白鲸 / 焦黑土著人偶 / 荷叶小舟 / 莫比斯虎；由地图编辑器放置，进入切换湖沼 BGM
- **航空艇护航队**（`world/airshipEscort.js`）：9 只异星滑翔长翼鸟（两级折叠长翼、低频 S 形波浪滑翔），尾流场吸引伴飞航空艇，锁在艇周 6–15 环形圆柱结界

**环境系统**

- 昼夜循环（`world/dayNight.js`）：9 组关键帧插值天空 / 日光 / 环境光 / 云色，90 秒一天 × 可调速度，朝霞与暮云为重点过渡
- 天气（`world/weather.js`）：晴 / 雨 / 雪三档；雨丝雪片受风向风速驱动；雨天随机折线闪电（多分枝 + 雷鸣）；雨停出现彩虹环带
- 风速风向同时驱动云环漂移与拉伸（风切变）
- 背景音乐六曲（`music/`）：《風之傳說》（峡谷 / 湖沼 / 八音盒共用情绪段）、《城南花已开》（电车主曲）、《Various Artists-Tram》（登车）、《鬼太鼓座 · 大太鼓》（深夜渗透）、《纯音乐-雷声闪电》（雷鸣采样）、《黄昏屁》（八音盒）

## 操作

| 键 | 作用 |
|---|---|
| `WASD` / 方向键 | 移动（相机相对） |
| `Shift` | 疾跑 |
| `Space` / `J` | 跳跃（沿球面法线） |
| `E` | 交互：接信 / 送达 / 八音盒 / 与阿狸交谈 |
| `F` | 上车 / 下车；抓 / 放航空艇垂绳；上 / 下战船、气泡艇 |
| `C` | 电车乘客 / 司机视野；航空艇驾驶员 / 舱外视角；气泡艇第一 / 第三视角切换 |
| `G` | 航空艇投烟雾弹；气泡艇发射气泡弹 |
| `V` | 进入 / 退出飞行器驾驶舱 |
| `Q` | 召唤航空艇降临（圣城 / 水晶城面板打开时归面板换层） |
| `L` | 打开 / 关闭信袋（送达记忆） |
| `M` | 静音（含垫乐与 BGM） |
| `Tab` | 收起 / 展开任务面板 |
| 滚轮 / 中键拖动 | 缩放 / 环绕 |
| 右键拖拽 | 环视（松手平滑回弹默认视角） |
| `Esc` | 关闭阿狸聊天 |

手机 / 平板：屏幕**触控遥控杆**（可收起，触控设备默认展开；`src/ui/touchControls.js`）——
左摇杆移动、右拖板环视（气泡艇驾驶时改挪准星），按钮：跳 / `E` / `F` / `C` / `G`。
气泡艇另支持手柄：右摇杆瞄准、RT/RB 开火、LT/LB 下潜、左摇杆 Y 升降。

### URL 参数

| 参数 | 作用 |
|---|---|
| `?scene=messenger` / `saihoji` / `messenger,saihoji` / `all` | 场景按需加载（逗号 / `+` / 空格分隔，默认两者同开） |
| `?tour=saihoji` | 从苔寺第一景「入口苔径」出生，面向第二景（不改默认关卡出生点） |
| `?memory=1` | 显式开启主站四层记忆桥接（默认关闭，避免额外 fetch 探测） |
| `?local=1` | 强制本地 vendor（加载失败面板的「用本地 vendor 重试」会写入此参数刷新） |
| `?cdn=1` | 遗留参数：现在默认本地 vendor 更稳，`?cdn=1` 会被忽略 |
| `?fps=1` | 遗留参数：帧率已改由 🤖 开发者菜单头部实时显示 |

## 本地试玩

主站后端已挂载静态路径（推荐）：

```text
http://localhost:8931/TigerMessenger/
```

或用任意静态服务器伺服本目录（**请勿 file:// 直接打开**，页面会给出指引）：

```bash
cd TigerMessenger
python3 -m http.server 8765
# 打开 http://localhost:8765/
```

## 技术要点

- **零构建**：原生 ES modules + importmap；Three.js **r172 本地化 `vendor/` 默认加载**（离线 / GitHub Pages / CDN 被墙均可）；`file://` 与加载失败均有引导面板
- **全程序化几何**：角色 / NPC / 电车 / 书店 / 圣城 / 晶林 / 湖沼 / 木马全部基础几何体装配，无外部模型资产
- **Cel 动漫渲染**（`assets/toon.js`）：2/3 阶梯 gradientMap 硬边光影 + Inverse Hull 反向壳黑边描线 + `BasicShadowMap`；东方水墨配色（宣纸底 / 焦墨描边 / 扭曲古松）
- **球面物理**（`world/collision.js`）：切向移动 + 径向重力，土坡高度场吸附，曲面平台链式登台（STEP_UP 0.75）/ 侧面推出 / 下方顶头；穿心或飞远回检查点
- **场景注册表**（`scenes/registry.js`）：新场景 = 写一个 `scenes/<id>.js` 并 register；`main.js` 只做薄装配，玩法依赖经 `landmarks` 暴露
- **音频**（`src/audio/sfx.js`）：跳跃 / 接信 / 送达 / 电车哐啷与到站铃 / 环境风铃全部 Web Audio 合成；六条 BGM 线（八音盒 / 峡谷 / 湖沼 / 电车 / 潜入太鼓 / 雷鸣采样）带距离门控与互斥切换
- **信使记忆**：本机信袋 `localStorage`（键 `tm.letterJournal.v1`，最多 80 条）+ 可选动态桥接主站四层记忆（`quest/memoryBridge.js`，creatureId=`messenger`，`?memory=1` 开启）——接信写感知 / 日志 / 意图 / 情绪「使命」，送达确认意图 + 情绪「欣慰」；桥接失败静默退回信袋，信袋状态行显示是否连接
- **小地图**（`ui/minimap.js`）：左上角等距方位投影圆盘图（>640px 宽屏显示），以玩家为图心，实时标注 9 个经典场景（书店镇 / 出发营地 / 叹息之门 / 高山圣城 / 水晶城 / 白鲸海水湖 / 旧港码头 / 月亮湖 / 西芳寺苔庭）+ **相机视野锥**；点击图点或图例脉冲高亮并报距离；可拖动摆放（`tm.minimap.pos.v1`）
- **开发者面板**（右上角 🤖）：17 项滑杆（玩家 / 相机 / 交互 / 交通 / 天空）+ 光照强度 + 实时 FPS + 三重门 / 云墙搬迁开关 + 白鲸湖搬迁开关 + 重置；参数持久化 `tm.devParams.v1`
- **地图编辑器**（🤖 → 打开地图编辑）：顶视 canvas，`BUILDING_CATALOG` **72 项资产目录**（器物 / 植物 / 生物 / 沼泽生态 / 场景缩影 diorama）放置 / 拖动 / 复制 / 删除 / 朝向 / 书店招牌文字，与 3D 场景点选双向同步；布局持久化 `tm.mapEditor.placements.v1`
- **高山圣城 · Townscaper 搭建面板**（`ui/citadelEditorPanel.js` + `citadelSceneEdit.js`）：**开局后左键点选圣城即打开**（不要求坐航空艇）；2D 平面图点格编辑（5 台地 × 25×25 格 × 5 层，**Townscaper 15 色调色板** + 正门）+ **3D 直编辑**（左键叠块 / 侧面改色 / 空地加块 / 右键删块，悬停幽灵块）；`Q`/`E` 换层、`H` 隐藏高层、`Ctrl+S` 保存、`Ctrl+Z`/`Ctrl+Y` 撤销重做；编辑即时预览 3D（存档 `tm.citadel.levels.v1` / `.terrain.v1` / `.terrainObjects.v1`）；**地貌对象**含「台地湖」开关（瀑布独立化）——关湖后台面全可建；台地半径缩滑杆时越界建筑自动裁剪并提示；**调色板 15 色 + 正门**（数字键 1-9/0、Shift+1-6 选 A-E、G 选正门）；**3D 直编辑交互**：右键删除体块（编辑态下右键不触发相机拖动）、点击任意台地已建体块自动切换编辑台地、层数上限按目标实例动态（高山 5 层 / 运河古堡 12 层）；**点选即建**：左键点圣城 / 运河交汇高亮方框（堤岸方框内实心平台 + 金色光罩即构建区）直接弹面板，点运河方框自动把编辑目标切到运河交汇古堡
- **水晶城 · 搭建面板**（`ui/crystalCityEditorPanel.js`）：乘航空艇点选水晶城建筑打开；平面图左键拖动改位 / 空地拖出新建筑 / 右键删除 / 「汇聚高地」一键生成山峦环带；`Ctrl+S` 保存（`tm.crystalCity.layout.v1`）
- **故事板引擎**（`story/`，🎬 工作台）：写故事 / 分镜头，从资产库（62 项白名单）拖拽动物 / 植物 / 建筑载具 / 环境 / 物品到分镜，LLM 解析（同源 `/api/llm/chat`，agent=`storyboard`）→ 双重白名单校验 → 在当前星球上组装临时场景并按时间线演出（spawn / say / moveTo / wait / focusCamera / toast / weather）；幻觉 id 与不支持的动作静默丢弃记 warnings，不写存档、刷新即消失、`dispose()` 精确回收碰撞体
- **调试句柄**：控制台 `window.__tm` 暴露 player / quest / cameraRig / 各编辑器 / 故事板 / 天气等句柄

## 模块结构

```text
TigerMessenger/
├── index.html            # 入口 / HUD / 启动脚本（importmap → 本地 vendor）
├── planet.html           # 旧球面实验页存根：现仅跳转主游戏（旧链接不 404）
├── townscaper.html       # 高山圣城 Townscaper 编辑器独立页（开发用）
├── shot-harness.html     # 资产清单截图 Harness（开发用）
├── aircraft*.html / retro_spaceship*.html / moebius_aircraft_outline.html
│                         # 飞船 / 飞行器实验页（开发用）
├── PLAN.md / TODO.md / PLAN-sphere-player.md / PLAN-planet-lights.md
├── music/                # 六曲 BGM（風之傳說 / 城南花已开 / Tram / 雷声闪电 / 大太鼓 / 黄昏屁）
├── vendor/               # three r172 本地兜底（three.module / three.core / jsm/misc/Timer）
└── src/
    ├── main.js           # 薄装配：舞台/环境/星球/场景/玩家/相机/输入/搭乘/天气/任务/编辑器/主循环
    ├── core/             # constants · params(P+持久化) · input · camera(球面跟随) · stage
    │                     # devPanel · mapEditor · buildingCatalog(72 项可放置资产)
    ├── scenes/           # registry + sceneApi：messengerIsland(信使主岛) / saihojiGarden(苔寺)
    ├── world/            # planet · sphereMath · sphereShell · collision · platforms · hills
    │                     # tramSystem · dayNight · weather · environment · nature · lake · canyon
    │                     # startingCamp · foxNpc · elderMusic · saihoji · mossyGround
    │                     # moebiusCity · moebiusSwamp · moebiusTiger · crystalCityLayout
    │                     # odysseyCitadel · citadelTown · citadelRange · citadelInfiltration
    │                     # citadelTerraceBirds · abandonedGate · canalSystem · canalBoats
    │                     # canalLakeLink · navonaPlaza · citySeaLake · birdVortex
    │                     # flock · airshipEscort · equatorialClouds · lifecycleClouds
    │                     # startGarden(备用构图) · worldScale(统一世界尺度 R=160)
    ├── player/           # player · controller(球面移动) · animation
    │                     # agentMessenger(当前送信人：AgentsGroup2026 智能体) · messenger(旧版保留)
    │                     # tramRide(F 上车/C 司机视野) · airshipRide(抓绳/WASD 驾驶/G 烟雾弹)
    │                     # aircraftRide(V 驾驶舱) · boatRide(战船) · bubblePodRide(气泡艇/G 气泡弹)
    ├── quest/            # questSystem(四封信+E 键交互) · npc · letterJournal(信袋) · memoryBridge(四层记忆)
    ├── assets/           # fox(阿狸) · tram · moebiusAirship · moebiusAircraft · bubblePod
    │                     # bookshop · hydrangea · ancient(水墨古松/丹顶鹤/黑岩) · harbor(旧码头)
    │                     # harborLogistics(装船物流) · lowPoly · toon(Cel 基础设施)
    │                     # citadelWatchtower · citadelElderTree · citadelMoat · citadelTrojanHorse
    │                     # snowMassif(雪山单元) · moebiusTower
    ├── story/            # storyboardPanel(🎬 分镜工作台) · storyCatalog(白名单) · storyLLM · storyEngine
    ├── ui/               # hud(toast/气泡/提示/面板折叠) · touchControls(手机遥控杆) · minimap(小地图)
    │                     # dragPanel(通用拖拽) · citadelEditorPanel · citadelSceneEdit · crystalCityEditorPanel
    ├── audio/            # sfx(Web Audio 合成 + 六线 BGM 管理)
    └── planet/           # 球面实验页代码（历史保留，planet.html 已改为跳转）
```

## 参考文档

- `PLAN.md`：里程碑与分工约定（Grok 生成 / Kimi 落地）
- `TODO.md`：每条功能的实现细节与验收记录
- `PLAN-sphere-player.md` / `PLAN-planet-lights.md`：球面化实验过程记录
- `docs/TigerMessenger清单.docx`（含截图版）：场景 / 器物 / 生物 / 植物全清单
- 主站记忆模块设计：`../docs/memory-architecture.md`
