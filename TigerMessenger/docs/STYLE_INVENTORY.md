# 风格重构 · 第 1 步盘点

生成：2026-11-06T23:28:53.835Z（tools/refactor/inventory.mjs，只读扫描 src/ 975 个 JS，不含 vendor）。明细：artifacts/refactor/inventory.json。

## 总量

| 类别 | 数量 | 说明 |
| --- | --- | --- |
| 材质构造 | 837 | MeshBasicMaterial 349、MeshStandardMaterial 346、LineBasicMaterial 64、ShaderMaterial 26、MeshToonMaterial 22、SpriteMaterial 14、MeshPhysicalMaterial 4、MeshLambertMaterial 3、PointsMaterial 3、MeshDepthMaterial 3、MeshDistanceMaterial 3；其中参数是纯字面量（可直接收编）的 804 |
| 调色板常量 | 115 | 名字像调色板或含 ≥4 个颜色的常量 |
| 颜色值 | 1311 种 | 其中 7 种在 ≥4 个文件里重复出现 |
| 灯光构造 | 55 | 各场景自建的方向光 / 半球光 / 环境光 / 点光 |
| 建筑函数 | 71 | 建房、塔、屋顶、墙、桥、门、窗、楼梯 |
| 载具 / 乘骑函数 | 37 | 船、车、飞艇、飞行器、马、舱 |
| 交互入口 | 113 | 交互、对话、上下载具 |

## 按风格包

| 风格包 | 材质 | 调色板 | 灯光 | 建筑函数 | 载具 | 交互 |
| --- | --- | --- | --- | --- | --- | --- |
| 莫里斯 | 43 | 4 | 8 | 1 | 2 | 9 |
| 莫比斯 | 121 | 10 | 10 | 12 | 6 | 9 |
| 蒸汽朋克 | 70 | 10 | 1 | 1 | 3 | 0 |
| 湖沼珊瑚 | 111 | 8 | 0 | 1 | 1 | 0 |
| Townscaper | 218 | 37 | 7 | 41 | 5 | 26 |
| 日式苔园 | 30 | 4 | 1 | 0 | 0 | 0 |
| 角色（物件） | 80 | 8 | 0 | 0 | 1 | 2 |
| 共用 / 未归类 | 164 | 34 | 28 | 15 | 19 | 67 |

「共用 / 未归类」里材质最多的前缀：moon 16、canal 9、bubble 7、freight 7、tram 7、odyssey 7、harbor 6、factory 5、weapon 5、city 5、environment 5、sea 5、paper 4、weather 4、leviathan 3、effects 3。这些多是跨场景的系统（月湖、运河、电车、港口、天气等），归入哪个风格包待定。

## 材质最多的文件（优先收编）

| 文件 | 材质数 |
| --- | --- |
| `src/world/swampV2Art.js` | 35 |
| `src/assets/characters/tigerTargetV1.js` | 19 |
| `src/world/crystalV10.js` | 19 |
| `src/world/moebiusSwamp.js` | 18 |
| `src/world/saihojiPhalanx.js` | 18 |
| `src/assets/characters/swampTigerV2.js` | 13 |
| `src/world/swampHarborScene.js` | 13 |
| `src/world/citadel/holyCityStyleV2.js` | 11 |
| `src/world/morrisFlora.js` | 11 |
| `src/world/bookshopJakubHarbor.js` | 10 |
| `src/world/gateTargetThirty.js` | 10 |
| `src/world/highlandCitadelDesign.js` | 10 |

## 跨文件重复最多的颜色（候选「颜色角色」）

| 颜色 | 出现的文件数 |
| --- | --- |
| #ffffff | 34 |
| #a9b2ab | 4 |
| #d8d5c6 | 4 |
| #395c48 | 4 |
| #567653 | 4 |
| #73916a | 4 |
| #d5dbdb | 4 |

## 建筑函数

