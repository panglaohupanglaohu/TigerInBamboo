# REACodeRefactoring 实际代码能力库

能力库指整个 REACodeRefactoring；registry 只是其中的执行适配入口。扫描不执行源模块，使用 esbuild 解析真实导出和依赖。

生成时间：2026-11-13T14:55:51.694Z；快照：sha256:32f4020cf5bf55e8b2a6f663aef3c774db6f45d0daa1176add74727a69a214bb。

sourceModules: 361 · sourceFiles: 365 · rootHtml: 139 · testCode: 565 · originalFiles: 290 · missingTargets: 10

| 目录 | 模块 | 导出接口 | 游戏旧副本不同 |
|---|---:|---:|---:|
| src/badnorth | 19 | 85 | 3 |
| src/build | 23 | 92 | 1 |
| src/campaign | 2 | 7 | 0 |
| src/capabilities | 7 | 34 | 0 |
| src/core | 149 | 703 | 13 |
| src/life | 20 | 60 | 6 |
| src/light | 14 | 63 | 1 |
| src/render | 2 | 10 | 0 |
| src/sphere | 10 | 60 | 0 |
| src/terrain | 29 | 142 | 4 |
| src/tools | 7 | 12 | 0 |
| src/ui | 21 | 37 | 1 |
| src/water | 6 | 16 | 1 |
| src/world | 52 | 164 | 11 |

代码存在、来源学习、执行适配、运行核验分别记录。上下文仅为静态线索；旧vendor不是最新库。全量原版差异见 [REACODE_LIBRARY_ALIGNMENT.md](REACODE_LIBRARY_ALIGNMENT.md)。

