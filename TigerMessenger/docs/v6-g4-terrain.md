# V6-G4 · 第一层瀑布地形样片

日期：2026-08-22  
负责人：Grok  
级别：**TESTED**（不是 DEFAULT_ON / VISUAL_ACCEPTED）  
命令：`node tools/test_v6_g4_terrain.mjs`  
seed：`7`

## 做了什么

`extractLowPolySurface` 把 terrain field 变成带语义的低多边形面（台面 + 台地间崖壁 + 缺口瀑布裙）。  
样片范围：台面 0/1 + 第一层瀑布。同一 extract 生成 SurfaceProvider；植被/石/血/单位/道具/水沫都 `attachOnSemanticSurface`。

**生产可见地形仍是 `citadelRange`。** 未换五层台地、港口、苔庭。

## 数字

| 项 | 值 |
|---|---|
| 样片 hash | `51bd6bc2` |
| 面 | 38 |
| 语义 | terrace-top / cliff / waterfall |
| aabbPatches | 0 |
| 瀑布 V 严格单调 | true |
| 默认开关 | `citadelTerrainUvV2=false` |

叠图：`tools/out/v6-g4-geometry.svg`、`uv.svg`、`surface.svg`、`nav.svg`。

## 回滚

不接 `loadCitadel`。Range 未动。确认样片后再把 extract 接到生产网格。

## 请主人确认

看四层叠图。通过后再迁五层台地 / 港口 / 苔庭。