| 风格包 | 函数（文件） |
| --- | --- |
| 莫里斯 | createMorrisCastle（morrisCastle.js） |
| 莫比斯 | createDetailedMoebiusTower（moebiusTower.js）、createGateShape（abandonedGate.js）、createGateCapShape（abandonedGate.js）、buildTieredTower（abandonedGate.js）、buildAbandonedGate（abandonedGate.js）、createGateHaulerCraft（gateHaulerCraft.js）、createGateHero（gateHeroes.js）、createGateHeroes（gateHeroes.js）、createGatePodCraft（gatePodCraft.js）、createGatePlayerWalls（gateTarget.js）、createGatePlayerGround（gateTarget.js）、buildToweringTree（moebiusSwamp.js） |
| 蒸汽朋克 | buildBookshopAirshipDock（bookshopAirshipDock.js） |
| 湖沼珊瑚 | makeWallSampler（swampWaterfalls.js） |
| Townscaper | createCitadelForegroundDefenseTower（citadelWatchtower.js）、createBoardingGate（boardingGate.js）、buildClaudeHouses（claudeHouses.js）、buildContinuousStairSpec（continuousStairs.js）、buildWall（familyBuilders.js）、buildRoof（familyBuilders.js）、buildTower（familyBuilders.js）、buildGate（familyBuilders.js）、buildStairs（familyBuilders.js）、buildBridge（familyBuilders.js）、buildHarborStairWalls（harborStairWalls.js）、buildHighlandGateMonument（highlandGateMonument.js）、addOldTownRoofDomes（holyCityStyleV2.js）、buildIntegratedFrontGate（integratedFrontGate.js）、buildCitadelMainGate（mainGate.js）、createCastleOceanSampler（newCityRidgeCandidate.js）、createCitadelPlayerWalls（playerWalls.js）、buildPlazaRetainingWall（plazaRetainingWall.js）、createTargetBridgeStairConnector（targetBridgeStairConnector.js）、createTargetCityBayBridge（targetCityBayBridge.js）、createTargetDoubleDeckBridge（targetDoubleDeckBridge.js）、createTargetStairSurfaceSampler（targetNewCityStairRoute.js）、createTargetNewCityStairRoute（targetNewCityStairRoute.js）、createTargetNewCityStairs（targetNewCityStairs.js）、createTargetOldCityRoofSession（targetOldCityRoofSession.js）、createTargetOldCityWaterfrontStairs（targetOldCityWaterfrontStairs.js）、buildTowerInteriorStairs（towerInteriorStairs.js）、buildUpperTowerPortal（upperTowerPortal.js）、makeCastleTopTargets（citadelInfiltration.js）、buildGates（citadelTacticalGraph.js）、addRingHouse（citadelTown.js）、buildCitadelRoofBird（citadelTown.js）、makeGableRoofGeometry（citadelTown.js）、addFacadeWindow（highlandCitadelDesign.js）、buildInteriorRotatingStaircase（highlandCitadelDesign.js）、buildLegacyInteriorRotatingStaircase（highlandCitadelDesign.js）、addTowerBands（highlandCitadelDesign.js）、buildCentralSacredTower（highlandCitadelDesign.js）、buildRidgeTower（highlandCitadelDesign.js）、makeRavineWallGeometry（highlandCitadelDesign.js）、buildRavineWalls（highlandCitadelDesign.js） |
| 共用 / 未归类 | createBubblePodsAroundFlowerBuildings（bubblePod.js）、createLowPolyHouse（lowPoly.js）、createLowPolyBridge（lowPoly.js）、buildTownscaperBuilding（townscaperBuilding.js）、createTripleGateHighlandProfile（tripleGateHighlandProfileV8.js）、createCastleProfile（castleProfiles.js）、buildCastleModuleSets（moduleSets.js）、createBounceGateReporter（voxelBounce.js）、createLocalLightBridge（localLightBridge.js）、makeWindowLitMat（odysseyCitadel.js）、makeArchedWindowGeometry（odysseyCitadel.js）、createTripleGateScoutAircraft（tripleGateScout.js）、addGateTargets（scoutDefense.js）、createBambooWallCluster（startGarden.js）、createMountainWall（startGarden.js） |

## 载具 / 乘骑函数

| 风格包 | 函数（文件） |
| --- | --- |
| 莫里斯 | createMorrisHorseRide（morrisHorseRide.js）、createMorrisHorse（morrisHorse.js） |
| 莫比斯 | createMoebiusAircraft（moebiusAircraft.js）、createMoebiusAircraftSquad（moebiusAircraft.js）、createMoebiusAirship（moebiusAirship.js）、buildSoccoCarrierParts（gateHaulerCraft.js）、createGatePodCraft（gatePodCraft.js）、createLotusLeafBoat（moebiusSwamp.js） |
| 蒸汽朋克 | buildBookshopAirshipDock（bookshopAirshipDock.js）、createBookshopFreighterHull（bookshopFreighterHull.js）、createBookshopMedicalTrain（bookshopMedicalTrain.js） |
| 湖沼珊瑚 | createSwampRowerStyle（swampRowerStyle.js） |
| Townscaper | createCitadelTrojanHorse（citadelTrojanHorse.js）、createCitadelTrojanHorse（citadelTrojanHorseLegacy.js）、buildFrontHarborCargo（frontHarborCargo.js）、buildHorseTerrace（horseTerrace.js）、buildBoat（highlandCitadelDesign.js） |
| 角色（物件） | createDukeShip（dukeFreighter.js） |
| 共用 / 未归类 | createBubblePod（bubblePod.js）、createBubblePodsAroundFlowerBuildings（bubblePod.js）、createFreightVehicle（freightTrain.js）、createFisherBoat（harbor.js）、createOriginalFisherBoat（harbor.js）、createChristchurchTram（tram.js）、createCarryLetterVisual（letterQuest.js）、createAircraftRide（aircraftRide.js）、createAirshipRide（airshipRide.js）、createBoatRide（boatRide.js）、createBubblePodRide（bubblePodRide.js）、createScoutAircraftRide（scoutAircraftRide.js）、createTramRide（tramRide.js）、createCanalBoatPatrol（canalBoats.js）、createTripleGateScoutAircraft（tripleGateScout.js）、createSurfaceRider（surfaceRider.js）、buildChristchurchTramSystem（temp_tram_system.js）、createChristchurchTramSourceCurves（tramSystem.js）、buildChristchurchTramSystem（tramSystem.js） |

## 下一步（第 2 步）

先收编莫西斯湖：材质改由风格材质工厂按「角色」创建，参数原样；同相机、同光照截图对照必须一致。
