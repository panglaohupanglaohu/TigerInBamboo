# TigerMessenger · 小星球信使

**TigerInBamboo 子项目**：纯网页、零构建的 3D 送信小游戏。
你是小星球上的**送信智能体**——从发光的寄件人手中接过信，跑过球面、乘电车或航空艇跨越南北半球，
把每一封信送到对的人手上。

- 🌐 在线试玩（GitHub Pages）：<https://panglaohupanglaohu.github.io/TigerInBamboo/TigerMessenger/>
- 🏮 主站入口：展厅 `frontend/home.html` 的「进入二次元」光点（相对路径 `../TigerMessenger/`）

## 玩法

### 送信循环

靠近发光的**寄件人**按 `E` 接信 → 跟随右上角罗盘找到**收件人** → 按 `E` 送达 → 下一单；全部送达即通关。

- 接信与送达都会**刷新检查点**；虚空坠落回到最近的检查点重生
- 任务面板（左上）：当前状态 / 信件清单 / 投递计分 / 信袋入口；可折叠（`Tab`，状态记忆）
- 本局四封信：

| 信件 | 寄件人 → 收件人 |
|---|---|
| 竹林邀请函 | 小虎 → 阿竹 |
| 夜色明信片 | 月见 → 星野 |
| 密信·检查点 | 驿站 → 远方 |
| 月光回信 | 阿竹 → 月影 |

### 交通

**基督城复古电车**（`assets/tram.js` + `world/tramSystem.js`）

- 红 / 蓝双车相向运行：11 路 `CITY TOUR` / 12 路 `COAST LINE`，双线四轨闭合环线
- 线路：北岛避障环线 → 西海岸跨赤道 → 南半球**高架 S 型穿城线**（半楼高巡航，与水晶花厅平视）→ K 点回北
- 近车按 `F` 上车（窗边乘客座，看风景）；车上按 `C` 切换**司机视野**（广角驾驶室）；再按 `F` 下车
- 驶入大峡谷前约 10 秒 BGM《風之傳說》淡入替换环境音；出谷后鸟群送别伴飞

**莫比斯航空艇**（`assets/moebiusAirship.js` + `player/airshipRide.js`）

- 垂绳旁按 `F` 抓绳攀爬登艇（可跳起抓绳）；登艇后 `WASD` 驾驶、`Space` / `Shift` 升降，`F` 下艇
- 亲手驾驶后航空艇停留在落点，不再回锚；地图编辑器放置「莫比斯原初湖沼」后，航空艇会自动锚到其正上方

### 星球上的角色

| 角色 | 交互 |
|---|---|
| 送信 NPC（六棱柱 + 光柱/光环/浮球标记，仅当前目标点亮） | `E` 接信 / 送达 |
| 弹琴老人（出生营地，膝上手风琴） | `E` 播放 / 停止八音盒（《風之傳說》片段，琴键随音符起伏） |
| 阿狸（营地小火狐，四足、火焰链尾） | `E` 叫醒 / 聊天（一起走 / 回去休息 / 先歇会儿 / 自由输入）；贴地球面尾随，间距约 2.2 |
| 莫比斯虎（南半球湖沼，暗紫灰赛博水墨虎，红宝石眼） | 巡游 NPC：大树间巡游、沿石阶下坑饮水 |

## 世界：一颗星球，两个半球

星球半径 40（`world/planet.js`），引力恒指球心，平台 / NPC / 资产全部贴球面放置
（`world/sphereMath.js` / `sphereShell.js`）。北半球是「现实人文」的沉绿大地，南半球是「莫比斯幻想」的淡蓝荒漠；
电车跨赤道时，天空 / 雾 / 光照在 2 秒内平滑过渡为莫比斯粉紫（`main.js` 结界）。

**北半球**

- **信使主岛**（`scenes/messengerIsland.js`）：出生点海岛悬崖瀑布营地（多层海岸 / 荒山山洞 / 崖壁叠瀑 / 太空水环 / 弹琴老人 / 阿狸）、主岛平台、11 座连绵土坡（视觉与碰撞共用高度场）、月牙湖（浅水涉水减速 / 深水阻挡 / 环湖小径）、Hard To Find Bookshop 复古老书店（八角凸窗 / 三角门廊 / 可改烫金招牌）+ 绣球花丛 + 书店山坡、老旧修船厂码头（渔船 / 起重机 / 板条箱）
- **西芳寺·苔寺**（`scenes/saihojiGarden.js` + `world/saihoji.js`）：苔海六景——入口苔径 / 主石之庭 / 枯瀑之庭 / 苔海岛群 / 空庭 / 回望石组，环形分布于北半球外围，确定性石组构图 + 古松 + 参道；`?tour=saihoji` 从第一景出生漫游

