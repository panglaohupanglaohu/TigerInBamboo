# Godot 世界 GLB 高级导入材质冲突修复

2026-09-08。只修改材质名字，不改视觉内容。用户编辑器曾显示 `scene_import_settings.cpp:234 p_material != material_data.material` 与递归 reimport 错误；累计数不是本轮新增错误数。

## 已确定并修复

世界 GLB 的 874 个不同材质仅有 4 个名字。Godot 4.7 的 `SceneImportSettingsDialog::_fill_material` 以 import_id 或 name 建 material_map，随后第 234 行要求同键引用相同。该错误与重复名称精确对应。生产 exporter 原先只写 `m.name || m.type`，现改为加确定性的材质索引后缀；重用同一 Three 材质仍只导出一项。

原文件与 manifest 已备份在本目录。`material-name-mapping.json` 保留 874 条映射；`material-name-verification.json` 证明完整 BIN 字节和 SHA 不变、全部非材质 JSON 深等、全部材质除 name 外深等。节点、层级、动画、位置、法线、UV、纹理、PBR 未改变。世界 manifest 只同步实际 bytes。使用现有编辑器自动检测，不另开 import 进程。

生产 exporter 已以实际 vendored Three 创建三个材质（两个默认同名、一个刻意带后缀）和四个 mesh 验证：名字唯一，共用材质不重复，两次导出逐字节相同，见 exporter-test.json。

## 尚未证明

递归错误来自 EditorFileSystem::reimport_files 的 `importing` 同进程重入保护。该保护不能独自证明有两个 Godot 进程互撞，也不能仅凭名称冲突证明它是同一原因。检查时只有一个编辑器及一个游戏预览，没有 headless importer。高级预览的自定义 reimport 入口调用 `_reimport_file`，不直接调用这个 guarded reimport_files；嵌入贴图的扫描/重导是否间接触发需要完整当时调用栈，当前没有。7 张源图均嵌入 GLB 且提取 PNG 存在；PNG 导入配置更新与原 PNG 未变化的现象不足以作根因结论。

当前没有读取编辑器输出管道（避免消耗其输出），因此未声称 78,676 历史错误消失或错误增长已停止。需在编辑器自动导入后清空输出并再次打开高级导入预览观察新增错误；此项由前台负责人验证。

来源：[Godot 4.7 材质映射源码](https://github.com/godotengine/godot/blob/4.7/editor/import/3d/scene_import_settings.cpp#L204-L234)、[Godot 4.7 文件系统重导源码](https://github.com/godotengine/godot/blob/4.7/editor/file_system/editor_file_system.cpp)。相应源码摘录存于本目录。
