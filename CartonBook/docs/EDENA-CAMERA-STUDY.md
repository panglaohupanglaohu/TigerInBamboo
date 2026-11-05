# Edena 镜头研习（相机语言，不只是排版）

> 诚实声明：本稿**未翻开纸质《The World of Edena》原书**。依据为仓库已有公开页笔记（`EDENA-STUDY.md`）+ 可核验的公开评述/预览页，再对照纽约电影学院（NYFA）及标准电影摄影教材中的景别·机位·焦段语言，写成 **CartonBook 可执行的机位简报**。  
> 画面交付仍只能是 Tiger Messenger **游戏截屏**，禁止文生图 / 复制受版权页像素。

相关：[`EDENA-STUDY.md`](./EDENA-STUDY.md) · [`CAMERA-GRAMMAR.md`](./CAMERA-GRAMMAR.md) · [`BOOKSHOP-CAMERA-STORY.md`](./BOOKSHOP-CAMERA-STORY.md)

---

## 1. 公开 Edena 页证据（已命名来源）

| 公开参照 | 我们看到的「相机」行为 | 对 CartonBook 的含义 |
|----------|------------------------|----------------------|
| **Reactor**《The Real Magic of Moebius' Edena》述 *Upon a Star* / ligne claire：卡通人物 vs 高度写实背景 | 环境被画「满」、人被画「轻」；景深靠线与留白而不是对白 | 封面 / 主题格：**地方 ≫ 人**；人高约画幅 5–20% |
| **CAF / ComicArtFans** *Sur l'étoile* p.20：水平地平线几乎贴格边；日落长影；车与两人极小 | **ELS + 眼高或微俯**；负空间即叙事；地平线当「第二格边」 | `panorama`：宽地平、静默、无 HUD |
| **Dark Horse 预览「REPAIRS」叠页**（`EDENA-STUDY`）：3–4 层竖条，宽→中→近/拆分 | 同页内 **改尺度**（景别阶梯），不是换故事 | 内页竖条：宽建立 → 眼高仍小 → **一次**近/细节 → 再拉开 |
| **纪念碑感页**（研习表）：低机位，主体占上 2/3，人在脚下 | 电影 **low-angle** 赋予建筑权力，不是炫技 | 全章 ≤1 次立面仰拍（负 pitch） |
| **建筑墙/屋叠页**：顶条小人远景；中条插入近景；底条再拉开 | 近景是 **ECU/细节插入**，插入后必须退回空间 | `macro` 只做「插入」；邻格用 `tele`/`cinematic` 拉开 |
| **室内 / 机械通道**：眼高全身仍小于房间；或略俯人极小、静默 | MS/MLS 仍服从「地方大于人」；静默格合法 | `cinematic` 可静场；勿堆气泡 |

共性（来自页，而非臆造）：**矩形格、大留白、地方大于人、文字极省、景深分层（前空 / 中人 / 远建）、标题可嵌顶条内。**

评述补充（非页像素，作语境）：PanelPatter / Reactor 强调 Edena 用画风与空间尺度服务情绪——我们只借其「尺度即叙事」，不抄画面。

---

## 2. 电影摄影坐标系（NYFA / 标准教材）

以下用于给 Edena 页「命名」，便于 recipe 与 `__tm` 参数对齐。

### 2.1 景别（Shot size）

