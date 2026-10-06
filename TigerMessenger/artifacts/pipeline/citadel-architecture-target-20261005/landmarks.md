# 必须保留的新城地标

- 雕塑：`src/world/citadel/plazaStatue.js` 的 `citadel-plaza-hero-statue`，原暖白石材、圆柱底座、环形铺装。锚点来自 westCity.userData.statueAnchor，并经过 compositionFrame/bayLayout 变换。
- 木马：`src/assets/citadelTrojanHorse.js`，实际演员 `citadelRange.js` 创建于scene下，不是castle子节点。从新城 horseReservation经castle.localToWorld放置，面朝processionalEntry。保留木质材质、现有动画和系绳队；WFC不得自动移除或拿植被占位。
- 图像只补回既有对象，最终位置以实际世界锚点为准，不以生成图重新定位。
