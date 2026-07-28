// 布景：静置装饰体。历史 GLB 资产路径已撤，统一走程序化环境（山石/竹等）。
import * as THREE from "../assets/vendor/three/three.module.js";

export class Scenery {
  constructor(scene) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
  }
}
