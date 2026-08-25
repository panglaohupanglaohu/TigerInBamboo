# Planet V8 视觉基线（Kimi 视觉线）

> V8-K0 交付（2026-08-23）。数据真源：`src/render/visualV8/`（cameras-v1.json、
> terrain/water/cloud-palette-v8.json、lighting-v8.json、validateVisualPackageV8.js）。
> 门禁：`node tools/test_planet_v8_visual.mjs`。
> 本文只定义规范；实拍与缺陷单等 Grok 把 V8 接线（WIRED）后按本规范执行。

## 1. 固定镜头与 A/B 命名规范

34 个稳定 camera ID 冻结在 `cameras-v1.json`，分组 4/6/5/4/4/3/3/3/2
（全球/高山/峡谷/苔庭/湖沼/书店/三重门/水体/云）。镜头以 landmarkManifest 稳定 ID 为锚 +
角偏移描述，不写世界坐标，机位任何修正必须升 JSON 版本。
`resolveCameraV8.js`（纯函数）负责把规格解析为球面位姿：相机地面投影方向 =
锚点沿方位角偏出 polar 角，位置 = 该方向 × (planetRadius + heightUnits)，
目标 = 锚点地表，up = 投影点球面外法线；坐标按 1e-6 取整，`cameraManifestPoseHash`
保证"机位改动必然改变 hash"（当前基线 `camc8520c18`）。

截图命名：

```text
{legacy|v8}_{cameraId}_{timeBand}_{weather}_v{n}.png
例：v8_highland-waterfall-l1-horse_sunset_clear_v1.png
```

- `legacy`/`v8` 前缀是 A/B 对；同 cameraId 必须成对存在才可对比。
- `v{n}` 只在 JSON 镜头版本升级时递增；**禁止手动移动机位后覆盖同名基线**。
- 每轮报告落盘 `tools/out/planet_v8_visual/<YYYYMMDD>/`，附 `report.json`（seed、
  cameraId、timeBand、weather、指标）。

## 2. Oskar 参考图观察表

对照主人提供的四张参考图（PLAN.md 第十二章引言），每次视觉报告逐行核对：

| 观察项 | 看什么 | 合格判据 |
| --- | --- | --- |
| 海陆面积 | 全球鸟瞰中海洋为主体、陆块连续 | 陆块占可见面积 28%～42%；无绿色整球从陆地下露出 |
| 丘陵轮廓 | 苔庭/书店连丘的逆光剪影层叠 | 远景至少读出前后两级丘陵轮廓；无矩形 patch 边 |
| 森林团块 | 林缘稀疏、林核密集的团块感 | 森林呈团簇分布，不沿网格/矩形边排阵；与草地灰度可分 |
| 湖岸曲率 | 湖面随星球曲率、岸线连续 | 湖盆闭合、岸线无自交；无平面 Circle/Shape 痕迹 |
| 云层遮挡 | 云与山脉/海的关系 | 迎风坡云增、背风坡减；云不永久遮挡三重门/城堡主体 |
| 色彩层次 | 正午/黄昏/深夜的整体色彩 | 鲜艳但协调；不靠抬全局 ambient 获得艳丽 |

## 3. 视觉报告通道规范

每次视觉报告，每个镜头同时输出 8 通道：

1. `color` — 最终彩色
2. `gray` — BT.709 灰度（tools/lib/colorblindSim.mjs `toGray`）
3. `deuteranopia` / 4. `protanopia` / 5. `tritanopia` — Machado 2009 severity=1.0 模拟
6. `clay` — 去材质纯色照明
7. `normal` — 法线
8. `semantic` / `seam` — 语义分块与 MC 接缝叠图

## 4. 指标规范

每镜头记录：P10/P50/P90 亮度、clipped%、dark%、saturation、海陆 ΔL*、
草/林 ΔE00、深夜局部灯对比。静态色板门槛（已被
`tools/test_planet_v8_visual.mjs` 机器断言）：

- 草/丘/苔/林/岩 noon 两两 ΔE00 ≥ 12；forest/rock 对 grass 灰度 ΔL* ≥ 8；
- 三类色盲模拟后 grass/forest/rock 两两 ΔE00 ≥ 6；
- 海陆 ΔL*：正午 ≥ 18，深夜 ≥ 12（对齐 C7 门槛）；
- 云 night L* ≤ 32 且 ≤ 深夜天空 L*+8；水沫 night L* ≤ 34（深夜不得发白）。

实拍指标在 Grok WIRED 后补记；本规范不替代截图证据。