| 实际模块 | 导出接口 | 上下文线索 | 游戏旧副本 |
|---|---|---|---|
| src/badnorth/battle-c01.js | BattleC01, C01_DEFAULT_ON, C01_FLAGS, SKY_BEAM, SKY_BEAM_STEPS, SKY_BEAM_UNIT, SKY_BEAM_UNIT_STEPS, beamFade, beamFadeStepped, beamFadeUnit, blockSlot, bloodLook, coastEdges, graphEdges | main-thread | absent |
| src/badnorth/battle-c02.js | BattleC02, C02_FLAGS, splatAlpha, tumbleMatrix | main-thread | absent |
| src/badnorth/battle-c03.js | BattleC03, C03_FLAGS, isoLinesOnMesh | main-thread | absent |
| src/badnorth/battle-c04.js | AO_DIRS, BattleC04, hexSlotOutlines, particleAO | three-context | absent |
| src/badnorth/battle-g3.js | BattleG3, G3_FLAGS | main-thread | absent |
| src/badnorth/battle.js | Battle | main-thread | different |
| src/badnorth/damage-numbers.js | DAMAGE_STYLE, DMG_PER_HP, KILL_STYLE, KILL_VALUE, addDamageNumber, damageValue, kickDamageNumber, stepDamageKick, stepDamageNumbers, styleFor | data-candidate | absent |
| src/badnorth/flowfield.js | buildFlowField, buildLayeredFlowField | data-candidate | identical |
| src/badnorth/ground-stain.js | GROUND_STAIN, stainHex, stainProgress, stainTint | data-candidate | absent |
| src/badnorth/house-char.js | CHAR, charHouseVerts, charShade, expandOutline, inOutline, restoreChar | data-candidate | absent |
| src/badnorth/info-graph.js | InfoGraph | data-candidate | absent |
| src/badnorth/island-caves.js | carveBadNorthCaves, cavesFromUrl | data-candidate | absent |
| src/badnorth/island.js | generateBadNorth | data-candidate | absent |
| src/badnorth/landing-plan.js | LANE_ANGLES, approachBox, berthBox, planLanding, seawayBlocked, seawayBox | data-candidate | different |
| src/badnorth/squad-footprint.js | cornerTick, fanTriangles, footprint, hubOf, hullRing, ringArea, ringPerimeter | data-candidate | absent |
| src/badnorth/squad-hud.js | STRIP, addPopup, bannerBar, stepPopups | data-candidate | absent |
| src/badnorth/squad-standard.js | ARMY_HUE, GOLD, STANDARD, ShieldFaces, bakeShieldImage, bakeStandardImage, buildStandardMesh, emblemAtlas, orientStandard | three-context | absent |
| src/badnorth/theme.js | BN_PAL, applyBadNorthTheme, frostVegetation | main-thread | different |
| src/badnorth/unit-batch-lod.js | UnitBatchLod, compactInstances | three-context | absent |
| src/build/buildings.js | buildBuildings | data-candidate | different |
| src/build/canal-bridge-r56.js | canalArchParams, canalBridgeAxis, canalBridgeFace, quayProfile | data-candidate | absent |
| src/build/canal-scene-r56.js | buildCanalTown | data-candidate | absent |
| src/build/church-niche-r56.js | NICHE_INNER, churchNiches, nicheShape | data-candidate | absent |
| src/build/doodle-hallway.js | buildDoor, buildHallwayGeometry, buildStairs, floorAt, makeHallway, paintHallwayTexture, wainscotTop | three-context | absent |
| src/build/doodle-wall.js | INK, PANEL_TINTS, PAPER, drawMotif, makeDoodleWall | main-thread | absent |
| src/build/garden-plots-c07.js | drawGardenCellC07, insetPolygon, planGardenC07 | data-candidate | absent |
| src/build/lighthouse.js | Lighthouses | three-context | absent |
| src/build/module-catalog-r56.js | allSignatures, buildPiece, catalogLayout, decodeSignature, nOf, referenceCells, signatureOf, usedSignatures | data-candidate | absent |
| src/build/module-volume.js | placeModuleVolume, undoModuleVolume | data-candidate | absent |
| src/build/multicell.js | commitHouseTiles, editHouseTiles, enumerateHouseTiles, placeHouseTiles, validateHouseTiles | data-candidate | absent |
| src/build/multitile-iso.js | drawMultitileIso, isoProject | data-candidate | absent |
| src/build/multitile-wfc.js | DEFAULT_TILES, MULTITILE_DIRS, buildParts, facesCompatible, solveMultitile, validateMultitile, voxelFaceAO | data-candidate | absent |
| src/build/multitile-world.js | buildMultitileTower, meanCellSpacing, multitileIntoWorld | data-candidate | absent |
| src/build/scenes-r56.js | steelScene, yardScene | data-candidate | absent |
| src/build/splice-polygon-c09.js | emitFootprintSplices, pointInPoly, prepareFootprintSplices, ringArea2, spliceFootprint, trisAsCells | data-candidate | absent |
| src/build/splice.js | bilinear, footprintFor, q01, spliceHouse, splicePolygon, spliceRect, toggleSplice | data-candidate | absent |
| src/build/steel-r56.js | emitSteelFrame, legLanding, solveTieLevels | data-candidate | absent |
| src/build/tile-assembly.js | TILESET_FORT, TILESET_RUIN, applyAssemblyPrefix, assemblySite, commitAssembly, expandTiles, labelCompatible, layeredLattice, solveAssembly | data-candidate | absent |
| src/build/village.js | scatterVillage | data-candidate | absent |
| src/build/wfc-bitset.js | WFC_CONFIGS, WFC_ENGINES, benchEngines, compileRules, popcount32, replayState, solveBitset | data-candidate | absent |
| src/build/yard-prop-art-r56.js | drawYardProp, propKind | data-candidate | absent |
| src/build/yard-r56.js | drawYardWalls, planYardWalls, yardFloraSpecs | data-candidate | absent |
| src/campaign/campaign.js | generateCampaign, groupRegions, islandSnapshot | main-thread | absent |
| src/campaign/frontier-overlay.js | BAND_COLORS, FRONT_COLORS, campaignFrontierFields, drawFrontierFields | data-candidate | absent |
| src/capabilities/build.js | lighthouse | data-candidate | absent |
| src/capabilities/layers-meta.js | LAYER_CAPS | data-candidate | absent |
| src/capabilities/layers.js | LAYER_NAMES, createLayer | three-context | absent |
| src/capabilities/ops.js | bit, cloneWorldData, editable, floorOf, ground, hasBuilt, isCave, isRock, isSolid, makeRng, nbIds, pickSpread, setVoxel, straightNext, top, topIsBuilt | data-candidate | absent |
| src/capabilities/registry.js | CAPABILITIES, REGISTRY_VERSION, describeCapabilities, getCapability, matchAll, routeGoal, runPlan | data-candidate | absent |
| src/capabilities/terrain.js | arch, overhang, pickSpread, seastack, tunnel | data-candidate | absent |
| src/capabilities/verify.js | top, verifyCandidate | data-candidate | absent |
| src/core/adjacency.js | buildFitTable, edgeSignature, gridEdgeSlots, meshEdges, selfCheck, whichFits | data-candidate | absent |
| src/core/anchored-billboard.js | anchoredBillboardGLSL, billboardPoint, foldAngle, foldedCard, foldedContrast, foldedHalfNormals, foldedSideWidth | data-candidate | absent |
| src/core/arch-floor-budget.js | archAt, archFloorBudget, archPassableWidth, archPassage, archSoffitAt, openingPierce | data-candidate | absent |
| src/core/arch-profile.js | archClearance, archProfile, archVoussoirs, deformedArchError, measureArch | data-candidate | absent |
| src/core/atlas-c09.js | armFromTrace, atlasRng, placeBottomLeft, project3D, runPackSequence, treeLayers | data-candidate | absent |
| src/core/atlas.js | Atlas, shelfPack | data-candidate | different |
| src/core/ballistic-table.js | BALLISTIC_EXPR_PARAMS, PROJECTILE_GRAVITY, bakeBallisticArc, compileBallisticExpr, createBallisticTable, createExpressionBallisticTable, defaultBallisticTable, projectileState, sampleBakedArc | data-candidate | different |
| src/core/banner.js | BANNER_EMBLEMS, BANNER_TAILS, SQUAD_EMBLEMS, SQUAD_ROLES, bakeBanner, bakeEmblemAtlas, bannerBillboardYaw, bannerContains, hslToRgb, squadRolePalette | data-candidate | different |
| src/core/brush-atlas.js | blockCoherence, buildScratchAtlas, scratchStats | data-candidate | absent |
| src/core/building-components.js | buildingComponents | data-candidate | absent |
| src/core/c11-maps.js | GRASSLINE_VERT_PARS, GRASS_RAY, bakeContrastHeightMap, bakeShrubDropMap, grassOutlineStrength, sampleMap, shrubDropScale, wallLedgeBand, worldSquareBounds | data-candidate | absent |
| src/core/camera-motion.js | ORBIT_SMEAR_GLSL, cameraAngularSpeed, orbitVelocity, sharpnessBand, smearHistoryWeight, smearImage, smearLengthPx | data-candidate | absent |
| src/core/campaign-graph.js | campaignGraph, campaignWalk | data-candidate | absent |
| src/core/canopy.js | buildCanopy | data-candidate | absent |
| src/core/cloud-depth.js | CLOUD_DECK_LAYERS, CLOUD_DEPTHS, cloudDepth, makeCloudDeck | data-candidate | absent |
| src/core/cloud-motion.js | CLOUD_DRIFT_GLSL, cloudDrift | data-candidate | absent |
| src/core/color-volume-grid.js | VOLUME_FEATURES, cellIndex, colorWorldByVolumeGrids, defaultVolumeGrids, makeVolumeGrid, nearestCell, setVolumeRange, stepValue, toggleCell, volumeBlocks, volumeStrip | data-candidate | absent |
| src/core/color-volume.js | COLOR_VOLUME_GLSL, classifyWorldFeature, colorWorldFeatures, cornerVolumeStats, defaultFeatureVolumes, makeColorVolume, makeCornerVolume, sampleColorVolume, sampleCornerVolume, setVolumeCorner, volumeSheet, volumeStrip | data-candidate | absent |
| src/core/combat-profile.js | configureCombatUnit, damageCombatUnit | data-candidate | identical |
| src/core/combat-state.js | resolveFallLanding, stepStun, stunUnit | data-candidate | different |
| src/core/contour.js | buildCornerField, marchGrid | data-candidate | absent |
| src/core/contrast-field.js | cellContrastColors, featureBaseColors, initContrastColors, measureContrastColors, relaxContrastColors, solveContrastColors, solveContrastField, srgbToOklab, worldCellFeature, worldContrastMesh | data-candidate | absent |
| src/core/corner-footprint.js | cornerCutPlan, cornerFootprint, footprintMetrics, islandFootprints | data-candidate | absent |
| src/core/coroutine.js | Scheduler, frame | data-candidate | absent |
| src/core/courtyards.js | classifyCourtyards | data-candidate | absent |
| src/core/cube-height.js | bakeCubeHeight, cubeDirection | data-candidate | absent |
| src/core/decal-accum.js | BOIL_CHARTS, DECAL_FRAG_PARS, DecalAtlas, mulberry | data-candidate | absent |
| src/core/deformation-guard.js | guardDeformation | data-candidate | absent |
| src/core/depression-fill.js | depressionFill, drainedCells, erodeHeights, lakeClusters, localMinima | data-candidate | absent |
| src/core/distance-isolines.js | distanceField, evenLevels, isoContours | data-candidate | absent |
| src/core/doodle-hallway-layout.js | HALLWAY_DEFAULTS, floorAt, inDoor, mirroredMotifs, planHallway, surfacePoint, wainscotTop | data-candidate | absent |
| src/core/doodle-layout.js | planDoodlePanels | data-candidate | absent |
| src/core/edge-inset.js | insetEdgeAnchor, pointInsidePolygon | data-candidate | absent |
| src/core/field-plots.js | borderAngleSpread, chevronRow, mulberry32, partitionPlots, plotBorderCells, plotUV, principalAxis, sampleField | data-candidate | absent |
| src/core/field-surface-c04.js | LAYERED_SHAPES, chunkPhase, houseTriangles, housesAt, layeredPlan, mirrorMatrixY, transitionDarkness, waterlineBand, waterlineDistance | data-candidate | absent |
| src/core/field-surface.js | ISO, blurField, chunkPlan, edgeManifold, fieldAt, fieldIndex, fieldNormal, hash01, makeField, meshBounds, meshVolume, morphField, normalTiltShare, rasterizeBoxes, sampleField, shrinkBoxes, surfaceNets | data-candidate | absent |
| src/core/float-advect.js | STORAGE, advect, advectionQuality, roundHalf, seedBlob, storageRoundTrip | data-candidate | absent |
| src/core/fog-envelope.js | fogEnvelope, fogEnvelopeGLSL, makeFogWisps | data-candidate | absent |
| src/core/frontier-candidates.js | expandFrontier, frontierCandidates | data-candidate | absent |
| src/core/frontier.js | buildFrontier, buildFrontiers, earClip, frontierClearance, frontierFields, pointInPolygon, sampleFrontierBezier | data-candidate | absent |
| src/core/garden-paths.js | gardenPaths | data-candidate | absent |
| src/core/graph-bands-c08.js | bandedGraph, bfsLayers, findBridges, twoEdgeComponents | data-candidate | absent |
| src/core/graph-layout.js | adjacencyComponents, radialLayout | data-candidate | absent |
| src/core/grid-gems-c06.js | sprinkleGems | data-candidate | absent |
| src/core/grid-kinds-c08.js | PURE_GRIDS, gridKindSummary | data-candidate | absent |
| src/core/grid-wireframe.js | classifyWireframe, seamBands | data-candidate | absent |
| src/core/grid.js | buildHexGrid, buildMixedGrid, buildQuadGrid, buildSquareGrid, buildTriangularSubgrid, finishGrid, gridKindStats, isConvex, oppositeEdge, quadPatchTopology, relaxPolygons, signedArea, traceStraight, traceStraightReport | data-candidate | different |
| src/core/halfedge-patch-c08.js | fillGaps, fullMesh, gapLoops, scatterGroups | data-candidate | absent |
| src/core/halfedge.js | buildHalfEdge, checkHalfEdge, splitQuads | data-candidate | absent |
| src/core/hip-roof.js | gableRoofMetric, hipRoof, hipRoofMetric, regionRings, skeletonRoof | data-candidate | absent |
| src/core/house-door-presence.js | atHouseDoor | data-candidate | identical |
| src/core/house-kit.js | FLOORS, PITCHES, THATCH, pitchPool, roofHeightAt, seatChimney, verifyHouseKit | data-candidate | absent |
| src/core/infinite-c06.js | areaStats, createInfiniteStream, patchLattice, patchRim, restoreArea, streamWindow, windowDual | data-candidate | absent |
| src/core/infinite.js | buildInfinite, clusterCost, createInfiniteStream, patchStep, quadDual, verify, windowSeam | data-candidate | absent |
| src/core/ladder-profile.js | ladderAnchors, ladderClimb, ladderContact, ladderProfile | data-candidate | absent |
| src/core/leaf-atlas.js | buildLeafAtlas, sphereLeafUV | data-candidate | absent |
| src/core/level-flora.js | LEVEL_SPECIES, levelFloraPalette, levelFloraRanks, levelFloraSpecies, measureLevelFlora | data-candidate | absent |
| src/core/loop-lift.js | buildFlyingTown, distanceToPolygon, findLoops, hullDepth, liftField, loopPolygon, loopRegion, pointInPolygon, polygonArea, supportLegs | data-candidate | absent |
| src/core/marching-cubes.js | growthOrder, marchIrregular, meshVolume, quadRegionGrid | data-candidate | absent |
| src/core/melee-sweep.js | angleInSweep, beginSweep, shieldBlock, stepSweep | data-candidate | absent |
| src/core/meshwriter.js | DOWN, MeshWriter, UP, edgeOut | three-context | different |
| src/core/minheap.js | MinHeap | data-candidate | identical |
| src/core/mirror-uv.js | MIRROR_UV_GLSL, fold, mirrorUV, orientUV | data-candidate | absent |
| src/core/mixed-perspective.js | compareProjection, invert, multiply, perspectiveMatrix, projectPoint, projectionForRenderer, quadWidths, verticalEdge, viewMatrix, withVerticalParallel | data-candidate | absent |
| src/core/module-audit.js | auditModuleOccurrences | data-candidate | absent |
| src/core/module-fit.js | fitModuleGeometry | data-candidate | absent |
| src/core/module-patch.js | PATCH_EXAMPLE, generateModulePatch, halfEdgeClosure, spliceModulePatch, synthesizeModulePatch | data-candidate | absent |
| src/core/module-search.js | describeModule, findModulePatches | data-candidate | absent |
| src/core/mountain-bake.js | MOUNTAIN_LIGHT, MOUNTAIN_RASTER_LIGHT, bakeNormalLight, compareMountainModes, mountainNormalAt, mountainShadeStats, renderMountainShade, worldMountainField | data-candidate | absent |
| src/core/nav-diagnostic-geometry.js | navDiagnosticGeometry | data-candidate | absent |
| src/core/nav-visibility.js | castNavVisibility | data-candidate | absent |
| src/core/node-graph-editor.js | EDITOR_TYPES, NodeGraphEditor | data-candidate | absent |
| src/core/node-graph-runtime.js | NODE_REGISTRY, NodeGraph, addConstant, boolSource, buildToggleChain, compose2, constant, lerpTowards, multiply, select, sink, variable | data-candidate | absent |
| src/core/noise.js | clamp, clamp01, fbm, hash01, makeRng, mix, ridged, smoothstep, valueNoise | data-candidate | identical |
| src/core/normal-contrast.js | NORMAL_CONTRAST_GLSL | data-candidate | absent |
| src/core/obb.js | clipAreaXZ, convexDepthXZ, convexOverlapXZ, makeBox, obbFootprintXZ, obbOverlap, obbOverlapSampled, obbPenetration, polygonAreaXZ | data-candidate | different |
| src/core/okhsl.js | computeMaxSaturation, findCusp, findGamutIntersection, getCs, linearSrgbToOklab, mixOkhsl, okhslToSrgb, oklabToLinearSrgb, srgbToOkhsl, toe, toeInv | data-candidate | absent |
| src/core/oklab.js | clampOklabToGamut, deltaE, hexToOklab, hexToSrgb, inGamut, oklabToSrgb, srgbToOklab | data-candidate | absent |
| src/core/opening-footprint.js | OPENING_FRAME, WINDOW_SILL_SCALE, frameDeviationDeg, openingFootprint, placeProps, propOverlap | data-candidate | absent |
| src/core/ornament-field.js | SQUIGGLE_D0, SQUIGGLE_DR, SQUIGGLE_EXTENT, SQUIGGLE_WOBBLE_GLSL, bakeOrnamentField, bakeSquiggleField, bucketSegments, probeSquiggleEdge, squiggleOrnament, squiggleSdf, squiggleSdfBucketed, squiggleShadeSdf | data-candidate | absent |
| src/core/paint-normal.js | auditPaintNormal, decodeTexel, paintMeshNormals, paintNormal, perturbNormal, sampleWorldPlanar, shadeWithNormals, shadeWorldTops | data-candidate | absent |
| src/core/palette-graph.js | SPACES, addGradient, addNode, addQuad, addTriangle, barycentric, bilinear, colorWorldByGraph, createPaletteGraph, defaultPaletteGraph, exportGraph, facets, gradientColors, importGraph, mixColor, moveNode, nodeById, paletteStrip, quadFacetAt, setNodeColor, setSpace, swatches, triFacetAt | data-candidate | absent |
| src/core/palette-image.js | changedSlots, encodePaletteImage, paletteFromImageRows, paletteRowsFromPixels, pixelsDigest | data-candidate | absent |
| src/core/palette-patch.js | PALETTE_PATCH_GLSL, makePalettePatch, samplePalettePatch | data-candidate | absent |
| src/core/palette.js | BUILD, PALETTES, TERRAIN, blendWallPalettes, withPaletteColors | data-candidate | different |
| src/core/part-random.js | PORTRAIT_SLOTS, mirroredRandom, partSeed, portraitSilhouette, sampleSlots, silhouetteDiversity, withRandomState | data-candidate | absent |
| src/core/path-samples.js | ribbonCells, samplePath, smoothRoutedPath | data-candidate | different |
| src/core/penumbra.js | castHeightShadow, coarsenHeights, distToMask, penumbraStats, threeShadow | data-candidate | absent |
| src/core/platform-anchor.js | capturePlatformAnchor, resolvePlatformAnchor | data-candidate | identical |
| src/core/playful-layout.js | GLYPHS, colorFor, hueFor, layoutList, playfulJitter | data-candidate | absent |
| src/core/portal-aim.js | portalAim | data-candidate | identical |
| src/core/prop-anim.js | PropLifecycle, propScaleGLSL, scaleAt, springValue, staggerAt | data-candidate | absent |
| src/core/qa-monkey.js | monkeyRegion, monkeyStep, mulberry32, positionDigest, runMonkeyQA | data-candidate | absent |
| src/core/qa-replay.js | applyQAStep, auditQAGeometry, makeQASequence, runWorldQA | data-candidate | absent |
| src/core/quad-lattice.js | boundsForCells, buildRegularLattice, clipPointsToRect, clipSegmentsToRect, drapeLattice, gridToLattice, intersectRect, latticeForGrid, latticeTriangles, mergeBounds, selectionBounds, windowEdgeSegments, windowForBounds | data-candidate | absent |
| src/core/radial-patch.js | PATCH_TEMPLATES, fitTemplatePatch, insertRadialPatch, insertRadialPatches, insertTemplatePatch, migrateWorldToPatch | data-candidate | absent |
| src/core/rectbin-c08.js | RectBin, churn, treeNodes | data-candidate | absent |
| src/core/region-boundary.js | cellOutline, regionBoundary | data-candidate | absent |
| src/core/region-groups.js | groupByConnection, regionCutRatio, regionGraphFromGrid, spreadCircles | data-candidate | absent |
| src/core/region-ids.js | regionComponentIds, regionIdAt | data-candidate | absent |
| src/core/river-network.js | planRiverNetwork | data-candidate | absent |
| src/core/rock-island-c08.js | rockIslandMesh | data-candidate | absent |
| src/core/rock-topology.js | measureOverhang, rockTopology | data-candidate | absent |
| src/core/route-preview.js | buildRoutePreview, buriedSamples, landArcs, roundCorners | data-candidate | absent |
| src/core/sediment-bands-c09.js | BAND_COLORS, BAND_SLOTS, BAND_TONES, SEDIMENT_BANDS_GLSL, bandHash, bandLine, bandRuns, bandTone, bandType, sedimentBandAt | data-candidate | absent |
| src/core/sediment.js | SEDIMENT_GLSL, sedimentOffset, sedimentPhase, unwarpSediment, warpSediment | data-candidate | absent |
| src/core/shore-loops.js | traceShoreLoops | data-candidate | absent |
| src/core/shore-profile.js | marchShore, sampleShoreline | data-candidate | absent |
| src/core/smoke-order.js | FIRE_CARD, fireCard, fireCardGLSL, fireLightLevel, smokeDepthOrder | data-candidate | absent |
| src/core/snapshot-replay.js | replayDelay, replaySnapshots | data-candidate | absent |
| src/core/space-visibility.js | bakeWorldVisibility, castWorldRay, fibonacciDirections, sampleWorldVisibility, sampleWorldVisibilityExact | data-candidate | absent |
| src/core/spatial.js | baryColor, baryCramer3, baryInside, baryPoint, baryPrep, baryPrep3, buildCellIndex, decorateCells, pointInQuad | data-candidate | different |
| src/core/spear-thrust.js | beginSpearThrust, stepSpearThrust | data-candidate | identical |
| src/core/sprite-ambiguity.js | chooseSpriteFlip, measureAmbiguity | data-candidate | identical |
| src/core/sprite-atlas.js | SpriteAtlas, radialPack | data-candidate | absent |
| src/core/story-datum.js | measureFacade, snapStoreyBands, windowRows, worldStoreyBands | data-candidate | absent |
| src/core/straight-skeleton.js | auditSkeleton, earClip, offsetRing, ringArea, skeletonTriangles, straightSkeleton | data-candidate | absent |
| src/core/stroke-reveal-c09.js | chainSegments, createLayerTimeline, createStrokeReveal3D, dedupeSegments, polylineLengthN, roundSeed, trimPolylineN | data-candidate | absent |
| src/core/stroke-reveal.js | createStrokeReveal, polylineLength, trimPolyline | data-candidate | absent |
| src/core/surface-decoration.js | solveFacadeDecoration, solveWallDecoration, validateFacade | main-thread | absent |
| src/core/swarm-maze.js | corridorMaze, insideMaze, spawnSwarm, triangulateMaze | data-candidate | absent |
| src/core/terrace-edges.js | finalSegments, terraceEdges, traceTerraceRings | data-candidate | absent |
| src/core/terrace-profile.js | meshSlopeProfile, terraceProfile | data-candidate | absent |
| src/core/terrain-burial.js | burialDepth, burialReport, buryColumn, neighborShade, raiseGround | data-candidate | absent |
| src/core/texel-skip.js | TEXEL_SKIP_GLSL, skipTexel | data-candidate | absent |
| src/core/town-skin.js | PLANT_RECT, SKIN_CELL, SKIN_FRAG_BODY, SKIN_FRAG_PARS, SKIN_GRID, SKIN_SIZE, SKIN_SLOTS, SKIN_VERT_BODY, SKIN_VERT_PARS, buildSkinAtlas, buildSkinMips, cellMean, scribble, skinAttributes, skinPattern, writePlantCorner | data-candidate | absent |
| src/core/trajectory-fan.js | DEFAULT_GRAVITY, analyticRange, defaultAngles, heightAtX, launchGrid, sampleTicks, solveLaunch, throwArc, trajectoryFan | data-candidate | absent |
| src/core/trajectory-trace.js | segmentBoxHit, traceArc | data-candidate | absent |
| src/core/trigraph-edit-c08.js | TriGraph, addTracked, checkLive, moveVertex, removeVertex | data-candidate | absent |
| src/core/trigraph.js | TriGraph | data-candidate | absent |
| src/core/ui-reveal.js | uiRevealAt | data-candidate | absent |
| src/core/unit-ground-height.js | easeUnitGroundHeight, easeUnitToHeight | data-candidate | different |
| src/core/unit-shadow.js | LIGHT_DIR, measure, shadowArea, unitShadow | data-candidate | different |
| src/core/unit-tier.js | setUnitAppearanceTier, unitTierAppearance | data-candidate | identical |
| src/core/uv-bake.js | bakeChartPage, checkerLitShade | data-candidate | absent |
| src/core/uv-charts.js | buildCharts, countChartOverlaps, radialChartPack, weldSoup | data-candidate | absent |
| src/core/uv-radial-atlas.js | chartHoles, clipIsland, contrastSimulation, dilatePage, islandFeatureBases, meshContrastGraph, paintCheckerPage, paintContrastPage, radialSpearman, rasterizeChartPage, topMergeCharts | data-candidate | absent |
| src/core/vertex-dual.js | dualFoliageSites, gridVertexDual, vertexDual | data-candidate | absent |
| src/core/vertex-openness.js | bakeVertexOpenness | data-candidate | absent |
| src/core/video-cycle-metrics.js | analyzeVideoFrames, rgbaToGray | data-candidate | absent |
| src/core/voxel-distance.js | voxelDistance | data-candidate | absent |
| src/core/voxel-ray.js | firstVoxelHit | data-candidate | absent |
| src/core/wake-sampling.js | KELVIN, advanceWake, makeWakeParticles | data-candidate | absent |
| src/core/wave-cycle.js | bakeWaveMotion, waveCrest, waveCycleGLSL | data-candidate | absent |
| src/core/wfc.js | cornerSlots, cornerVariantTiles, dependencyChain, diagnoseTiles, findWFCConflicts, jointSubtileCatalog, layerGrid, layeredJointCatalog, liftFootprint, repairWFC, solveWFC, solveWithModule, solveWithPrefab | data-candidate | absent |
| src/core/wind-flow.js | bakeSoftNormals, flagRibbon, meshCollider, packWindField, particleContactAlpha, sampleCurve, samplePackedWind, traceWind, windFieldGLSL | data-candidate | absent |
| src/core/wire-route.js | planWire, segmentCellInterval | data-candidate | absent |
| src/core/world-probes.js | makeWorldProbes | data-candidate | absent |
| src/core/world.js | MAX_LEVEL, World | data-candidate | different |
| src/life/atmosphere.js | Atmosphere | three-context | different |
| src/life/banner.js | createBannerTexture | three-context | identical |
| src/life/birds.js | Birds, findRoofPerches | three-context | identical |
| src/life/boats.js | Boats | three-context | absent |
| src/life/crab-swarm.js | CrabSwarm, attachCrabSwarm | three-context | absent |
| src/life/decor.js | Decor | three-context | different |
| src/life/effects.js | Effects, fireNoiseTexture, popShaderChunk | three-context | different |
| src/life/fire-coupling.js | FIRE_COUPLING, FIRE_COUPLING_TABLE, burstPlan, easeSizeMul, fireLight, igniteCurve, smokeSizeMul | data-candidate | absent |
| src/life/flora-species.js | FloraSpecies, LEVEL_SPECIES, SHAPE_PLAN, SPECIES_SHAPES, dualWallSites, speciesGeometry | three-context | absent |
| src/life/impostor-c09.js | fluffyCloudGeometry, localUpImpostorField, localUpView, patchBakedCloudColor, patchLocalUp, planetImpostorSites, radialMatrix, treeCrownGeometry, useUnlitVertexColors | three-context | absent |
| src/life/impostor.js | ImpostorBaker, ImpostorField, blobCloudGeometry, cloudGeometry | three-context | different |
| src/life/leaf-surface.js | LEAF_SURFACE_GLSL, makeLeafSurface | three-context | absent |
| src/life/smoke-c01.js | installSmokeShape, lobeFactor | three-context | absent |
| src/life/smoke.js | CROWN_STYLE, HAZE_STYLE, Smoke | three-context | absent |
| src/life/sound.js | Sound | main-thread | identical |
| src/life/splash-c07.js | CROWN_LIFE, CROWN_STRIPS, CrownSplash, RING_DELAYS, RING_LIFE, crownHeight, ringState | three-context | absent |
| src/life/sprite-pack-c09.js | LiveSpritePacker, SpritePackPlan, spriteMeshes | data-candidate | absent |
| src/life/unit-shadow-batch.js | UnitShadowBatch | three-context | different |
| src/life/unit-sprites.js | UnitSpriteBatch, renderUnit | main-thread | identical |
| src/life/vegetation.js | Vegetation, wallCardGeometry | three-context | different |
| src/light/bake.js | AO_MODES, bakeLighting, normalizeSunShadow | data-candidate | different |
| src/light/cloud-shadow.js | CLOUD_SHADOW_GLSL, CloudShadow | three-context | absent |
| src/light/cube-height.js | createCubeHeightLookup | three-context | absent |
| src/light/lightvolume.js | bakeLightVolume | data-candidate | absent |
| src/light/megatexture-gi-debug.js | lightVolumeImage, megaTextureImage, sdfImage | data-candidate | absent |
| src/light/megatexture-gi.js | bakeMegaTextureGI, buildMegaTexture, buildSdfUV, makeTracer, pearson, referenceTexelBounce, voxelizeWorld | data-candidate | absent |
| src/light/mip-chain.js | buildMips, levelStats, linearToSrgb, sampleAniso, sampleBilinear, sampleTrilinear, srgbToLinear | data-candidate | absent |
| src/light/mip-ground.js | checkMeanPreserved, compareFilters, laplacianEnergy, makeTestTexture, paint, renderGround, shimmerReport | data-candidate | absent |
| src/light/penumbra.js | bakeVoxelPenumbra, bakeWaterPenumbra | data-candidate | absent |
| src/light/surface-bounce.js | applySurfaceBounce, audit, bounce, bruteForce, cellAreaAt, directLight, luma, normalAt, rng, samplePattern, sampleSurface, surfaceFieldFromWorld, surfacePoint, visible, worldAt | data-candidate | absent |
| src/light/surface-shadow.js | GroundSurfaceShadow, SURFACE_SHADOW_GLSL, bakeFloorShadow, bakeSurfaceShadow, islandSeams, surfaceHeightsFromWorld, surfaceShadowStats, sweepSurfaceShadow | three-context | absent |
| src/light/texel-owner.js | TexelOwnerAtlas | data-candidate | absent |
| src/light/voxel-ao.js | FACE_DIRS, buildVoxelAO | data-candidate | absent |
| src/light/voxel-field.js | LAYERED_FIELD_GLSL, bakeVoxelSoftNormals, packLayeredField, sampleLayeredTexture | data-candidate | absent |
| src/render/opening-punch-layer.js | attachOpeningPunch, punchGeometry, punchMaterials | three-context | absent |
| src/render/opening-punch.js | PUNCH_REF, createFacadeScene, holePixelStats, isInsideOpening, openingArea, passOrder, planFacade | data-candidate | absent |
| src/sphere/planet-relax-c08.js | RELAX_STEPS, cellOutlineSegments, installRelaxAnim, relaxFrames | main-thread | absent |
| src/sphere/planet-smooth-c08.js | boundaryTurning, coastOutline, installSmoothCoast, levelBoundaries, smoothCoastSampler | main-thread | absent |
| src/sphere/planet-town.js | deformIntoCell, flipToDelaunay, houseModule, planetFusion, planetHouses, planetRivers, planetWorld, sphereQuality, sphericalDelaunayViolations, stereoProject, stereoUnproject, storeyHouseModule | data-candidate | absent |
| src/sphere/planet-wfc-c06.js | TILESETS, biomeField, planetTileGeometry, solvePlanetTiles, sphereTriGrid, tileConflicts | data-candidate | absent |
| src/sphere/planet.js | assemblyOrder, assemblySlice, buildPlanet, buildSphere, cornerPositions, moduleSizeReport, mushroomRatio, planetMesh, relaxConflictReport, sphereTopologyReport | data-candidate | absent |
| src/sphere/sphere-stages.js | STAGES, prepareStages, sphereStageFrame | data-candidate | absent |
| src/sphere/stereo-insert-c06.js | createInsertionReplay, liftToSphere, projectionOrder, relaxRetriangulate, triangulateSphere | data-candidate | absent |
| src/sphere/worldmap-material.js | attachWorldMap, worldMapTexture | three-context | absent |
| src/sphere/worldmap-shore.js | SHORE_PALETTE, shoreDistance, worldMapShoreColors | data-candidate | absent |
| src/sphere/worldmap.js | MAP_PALETTE, WORLDMAP_GLSL, buildWorldMap, elevationAt, fbm3, planetHeights3D, planetSurfaceColor, poleStretch, worldMapColors, worldMapTexel | data-candidate | absent |
| src/terrain/blotch-atlas.js | BLOTCH_RIM_GLSL, blotchHash, blotchMasks, blotchRimTint, blotchRimUniformValues, blotchWobble, buildBlotchRimField, createBlotchAtlasData, periodicFbm, sampleBlotchAtlas, swirlUV | data-candidate | absent |
| src/terrain/blotch-pattern.js | BLOTCH_GLSL | data-candidate | absent |
| src/terrain/blotch-tongue-c09.js | BLOTCH_TONGUE_GLSL, TONGUE_DEFAULTS, tongueAmount, tongueTopMask, tongueWallMask | data-candidate | absent |
| src/terrain/cage-c09.js | cageCollider, cageSlice, cageWallPoint, insideCage | data-candidate | absent |
| src/terrain/drainage.js | fillTerrainDepressions, liveLakes | data-candidate | absent |
| src/terrain/edge-square-relax.js | EDGE_ORDER, classifyWorldEdges, relaxMetrics, squareRelax | data-candidate | absent |
| src/terrain/features.js | addFeatures, forceChurch | data-candidate | different |
| src/terrain/field-pattern.js | FIELD_GLSL, fieldPlotId | data-candidate | absent |
| src/terrain/generate.js | carveRivers, digBasins, generateTerrain, linkRiversThroughLakes, relaxRiverSlopes, slopeMask | data-candidate | different |
| src/terrain/island-quality-c09.js | ISLAND_RULES, consistentIsland, deriveSeed, islandReport, islandVerdict, landComponents, pruneIslets | data-candidate | absent |
| src/terrain/island-viz-c09.js | cliffEdges, contourSegments, delaunaySteps, edgesOf, faceAO, faceShadow, featureSegments, heightSampler, orbitProject, softShadow, triAdjacency, triLevels, vertexAO | data-candidate | absent |
| src/terrain/mushroom-c04.js | MUSHROOM_CAPS, buildMushroomStack, mushroomReport | data-candidate | absent |
| src/terrain/patch-blend.js | abModes, buildPatchField, edgeJump, grassColor, makePatches, renderPatches, seamStats, shoreArcs, shoreColor, waterColor | data-candidate | absent |
| src/terrain/pipeline-job-c08.js | CLIP_RHYTHM, CTL, JOB_STAGES, createJobControl, makeJobSleep, runJob, stageDurations, startJob | data-candidate | absent |
| src/terrain/pipeline-job-worker-c08.js | 入口/副作用模块 | data-candidate | absent |
| src/terrain/pipeline-stages.js | STAGES, StageRunner, buildIsland, createSharedClock, delaunay, islandPoints, liftHeights, meshReport, revealedPoints, stagePlan | data-candidate | absent |
| src/terrain/river-collapse-c09.js | collapseRiversFirst, riverCollapseStats | data-candidate | absent |
| src/terrain/river-network.js | rebuildRiverNetwork | data-candidate | absent |
| src/terrain/rockforms-c09.js | bridge, capSlab, capUndersideArea, house, islandBase, leaningRidge, overhangLevel, pillar, rockScene | data-candidate | absent |
| src/terrain/shape.js | shapeTerrain, smoothingMetrics | data-candidate | different |
| src/terrain/shrub-band.js | SHRUB_BAND, SHRUB_BAND_SPREAD, shrubBandMul | data-candidate | absent |
| src/terrain/shrub-edges-c09.js | SHRUB_FOOT_STYLE, shrubEdgeFlags, shrubEdgeStats | data-candidate | absent |
| src/terrain/shrub-texture.js | SHRUB_DEFAULT_STYLE, SHRUB_GLSL, SHRUB_LAYER_FRAG, SHRUB_LAYER_VERT, SHRUB_TOOTH | data-candidate | absent |
| src/terrain/soft-tops.js | softCorners | data-candidate | absent |
| src/terrain/surface-pattern.js | SURFACE_DEFAULTS, SURFACE_PATTERN_GLSL, attachSurfacePattern, spBandTone, spCliff, spFieldLines, spFieldPhase, spGravel, spGround, spHash, spLine1, spLine2, spNoise, spWarp, spWobble, surfacePatternUniformValues, surfaceShade, validateSurfaceOptions | data-candidate | absent |
| src/terrain/terrain-collide.js | terrainCollider | data-candidate | absent |
| src/terrain/terrain-strokes-c09.js | cageSegments, strokeBounds, surfaceSegments, terrainStrokes | data-candidate | absent |
| src/terrain/terrainmesh.js | buildTerrain | data-candidate | different |
| src/terrain/walk-reach.js | cliffCrossings, landRoute, repairReach, walkComponents | data-candidate | absent |
| src/tools/comparison-pages.js | COMPARISON_PAGES, comparisonPage, comparisonSelection | data-candidate | absent |
| src/tools/merge-bench-c06.js | benchMerge, splitGeometry | three-context | absent |
| src/tools/mesh-audit.js | measureWorldSurface | three-context | absent |
| src/tools/obj-parse-c06.js | parseOBJ | data-candidate | absent |
| src/tools/objexport.js | downloadOBJ, geometryToOBJ | main-thread | absent |
| src/tools/video-cycle-capture.js | loadVideo, measureInWorker, sampleVideo | data-candidate | absent |
| src/tools/video-cycle-worker.js | 入口/副作用模块 | data-candidate | absent |
| src/ui/code-library-panel.js | 入口/副作用模块 | main-thread | absent |
| src/ui/comparison-page.js | 入口/副作用模块 | main-thread | absent |
| src/ui/coverage-progress.js | refreshCoverage | main-thread | absent |
| src/ui/environment-discovery.js | mountEnvironmentDiscovery | main-thread | absent |
| src/ui/environment-panel.js | mountEnvironmentPanel | main-thread | absent |
| src/ui/flow-markers.js | 入口/副作用模块 | main-thread | absent |
| src/ui/game-portrait-c01.js | GAME_DRAWERS, GAME_SLOTS, drawGamePortrait | data-candidate | absent |
| src/ui/game-ui-c06.js | edgeToward, mountGameUI, straightLineThrough | main-thread | absent |
| src/ui/house-project.js | exportHouseProject, importHouseProject | data-candidate | absent |
| src/ui/icon-ink.js | DEFAULT_ICONS, bbox, foldClosure, iconSvg, inkBalance, pathLen | data-candidate | absent |
| src/ui/icon-toolbar.js | mountIconToolbar | main-thread | absent |
| src/ui/learnpanel.js | mountLearnPanel | main-thread | different |
| src/ui/navigation-review.js | 入口/副作用模块 | main-thread | absent |
| src/ui/node-graph-editor.js | 入口/副作用模块 | main-thread | absent |
| src/ui/ornament.js | createOrnament, createSquiggleOrnament | three-context | absent |
| src/ui/scene-capability-panel.js | BATTLE_CONTROL_GROUPS, POST_CONTROLS, SCENE_CONTROL_GROUPS, mountSceneCapabilityPanel | main-thread | absent |
| src/ui/scene-enhancement.js | SCENE_ENHANCEMENTS, createSceneEnhancement, mountSceneEnhancement | main-thread | absent |
| src/ui/shading-panel.js | mountShadingPanel | main-thread | absent |
| src/ui/slot-portrait.js | SLOT_DRAWERS, drawSlotPortrait, drawSlotSilhouette, slotGeometry | data-candidate | absent |
| src/ui/view-combinations.js | VIEW_COMBINATIONS, createViewCombinationPreview, readViewToggle | data-candidate | absent |
| src/ui/walkthrough.js | mountWalkthrough | main-thread | identical |
| src/water/foam-mask.js | ObstacleFlow, auditWavePaths, buildFoamMask, chamferDistance, clampWavePaths, landFraction, rasterLand, sampleGrid | data-candidate | absent |
| src/water/land-distance.js | waterDistance | data-candidate | absent |
| src/water/reflection.js | makeReflectionMaterial, setReflectionStyle | three-context | absent |
| src/water/shore.js | buildShore, makeSkirtMaterial, makeWaveMaterial | three-context | different |
| src/water/waterfall.js | Waterfalls | three-context | absent |
| src/water/watervol.js | WaterVolume | three-context | absent |
| src/world/ao-mesh-debug.js | buildBakeShellGeometry | three-context | absent |
| src/world/app.js | 入口/副作用模块 | main-thread | different |
| src/world/bary-gizmo.js | BaryGizmo, gizmoState, pickGizmoCell | three-context | absent |
| src/world/battle-navigation.js | BattleNavigation, LADDER_RUNG, STAIR_STEPS_PER_LEVEL, STAIR_STEP_DEPTH | data-candidate | different |
| src/world/build-reel-c09.js | REEL_PRESETS, attachBuildReel, meshEdgeSegments | three-context | absent |
| src/world/cloud-deck-layer.js | CloudDeckLayer, TOWER_PUFFS, towerDensity, towerPuffs | three-context | absent |
| src/world/contour-overlay.js | ContourOverlay, THICK_COLOR_FRAG, THICK_COLOR_VERT, makeCornerSquare | main-thread | absent |
| src/world/doodle-overlay.js | DoodleOverlay | three-context | absent |
| src/world/fine-portals.js | LEG_INSET, LEG_RADIUS, UNIT_HEIGHT, buildFinePortals, undersideAt | data-candidate | absent |
| src/world/float-advect-gpu.js | GPU_VARIANTS, gpuAdvectionQuality | main-thread | absent |
| src/world/float-probe.js | probeFloatTargets | main-thread | absent |
| src/world/flying-town-c06.js | attachFlyingTown, liftColumns | three-context | absent |
| src/world/ground-palette-map.js | attachGroundPaletteMap, rasterCellColors | three-context | absent |
| src/world/island-snapshot.js | createIslandSnapshot, crispSnapshotCPU, downsampleMask, snapshotAlpha, snapshotMaterial, snapshotMetrics, snapshotTexture, upsampleBilinear, worldSilhouette | three-context | absent |
| src/world/layerednav.js | buildLayeredNav | data-candidate | different |
| src/world/nav-diagnostic-overlay.js | mountNavDiagnosticOverlay | three-context | absent |
| src/world/navgraph.js | buildNav, findNavPath, riverRouteStats, simplifyNav | data-candidate | different |
| src/world/navlayer.js | NavLayer | three-context | different |
| src/world/navmesh-flow.js | buildFaceDirs, buildNavMesh, buildPolyField, buildVertexField, faceGradient, flowAt, funnelPath, guardedFlowAt, heightAt, insidePoly, locate, midpointPath, moveOnMesh, navMeshFromLayeredGraph, navMeshFromTerraces, pathStats, portalsAlong, shortcutPath, stepCrowd | data-candidate | absent |
| src/world/outline-painted-normal.js | paintedNormalMaterial | three-context | absent |
| src/world/outline-pass.js | ScreenOutlinePass, screenEdges | three-context | absent |
| src/world/outline.js | OutlineLayers | three-context | different |
| src/world/palette-png.js | decodePngBytes, exportPalettePng, watchPalettePng | data-candidate | absent |
| src/world/penumbra-layer.js | PenumbraLayer | three-context | absent |
| src/world/penumbra-terrain.js | PENUMBRA_TERRAIN_GLSL, PenumbraTerrain, packPenumbraReceivers, samplePacked | three-context | absent |
| src/world/prop-anim-layer.js | PropAnimLayer, attachPropAnim, collectWorldProps, propVerts | three-context | absent |
| src/world/prop-anim-yard-r56.js | attachYardPropAnim, collectYardProps, yardPropVerts | three-context | absent |
| src/world/save.js | decodeWorld, encodeWorld, peekGridRadius | data-candidate | different |
| src/world/scenes.js | SCENES, buildScene, generateFusion | data-candidate | different |
| src/world/space-visibility.js | SpaceVisibilityOverlay | three-context | absent |
| src/world/terrace-edges.js | TerraceEdgeOverlay | three-context | absent |
| src/world/town-skin-layer.js | TownSkinLayer, recordVertexBase | main-thread | absent |
| src/world/townDemo.js | generateTown | data-candidate | identical |
| src/world/traffic.js | heightRaster, leftLaneTarget, localSeparation, narrowCells, passageMarkers, rasterAt, sightFade | data-candidate | different |
| src/world/trajectory-preview.js | mountTrajectoryPreview | three-context | absent |
| src/world/vertex-dual-overlay.js | VertexDualOverlay | three-context | absent |
| src/world/view-c04.js | C04_KEYS, dualCellSegments, installC04, parseC04, ssaoKernel | three-context | absent |
| src/world/view-c07.js | C07_KEYS, aoLayerField, installC07, parseC07 | main-thread | absent |
| src/world/view-c10.js | C10_KEYS, installC10, parseC10 | three-context | absent |
| src/world/view-c11-grassline.js | install, patchTuftShader | three-context | absent |
| src/world/view-c11-megagi.js | install | three-context | absent |
| src/world/view-c11-mountaintex.js | MOUNTAIN_TEX_GLSL, install, patchMountainShader | three-context | absent |
| src/world/view-c11-normalline.js | ND_TOKEN, install, nearestCopy, paintedNormalMaterial, patchCompositeSource, renderWithNormalFilter | three-context | absent |
| src/world/view-c11-shrubband.js | SHRUB_C11_GLSL, SHRUB_C11_WALL, install, patchShrubShader | three-context | absent |
| src/world/view-c11.js | C11_KEYS, C11_MODULES, installC11, parseC11 | main-thread | absent |
| src/world/view-mixed-persp.js | attachMixedPerspective | three-context | absent |
| src/world/view-post-extras.js | ORBIT_SMEAR_CENTER_GLSL, POST_EXTRAS, installPostExtras, parseFx, screenOmegaDt | main-thread | absent |
| src/world/view-shading.js | FEATURE_ORDER, SHADING_KEYS, ShadingExtras, shadingKeysFromURL | three-context | absent |
| src/world/view.js | DEFAULT_LEVEL, View | main-thread | different |
| src/world/visibility.js | VisibilityOverlay | three-context | absent |
| src/world/voxel-ghost.js | LAYER_PALETTE, cubeFaces, depthOf, hash01, isoProject, layerMaterials, phaseCounts, previewState, rasterizeBoxes, rasterizeMesh, spineColumn, voxelOrder | data-candidate | absent |
| src/world/worldmesh.js | WorldMesh | three-context | different |
