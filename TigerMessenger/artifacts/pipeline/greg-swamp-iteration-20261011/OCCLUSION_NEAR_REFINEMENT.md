# 贴镜保护窄调 v4 · 2026-10-11

实际查看 `rim-clean-aperture.jpg`、`rim-root-batch-final.jpg` 与主代理等待约1秒后的 `rim-aperture-settled.jpg`。最初v3图可能在开口尚未完全展开时拍摄：首次1/60秒 update 权重只有.0989；等待1秒的图中步道/信使腿已经更清楚，但右侧浅绿近叶仍占约三分之一。因此本批只增加独立贴镜保护半径，没有据未展开的图盲改视线孔。

`swampOcclusionFade.js` 默认v4：`uSwFadeNear=2.2world`，完全clip镜头附近植物片元；沿同一.16/.22秒权重平滑开/关。视线胶囊、原opaque/depth状态、植株几何、角色排除与碰撞保持，没有网点或透明排序。

- `&swampCamFadeNear=0` 重载回v3的.42world贴镜保护，仍是clean clip。
- `&swampCamFadeLegacy=1` 回旧Bayer对照。
- `&swampCamFade=0` 总关。
- Shader key区分 aperture-v4 与 aperture-v3；report.version/nearRadius/weight 和uniform可检查。GPU截图应先在正常帧更新下等待约1秒，再固定机位拍摄，避免把尚未展开的孔当最终效果。

新CPU+InkPost 11/11通过，`occlusion-near-tests.txt`。测试证明离轴近镜片元(1.5,.2,-.6)在v4内、v3外；超2.2world外围保留；其它几何/角色/材质与实秒缓动检查仍通过。此处并不是GPU投影遮挡面积测量。主代理待重新拍正式游戏，未声称GPU视觉通过。

before v3 source/test：`source-before/occlusion-near-refinement/`。后续源哈希更新至 `occlusion-aperture-source-manifest.json`。只改变本模块，不改其它生产文件，不提交/发布/外发。
