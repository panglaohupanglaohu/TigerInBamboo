# Edena 六条落地对照（vs 旧 bookshop-letter 样章）

日期：2026-11-04（Asia/Shanghai）  
样章 URL：http://127.0.0.1:8787/chapters/bookshop-letter/book.html  
画面：`layout-only` + `chapters/_fixtures`（本游戏验收截屏，`realCapture: false`）

## 相对旧样章改了什么

| 项 | 旧 | 新 |
|---|---|---|
| 封面 | 有独立页眉 + 下方大段 meta/气氛句 | 整幅宽景框 + **细题带**（左书名右署名）；**无对白**；`dist=36` 强调小人 |
| 内页栅格 | `wide-plus-two` / `panels-4` / `panels-3`（偏双列/多格） | **竖向横幅叠放**：`edena-stack-3`、`edena-close-insert`、`edena-banner-pair`；CSS 把旧九宫类也降级为单列竖条 |
| 顶栏 | `.page-header` 独立抢戏 | **隐藏**；章题用 `.strip-title-bar` 叠在**顶条画面内**（左题右署名） |
| 景别 | 远/中/近较随意堆叠 | 章弧：**宽镇景 → 眼高仍小 →（唯一）低机位立面 → 静场 → 交互 →（唯一）门/招牌近景插入 → 拉开 → 背影 → 路径高位 → 风景小人** |
| 文字 | 多数格有旁白，气泡偏多 | 每格≤1 短旁白；仅 2 个小气泡（店主/信使）；多处静默格 |
| 页边/gutter | `--gap:14` `--margin:28` | `--gutter:18` `--page-pad:40` |
| 书壳导航 | 实心 pill 偏重 | 细线透明按钮，减 chrome |

## 页映射

1. **封面** `cover` — 规则1  
2. **抵达** `edena-stack-3`：s01 宽 / s02 眼高仍小 / s03 低机位立面（全章唯一）— 规则2+3+5  
3. **取信** `edena-close-insert`：s04 静场 / s05 交互+气泡 / s06 近景插入 / s07 拉开 — 规则3+4  
4. **启程** `edena-banner-pair`：s08 转身 / s09 路径 / s10 小人于景 — 规则2+6  

## 文件

- 研习：`docs/EDENA-STUDY.md`  
- 样式：`layouts/edena.css`  
- 模板参考：`layouts/page-templates/edena-*.html`  
- 配方：`recipes/bookshop-letter.sample.json`  
- 排版器：`src/layoutEdena.mjs`（封面题带、顶条内章题、无独立页眉）

## 未做 / 限制

- 本轮未 live 截屏（fixtures）；景深与「人高 5–20%」依赖后续真机位拍摄兑现 `camera` 字段。  
- 未引入文生图；未复制受版权 Edena 页像素。
