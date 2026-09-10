# 原世界实例绘制恢复

旧世界导出将 Three.js 原 InstancedMesh 展开为普通 GLB 子节点。实际文件含71组8503个实例，使用16208个网格表面。其中鸟群6000个实例有12000个表面，导致大量重复绘制；本轮不删除鸟群或减少原位置数量。

`tools/pipeline/index_original_instances.py`依据原导出器的明确子节点格式读取真实GLB，生成带源SHA与逐实例矩阵的manifest。`godot/scripts/original_instance_adapter.gd`严格核对父sourcePath、数量、原矩阵、同一网格、材质、可见性和阴影；只恢复相同模型的GPU实例绘制。父节点与8503原子节点保留，新批次继承父运动；可restore回旧显示。

不是一般角色合并工具：含蒙皮、形变、不同材质/几何/局部状态的组会拒绝。现作用于原世界静态归档；未来每个实例的动画需调用refresh同步变换，不能宣称鸟群/桨手原动作已经自动迁移。原导出本已未完整保留instanceColor，此步骤不虚构已恢复其颜色。

实际Apple M2 OpenGL检查：71组、8503变换一致、材质相同、重复调用不叠加、恢复通过，理论表面提交16208→137。证据 `artifacts/pipeline/original-instance-restore/report-gpu.json`。无声headless Dummy后端的transform回读不成立，失败报告另保留；不能凭其判断GPU实例正确性。实际战斗同镜头绘制数/画面对照由世界集成另测，不能用理论数冒称FPS提升。

Godot API依据：https://docs.godotengine.org/en/stable/classes/class_multimesh.html 。每批手工设置联合AABB；批次按原父分组，避免把整个球体并成一个不可剔除的大物体。

## GPU画面对照

`artifacts/pipeline/original-instance-restore/birds/visual-report.json`：隔离6000只原鸟群，固定相机/光照，前后52000个primitive完全相同，12000→12次实际绘制，图片逐字节0差。两图均有实际鸟群且已查看。该测试不代表完整战场FPS。原静态世界另一视角23214→20151次绘制、0像素差，但海面遮住多数对象，不能作为实战代表；实战开始同镜头由world r34测得11545→10296，约10.8%减少，其它大量模型仍待后续优化。

## 同材质盒体表面复原（本轮）

新增original_surface_adapter.gd仅处理原电车/两处圣城内不透明、同一材质、六面盒体，每面4或6顶点、6索引；不焊点/减面/合并节点，不处理蒙皮、形变、透明物体或大网格表面。源GLB不改，运行时使用可恢复ArrayMesh副本。2602个对象的15612个表面合为2602，84924顶点/93672索引不变，位置与UV误差0，原材质资源不变。Godot法线重新编码的最大向量误差3.22e-5（小于0.006度），不宣称位级相同。

实际红电车同相机/光照，372→97 calls，1046 primitives不变，图像最大1/255字节误差，超过1的差异像素分量0。证据artifacts/pipeline/original-surface-restore/report.json及tram-before/after.png。完整战场帧率须另测，不用此比例冒充FPS提升。首轮只接受4顶点面而漏掉原facet的6顶点面，诊断report-initial-four-vertices.json保留。
