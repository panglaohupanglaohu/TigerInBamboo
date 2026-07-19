// 物种数据仓库：纯数据配置，定义不同动物
// 以生物学拉丁学名组织：目(Order) → 科(Family) → 属(Genus) → 种(Species)
// anatomyType 指导骨骼装配器的关节走势：
//   DIGITIGRADE  趾行（猫科：肘后折、膝前凸、飞节悬空 —— 弹性 Z 形后肢）
//   UNGULIGRADE  蹄行（马科：直立负重关节）
//   SALTATORIAL  跳跃行（兔科：后肢极长且深度折叠，双腿同频蹬跃）
//   AVES         禽类（雉科：躯体由 AvianBodyBuilder 程序化构建，行为见 bird.js）
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
          // 生物学参考：肩高决定四肢长度与躯干倾斜；尾长 1.0m（独立锥形细分尾管）
          anatomicalRef: { withersHeight: 0.97, tailLength: 1.0 },
          rendering: {
            vertexColors: true,   // 虎皮为顶点色绘制（斑纹由物种层注入）
            roughness: 0.85,
            furLayers: 12,        // 壳层皮毛层数（2~24）
            furLength: 0.032,     // 毛尖最大外延（米，收紧防"刷子"刺感）
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
  LAGOMORPHA: {
    scientificName: "Lagomorpha",
    LEPORIDAE: {
      scientificName: "Leporidae",
      anatomyType: "SALTATORIAL", // 跳跃行：后肢极长深折、双腿同频蹬跃
      LEPUS: {
        TIMIDUS: {
          scientificName: "Lepus timidus",
          // 空间生存边界盒：宽 0.2m / 躯干高 0.30m（竖耳另由骨骼延伸，总高约 0.45m）/ 总长 0.5m
          dimensions: { width: 0.2, height: 0.30, length: 0.5 },
          anatomicalRef: { withersHeight: 0.22, earLength: 0.13, tailLength: 0.06 },
          rendering: {
            vertexColors: false,
            baseColor: 0xd3d3d3, // 雪兔冬毛：浅灰近白
            roughness: 0.7,
            furLayers: 10,
            furLength: 0.01,
          },
        },
      },
    },
  },
  ANSERIFORMES: {
    scientificName: "Anseriformes",
    ANATIDAE: {
      scientificName: "Anatidae",
      anatomyType: "AVES", // 禽类：躯体由 AvianBodyBuilder 程序化构建（行为见 goose.js）
      ANSER: {
        ALBIFRONS: {
          scientificName: "Anser albifrons", // 白额雁（寒梅归雁图之大雁）
          // 空间生存边界盒：宽 0.35m / 站高 0.78m（含伸颈）/ 全长 0.85m，翼展约 1.5m
          dimensions: { width: 0.35, height: 0.78, length: 0.85 },
          anatomicalRef: { withersHeight: 0.5, tailLength: 0.15, wingspan: 1.5 },
          rendering: {
            vertexColors: true,
            baseColor: 0x8a7a5f, // 灰褐羽
            roughness: 0.9,
            furLayers: 0,        // 羽而非毛：无壳层
            furLength: 0,
          },
        },
      },
    },
  },
  GALLIFORMES: {
    scientificName: "Galliformes",
    PHASIANIDAE: {
      scientificName: "Phasianidae",
      anatomyType: "AVES", // 禽类：躯体由 AvianBodyBuilder 程序化构建（非四足管线）
      CHRYSOLOPHUS: {
        PICTUS: {
          scientificName: "Chrysolophus pictus",
          // 空间生存边界盒：宽 0.18m / 站高 0.42m / 全长 0.75m（含修长尾羽）
          dimensions: { width: 0.18, height: 0.42, length: 0.75 },
          anatomicalRef: { withersHeight: 0.28, tailLength: 0.45 },
          rendering: {
            vertexColors: true,
            baseColor: 0xa8261f, // 红腹锦鸡：腹红背金
            roughness: 0.85,
            furLayers: 0,        // 羽而非毛：无壳层
            furLength: 0,
          },
        },
      },
    },
  },
};
