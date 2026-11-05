# 双格房屋工程：身份与编辑回执持久化

## 视频学习承接
先按1579483114178768898读README，沿用multicell-review.md / multicell-edit-review.md已复核全部177帧。本轮新增帧0。视频提出跨方格/三角格的多格tile，本轮解决本地编辑记录的持久化，不声称视频展示过JSON存档。

## 接口与实现
既有v5位体素存档保持原格式。新增UI协调层house-project.js，exportHouseProject(world,entries,{scene,instanceIds})生成版本1工程JSON；importHouseProject(world,text,{expectedScene})先在临时World解码和审核，全部通过后仅一次restore发布。工程包附v5体量、完整网格几何/邻接签名、稳定实例ID及整栋回执。ID与placement描述分离，所以整栋替换/移除及撤销保留同一实例身份；空槽也可保留ID。

验证2格邻接、楼层/层数、列位掩码、岩石支撑、修改前后关系、当前体量匹配、ID唯一、占用不交叠、场景/网格一致、v5可往返和规范编码。限制128条记录、2MB文本，错误/截断/不匹配在写入前拒绝。没有信任传入before列而直接改岩石；元数据不是第二份权威占用。

multicell.html新增“生成工程JSON/载入工程JSON”和复制保存区；载入后仍能整栋编辑。现有页面撤销也同步实例ID。需用户复制JSON保存，当前未自动写磁盘、localStorage或接入主游戏存档入口。

## 验证
house-project.mjs在两种网格检查持久化往返、ID保持、重新载入后整体移除、冻结数据、重复ID/伪造before/截断体素/网格和场景不匹配零写入；墓碑空槽保留。house-project-browser.cjs在两种真实融合场景，先整栋改两层并导出，完整重载页面后粘贴工程，恢复两层和自定义ID，再整栋移除/撤销；错误工程不改变World版本或体素。报告house-project-browser.json，截图house-project-{mixed,quad}.png已查看。既有multicell-edit逻辑/浏览器及v5往返回归通过。

## 边界
这是双格房屋工程格式及验收页接线；不含跨页面撤销历史、通用5格module-volume的身份或任意prefab库。完整网格签名让文件约0.35/0.50MB，尚未压缩；几何/网格生成改变时明确拒绝，不自动迁移。完整轮廓socket、旋转与联合WFC仍待续。没有同步TigerMessenger或宣称游戏已用上新格式。
