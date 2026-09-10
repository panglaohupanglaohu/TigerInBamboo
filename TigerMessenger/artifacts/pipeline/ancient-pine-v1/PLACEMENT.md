# 古松 v1：原资产候选与共享放置契约

状态：后台 Blender 候选，未写入 Web / Godot 世界，等待视觉复核。对象是原 `pine` 归档、`createAncientPineTree` 的这一株实例；并未把所有不同种子的松树换成同一棵。

## 输入和变更

- 原始 `assets/models/originals/blender-r3/pine.blend` 与 `assets/models/originals/pine.source.json`；前后 SHA-256 见 report.json，完全未变。
- 概念 `assets/concepts/ancient-pine-target-v1.png`，原作参考 `artifacts/pipeline/saihoji-source-references/ancientPineTree-source-three-quarter.png`。
- 从归档真实几何提取 37 条木段中心线，保留所有端点。原段交界用共有角平分截面和连续半径重接；没有新增枝条、移动枝冠、改变树干走向。
- 29 个原叶团中心仍保留：水平尺寸乘 1.035、厚度乘 0.57，再融合重叠表面成为分层扁冠。保留原 3 个绿色，重新分配为暗底 / 中部 / 亮顶；没有添加逐根松针、高面数写实叶片。
- 对原木色 / 绿色建立独立可导出的 Principled 材质，数值来自源 JSON 线性颜色。原 Toon 阶调与描边属于引擎材质适配，并未声称在 GLB 里完整重现。
- 没有加概念图中的外围石头 / 苔藓，也没有移动根端位置。

## 节点与放置

17 个 `three_node_id` 和全部父级保持。`n0` 为 `giantTreeGroup`；`n1..n7` 是原冠层标记；`n8/n9` 仍为两种树皮批；`n10/n11/n12` 仍为三种绿色批。原静态合并模型没有骨架 / 动画。

Blender 内保留全部原隐藏描边节点；导出 GLB 中 `n13..n16` 保留 ID 和父级，转换为不带几何的 metadata 节点，避免过时轮廓外壳显示。没有新增运行时节点；拍摄灯光和相机只在 Blender 审查场景，不导出。

候选 local 单位与归档一致，不自动居中、不套单位尺寸。Blender +Z 向上，GLB +Y 向上。GLB n0 已带原 1.02 比例及原 yaw，具体 quaternion / scale 见 validation.json；不要再次叠加同一份 factory 变换。

安全回接方式：在原 pine 的 n0 对应实例保留其世界位置 / 球面朝向 / 原实例缩放，仅按 ID 替换 n8..n12 的局部几何；隐藏旧轮廓壳。另一种方式是在原根的父级放置候选，并直接把候选 n0 的 local transform 赋为旧根 local transform，不再乘归档 root transform。恢复时恢复旧几何/可见性，删除候选引用。

源世界在 `src/world/saihoji.js:612` 创建各自 seed 松树，随后应用 `spec.scale * SAIHOJI_PINE_SIZE`，`placeAtLocal` 决定球面朝向、坐标和抬根高度。须保留这些实例参数、pineRole 和碰撞尺寸。候选没有替换松树布局、抬根规则或碰撞。其他 seed 先按各自原归档做同样转换，不能推定此单株候选代表全部外形。

新增 metadata：root 的 candidate_id、source_asset_id、source_factory、optimization_scope、source_blend_sha256、candidate_lod；网格 candidate_geometry、source_node_id；source_visibility_preserved；隐藏描边 candidate_hidden_source_geometry、original_source_type；材质 candidate_palette_source。原 three_userData 保留。

## 验证

- report.json 包含三档三角数、哈希、源矩阵误差、固定相机 / 灯光参数、实际 GLB 五种颜色和 alpha 检查。
- validation.json 来自 validate_glb.py，读真实 GLB accessor，跨两种树皮材质焊接检查闭合性和连通性。三档均单连通，0 边界 / 非流形边 / 退化三角。
- before / after / glb-roundtrip 各有 full-three-quarter、branch-junction、root-detail 三种同相机图。glb-roundtrip 是导出的 GLB 重新导入后渲染，不是仅 Blender 工作文件截图。
- 近 / 中 / 远档：3598 / 2228 / 1222 三角；原可见模型 3356。近档增加约 7.2%，用于连续枝根。自动 LOD 距离切换尚未接引擎。

重现：后台 Blender 执行 `tools/pipeline/build_ancient_pine_candidate.py`；随后 Python 执行本目录 `validate_glb.py`。不会修改源档案、Web 或 Godot。
