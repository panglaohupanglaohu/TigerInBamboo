# CartonBook 科学镜头语法（摄影师简报）

> 重建依据：[`EDENA-CAMERA-STUDY.md`](./EDENA-CAMERA-STUDY.md)（Edena 公开页 + NYFA/标准电影摄影景别·焦段）  
> **不是**「再加几个 orbit 预设」。每族先回答：电影里叫什么、为何用、何时禁用、在 `__tm` 里怎么打。  
> 正式画面：游戏截屏 + [`CAPTURE-CLEAN.md`](./CAPTURE-CLEAN.md)。**零容忍 HUD**：小地图、任务/家书、R/E/F 交互叠字、WASD 提示、FPS、准星、「遥控」、toast——任一可见即废片。禁止文生图。

诚实边界：未持有纸质 Edena 原书；页证据来自仓库已引公开预览/评述（Reactor、CAF *Sur l'étoile* p.20、Dark Horse「REPAIRS」等）。

---

## 0. 选用方式

```json
"camera": { "mode": "panorama", "landmark": "morrisIsland" }
"camera": { "family": "cinematic", "landmark": "morrisIsland" }
"camera": { "mode": "macro", "landmark": "morrisIsland" }
"camera": { "family": "tele", "landmark": "morrisIsland" }
"camera": { "mode": "airshipPilot", "landmark": "morrisIsland" }
```

| `mode` / `family` | 中文别名 | 电影等价（简述） |
|-------------------|----------|------------------|
| `panorama` | `全景` | ELS + wide lens + 微俯/曲地平 |
| `cinematic` | `镜头感` | LS/MLS + normal + 眼高偏低（场所） |
| `macro` | `微距` | CU/ECU + close-focus；前景细节 |
| `tele` | `长焦` / `长焦压缩` | LS 距离 + long/tele 压缩平面 |
| `airshipPilot` | `飞艇` / `飞艇特殊视野` | Subjective pilot POV |

`captureShots.mjs` 读 `camera.mode` **或** `camera.family`；未写则回退旧 `preset`/`dist`/`orbit`/`pitch`。  
手调字段覆盖族默认。CLI：

```bash
node src/cli.mjs capture --recipe recipes/morris-camera-grammar.sample.json
CARTONBOOK_VIA_PIPELINE=1 node src/cli.mjs capture --recipe recipes/morris-camera-grammar.sample.json
```

Manifest 每镜：`cameraFamily` · `captureClean` · `airshipView`（仅飞艇）。

### TigerMessenger 参数速记

| 字段 | 含义 |
|------|------|
| `dist` | orbit 拉距（越大越「远」） |
| `fov` | 垂直 FOV；↑≈广角膨胀，↓≈长焦压缩 |
| `pitch` | rig：`+` 俯，`-` 仰（立面纪念碑用负值） |
| `orbit` | 绕目标方位；变号＝换侧面 |
| `landmark` | `bookshop` / `morrisIsland`（及 `morris`/`morris-town`）等 |

游戏无真实虚化：用 **前景占幅 + 中远分层 + FOV** 暗示景深。

---

## 1. 族简报

### 1.1 `panorama` — 全景

| 项 | 内容 |
|----|------|
| **电影等价** | **ELS**（Extreme Long Shot）+ **wide-angle** + high/eye 微俯；建立镜头 / aerial establishing |
| **Edena 页角色** | 全页 splash、封面、告别风景、主题图 |
| **为何** | Reactor/CAF 页：人极小、地平线主导、静默；地方 ≫ 人 |
| **`__tm` 配方** | `dist` **28–40**（默 34）；`fov` **70–75**（默 72）；`pitch` **+0.35–0.50** 或 high elev；`orbit` 小幅；landmark 城镇簇 |
| **构图** | 地平线下 1/3～中线；城镇簇画心偏下；天空/湖大比例；曲地平可入画；**无 HUD** |
| **何时不用** | 需要读表情/招牌字；交互距离；已有一格同页全景再堆第二格（节奏变稀） |
| **检查清单** | □ 人高 ≤15% 画幅高 □ 看得出地理 □ 无遥控/任务条 □ 静默或极少字 |

