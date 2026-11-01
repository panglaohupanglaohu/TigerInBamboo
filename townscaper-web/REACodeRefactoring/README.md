# REACode 重构版（REACodeRefactoring）

按学习路线重新搭建的系统：**一张网格、一份体素**，Townscaper 的建筑管线和 engine 的地形管线在同一个世界里运行。原来的 `../REACode` 没有改动，可以对照。

## 怎么打开

```bash
./start.sh                 # 或双击「启动.command」，默认 http://localhost:8766
./start.sh --open walk     # 直接打开完整管线示例（town / terrain / fusion / walk / mixed / arch / pipeline / learn / guide）
./start.sh --stop          # 停止
```

页面用 ES module，必须走 http（不能直接双击 html）。`start.sh` 还会把 `../../REA-agent/gifs` 链接成 `gifs/`，这样面板里的 ▶ 能播放原视频。

## 看什么

| 页面 | 内容 |
|---|---|
| `index.html` | 主场景。左上角：网格切换（**四边形 / 三角 + 方格**）、**▶ 完整管线示例**（同一座岛一步加一层，11 步）、场景切换 **小镇 / 地形 / 融合**（都能建造）；右侧面板是「系统全局」+ 各条管线的开关、「去看」镜头、原视频 |
| `architecture.html` | 系统全局：数据流图、每一层的模块、和原 REACode 的对应关系、还没迁移的部分 |
| `pipeline.html` | 判断（Bad North → Townscaper → 第三个项目 / 球面）+ 9 步学习路线 + 四条管线完整图 |
| `learn.html` | 237 段视频的学习笔记：原文、状态、学到什么、代码位置，可筛选、可播放 |

## 操作

左键拖动建造（用当前颜色），右键点击拆掉一块（地形也能挖），右键拖动旋转，中键 / Alt+左键平移，滚轮缩放。
快捷键：`T` 小镇 `G` 地形 `F` 融合 `R` 换种子 `B/E/P` 建造/拆除/刷色 `1–9` 选色 `Z/Y` 撤销/重做 `N` 白天/黄昏/夜晚 `C` 清空 `H` 帮助。
地址栏会自动带上存档字符串（v5），复制链接就能分享整座岛。

## 文档

- `ARCHITECTURE.md`：模块职责、依赖、数据流
- `GUIDE.md`：接手指南（给其他 LLM / 开发者）：规矩、完整目录、学一段视频的流程、接口、坑、下一步
- `PIPELINE.md`：管线与路线的文字版
- `CHANGELOG.md`：每一轮学了哪些视频、改了哪些代码
