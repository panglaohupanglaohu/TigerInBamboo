# 旧岸窄崖补接（局部候选，未默认安装）

API：`createTargetOldShoreApronField({castleMatrix,worldCurve:release.segments.center.oldShore,sampleTerrain:afterRetreatAndCliffCut,sampleSea,platforms:TARGET_CITY_PLATFORMS,maxChartX:-47})`。
返回`height(x,z,original,sea)`、`stations`、`report`。仅将海侧削坡后的基础高度喂给此field，再统一重建山mesh。不能将field自身作为sampleTerrain递归调用。

- 世界轨线不动，城堡chart处理高度。
- 实际双线车体上下八角投影的地侧边界之外再留2.4m，起近竖直海崖。
- 向原山最多15m寻找够高的实地接点，上部约为径向步道底标高；海侧完全不抬高。
- x>−47整段不填，保留桥头回街路、瀑布与供水区域；完整三平台ellipse都不变。
- 缺面/超距拒绝，没有nominal填海兜底。原山高点只可能保持，不会削低。

## 实际候选结果

14站/13段可建：旧岸x约−73..−95，宽4.5–15m。1.7m目标mesh实际新增59个查询点，最高抬16.69m（从水下脚到步道崖顶，不是抬山峰）。重建后新红/蓝与保留西线1089个1m车辆OBB对实际山三角均0相交，实际车底高度检查0侵入；山域外无命中仍单列。3项专属单测通过。

已实际看`old-apron-engineering-layout.png`：只补了西端窄崖，中央偏旧城的一段空带仍明显，因此不能声称整条旧岸都已贴崖。此图为CPU工程绘制，不是GPU实景。

## 15m范围内无法解决的段

x−48..−61：首次干陆距崖边15.5–25m，接近步道高度的原山面距21.5–31m。x−64..−71：干陆14–15m，但足够高的承台在15.5–16.5m。此候选保守未填上述段，不能通过忽略这些站来宣称完整成功。

主线程若采用本局部field，需要把剩余gap作为结构或布局限制说明；扩大填筑范围须明确重新审查，不在本模块偷偷解除max15m。

## 满载包络更新

`vehicleTop`现为显式可配置参数，默认5.71m（5.36+.35）；`walkwayHeight`默认6.9m。仍使用完整双线保守横包络±4.37m，八角投影不只检查轨心。建议root显式传`{vehicleTop:5.71,walkwayHeight:6.9,maxGap:15,maxChartX:-47}`避免与结构参数脱节。

重审后仍14站/13段可用，59个网格查询点抬高，最大18.253m。把独立实体审计OBB车顶同步升为5.71m后，1089个1m车位的山/原桥/planet三角相交仍为0、车底侵入0。外域无命中仍未转为通过。证据`old-apron-loaded-audit.json`；专属单测4项通过。所有大gap继续拒绝，没有扩15m范围，未改terrainCandidate。

## Extended lower rock link (candidate; not visual acceptance)

Explicit opt-in parameters: `profile:'stepped-rock-link', maxGap:32, walkwayHeight:6.9, vehicleTop:5.71, maxChartX:-47`. Default remains flat / 15 m. Actual first dry-land contacts limit this candidate to 26 m maximum width. This is a narrow approximately 3 m upper ledge and a 2 m transition down to a lower rock tier, not a uniformly raised 26 m plateau. The final 1.5 m blends into existing terrain. Existing higher terrain and full city platform ellipses are untouched.

Evidence: `old-apron-stepped-engineering-layout.png` and `old-apron-stepped-sections.png` were actually inspected. These are CPU engineering projections, not game screenshots; the front diagram draws tracks over terrain and does not prove rendered occlusion. The top diagram shows the old-shore gap substantially connected. Sections retain a small lower notch at the inland join (roughly 1–4 m in these examples); this is a remaining visual concern, not a claimed natural coastline acceptance.

Actual rebuilt 1.7 m mesh audit: 30 eligible stations / 29 segments; 204 mesh height queries changed, maximum rise 19.0348 m from the previously submerged toe. 8,333 samples inside the three complete platform ellipses are identical. The x > -47 bridge/waterfall region is excluded. 1,089 sampled vehicle poses across both replacement and retained-old lanes have zero triangle/OBB contacts and zero tested underbody terrain intrusions, using the loaded conservative top 5.71 m. Some underbody rays fall outside this terrain mesh and remain explicitly missing, not approved. The audit covers reconstructed target terrain, old bridge, and original planet sphere, not every currently loaded runtime object or continuous swept collision. No boat-route approval.

Five module tests pass, including stepped lower-bench preservation, seaward exclusion, platform protection, loaded envelope configuration, and determinism. Root must integrate explicitly and review GPU before accepting.

### v4 contact join correction
Supersedes the preceding notch limitation: the stepped profile no longer fades toward submerged original toe heights. It searches a further real contact at least as high as the lower tier, then interpolates to that measured height. Lower tier is retained 3–6 m below the upper shoulder, while higher original terrain is preserved. Maximum actual width is now 27 m. Six tests pass; the 8,333 protected-point comparison and 1,089 loaded-vehicle-pose audit were rerun with unchanged zero failures. Engineering section JSON/image updated. GPU acceptance still pending.
