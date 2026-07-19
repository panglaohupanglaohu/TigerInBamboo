// 物种数据仓库：纯数据配置，定义不同动物
// 以生物学拉丁学名组织：目(Order) → 科(Family) → 属(Genus) → 种(Species)
// anatomyType 指导骨骼装配器的关节走势：
//   DIGITIGRADE  趾行（猫科：肘后折、膝前凸、飞节悬空 —— 弹性 Z 形后肢）
//   UNGULIGRADE  蹄行（马科：直立负重关节）
export const BIOLOGICAL_TAXONOMY = {
  CARNIVORA: {
    scientificName: "Carnivora",
    FELIDAE: {
      scientificName: "Felidae",
      anatomyType: "DIGITIGRADE",
      PANTHERA: {
        TIGRIS: {
          scientificName: "Panthera tigris",
          // 空间生存边界盒：X 宽 / Y 总高(含昂起的头颈) / Z 总长(含头尾)
          dimensions: { width: 0.72, height: 1.24, length: 3.1 },
          // 生物学参考：肩高决定四肢长度与躯干倾斜
          anatomicalRef: { withersHeight: 0.97, tailLength: 1.15 },
          rendering: {
            vertexColors: true,   // 虎皮为顶点色绘制（斑纹由物种层注入）
            roughness: 0.85,
            furLayers: 12,        // 壳层皮毛层数（2~24）
            furLength: 0.048,     // 毛尖最大外延（米）
          },
        },
      },
    },
  },
  PERISSODACTYLA: {
    scientificName: "Perissodactyla",
    EQUIDAE: {
      scientificName: "Equidae",
      anatomyType: "UNGULIGRADE",
      EQUUS: {
        CABALLUS: {
          scientificName: "Equus ferus caballus",
          dimensions: { width: 0.65, height: 2.2, length: 2.5 },
          anatomicalRef: { withersHeight: 1.6, tailLength: 0.5 },
          rendering: {
            vertexColors: false,
            baseColor: 0x3b2314,
            roughness: 0.6,
            furLayers: 2,
            furLength: 0.005,
          },
        },
      },
    },
  },
};