**南半球**

- **莫比斯水晶大都会**（`world/moebiusCity.js`）：成片玻璃巨晶（InstancedMesh 合并 draw call，`MeshPhysicalMaterial` 透射玻璃）、3 座中央母皇塔、晶根金黄能量海；给电车轨道让出走廊
- **大峡谷**（`world/canyon.js`）：lat -50° / lon -112° 的阶梯塌陷深渊，7 级谷壁，谷底可行走；电车高架桥墩落谷底跨谷
- **大峡谷 Boids 鸟群**（`world/flock.js`）：18 只低多边形手绘橙白小鸟，群集三大定律（分离/对齐/凝聚）在 35–45 高度带忽开忽合，晶塔避障、边界回弹
- **航空艇护航队**（`world/airshipEscort.js`）：9 只异星滑翔长翼鸟（两级折叠长翼、低频 S 形波浪滑翔），尾流场吸引伴飞航空艇，锁在艇周 6–15 环形圆柱结界
- **莫比斯原初湖沼**（`world/moebiusSwamp.js`）：Y 轴锁死分层（地面 40 / 水面 25 / 湖底 10），遮天大树顶棚，仅萤火虫与发光花蕊照明的深蓝绿平涂世界；珍珠瓷白鲸 / 焦黑土著人偶 / 荷叶小舟 / 莫比斯虎；由地图编辑器放置

**环境系统**

- 昼夜循环（`world/dayNight.js`）：9 组关键帧插值天空 / 日光 / 环境光 / 云色，90 秒一天 × 可调速度，朝霞与暮云为重点过渡
- 天气（`world/weather.js`）：晴 / 雨 / 雪三档；雨丝雪片受风向风速驱动；雨天随机折线闪电（多分枝 + 按距离雷鸣）；雨停出现彩虹环带
- 风速风向同时驱动云环漂移与拉伸（风切变）

## 操作

| 键 | 作用 |
|---|---|
| `WASD` / 方向键 | 移动（相机相对） |
| `Shift` | 疾跑 |
| `Space` / `J` | 跳跃（沿球面法线） |
| `E` | 交互：接信 / 送达 / 八音盒 / 与阿狸交谈 |
| `F` | 上车 / 下车；抓 / 放航空艇垂绳 |
| `C` | 电车上切换乘客窗景 / 司机视野 |
| `L` | 打开 / 关闭信袋（送达记忆） |
| `M` | 静音（含垫乐与 BGM） |
| `Tab` | 收起 / 展开任务面板 |
| 滚轮 / 中键拖动 | 缩放 / 环绕 |
| 右键拖拽 | 环视（松手平滑回弹默认视角） |

手机 / 平板：屏幕**触控遥控杆**（可收起，触控设备默认展开；`src/ui/touchControls.js`）——
左摇杆移动、右拖板环视，四个按钮：跳 / `E` / `F` / `C`。

### URL 参数

