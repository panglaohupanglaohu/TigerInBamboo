/**
 * 莫里斯风格包（第 3 步：从莫西斯湖散落的参数提取）。
 *
 * 现在的数值 = 场景原样（套用后外观不变，已用材质指纹与同机位截图核对）。
 * 以后改这里的颜色 / 粗糙度，场景代码不用动：
 *   town.walls   湖上建筑墙面 15 个色槽（world.palette）
 *   town.build   屋顶、灰泥、门窗等建筑固定色（建筑生成时读取）
 *   roles        各材质角色（styleMat 的第一个参数）；多色角色用 colorMap 逐色替换
 * 参考：docs/morris/BRIEF.md
 */
export default {
  id: 'morris',
  name: '莫里斯（挂毯花纹）',
  scenes: ['morris-lake'],
  refs: ['docs/morris/BRIEF.md'],
  town: {
    walls: ["#dd6a5f", "#eec463", "#85b780", "#6f9dc6", "#ac91c9", "#e8a377", "#c2ab8b", "#ecdfc4", "#8b9fa6", "#cf5348", "#dd9057", "#d3b96b", "#63a291", "#9dbdd7", "#cf9ab5"],
    build: {"roof": "#e07a52", "roofAlt": "#d96f4a", "roofTrim": "#8a3a32", "plaster": "#efe6d4", "stone": "#8d8f95", "stoneDark": "#6d6f76", "band": "#7d3836", "paving": "#5e6168", "pavingAlt": "#666970", "lawn": "#6f9a5e", "lawnAlt": "#679357", "tree": "#4e8558", "treeLight": "#5f9a63", "trunk": "#6e5443", "steel": "#33373e", "frame": "#f6f2e8", "glass": "#3d4b58", "door": "#5d4a3b", "chimney": "#e9e1d2", "rail": "#2f3238"},
  },
  roles: {
    'morris.botany.plant': {"colorMap": {"#1d3a30": "#1d3a30", "#2f5240": "#2f5240", "#40602f": "#40602f", "#536a43": "#536a43", "#55703a": "#55703a", "#665c3e": "#665c3e", "#756c45": "#756c45", "#7a8c48": "#7a8c48", "#9c7536": "#9c7536", "#9e2a26": "#9e2a26", "#b8322a": "#b8322a", "#baa77b": "#baa77b", "#c6a45e": "#c6a45e", "#c8402f": "#c8402f", "#c9a25a": "#c9a25a"}, "roughness": 0.89},
    'morris.flora.bouquet': {"colorMap": {"#a93632": "#a93632", "#c35140": "#c35140", "#c39743": "#c39743", "#e8d3a0": "#e8d3a0", "#f2dfae": "#f2dfae"}, "roughness": 0.78},
    'morris.flora.bouquet-heart-buds': {"colorMap": {"#55402a": "#55402a", "#c09843": "#c09843"}, "roughness": 0.8},
    'morris.flora.green': {"color": "#435d3b", "roughness": 0.88},
    'morris.flora.heads': {"color": "#ffffff", "roughness": 0.75},
    'morris.flora.rosette': {"color": "#ffffff", "roughness": 0.9},
    'morris.flora.stems': {"color": "#3b5a33", "roughness": 0.9},
    'morris.horse.body': {"colorMap": {"#174b53": "#174b53", "#1b2424": "#1b2424", "#1b4f63": "#1b4f63", "#302f2b": "#302f2b", "#b99b51": "#b99b51", "#cbb995": "#cbb995", "#e7dec4": "#e7dec4", "#f6e8c8": "#f6e8c8"}},
    'morris.island.gravel': {"color": "#c9bea0", "roughness": 1},
    'morris.island.ground': {"color": "#ffffff", "roughness": 1},
    'morris.island.walk': {"color": "#ffffff", "roughness": 1},
    'morris.lake.water': {"color": "#578e9c", "roughness": 0.32},
    'morris.princess.costume': {"colorMap": {"#3a3027": "#3a3027", "#4c5145": "#4c5145", "#4c6045": "#4c6045", "#752b2b": "#752b2b", "#966736": "#966736", "#b49a53": "#b49a53", "#b58548": "#b58548", "#d9b390": "#d9b390", "#e7dbc1": "#e7dbc1", "#e8d9ae": "#e8d9ae"}},
    'morris.princessPatrol.line': {"color": "#463a25"},
    'morris.townStage.town-voxels': {"color": "#ffffff", "roughness": 0.92},
    'morris.wildlife.animal': {"colorMap": {"#292c25": "#292c25", "#302d24": "#302d24", "#655b47": "#655b47", "#756344": "#756344", "#776c53": "#776c53", "#8a7652": "#8a7652", "#92724b": "#92724b", "#998353": "#998353", "#a48377": "#a48377", "#a4875d": "#a4875d", "#b95132": "#b95132", "#cab58a": "#cab58a", "#cbb48c": "#cbb48c", "#d3c29a": "#d3c29a", "#e1d0a9": "#e1d0a9", "#e6dab4": "#e6dab4"}, "roughness": 0.95},
  },
};
