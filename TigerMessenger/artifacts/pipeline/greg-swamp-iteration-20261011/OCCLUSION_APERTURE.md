# 近岸镜头植被让路 · 2026-10-11

后续默认v4贴镜半径已窄调至2.2world，保留v3对照，见 `OCCLUSION_NEAR_REFINEMENT.md`；以下为初始v3实施记录。

已实际查看主代理 `rim-canopy-v8.jpg`：左前景厚叶占画面很大部分，淡出后规则网点清晰；右下叶面也有大片网点。既有v2用2.4–3.6world近镜球及4×4 Bayer丢70%片元，画面因此像整片筛网。本批仅修改 `src/world/swampOcclusionFade.js`，没有删除/移动植物，没有改路径、模型、碰撞、主入口或runner。

## 已实施

默认v3 `clean-aperture`：镜头到信使胸口开一个局部、干净的视线窗。窗内植物片元完全让路，窗外保持原 opaque 深度；没有规则网点、噪声动画或透明排序。开口以实秒指数过渡半径（开.16秒时间常数，关.22秒）；镜头位置保持真实，避免开口中心滞后于镜头。不同刷新率下同一经过时间取得相同半径。

- 主视线半径从镜头侧约.69world缓慢扩到信使侧约1.32world；极贴镜.42world球保护镜头。旧2.4–3.6world全近镜淡出取消。
- 信使身后和镜头身后保留植被，左右外围前景继续框景。
- 墨线壳用相同片元视线窗；instanced植物先乘instanceMatrix再计算世界点。
- 仅开口边界用fwidth给已有可选InkPost标记；片元裁切边界仍是干净的clip边，**没有声称实现透明柔边或GPU视觉平滑验收**。真实移动中的边界是否自然须看正式截图/录屏。
- 材质transparent、depthWrite、blending维持，未增加绘制调用。

## 对照

- 新默认：正常湖沼镜头。
- 旧网点：重载添加 `&swampCamFadeLegacy=1`。
- 完全不让路：原 `&swampCamFade=0`。

注意 `cameraProfile` 是否实际激活；report.active/weight 与uniform.uSwFadeOn可观察。当湖沼镜头退出，半径逐步关闭，最后归零。

## 验证及边界

11/11 CPU（新5项+InkPost6项）通过，`occlusion-aperture-tests.txt`。含：开口内外/前后片元SDF、球面旋转平移等价、15和120FPS同秒权重一致、启/停无突然全株显隐、真实镜头坐标、源shader hook组合与幂等、无Bayer/屏幕噪点、原材质深度透明属性及几何保持、演员不被处理、墨线同窗、instance变换先后、旧版和总关。

GPU未由本代理验收；主代理负责rim同机位A/B、移动时边界自然程度、帧时。该措施不能修复植物本身几何折板，也不能将全游戏性能问题归因于湖沼或保证FPS提升。

## 恢复

改前原件 `source-before/occlusion-aperture/swampOcclusionFade.js`；源哈希见 `occlusion-aperture-source-manifest.json`。只恢复该文件或使用legacy对照，不覆盖其他成员改动。未提交、发布、外发、修改存档。
