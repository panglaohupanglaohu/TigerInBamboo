// 鸟类通用智能体：感知驱动的状态机（觅食 → 饮水 → 惊飞 → 栖止 → 归飞）
// 躯体可为程序化模型或图转 3D 的 GLB；行为骨架（对应《Artificial Fishes》
// 的 fear/thirst 内驱力与 evasive action）不随模型改变。
import * as THREE from "three";
import { groundHeight, streamCurve } from "./environment.js";
import { loadGLB, normalizeModel, hasModel } from "./assets.js";

export const BIRD_STATE = { FORAGE: "觅食", DRINK: "去饮水", DRINKING: "饮水", FLEE: "惊飞", PERCH: "栖止", RETURN: "归飞" };
const S = BIRD_STATE;

export class BirdAgent {
  /**
   * opts:
   *  name        面板显示名
   *  modelUrl    GLB 路径（缺省则程序化躯体）
   *  targetHeight/modelYaw  GLB 归一化参数
   *  forage/perch  觅食点 / 避险点 [x, z]
   *  flightArc   飞行抛物线高度
   *  walkSpeed   踱步速度
   */
  constructor(scene, config, opts = {}) {
    this.scene = scene;
    this.config = config;
    this.opts = Object.assign(
      {
        name: "锦鸡", modelUrl: null, targetHeight: 0.5, modelYaw: 0,
        forage: [6.5, -4.5], perch: [-8.5, 3.5],
        flightArc: 3.2, walkSpeed: 0.5,
      },
      opts
    );
    this.group = new THREE.Group();
    this.state = S.FORAGE;
    this.stateLabel = S.FORAGE;

    this.forageSpot = new THREE.Vector3(this.opts.forage[0], 0, this.opts.forage[1]);
    this.perchSpot = new THREE.Vector3(this.opts.perch[0], 0, this.opts.perch[1]);
    // 饮水点：溪涧曲线上距觅食点最近的岸沿
    let best = null, bd = Infinity;
    for (let i = 0; i <= 60; i++) {
      const p = streamCurve.getPointAt(i / 60);
      const d = p.distanceTo(this.forageSpot);
      if (d < bd) { bd = d; best = p.clone(); }
    }
    const toBank = new THREE.Vector3().subVectors(this.forageSpot, best).setY(0).normalize();
    this.drinkSpot = best.clone().addScaledVector(toBank, 1.05);

    this.pos = this.forageSpot.clone();
    this._target = this.forageSpot.clone();
    this._walkTimer = 0;
    this._drinkClock = 6 + Math.random() * 8;
    this._perchLeft = 0;
    this._flight = null;
    this._peck = 0;

    this.proceduralParts = [];
    this.isGlb = false;
    this._buildProcedural();
    if (this.opts.modelUrl) this._attachGLB(this.opts.modelUrl);
    scene.add(this.group);
  }

  async _attachGLB(url) {
    try {
      if (!(await hasModel(url))) return; // 尚未生成，保留程序化躯体
      const raw = await loadGLB(url);
      const model = normalizeModel(raw, {
        targetHeight: this.opts.targetHeight,
        yaw: this.opts.modelYaw,
      });
      this.modelRoot = new THREE.Group();
      this.modelRoot.add(model);
      this.group.add(this.modelRoot);
      for (const p of this.proceduralParts) p.visible = false;
      this.isGlb = true;
    } catch (err) {
      console.warn(`${this.opts.name} GLB 加载失败，保留程序化模型：`, err);
    }
  }

