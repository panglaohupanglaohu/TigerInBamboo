/**
 * 第 56 批 C03：Bad North 玩法 / 展示片子的 Battle 扩展（除 `houseFx` 默认开外其余默认关；URL 参数 =1 或 battle.c03.set(name, on) 打开）。
 *
 *   kpow     1092709665199345664「k-pow !!」：一次性爆炸编排 explodeAt（白点→亮黄白火球 2–3 帧膨胀再收缩变暗 + 正下方红色焦痕贴片
 *            渐变成焦黑 + 橙色火星 + 接上的黑烟）；演示模式每 3.5 s 在岸边炸一次，崖顶挂红底白字「k-pow !!」横幅。
 *   houseFx  828984794407170048 / 1007587828992266240：小屋失守 → 先烧（已有火源）→ 2.2 s 后火球爆开（粉色辉光大球）→ 屋体焦黑
 *            （直接压暗渲染网格里这栋屋的顶点色，不另盖一层假模型）+ 屋下/崖缘焦痕 + 持续黑烟。
 *   torches  890611046435627008：维京人到了小屋附近不再只是「站够 4 s」，而是朝屋子抛火团（抛物线、带火星拖尾），命中就加燃烧进度、
 *            屋顶冒一簇火。
 *   plunge   995034777756536833：指挥官能力 Plunge——底部三颗圆形能力键（亮的那颗带冷却环），施放先做目标校验：
 *            目标点附近没有敌人 → 顶部黑条「No valid targets」，不进冷却；有 → 全队跃起落到目标，落地一圈白色冲击环 + 范围伤害。
 *   confirm  1016680972610359298「This is what the confirm popup looks like」：选中小队后点地面不再立刻走——
 *            空地：目标处一个 Move 确认（+ 地面标记环）；目标处已有别的小队：Select / Move / Swap 三项横排。Swap = 两队互换阵地。
 *            确认经 confirmAction 重放 battle.onPointer 原点击——和直接下令走同一条 navigation.pick/plan → goal/goalFloor 路径；
 *            Esc / cancelPopup() 取消（不下令），弹窗期间的队伍阵亡或被顶替自动收。
 *   distIso  902103473365417984「Distances this time」：沿**渲染网格表面**（台地 + 崖壁 + 台阶，三维）从海平面做测地距离，
 *            按等间距抽等值线（marching triangles），线会爬上崖壁、绕过小屋——不是逐层平面距离场。
 *   tierUp   827215002448846848「Looking at unit tiers」：小队守住一波 → 升一级（unit-tier 色阶：蓝灰→银白→金），三级加金色盔饰。
 *   flair    1024679338292256769「Some UI flair」：升级 / 守住一波时弹出奖励徽章——中央徽章与标题先显、外围纹饰后展；
 *            收起时中央先退、外侧尾迹最后消失（core/ui-reveal.js 两轨时序，画在 2D 画布上）。
 * battle.js 只有几处一行挂钩（构造 / start / stop / onPointer / 单位循环 / #draw 之后），其余都在这里。
 */
import * as THREE from 'three';
import { setUnitAppearanceTier } from '../core/unit-tier.js';
import { uiRevealAt } from '../core/ui-reveal.js';
import { charHouseVerts, restoreChar } from './house-char.js';

export const C03_FLAGS = ['kpow', 'houseFx', 'torches', 'plunge', 'confirm', 'distIso', 'tierUp', 'flair'];
/** 默认开：`houseFx`（照 C01 `houseChar` / C02 `scorch` 先例）+ `torches`（第 246 轮）。
 *  828984794407170048「坡地接敌 + 屋旁燃烧 → 大火球 → 房屋焦黑」：失守屋不爆火球、屋体不转炭黑的默认观感与原片不符，
 *  关法 `?houseFx=0`（或 `battle.c03.set('houseFx', false)`）。
 *  890611046435627008「维京人贴近小屋后朝屋顶抛橙色火团，屋顶持续燃烧」：`torches` 一直默认关 →
 *  主战场只有「失守后爆一次火球」，没有片中开打期间的连续抛火/屋顶燃烧，关法 `?torches=0`。其余 C03 开关维持默认关。 */
export const C03_DEFAULT_ON = ['houseFx', 'torches'];
const hasDom = () => typeof document !== 'undefined' && !!document.body?.appendChild;

