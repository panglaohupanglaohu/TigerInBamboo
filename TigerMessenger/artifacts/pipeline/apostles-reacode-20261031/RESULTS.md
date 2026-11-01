# 十二门徒 · REACodeRefactoring 重建（apostles-reacode-r2）

生产路径：`seaStackTerraces` → `buildTwelveApostlesReacodeSteps`（`src/world/apostlesReacode.js`），失败或 `?apostlesReacode=0` 时回到 10-13 目标版 `buildTwelveApostlesTarget`。原文件未删。

## 保留
九个岩群的构图（APOSTLE_MASSES：轨道站位 s / 横距 d、lobe 层级、审定高度表）、轨道 / 城镇 / 保护体净空检查、海面锚点。

## 换成重构版管线（vendor 文件未改）
- 网格 `core/grid.js` 不规则四边形（每个岩群一张），体素 `core/world.js`（岩石列，12 层，3.2 m/层）
- 高度：lobe 高度场 + 重构版 fbm 轮廓噪声 → 量化 → 去尖刺；台地边缘用连续噪声降一层成肩（不是逐格随机，避免锯齿）
- 湾内石柱：用原 sampleApostleLobes 的台阶/肩，再加一块低矮附属礁
- `terrain/features.js`：大岩群悬挑 3 + 天然石拱 1；关闭海中细石柱（此比例下被平滑成细杆）
- `world/worldmesh.js`：层级平滑 + 笼形变形、沉积线、草皮垂边、软法线、AO + 彩色反弹光烘焙
- 岩壁按高度加低频冷灰 / 贝壳珊瑚 / 浅米色带（目标图岩层色）
- `world/outline.js` 墨线（逆光亮边关闭）；`water/shore.js` 浪裙 + 循环岸浪（加宽、加白）
- `life/vegetation.js` 草、花、灌木、团块树
- 全部几何、岸浪、植被弯到球面（y -= r²/2R），壁脚延伸到水下 7 m

## 性能处理
- 灌木 / 树用低面数副本（灌木 400→100 三角，树 1600→400），去掉灌木 / 树的反向外壳
- 距离 LOD：草和花只在近处，灌木和树中距离，墨线 r+160 m 内
- 按岩群分步 yield，加载界面不再一次卡住整段构建

## 数据（cloud SwiftShader harness，同相机全景）
| | 旧（10-13 目标版） | 新 |
|---|---|---|
| 岩体三角形 | 83k | 76k |
| 全景可见三角形（不含海面、轨道） | 149k（岩 83k + 灌木 43k + 浅滩 16k + 碎石 6k + 浪花 1k） | 288k（岩 76k + 墨线 76k + 植被 101k + 岸浪 35k） |
| draw calls（含阴影） | 56 | 109 |
| 构建时间 | 5.6 s（一次性） | 5.5 s（分 9 步） |
完整游戏内：9 个岩群全部建成，无报错（`scene.userData.twelveApostlesTarget.version = apostles-reacode-r2`）。

## 未做 / 已知
- 岩体本身比旧版轻，但墨线（与岩体等量）和植被让可见三角形约为旧版 1.9 倍（整帧约 3M 三角形中多 ~140k）。如要更省：关墨线可回到 ~212k，或再降灌木 / 树数量。
- 未接 seaStackLighting 的海岸材质（用 MeshStandardMaterial + 烘焙顶点色，受游戏灯光）。

## r3（2026-11-01）：关墨线 + 可编辑
- 墨线关闭（不再创建 OutlineLayers），全景可见三角形约 21 万。
- 每个岩群保留自己的 World；左下建城面板顶部新增「构建对象」下拉：莫西斯湖 / 十二门徒（9 个岩群）。选中后进入建造模式并把镜头对准该岩群。
- 工具：▲ 建造（Townscaper 房子体素，按左侧颜色）、▼ 拆除、■ 刷色、◆ 岩石（地形体素，走地形管线：崖壁 / 层带 / 草皮）；撤销 / 重做按岩群分开。✕ 清空 = 恢复为生成的岩体。
- 不能超过铁轨 / 城镇 / 保护体净空（每格最高层按净空计算）。
- 编辑按岩群存到本机 localStorage（apostles-reacode-edit-v1:<id>），下次进游戏自动还原；网格按岩群 id 固定生成，所以存档能对上。
- 示例场景 / 莫里斯山 / 分享链接 / 命名存档只用于莫西斯湖。
- 实测：拾取 ~2 ms，单格重建 ~140 ms（增量块 + 烘焙），完整游戏里下拉选「前排左台」→ 鼠标划动建了 4 格房子 → 已保存 → 返回玩家视角正常。