来源：[NYFA — 12 Camera Shots](https://www.nyfa.edu/student-resources/12-most-popular-camera-shots-actors-should-know/)；[CCSU Cinema Studies — Cinematography](https://www.ccsu.edu/cinemastudies/cinematography)；SJSU cinematography lecture（ELS→ECU 序列）。

| 代号 | 名称 | 人在画幅中 | Edena 页常见用法 |
|------|------|------------|------------------|
| **ELS** | Extreme Long Shot | 人≈点/剪影，环境主导 | 全页 splash、封面、告别风景 |
| **LS** | Long / Wide Shot | 全身可见，环境仍大 | 抵达顶条、路径 |
| **MLS** | Medium Long | 膝以上 | 眼高「仍小」的靠近 |
| **MS** | Medium | 腰以上 | 交互距离（少用；BD 仍偏宽） |
| **MCU** | Medium Close-Up | 胸肩以上 | Edena **慎用**（易变美漫对话格） |
| **CU** | Close-Up | 头/等效物 | 仅「物」插入（门、招牌），禁大脸 |
| **ECU** | Extreme Close-Up | 局部细节 | 花、把手、字面——对应 `macro` |

### 2.2 机位角（Angle）

来源：[Adobe — camera shots and angles](https://www.adobe.com/creativecloud/video/production/cinematography/camera-shots-and-angles.html)；漫画相机惯例综述（low/high/POV）。

| 角 | 效果 | Edena / CartonBook |
|----|------|-------------------|
| Eye-level | 中性陪同 | 多数「场所」与路径 |
| High / bird’s | 地理、脆弱、地图感 | 路径高位、曲地平线俯瞰 |
| Low | 权力、纪念碑、压迫 | **唯一**立面仰拍 |
| Dutch | 不安、失衡 | **默认不用**（与 ligne claire 静宁冲突） |
| Subjective / Pilot POV | 代入角色视觉 | 仅旅程「特殊」格（`airshipPilot`） |

### 2.3 焦段语言（Lens）

来源：[Adorama — Language of Lenses](https://www.adorama.com/alc/language-of-lenses-in-cinematography/)；[Pieter de Vries — Lens Perspectives](https://pieterdevries.com.au/2021/06/25/lens-perspectives-the-field-of-view/)；SJSU lecture（短焦加深空间 / 长焦压缩平面）。

| 焦段感 | 光学效果 | 叙事 | CartonBook 族 |
|--------|----------|------|----------------|
| **Wide** | 空间膨胀、近大远小、深景 | 旅程、史诗、人被环境吞没 | `panorama`（FOV↑） |
| **Normal** | 近似人眼透视 | 场所、步行眼高 | `cinematic` |
| **Tele / long** | 平面压缩、隔离主体、浅景深感 | 孤独、凝视、拉开后的「仍在镇上」 | **`tele`** |
| **Macro / close-focus** | 极近主体、前景占画、背景退为层 | 触觉细节、证明「就是这里」 | **`macro`** |

游戏相机没有真实光圈虚化：用 **近大远小分层 + FOV + dist** 模拟「浅」——前景花草顶满下缘，中景人，远景建筑/柏树。

### 2.4 构图工具

来源：Adobe composition；Cinemastery framing（三分法、引导线、前景框）。

- **Rule of thirds**：地平线放上/下三分，勿默认横切正中（*Sur l'étoile* p.20 的「贴边地平」是刻意例外）。  
- **Leading lines**：坡道、堤岸、廊柱把视线送到门或人。  
- **Foreground frame**：花丛、门洞、绳、栏杆——制造深度，而不是装饰。  
- **Negative space**：至少一格接近「空」——Edena 的呼吸。

### 2.5 运动与主观 POV（截屏多为静帧）

NYFA/教材：运动服务动机（跟随、揭示、主观）。CartonBook 以**静帧**为主：

- 不靠运镜炫技；靠**景别阶梯**讲「到→取→走」。  
- **Pilot / subjective POV**（`airshipPilot`）一章宜 0–1 次：过度使用会破坏「观察者」BD 距离感。

---

## 3. Edena 页类型 → 电影参数映射

| Edena 页类型（研习表） | 景别 | 角 | 焦段感 | 为何 | CartonBook `camera.family` |
|------------------------|------|----|--------|------|----------------------------|
| 全页 splash / 封面 | ELS | 微俯或眼高 | Wide | 地方先于故事；人剪影 | `panorama` |
| 抵达竖条顶带 | ELS→LS | 眼高/微俯 | Wide→Normal | 建立地理 | `panorama` 或 `cinematic` |
| 眼高全身仍小 | LS/MLS | Eye | Normal | 人仍小于建筑 | `cinematic` |
| 纪念碑立面（≤1） | LS | **Low** | Normal/略 Wide | 建筑权力 | `cinematic` + 负 pitch（专用，勿另造族） |
| 静场廊/水 | LS | Eye 偏低 | Normal | 情绪场所、倒影 | `cinematic` |
| 近景插入（门/花/字） | CU/ECU | Eye / 极低 | Macro close-focus | 触觉证据；其后必拉开 | **`macro`** |
| 拉开 / 路径压缩 | LS | Eye / 微俯 | **Tele** | 压缩镇与人；「还在路上」 | **`tele`** |
| 告别风景 | ELS | 微俯 | Wide | 人回剪影 | `panorama` |
| 旅程特殊（飞艇） | POV | Subjective | Wide-pilot (FOV82) | 代入驾驶；特殊格 | `airshipPilot` |

---

## 4. 对旧「浅 preset」的批评 → 新语法要求

旧风险：把 `cover/wide/medium/close` 当随机轨道半径，**没有景别意图**。  
新要求（见 `CAMERA-GRAMMAR.md`）：

1. 每镜先选 **Edena 页职责**，再选 **family**。  
2. family 必须写清：电影等价名、`__tm` 的 FOV/dist/pitch、何时**禁止**用、检查清单。  
3. `macro` ↔ `tele` 成对：长焦压缩与微距近摄是同一套「焦段语言」的两端，不是两个装饰滤镜。  
4. 正式格 **capture-clean**（含「遥控」`#touch-toggle`）。

---

## 5. 自检（研习是否进了拍摄）

1. 静帧序列能否无旁白读出「到→取→走」？  
2. 是否只有一格近景插入、一格低机位仰拍？  
3. 封面是否 ELS + 地方≫人？  
4. `macro` 是否前景占满、中远分层清楚？  
5. `tele` 是否平面被压缩、主体被隔离？  
6. `airshipPilot` 是否整章 ≤1，且真是主观 POV？  
7. 像素是否来自本游戏截屏？
