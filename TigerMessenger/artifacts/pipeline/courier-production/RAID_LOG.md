# 书店镇袭击战 + 古堡电车延伸（2026-09-18）

## 任务1 · 有轨电车修到高山古堡 ✓
tramSystem.js controls 在 K 段后插入东海北延航段（7 个新航点）：
K(南12/东165) → 越赤道东行 → 东海引桥 → 古堡前港站(北26.5/东42，山崖高架)
→ 离港西行 → 西南深水段 → 接回近岛段。
桥面/桥墩/双线系统自动覆盖新段；全线长 ~1054 → ~1400+。

## 任务2 · 书店镇袭击战 ✓
- scoutDefense.js：zone 轮换扩展 city→gate→**bookshop→citadel**→city；
  getRaidZones 注入书店/古堡锚点帧（侦察机队按帧驻巡）；
  getFleetTargets 并入驻军打击池（侦察机队打击行军中的驻军分遣队）。
- saihojiPhalanx.js：root.userData.marchGarrisonTo(dir)——一组红盔驻军
  整队开拔行军到目标方向（球面行军插值复用）；garrisonTargets() 暴露打击池。
- messengerIsland.js：侦察机队接线（书店/古堡锚点 + 驻军打击池）。
- main.js：zone 进入 bookshop/citadel 时 → 驻军开拔增援 +
  《The Best Is Yet To Come》BGM；zone 离开 → BGM 回落。

## 任务3 · BGM ✓
music/Aoife Ni Fhearraigh-The Best Is Yet To Come.mp3（主人已就位）
走既有 siege 通道（优先级 85，压过舰队 70），交战期独占、播完即止、撤离回落。
