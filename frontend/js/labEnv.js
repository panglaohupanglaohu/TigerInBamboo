// 拟生环境：物种实验室预览用的轻量环境（地面/水面/障碍/气候），
// 复用语义化视觉，不参与重物理；仅提供 surface 上下文供生物在环境中反应运动。
import * as THREE from "../assets/vendor/three/three.module.js";

export const ENVIRONMENTS = [
  { id: "stream",   name: "溪涧", desc: "临水碎石浅滩", surface: "land",  water: false,
    props: { temp: 0.45, water: 0.85, cover: 0.55, relief: 0.35, slick: 0.10, open: 0.45 } },
  { id: "pond",     name: "梅塘", desc: "静水荷塘 · 禽可浮游", surface: "water", water: true,
    props: { temp: 0.70, water: 0.60, cover: 0.40, relief: 0.10, slick: 0.12, open: 0.60 } },
  { id: "snow",     name: "雪竹", desc: "积雪竹丛", surface: "land",  water: false,
    props: { temp: 0.10, water: 0.15, cover: 0.45, relief: 0.30, slick: 0.90, open: 0.75 } },
  { id: "mountain", name: "远山", desc: "苍岩疏林", surface: "land",  water: false,
    props: { temp: 0.25, water: 0.10, cover: 0.20, relief: 0.90, slick: 0.30, open: 0.85 } },
];

const GROUND_COLORS = {
  stream: 0xcdbf9a, pond: 0xb9c2a6, snow: 0xeef0f2, mountain: 0xc9c2b4,
};

export function createLabEnv(initial = "stream") {
  const group = new THREE.Group();
  group.name = "labEnv";

  // 承影地面（随环境换色）
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshStandardMaterial({ color: GROUND_COLORS.stream, roughness: 0.95 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // 水面（仅 pond 显形）
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 8),
    new THREE.MeshStandardMaterial({ color: 0x6f93a8, transparent: true, opacity: 0.6, roughness: 0.25, metalness: 0.1 })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = 0.02;
  water.visible = false;
  group.add(water);

  let decor = new THREE.Group();
  group.add(decor);
  let snow = null; // 雪粒 Points
  let current = null;

  function clearDecor() {
    decor.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    group.remove(decor);
    decor = new THREE.Group();
    group.add(decor);
    snow = null;
  }

  function buildDecor(id) {
    clearDecor();
    ground.material.color.setHex(GROUND_COLORS[id] ?? 0xcdbf9a);
    water.visible = ENVIRONMENTS.find((e) => e.id === id)?.water || false;

    if (id === "stream") {
      // 溪石
      const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a857c, roughness: 1 });
      for (let i = 0; i < 6; i++) {
        const r = 0.05 + Math.random() * 0.07;
        const rock = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 0), rockMat);
        rock.position.set(-1.6 + Math.random() * 1.2, r * 0.6, -0.4 + Math.random() * 1.4);
        rock.castShadow = true; rock.receiveShadow = true;
        decor.add(rock);
      }
      // 水带（沿 -z 的窄蓝条）
      const strip = new THREE.Mesh(
        new THREE.PlaneGeometry(1.1, 3),
        new THREE.MeshStandardMaterial({ color: 0x7fa6bd, transparent: true, opacity: 0.55, roughness: 0.3 }));
      strip.rotation.x = -Math.PI / 2; strip.position.set(-1.4, 0.012, 0);
      decor.add(strip);
    } else if (id === "snow") {
      // 竹丛剪影
      const stalkMat = new THREE.MeshStandardMaterial({ color: 0x4f6b4a, roughness: 0.9 });
      const leafMat = new THREE.MeshStandardMaterial({ color: 0x6f9a66, roughness: 0.9 });
      for (let i = 0; i < 7; i++) {
        const h = 1.4 + Math.random() * 1.2;
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, h, 6), stalkMat);
        stalk.position.set(1.4 + Math.random() * 1.3, h / 2, -1.2 + Math.random() * 2.4);
        stalk.castShadow = true; decor.add(stalk);
        const tuft = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.4, 6), leafMat);
        tuft.position.set(stalk.position.x, h + 0.15, stalk.position.z);
        decor.add(tuft);
      }
      // 落雪粒子
      const N = 400, pos = new Float32Array(N * 3);
      for (let i = 0; i < N; i++) {
        pos[i * 3] = (Math.random() - 0.5) * 4;
        pos[i * 3 + 1] = Math.random() * 3;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 4;
      }
      const sg = new THREE.BufferGeometry();
      sg.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      snow = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.03, transparent: true, opacity: 0.85 }));
      decor.add(snow);
    } else if (id === "mountain") {
      // 远山剪影（半透明深色面片）
      const mMat = new THREE.MeshBasicMaterial({ color: 0x6b6357, transparent: true, opacity: 0.5 });
      for (let i = 0; i < 3; i++) {
        const ridge = new THREE.Mesh(new THREE.PlaneGeometry(3 - i * 0.6, 1.1 - i * 0.2), mMat);
        ridge.position.set(-1 + i * 1.2, 0.6 - i * 0.15, -2.2);
        decor.add(ridge);
      }
    }
    // pond 仅靠水面 + 几片荷叶示意
    if (id === "pond") {
      const lotus = new THREE.MeshStandardMaterial({ color: 0x4f7a4a, roughness: 0.8, side: THREE.DoubleSide });
      for (let i = 0; i < 4; i++) {
        const leaf = new THREE.Mesh(new THREE.CircleGeometry(0.18, 12), lotus);
        leaf.rotation.x = -Math.PI / 2;
        leaf.position.set(-0.8 + Math.random() * 1.6, 0.025, -0.8 + Math.random() * 1.6);
        decor.add(leaf);
      }
    }
  }

  function setEnvironment(id) {
    if (current === id) return;
    current = id;
    buildDecor(id);
  }

  function update(dt, time) {
    if (snow) {
      const p = snow.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) {
        let y = p.getY(i) - dt * 0.4;
        if (y < 0) y = 3;
        p.setY(i, y);
        p.setX(i, p.getX(i) + Math.sin(time + i) * dt * 0.05);
      }
      p.needsUpdate = true;
    }
  }

  function envEntry() { return ENVIRONMENTS.find((e) => e.id === current) || null; }

  setEnvironment(initial);
  return {
    group,
    setEnvironment,
    update,
    get id() { return current; },
    get isWater() { return envEntry()?.water || false; },
    get isSnow() { return current === "snow"; },
    get waterLevel() { return 0.02; },
    // 地表打滑度（雪面最高），0 抓地 .. 1 易滑
    get slick() { return envEntry()?.props?.slick ?? 0; },
    // 量化工况，供习性库做适生度评估
    get props() { return envEntry()?.props || { temp: 0.5, water: 0.3, cover: 0.4, relief: 0.3, slick: 0.2, open: 0.5 }; },
  };
}
