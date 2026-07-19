# 世界古典美术拟生平台 · Living Classical Art

> 为世界古典美术中的人、动物与环境进行生态模拟 —— 画中的生物与植物都是**自主智能体（Autonomous Agents）**，
> 平台吸收当代最强的拟生（Artificial Life / Behavioral Animation）技术，让古画"活"过来。

首个场景：**《竹虎溪涧图》** —— 以狩野山乐《竹虎图》的斑斓猛虎为主角，
竹林与雪景溪涧的环境取自东京国立博物馆藏·雪舟《四季花鸟图》屏风的溪涧意趣。

## 核心理念

平台智能体设计致敬 Tu & Terzopoulos 的经典论文 *Artificial Fishes: Physics, Locomotion, Perception, Behavior*
（本仓库理念参考，见 `docs/references`）：将每个生物**整体建模为自主智能体**，
具备 感知（Perception）→ 行为决策（Behavior）→ 运动控制（Locomotion）的完整闭环，
不做关键帧脚本，动作由状态机与环境交互涌现：

- **猛虎**：骨骼驱动的整体皮肤（SkinnedMesh）+ 猫科对角步态 + 路径巡游/驻足状态机，尾部链骨可缠竹
- **竹林**：Cannon.js 刚体 + 竹脚球铰约束 —— 虎身经过时被撞开，弹性回正；风扭矩按风向摇摆
- **天气**：温度决定雨雪（>0℃ 雨丝 / ≤0℃ 落雪），风向统一驱动雨雪飘移与竹摆
- **物种关系矩阵**：在配置页以"捕食 / 警戒回避 / 互利 / 竞争"等关系配置智能体间作用（对应论文中的 predator–prey、fear/hunger 驱动模型）

## 技术要点

### 虎：整体皮肤 + 骨骼 + 壳层皮毛
- **统一网格**：躯干/颈/吻为一根 64 环高细分管（轮廓按解剖逐环缩放：颈细、胸隆、腹垂、胯圆、尾收），四肢为附接管，合并为单一 `BufferGeometry`，`computeVertexNormals()` 平滑着色，无拼接断缝
- **骨骼层级（22 根）**：Root → 脊椎三段（Pelvis/Mid/Chest）→ Neck/Head/Jaw；四肢各三段（髋/膝/爪）；尾三段
- **顶点权重**：按解剖区间精确分配，关节处线性插值过渡（腿根 60% 腿骨 + 40% 脊椎），皮肤随骨骼拉伸无"竹节"断裂
- **猫科步态**：对角步态（占空比 0.65），趾行关节方向正确 —— 前肢肘只向后弯，后肢 Z 形（膝前凸、飞节后折），摆动期折叠、支撑期舒展
- **壳层皮毛（Shell Texturing）**：基础网格外克隆 N 层壳（可配 2~24 层），`onBeforeCompile` 注入顶点着色器沿法线逐层膨胀，高频噪声 `alphaMap` 越外层越稀疏，随骨骼同步变形
- **物理**：躯干为 Cannon kinematic 刚体（双球近似），沿路径驱动，推挤竹竿的碰撞由物理引擎解算

### 竹：刚体 + 球铰
每根竹是 Cannon 动态刚体（Box），竹脚以 `PointToPointConstraint` 球铰锚定地面；
回正采用**速度级 PD 控制**（角速度向"回正轴 × 刚度"混合），碰撞冲量自然保留 —— 虎推开、松手弹回。

### 天气系统
配置页"天气"栏独立：温度（>0℃ 下雨 / ≤0℃ 下雪）、降水强度（控制粒子密度）、风力、风向（0=北 90=东）。
雨为倾斜线段雨丝，雪为飘点，落地判定用物理地形 Heightfield。

### 地形与物理
`physics.js` 统一 Cannon 世界：地形由解析高度场采样为 64×64 `Heightfield`，
竹、虎、（预留的）岩石统一在同一物理时空解算；雨雪落地复用同一高度数据。

## 项目结构

