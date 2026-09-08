# 罗马短剑兵：头盔与盔缨朝向修正候选

本次依据用户认可的 `assets/concepts/roman-soldier-target-v2.png`，修正已有模型头盔及扇冠朝向；不改变身体、裙甲、腰带、四肢、剑盾。输出独立 v3 文件，现用 v2 未覆盖。后台 Blender 构建，不争用前台 Blender MCP；Godot 导入与测试在隔离临时工程进行。

## 原因与确定的变换

- 原 `src/assets/harbor.js:1093` 左右臂沿 Z 分开，摆臂/摆腿绕 Z；`1331` 通过 `atan2(-hz,hx)` 令兵朝行进 +X；短剑枪头和盾面契约也以 +X 为前。
- v2 `refine_armor.py:33` 却把头盔脸前定义为 +Z，`assembly.json.frontAxis` 沿用了这个错误。原扇冠是 XY 面薄片，主面法线沿 Z。
- 已查看 `full-blue-view0/1/2/3-after.png`：标为“正面”的 +X 视角看到了薄扇冠和侧向头盔；持盾侧才出现完整正脸与扇冠，正好对应 90° 不一致。
- 修正仅作用于头盔上部：Three/Godot body-local 绕 +Y 转 +90°，即 `(x,y,z) -> (z,y,-x)`。+Z 盔前变成 +X。Blender Z-up 中对应绕 +Z 转 +90°。
- 盔缨三个原节点 `n11/n13/n15` 的本地矩阵左乘同样的 +90°Y，再叠加原 v2 的 `(0,-.018,0)`。因此正面能看见扇冠主面；不改变父级 n2，也不改变原羽片几何与红蓝材质。关闭恢复完整原本地矩阵。

注意 `Helmet_Galea` 这个网格除了头盔，还包含十颗腰部金色铆钉；不能简单把整个 MeshInstance 转90°。构建脚本依据明确分离的部件高度（原 body-local Y>.1）只转上部160个建模顶点，先断言没有面跨越分界；其余80个腰铆钉顶点精确不变。裙甲80、腰带80个建模顶点全部精确不变。

## 交付与回接

- `godot/assets/art-pilots/roman-armor-v3-direction.glb`：仍为3网格、1场景、所有节点 identity，只有头盔上部顶点改变。
- `assets/models/optimized/roman-armor-v3-direction.blend`：含独立可导出场景 `Roman Armor V3 Direction`；另有 `Roman V3 Direction Original Context`，展示真实原身体、头和按同一规则旋转的蓝色扇冠。上下文没有腿、手和武器，仅用于方向对照。
- `godot/scripts/roman_armor_direction_adapter.gd`：与原 armor adapter 相同 API，载入新资源并处理盔缨旋转；现用 `roman_armor_adapter.gd` 未改。
- `assembly.json`：新资源路径、frontAxis +X、crestRotationY=π/2、保留原偏移与隐藏节点。
- `build_direction_candidate.py`：从保留的 v2 .blend 可重现构建，独立写出 v3 GLB/.blend/assembly/上下文渲染。

主任务确认并导入新资源后，将候选 UI 的 armor adapter preload 指向 `roman_armor_direction_adapter.gd` 即可；无需重新转头盔节点。GLB 已烘焙上部旋转，再转一次会造成重复90°。回退只需使用原 adapter，v2 源文件仍在。

## 证据

- `build-report.json`：Blender实际修改的顶点数量、源 .blend 哈希与新 GLB 哈希。
- `glb-verification.json`：v2→v3 导出实际 POSITION 检验。裙甲/腰带误差0；上部预期旋转最大浮点误差5.27e-9；未出现整体节点旋转或反射缩放。v2哈希仍为23dfd3e9…。
- `godot-validation.json`：真实新 adapter + 原红蓝兵 + 剑盾适配，252组离散姿态全部通过。最大握持误差5.33e-7；盾与含新盔冠身体的支撑面最小分离0.18087177，与剑0.03287897；盔缨旋转、重复绑定、关闭恢复、解绑释放通过。
- `direction-front.png` / `direction-three-quarter.png` / `direction-side.png`：实际后台 Blender渲染。前两图已逐图查看，+X正面有脸部开口和展开扇冠；仍需主任务在真实Godot全身候选中完成视觉验收。此处不声称连续战斗动画已验收。

## 角色范围澄清

湖沼之虎是 TigerMessenger 故事中的待救援角色，与红狐关联救援线；不是“竹虎图”角色。当前罗马兵头盔修正不替换、不重命名虎角色。虎的唯一造型目标及动画挂点审计保留在 `artifacts/pipeline/tiger-anatomy-v3`，不能因工作区名 TigerInBamboo 而混同角色身份。
