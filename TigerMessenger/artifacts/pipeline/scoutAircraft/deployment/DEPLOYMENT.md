# 侦察机：真实防卫队静态部署适配

## 身份与配置

`src/scenes/messengerIsland.js:381-402` 创建五架防卫队，前三架在舰队锚点存在时承担舰队角色，其余两架守城/门区；旧 `tripleGateScoutAircraft` 地标现在是整个 squad 的兼容别名。`src/world/scoutDefense.js:605-613` 五架都调用同一 factory，唯一传参 `scale:0.72`，随后设置 index/forward、home position 和朝向。候选来自同 factory 的默认 scale=1 原始归档，n0 单位变换，运行时完整复制原实例变换到候选外层，不叠加 .72。不存在单独 mounted .86 实例，不能按 landmark 名误认。

`godot/data/scout-placement-audit.json` 保存五个 GLB node index、exact sourcePath、父 sourcePath、完整矩阵及源码/GLB SHA。`tools/pipeline/audit_scout_placement.py` 可重新生成；此文件是原快照身份审计，candidateReplacementEnabled=false 表示它自身不部署，实际部署状态见 world-validation.json。

## 实现

`original_world.gd` 的 `scout_candidate_preview` 为可回退开关；UI 也可切换和近看。先验证全部五架 source/parent，再准备全部候选，成功后才挂到同一个原 squad 并隐藏相应原子树；不隐藏 squad、不改原节点矩阵。关闭时原可见状态恢复，再次打开不重复创建。每实例独立 runtime adapter 保留 46 个 source IDs，恢复灯和挂点；没有 mounted hover，也没有移植驾驶或防卫队 AI。

## 实测

`test_scout_placement_identity.gd` 加载当前已导入 GLB，五架精确身份/父级/世界矩阵/scale .72 全部通过。`test_scout_world_deployment.gd` 实际加载完整 original_world，验证五架候选各46ID、原位同父同完整矩阵、单一可见版本、座舱/炮口世界坐标、原callback未挂载early return、回退恢复、二次打开不增加候选。通过桌面 Compatibility renderer 生成同相机 world-original.png / world-candidate.png；headless 用于结构检查，截图来自实际 GUI renderer。未启动 editor import 进程。

已人工查看图片：第4架位于原球面高空，机体轮廓、位置一致，候选舱罩透明后能看到深色内衬，面板/翼根倒角细节可辨。当前世界材质和海陆表现仍处在原作迁移阶段，截图不能证明概念目标全面完成。当前被替换的原快照有四架只带少量可见 mesh（采样时远景可见状态），候选为完整模型；此批未移植飞机 LOD，不能称性能收口。

完成范围：Godot 原快照世界内的五架静态候选部署与回退已实测。未完成：动态编队、巡逻/目标扫描/战争交互、驾驶、全部距离 LOD、Web 回接。不调整 currentResource，不把静态部署说成完整行为完成。
