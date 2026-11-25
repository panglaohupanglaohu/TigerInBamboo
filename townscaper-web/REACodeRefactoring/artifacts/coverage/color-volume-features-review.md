# HSL色彩范围 · 三特征HSL域+离散采样 · 浏览器实景验收 · 2026-11-24

clip 1710031224838771027（515帧已全核，见 color-lab-review.md）。本批补上轮残差「浏览器实景验收」：在真实消费者页 `index.html?scene=fusion&punch=0`（本机 Chrome + swiftshader）跑真 GPU，脚本 `tests/color-volume-features-browser.cjs`，数据 `artifacts/coverage/color-volume-features-browser.json`，截图 `color-volume-feat-{mode3,roofonly,steps4}.png`。

## 实测结果（全过）

- **mode-3 真编译真渲染**：onBeforeCompile 捕获的 fragment 含 `uColorVolumeOn>2.5`/`featVolumeSample`/`cvQuant`，uFeatVolMin/Max 数组长度=3，0 program diagnostics、0 console/page error；on vs off 差 91505px。
- **三特征分桶不串色**：RED↔GREEN marker 掩膜 ground=35076 / roof=22670 / cliff=33759px，两两重叠 0。逐特征改 HSL 域：changed 像素恰好 = 自身掩膜（ground 35076 / roof 22670 / cliff 33759），掩膜外 0px、串入其他特征掩膜 0px。默认发货态（surfaceShadow 0.55 + shrubtex + cloudShadow 全开）下复核 roof：changed=22670、掩膜外 0 —— 隔离不是中性态假象。
- **steps 阶梯色带**：textureOnly 直出 albedo，掩膜内唯一色 连续=2614 → steps=4 仅 35（ground 12 / roof 13 / cliff 10）→ steps=12 为 221，量化吸附在 GPU 上真实生效。
- **确定性**：同参重渲 0px 差、重设同参 0px 差；整页重载后同参渲染 SHA-256 一致（0px 差）。world.version 与 geometry 引用全程未变（色容只动 uniform）。

## 测量口径（如实说明）

- 渲染进 640×400 WebGLRenderTarget（无 MSAA），只留世界网格+灯光；表面阴影/灌木纹理/云影三个默认开启的正交调制器在量化与确定性测量时置 0，量完还原并按默认态复测隔离。
- 跨重载确定性曾两次不稳，定位到两个真实陷阱并已在测试内固定：① `shadowMap.autoUpdate=false` 阴影图只在 sunDir/target 变化时重画，可能烘在半成品几何上 → 每次 capture 前强制 `shadowMap.needsUpdate`；② headless 下 uTime 可能冻结在 pop 动画半途位姿冒充"已稳定" → 测量前把 uPops 全部过期（w=-1e9）。稳定判据= world.version 停涨 + 连续两帧逐像素一致。
- steps=12 上界按 u,v,w 各 12 档 × 3 特征桶计（≤12³=1728），实测 221 合理。

## 卡点·B（原作工具不可复现）

原片展示的是 Unity 编辑器内调色面板交互（五特征 H/S/L 范围拖动、离散预览格）。本仓无法运行原作编辑器，交互侧（拖点/面板操作流）未复现、不宣称等价；本次验收限于输出侧 GPU 行为：分桶采样、离散量化、确定性。`where` 仍为本地实现路径。