export class BattleC03 {
  constructor(battle) {
    this.b = battle; this.on = Object.fromEntries(C03_FLAGS.map((k) => [k, false]));
    const q = new URLSearchParams(globalThis.location?.search ?? '');
    for (const k of C03_DEFAULT_ON) this.on[k] = true;
    for (const k of C03_FLAGS) if (q.get(k) === '1') this.on[k] = true;
    for (const k of C03_DEFAULT_ON) if (q.get(k) === '0') this.on[k] = false;   // 显式关：?houseFx=0 / ?torches=0
    this.group = new THREE.Group(); battle.group.add(this.group);
    // 爆炸：火球（内核 + 外辉光两层球）、焦痕（贴地圆片）、火星（点）
    this.blasts = []; this.scorches = []; this.sparks = []; this.smokes = []; this.torchList = []; this.shocks = [];
    const sparkGeo = new THREE.BufferGeometry(); sparkGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(900 * 3), 3)); sparkGeo.setDrawRange(0, 0);
    this.sparkPoints = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: '#ffab3d', size: .035, transparent: true, opacity: .95, depthWrite: false, toneMapped: false }));
    this.sparkPoints.frustumCulled = false; this.sparkPoints.renderOrder = 9; this.group.add(this.sparkPoints);
    this.sphereGeo = new THREE.SphereGeometry(1, 18, 12); this.discGeo = new THREE.CircleGeometry(1, 20).rotateX(-Math.PI / 2);
    this.ringGeo = new THREE.RingGeometry(.7, 1, 40).rotateX(-Math.PI / 2);
    // 三级盔饰（金色小冠 / 羽）
    this.crests = new THREE.InstancedMesh(new THREE.ConeGeometry(.018, .06, 5).translate(0, .205, 0), new THREE.MeshStandardMaterial({ color: '#e7bf3f', roughness: .45, metalness: .3, flatShading: true }), 260);
    this.crests.count = 0; this.crests.frustumCulled = false; this.group.add(this.crests);
    this.isoLines = null; this.banner = null; this.marker = null;
    this.stats = this.#fresh();
    this.cooldown = 0; this.armed = false; this.popup = null; this.bypass = false; this.toast = null; this.flairs = [];
  }
  #fresh() { return { explosions: 0, scorches: 0, sparks: 0, maxFireball: 0, housesCharred: 0, charredVerts: 0, torches: 0, torchHits: 0, plunges: 0, noTargets: 0, plungeHits: 0, confirms: 0, moves: 0, swaps: 0, selects: 0, isoSegments: 0, isoLevels: 0, isoWallSegments: 0, promotions: 0, flairs: 0, wavesHeld: 0 }; }
  set(name, value) {
    if (!C03_FLAGS.includes(name)) throw new RangeError('unknown C03 flag ' + name);
    this.on[name] = !!value; this.#apply(); return this.on[name];
  }
  start() { this.stats = this.#fresh(); this.kpowT = 1.2; this.cooldown = 0; this.lastWave = 0; this.waveHadEnemies = false; this.#apply(); }
  stop() {
    for (const o of [...this.blasts.map((x) => x.g), ...this.scorches.map((x) => x.mesh), ...this.torchList.map((x) => x.mesh), ...this.shocks.map((x) => x.mesh)]) this.group.remove(o);
    this.blasts = []; this.scorches = []; this.sparks = []; this.torchList = []; this.shocks = [];
    this.#dropSmokes(true); this.#restoreChar();
    if (this.isoLines) { this.group.remove(this.isoLines); this.isoLines.geometry.dispose(); this.isoLines = null; }
    if (this.banner) { this.group.remove(this.banner); this.banner = null; }
    this.#closePopup(); this.#dropEsc(); this.hud?.remove(); this.hud = null; this.toastEl?.remove(); this.toastEl = null;
    for (const f of this.flairs) f.el.remove(); this.flairs = [];
    this.crests.count = 0; this.sparkPoints.geometry.setDrawRange(0, 0);
  }
  #apply() {
    const b = this.b; if (!b.running) return;
    if (this.on.distIso) this.#buildIso(); else if (this.isoLines) this.isoLines.visible = false;
    if (this.on.kpow) this.#ensureBanner(); else if (this.banner) this.banner.visible = false;
    if (this.on.plunge) this.#ensureHud(); else if (this.hud) this.hud.style.display = 'none';
    if (!this.on.confirm) this.#closePopup();
    if (this.on.confirm) this.#ensureEsc(); else this.#dropEsc();
    if (!this.on.tierUp) this.crests.count = 0;
  }

  /* ================================================================ 地面 */
  /** 渲染网格上 (x,z) 处最接近 nearY 的地面高（形变后的真地面）；没打到退回格高。 */
  groundAt(x, z, nearY = null) {
    const b = this.b, surfaces = [b.view.mesh, b.view.navLayer?.stairs].filter((m) => m?.geometry?.attributes?.position);
    if (surfaces.length) {
      const ray = this._ray ??= new THREE.Raycaster(); ray.set(new THREE.Vector3(x, 30, z), new THREE.Vector3(0, -1, 0)); ray.far = 60;
      const hits = ray.intersectObjects(surfaces, false).filter((h) => (h.face?.normal?.y ?? 1) > .3);
      if (hits.length) return (nearY == null ? hits[0] : hits.reduce((a, h) => Math.abs(h.point.y - nearY) < Math.abs(a.point.y - nearY) ? h : a)).point.y;
    }
    const c = b.view.index.cellAt(x, z); return c ? b.world.top(c) * b.L : 0;
  }

  /* ================================================================ kpow：一次性爆炸编排 */
  /**
   * explodeAt：t=0 一点白光 → 0–.12 s 膨胀到 r（缓出）→ .12–.7 s 收缩、白→黄→橙→暗红并淡出；外层辉光球（粉）稍大稍慢。
   * 同时：正下方焦痕贴片（先半透明红，2 s 内变焦黑，留下）、一批火星（上抛 + 重力）、黑烟源（持续 smokeLife 秒）。
   */
  explodeAt(p, { r = .42, scorch = true, sparks = 28, smoke = true, smokeLife = 7, glow = false, ground = null } = {}) {
    const g = new THREE.Group(); g.position.set(p.x, p.y, p.z);
    const core = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ color: '#fffbe6', transparent: true, opacity: 1, depthWrite: false, toneMapped: false }));
    const halo = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ color: glow ? '#ff8a8a' : '#ffb347', transparent: true, opacity: .45, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
    core.renderOrder = 10; halo.renderOrder = 11; core.scale.setScalar(.02); halo.scale.setScalar(.02); g.add(core, halo); this.group.add(g);
    this.blasts.push({ g, core, halo, t: 0, r, life: glow ? 1.4 : .75, glow });
    const gy = ground ?? this.groundAt(p.x, p.z, p.y);
    if (scorch) this.#scorch(p.x, gy, p.z, r * 1.25);
    for (let k = 0; k < sparks; k++) {
      const a = Math.random() * Math.PI * 2, s = .6 + Math.random() * 1.4, up = .8 + Math.random() * 1.6;
      this.sparks.push({ x: p.x, y: p.y + r * .3, z: p.z, vx: Math.cos(a) * s, vy: up, vz: Math.sin(a) * s, life: .9 + Math.random() * .7 });
    }
    this.stats.sparks += sparks;
    if (smoke) this.#smoke({ x: p.x, y: p.y + r * .6, z: p.z }, smokeLife);
    this.stats.explosions++;
    return g;
  }
  #scorch(x, y, z, r) {
    const m = new THREE.Mesh(this.discGeo, new THREE.MeshBasicMaterial({ color: '#e04a3c', transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
    m.position.set(x, y + .012, z); m.rotation.y = Math.random() * 6; m.scale.set(r, 1, r * (.8 + Math.random() * .3)); m.renderOrder = 5; this.group.add(m);
    this.scorches.push({ mesh: m, t: 0 }); this.stats.scorches++;
    if (this.scorches.length > 48) { const o = this.scorches.shift(); this.group.remove(o.mesh); }
  }
  #smoke(src, life) {
    const sm = this.b.view.smoke; if (!sm) return;
    sm.sources.push(src); this.smokes.push({ src, ttl: life });
  }
  #dropSmokes(all = false, dt = 0) {
    const sm = this.b.view.smoke;
    this.smokes = this.smokes.filter((s) => { s.ttl -= dt; if (!all && s.ttl > 0) return true; if (sm) { const i = sm.sources.indexOf(s.src); if (i >= 0) sm.sources.splice(i, 1); } return false; });
  }
  #ensureBanner() {
    if (this.banner) { this.banner.visible = true; return; }
    if (!hasDom()) return;
    const c = document.createElement('canvas'); c.width = 256; c.height = 80; const g = c.getContext('2d');
    // 红底白字、两端锯齿（片子崖顶那条战报横幅）
    g.fillStyle = '#d8322f'; g.beginPath(); g.moveTo(14, 10); g.lineTo(242, 10); g.lineTo(230, 25); g.lineTo(242, 40); g.lineTo(230, 55); g.lineTo(242, 70); g.lineTo(14, 70); g.lineTo(26, 55); g.lineTo(14, 40); g.lineTo(26, 25); g.closePath(); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 30px system-ui,sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('k-pow !!', 138, 41);
    g.beginPath(); g.arc(52, 32, 7, 0, 7); g.fill(); g.fillRect(47, 40, 10, 16);   // 小人图标
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false })); sp.scale.set(1.5, .47, 1); sp.renderOrder = 12;
    // 挂在最高的台地上
    const w = this.b.world; let best = null; for (const c2 of w.cells) if (!best || w.top(c2) > w.top(best)) best = c2;
    if (best) sp.position.set(best.cx, w.top(best) * this.b.L + .75, best.cz);
    this.banner = sp; this.group.add(sp);
  }
  #shoreCells() {
    if (this._shore?.v === this.b.world.version) return this._shore.cells;
    const w = this.b.world, cells = w.cells.filter((c) => w.top(c) >= 1 && c.edgeNeighbors.some((id) => id < 0 || w.top(w.cells[id]) === 0));
    this._shore = { v: w.version, cells }; return cells;
  }

  /* ================================================================ houseFx：小屋失守 → 火球 → 焦黑 */
  #houseStep(h, dt) {
    const b = this.b, c = h.cell;
    if (!h.c03) {
      h.c03 = { t: 0, exploded: false };
      const gy = b.world.ground(c) * b.L;
      this.#scorch(c.cx, gy, c.cz, .55); if (h.door) this.#scorch(h.door.cx, b.world.top(h.door) * b.L, h.door.cz, .38);
      return;
    }
    h.c03.t += dt;
    if (!h.c03.exploded && h.c03.t > 2.2) {
      h.c03.exploded = true;
      const roof = this.groundAt(c.cx, c.cz, 99);
      this.explodeAt({ x: c.cx, y: roof + .1, z: c.cz }, { r: .62, glow: true, sparks: 40, smokeLife: 1e9, ground: b.world.ground(c) * b.L, scorch: false });
      this.#charHouse(h);
    }
  }
  /** 屋体焦黑：把渲染网格里落在这栋屋格（外扩 1.3 倍含屋檐）内、高于地面的顶点色压到焦黑。原色留着，stop / 重建时还原。 */
  #charHouse(h) {
    const b = this.b, mesh = b.view.mesh;
    const col = mesh?.geometry?.attributes?.color, pos = mesh?.geometry?.attributes?.position;
    if (!col || !pos) return 0;
    mesh.updateMatrixWorld();
    this._charSaved ??= { geometry: mesh.geometry, idx: [], rgb: [] };
    if (this._charSaved.geometry !== mesh.geometry) this._charSaved = { geometry: mesh.geometry, idx: [], rgb: [] };
    // 第 93 轮：实现抽到 house-char.js（837 主场景的 c01 也要用同一份），公式与旧版逐位一致
    const r = charHouseVerts({ owner:this,color: col, position: pos, matrix: mesh.matrixWorld.elements, cell: h.cell, baseY: b.world.ground(h.cell) * b.L });
    this._charSaved.idx.push(...r.idx); this._charSaved.rgb.push(...r.rgb);
    col.needsUpdate = true; this.stats.housesCharred++; this.stats.charredVerts += r.count; return r.count;
  }
  #restoreChar() {
    const s = this._charSaved; this._charSaved = null; if (!s) return;
    const col = s.geometry.attributes.color; if (!col || this.b.view.mesh?.geometry !== s.geometry) return;
    restoreChar(col, s,this); col.needsUpdate = true;
  }

  /* ================================================================ torches：维京人朝小屋抛火团 */
  #torchStep(alive, dt) {
    const b = this.b, L = b.L;
    for (const u of alive) {
      if (u.team !== 1 || u.onBoat || u.fall || u.c03Leap) continue;
      u.torchCd = (u.torchCd ?? 1 + Math.random()) - dt; if (u.torchCd > 0) continue;
      const h = b.houses.find((h) => !h.lost && h.door && Math.hypot(h.cell.cx - u.x, h.cell.cz - u.z) < 1.3 && Math.abs((u.navFloor ?? Math.round(u.y / L)) - b.world.top(h.door)) <= 1);
      if (!h) { u.torchCd = .4; continue; }
      u.torchCd = 2 + Math.random() * .8;
      const to = { x: h.cell.cx + (Math.random() - .5) * .15, y: this.groundAt(h.cell.cx, h.cell.cz, 99) - .05, z: h.cell.cz + (Math.random() - .5) * .15 };
      const mesh = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ color: '#ffb340', toneMapped: false })); mesh.scale.setScalar(.05); mesh.renderOrder = 9; this.group.add(mesh);
      const glow = new THREE.Mesh(this.sphereGeo, new THREE.MeshBasicMaterial({ color: '#ff7a30', transparent: true, opacity: .4, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false })); glow.scale.setScalar(1.9); mesh.add(glow);
      this.torchList.push({ mesh, from: { x: u.x, y: u.y + .15, z: u.z }, to, t: 0, dur: .7, house: h });
      u.face = Math.atan2(to.x - u.x, to.z - u.z); this.stats.torches++;
    }
    this.torchList = this.torchList.filter((f) => {
      f.t += dt / f.dur; const t = Math.min(1, f.t), x = f.from.x + (f.to.x - f.from.x) * t, z = f.from.z + (f.to.z - f.from.z) * t, y = f.from.y + (f.to.y - f.from.y) * t + Math.sin(Math.PI * t) * .55;
      f.mesh.position.set(x, y, z);
      if (Math.random() < .6) this.sparks.push({ x, y, z, vx: (Math.random() - .5) * .3, vy: .2, vz: (Math.random() - .5) * .3, life: .35 });
      if (t < 1) return true;
      this.group.remove(f.mesh); this.stats.torchHits++;
      if (!f.house.lost) { f.house.burn += 1.1; this.explodeAt({ x: f.to.x, y: f.to.y + .05, z: f.to.z }, { r: .16, scorch: false, sparks: 12, smoke: false }); }
      return false;
    });
  }

  /* ================================================================ plunge：指挥官能力 + 目标校验 + 冷却环 */
  #ensureHud() {
    if (!hasDom()) return;
    if (this.hud) { this.hud.style.display = 'flex'; return; }
    const el = document.createElement('div');
    // bottom:72px —— 本仓 index.html 页脚本来就有一条白色工具条（撤销/旋转/重铸那几个键）占着 bottom 18px；
    // 片子里的能力键虽然贴到画幅下沿，但把三条键压在自家工具条上既读不清也会挡住工具条的点击，
    // 所以抬高到工具条之上，容器 pointer-events:none、只有可点的键收事件（不再吞掉页脚点击）。
    el.style.cssText = 'position:fixed;left:50%;bottom:72px;transform:translateX(-50%);z-index:7;display:flex;gap:16px;align-items:flex-end;pointer-events:none;font:600 12px/1 system-ui,-apple-system,"PingFang SC",sans-serif';
    // 995034777756536833（第 195 轮）：片 0200 的底部裁切（artifacts/coverage/995034777756536833-ui-crop.png）
    // 里那份形制是「牌在上、钮在下」—— 名字牌挂在亮键**上方**并带一枚朝下的小三角指针，
    // 亮键外面套一圈**黄色高亮环**（比冷白色描边还粗）。原来名字常驻在钮下方、没有高亮环，
    // 于是「哪一颗被选中」只能靠冷却弧变白来猜。这里补齐：标签默认隐藏（片里另两颗钮没有牌），
    // 高亮环 `.hl` 只在 armed 时露出来。
    const slot = (key, label, color, enabled) => {
      const d = document.createElement('div');
      d.style.cssText = `display:flex;flex-direction:column-reverse;align-items:center;gap:6px;opacity:${enabled ? 1 : .45};cursor:${enabled ? 'pointer' : 'default'};pointer-events:${enabled ? 'auto' : 'none'}`;
      d.dataset.ability = key; d.dataset.enabled = enabled ? '1' : '0';
      d.innerHTML = `<svg width="58" height="58" viewBox="0 0 58 58"><circle cx="29" cy="29" r="25" fill="${color}" stroke="#f4eee0" stroke-width="3"/><path d="M29 14 L36 33 L29 29 L22 33 Z" fill="#fff" opacity=".92"/><circle class="hl" cx="29" cy="29" r="27.5" fill="none" stroke="#ffd34d" stroke-width="3" opacity="0"/><circle class="cd" cx="29" cy="29" r="27" fill="none" stroke="#ffd34d" stroke-width="3.5" stroke-dasharray="169.6" stroke-dashoffset="0" transform="rotate(-90 29 29)" opacity="0"/></svg>`
        + `<span class="tag" style="display:none;position:relative;background:#2a2118;color:#fff;padding:4px 9px;border-radius:2px;font:600 12px/1 system-ui,-apple-system,'PingFang SC',sans-serif;white-space:nowrap">${label}<i style="position:absolute;left:50%;bottom:-5px;transform:translateX(-50%);width:0;height:0;border:5px solid transparent;border-top-color:#2a2118;border-bottom:0"></i></span>`;
      if (enabled) d.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); this.arm(); });
      el.appendChild(d); return d;
    };
    this.slotPlunge = slot('plunge', 'Plunge', '#8a4fc0', true); slot('volley', 'Volley', '#4f6f8f', false); slot('brace', 'Brace', '#4f6f8f', false);
    document.body.appendChild(el); this.hud = el;
  }
  #toast(msg, secs = 1.6) {
    if (!hasDom()) { this.toast = { msg, t: secs }; return; }
    if (!this.toastEl) { const t = document.createElement('div'); t.style.cssText = 'position:fixed;left:50%;top:14px;transform:translateX(-50%);z-index:8;background:#111;color:#fff;font:600 14px/1 system-ui,sans-serif;padding:7px 120px;border-radius:2px;pointer-events:none;display:none'; document.body.appendChild(t); this.toastEl = t; }
    this.toastEl.textContent = msg; this.toastEl.style.display = 'block'; this.toast = { msg, t: secs };
  }
  arm() {
    if (!this.on.plunge || this.cooldown > 0) return false;
    this.armed = true; this.b.scale = .15;
    // 片 0200 里「黄圈高亮」与顶部黑条「No valid targets」是同一时刻的两件事：
    // 亮键即进入目标选择态，附近没敌人就当场出条，而不是等玩家点地面才提示（原来只在地面点击里提示）。
    if (!this.plungeHasTargets()) { this.stats.noTargets++; this.#toast('No valid targets'); }
    return true;
  }
  /** 与 castPlunge 同一判定口径（range 内有无敌方活口），只读：arm 时就地校验用。 */
  plungeHasTargets(sq = null, range = 3.6) {
    const b = this.b;
    const target = sq ?? b.selected ?? b.squads.find((s) => s.alive && !s.archer);
    const ctr = target && this.#squadCenter(target); if (!ctr) return false;
    return b.units.some((v) => v.team === 1 && !v.dead && !v.onBoat && !v.fall && Math.hypot(v.x - ctr.x, v.z - ctr.z) <= range);
  }
  /** 只读探针：HUD 的可见态 / 高亮环 / 冷却弧 / 提示条 / 计数，供浏览器验收读数。 */
  plungeProbe() {
    const q = (sel) => this.hud?.querySelector?.(sel) ?? null;
    const cd = q('[data-ability="plunge"] .cd'), hl = q('[data-ability="plunge"] .hl'), tag = q('[data-ability="plunge"] .tag');
    const slots = this.hud ? [...this.hud.querySelectorAll('[data-ability]')].map((d) => {
      const r = d.getBoundingClientRect(), svg = d.querySelector('svg')?.getBoundingClientRect();
      return { key: d.dataset.ability, enabled: d.dataset.enabled === '1', opacity: +getComputedStyle(d).opacity, box: [Math.round(r.width), Math.round(r.height)], svg: svg ? [Math.round(svg.width), Math.round(svg.height)] : null, bottom: Math.round(r.bottom) };
    }) : [];
    const r = this.hud?.getBoundingClientRect?.();
    return {
      on: this.on.plunge, armed: this.armed, cooldown: +this.cooldown.toFixed(4), cooldownMax: this.cooldownMax,
      hud: { present: !!this.hud, visible: !!this.hud && this.hud.style.display !== 'none', viewport: [globalThis.innerWidth, globalThis.innerHeight], rect: r ? [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] : null, slots, hlOpacity: +(hl?.getAttribute('opacity') ?? 0), cdDash: +(cd?.getAttribute('stroke-dashoffset') ?? 0), cdOpacity: +(cd?.getAttribute('opacity') ?? 0), cdStroke: cd?.getAttribute('stroke') ?? null, tagVisible: tag ? tag.style.display !== 'none' : false, tagText: tag?.textContent ?? null },
      banner: { text: this.toast?.msg ?? null, visible: !!this.toastEl && this.toastEl.style.display === 'block', elText: this.toastEl?.textContent ?? null, t: this.toast ? +this.toast.t.toFixed(2) : 0 },
      shocks: this.shocks.length, stats: { ...this.stats },
    };
  }
  #squadCenter(sq) { const a = sq.members.filter((u) => !u.dead && !u.onBoat); if (!a.length) return null; return { x: a.reduce((s, u) => s + u.x, 0) / a.length, y: a.reduce((s, u) => s + u.y, 0) / a.length, z: a.reduce((s, u) => s + u.z, 0) / a.length, a }; }
  /** 施放：sq 跳到 point。返回 'ok' | 'cooldown' | 'no-target' | 'blocked'。 */
  castPlunge(sq, point, { range = 3.6, radius = .6 } = {}) {
    const b = this.b;
    if (!this.on.plunge) return 'off';
    if (this.cooldown > 0) return 'cooldown';
    sq ??= b.squads.find((s) => s.alive && !s.archer);
    const ctr = sq && this.#squadCenter(sq); if (!ctr) return 'no-target';
    const cell = b.view.index.cellAt(point.x, point.z), picked = cell && b.navigation.pick(cell, point.y ?? b.world.top(cell) * b.L, { tolerance: .3 });
    const foes = b.units.filter((v) => v.team === 1 && !v.dead && !v.onBoat && !v.fall && Math.hypot(v.x - point.x, v.z - point.z) < radius);
    if (!picked || !foes.length || Math.hypot(point.x - ctr.x, point.z - ctr.z) > range) { this.stats.noTargets++; this.#toast('No valid targets'); return 'no-target'; }
    const y1 = picked.floor * b.L, cast = { landed: false, x: point.x, z: point.z, y: y1, floor: picked.floor, radius, by: ctr.a[0] };
    ctr.a.forEach((u, k) => {
      const a = (k / ctr.a.length) * Math.PI * 2, r = k ? .16 : 0;
      u.c03Leap = { x0: u.x, y0: u.y, z0: u.z, x1: point.x + Math.cos(a) * r, z1: point.z + Math.sin(a) * r, y1, t: 0, dur: .62 + k * .02, h: .75, cast };
      u.thrust = u.spearRecovery = u.sweep = null;
    });
    sq.goal = picked.cell; sq.goalFloor = picked.floor;
    this.cooldown = this.cooldownMax = 10; this.stats.plunges++; this.armed = false; b.selected = null; b.scale = 1;
    return 'ok';
  }
  /** battle 单位循环里调用：跃起中的单位由这里推进，返回 true = 这一帧 battle 不再管它。 */
  step(u, dt) {
    const L = u.c03Leap; if (!L) return false;
    L.t += dt / L.dur; const t = Math.min(1, L.t);
    u.x = L.x0 + (L.x1 - L.x0) * t; u.z = L.z0 + (L.z1 - L.z0) * t; u.y = L.y0 + (L.y1 - L.y0) * t + Math.sin(Math.PI * t) * L.h;
    u.face = Math.atan2(L.x1 - L.x0, L.z1 - L.z0);
    if (t >= 1) {
      u.c03Leap = null; u.navFloor = L.cast.floor; u.y = L.y1;
      if (!L.cast.landed) {
        L.cast.landed = true;
        // 落地：白色冲击环 + 范围内敌人吃一下（走 battle 的 #hit：扣血、击退、喷血、可能被打下崖）
        const m = new THREE.Mesh(this.ringGeo, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .95, depthWrite: false, side: THREE.DoubleSide }));
        m.position.set(L.cast.x, this.groundAt(L.cast.x, L.cast.z, L.y1) + .03, L.cast.z); m.renderOrder = 12; this.group.add(m); this.shocks.push({ mesh: m, t: 0 });
        for (const v of this.b.units) if (v.team === 1 && !v.dead && !v.onBoat && Math.hypot(v.x - L.cast.x, v.z - L.cast.z) < L.cast.radius) { this.b.applyHit(v, u); this.stats.plungeHits++; }
      }
    }
    return true;
  }

  /* ================================================================ confirm：Select / Move / Swap */
  /** battle.onPointer 最前面调用。返回 true = 这次点击被 C03 吃掉了。 */
  onPointer(hit) {
    if (this.bypass) return false;
    const b = this.b;
    if (this.armed && this.on.plunge) { this.castPlunge(b.selected, hit.point); return true; }
    if (!this.on.confirm || !b.selected) return false;
    // 点到自己这一队 = 照旧（battle 重选）；点到别的队 / 别队阵地 = 三项弹窗（片中 Select / Move / Swap）
    const near = (sq, x, y, z, r) => { const c = this.#squadCenter(sq); return c && Math.hypot(c.x - x, c.z - z) < r && Math.abs(c.y - y) < b.L * .6; };
    if (near(b.selected, hit.point.x, hit.point.y, hit.point.z, .6)) { this.#closePopup(); return false; }
    const picked = b.navigation.pick(hit.cell, hit.point.y); if (!picked) return false;
    const other = b.squads.find((sq) => sq.alive && sq !== b.selected && (sq.goal === picked.cell && sq.goalFloor === picked.floor || near(sq, hit.point.x, hit.point.y, hit.point.z, .6) || near(sq, picked.cell.cx, picked.floor * b.L, picked.cell.cz, .55)));
    this.#openPopup(hit, picked, other);
    return true;
  }
  #openPopup(hit, picked, other) {
    this.#closePopup();
    const b = this.b, options = other ? ['select', 'move', 'swap'] : ['move'];
    this.pending = { hit, picked, other, squad: b.selected, options }; this.stats.confirms++;
    // 地面标记：目标格一圈白色
    if (!this.marker) { this.marker = new THREE.Mesh(new THREE.RingGeometry(.2, .27, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: .9, depthTest: false })); this.marker.renderOrder = 31; this.group.add(this.marker); }
    this.marker.position.set(picked.cell.cx, picked.floor * b.L + .04, picked.cell.cz); this.marker.visible = true;
    if (!hasDom()) return;
    const el = document.createElement('div'); el.style.cssText = 'position:fixed;z-index:9;display:flex;gap:6px;transform:translate(-50%,-115%);font:600 12px/1 system-ui,sans-serif';
    const COL = { select: ['#e7a24a', '#b9752a', 'Select'], move: ['#5b8fe0', '#3b65b0', 'Move'], swap: ['#e7a24a', '#b9752a', 'Swap'] };
    for (const k of options) {
      const [bg, edge, label] = COL[k], btn = document.createElement('button');
      btn.style.cssText = `width:52px;height:52px;border-radius:8px;border:2px solid ${edge};background:${bg};color:#fff;box-shadow:0 3px 0 ${edge};cursor:pointer;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:0`;
      btn.innerHTML = `<span>${label}</span><svg width="18" height="14" viewBox="0 0 18 14"><path d="${k === 'move' ? 'M9 13 L3 4 L15 4 Z' : k === 'swap' ? 'M2 4 H14 L11 1 M16 10 H4 L7 13' : 'M2 2 H6 M2 2 V6 M16 2 H12 M16 2 V6 M2 12 H6 M2 12 V8 M16 12 H12 M16 12 V8'}" fill="${k === 'move' ? '#fff' : 'none'}" stroke="#fff" stroke-width="1.8"/></svg>`;
      btn.addEventListener('pointerdown', (ev) => { ev.stopPropagation(); ev.preventDefault(); this.confirmAction(k); });
      el.appendChild(btn);
    }
    document.body.appendChild(el); this.popup = el; this.#placePopup();
  }
  #placePopup() {
    if (!this.popup || !this.pending) return;
    const b = this.b, p = this.pending.picked, v = new THREE.Vector3(p.cell.cx, p.floor * b.L + .2, p.cell.cz).project(b.view.camera);
    const r = b.view.renderer?.domElement?.getBoundingClientRect?.() ?? { left: 0, top: 0, width: globalThis.innerWidth ?? 1280, height: globalThis.innerHeight ?? 800 };
    this.popup.style.left = (r.left + (v.x + 1) / 2 * r.width) + 'px'; this.popup.style.top = (r.top + (1 - v.y) / 2 * r.height) + 'px';
  }
  #closePopup() { this.popup?.remove(); this.popup = null; this.pending = null; if (this.marker) this.marker.visible = false; }
  /** Esc / 外部取消：弹窗或 pending 还开着 → 收掉（含地面标记）并返回 true；没开返回 false。 */
  cancelPopup() { if (!this.popup && !this.pending) return false; this.#closePopup(); return true; }
  /** confirm 开着时挂全局 Esc；只在有 DOM 的环境挂（Node 验收里没有 addEventListener，不挂也不影响 cancelPopup）。 */
  #ensureEsc() {
    if (this._escKey || typeof globalThis.addEventListener !== 'function' || !hasDom()) return;
    this._escKey = (e) => { if (e?.key === 'Escape' && this.cancelPopup()) e.stopImmediatePropagation?.(); };
    globalThis.addEventListener('keydown', this._escKey);
  }
  #dropEsc() { if (this._escKey) { globalThis.removeEventListener?.('keydown', this._escKey); this._escKey = null; } }
  /** 弹窗按钮（测试里直接调）。 */
  confirmAction(key) {
    const P = this.pending, b = this.b; if (!P || !P.options.includes(key)) return false;
    // 重放这次点击走 battle 原有的下令路径（plan 校验 / 虚线路径 / G3 标记 / 取消选中）；
    // 目标点就在别队身上时 battle 会先当成「点选那一队」，所以重放期间临时把其它队标成不可点选。
    const replay = () => { this.bypass = true; b.selected = P.squad; const hidden = b.squads.filter((sq) => sq !== P.squad && sq.alive); for (const sq of hidden) sq.alive = false; try { b.onPointer(P.hit); } finally { for (const sq of hidden) sq.alive = true; this.bypass = false; } };
    if (key === 'move') { this.#closePopup(); replay(); this.stats.moves++; return true; }
    if (key === 'select') { this.#closePopup(); b.selected = P.other; b.scale = .15; this.stats.selects++; return true; }
    if (key === 'swap') {
      const mine = { goal: P.squad.goal, floor: P.squad.goalFloor };
      this.#closePopup(); replay();
      P.other.goal = mine.goal; P.other.goalFloor = mine.floor; this.stats.swaps++; return true;
    }
    return false;
  }

  /* ================================================================ distIso：三维表面测地距离等值线 */
  #buildIso() {
    const b = this.b, mesh = b.view.mesh, pos = mesh?.geometry?.attributes?.position;
    if (!pos) return;
    if (this.isoLines && this.isoLines.userData.geometry === mesh.geometry) { this.isoLines.visible = true; return; }
    if (this.isoLines) { this.group.remove(this.isoLines); this.isoLines.geometry.dispose(); }
    const res = isoLinesOnMesh(mesh, { spacing: this.isoSpacing ?? .22 });
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(res.positions, 3));
    const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: '#f1f7c9', transparent: true, opacity: .9, toneMapped: false }));
    lines.renderOrder = 6; lines.frustumCulled = false; lines.userData.geometry = mesh.geometry;
    this.isoLines = lines; this.group.add(lines);
    Object.assign(this.stats, { isoSegments: res.segments, isoLevels: res.levels, isoWallSegments: res.wallSegments, isoSources: res.sources, isoMax: res.max });
  }

  /* ================================================================ tierUp + flair */
  #waveCheck() {
    const b = this.b, vik = b.units.filter((u) => u.team === 1 && !u.dead);
    if (vik.length) { this.waveHadEnemies = true; return; }
    if (!this.waveHadEnemies || b.wave === this.lastWave) return;
    this.waveHadEnemies = false; this.lastWave = b.wave; this.stats.wavesHeld++;
    if (this.on.tierUp) for (const sq of b.squads) if (sq.alive) this.promote(sq);
    if (this.on.flair) this.showFlair(this.on.tierUp ? 'Ring of Command' : `守住第 ${b.wave} 波`);
  }
  /** 小队升一级（1→2→3）：只改外观色阶（不回血），三级加金色盔饰。 */
  promote(sq) {
    const tier = Math.min(3, (sq.tier ?? 1) + 1); if (tier === sq.tier) return tier;
    sq.tier = tier; for (const u of sq.members) if (!u.dead) setUnitAppearanceTier(u, tier);
    this.stats.promotions++; return tier;
  }
  #drawCrests() {
    const b = this.b; let n = 0; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    for (const u of b.units) {
      if (n >= 260 || u.dead || u.team !== 0 || (u.appearanceTier ?? 0) < 3 || b.spriteBatch?.enabled) continue;
      q.setFromEuler(new THREE.Euler(0, u.face ?? 0, 0)); m.compose(p.set(u.x, u.y, u.z), q, s.setScalar(u.bodyScale ?? 1)); this.crests.setMatrixAt(n++, m);
    }
    this.crests.count = n; this.crests.instanceMatrix.needsUpdate = true;
  }
  /** UI flair：中央徽章 + 标题先显、外围卷草后展；收起时中央先退、外围最后（uiRevealAt 两轨）。 */
  showFlair(title = 'Ring of Command', { duration = 4 } = {}) {
    this.stats.flairs++;
    const f = { title, t: 0, t0: performance.now(), duration, el: null, ctx: null };
    if (hasDom()) {
      const c = document.createElement('canvas'); c.width = 420; c.height = 240;
      c.style.cssText = 'position:fixed;left:50%;top:38%;transform:translate(-50%,-50%);z-index:8;pointer-events:none';
      document.body.appendChild(c); f.el = c; f.ctx = c.getContext('2d');
    } else f.el = { remove() {} };
    this.flairs.push(f); return f;
  }
  #drawFlair(f) {
    const g = f.ctx, k = uiRevealAt(Math.min(f.t, f.duration - 1e-6), { duration: f.duration }); f.last = k; if (!g) return;
    const W = 420, H = 240, cx = W / 2, cy = 92; g.clearRect(0, 0, W, H);
    // 外围：左右对称的卷草（按 ornament 进度从中心往外画出来），点缀小点
    if (k.ornament > 0) {
      g.strokeStyle = `rgba(238,226,190,${k.ornament})`; g.fillStyle = g.strokeStyle; g.lineWidth = 2.2;
      for (const side of [-1, 1]) {
        g.beginPath(); const N = 40, end = Math.max(1, Math.round(N * k.ornament));
        for (let i = 0; i <= end; i++) { const t = i / N, x = cx + side * (40 + t * 150), y = cy + Math.sin(t * Math.PI * 3) * 18 * (1 - t * .4); i ? g.lineTo(x, y) : g.moveTo(x, y); }
        g.stroke();
        for (let i = 1; i <= 4; i++) if (i / 4 <= k.ornament) { const t = i / 4.4, x = cx + side * (40 + t * 150), y = cy + Math.sin(t * Math.PI * 3) * 18 * (1 - t * .4); g.beginPath(); g.arc(x, y - side * 10, 3, 0, 7); g.fill(); g.beginPath(); g.arc(x + side * 8, y + 12, 6, 0, Math.PI * 2 * k.ornament); g.stroke(); }
      }
    }
    // 中央徽章 + 标题
    if (k.title > 0) {
      g.globalAlpha = k.title;
      g.fillStyle = '#2f8f86'; g.strokeStyle = '#f2ead2'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, 30 * (.7 + .3 * k.title), 0, 7); g.fill(); g.stroke();
      g.strokeStyle = '#f2ead2'; g.lineWidth = 3; g.beginPath(); g.arc(cx, cy, 12, 0, 7); g.stroke();
      g.fillStyle = '#f7f1df'; g.font = '600 24px Georgia,serif'; g.textAlign = 'center'; g.fillText(f.title, cx, cy + 66);
      g.globalAlpha = 1;
    }
  }

  /* ================================================================ 每帧 */
  afterDraw(dt, dtReal = dt) {
    const b = this.b; if (!b.running) return;
    const alive = b.units.filter((u) => !u.dead);
    // 爆炸动画
    this.blasts = this.blasts.filter((x) => {
      x.t += dt; const T = x.t / x.life, grow = .16 / x.life;
      const s = T < grow ? x.r * (1 - (1 - T / grow) ** 2) : x.r * Math.max(.05, 1 - (T - grow) / (1 - grow) * .85);
      x.core.scale.setScalar(Math.max(.02, s)); x.halo.scale.setScalar(Math.max(.02, s * (x.glow ? 1.6 : 1.3)));
      const c = Math.min(1, Math.max(0, (T - grow) / (1 - grow)));
      x.core.material.color.setRGB(1, 1 - c * .45, Math.max(0, .9 - c * 1.6)); x.core.material.opacity = 1 - c * c;
      x.halo.material.opacity = (x.glow ? .55 : .45) * (1 - c);
      this.stats.maxFireball = Math.max(this.stats.maxFireball, s);
      if (x.t < x.life) return true; this.group.remove(x.g); x.core.material.dispose(); x.halo.material.dispose(); return false;
    });
    for (const s of this.scorches) { s.t += dt; const k = Math.min(1, s.t / 2); s.mesh.material.color.setRGB(.88 - .72 * k, .29 - .17 * k, .24 - .12 * k); s.mesh.material.opacity = .55 + .1 * k; }
    for (const sp of this.sparks) { sp.vy -= 3.2 * dt; sp.x += sp.vx * dt; sp.y += sp.vy * dt; sp.z += sp.vz * dt; sp.life -= dt; }
    this.sparks = this.sparks.filter((s) => s.life > 0).slice(-900);
    const sa = this.sparkPoints.geometry.attributes.position; this.sparks.forEach((s, i) => sa.setXYZ(i, s.x, s.y, s.z)); sa.needsUpdate = true; this.sparkPoints.geometry.setDrawRange(0, this.sparks.length);
    this.shocks = this.shocks.filter((s) => { s.t += dt; const k = s.t / .4; s.mesh.scale.setScalar(.15 + k * .8); s.mesh.material.opacity = .95 * (1 - k); if (k < 1) return true; this.group.remove(s.mesh); return false; });
    this.#dropSmokes(false, dt);
    if (this.on.kpow) {
      this.#ensureBanner(); this.kpowT -= dt;
      if (this.kpowT <= 0) {
        this.kpowT = 3.5; const shore = this.#shoreCells();
        if (shore.length) { const c = shore[(Math.random() * shore.length) | 0], y = this.groundAt(c.cx, c.cz, b.world.top(c) * b.L); this.explodeAt({ x: c.cx, y: y + .15, z: c.cz }); }
      }
    }
    if (this.on.houseFx) for (const h of b.houses) if (h.lost) this.#houseStep(h, dt);
    if (this.on.torches) this.#torchStep(alive, dt);
    if (this.on.plunge) {
      this.cooldown = Math.max(0, this.cooldown - dt);
      const cd = this.slotPlunge?.querySelector?.('.cd'); if (cd) { const f = this.cooldownMax ? this.cooldown / this.cooldownMax : 0; cd.setAttribute('opacity', f > 0 || this.armed ? 1 : 0); cd.setAttribute('stroke-dashoffset', String(169.6 * (1 - f))); /* 亮弧 = 剩余冷却 */ cd.setAttribute('stroke', this.armed ? '#ffffff' : '#ffd34d'); }
      // 选中态形制（见 #ensureHud 注释）：黄高亮环 + 上方名字牌，只在 armed 时露；落地即收。
      const hl = this.slotPlunge?.querySelector?.('.hl'); if (hl) hl.setAttribute('opacity', this.armed ? 1 : 0);
      const tag = this.slotPlunge?.querySelector?.('.tag'); if (tag) tag.style.display = this.armed ? 'block' : 'none';
    }
    if (this.toast) { this.toast.t -= dtReal; if (this.toast.t <= 0) { this.toast = null; if (this.toastEl) this.toastEl.style.display = 'none'; } }
    // 弹窗挂着的队伍被歼灭 / 选中被换成别队 → 这次确认作废，收回弹窗与地面标记
    if (this.pending && (!this.pending.squad.alive || b.selected !== this.pending.squad)) this.#closePopup();
    if (this.popup) this.#placePopup();
    if (this.on.distIso) this.#buildIso();
    if (this.on.tierUp || this.on.flair) this.#waveCheck();
    if (this.on.tierUp) this.#drawCrests();
    this.flairs = this.flairs.filter((f) => { f.t = (performance.now() - f.t0) / 1000; this.#drawFlair(f);   /* UI 时序走墙钟，不受战斗慢动作 / 掉帧影响 */ if (f.t < f.duration) return true; f.el.remove(); return false; });
  }
}

/**
 * 渲染网格表面上的测地距离等值线（marching triangles）。
 * 网格是三角汤（非索引）：先按位置焊接顶点，再沿三角边做多源 Dijkstra（源 = 海平面附近的顶点，y ≤ seaY），
 * 每个三角形按顶点距离插出 level = k·spacing 的线段。线段略沿法线外推，免得和表面 z-fight。
 * 返回 { positions, segments, levels, wallSegments（落在近竖直面上的段数，证明线会爬上崖壁）, sources, max }。
 */
export function isoLinesOnMesh(mesh, { spacing = .22, seaY = .04, lift = .012, maxLevels = 80 } = {}) {
  const pos = mesh.geometry.attributes.position; mesh.updateMatrixWorld(); const e = mesh.matrixWorld.elements;
  const n = pos.count, P = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i); P[i * 3] = x * e[0] + y * e[4] + z * e[8] + e[12]; P[i * 3 + 1] = x * e[1] + y * e[5] + z * e[9] + e[13]; P[i * 3 + 2] = x * e[2] + y * e[6] + z * e[10] + e[14]; }
  const idx = mesh.geometry.index ? Array.from(mesh.geometry.index.array) : Array.from({ length: n }, (_, i) => i);
  const weld = new Map(), id = new Int32Array(n), W = [];
  for (let i = 0; i < n; i++) { const k = `${Math.round(P[i * 3] * 500)},${Math.round(P[i * 3 + 1] * 500)},${Math.round(P[i * 3 + 2] * 500)}`; let w = weld.get(k); if (w === undefined) { w = W.length / 3; weld.set(k, w); W.push(P[i * 3], P[i * 3 + 1], P[i * 3 + 2]); } id[i] = w; }
  const m = W.length / 3, adj = Array.from({ length: m }, () => new Map());
  const tris = [];
  for (let t = 0; t + 2 < idx.length; t += 3) {
    const a = id[idx[t]], b = id[idx[t + 1]], c = id[idx[t + 2]]; if (a === b || b === c || a === c) continue; tris.push(a, b, c);
    for (const [u, v] of [[a, b], [b, c], [c, a]]) { const d = Math.hypot(W[u * 3] - W[v * 3], W[u * 3 + 1] - W[v * 3 + 1], W[u * 3 + 2] - W[v * 3 + 2]); adj[u].set(v, d); adj[v].set(u, d); }
  }
  const dist = new Float64Array(m).fill(Infinity), heap = [];
  const push = (d, v) => { heap.push([d, v]); let i = heap.length - 1; while (i > 0) { const q = (i - 1) >> 1; if (heap[q][0] <= heap[i][0]) break; [heap[q], heap[i]] = [heap[i], heap[q]]; i = q; } };
  const pop = () => { const top = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let i = 0; for (;;) { const a = 2 * i + 1, b = a + 1; let s = i; if (a < heap.length && heap[a][0] < heap[s][0]) s = a; if (b < heap.length && heap[b][0] < heap[s][0]) s = b; if (s === i) break; [heap[s], heap[i]] = [heap[i], heap[s]]; i = s; } } return top; };
  let sources = 0;
  for (let v = 0; v < m; v++) if (W[v * 3 + 1] <= seaY && adj[v].size) { dist[v] = 0; push(0, v); sources++; }
  while (heap.length) { const [d, v] = pop(); if (d > dist[v]) continue; for (const [u, w] of adj[v]) if (d + w < dist[u]) { dist[u] = d + w; push(dist[u], u); } }
  let max = 0; for (let v = 0; v < m; v++) if (Number.isFinite(dist[v]) && dist[v] > max) max = dist[v];
  const levels = Math.min(maxLevels, Math.floor(max / spacing)), out = []; let segs = 0, wall = 0;
  const vtx = (a, b, L) => { const t = (L - dist[a]) / (dist[b] - dist[a]); return [W[a * 3] + (W[b * 3] - W[a * 3]) * t, W[a * 3 + 1] + (W[b * 3 + 1] - W[a * 3 + 1]) * t, W[a * 3 + 2] + (W[b * 3 + 2] - W[a * 3 + 2]) * t]; };
  for (let t = 0; t < tris.length; t += 3) {
    const [a, b, c] = [tris[t], tris[t + 1], tris[t + 2]], da = dist[a], db = dist[b], dc = dist[c];
    if (!Number.isFinite(da) || !Number.isFinite(db) || !Number.isFinite(dc) || da === 0 && db === 0 && dc === 0) continue;
    const lo = Math.min(da, db, dc), hi = Math.max(da, db, dc);
    // 面法线（外推用 + 判是否竖直面）
    const ux = W[b * 3] - W[a * 3], uy = W[b * 3 + 1] - W[a * 3 + 1], uz = W[b * 3 + 2] - W[a * 3 + 2], vx = W[c * 3] - W[a * 3], vy = W[c * 3 + 1] - W[a * 3 + 1], vz = W[c * 3 + 2] - W[a * 3 + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    if (ny < -.2) continue;   // 朝下的面（挑檐底）不画
    for (let k = Math.max(1, Math.ceil(lo / spacing)); k <= Math.min(levels, Math.floor(hi / spacing)); k++) {
      const L = k * spacing, pts = [];
      for (const [p, q] of [[a, b], [b, c], [c, a]]) { const dp = dist[p], dq = dist[q]; if ((dp < L) !== (dq < L)) pts.push(vtx(p, q, L)); }
      if (pts.length !== 2) continue;
      for (const p of pts) out.push(p[0] + nx * lift, p[1] + ny * lift, p[2] + nz * lift);
      segs++; if (Math.abs(ny) < .35) wall++;
    }
  }
  return { positions: out, segments: segs, levels, wallSegments: wall, sources, max };
}
