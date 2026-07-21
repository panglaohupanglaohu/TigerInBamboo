// GLB 资产加载：缓存 + 归一化（居中、落地、定尺寸、定向）
import * as THREE from "../assets/vendor/three/three.module.js";
import { GLTFLoader } from "../assets/vendor/three/jsm/loaders/GLTFLoader.js";

const loader = new GLTFLoader();
const cache = new Map();
let manifestPromise = null;

/** 后端给出的已生成模型清单；取不到（离线）则视为全部可用，走直接加载 */
function manifest() {
  if (!manifestPromise) {
    manifestPromise = fetch("/api/models")
      .then((r) => (r.ok ? r.json() : { models: [] }))
      .then((d) => new Set(d.models.map((n) => `/assets/models/${n}`)))
      .catch(() => null);
  }
  return manifestPromise;
}

/** 模型是否已生成（在服务端存在） */
export async function hasModel(url) {
  const set = await manifest();
  return set ? set.has(url) : true;
}

export function loadGLB(url) {
  if (!cache.has(url)) {
    cache.set(url, new Promise((resolve, reject) => {
      loader.load(url, (gltf) => resolve(gltf.scene), undefined, reject);
    }));
  }
  return cache.get(url);
}

/**
 * 把 TripoSR 生成的模型包装成可用尺寸：
 * - 以包围盒中心为原点，底部落在 y=0
 * - 按 targetHeight 或 targetSize 等比缩放
 * - yaw/pitch/roll 修正模型朝向（使"正面"朝 +Z）
 * 返回一个可克隆使用的 Group
 */
export function normalizeModel(raw, {
  targetHeight = 0, targetSize = 0,
  yaw = 0, pitch = 0, roll = 0,
} = {}) {
  const inner = raw.clone(true);
  inner.rotation.set(pitch, yaw, roll);
  inner.updateMatrixWorld(true);

  const box = new THREE.Box3().setFromObject(inner);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  let scale = 1;
  if (targetHeight > 0) scale = targetHeight / Math.max(size.y, 1e-6);
  else if (targetSize > 0) scale = targetSize / Math.max(size.x, size.y, size.z, 1e-6);

  const wrap = new THREE.Group();
  inner.position.sub(center);          // 居中
  inner.position.y -= box.min.y - center.y; // 底部对齐 y=0（相对 wrap 原点）
  wrap.add(inner);
  wrap.scale.setScalar(scale);

  // 统一开启阴影；TripoSR 顶点色材质保留
  inner.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true;
      o.receiveShadow = false;
      if (o.material) {
        o.material.roughness = 0.85;
        o.material.metalness = 0;
      }
    }
  });
  return wrap;
}