| 参数 | 作用 |
|---|---|
| `?scene=messenger` / `saihoji` / `messenger,saihoji` / `all` | 场景按需加载（默认两者同开） |
| `?tour=saihoji` | 从苔寺第一景「入口苔径」出生，面向第二景（不改默认关卡出生点） |
| `?fps=1` | 标题栏显示实时帧率（低于 25 fps 控制台告警） |
| `?cdn=1` | 声明想走 CDN；实际默认本地 vendor 更稳（加载失败面板的「重试」会带 `?local=1` 强制本地） |

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
- **全程序化几何**：角色 / NPC / 电车 / 书店 / 晶林 / 湖沼全部基础几何体装配，无外部模型资产
- **Cel 动漫渲染**（`assets/toon.js`）：2 阶梯 gradientMap 硬边光影 + Inverse Hull 反向壳黑边描线 + `BasicShadowMap`；东方水墨配色（宣纸底 / 焦墨描边 / 扭曲古松）
- **球面物理**（`world/collision.js`）：切向移动 + 径向重力，土坡高度场吸附，曲面平台链式登台（STEP_UP 0.75）/ 侧面推出 / 下方顶头；穿心或飞远回检查点
- **场景注册表**（`scenes/registry.js`）：新场景 = 写一个 `scenes/<id>.js` 并 register；`main.js` 只做薄装配，玩法依赖经 `landmarks` 暴露
- **音频**（`src/audio/sfx.js`）：跳跃 / 接信 / 送达 / 雷鸣 / 电车哐啷与到站铃 / 环境风铃全部 Web Audio 合成；唯一外部资源 `music/Gwenan Gibbard-風之傳說.mp3`（八音盒与峡谷 BGM 共用，BGM 播完整段才停）
- **信使记忆**：本机信袋 `localStorage`（键 `tm.letterJournal.v1`，最多 80 条）+ 动态桥接主站四层记忆（`quest/memoryBridge.js`，creatureId=`messenger`）——接信写感知 / 日志 / 意图 / 情绪「使命」，送达确认意图 + 情绪「欣慰」；桥接失败静默退回信袋，信袋状态行显示是否连接
- **开发者面板**（右上角 🤖）：14 项滑杆（玩家 / 相机 / 交互 / 交通 / 天空）+ 光照强度 + 实时 FPS + 重置；参数持久化 `tm.devparams.v1`
- **地图编辑器**（🤖 → 打开地图编辑）：顶视 canvas，16 类资产目录（书店 / 古松 / 路牌 / 街灯 / 湖沼 / 码头……）放置 / 拖动 / 复制 / 删除 / 朝向 / 书店招牌文字，与 3D 场景点选双向同步；布局持久化 `tm.mapEditor.placements.v1`
- **调试句柄**：控制台 `window.__tm` 暴露 player / quest / cameraRig / 场景句柄等

## 模块结构

```text
TigerMessenger/
├── index.html            # 入口 / HUD / 启动脚本（importmap → 本地 vendor）
├── planet.html           # 旧球面实验页存根：现仅跳转主游戏（旧链接不 404）
├── PLAN.md / TODO.md     # 复刻计划与任务清单（含每条功能的实现与验收记录）
├── music/                # 風之傳說 mp3（八音盒 / 峡谷 BGM）
├── vendor/               # three r172 本地兜底（three.module / three.core / jsm/misc/Timer）
└── src/
    ├── main.js           # 薄装配：舞台/环境/星球/场景/玩家/相机/输入/搭乘/天气/任务/主循环
    ├── core/             # constants · params(P+持久化) · input · camera(球面跟随) · stage
    │                     # devPanel · mapEditor · buildingCatalog(16 类可放置资产)
    ├── scenes/           # registry + sceneApi：messengerIsland(信使主岛) / saihojiGarden(苔寺)
    ├── world/            # planet · sphereMath · sphereShell · collision · platforms · hills
    │                     # tramSystem · dayNight · weather · environment · nature · lake · canyon
    │                     # startingCamp · foxNpc · elderMusic · saihoji
    │                     # moebiusCity · moebiusSwamp · moebiusTiger · startGarden(备用构图)
    │                     # flock(Boids 峡谷鸟群) · airshipEscort(长翼鸟护航队)
    ├── player/           # player · controller(球面移动) · animation
    │                     # agentMessenger(当前送信人：AgentsGroup2026 智能体) · messenger(旧版保留)
    │                     # tramRide(F 上车/C 司机视野) · airshipRide(抓绳/WASD 驾驶)
    ├── quest/            # questSystem(四封信+E 键交互) · npc · letterJournal(信袋) · memoryBridge(主站四层记忆)
    ├── assets/           # fox(阿狸) · tram · moebiusAirship · moebiusTower · bookshop · hydrangea
    │                     # ancient(水墨古松/丹顶鹤/黑岩) · harbor(旧码头) · lowPoly · toon(Cel 基础设施)
    ├── ui/               # hud(toast/气泡/提示/面板折叠) · touchControls(手机遥控杆)
    ├── audio/            # sfx(Web Audio 合成 + BGM 接管)
    └── planet/           # 球面实验页代码（历史保留，planet.html 已改为跳转）
```

## 参考文档

- `PLAN.md`：里程碑与分工约定（Grok 生成 / Kimi 落地）
- `TODO.md`：每条功能的实现细节与验收记录
- `PLAN-sphere-player.md` / `PLAN-planet-lights.md`：球面化实验过程记录
- 主站记忆模块设计：`../docs/memory-architecture.md`