  // ---------- 程序化躯体（红腹锦鸡；GLB 缺失时的兜底） ----------
  _buildProcedural() {
    const cast = (m) => { m.castShadow = true; return m; };
    const paint = (geo, fn) => {
      const pos = geo.attributes.position;
      const colors = new Float32Array(pos.count * 3);
      const c = new THREE.Color();
      for (let i = 0; i < pos.count; i++) {
        fn(pos.getX(i), pos.getY(i), pos.getZ(i), c);
        colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
      }
      geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
    };
    const mat = () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 });
    const GOLD = new THREE.Color(0xd9a520), RED = new THREE.Color(0xa8261f);
    const BROWN = new THREE.Color(0x7a5a33), DARK = new THREE.Color(0x2b2016);
    const GREEN = new THREE.Color(0x1f5f3f);

    const bodyGeo = new THREE.SphereGeometry(1, 24, 18);
    bodyGeo.scale(0.15, 0.14, 0.23);
    paint(bodyGeo, (x, y, z, c) => {
      c.copy(RED).lerp(GOLD, THREE.MathUtils.clamp(y * 4 + 0.45 + z * 1.2, 0, 1));
    });
    this.body = cast(new THREE.Mesh(bodyGeo, mat()));
    this.body.position.y = 0.22;
    this.group.add(this.body);
    this.proceduralParts.push(this.body);

    this.head = new THREE.Group();
    this.head.position.set(0, 0.32, 0.16);
    const neckGeo = new THREE.SphereGeometry(0.075, 16, 12);
    paint(neckGeo, (x, y, z, c) => c.copy(GREEN).lerp(GOLD, THREE.MathUtils.clamp(y * 5 + 0.4, 0, 1)));
    this.head.add(cast(new THREE.Mesh(neckGeo, mat())));
    const crestGeo = new THREE.ConeGeometry(0.02, 0.12, 6);
    crestGeo.translate(0, 0.06, 0);
    const crestMat = new THREE.MeshStandardMaterial({ color: 0xe3b93a, roughness: 0.8 });
    for (let i = 0; i < 5; i++) {
      const crest = new THREE.Mesh(crestGeo, crestMat);
      crest.position.set((i - 2) * 0.018, 0.06, -0.01);
      crest.rotation.x = -1.9 - (i % 2) * 0.25;
      this.head.add(crest);
    }
    const beak = new THREE.Mesh(
      new THREE.ConeGeometry(0.018, 0.06, 8),
      new THREE.MeshStandardMaterial({ color: 0xd8c9a3, roughness: 0.6 })
    );
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0.0, 0.1);
    this.head.add(beak);
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x14100a });
    for (const s of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 8, 6), eyeMat);
      eye.position.set(s * 0.045, 0.02, 0.05);
      this.head.add(eye);
    }
    this.group.add(this.head);
    this.proceduralParts.push(this.head);

    this.wings = [];
    const wingGeo = new THREE.SphereGeometry(1, 12, 8);
    wingGeo.scale(0.03, 0.09, 0.16);
    paint(wingGeo, (x, y, z, c) => c.copy(BROWN).lerp(GOLD, THREE.MathUtils.clamp(-z * 3 + 0.4, 0, 1)));
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * 0.09, 0.26, 0.02);
      const wing = cast(new THREE.Mesh(wingGeo, mat()));
      wing.position.x = s * 0.02;
      pivot.add(wing);
      this.group.add(pivot);
      this.wings.push({ pivot, side: s });
      this.proceduralParts.push(pivot);
    }

    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.22, -0.2);
    const tailGeo = new THREE.BoxGeometry(0.045, 0.008, 0.55);
    tailGeo.translate(0, 0, -0.26);
    paint(tailGeo, (x, y, z, c) => {
      const band = Math.sin(z * 40) > 0.2;
      c.copy(band ? DARK : BROWN).lerp(GOLD, band ? 0.1 : 0.25);
    });
    for (let i = 0; i < 5; i++) {
      const f = cast(new THREE.Mesh(tailGeo, mat()));
      f.rotation.y = (i - 2) * 0.14;
      f.rotation.x = 0.12 + Math.abs(i - 2) * 0.05;
      this.tail.add(f);
    }
    this.group.add(this.tail);
    this.proceduralParts.push(this.tail);

    const legMat = new THREE.MeshStandardMaterial({ color: 0xc9b48a });
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 6), legMat);
      leg.position.set(s * 0.04, 0.07, 0);
      this.group.add(leg);
      this.proceduralParts.push(leg);
    }
  }

  // ---------- 行为层 ----------
  update(dt, time, tigerPos) {
    const cfg = this.config.pheasant;
    if (!cfg.enabled) { this.group.visible = false; return; }
    this.group.visible = true;

    const tigerDist = tigerPos
      ? Math.hypot(tigerPos.x - this.pos.x, tigerPos.z - this.pos.z)
      : Infinity;

    // 感知层：fear 压倒一切
    if (this.state !== S.FLEE && this.state !== S.PERCH && this.state !== S.RETURN) {
      if (tigerDist < cfg.fleeDistance) this._takeOff(this.perchSpot, S.FLEE);
    }

    switch (this.state) {
      case S.FORAGE: this._forage(dt, time); break;
      case S.DRINK: this._gotoDrink(dt); break;
      case S.DRINKING: this._drinking(dt, time); break;
      case S.FLEE: case S.RETURN: this._fly(dt, time); break;
      case S.PERCH: {
        this._perchLeft -= dt;
        this._idlePose(time);
        if (this._perchLeft <= 0 && tigerDist > cfg.returnDistance) {
          this._takeOff(this.forageSpot, S.RETURN);
        }
        break;
      }
    }

    if (this.state !== S.FLEE && this.state !== S.RETURN) {
      this.pos.y = groundHeight(this.pos.x, this.pos.z);
    }
    this.group.position.copy(this.pos);
    this.stateLabel = this.state;
  }

  _forage(dt, time) {
    const cfg = this.config.pheasant;
    this._drinkClock += dt;
    this._walkTimer -= dt;
    if (this._drinkClock > cfg.drinkInterval) {
      this.state = S.DRINK;
      this._target.copy(this.drinkSpot);
      return;
    }
    if (this._walkTimer <= 0) {
      this._walkTimer = 1.5 + Math.random() * 2.5;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * 1.6;
      this._target.set(this.forageSpot.x + Math.cos(a) * r, 0, this.forageSpot.z + Math.sin(a) * r);
      this._peck = Math.random() < 0.55 ? 0.9 : 0;
    }
    this._walkToward(dt, this.opts.walkSpeed);
    if (this._peck > 0) {
      this._peck -= dt;
      const k = Math.abs(Math.sin(time * 14));
      if (this.isGlb) this.modelRoot.rotation.x = k * 0.35;
      else this.head.rotation.x = k * 0.9;
    } else {
      if (this.isGlb) this.modelRoot.rotation.x *= 0.9;
      else this.head.rotation.x *= 0.9;
    }
    this._idleWings();
  }

  _gotoDrink(dt) {
    if (this._walkToward(dt, this.opts.walkSpeed * 1.2) < 0.1) {
      this.state = S.DRINKING;
      this._dipLeft = 3;
      this._dipTimer = 0;
      const dir = new THREE.Vector3().subVectors(this.drinkSpot, this.forageSpot).setY(0);
      this.group.rotation.y = Math.atan2(-dir.x, -dir.z);
    }
    this._idleWings();
  }

  _drinking(dt, time) {
    this._dipTimer -= dt;
    if (this._dipTimer <= 0) {
      this._dipLeft -= 1;
      this._dipTimer = 1.0;
    }
    const ph = (this._dipTimer % 1.0) * Math.PI;
    if (this.isGlb) this.modelRoot.rotation.x = Math.sin(ph) * 0.5;
    else this.head.rotation.x = Math.sin(ph) * 1.05;
    if (this._dipLeft <= 0) {
      this._drinkClock = 0;
      this.state = S.FORAGE;
      if (this.isGlb) this.modelRoot.rotation.x = 0;
      else this.head.rotation.x = 0;
    }
  }

  _takeOff(target, state) {
    this.state = state;
    this._flight = {
      from: this.pos.clone(),
      to: new THREE.Vector3(target.x, groundHeight(target.x, target.z), target.z),
      t: 0,
      dur: Math.max(this.pos.distanceTo(target) / 6.5, 1.4),
    };
  }

  _fly(dt, time) {
    const f = this._flight;
    f.t += dt / f.dur;
    const t = Math.min(f.t, 1);
    this.pos.lerpVectors(f.from, f.to, t);
    this.pos.y = THREE.MathUtils.lerp(f.from.y, f.to.y, t) + Math.sin(t * Math.PI) * this.opts.flightArc;
    const dir = new THREE.Vector3().subVectors(f.to, f.from);
    this.group.rotation.y = Math.atan2(dir.x, dir.z);
    this.group.rotation.x = -0.25 + (t > 0.8 ? (t - 0.8) * 2 : 0);
    if (this.isGlb) {
      // 无翼骨可扑：滑翔 + 侧滚摆动
      this.modelRoot.rotation.z = Math.sin(time * 3.2) * 0.12;
      this.modelRoot.rotation.x = 0.18;
    } else {
      const flap = Math.sin(time * 26) * 0.95;
      for (const w of this.wings) w.pivot.rotation.z = w.side * (0.5 + flap * 0.6);
      this.tail.rotation.x = 0.35;
    }
    if (f.t >= 1) {
      this.group.rotation.x = 0;
      if (this.isGlb) { this.modelRoot.rotation.z = 0; this.modelRoot.rotation.x = 0; }
      else this.tail.rotation.x = 0;
      if (this.state === S.FLEE) {
        this.state = S.PERCH;
        this._perchLeft = this.config.pheasant.perchTime;
      } else {
        this.state = S.FORAGE;
        this._walkTimer = 0;
      }
      this._flight = null;
    }
  }

  _idlePose(time) {
    if (this.isGlb) this.modelRoot.rotation.x = Math.sin(time * 2.2) * 0.03;
    else this.head.rotation.x = Math.sin(time * 2.2) * 0.08;
    this._idleWings();
  }

  _idleWings() {
    if (this.isGlb) return;
    for (const w of this.wings) w.pivot.rotation.z *= 0.85;
  }

  _walkToward(dt, speed) {
    const dir = new THREE.Vector3().subVectors(this._target, this.pos).setY(0);
    const d = dir.length();
    if (d > 1e-4) {
      dir.normalize();
      this.pos.addScaledVector(dir, Math.min(speed * dt, d));
      const targetYaw = Math.atan2(dir.x, dir.z);
      let dy = (targetYaw - this.group.rotation.y) % (Math.PI * 2);
      if (dy > Math.PI) dy -= Math.PI * 2;
      if (dy < -Math.PI) dy += Math.PI * 2;
      this.group.rotation.y += dy * Math.min(dt * 6, 1);
      this.pos.y += Math.abs(Math.sin(performance.now() * 0.012)) * 0.01;
    }
    return d;
  }
}
