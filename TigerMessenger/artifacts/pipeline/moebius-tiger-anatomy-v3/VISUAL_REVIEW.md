# 湖沼之虎 anatomy v3 — 实际几何候选

仅针对 TigerMessenger 中送信人与红狐营救的湖沼之虎。源为 src/assets/characters/moebiusTiger.js、src/world/moebiusTiger.js 和原 archived/optimized moebiusTiger .blend；输入为 assets/references/tiger/user-target-20260909.png。没有使用竹虎画、通用素材包或外部生成的替代动物。

## 实际过程与产物

真实 Blender MCP 首次握手成功后主线程队列计时器丢失；只读请求无响应。通过前台 Blender Console 检查得 server.running=True、command_queue存在、timer=False，仅重注册 timer，未重启、未保存覆盖当前未保存文件。恢复后所有 append、造型、纹理、导出、三轮渲染均成功通过真实 MCP execute_blender_code。初次失效及后续成功记录保留，未将失效请求算作成功。

独立 Tiger Anatomy V3 从优化源的只读副本追加；当前原文件仍为 moebiusTiger.blend、其用户未保存内容保留。输出 assets/models/optimized/moebius-tiger-anatomy-v3.blend 与 godot/assets/art-pilots/moebius-tiger-anatomy-v3.glb。原两个 .blend 的 SHA 与初始读取相同。

首轮改变：连续长躯干和后臀、厚肩胸颈，宽扁颅与鼻梁、双米白口鼻瓣及下颌，小圆耳，红眼、宽白趾，有前臂/后跗轮廓的四肢，保留8节但将竖毛笔尾改为后伸下垂长尾及白尖。原80节点与父链保留，新几何仍挂在原动画枢纽。原n4臀部球体融入n2连续躯干，保留n4节点为空几何。

第二轮实际图发现腿根平截面突出、颜色过暗/过灰、统一条纹机械。腿根锥收进躯干，头颈抬高；身体、腿、尾、面部分四张嵌入贴图，面部使用额纹与颊纹而不套同心圈。最后一轮校正sRGB亮度、缩小圆耳、压薄眉脊；final-front.png和final-side.png已实际查看。旧描边与新几何不再匹配，30个节点只保留身份，在引擎必须通过candidateHiddenOutline隐藏。

## 验证与装配

GLB验证：80原ID全部存在且父子关系匹配原source JSON；总90节点、71网格（30旧描边）、9440三角面、4嵌入PNG；n0根直接带 .4 scale。assembly.json 保存每节点新旧完整矩阵。Godot按新rest叠加原动作偏移，不重设旧绝对头/尾姿态；世界实例需替换n0的部署矩阵，不能再叠乘.4。

## 当前观感与剩余差距

正侧图显示躯干、四肢、爪子及下垂尾的轮廓已经有实质变化，圆耳和双白口鼻特征明确；旧短腿/三角猫耳/竖毛笔尾已改变。这仍是low-poly方向的候选：额颊纹的分叉和不规则性、肩颈与脸颊的连续毛流、眼眶与鼻翼细节尚未达到用户图的层次；硬分面的明暗仍偏强，不能宣称完成写实复刻。当前腿与身体使用原独立关节结构，运动时的相交/地面接触必须由Godot实际检查；本记录不代表驾驶、剧情、世界或动画验收完成。
