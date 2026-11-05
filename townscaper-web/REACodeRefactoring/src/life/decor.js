/**
 * decor.js — 让小镇"住着人"：旗子、"意大利电线"（彩旗绳 / 晾衣绳）、蝴蝶。
 *
 * 依据：
 *   1212732478458343424 "Added some flags. Gotta make it homely and welcoming."
 *     全帧复核：楼间/庭院彩旗绳随建筑布局增减；此ID不作为屋顶插杆旗的证据。
 *   1259838941299183619 "In code, these are called 'Italian Wires'"
 *     316帧复核：跨楼绳线也挂白色衣物，楼体加高/旋转时连接变化；不声称原作端点/求解算法。
 *   1273520600221433857 "Butterflies fly quite different from birds. Mine loosely orbit a potential landing spot,
 *     and drift by randomly switching that spot. Additional world space noise adds variability but also coherence (without boiding)"
 *     画面：花园里几只小蝴蝶在花丛上方绕圈，忽然飘去另一处。
 *
 * 做法：
 *   屋顶插杆旗（本地附加装饰）：每个建筑体量最高的屋脊点（来自 birds.js 的 findRoofPerches）插一根杆；旗面 6×3 细分，
 *         顶点着色器里沿旗面方向传播的正弦波 + 越靠外摆得越大；旗面朝向 = 风向（atmosphere.uWind）。
 *   电线：从外墙中点沿外法线做精确多边形裁切，0.6–2.2范围内按距离检验建筑墙，允许越过较矮屋顶；按共享逐层solid检查下垂/衣物/摆幅保守包络。
 *         抛物线下垂（中间最低），每隔一段挂一面三角彩旗/白色衣物；整根绳在风里轻轻荡（中间幅度最大）。
 *   蝴蝶：落点 = 小花和后院；每只绕自己的落点松散地转圈，随机换落点；
 *         速度里叠一个世界空间的噪声场 → 同一处的几只往同一边飘（有整体感，但不是 boids）。
 */

import * as THREE from 'three';
import { planWire } from '../core/wire-route.js';

