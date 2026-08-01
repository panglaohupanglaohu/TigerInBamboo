# TigerMessenger · 夜色信使

TigerInBamboo 子项目：网页 3D 二次元信使小游戏。  
从主站首页「进入二次元」光点进入，或直接打开本目录。

## 本地试玩

主站后端已挂载静态路径（推荐）：

```text
http://localhost:8931/TigerMessenger/
```

纯静态亦可：

```bash
# 在仓库根
python3 -m http.server 8765
# 打开 http://localhost:8765/TigerMessenger/
```

强制使用本地 `vendor/`（跳过 CDN）：

```text
http://localhost:8931/TigerMessenger/?local=1
```

帧率巡检（标题栏显示 fps）：

```text
http://localhost:8931/TigerMessenger/?fps=1
```

## 操作

| 键 | 作用 |
|----|------|
| `WASD` / 方向键 | 移动 |
| `Shift` | 疾跑 |
| `Space` | 跳跃 |
| 滚轮 / 中键拖动 | 缩放视野（中键左右拖 = 环绕） |
| 靠近发光 NPC | 自动接信 / 送达 |
| `L` | 打开/关闭信袋（送达记忆） |
| `M` | 静音（含垫乐） |

## 技术要点

- **零构建**：原生 ES modules + importmap
- **Three.js r172**：优先 CDN，失败回退 `vendor/`
- **模块结构**

```text
TigerMessenger/
├── index.html          # 入口 / HUD / 启动器（CDN→vendor）
├── PLAN.md / TODO.md
├── README.md
├── vendor/             # three 本地兜底
│   ├── three.module.js
│   ├── three.core.js
│   └── jsm/misc/Timer.js
└── src/
    ├── main.js         # 装配 + 主循环
    ├── core/           # 相机 / 输入 / 常量 / 舞台
    ├── world/          # 平台 / 碰撞 / 环境
    ├── player/         # 控制 / 模型 / 动画
    ├── quest/          # 任务 / NPC
    ├── ui/             # HUD 引用
    └── audio/          # Web Audio SFX + 垫乐
```

## GitHub Pages

本仓库 Pages 从仓库根发布。目标在线地址：

```text
https://panglaohupanglaohu.github.io/TigerInBamboo/TigerMessenger/
```

展厅入口（`frontend/home.html`）使用相对路径 `../TigerMessenger/`，本地 8931 与 Pages 均可解析。

确认：

1. `TigerMessenger/` 已提交（含 `vendor/three.module.js` + `three.core.js` + Timer）
2. push 到 `main` 后等 Pages 构建（约 1 分钟）
3. 若 CDN 被墙：`?local=1` 或启动器自动回退

## 信使记忆

送达记录写入本机 `localStorage`（键 `tm.letterJournal.v1`）。  
`L` 或任务栏「信袋」查看；与主站四层记忆模块解耦，后续若批准可再桥接。

## 分工（见 PLAN.md）

- **Grok**：玩法机制、视觉生成、音频、HUD 逻辑
- **Kimi**：主站整合、风格评审、部署验收