```
TigerInBamboo/
├── backend/                 # Python 后端（FastAPI）
│   ├── main.py              # 静态托管 + /api/config 配置读写（含旧配置迁移）
│   └── requirements.txt
├── frontend/                # Three.js 前端（ES Modules，CDN 引入 three）
│   ├── index.html           # 3D 场景：竹虎溪涧
│   ├── config.html          # 系统配置页（场景/天气/虎/锦鸡/视觉/生态关系）
│   ├── assets/vendor/       # cannon-es.js（本地化物理引擎）
│   ├── css/style.css
│   └── js/
│       ├── config.js        # 默认配置 + API 读写（离线回退 localStorage，含旧版迁移）
│       ├── physics.js       # Cannon 世界：地形 Heightfield、刚体注册、定步长推进
│       ├── environment.js   # 金笺纸天光、雾、雪地、溪涧、岩石、雨雪粒子
│       ├── tiger.js         # 猛虎：统一网格、骨骼、权重、壳层皮毛、步态、缠竹尾
│       ├── bamboo.js        # 竹林：Cannon 刚体 + 球铰 + 速度级 PD 回正
│       ├── plants.js        # 菖蒲、芦苇
│       ├── scenery.js       # 布景（预留：图转 3D 装饰模型）
│       ├── ui.js            # 视角预设与界面
│       └── main.js          # 启动与主循环（行为 → 物理 → 同步）
├── tools/                   # 图转 3D 实验（TripoSR、浮雕、GLB 预览）
├── docs/references/         # 参考论文与画作出处说明
├── LICENSE
└── README.md
```

## 快速开始

```bash
# 1. 安装后端依赖（建议虚拟环境）
python3 -m venv .venv && source .venv/bin/activate
pip install -r backend/requirements.txt

# 2. 启动服务
cd backend && uvicorn main:app --reload --port 8000
```

- 3D 场景：<http://localhost:8000/>
- 系统配置：<http://localhost:8000/config.html>（修改保存后刷新场景页生效）

## 系统配置项

| 栏目 | 参数 |
|---|---|
| 场景 | 竹林密度、雾气浓度、金笺纸底色 |
| 天气 | 温度（>0℃ 雨 / ≤0℃ 雪）、降水强度、风力、风向 |
| 猛虎 | 巡游速度、巡游范围、斑纹对比度、皮毛长度、皮毛层数、尾巴缠竹 |
| 锦鸡 | 启用、警戒距离、归返距离、饮水间隔、避险停留（预留，暂未上场） |
| 视觉 | 初始机位（全景/随虎/溪涧）、水墨勾线（预留） |
| 物种关系 | 主体-客体-关系-内驱力-强度矩阵 |

## 技术栈与拟生路线

| 层 | 当前实现 | 规划引入的前沿技术 |
|---|---|---|
| 渲染 | Three.js（PBR + 顶点色斑纹 + 壳层皮毛） | 体积雾、光线步进、风格化 NPR（水墨勾线） |
| 运动 | SkinnedMesh 骨骼驱动、程序化猫科步态、链式尾骨 | IK 全身解算、肌肉-骨骼物理（论文式 motor control） |
| 物理 | Cannon.js（地形 Heightfield、刚体竹、kinematic 虎） | 虎全刚体运动、雨雪与岩石碰撞堆积 |
| 行为 | 感知驱动有限状态机（巡游/驻足/警戒） | Steering Behaviors、Boids 群体、强化学习动作策略 |
| 生态 | 物种关系矩阵（捕食/警戒/互利/竞争） | 饥饿-恐惧-繁殖内驱力模型、生态系统涌现模拟 |

## 参考

- 狩野山乐《竹虎图》（猛虎形象与斑纹意趣）
- 雪舟《四季花鸟图》屏风（东京国立博物馆藏，雪后溪涧构图）
- Tu, X. & Terzopoulos, D. *Artificial Fishes: Physics, Locomotion, Perception, Behavior*（智能体框架与物种关系设计）
