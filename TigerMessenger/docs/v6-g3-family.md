# V6-G3 · Family builders 与单簇样片

日期：2026-08-22  
负责人：Grok  
级别：**TESTED**（不是 DEFAULT_ON / VISUAL_ACCEPTED）  
命令：`node tools/test_v6_g3_family.mjs`  
seed：`7`

## 做了什么

47 个目录项仍是语义模块。成品几何由 `FAMILY_BUILDERS` 按 irregular quad frame + sockets 生成。  
Prop 独立于结构：slot → 坡度/净空/遮挡过滤 → 占用 → 禁止同一 facade 连续四个相同。

**全城 `presentationMesh` 仍是 Box/Cone。** 只交付单簇样片（数据 + SVG + 可选 Three Group `citadel-v6-cluster-sample`）。等主人确认再全量迁移。

## 数字

| 项 | 值 |
|---|---|
| 簇格数 | 133 |
| solids | 698 |
| props | 204 |
| hash | `17ca1ad7` |
| neverSelected props | （空） |
| 簇内未抽中 family | flowerTile / hole / stairs / support（demo builder 仍覆盖） |
| 默认开关 | 全关 |

样片：`tools/out/v6-g3-planDay.svg` 等昼夜平面/立面、剪影、结构线、花砖。

## 回滚

不接 `loadCitadel`。关掉求解器也不影响 legacy 镇体。确认前不要把 `buildTownV4Mesh` 换成 familyMesh。

## 请主人确认

看 `tools/out/v6-g3-*.svg` 与 `v6-g3-cluster.json`。通过后再把 family 几何铺到全城。