function rng32(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

const FLAG_COLORS = ['#d9473f', '#f2c14b', '#3f7fc4', '#f4efe2', '#4f9a63'];
const PENNANTS = ['#e0574a', '#f3c84f', '#4d8ed1', '#f6f1e4', '#5fae6c', '#e98fb0'];

export class Decor {
  constructor({ scene, uTime, uWind, levelHeight = 0.5 }) {
    this.uTime = uTime; this.uWind = uWind; this.L = levelHeight;
    this.group = new THREE.Group();
    scene.add(this.group);

    /* ---- 旗子 ---- */
    const flagGeo = new THREE.PlaneGeometry(0.13, 0.075, 6, 3);
    flagGeo.translate(0.065, 0.19, 0);                  // 旗面左边贴着杆
    const poleGeo = new THREE.CylinderGeometry(0.004, 0.005, 0.24, 5);
    poleGeo.translate(0, 0.12, 0);
    this.flagMat = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
    this.flagMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.uniforms.uWind = uWind;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform vec3 uWind;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          vec3 org = (instanceMatrix * vec4(0, 0, 0, 1)).xyz;
          float u = clamp(transformed.x / 0.13, 0.0, 1.0);
          transformed.z += sin(u * 7.0 - uTime * 7.5 + org.x * 3.0) * 0.016 * u;
          transformed.y += sin(u * 5.0 - uTime * 6.0 + org.z) * 0.005 * u - 0.012 * u * u;`);
    };
    this.flags = new THREE.InstancedMesh(flagGeo, this.flagMat, 64);
    this.poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshLambertMaterial({ color: '#3a3b40' }), 64);
    for (const m of [this.flags, this.poles]) { m.count = 0; m.frustumCulled = false; this.group.add(m); }

    /* ---- 电线 + 彩旗 ---- */
    this.wireMat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.wireMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uTime;
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nattribute float aSway;\nattribute float aPhase;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float sw = sin(uTime * 1.6 + aPhase) * 0.03 * aSway;
          transformed.x += sw * 0.6; transformed.z += sw;`);
    };
    this.wires = new THREE.Mesh(new THREE.BufferGeometry(), this.wireMat);
    this.wires.frustumCulled = false;
    this.group.add(this.wires);

    /* ---- 蝴蝶 ---- */
    this.bN = 18;
    const wing = [];
    const span = [];
    for (const s of [1, -1]) {
      const pts = [[0, 0, 0.012], [0.032 * s, 0, 0.026], [0.036 * s, 0, -0.006], [0, 0, -0.008], [0.026 * s, 0, -0.028]];
      const tri = (a, b, c) => { wing.push(...pts[a], ...pts[b], ...pts[c]); span.push(Math.abs(pts[a][0]), Math.abs(pts[b][0]), Math.abs(pts[c][0])); };
      tri(0, 1, 2); tri(0, 2, 3); tri(3, 2, 4);
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(wing, 3));
    bg.setAttribute('aSpan', new THREE.Float32BufferAttribute(span, 1));
    this.flap = new THREE.InstancedBufferAttribute(new Float32Array(this.bN), 1);
    bg.setAttribute('aFlap', this.flap);
    const bm = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    bm.onBeforeCompile = (sh) => {
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', '#include <common>\nattribute float aSpan;\nattribute float aFlap;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float sx = sign(transformed.x);
          transformed.y += sin(aFlap) * aSpan;
          transformed.x = sx * aSpan * cos(aFlap);`);
    };
    this.butterflies = new THREE.InstancedMesh(bg, bm, this.bN);
    this.butterflies.frustumCulled = false;
    this.butterflies.count = 0;
    this.group.add(this.butterflies);
    this.bugs = [];
    this.spots = [];
    this.m = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(0, 0, 0, 'YXZ');
  }

  setLayer(name, on) {
    if (name === 'flags') { this.flags.visible = on; this.poles.visible = on; }
    if (name === 'wires') this.wires.visible = on;
    if (name === 'butterflies') this.butterflies.visible = on;
  }

  /**
   * @param world World
   * @param perches findRoofPerches 的结果（{x,y,z,cell,peak}）
   * @param spots 蝴蝶的落点（小花、后院格心）[{x,y,z}]
   */
  refresh(world, index, perches, spots, seed = 5) {
    const rnd = rng32(seed);
    const L = this.L;
    /* 旗子：每个建筑体量（按格子所属的连通体量）取最高的屋脊点，体量够高才插 */
    const { regions, regionOf } = world.regions();
    const best = new Map();
    for (const p of perches) {
      const r = regionOf?.[p.cell.id];
      if (r === undefined || r < 0) continue;
      const cur = best.get(r);
      if (!cur || p.y > cur.y) best.set(r, p);
    }
    let nf = 0;
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), col = new THREE.Color();
    const windYaw = Math.atan2(-this.uWind.value.z, this.uWind.value.x);
    for (const [r, p] of best) {
      if (nf >= 64) break;
      const reg = regions[r];
      if (!reg || reg.h < 3 || rnd() > 0.55) continue;
      q.setFromAxisAngle(up, windYaw + (rnd() - 0.5) * 0.3);
      m.compose(new THREE.Vector3(p.x, p.y - 0.01, p.z), q, new THREE.Vector3(1, 1, 1));
      this.flags.setMatrixAt(nf, m); this.poles.setMatrixAt(nf, m);
      this.flags.setColorAt(nf, col.set(FLAG_COLORS[(rnd() * FLAG_COLORS.length) | 0]));
      nf++;
    }
    this.flags.count = this.poles.count = nf;
    this.flags.instanceMatrix.needsUpdate = this.poles.instanceMatrix.needsUpdate = true;
    if (this.flags.instanceColor) this.flags.instanceColor.needsUpdate = true;

    /* 电线：外墙中点沿外法线走，碰到另一栋足够高的房子就拉 */
    const pos = [], colr = [], sway = [], phase = [];
    const done = new Set();
    let nw = 0;this.wireRoutes=[];
    for (const c of world.cells) {
      if (nw >= 18) break;
      const T = world.top(c);
      if (T < 3 || !world.topIsBuilt(c) || rnd() > 0.35) continue;
      for (let i = 0; i < c.n && nw < 18; i++) {
        const route=planWire(world,c,i,{levelHeight:L});
        if(!route)continue;
        const key=Math.min(route.source,route.target)+':'+Math.max(route.source,route.target);
        if(done.has(key))continue;done.add(key);
        this.#wire(pos,colr,sway,phase,route.A,route.B,rnd,nw);
        this.wireRoutes.push(route);nw++;

      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(colr, 3));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(sway, 1));
    g.setAttribute('aPhase', new THREE.Float32BufferAttribute(phase, 1));
    this.wires.geometry.dispose();
    this.wires.geometry = g;

    /* 蝴蝶 */
    this.spots = spots.length ? spots : perches.slice(0, 6).map((p) => ({ x: p.x, y: p.y, z: p.z }));
    this.bugs = [];
    const bcol = ['#f6f2e6', '#f3cf52', '#f0904a', '#86b6ea', '#f6f2e6'];
    const n = this.spots.length ? Math.min(this.bN, 4 + this.spots.length) : 0;
    for (let k = 0; k < n; k++) {
      const s = this.spots[(rnd() * this.spots.length) | 0];
      this.bugs.push({ spot: s, pos: new THREE.Vector3(s.x, s.y + 0.2, s.z), vel: new THREE.Vector3(), ph: rnd() * 6.28, rad: 0.12 + rnd() * 0.15, sw: 3 + rnd() * 6, flap: rnd() * 6 });
      this.butterflies.setColorAt(k, col.set(bcol[k % bcol.length]));
    }
    this.butterflies.count = n;
    if (this.butterflies.instanceColor) this.butterflies.instanceColor.needsUpdate = true;
    return { flags: nf, wires: nw, butterflies: n };
  }

  #wire(pos, colr, sway, phase, A, B, rnd, idx) {
    const len = Math.hypot(B[0] - A[0], B[2] - A[2]);
    const sag = 0.06 + len * 0.06;
    const P = (t) => [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t - sag * 4 * t * (1 - t), A[2] + (B[2] - A[2]) * t];
    const w = 0.005;
    const dark = [0.18, 0.18, 0.2];
    const S = 14;
    const ph = rnd() * 6.28;
    const push = (p, c, s) => { pos.push(...p); colr.push(...c); sway.push(s); phase.push(ph); };
    for (let k = 0; k < S; k++) {
      const t0 = k / S, t1 = (k + 1) / S;
      const p0 = P(t0), p1 = P(t1);
      const s0 = 4 * t0 * (1 - t0), s1 = 4 * t1 * (1 - t1);
      push([p0[0], p0[1] + w, p0[2]], dark, s0); push([p1[0], p1[1] + w, p1[2]], dark, s1); push([p1[0], p1[1] - w, p1[2]], dark, s1);
      push([p0[0], p0[1] + w, p0[2]], dark, s0); push([p1[0], p1[1] - w, p1[2]], dark, s1); push([p0[0], p0[1] - w, p0[2]], dark, s0);
    }
    // 三角彩旗
    const n = Math.max(3, Math.round(len / 0.085));
    const c = new THREE.Color();
    for (let k = 1; k < n; k++) {
      const t = k / n, t2 = Math.min(1, t + 0.45 / n);
      const p0 = P(t), p1 = P(t2);
      const mid = [(p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2 - 0.045, (p0[2] + p1[2]) / 2];
      c.set(PENNANTS[(idx * 3 + k) % PENNANTS.length]);
      const s = 4 * t * (1 - t);
      if(idx%2===0&&k%2===0){
        const depth=.06,lo0=[p0[0],p0[1]-depth,p0[2]],lo1=[p1[0],p1[1]-depth,p1[2]],white=[.92,.91,.86];
        for(const v of[p0,p1,lo1,p0,lo1,lo0])push(v,white,s);
      }else{push(p0,[c.r,c.g,c.b],s);push(p1,[c.r,c.g,c.b],s);push(mid,[c.r*.85,c.g*.85,c.b*.85],s);}

    }
  }

  update(dt, sampleWind) {
    dt = Math.min(dt, 0.05);
    const t = this.uTime.value;
    const n = this.bugs.length;
    for (let k = 0; k < n; k++) {
      const b = this.bugs[k];
      b.sw -= dt;
      if (b.sw <= 0) {   // 随机换一个附近的落点
        const near = this.spots.filter((s) => Math.hypot(s.x - b.spot.x, s.z - b.spot.z) < 2.5);
        b.spot = near[(Math.random() * near.length) | 0] || b.spot;
        b.sw = 3 + Math.random() * 6;
      }
      b.ph += dt * 1.6;
      const target = new THREE.Vector3(b.spot.x + Math.cos(b.ph) * b.rad, b.spot.y + 0.16 + Math.sin(b.ph * 1.7) * 0.06, b.spot.z + Math.sin(b.ph) * b.rad);
      // 世界空间噪声：同一片空域里的蝴蝶往同一边飘
      const nx = Math.sin(b.pos.z * 2.1 + t * 0.7) + Math.sin(b.pos.y * 3.0 - t * 0.4);
      const nz = Math.cos(b.pos.x * 1.9 - t * 0.6) + Math.sin(b.pos.y * 2.7 + t * 0.5);
      b.vel.lerp(target.sub(b.pos).multiplyScalar(2.2).add(new THREE.Vector3(nx * 0.12, Math.sin(t * 3 + k) * 0.08, nz * 0.12)), Math.min(1, dt * 3));
      b.pos.addScaledVector(b.vel, dt);
      b.flap += dt * 22;
      this.flap.setX(k, Math.sin(b.flap) * 1.1);
      this.e.set(0, Math.atan2(b.vel.x, b.vel.z), 0);
      this.q.setFromEuler(this.e);
      this.m.compose(b.pos, this.q, new THREE.Vector3(1.4, 1.4, 1.4));
      this.butterflies.setMatrixAt(k, this.m);
    }
    if (n) { this.butterflies.instanceMatrix.needsUpdate = true; this.flap.needsUpdate = true; }
  }
}
