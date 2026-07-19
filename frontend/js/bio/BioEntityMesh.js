// 聚合实体：骨骼装配 + 蒙皮网格 + 壳层皮毛 + 状态机驱动
// 多层皮毛的着色器改写全部在构建期一次性编译（onBeforeCompile），
// 运行期只读时钟更新骨骼旋转 —— 不克隆材质、不改着色器，杜绝 WebGL 报错
import * as THREE from "three";
import { AnatomyRiggingEngine } from "./AnatomyRiggingEngine.js";
import { ProceduralSkinGenerator } from "./ProceduralSkinGenerator.js";
import { FelineLocomotionController } from "./FelineLocomotionController.js";

// 静态驻留的壳层皮毛顶点膨胀钩子：一次编译，终身复用
const FUR_VERTEX_HOOK = `
uniform float uFurOffset;
`;

// 高频噪声贴图（毛发发丝空隙），模块级单例
let _furNoise = null;
function furNoiseTexture() {
  if (_furNoise) return _furNoise;
  const N = 128;
  const data = new Uint8Array(N * N * 4);
  for (let i = 0; i < N * N; i++) {
    const v = Math.random() * 255;
    data[i * 4] = data[i * 4 + 1] = data[i * 4 + 2] = v;
    data[i * 4 + 3] = 255;
  }
  const tex = new THREE.DataTexture(data, N, N);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(24, 24);
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  _furNoise = tex;
  return tex;
}

export class BioEntityMesh extends THREE.Group {
  /**
   * @param {Object} familyNode - 数据仓库科节点（含 anatomyType）
   * @param {Object} speciesNode - 数据仓库种节点（dimensions/anatomicalRef/rendering）
   * @param {Object} [hooks] - { paintGeometry(geo) } 物种外观注入（如虎斑纹）
   */
  constructor(familyNode, speciesNode, hooks = {}) {
    super();
    this.species = speciesNode;
    this.currentState = "IDLE";

    // 1. 骨骼装配
    const rig = AnatomyRiggingEngine.createSkeleton(speciesNode, familyNode.anatomyType);
    this.boneMap = rig.boneMap;
    this.skeleton = rig.skeleton;
    rig.root.userData.baseY = rig.root.position.y; // 呼吸浮动基准
    this.add(rig.root);

    // 2. 程序化蒙皮网格（含权重）
    const geo = ProceduralSkinGenerator.generateSkinnedGeometry(
      speciesNode.dimensions, speciesNode.anatomicalRef, rig.skeleton.bones
    );
    hooks.paintGeometry?.(geo); // 物种外观（斑纹等顶点色）

    // 3. 基础皮肤
    const rc = speciesNode.rendering;
    const baseMat = new THREE.MeshStandardMaterial({
      vertexColors: !!rc.vertexColors,
      color: rc.baseColor ?? 0xffffff,
      roughness: rc.roughness ?? 0.85,
      metalness: 0,
      flatShading: false,
    });
    this.skin = new THREE.SkinnedMesh(geo, baseMat);
    this.skin.castShadow = true;
    this.skin.frustumCulled = false; // 蒙皮包围球不随骨骼更新，防止误剔除
    this.add(this.skin);
    // 关键：根骨挂在组上（与 skin 同级），bind 前必须更新组的世界矩阵，
    // 否则骨骼 matrixWorld 全是单位阵，逆绑定矩阵错误 → 头颈变形错位
    this.updateMatrixWorld(true);
    this.skin.bind(rig.skeleton);

    // 4. 壳层皮毛：构建期一次性编译 N 层（随骨骼同步变形）
    const layers = Math.max(0, Math.min(24, Math.round(rc.furLayers ?? 0)));
    const furLen = rc.furLength ?? 0;
    const noise = furNoiseTexture();
    this._shells = [];
    for (let i = 0; i < layers; i++) {
      const t = (i + 1) / layers;
      const mat = baseMat.clone();
      mat.transparent = true;
      mat.alphaMap = noise;
      mat.alphaTest = 0.08 + t * 0.55;   // 越外层越稀疏
      mat.opacity = 0.9 * (1 - t * 0.75);
      mat.depthWrite = false;
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uFurOffset = { value: t * furLen };
        shader.vertexShader = FUR_VERTEX_HOOK + shader.vertexShader.replace(
          "#include <skinning_vertex>",
          `#include <skinning_vertex>
          transformed += normalize(objectNormal) * uFurOffset;`
        );
      };
      const shell = new THREE.SkinnedMesh(geo, mat);
      shell.bind(rig.skeleton, this.skin.bindMatrix);
      shell.castShadow = false;
      shell.frustumCulled = false;
      shell.renderOrder = 2 + i; // 由内向外绘制
      this.add(shell);
      this._shells.push(shell);
    }
  }

  /** 切换行为状态：'IDLE' | 'WALK' | 'ROAR' */
  setBehaviorState(state) {
    this.currentState = state;
  }

  /**
   * 运行时逻辑 Tick（主循环调用）
   * @param {Object} ctx - { time, dt, gait, moving }
   */
  tick(ctx) {
    FelineLocomotionController.update(this.boneMap, {
      ...ctx, state: this.currentState,
    });
  }
}