### 1.2 `cinematic` — 镜头感（场所）

| 项 | 内容 |
|----|------|
| **电影等价** | **LS / MLS** + **normal lens** + **eye-level 偏低**；可选水面倒影；偶发 **low-angle** 立面（全章≤1，靠负 pitch，不另开族） |
| **Edena 页角色** | 场所建立、抵达中带、静场廊/水、环境情绪 |
| **为何** | 眼高仍使「全身小于房间/立面」；倒影与引导线给情绪，不是轨道自拍 |
| **`__tm` 配方** | `dist` **14–18**（默 16）；`fov` **55–60**（默 58）；`pitch` **≈0～+0.06**（仰拍立面例外 **-0.08～-0.15**）；站位偏低贴水/堤 |
| **构图** | 三分地平；堤/廊作 leading line；下半可留倒影；人 ≤35% 或不出镜 |
| **何时不用** | 封面 ELS；近景插入（改用 `macro`）；主观驾驶（改用 `airshipPilot`） |
| **检查清单** | □ 「遥控」不可见 □ 有场所情绪（水/廊/立面）□ 非第二次低机位仰拍 □ 非大脸 |

### 1.3 `macro` — 微距（近摄）

| 项 | 内容 |
|----|------|
| **电影等价** | **CU / ECU** + **macro / close-focus**；极近主体，浅景深感靠前景放大 |
| **Edena 页角色** | 近景插入格（门把手、招牌字、**前景花丛**）；「证明就是这里」 |
| **为何** | REPAIRS/墙屋叠页的中条插入；用户参考：低机位、花满近景、人在中径、建筑/柏树在远 |
| **`__tm` 配方** | `dist` **3–6**（默 4.5）；`fov` **40–50**（默 46）；机位**极低**（`pitch` 微俯 **+0.08～0.18** 或相机 elev 很低）；站在花带/路径前景侧 |
| **构图** | 前景花/草/物占下缘 25–45%；中景人在路径；远景建筑或树成剪影层；禁 HUD |
| **何时不用** | 封面；连续两格近景；大脸特写；尚无建立场所就插入 |
| **检查清单** | □ 前景主体可读 □ 中远分层清楚 □ 邻格计划用 `tele`/`cinematic` 拉开 □ 全章近景插入 ≤1–2 |

### 1.4 `tele` — 长焦（与微距成对）

| 项 | 内容 |
|----|------|
| **电影等价** | **Long / telephoto**：空间压缩、平面叠近、隔离主体（Adorama / de Vries lens language） |
| **Edena 页角色** | 近景插入**之后**的拉开、路径凝视、启程「人与镇仍贴在一层」 |
| **为何** | 焦段语言两端：`macro` 走进触觉，`tele` 把世界压回平面情绪；避免只会「拉 dist」假装远 |
| **`__tm` 配方** | `dist` **18–28**（默 22）；`fov` **36–45**（默 40）；`pitch` **+0.06～0.20**；orbit 可跟路径单调增加 |
| **构图** | 人与远景建筑「贴」在一起；少天空膨胀；主体落在三分交叉；背景层压缩 |
| **何时不用** | 需要展示广阔地理（用 `panorama`）；需要前景花墙（用 `macro`）；广角史诗感 |
| **检查清单** | □ FOV 明显窄于 cinematic □ 平面有压缩感 □ 非又一张宽角风景 □ 无 HUD |

### 1.5 `airshipPilot` — 飞艇驾驶员 POV

