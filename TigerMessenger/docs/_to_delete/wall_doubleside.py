# -*- coding: utf-8 -*-
"""删格后看到的灰色网孔：墙是零厚度的单面 quad，从内侧看只剩描边壳。"""
import io, os
P = os.path.expanduser("~/mnt/TigerInBamboo/TigerMessenger/src/world/odysseyCitadel.js")
s = io.open(P, encoding="utf-8").read()

old = """    material = new THREE.MeshStandardMaterial({
      color: albedo,
      map,
      bumpMap: map,"""
new = """    material = new THREE.MeshStandardMaterial({
      color: albedo,
      map,
      bumpMap: map,
      // 墙体必须双面（主人 2026-09-05：「删除建筑单元后留下来的灰色网孔是什么」）。
      //
      // 体块几何只画朝空邻的外露面（makeExposedCellGeometry），那是对的、也确实
      // 在工作——探针实测：挖掉一个六面全包的内部格，邻域三角 1684 → 1814，
      // 邻格朝洞的那一面照长不误。问题出在**墙是零厚度的单面 quad**：
      // 一旦视线能看到墙的背面（删掉一片格之后到处都是这种剖面），
      // FrontSide 把墙整片剔掉，剩下 addOutline 那层向外扩的 BackSide 墨壳
      // 正对着你 —— 灰蓝色、还带着壳与壳互相穿插漏出的窟窿，就是「灰色网孔」。
      //
      // 双面是这里代价最小的正解：不加一个三角、不加一次 draw call，
      // 只是让背面也被光栅化；three 会为背面翻转法线，着色是对的。
      // 墙的背面在深度上比外扩的墨壳更近，画上去正好把墨壳挡住。
      // （屋顶/阳台等其它 pattern 不参与：它们不会被从背面看到，
      //   而且 roof 本来就被 applyInkOutlines 跳过。）
      side: pattern === "wall" ? THREE.DoubleSide : THREE.FrontSide,"""
assert old in s, "makeCanalMat 未匹配"
s = s.replace(old, new, 1)
io.open(P, "w", encoding="utf-8").write(s)
print("墙体材质改双面")
