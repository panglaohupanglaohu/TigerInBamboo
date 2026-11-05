# 拖抹续作与墙色界面 · 2026-11-05

先读README line34的1727324352264474664只有“looks pretty good”，结合line35相邻1727315611959865407明确motion blur smear。原版palette.js仅引用前者岛体色系，不能把它当调色算法。实际303帧0–302、sheet-00至03全部逐格看，原尺寸95明显轮廓沿旋转方向被强拉长/扭抹，停转清晰。前一条172731视频尚未全帧，不计入本批。

README line101的1371460793032716290只说一场小睡内完成。实际524帧0–523、sheet-00至05全部逐格看，原尺寸300显示Photoshop Palette.png @3200%与多色条，下方编辑与建筑墙色/左色槽联动；不能仅由这句配文推断程序热加载细节。每帧编号、真实时间戳、观察与回看标记保存各ID目录。

## 共享代码

既有View是上一帧半透明叠加，保留。修复直接yaw差跨2π导致假高转速，新增core/camera-motion.js最短角差；无效/0dt返回0。关闭拖影使历史失效，setDebug切换也立即失效；resize释放旧FramebufferTexture、PlaneGeometry、ShaderMaterial，避免只释放贴图。原作强轮廓拖抹不是目前历史帧叠加可直接复现，速度场/方向采样及原版CPU指标接口仍缺。

core/palette.js新增withPaletteColors完整验证并复制色槽，不修改共享PALETTES。app暴露setWallPalette，改变palette引用让已有WorldMesh缓存按配色失效，更新色槽面板；体素/颜色索引不改变，屋顶固定色保留。wall-palette.html接真实小镇，可编辑15色槽并恢复本页初始配色。PNG热重载、多行贴图、最短色相过渡/QA及完整原版API仍待补，不声称与原作Palette.png后端等价。

## 验收

camera-palette.mjs测试角度跨周界、无效dt、预设隔离及验证。实际双网格墙色改变77292/74931颜色分量；恢复色数组一致，position不变，World346/341不变。resize旧贴图/几何/材质dispose事件共3次，跨周界速度≈1（不再误触上限），禁用一帧后重新启用无历史。结果camera-wall-browser.json；截图camera-wall-{mixed,quad}.png。只验本地历史修复和色槽，不计原作强轮廓/PNG系统完成。

截图已目视，呈现本地小镇墙色编辑，不标原作美术等价；当前自定义墙色仅本页临时状态，尚未写入工程/分享存档。页面回归两页92/285、旧场景默认/田纹增量/层理笔触保持。管线缺0，素材与README285匹配，空白检查通过。