| 项 | 内容 |
|----|------|
| **电影等价** | **Subjective / pilot POV**；wide-ish first person（FOV 82）；隐藏自身/艇体 |
| **Edena 页角色** | 旅程 / 送信路上 / 启程「特殊视野」——整章 **0–1** 次 |
| **为何** | 用户截屏3：Q 召唤、F 登艇、C 驾驶员；BD 里偶发第一人称打断观察距离，故必须「特殊」 |
| **`__tm` 配方** | `airshipRide.summon()` → `forceBoardForCapture()` → `setViewMode('pilot')`；FOV **82**；`firstPerson`；藏艇体与角色 |
| **回退** | API 缺失时派发 KeyQ/KeyF/KeyC（脆弱，日志注明） |
| **构图** | 地平 + 远景建筑；无 HUD/提示条 |
| **何时不用** | 场所建立；近景插入；需要第三人称看见飞艇本身；一章已用过 POV |
| **检查清单** | □ manifest.`airshipView` □ 艇体不可见 □ capture-clean □ 邻格回到观察者机位 |

---

## 2. 与旧 preset / Edena 弧的关系

| 旧 preset | 优先升级为 | 说明 |
|-----------|------------|------|
| `cover` / `high` | `panorama` | ELS 意图 |
| `wide` / 低机位场所 `medium` | `cinematic` | 场所 + 可选一仰 |
| `close` | `macro` | 真正近摄，不是 medium-近 |
| （无） | `tele` | 窄 FOV 压缩，不是只加 dist |
| （无） | `airshipPilot` | 主观 POV |

章弧提示（书店镇 / 湖镇通用）：

`panorama`（封面）→ `cinematic`（抵达/静场）→（唯一）`macro`（插入）→ `tele`（拉开）→ `panorama` 或 `airshipPilot`（启程）

---

## 3. Edena 页角色速查

| Edena 用途 | 族 |
|------------|----|
| 主题图 / 封面 | `panorama` |
| 场所建立 / 静场 | `cinematic` |
| 近景 / 细节插入 | `macro` |
| 拉开 / 路径凝视 | `tele` |
| 旅程特殊 | `airshipPilot` |

细资产表仍见 [`BOOKSHOP-CAMERA-STORY.md`](./BOOKSHOP-CAMERA-STORY.md)；相机**为什么**见 [`EDENA-CAMERA-STUDY.md`](./EDENA-CAMERA-STUDY.md)。

---

## 4. 飞艇自动化

```js
const ride = window.__tm.airshipRide;
ride.summon();
ride.forceBoardForCapture(); // { ok, state:'flying', viewMode:'passenger' }
ride.setViewMode('pilot');
```

正常游玩仍用 Q/F/C；`forceBoardForCapture` 仅截屏快进。

---

## 5. HUD 零容忍（与镜头族同等硬）

正式镜拍摄前必须 `setCaptureMode(true)` / `?cartonCapture=1`。  
反例：minimap、quest/letter、中央「按 R 接信」、底栏 WASD、`#tm-perf-probe` fps、bubble-crosshair、遥控。  
完整选择器与 CSS 强制见 [`CAPTURE-CLEAN.md`](./CAPTURE-CLEAN.md)。

## 6. 源与延伸阅读

- NYFA: [12 Camera Shots](https://www.nyfa.edu/student-resources/12-most-popular-camera-shots-actors-should-know/)  
- CCSU: [Cinematography — shot sizes](https://www.ccsu.edu/cinemastudies/cinematography)  
- Adobe: [Camera shots and angles](https://www.adobe.com/creativecloud/video/production/cinematography/camera-shots-and-angles.html)  
- Adorama: [Language of Lenses](https://www.adorama.com/alc/language-of-lenses-in-cinematography/)  
- Pieter de Vries: [Lens Perspectives](https://pieterdevries.com.au/2021/06/25/lens-perspectives-the-field-of-view/)  
- Reactor: [The Real Magic of Moebius' Edena](https://reactormag.com/the-real-magic-of-moebius-edena/)  
- CAF: *Sur l'étoile* p.20 horizon page notes（见 `EDENA-STUDY`）
