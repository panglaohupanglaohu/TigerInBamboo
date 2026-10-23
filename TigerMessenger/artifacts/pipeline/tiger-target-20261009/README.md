# 湖沼虎 V3（2026-10-09）：目标图 → 建模 → 评分

## 目标图（美术）
- `targets/target_side.png`：从用户给的老虎参考图里提取的孟加拉虎侧面，换成游戏配色（coat #CD8F48 / stripe #34333D / ivory #F2E8D3）。
- `targets/target_face.png`：正脸目标。
- `*_cls.npy`：评分用的类别图（0 背景 1 橙 2 墨纹 3 象牙白 …）。
- 提取脚本：`scripts/extract.py`、`scripts/extract_face.py`。

## 评分
`python3 scripts/score.py targets/target_side_cls.npy <render.png>`
- 侧面分 = 50% 轮廓 IoU + 50% 花纹分布（10×24 网格内各颜色比例）。
- 渲染用 `scripts/tiger-lab.html` + `scripts/shoot.mjs`（正交侧面/正面，平光）。

| 版本 | 侧面 IoU | 花纹 | 分数 |
|---|---|---|---|
| 旧游戏虎（V1 拼接体） | 0.502 | 0.499 | 50.1 |
| V3 蒙皮虎 | 0.564 | 0.587 | 57.5 |

注意：参考图是行走中低头的姿态，轮廓分里有一部分是姿态差，不全是造型差。

## 模型（建模）
- `scripts/build_tiger.py` + `scripts/spec.json`：在 Blender 里用 metaball 做解剖体块，再重网格、减面（约 1.4 万三角面）。
- 骨骼：脊柱/颈/头/下颌/耳，四条腿各有肩胛（或髋）、上臂、前臂、掌骨、爪，尾巴 8 节。自动蒙皮权重。
- 导出：`assets/models/tiger-v3/tiger-v3.glb`。
- 花纹：`scripts/patterns.py` 按参考图的条纹规则自己画（没有描参考图）：
  - 侧面投影图：脊背密、肋部像反括号向后弯、髋部转成横纹、腿外侧横纹、尾巴环纹加黑尾尖；
  - 正脸图：白眉斑、眼下白月牙、眼线外角拖成条纹、脸颊双条纹、胡须点、下巴。
  - 输出 `tiger-v3-side.png`、`tiger-v3-face.png`。

## 接入游戏
- 运行时：`src/assets/characters/tigerSkinV3.js`。
  - 新骨骼每帧跟随旧 V1 关节：身体刚体增量；头部跟旧头（加停步张望）；四足按旧脚掌的运动用 IK 贴地（前肘向后、后膝向前）；尾巴是下垂曲线加旧尾巴摆动，再叠加情绪。
  - 尾巴情绪：走路是放松摆动；喝水时平静；站久了变成烦躁横抽；迎接时尾巴平举、尾尖颤动。
  - 耳朵会随机抖动；烦躁时向后压。
  - 旧模型只隐藏不删除：地面求解、脚掌锁定、饮水探针全部照旧。
- 挂载点：`swampTigerV2.js` 末尾自动升级（改前备份在 `source-before/`）。
- `?tiger=classic` 回到旧外观。
