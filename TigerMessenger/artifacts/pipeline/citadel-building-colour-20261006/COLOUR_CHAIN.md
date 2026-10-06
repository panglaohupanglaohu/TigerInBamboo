# 建筑配色修正：实际调用与样式链

权威目标：`/Users/panglaohu/.codex/generated_images/01a0ceaf-9c40-7dd1-8395-6e4b8c6a4bb6/exec-619c6b01-8d79-4ceb-833a-88da7eaf51c8.png`。已实际查看目标及用户实机 `codex-clipboard-d1916981-7b6f-4b44-a926-5c42bb6bd42a.png`。实机仍可见彩墙和橙顶，不能断言所有建筑再次被旧式调色覆盖；本次没有浏览器采集，也没有GPU复验。

之前已证实并修复的故障是 `applyOldTownPalace` 延迟1.5/5秒重涂，它现在遵守材质/对象/祖先保护。此次再发现 `applyHolyCityRoofPalette` 缺少同一保护，已补上。该函数只匹配特定屋顶材质名；当前新建筑大多名称不匹配，所以这不是截图全局发灰的已证实唯一原因。

此次实际生效链：`targetArchitecturePalette.js`统一建筑albedo → old/main/stairs工厂 → `targetCityDetailCandidate`显式使用同一色表（移除旧的覆盖值）→ Standard受光/阴影 → renderer原tone mapping。每个材质保留 `targetArchitectureColour.{version,role,albedo}`，便于后续读取实际值；`paletteStudy.version=target-architecture-colour-1`，GPU标记false。

建筑石改暖浅米色 `#f3dfc6`，饰线近白 `#fff6e7`，奶黄 `#ffdf89`，珊瑚 `#ef958f`，清亮蓝 `#80c8eb` / 蓝阴面 `#73bee3`，青 `#72cbc6`，橙瓦 `#f57b45` / 檐边 `#ff9b58`，新城小窗 `#fffaf2`。这些是反照率，不是保证的最终屏幕像素。岩石与植物由其他模块独立管理，建筑色表不改它们。

没有新增自发光、MeshBasic、强制toneMapped=false或全局曝光修改。CPU验证五条后续处理（HolyRoof、OldTown、Ashley、HistoricStone、CityColourStudy）连续两遍，建筑材质/几何引用、颜色、onBeforeCompile均不变，未受保护原屋顶仍正常处理。CPU不能验证灯光、曝光、雾与后处理叠加后的视觉；仍需同机位同日照GPU对照。截图发灰也可能受到实际全局光照与显示变换影响，目前只作为待验因素，未猜测性改光。

三建筑几何和版本old10/main2/stairs5保持，材质修订独立colour-1；candidate建筑import cache已更新。旧公共几何测试传相同显式新palette比较原工厂，继续验证完整位置/法线/index/transform及20塔窗，不把旧配色固化成几何要求。

源码前快照位于本目录 `source-before`。main、terrain heightfield、全局灯光和车辆没有修改。
