import {planLanding,corridorBlocked,steerBoat} from './landing-plan.js';
import { PROJECTILE_GRAVITY, defaultBallisticTable, createBallisticTable, createShotContract, pickBallisticShot, projectileState } from '../core/ballistic-table.js';
import { samplePath } from '../core/path-samples.js';
import { atHouseDoor } from '../core/house-door-presence.js';
import { easeUnitGroundHeight, easeUnitToHeight } from '../core/unit-ground-height.js';
import { unitTierAppearance, setUnitAppearanceTier, creditUnitKill } from '../core/unit-tier.js';
import { createBannerTexture } from '../life/banner.js';
import { UnitShadowBatch } from '../life/unit-shadow-batch.js';
import { UnitSpriteBatch } from '../life/unit-sprites.js';
import { capturePlatformAnchor, resolvePlatformAnchor } from '../core/platform-anchor.js';
import { stunUnit, stepStun, resolveFallLanding } from '../core/combat-state.js';
import { configureCombatUnit, damageCombatUnit } from '../core/combat-profile.js';
import { beginSpearThrust, stepSpearThrust } from '../core/spear-thrust.js';
import { hitShove, shouldFallIntoWater, beginKnockoff, beginDrown, DROWN_SINK_SEC, stepSplashes } from '../core/knockoff-water.js';   // opt-in：view.knockoffWater=true 才接击退落水（缺省行为不变）
import { narrowCells, leftLaneTarget, passageMarkers, localSeparation, heightRaster, sightFade } from '../world/traffic.js';
import { installPointFloor, syncPointFloor, pointPx } from '../world/point-floor.js';
import { damageValue, addDamageNumber, stepDamageNumbers, styleFor, KILL_VALUE } from './damage-numbers.js';
import { InfoGraph } from './info-graph.js';
import { footprintBoundary } from './squad-footprint.js';
import { UnitBatchLod } from './unit-batch-lod.js';
import { BattleG3 } from './battle-g3.js';   // 第 55 批 G3：精细门户 / 连续流 / 竖旗盾纹 / 扫掠盾推 / 梯子 / 影子贴合 / 指令条（默认全关）
import { BattleC01, C01_FLAGS } from './battle-c01.js';  // 第 56 批 C01：血量槽 / 节点图 / 黄竖条 / 血迹老化堆厚 / 火光 / 成列行军 / 常驻路线 / 沿岸泡沫（默认全关）
import { BattleC03 } from './battle-c03.js';  // 第 56 批 C03：爆炸编排 / 小屋焦黑 / 抛火团 / Plunge 能力 / 确认弹窗 / 三维距离等值线 / 升级 / UI flair（默认全关）
import { BattleC02 } from './battle-c02.js';  // 第 56 批 C02：不规则血泊 / 焦痕 / 飘字甩出 / 流场底网格面 / 翻滚扬尘 / 船迹 / 导航面 / 雨 / 挥砍弧 / 小队轮廓 / 点线世界尺寸（默认全关）
/**
 * battle.js — Bad North 的玩法层：维京长船登陆、守军小队、近战 / 弓箭、血、尸体、箭粘在船上。
 *
 * 依据（官网 + 视频）：
 *   badnorth.com "real-time tactics roguelite … defend your idyllic island kingdom against a horde of Viking
 *     invaders … take full tactical advantage of the unique shape of each island"
 *   官网 summer1 / dawn1 截图：蓝衣小队举旗站在台地上；红衣维京人坐长船、船舷一排橙色圆盾，拖白色尾迹靠岸；
 *     打完仗滩上一片血、尸体倒在地上。
 *   946660607008403456 "making blood, corpses and arrows stick to boats"：船上的箭、血、尸体跟着船一起走。
 *   959530111187013632（画面）：选中小队时出现目标圈 + 虚线路径，小队沿台阶走过去。
 *   886199305522085890 "Dotted lines to mark narrow passages"；880853661936734211 窄道里"左行"会车。
 *   984813819280191488 "Blood soaking as a health indicator"：受伤的单位身上的红色越来越多。
 *
 * 玩法：
 *   · 一波波长船从海上开来，在沙滩边靠岸，维京人下船，沿导航图（world/navgraph.js）走向最近的小屋；
 *     在小屋边站够 4 秒，小屋着火（失守）。
 *   · 守军三队（两队步兵 + 一队弓手）。点小队选中 → 时间变慢（Bad North 的标志）→ 点地面下令移动。空格暂停。
 *   · 近战：相邻就互砍；弓手 4.5 格内向维京人射箭（抛物线），射空的箭插在地上，射到船上就粘在船上随船走。
 *   · 死亡：倒地成尸体，地上留一摊血；死在船上的尸体和血跟着船。
 */

import * as THREE from 'three';
import { buildNav } from '../world/navgraph.js';
import { BattleNavigation } from '../world/battle-navigation.js';
import { buildLayeredFlowField } from './flowfield.js';

/**
 * 弹道查找表（987267068495003648 "live tweak the cost function of my projectile trajectory lookup tables"）：
 * 预先对 (水平距离, 高差) 的网格，在一排出射角里找能打到、且代价最小的那一个（代价 = 飞行时间 + 落角偏离 45° 的惩罚）；
 * 射箭时查表得到出射角和速度，按真实抛物线飞。画面里是一扇扇抛物线 + Inspector 里的 Cost Function。
 * Validity 契约（同一条记录的补学残差）：`battle.shotContract` 装上后，#shoot 射前按射程环/沿弧遮挡/落点地表
 * 逐条拦；表达式表会在 ranked 候选里自动换放得行的弧（高抛越墙），解析表只有唯一解、契约不过就不射。
 * 契约只拦「射前」，飞行中的 clearSegment 与落点命中判定不动。
 */
const G = PROJECTILE_GRAVITY;

const MAX = 260;
const TEAM = { DEF: 0, VIK: 1 };
const COL = { hullWood: new THREE.Color('#6a4a52'), hullBlood: new THREE.Color('#7a1c22'), spearShaft: new THREE.Color('#e2a59c'), spearTip: new THREE.Color('#f7f4ee'), def: new THREE.Color('#3f5f8f'), defArcher: new THREE.Color('#4d6fa0'), vik: new THREE.Color('#8e3b3b'), cream: new THREE.Color('#e8dcc0'), shieldV: new THREE.Color('#f0a35e'), shieldD: new THREE.Color('#d9e2ec'), corpse: new THREE.Color('#5a4048'), boatCorpse: new THREE.Color('#efe9dd') };
const FLAG = ['#7fc6e0', '#f0a35e', '#9be0c8'];

export class Battle {
  constructor(view) {
    this.view = view;
    this.L = view.levelHeight;
    // [opt-in] 单位 / 长船整体放大（舞台 1 格 = 几米由接入方定）：只改画的大小与船上座位间距，战斗逻辑格距不变
    this.unitScale = view.unitScale ?? 1; this.boatScale = view.boatScale ?? this.unitScale;
    // [opt-in] 击退落水（core/knockoff-water.js，REACode combatfx 移植）：view.knockoffWater=true 才有矛轴推 0.12 /
    //   推水判定 / 空中翻滚 / 溺水下沉 / 水花 / drownStats；缺省走旧路径（击退 0.05、落水只标记死亡），库侧行为不变。
    this.knockoff = view.knockoffWater === true;
    this.splashes = []; this.splashGeo = new THREE.RingGeometry(0.82, 1, 24); this.drownStats = { knocked: 0, drowned: 0, vik: 0, def: 0 };
    this.group = new THREE.Group();
    view.scene.add(this.group);
    const mk = (geo, color) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85, flatShading: true }), MAX); m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3); m.castShadow = true; m.frustumCulled = false; m.count = 0; this.group.add(m); return m; };
    const body = new THREE.CylinderGeometry(0.035, 0.055, 0.12, 7); body.translate(0, 0.06, 0);
    const head = new THREE.SphereGeometry(0.035, 8, 6); head.translate(0, 0.145, 0);
    const shield = new THREE.CylinderGeometry(0.04, 0.04, 0.01, 10); shield.rotateX(Math.PI / 2); shield.translate(0, 0.07, 0.05);
    this.unitShadows = new UnitShadowBatch(MAX);
    // 第 130 轮：接触软盘**默认开**。821321422140309504 / 821680056514781186 两条片子里，单位脚下那块暗斑
    // 一直都在（灰模地面上最清楚的只有它），但此前 only `g3 shadowFit` 顺带把 enabled 置 true —— 默认战斗
    // 一片软盘都不画（本轮探针：24 个活单位 count=0 / drawRange 0）。`?unitShadows=0` 保留关档给像素 A/B。
    this.unitShadows.enabled = new URLSearchParams(globalThis.location?.search ?? '').get('unitShadows') !== '0';
    this.group.add(this.unitShadows.mesh);
    this.spriteBatch = new UnitSpriteBatch(MAX);
    this.spriteBatch.enabled = !!view.debugState?.unitsprites;
    this.group.add(this.spriteBatch.group);
    this.mBody = mk(body); this.mHead = mk(head); this.mShield = mk(shield);
    // 皮肤空间的血迹（999185422403055616 "the splatter on the face follows the actual motion of the head"）：
    // 血斑按物体空间坐标的噪声画，所以跟着身体动；每个单位一个 aSoak（0…1），越大斑越多（血浸透 = 血量）。
    // 身体和**头**都要吃同一份血：片子里的血点在脸/头盔上，头一动血点跟着动（物体空间 = 头的局部坐标）。
    // 高度门限做成 uniform（每个网格自己的局部 y 区间不同），三份材质共用一份着色器源码。
    // 第 N 轮补残差（同片 0096 棋盘格分界）：原作是**两套坐标空间**——躯干上的血斑图案固定在躯干
    // （皮肤 UV 静态，原文叫 sprite-space map），盔与手臂上的斑跟着那部分的实际运动走（skin-space）。
    // 这里对应成：躯干 = 单位空间坐标（pivot=0，图案钉在身体框架上）；头/盾 = **部件局部空间**
    // （position − uSoakPivot，部件自己动起来时斑纹跟着部件框架走，不再沿用单位框架坐标）。
    // uSoakDebug=1 时画棋盘格调试层：躯干蓝棋盘、头/盾红白棋盘——就是原片 0096 那张分界图。
    // 另补高频碎斑层（原片血点是细碎溅斑不是整面色块）：主噪声只定覆盖面，173 倍频噪声再把覆盖碎成点。
    this.aSoak = new THREE.InstancedBufferAttribute(new Float32Array(MAX), 1);
    const installSoak = (mesh, y0, ys, pivot) => {
      mesh.geometry.setAttribute('aSoak', this.aSoak);
      const uniforms = { uSoakY0: { value: y0 }, uSoakYS: { value: ys },
        uSoakPivot: { value: new THREE.Vector3(...(pivot || [0, 0, 0])) },
        uSoakSpace: { value: pivot ? 1 : 0 },      // 0=单位空间（躯干/sprite-space），1=部件空间（皮肤/skin-space）
        uSoakDebug: { value: 0 } };
      mesh.material.onBeforeCompile = (sh) => {
        Object.assign(sh.uniforms, uniforms);
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aSoak;\nvarying float vSoak;\nvarying vec3 vObj;\nvarying vec3 vPart;\nuniform vec3 uSoakPivot;')
          .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSoak = aSoak; vObj = position; vPart = position - uSoakPivot;');
        sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vSoak;\nvarying vec3 vObj;\nvarying vec3 vPart;\nuniform vec3 uSoakPivot;\nuniform float uSoakY0;\nuniform float uSoakYS;\nuniform float uSoakSpace;\nuniform float uSoakDebug;')
          .replace('#include <color_fragment>', '#include <color_fragment>\nvec3 sp = mix(vObj, vPart, uSoakSpace);\nfloat bn = fract(sin(dot(floor(sp * 55.0), vec3(12.9898, 78.233, 37.719))) * 43758.5453);\nfloat bl = step(bn, vSoak * 0.85) * step(vObj.y, uSoakY0 + vSoak * uSoakYS);\nfloat bn2 = fract(sin(dot(floor(sp * 173.0), vec3(26.651, 39.247, 11.313))) * 43758.5453);\ndiffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.06, 0.08), bl * (0.55 + 0.45 * step(bn2, 0.55)));\nif (uSoakDebug > 0.5) { vec3 cp = mix(vObj, vPart, uSoakSpace); float ck = mod(floor(cp.x * 60.0) + floor(cp.y * 60.0) + floor(cp.z * 60.0), 2.0); diffuseColor.rgb = uSoakSpace > 0.5 ? mix(vec3(0.85, 0.12, 0.12), vec3(0.95, 0.92, 0.88), ck) : mix(vec3(0.12, 0.25, 0.85), vec3(0.05, 0.1, 0.45), ck); }');
      };
      // 三个网格的门限与空间各不相同，缓存键必须带上区间+空间，否则会共用同一个 program 而读到别人的 uniforms。
      mesh.material.customProgramCacheKey = () => `soak:${y0}:${ys}:${pivot ? 'part' : 'unit'}`;
      mesh.userData.soak = uniforms;
    };
    installSoak(this.mBody, 0.05, 0.12);              // 躯干：单位空间（原片躯干=sprite-space，图案钉在躯干上）
    installSoak(this.mHead, 0.115, 0.07, [0, 0.145, 0]); // 头/盔：部件空间（局部 y 0.11…0.18 浸到盔顶；斑纹跟头走）
    // 984813819280191488（第 54 轮）：盾面原来完全不吃血——片子里盾牌跟身体一起糊红。
    // 盾是绕 X 转 90° 的圆柱，局部 y 区间是半径 ±0.04 再抬到 0.07，所以从 0.03 浸到 0.11。
    installSoak(this.mShield, 0.030, 0.080, [0, 0.07, 0.05]); // 手臂/盾：部件空间（跟手臂走）
    // 0096 棋盘格分界调试层（opt-in）：view.debugState.soakChecker 或 ?soakChecker=1 或 setSoakDebug(true)
    this.setSoakDebug = (on) => { for (const mm of [this.mBody, this.mHead, this.mShield]) mm.userData.soak.uSoakDebug.value = on ? 1 : 0; };
    if (this.view.debugState?.soakChecker || new URLSearchParams(globalThis.location?.search ?? '').get('soakChecker') === '1') this.setSoakDebug(true);
    // [opt-in] 头有自己的局部姿态：u.headYaw/u.headRoll 外部驱动；view.headLag=true 时僵直期间头滞后身体
    // （"splatter on the face follows the actual motion of the head"——部件空间斑纹 + 头部局部运动才算闭环）。
    this.headLag = this.view.headLag === true;
    this._headMat = new THREE.Matrix4(); this._headRot = new THREE.Matrix4(); this._headRotY = new THREE.Matrix4();
    // Unit-length local +Z shaft; each instance scales to its active collision reach.
    const spear = new THREE.BoxGeometry(0.006, 0.006, 1); spear.translate(0, 0, 0.5);
    this.mSpear = mk(spear);
    // 903647529203634176 原片：矛杆是偏粉的浅色细线、矛头一点白（「粉红放射线」就是一排压平的矛杆指向敌人）
    const tip = new THREE.ConeGeometry(0.009, 0.05, 5); tip.rotateX(Math.PI / 2); tip.translate(0, 0, 0.025);
    this.mSpearTip = mk(tip);
    // 984813819280191488「a proper stun state for the little ones」（第 49 轮）：僵直原来只有身体左右晃，远一点看不出来；
    // 加头顶三颗绕圈的小黄星（每个僵直单位 3 颗，跟着身高缩放），僵直结束即消失。
    this.mStun = new THREE.InstancedMesh(new THREE.OctahedronGeometry(0.011, 0), new THREE.MeshBasicMaterial({ color: '#ffd23a', toneMapped: false }), MAX * 3);
    this.mStun.count = 0; this.mStun.frustumCulled = false; this.mStun.renderOrder = 7; this.group.add(this.mStun);
    this.drops = [];   // 飞溅的血滴（物理）
    this.poolGrow = []; // 还在渗开的地面血泊（984813819280191488）
    // 飞行中的血滴：片子里能看见一串抛物线红点（1022573208590057472），只做可见化，不参与命中
    const dropGeo = new THREE.BufferGeometry();
    dropGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(600 * 3), 3));
    dropGeo.setDrawRange(0, 0);
    this.dropPoints = new THREE.Points(dropGeo, new THREE.PointsMaterial({ color: '#a3232b', size: 0.024, sizeAttenuation: true, transparent: true, opacity: 0.95, depthWrite: false }));
    this.dropPoints.frustumCulled = false; this.dropPoints.renderOrder = 6;
    this.group.add(this.dropPoints);
    // 血：贴地的扁圆（累积，不消失 —— 环境叙事）
    const splat = new THREE.CircleGeometry(1, 9); splat.rotateX(-Math.PI / 2);
    this.blood = new THREE.InstancedMesh(splat, new THREE.MeshBasicMaterial({ color: '#8e1f24', transparent: true, opacity: 0.78, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), 600);
    this.blood.count = 0; this.blood.frustumCulled = false; this.blood.renderOrder = 5;
    this.group.add(this.blood);
    // 箭：细长条
    const arrow = new THREE.BoxGeometry(0.008, 0.008, 0.16);
    this.arrowGeo = arrow;
    this.arrowMat = new THREE.MeshBasicMaterial({ color: '#efe6d4' });
    // 883447205176238083 f0430：箭飞过时画面上有一道很细的白线（箭的轨迹），不是只有那个小箭头。
    this.arrowTrailMat = new THREE.LineBasicMaterial({ color: '#f7f4ea', transparent: true, opacity: 0.62, depthTest: false });
    // 选中圈 + 目标虚线
    this.ring = new THREE.Mesh(new THREE.RingGeometry(0.42, 0.5, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthTest: false }));
    this.ring.renderOrder = 30; this.ring.visible = false; this.group.add(this.ring);
    // 883447205176238083：选中小队脚下的**格边界线网**（轮廓 + 辐条 + 角标）。
    // 原来的 this.ring 是 959530111187013632 的目标圈；本片要的是沿占位格边界走的一圈折线，
    // 凹形占位（少站一格）时线要往里凹，所以不用凸包。
    this.footprintMat = new THREE.LineBasicMaterial({ color: '#eaffff', transparent: true, opacity: 0.92, depthTest: false });
    this.footprintLines = new THREE.LineSegments(new THREE.BufferGeometry(), this.footprintMat);
    this.footprintLines.renderOrder = 31; this.footprintLines.frustumCulled = false; this.footprintLines.visible = false;
    this.footprintNet = new THREE.Group(); this.footprintNet.add(this.footprintLines); this.group.add(this.footprintNet);
    this.footprintOn = typeof location === 'undefined' ? true : new URLSearchParams(location.search).get('footprint') !== '0';
    this.footprintStats = null; this._fpStamp = -1e9; this._fpSel = null;
    this.path = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#ffffff', size: 5, sizeAttenuation: false, depthTest: false }));
    this.path.renderOrder = 30; this.group.add(this.path);
    this.hud = document.createElement('div');
    this.hud.style.cssText = 'position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:5;background:rgba(255,255,255,.88);color:#1d2f36;border-radius:10px;padding:6px 12px;font:13px/1.4 -apple-system,system-ui,"PingFang SC",sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.15);pointer-events:none;display:none;white-space:nowrap';
    document.body.appendChild(this.hud);
    this.flowLines = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.95, depthTest: false }));
    this.flowLines.renderOrder = 29; this.flowLines.frustumCulled = false; this.group.add(this.flowLines);
    // 902069261304287232：片子底下还压着一层「四边形网格线框」——流线是画在格网上的，不是浮在空地形上。
    this.flowGrid = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45, depthTest: false }));
    this.flowGrid.renderOrder = 28; this.flowGrid.frustumCulled = false; this.flowGrid.visible = false; this.group.add(this.flowGrid);
    // 901842167508992000：原片没有格面填充——是「同组格子的外轮廓用队伍色关起来」（放大原片 f0040 可见
    // 洋红/青/黄的闭合圈），再配一块色卡。所以这里画区域描边，不画半透明面。
    this.flowFaces = new THREE.LineSegments(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92, depthTest: false }));
    this.flowFaces.renderOrder = 27; this.flowFaces.frustumCulled = false; this.flowFaces.visible = false; this.group.add(this.flowFaces);
    // 902069261304287232（第 68 轮）：「数据继承」那片是**调试透视**——地形被压成深灰近单色（原尺寸实测地面 luma p50 65–101），
    // 流线才是满亮霓虹（169–207，对比 +104）。本仓原来反过来：岛面 p50 173，流线再乘 fade(0.78–1) 后比地面更暗（对比 −26），
    // 读不出来。这里补一层压暗：renderOrder 10 → 压在地形之上、流场层（27–29）之下；流线 rgb 恢复满亮，只留 alpha 做渐隐。
    // 第 69 轮：压暗从「整屏平面」改成「只铺可走格的顶面」（见 #drawFlow 里 dpos）。整屏版会把岛外背景一起压暗，
    // 而原片 901842167508992000 frame-0300 量出来是：四角背景 rgb(126,150,154)/luma 145.5 保持浅灰绿，
    // 岛体中心 120×120 只到 luma 83.6（= 背景的 0.575）。所以背景不能动，只有岛体该暗。
    this.flowDim = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({
      color: '#0d1014', transparent: true, opacity: 0.62, depthTest: false, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.flowDim.renderOrder = 10; this.flowDim.frustumCulled = false; this.flowDim.visible = false;
    this.group.add(this.flowDim);
    // 886199305522085890: persistent narrow-passage dots, separate from selected orders.
    // Reference frames show near-opaque white dots whose pitch is ~2x their
    // diameter, scaled to ~7px at 1440 wide. Cream 4.5px dots over a 16px sprite
    // washed out on the light terraces (median contrast 15/255 over 277 dots,
    // peak luminance 212 instead of white), so the sprite is now near 1:1 with
    // its on-screen size and the dots are pure white.
    const dotCanvas=document.createElement('canvas');dotCanvas.width=dotCanvas.height=8;
    const dc=dotCanvas.getContext('2d');dc.fillStyle='#fff';dc.beginPath();dc.arc(4,4,3.4,0,Math.PI*2);dc.fill();
    // alphaTest 去掉：原片里点被山脊挡住时是**逐渐淡出**，带 alphaTest 会在 0.3 处硬切。
    const dotMat=new THREE.PointsMaterial({color:'#ffffff',size:0.13,sizeAttenuation:true,map:new THREE.CanvasTexture(dotCanvas),transparent:true,alphaTest:0,depthWrite:false,toneMapped:false});
    dotMat.onBeforeCompile=(sh)=>{
      sh.vertexShader='attribute float aFade;\nvarying float vFade;\n'+sh.vertexShader
        .replace('#include <begin_vertex>','#include <begin_vertex>\n\tvFade = aFade;');
      sh.fragmentShader='varying float vFade;\n'+sh.fragmentShader
        .replace('#include <color_fragment>','#include <color_fragment>\n\tdiffuseColor.a *= vFade;');
    };
    // 886199305522085890（第 164 轮）：默认改成**世界尺寸点 + 物理像素下限**。
    // 片子里同一条窄道上的「点距 : 点径」在近景/远景都 ≈ 2.2（点数得清、一颗颗分开），
    // 固定 7px 屏幕点在近景会把这个比值拉到 3.3（显疏）；纯世界尺寸点又在远景缩到 3–4px（看不见）。
    // 所以 size 走世界尺寸（0.13 ≈ 点距 0.28 的 1/2.15），再用 `installPointFloor` 在顶点着色器里
    // 逐点把 gl_PointSize 托到 `minPx`（CSS 像素 × devicePixelRatio = 物理像素）。
    // 旧口径仍在：`battle.setPassageDots('screen')` / `?c02=passageScreen` 可切回固定 7px 对照。
    installPointFloor(dotMat,{minPx:7});
    this.passageDotStyle={mode:'world',world:0.13,screen:7,minPx:7};
    this.passageDots=new THREE.Points(new THREE.BufferGeometry(),dotMat);
    this.passageDots.renderOrder=4;this.group.add(this.passageDots);this.passageDots.visible=false;
    this.passageFade=new Float32Array(0);this._passageFadeAt=new THREE.Vector3(1e9,1e9,1e9);
    this.showPassages=true;
    // 903647529203634176：挨打时被真正打到的那个单位头顶跳「+4」（白色带阴影、屏幕正立、不同单位不合并）
    this.damageNumbers=[];this.damageSprites=[];this.damageTexCache=new Map();
    this.damageStats={spawned:0,live:0,lastValue:0,lastUnit:-1,hitSet:0,merged:0,kills:0,lastKind:'damage',thrustFrames:0,lastThrustHits:0,lastThrustPopups:0,lastThrustKills:0};
    // [opt-in] 击杀升级（827215002448846848 残差）：view.unitPromotion=true 或 ?unitPromotion=1。
    // 本地最小机制（非原作复现）：击杀数 → 等级 → 头盔/盾色阶；库侧缺省关，缺省行为不变。
    this.promotion = view.unitPromotion === true || new URLSearchParams(globalThis.location?.search ?? '').get('unitPromotion') === '1';
    this.promotionStats = { credited: 0, promoted: 0, last: null };
    this.running = false;
    this.g3 = new BattleG3(this);
    this.c01 = new BattleC01(this);
    // 第 173 轮：battle-c01 文件头写的 URL 入口（`?c01=all` / `?c01=column,routePreview` / `?c01=-houseChar`）
    // 之前**只存在于注释里**，全仓没有一处解析 → 这些层只能从控制台开。这里补上真正的入口。
    this.applyC01Param();
    this.c02 = new BattleC02(this);
    this.c03 = new BattleC03(this);
  }

  /**
   * `?c01=column` / `?c01=all` / `?c01=column,routePreview` / `?c01=-houseChar`。
   * 认不出的名字直接忽略（URL 写错不该炸场景）；`all` 先全开，`-x` 再单项关。
   */
  applyC01Param(search = (typeof location !== 'undefined' ? location.search : '')) {
    const raw = new URLSearchParams(search).get('c01');
    this.c01Param = raw || '';
    if (!raw) return this.c01Param;
    let touched = 0;
    for (const k of raw.split(',').map((s) => s.trim()).filter(Boolean)) {
      const neg = k.startsWith('-'), name = neg ? k.slice(1) : k;
      if (!neg && (name === 'all' || name === 'none')) { for (const f of C01_FLAGS) { this.c01.set(f, name === 'all'); touched++; } continue; }
      if (!C01_FLAGS.includes(name)) continue;
      this.c01.set(name, !neg); touched++;
    }
    this.c01ParamApplied = touched;
    return this.c01Param;
  }

  /* ------------------------------------------------------------ 开局 */
  start(world) {
    this.stop();
    this.world = world;
    // 902069261304287232 / 901842167508992000（第 115 轮）：主战斗默认走「导航面内连续流向」——
    // 原片里人群是在导航面内连续地流，不是排成一列走格心；逐面常量只剩 fallback。
    // 关掉仍可用 battle.g3.set('continuousFlow', false) 或 URL `?continuousFlow=0`。
    this.navigation = new BattleNavigation(world,this.view.index,{levelHeight:this.L,continuousFlow:true});
    this.running = true;
    this.t = 0; this.scale = 1; this.paused = false; this.wave = 0; this.nextWave = 3; this.selected = null;
    this.units = []; this.squads = []; this.boats = []; this.arrows = []; this.houses = [];
    // 974325184525201409：动态避让/岸礁接线的运行计数（hold/侧偏按帧计，originBlocked 按发船次计）
    this.trafficStats = { holdFrames: 0, sidestepFrames: 0, originBlocked: 0 };
    this.blood.count = 0;
    this.poolGrow = [];
    this.drops = []; this.dropPoints.geometry.setDrawRange(0, 0);
    this.damageNumbers = [];
    for (const sp of this.damageSprites) sp.visible = false;
    this.damageStats = { spawned: 0, live: 0, lastValue: 0, lastUnit: -1, hitSet: 0, merged: 0, kills: 0, lastKind: 'damage', thrustFrames: 0, lastThrustHits: 0, lastThrustPopups: 0, lastThrustKills: 0 };
    this.promotionStats = { credited: 0, promoted: 0, last: null };   // [opt-in] unitPromotion 计数随新开局重置
    this.navCache = new Map();
    this._trafficVersion = -1;
    this.refreshPassages();
    const cells = world.cells, L = this.L;
    // 小屋（island.js 记下的）
    for (const c of world.bnHouses || []) this.houses.push({ cell: c, burn: 0, lost: false, door: this.#walkNeighbor(c) });
    // 守军三队，站在小屋旁边的台地上
    const spots = this.houses.map((h) => h.door).filter(Boolean);
    for (let s = 0; s < 3; s++) {
      const at = spots[s % Math.max(1, spots.length)] || cells.find((c) => world.top(c) >= 2);
      if (!at) break;
      const squad = { id: s, archer: s === 2, pike: s === 1, flag: this.#flag(FLAG[s], s), goal: at, goalFloor: world.top(at), members: [], alive: true };
      squad.flag.userData.fid = s;
      for (let k = 0; k < 8; k++) this.#spawn(TEAM.DEF, at, squad, k);
      this.squads.push(squad);
    }
    this.g3.start();
    this.c01.start();
    this.c02.start();
    this.c03.start();
    this.view.effects.fireSources = [];
    if (this.view.smoke) this.view.smoke.sources = [];
    this.hud.style.display = 'block';
    this.#hud();
  }

  stop() {
    if (!this.running) return;
    this.running = false;
    this.g3.stop();
    this.c01.stop();
    this.c02.stop();
    this.c03.stop();
    for (const sq of this.squads) {
      const cloth=sq.flag.userData.cloth;
      this.group.remove(sq.flag,cloth);
      sq.flag.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});
      cloth.geometry.dispose();cloth.material.map?.dispose();cloth.material.dispose();
    }
    for (const b of this.boats) this.group.remove(b.mesh);
    for (const a of this.arrows) { a.mesh.parent?.remove(a.mesh); a.trail?.parent?.remove(a.trail); }
    this.spriteBatch.clear();
    this.unitShadows.clear();
    this.mBody.count = this.mHead.count = this.mShield.count = this.mSpear.count = this.mSpearTip.count = this.mStun.count = 0;
    if (this.view.smoke) this.view.smoke.sources = [];
    this.blood.count = 0;
    this.drops = []; this.dropPoints.geometry.setDrawRange(0, 0);
    this.ring.visible = false;
    this.passageDots.visible = false;
    this.path.geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    this.commandPathSamples = null;
    this.hud.style.display = 'none';
    this.view.effects.fireSources = this.view.worldMesh.chimneys || [];
  }

  /* ------------------------------------------------------------ 工具 */
  setPassagesVisible(on) { this.showPassages=!!on;this.passageDots.visible=this.running&&this.showPassages; }
  /** 886199：点径口径。`world` = 世界尺寸 + 物理像素下限（默认）；`screen` = 旧口径固定 7px 屏幕点。 */
  setPassageDots(mode='world'){
    if(mode!=='world'&&mode!=='screen')throw new RangeError('unknown passage dot mode '+mode);
    const m=this.passageDots.material,s=this.passageDotStyle;
    s.mode=mode;
    if(mode==='screen'){m.size=s.screen;m.sizeAttenuation=false;syncPointFloor(m.userData.pointFloor,0);}
    else{m.size=s.world;m.sizeAttenuation=true;syncPointFloor(m.userData.pointFloor,s.minPx,this.#pixelRatio());}
    m.needsUpdate=true;
    return s.mode;
  }
  #pixelRatio(){const r=this.view?.renderer;const p=typeof r?.getPixelRatio==='function'?r.getPixelRatio():1;return p>0?p:1;}
  #passageHeightCss(){const el=this.view?.renderer?.domElement;return (el?.clientHeight||globalThis.innerHeight||900);}
  /** 逐点读「这个机位下点会画多大」：近/远端的 CSS 像素直径 + 有多少点被下限托住。
   *  公式与 three 的 `sizeAttenuation` 同口径（`size·(H_css/2)/depth`），**不带** 1/tan(fov/2) 因子。 */
  passageDotPx(){
    const m=this.passageDots.material,pos=this.passageDots.geometry.getAttribute('position');
    const s=this.passageDotStyle,floor=m.userData.pointFloor;
    const pr=this.#pixelRatio(),H=this.#passageHeightCss();
    if(!pos||!pos.count)return{mode:s.mode,size:m.size,sizeAttenuation:m.sizeAttenuation,nearPx:0,farPx:0,
      floorCss:s.mode==='world'?s.minPx:0,floorPx:s.mode==='world'?+(s.minPx*pr).toFixed(2):0,clamped:0,dots:0,pixelRatio:pr};
    const cam=this.view.camera;cam.updateMatrixWorld(true);
    const inv=cam.matrixWorldInverse,v=new THREE.Vector3();
    let minPx=Infinity,maxPx=0,minDepth=Infinity,maxDepth=0,clamped=0;
    for(let i=0;i<pos.count;i++){
      v.set(pos.getX(i),pos.getY(i),pos.getZ(i)).applyMatrix4(inv);
      const depth=-v.z;if(!(depth>0))continue;
      const r=s.mode==='world'?pointPx(m.size,depth,H,s.minPx):{px:s.screen,clamped:false};
      if(r.clamped)clamped++;
      if(r.px<minPx)minPx=r.px;if(r.px>maxPx)maxPx=r.px;
      if(depth<minDepth)minDepth=depth;if(depth>maxDepth)maxDepth=depth;
    }
    const n=pos.count||1;
    return{mode:s.mode,size:m.size,sizeAttenuation:m.sizeAttenuation,
      nearPx:+maxPx.toFixed(2),farPx:+(Number.isFinite(minPx)?minPx:0).toFixed(2),
      floorCss:s.mode==='world'?s.minPx:0,floorPx:s.mode==='world'?+(s.minPx*pr).toFixed(2):0,
      clamped,clampedShare:+(clamped/n).toFixed(3),
      depthMin:+(Number.isFinite(minDepth)?minDepth:0).toFixed(2),depthMax:+maxDepth.toFixed(2),
      dots:n,pixelRatio:pr};
  }
  refreshPassages() {
    if(!this.world||this.view.worldMesh.builtVersion!==this.world.version)return;
    const nav=buildNav(this.world), markers=passageMarkers(this.world,nav,{levelHeight:this.L});
    // Project once onto the rendered deformed terrain / stair geometry. Linear
    // height interpolation otherwise buries dots inside a stepped cliff.
    // 台阶：射线下会先打到台阶上方的高台/挑檐，所以要取**最接近插值高度**的那个水平面，
    // 这样点才落在该级踏面上、沿梯面一级一级抬起来。
    const ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),positions=[];
    const surfaces=[this.view.mesh,this.view.navLayer?.stairs].filter(Boolean);
    for(const surface of surfaces)surface.updateMatrixWorld(true);
    for(const p of markers.points){
      ray.set(new THREE.Vector3(p.x,20,p.z),down);
      const hits=ray.intersectObjects(surfaces,false).filter(h=>h.face?.normal.y>.25);
      if(!hits.length)continue;
      let best=hits[0];
      for(const h of hits)if(Math.abs(h.point.y-p.y)<Math.abs(best.point.y-p.y))best=h;
      positions.push(p.x,best.point.y+.035,p.z);
    }
    const count=positions.length/3;
    // 886199305522085890（第 54 轮）：遮挡栅格要把房子算进去 —— 原片里拐过屋檐的点就看不见了。
    // 每栋小屋向下打一条射线，取最高命中当屋顶高度（只跑一次，世界重建时才重算）。
    const roofs=[];
    for(const hc of this.world.bnHouses||[]){
      ray.set(new THREE.Vector3(hc.cx,30,hc.cz),down);
      const hits=ray.intersectObject(this.view.mesh,false);
      if(hits.length)roofs.push({cell:hc,y:hits[0].point.y});
    }
    this.passageRoofs=roofs;
    this.passageStats={segments:markers.segments.length,dots:count,candidateDots:markers.points.length,version:this.world.version,occluded:0,roofs:roofs.length};
    const geometry=new THREE.BufferGeometry();
    geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    this.passageFade=new Float32Array(count).fill(1);
    geometry.setAttribute('aFade',new THREE.Float32BufferAttribute(this.passageFade,1));
    this.passageDots.geometry.dispose();this.passageDots.geometry=geometry;
    this.passageRaster=heightRaster(this.world,{levelHeight:this.L,roofs});
    this._passageFadeAt.set(1e9,1e9,1e9);
    this.#updatePassageFade(0,true);
    this.setPassageDots(this.passageDotStyle.mode);
    Object.assign(this.passageStats,this.passageDotPx());
    this.passageDots.visible=this.running&&this.showPassages;
    this._passageGeometry=this.view.mesh.geometry;
    this._passageStairs=this.view.navLayer?.stairs.geometry;
  }

  /** 886199305522085890: 山脊/墙体挡在相机与点之间时，点逐渐淡出（不是被深度硬切）。
   * 相机不动时只做缓动，不再重算视线。 */
  #updatePassageFade(dt, force = false) {
    const g = this.passageDots.geometry, pos = g.getAttribute('position');
    if (!pos || !this.passageRaster) return 0;
    const n = pos.count;
    // BufferAttribute 会把传入数组复制一份，所以缓动必须直接写在属性自己的数组上，
    // 否则 GPU 永远读不到（第一版就踩了这个，stats 说有遮挡、画面完全没变）。
    let attr = g.getAttribute('aFade');
    if (!attr || attr.count !== n) {
      attr = new THREE.Float32BufferAttribute(new Float32Array(n).fill(1), 1);
      g.setAttribute('aFade', attr);
      this._fadeTarget = null;
    }
    this.passageFade = attr.array;
    const cam = this.view.camera; cam.updateMatrixWorld(true);
    if (force || !this._fadeTarget || cam.position.distanceToSquared(this._passageFadeAt) > 1e-4) {
      this._passageFadeAt.copy(cam.position);
      if (!this._fadeTarget || this._fadeTarget.length !== n) this._fadeTarget = new Float32Array(n).fill(1);
      const p = new THREE.Vector3(); let occ = 0;
      for (let i = 0; i < n; i++) {
        p.set(pos.getX(i), pos.getY(i), pos.getZ(i));
        const f = sightFade(this.passageRaster, cam.position, p);
        this._fadeTarget[i] = f;
        if (f < 0.5) occ++;
      }
      this.passageStats.occluded = occ;
    }
    const k = 1 - Math.exp(-8 * Math.max(0.016, dt));
    let dirty = false;
    for (let i = 0; i < n; i++) {
      const d = (this._fadeTarget ? this._fadeTarget[i] : 1) - this.passageFade[i];
      if (Math.abs(d) > 1e-4) { this.passageFade[i] += d * k; dirty = true; }
    }
    if (dirty) attr.needsUpdate = true;
    return this.passageStats.occluded;
  }
  #walkNeighbor(c) {    const w = this.world;
    for (const id of c.edgeNeighbors) { if (id < 0) continue; const o = w.cells[id]; if (w.top(o) > 0 && w.top(o) === w.ground(o)) return o; }
    return null;
  }
  #nav(goal) {
    let n = this.navCache.get(goal.id);
    if (!n) { n = buildNav(this.world, { start: goal }); this.navCache.set(goal.id, n); }
    return n;
  }
  #cellAt(x, z) { return this.view.index.cellAt(x, z); }
  /**
   * 816743289500106752（第 174 轮）：推进 = 「整步 → 去分离整步 → 逐级缩步」，不再全有或全无。
   *
   * 旧写法只有前两次尝试，两次都被拒就整帧不动。真实卡点：单位走到格子**拐角**、身体圆盘压到
   * 斜向格（`discFits` 的转角规则：顶点 0.055 内要求所有共点格都可走）时，**任何**朝目标的
   * 整步终点都被拒 → 位置永远不变（实测：到位方块 3/8 人钉在离落位 0.31–0.37 的同一坐标 120 帧不动）。
   * 缩步不会让位置变非法：每个候选点仍逐点过 `move()`/`discFits`，只是慢；绕开拐角后自动恢复原速。
   * 记 `this.crawlSteps`（只读探针，给 `c01.columnStats().crawls` 用），不改任何渲染。
   */
  #step(u, dx, dz, sep, plan) {
    const nav = this.navigation;
    if (!nav) return 0;
    if (nav.move(u, u.x + dx + (sep?.x ?? 0), u.z + dz + (sep?.z ?? 0), plan)) return 1;
    if (nav.move(u, u.x + dx, u.z + dz, plan)) return 1;
    // 沿 ±45°/±90° 侧滑：贴住拐角顶点时直行全被拒，但沿任一可走边滑一步是通的（实测可走满步长）。
    // 只换方向、不放开合法性检查 —— 侧滑出去后下一帧直行就会通过。
    for (const a of [Math.PI / 4, -Math.PI / 4, Math.PI / 2, -Math.PI / 2]) {
      const ca = Math.cos(a), sa = Math.sin(a);
      if (nav.move(u, u.x + dx * ca - dz * sa, u.z + dx * sa + dz * ca, plan)) { this.slideSteps = (this.slideSteps ?? 0) + 1; return 1; }
    }
    for (let k = 2; k <= 16; k *= 2) {
      if (nav.move(u, u.x + dx / k, u.z + dz / k, plan)) { this.crawlSteps = (this.crawlSteps ?? 0) + 1; return 1 / k; }
    }
    this.stuckSteps = (this.stuckSteps ?? 0) + 1;
    return 0;
  }
  #groundY(x, z) { const c = this.#cellAt(x, z); return c ? this.world.top(c) * this.L : 0; }
  /**
   * 军旗（926890207298899969 "I build a custom mesh for the flag using a bezier curve along virtual wind particles"；
   * 926834721392340992 "I built a wind system to get them flapping just right"）：
   * 旗杆顶放出 3 个"虚拟风粒子"，每个跟着前一个走、再被风吹；旗面 = 这 4 个点的三次贝塞尔曲线，
   * 竖着拉出旗面高度，做成一条带子网格。小队走动时旗子自然拖在后面，停下时随风飘。
   */
  #flag(color, style = 0) {
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.6, 5), new THREE.MeshBasicMaterial({ color: '#6e5443' })); pole.position.y = 0.3;
    const SEG = 10;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array((SEG + 1) * 2 * 3), 3));
    const idx = [];
    for (let i = 0; i < SEG; i++) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    geo.setIndex(idx);
    // 958410200146497537: local white emblems + alpha-cut tails, on the same
    // Bezier surface. UVs stay fixed as virtual wind particles move the cloth.
    const uv = new Float32Array((SEG + 1) * 2 * 2);
    for(let i=0;i<=SEG;i++)uv.set([i/SEG,1,i/SEG,0],i*4);
    geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));
    const map=createBannerTexture({color,tail:['fork','triple','swallow'][style%3],emblem:(this.squadEmblems?['skull','sword','trident']:['tree','tower','sun'])[style%3]});
    const cloth = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff', map, alphaTest:.5, side: THREE.DoubleSide }));
    cloth.frustumCulled = false;
    g.add(pole);
    // 883447205176238083：旗杆顶上方悬着一个白色实心菱形（旋转 45° 的方块），全片都在、总是正对相机。
    const marker = new THREE.Mesh(
      new THREE.PlaneGeometry(0.085, 0.085).rotateZ(Math.PI / 4),
      new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.95, depthTest: false, side: THREE.DoubleSide }),
    );
    marker.position.set(0, 0.74, 0); marker.renderOrder = 32; marker.frustumCulled = false;
    g.add(marker);
    this.group.add(g, cloth);
    g.userData = { cloth, SEG, parts: null, marker, scale: this.unitScale }; g.scale.setScalar(this.unitScale);   // [opt-in] 旗随人放大（unitScale=1 时与原样一致）
    return g;
  }
  /**
   * [opt-in] 开局之后再加一队守军（TigerMessenger：旧城补兵 / 龙纛队 / 苔庭罗马方阵；不改原有逻辑）。
   * 与 start() 里建守军小队完全同一套：#flag + #spawn；可选兵种外观等级（unit-tier）、衣色、体型、旗子放大。
   */
  spawnSquad({ cell, archer = false, pike = false, size = 8, tier = null, bodyColor = null, bodyScale = null, flagColor = null, flagStyle = null, flagScale = 1 } = {}) {
    if (!this.running || !cell) return null;
    const s = this.squads.length, style = flagStyle ?? (archer ? 2 : pike ? 1 : 0);
    const squad = { id: s, archer, pike, flag: this.#flag(flagColor || FLAG[style % 3], style), goal: cell, goalFloor: this.world.top(cell), members: [], alive: true };
    squad.flag.userData.fid = s; squad.flag.userData.scale = flagScale * this.unitScale; squad.flag.scale.setScalar(flagScale * this.unitScale);
    const col = bodyColor ? new THREE.Color(bodyColor) : null;
    for (let k = 0; k < size; k++) { const u = this.#spawn(TEAM.DEF, cell, squad, k); if (tier) setUnitAppearanceTier(u, tier); if (col) u.bodyColor = col; if (bodyScale) u.bodyScale = bodyScale * this.unitScale; }
    this.squads.push(squad);
    return squad;
  }
  setSquadEmblems(on) {
    on=!!on;if(!!this.squadEmblems===on)return;this.squadEmblems=on;
    for(const sq of this.squads){
      const style=sq.id%3,cloth=sq.flag.userData.cloth,old=cloth.material.map;
      cloth.material.map=createBannerTexture({color:FLAG[style],tail:['fork','triple','swallow'][style],emblem:(on?['skull','sword','trident']:['tree','tower','sun'])[style]});
      cloth.material.needsUpdate=true;old?.dispose();
    }
  }
  #updateFlag(f, dt) {
    const { cloth, SEG } = f.userData;
    const k = f.userData.scale || 1;   // [opt-in] 旗子整体放大（龙纛 ×2.5）；1 = 原样
    const top = new THREE.Vector3(f.position.x, f.position.y + 0.58 * k, f.position.z);
    const LEN = 0.075 * k;   // 粒子间距
    if (!f.userData.parts) f.userData.parts = [0, 1, 2].map((i) => top.clone().add(new THREE.Vector3(LEN * (i + 1), 0, 0)));
    const P = f.userData.parts;
    const t = this.t;
    // 风：取共享风场在旗杆顶的值（926834721392340992 "I built a wind system to get them flapping just right"），再叠一点阵风
    const base = this.view.atmosphere?.sample ? this.view.atmosphere.sample(top.x, top.y, top.z) : new THREE.Vector3(1, 0, 0.35);
    const wind = new THREE.Vector3(base.x, 0, base.z).normalize().multiplyScalar(0.9 + 0.5 * Math.sin(t * 0.8 + (f.userData.fid || 0)));
    let prev = top;
    for (let i = 0; i < 3; i++) {
      const p = P[i];
      // 风 + 一点下垂 + 随相位抖动（飘）
      p.addScaledVector(wind, dt * 0.35);
      p.y += (Math.sin(t * 7 + i * 1.7 + (f.userData.fid || 0)) * 0.05 - 0.02) * dt;
      // 距离约束：跟着前一个点
      const d = p.clone().sub(prev), l = d.length() || 1e-6;
      p.copy(prev).addScaledVector(d, LEN / l);
      prev = p;
    }
    const pos = cloth.geometry.attributes.position;
    const H = 0.10 * k; // local wider banner proportions, not an exact source measurement
    for (let i = 0; i <= SEG; i++) {
      const u = i / SEG, v = 1 - u;
      const b = top.clone().multiplyScalar(v * v * v)
        .addScaledVector(P[0], 3 * v * v * u).addScaledVector(P[1], 3 * v * u * u).addScaledVector(P[2], u * u * u);
      pos.setXYZ(i * 2, b.x, b.y, b.z);
      pos.setXYZ(i * 2 + 1, b.x, b.y - H * (1 - 0.25 * u), b.z);   // 旗尾稍窄
    }
    pos.needsUpdate = true;
    // 883447205176238083：菱形标记是 billboard（片里无论绕到哪一侧都是正菱形，不跟着旗面翻）
    if (f.userData.marker) f.userData.marker.quaternion.copy(this.view.camera.quaternion);
  }
  #spawn(team, cell, squad, k, pos = null, kind = 'small') {
    const a = (k / 8) * Math.PI * 2, r = 0.12 + (k % 2) * 0.1;
    const u = { uid: (this._uidSeq = (this._uidSeq || 0) + 1), team, squad, k, hp: team === TEAM.DEF ? 3 : 2, max: team === TEAM.DEF ? 3 : 2, x: (pos?.x ?? cell.cx) + Math.cos(a) * r, z: (pos?.z ?? cell.cz) + Math.sin(a) * r, y: 0, cd: Math.random(), dead: false, onBoat: null, face: 0, soak: 0 };
    configureCombatUnit(u, {kind, maxHealth: kind === 'big' ? 6 : team === TEAM.DEF ? 3 : 2});
    if (this.unitScale !== 1) u.bodyScale = (u.bodyScale ?? 1) * this.unitScale;   // [opt-in]
    u.y = pos?.y ?? this.#groundY(u.x, u.z);
    u.navFloor = pos ? this.world.top(cell) : Math.round(u.y/this.L);
    this.units.push(u);
    if (squad) squad.members.push(u);
    return u;
  }
  #bleed(x, y, z, s, boat = null) {
    if (this.blood.count >= 600) return;
    const rot = Math.random() * 6, sxz = s * (0.6 + Math.random() * 0.6);
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y + 0.006, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot), new THREE.Vector3(s, 1, sxz));
    if (boat) {
      // Boat and blood are siblings under this.group. Capture before the next tick.
      boat.mesh.updateMatrix();
      boat.stains.push({ local: capturePlatformAnchor(boat.mesh.matrix, m), i: this.blood.count });
      // 946660607008403456（第 49 轮复核）：原片船上的血不是几个斑点，是整条船底浸透成一片红、白色尸体压在上面。
      // 每次在船上流血都给船体加一点「浸透」，船身颜色从木色往暗红过渡（约 6 次死伤浸满）。
      boat.gore = Math.min(1, (boat.gore || 0) + s * 1.6);
      const hullMat = boat.mesh.userData.hullMat;
      // 船壳只走到七成暗红：原片外侧仍是深栗色木壳，鲜红的是**舱内**那一片（由下面的血池负责）
      if (hullMat) hullMat.color.copy(COL.hullWood).lerp(COL.hullBlood, Math.pow(boat.gore, 0.8) * 0.75);
      // 船舱血池：沿船长方向从中间往两头铺开，gore 越高越满（整片红，不是斑点）
      const pool = boat.mesh.userData.deckPool;
      if (pool) {
        const g = boat.gore;
        pool.material.opacity = Math.min(0.94, g * 1.25);
        const fill = Math.min(1, g * 1.15);
        pool.scale.set(0.26 + 0.74 * fill, 1, 0.62 + 0.38 * fill);
      }
    } else if (this.poolGrow && this.poolGrow.length < 90) {
      // 984813819280191488（第 54 轮）：片子里血泊会随回合往外渗、相邻两摊并成一片，
      // 原来每摊一落地就冻住，看起来像贴了一堆硬边圆片。这里给地面血泊一个 ~2.4s 的扩张。
      this.poolGrow.push({ i: this.blood.count, x, y: y + 0.006, z, rot, sx: s, sz: sxz, t: 0, life: 2.4 });
    }
    this.blood.setMatrixAt(this.blood.count++, m);
    this.blood.instanceMatrix.needsUpdate = true;
    // 912691357440978957（战斗合集）：血不光摊在地面，还顺着崖壁往下抹、在崖脚积成一片
    this.#bleedWall(x, y, z, s);
  }

  /**
   * 崖壁上的血迹：脚下这个格子如果有更低的边邻格，就在那道立面上贴一片竖着的血（竖直拉长成流挂），
   * 崖脚再补一小摊。片子（912691357440978945）里崖壁是被血从上往下抹开的长条，不是只在地面一块块圆斑。
   */
  #bleedWall(x, y, z, s) {
    const c = this.#cellAt(x, z);
    if (!c) return;
    const hereTop = this.world.top(c), Lv = this.L;
    let added = 0;
    for (let i = 0; i < c.n && added < 2; i++) {
      const nb = c.edgeNeighbors[i];
      if (nb < 0) continue;
      const b = this.world.cells[nb];
      const drop = hereTop - this.world.top(b);
      if (drop < 1) continue;                       // 不是崖面
      if (this.blood.count >= 600) return;
      const dx = b.cx - c.cx, dz = b.cz - c.cz, dl = Math.hypot(dx, dz) || 1;
      const nx = dx / dl, nz = dz / dl;             // 面朝崖下的方向
      const edgeX = (c.cx + b.cx) / 2 + nx * 0.03, edgeZ = (c.cz + b.cz) / 2 + nz * 0.03;
      const topY = hereTop * Lv, botY = this.world.top(b) * Lv;
      const width = s * (1.2 + Math.random() * 0.8);
      const height = Math.min(topY - botY, s * (2.2 + Math.random() * 1.6));
      const py = topY - 0.02 - Math.random() * Math.max(0, topY - botY - height);
      // 局部 X→沿墙水平、局部 Y→墙法线、局部 Z→竖直（几何是 XZ 平面的圆片，这样贴上去就是竖立面）
      const rx = -nz, rz = nx;                      // 沿墙方向 = up × n
      const m = new THREE.Matrix4().set(
        rx * width, nx, 0, edgeX,
        0, 0, height, py,
        rz * width, nz, 0, edgeZ,
        0, 0, 0, 1);
      this.blood.setMatrixAt(this.blood.count++, m);
      added++;
    }
    if (added) this.blood.instanceMatrix.needsUpdate = true;
    if (added) this.#bleedAtFoot(x, z, s);
  }

  /** 崖脚积血：在崖面底部的地面上补一小摊 */
  #bleedAtFoot(x, z, s) {
    const c = this.#cellAt(x, z);
    if (!c || this.blood.count >= 600) return;
    const hereTop = this.world.top(c);
    for (let i = 0; i < c.n; i++) {
      const nb = c.edgeNeighbors[i];
      if (nb < 0) continue;
      const b = this.world.cells[nb], top = this.world.top(b);
      if (top > hereTop - 1) continue;
      const fx = (c.cx + b.cx) / 2 + (b.cx - c.cx) * 0.35, fz = (c.cz + b.cz) / 2 + (b.cz - c.cz) * 0.35;
      const m = new THREE.Matrix4().compose(
        new THREE.Vector3(fx, top * this.L + 0.008, fz),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.random() * 6),
        new THREE.Vector3(s * 1.6, 1, s * (1.0 + Math.random() * 0.8)));
      this.blood.setMatrixAt(this.blood.count++, m);
      this.blood.instanceMatrix.needsUpdate = true;
      return;
    }
  }

  /* ------------------------------------------------------------ 维京长船 */
  #launchWave() {
    let plan=planLanding(this.world,this.boats);
    this.lastLandingPlan=plan?'reserved':'blocked';
    if(!plan)return;
    this.wave++;
    // [opt-in] view.boatOrigins()：长船从母船出发——轮流选母船，几次泊位规划里挑离母船最近的滩，
    //   起点 = 母船，航向 = 母船 → 泊位（回程沿原路回母船）；inDur 按距离给时长（约 1.5 格/秒）。
    //   岸礁补齐：母船航线 corridorBlocked（泊位外沿 0.8 → 母船）压陆地的不算干净候选；
    //   十次采样全压陆地就退回标准直线走廊（plan/from/dir 不改），并记 trafficStats.originBlocked。
    const origins=this.view.boatOrigins?.()||[];
    let {land,dir,stop,from}=plan;
    if(origins.length){
      const o=origins[(this.wave-1)%origins.length],far=(p)=>Math.hypot(p.stop[0]-o.x,p.stop[1]-o.z);
      let best=null,bestD=Infinity;
      for(let k=0;k<10;k++){const p=planLanding(this.world,this.boats);if(!p)break;
        const d=far(p);if(d<bestD&&!corridorBlocked(this.world,[p.stop[0]+p.dir[0]*.8,p.stop[1]+p.dir[1]*.8],[o.x,o.z],{except:[p.land]})){best=p;bestD=d;}}
      if(best){plan=best;({land,stop}=plan);from=[o.x,o.z];
        const dx=o.x-plan.stop[0],dz=o.z-plan.stop[1],l=Math.hypot(dx,dz)||1;dir=[dx/l,dz/l];}
      else this.trafficStats.originBlocked++;
    }
    const bs=this.boatScale;
    const berth = bs === 1 ? stop : [stop[0] + dir[0] * 0.64 * (bs - 1), stop[1] + dir[1] * 0.64 * (bs - 1)];   // [opt-in] 船放大后往海里退半个船长，船头不扎进岸
    const mesh = this.#longship();
    mesh.scale.setScalar(bs);   // [opt-in]
    this.group.add(mesh);
    const boat = { mesh, from, stop: berth, dir, t: 0, state: 'in', land, crew: [], stains: [], trail: [], x: from[0], z: from[1], avoid: 0, inDur: origins.length ? Math.max(9, Math.hypot(from[0] - berth[0], from[1] - berth[1]) / 1.5) : 9 };
    const n = 6 + Math.min(6, this.wave * 2);
    for (let k = 0; k < n; k++) { const u = this.#spawn(TEAM.VIK, land, null, k, { x: from[0], z: from[1], y: 0.05 }, this.wave >= 3 && k === 0 ? 'big' : 'small'); u.onBoat = boat; u.seat = k; boat.crew.push(u); }
    this.boats.push(boat);
  }
  #longship() {
    const g = new THREE.Group();
    const s = new THREE.Shape();
    s.moveTo(-0.55, 0); s.quadraticCurveTo(0, -0.14, 0.55, 0); s.lineTo(0.64, 0.16); s.quadraticCurveTo(0, 0.03, -0.64, 0.16); s.closePath();
    const hull = g.userData.hull = new THREE.Mesh(new THREE.ExtrudeGeometry(s, { depth: 0.2, bevelEnabled: false }).translate(0, 0, -0.1), new THREE.MeshStandardMaterial({ color: '#6a4a52', roughness: 0.9, flatShading: true }));
    g.userData.hullMat = hull.material;   // 船体浸血着色用（每条船自己的材质）
    g.add(hull);
    // 946660607008403456（第 54 轮）：船舱底的血池。原片里整条船底是**一片连续的暗红**、白尸体压在上面；
    // 本仓原来只靠斑块 decal + 船壳整体变色，船内看起来仍是木色底上几个红点。
    // 船舱底是一条下凹的二次曲线（船头船尾 y=0.16、中间 y=0.03），所以血池不能是一张平板，
    // 要贴着这条曲线做一条带子，否则中间会穿出船板、两头又埋进木里。
    const pw = 32, ph = 10, pdata = new Uint8Array(pw * ph * 4);
    for (let j = 0; j < ph; j++) for (let i = 0; i < pw; i++) {
      const u = (i + 0.5) / pw * 2 - 1, v = (j + 0.5) / ph * 2 - 1;
      // 船舱俯视是两头尖的梭形，再叠一层低频噪声把边缘啃出不规则齿
      const lens = 1 - Math.abs(u) * 1.02, wob = (Math.sin(u * 9.1 + 1.7) + Math.sin(u * 21.3) * 0.5) * 0.18;
      const edge = Math.min(1, Math.max(0, (lens - Math.abs(v) * 0.86 + wob) * 8));
      const k = (j * pw + i) * 4;
      pdata[k] = pdata[k + 1] = pdata[k + 2] = 255;
      pdata[k + 3] = (edge * 255) | 0;
    }
    const ptex = new THREE.DataTexture(pdata, pw, ph, THREE.RGBAFormat);
    ptex.magFilter = THREE.LinearFilter; ptex.minFilter = THREE.LinearFilter; ptex.needsUpdate = true;
    const NSEG = 24, ppos = [], puv = [];
    const deckY = (t) => { const it = 1 - t; return it * it * 0.16 + 2 * it * t * 0.03 + t * t * 0.16; };
    for (let i = 0; i <= NSEG; i++) {
      const t = i / NSEG, x = 0.64 - 1.28 * t;
      ppos.push(x, deckY(t) + 0.005, -0.088, x, deckY(t) + 0.005, 0.088);
      puv.push(t, 0, t, 1);
    }
    const pidx = [];
    for (let i = 0; i < NSEG; i++) { const a = i * 2, b = a + 1, c = a + 2, d = a + 3; pidx.push(a, b, c, b, d, c); }
    const pgeo = new THREE.BufferGeometry();
    pgeo.setAttribute('position', new THREE.Float32BufferAttribute(ppos, 3));
    pgeo.setAttribute('uv', new THREE.Float32BufferAttribute(puv, 2));
    pgeo.setIndex(pidx);
    const pool = new THREE.Mesh(pgeo, new THREE.MeshBasicMaterial({ color: '#6d161c', map: ptex, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -3 }));
    pool.renderOrder = 4;
    pool.scale.set(0.26, 1, 0.62);
    g.userData.deckPool = pool; g.add(pool);
    // 船舷一排橙色圆盾（截图）
    for (let i = -3; i <= 3; i++) for (const side of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.CircleGeometry(0.045, 10), new THREE.MeshBasicMaterial({ color: '#f0a35e', side: THREE.DoubleSide }));
      sh.position.set(i * 0.13, 0.07, side * 0.105); g.add(sh);
    }
    g.userData.wake = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#ffffff', size: 3, sizeAttenuation: false, transparent: true, opacity: 0.9 }));
    this.group.add(g.userData.wake);
    return g;
  }

  /* ------------------------------------------------------------ 输入 */
  /** 返回 true = 这次点击被战斗层吃掉了（不当建造） */
  onPointer(hit) {
    if (!this.running || !hit?.cell) return false;
    if (this.c03.onPointer(hit)) return true;   // C03：Plunge 选目标 / Select·Move·Swap 确认弹窗
    const c = hit.cell;
    // 点到小队附近 → 选中
    let best = null, bd = 0.6;
    for (const sq of this.squads) {
      if (!sq.alive) continue;
      const [x, z] = this.#centroid(sq);
      const y=this.#squadY(sq);
      const d = Math.hypot(x - hit.point.x, z - hit.point.z, y-hit.point.y);
      if (d < bd) { bd = d; best = sq; }
    }
    if (best) { this.selected = best; this.scale = 0.15; this.#hud(); return true; }
    if (this.selected) {
      const picked=this.navigation.pick(c,hit.point.y);
      const lead=this.selected.members.find(u=>!u.dead&&!u.onBoat);
      if(!picked||!lead||!this.navigation.plan(lead,picked.cell,picked.floor)){this.#hud('那里走不过去');return true;}
      this.selected.goal=picked.cell;this.selected.goalFloor=picked.floor;
      this.#drawPath(this.selected,picked.cell);
      this.g3.onMove(this.selected,picked);
      this.c01.onMove(this.selected,picked);
      this.selected = null; this.scale = 1; this.#hud();
      return true;
    }
    return true;   // Bad North 场景里点击不建造
  }
  togglePause() { this.paused = !this.paused; this.#hud(); }
  applyHit(v, by) { this.#hit(v, by); }   // G3 扫掠 / 盾格挡之后的落点
  #squadY(sq) { const a=sq.members.filter(u=>!u.dead);return a.length?a.reduce((sum,u)=>sum+u.y,0)/a.length:0; }
  #centroid(sq) {
    const a = sq.members.filter((u) => !u.dead);
    if (!a.length) return [0, 0];
    return [a.reduce((s, u) => s + u.x, 0) / a.length, a.reduce((s, u) => s + u.z, 0) / a.length];
  }
  /** 883447205176238083：选中队伍脚下的占位线网（轮廓 / 辐条 / 角标），按格边界走。 */
  setFootprint(on) {
    this.footprintOn = !!on;
    if (!on) { this.footprintLines.visible = false; this.footprintStats = null; }
  }
  #updateFootprint(force = false) {
    const sq = this.selected;
    if (!this.footprintOn || !sq || !sq.alive) { this.footprintLines.visible = false; this.footprintStats = null; this._fpSel = null; return; }
    if (!force && sq === this._fpSel && this.t - this._fpStamp < 0.1) return;
    this._fpSel = sq; this._fpStamp = this.t;
    const men = [], cells = [], seen = new Set();
    for (const u of sq.members) {
      if (u.dead || u.onBoat) continue;
      men.push([u.x, u.z]);
      const c = this.#cellAt(u.x, u.z); if (!c) continue;
      if (!seen.has(c.id)) { seen.add(c.id); cells.push(c); }
    }
    if (!men.length || !cells.length) { this.footprintLines.visible = false; this.footprintStats = null; return; }
    const fp = footprintBoundary(men, cells);
    const pts = [], push = (a, b) => { pts.push(a[0], a[1], a[2], b[0], b[1], b[2]); };
    // 格角正落在格边界上，取高度时朝中心缩 2%，免得取到邻格的台面
    const at = ([x, z]) => [x, this.#groundY(x, z) + 0.03, z];
    const lift = ([x, z]) => at([x + (fp.hub[0] - x) * 0.02, z + (fp.hub[1] - z) * 0.02]);
    for (const r of (fp.rings ?? [fp.ring])) for (let i = 0; i < r.length; i++) push(lift(r[i]), lift(r[(i + 1) % r.length]));
    for (const [, p] of fp.spokes) push(lift(p), at(fp.hub));   // 辐条：中心 → 每个角
    for (const t of fp.ticks) for (let i = 0; i < 4; i++) push(lift(t[i]), lift(t[(i + 1) % 4]));
    const g = this.footprintLines.geometry;
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.computeBoundingSphere();
    this.footprintLines.visible = true;
    this.footprintStats = {
      squad: sq.id, men: men.length, cells: cells.length, ring: fp.ring.length, spokes: fp.spokes.length,
      ticks: fp.ticks.length, tris: fp.tris.length, area: fp.area, cellArea: fp.cellArea, perimeter: fp.perimeter,
      hullArea: fp.hullArea, notchArea: fp.notchArea, triArea: fp.triArea, segments: pts.length / 6,
      minLift: (() => { let m = 1e9; const a = g.attributes.position.array; for (let i = 0; i < a.length; i += 3) { const c = this.#cellAt(a[i], a[i + 2]); if (!c) continue; m = Math.min(m, Math.abs(a[i + 1] - (this.world.top(c) * this.L + 0.03))); } return m === 1e9 ? null : m; })(),
    };
  }
  #drawPath(sq, goal) {
    const lead=sq.members.find(u=>!u.dead&&!u.onBoat),pts=[];
    const plan=lead?this.navigation.plan(lead,goal,sq.goalFloor??this.world.top(goal)):null;
    const graph=this.navigation.graph;
    for(let id=plan?.from.id??-1,k=0;id>=0&&k<graph.nodes.length;k++){
      const a=graph.nodes[id],next=plan.tree.next[id];pts.push([a.x,a.floor*this.L+.05,a.z]);
      if(next<0)break;
      id=next;
    }
    // 827215002448846848（G5）：Catmull-Rom 平滑 + 弧长等距 + 贴地 + 带状格子（BattleNavigation.commandRibbon）
    const samples=this.navigation.commandRibbon?this.navigation.commandRibbon(pts,{spacing:.15}):samplePath(pts,{spacing:.15,maxSamples:65536});
    this.commandPathSamples=samples; // Render-only diagnostic; AI still follows the existing layered route.
    this.path.geometry.setAttribute('position', new THREE.Float32BufferAttribute(samples.points.flat(), 3));
    this.pathT = 2.5;
  }
  #hud(msg) {
    const alive = this.squads.filter((s) => s.alive).length;
    const lost = this.houses.filter((h) => h.lost).length;
    const vik = this.units.filter((u) => u.team === TEAM.VIK && !u.dead).length;
    this.hud.textContent = msg || `第 ${this.wave} 波 · 维京人 ${vik} · 守军 ${alive} 队 · 小屋 ${this.houses.length - lost}/${this.houses.length}` +
      (this.paused ? ' · 已暂停（空格继续）' : this.selected ? ' · 已选中，点地面下令（时间变慢）' : ' · 点小队选中 · 空格暂停');
  }

  /* ------------------------------------------------------------ 每帧 */
  update(dtReal) {
    if (!this.running) return;
    const dt = this.paused ? 0 : Math.min(0.05, dtReal) * this.scale;
    this.t += dt;
    // 926834721392340992: flag particles share the actual simulation clock.
    this._dt = dt;
    const w = this.world, L = this.L;
    if(this.passageStats?.version!==w.version||this._passageGeometry!==this.view.mesh.geometry||this._passageStairs!==this.view.navLayer?.stairs.geometry){this.navCache.clear();this.refreshPassages();}
    else if(this.showPassages)this.#updatePassageFade(dtReal);
    // 同一帧里 devicePixelRatio 可能被改（缩放/换屏）：下限按物理像素跟着走。
    if(this.passageDotStyle?.mode==='world')syncPointFloor(this.passageDots.material.userData.pointFloor,this.passageDotStyle.minPx,this.#pixelRatio());
    if (this.t > this.nextWave) { this.#launchWave(); this.nextWave = this.t + 26; this.#hud(); }
    // 长船（974325184525201409 动态避让：in/out 每帧 steerBoat——先直线，压高优先级船的航线就
    // 按侧偏表找干净走廊，全堵则停船等让；侧偏 b.avoid 缓动，不改 dir/泊位对齐。本地近似，非原片机制）
    for (let bi = 0; bi < this.boats.length; bi++) {
      const b = this.boats[bi];
      if (b.state === 'in') {
        const st = steerBoat(b, this.boats, bi, { world: this.world, except: [b.land] });
        b.hold = st.hold; this.trafficStats.holdFrames += st.hold ? 1 : 0; this.trafficStats.sidestepFrames += st.offset ? 1 : 0;
        b.avoid = (b.avoid || 0) + ((st.hold ? b.avoid || 0 : st.offset) - (b.avoid || 0)) * Math.min(1, dt * 3);
        if (!st.hold) {
          b.t = Math.min(1, b.t + dt / (b.inDur || 9));   // [opt-in] 从母船出发时按距离给时长
          const e = 1 - (1 - b.t) * (1 - b.t);
          b.x = b.from[0] + (b.stop[0] - b.from[0]) * e; b.z = b.from[1] + (b.stop[1] - b.from[1]) * e;
          if (b.t >= 1) { b.state = 'unload'; b.wait = 0; b.avoid = 0; }
        }
      } else if (b.state === 'unload') {
        b.hold = false;
        b.wait += dt;
        for (const u of b.crew) if (u.onBoat && !u.dead && b.wait > 0.3 + u.seat * 0.25) { u.onBoat = null; u.x = b.land.cx + (Math.random() - 0.5) * 0.3; u.z = b.land.cz + (Math.random() - 0.5) * 0.3; }
        if (b.crew.every((u) => !u.onBoat || u.dead) && b.wait > 4) { b.state = 'out'; b.t = 0; }
      } else {
        const st = steerBoat(b, this.boats, bi);
        b.hold = st.hold; this.trafficStats.holdFrames += st.hold ? 1 : 0; this.trafficStats.sidestepFrames += st.offset ? 1 : 0;
        b.avoid = (b.avoid || 0) + ((st.hold ? b.avoid || 0 : st.offset) - (b.avoid || 0)) * Math.min(1, dt * 3);
        if (!st.hold) b.t += dt / 14;
        b.x = b.stop[0] + b.dir[0] * b.t * 16; b.z = b.stop[1] + b.dir[1] * b.t * 16;
      }
      // 侧偏叠加在直线路径上（in：行进方向 = -dir；out：+dir；perp = 行进方向左手）
      if (b.avoid) { const fx = b.state === 'out' ? b.dir[0] : -b.dir[0], fz = b.state === 'out' ? b.dir[1] : -b.dir[1]; b.x += -fz * b.avoid; b.z += fx * b.avoid; }
      const ang = Math.atan2(b.dir[1], b.dir[0]) + (b.state === 'out' ? 0 : Math.PI);
      const bob = Math.sin(this.t * 2 + b.from[0]) * 0.01;
      b.mesh.position.set(b.x, 0.02 + bob, b.z);
      b.mesh.rotation.set(0, -ang, Math.sin(this.t * 1.5) * 0.03);
      b.mesh.updateMatrixWorld();
      // 尾迹：船尾撒白点，慢慢散开（901469409579061248）
      if (b.state !== 'unload' && !b.hold && Math.random() < 0.9) b.trail.push({ x: b.x - Math.cos(-b.mesh.rotation.y) * 0.55 * this.boatScale, z: b.z - Math.sin(-b.mesh.rotation.y) * 0.55 * this.boatScale, a: 0, s: Math.random() < 0.5 ? 1 : -1 });   // [opt-in] 尾迹随船放大；让行停船不撒
      for (const p of b.trail) { p.a += dt; const px = -Math.sin(-b.mesh.rotation.y) * p.s, pz = Math.cos(-b.mesh.rotation.y) * p.s; p.x += px * dt * 0.12; p.z += pz * dt * 0.12; }
      b.trail = b.trail.filter((p) => p.a < 4).slice(-260);
      b.mesh.userData.wake.geometry.setAttribute('position', new THREE.Float32BufferAttribute(b.trail.flatMap((p) => [p.x, 0.02, p.z]), 3));
      // 粘在船上的血：跟着船移动
      for (const st of b.stains) this.blood.setMatrixAt(st.i, resolvePlatformAnchor(b.mesh.matrix, st.local));
      if (b.stains.length) this.blood.instanceMatrix.needsUpdate = true;
    }
    // 984813819280191488：刚流下来的地面血泊还在往外渗（约 2.4s 铺到 1.42 倍），之后定型。
    if (this.poolGrow.length) {
      const gm = this._poolM || (this._poolM = new THREE.Matrix4());
      const gq = this._poolQ || (this._poolQ = new THREE.Quaternion());
      const gp = this._poolP || (this._poolP = new THREE.Vector3());
      const gs = this._poolS || (this._poolS = new THREE.Vector3());
      const axis = this._poolAxis || (this._poolAxis = new THREE.Vector3(0, 1, 0));
      for (const g of this.poolGrow) {
        g.t += dt;
        const k = Math.min(1, g.t / g.life), e = 1 - (1 - k) * (1 - k);
        const f = 1 + 0.42 * e;
        gq.setFromAxisAngle(axis, g.rot);
        gm.compose(gp.set(g.x, g.y, g.z), gq, gs.set(g.sx * f, 1, g.sz * f));
        this.blood.setMatrixAt(g.i, gm);
      }
      this.poolGrow = this.poolGrow.filter((g) => g.t < g.life);
      this.blood.instanceMatrix.needsUpdate = true;
    }
    this.boats = this.boats.filter((b) => {
      if (b.state !== 'out' || b.t <= 1.2) return true;
      this.group.remove(b.mesh, b.mesh.userData.wake);
      for (const st of b.stains) this.blood.setMatrixAt(st.i, new THREE.Matrix4().makeScale(0, 0, 0));
      if (b.stains.length) this.blood.instanceMatrix.needsUpdate = true;
      this.units = this.units.filter((u) => !(u.dead && u.onBoat === b));
      return false;
    });

    // 流场（972829402873716737 / 901842167508992000）：每 0.25 秒按"守军"重算一次；维京人用它找最近的守军 + 兵种
    this.flowT = (this.flowT || 0) - dt;
    if (this.flowT <= 0 || !this.flowDef || this.flowDef.version !== w.version) {
      this.flowT = 0.25;
      this.navigation.refresh();
      const srcs = this.units.filter(u=>u.team===TEAM.DEF&&!u.dead&&!u.onBoat&&!u.fall).map(u=>({unit:u,cell:this.#cellAt(u.x,u.z),node:this.navigation.unitNode(u)?.id??-1,type:u.squad.archer?'弓手':u.squad.pike?'矛兵':'步兵',squad:u.squad.id}));
      this.flowDef = buildLayeredFlowField(this.navigation.graph,srcs);
      this.#drawFlow();
    }
    // 单位
    const alive = this.units.filter((u) => !u.dead);
    for (const u of alive) {
      const stunned = stepStun(u, dt);
      if (this.c03.step(u, dt)) continue;   // C03：Plunge 跃起中
      if (u.spearRecovery) {
        u.spearRecovery.remaining = Math.max(0, u.spearRecovery.remaining-dt);
        if (!u.spearRecovery.remaining) u.spearRecovery = null;
      }
      if (u.fall) { u.thrust = u.spearRecovery = null; this.#fallStep(u, dt); continue; }
      if (u.onBoat) {
        u.thrust = u.spearRecovery = null;
        const b = u.onBoat, row = (u.seat % 7) - 3, side = u.seat % 2 ? 1 : -1;
        const bs = this.boatScale, lx = row * 0.12 * bs, lz = side * 0.04 * bs;   // [opt-in] 座位随船放大
        const ca = Math.cos(-b.mesh.rotation.y), sa = Math.sin(-b.mesh.rotation.y);
        u.x = b.mesh.position.x + lx * ca - lz * sa; u.z = b.mesh.position.z + lx * sa + lz * ca; u.y = b.mesh.position.y + 0.03 * bs;
        continue;
      }
      // 828984794407170048（G5）：逐人取脚下真实地面（楼梯上是那一级踏面），不只是整层高度。
      // 所有接地单位每帧都向脚高缓动一次 —— 近战/横扫/刺击/眩晕/待命时层高变化也不许冻在半空；
      // 坠落/船上/跃起各有自己的 y（上面 continue 掉），dt=0（暂停/零步长）时公式自然冻结。
      u.y = this.navigation.footHeight ? easeUnitToHeight(u.y, this.navigation.footHeight(u), dt) : easeUnitGroundHeight(u.y, u.navFloor ?? Math.max(0, Math.round(u.y / this.L)), this.L, dt);
      if (stunned) { u.thrust = u.spearRecovery = null; continue; } // Getting hit interrupts the thrust.
      u.cd -= dt;
      if (u.sweep) { this.g3.stepSweep(u, alive, dt); continue; }
      if (u.thrust) {
        // 903647529203634176：一次刺击的命中集是**唯一事实源** —— 掉血、飘字、命中计数都从这一个数组派生，
        // 不许另写一套「按角度找敌人」的旁路（第 44 轮记的「两处实现未联动」就是那种旁路）。
        const hits = stepSpearThrust(u.thrust, alive, dt, {canHit: v =>
          v.team !== u.team && !v.onBoat && !v.fall && this.navigation.canMelee(u, v)});
        const popupsBefore = this.damageStats.spawned, killsBefore = this.damageStats.kills;
        for (const target of hits) this.#hit(target, u, u.thrust);   // [opt-in] 传矛轴：knockoffWater 时沿矛「顶着走」
        // 联动度量：每一帧都写 lastThrust*（没命中就是 0），验收里逐帧对数；
        // hitSet 只累加真命中，thrustFrames 记「这一刺有几帧打到了人」。
        this.damageStats.lastThrustHits = hits.length;
        this.damageStats.lastThrustPopups = this.damageStats.spawned - popupsBefore;
        this.damageStats.lastThrustKills = this.damageStats.kills - killsBefore;
        if (hits.length) { this.damageStats.hitSet += hits.length; this.damageStats.thrustFrames += 1; }
        if (u.thrust.done) {
          u.spearRecovery = {remaining: .12, duration: .12, dx: u.thrust.dx, dz: u.thrust.dz, length: u.thrust.length};
          u.thrust = null;
        }
        continue;
      }
      // 最近的敌人
      let foe = null, fd = 1e9;
      for (const v of alive) { if (v.team === u.team || v.onBoat && u.team === TEAM.VIK) continue; const d = Math.hypot(v.x - u.x, v.z - u.z); if (d < fd) { fd = d; foe = v; } }
      const archer = u.squad?.archer;
      const reach = u.squad?.pike ? 0.44 : 0.28;   // 矛兵够得更远，先出手（903647529203634176）
      // 架矛（903647529203634176 frame-0100/0120：敌人还没到身前，整排矛已压平指向来敌，形成一排放射线）
      if (u.squad?.pike) u.brace = foe && fd < 1.6 && fd >= reach ? Math.atan2(foe.x - u.x, foe.z - u.z) : null;
      if (foe && fd < reach && this.navigation.canMelee(u,foe)) {
        u.face = Math.atan2(foe.x - u.x, foe.z - u.z);
        if (u.cd <= 0) {
          if (u.squad?.pike) {
            if (dt > 0) {
              u.cd = 0.9 + Math.random() * 0.3;
              u.spearRecovery = null;
              u.thrust = beginSpearThrust(u, fd > 1e-8 ? {x: foe.x-u.x, z: foe.z-u.z} : {x: Math.sin(u.face), z: Math.cos(u.face)}, {targets: alive});
            }
          } else { u.cd = 0.9 + Math.random() * 0.3; if (!this.g3.melee(u, foe, alive)) this.#hit(foe, u); }
        }
        continue;
      }
      if (archer && foe && foe.team === TEAM.VIK && fd < 4.5 && u.cd <= 0) {
        u.cd = 1.6 + Math.random() * 0.6;
        this.#shoot(u, foe);
      }
      // 走：守军走向小队目标，维京人走向最近的小屋（站在门口）
      let goal = null, goalFloor = null;
      if (u.team === TEAM.DEF) { goal = u.squad.goal;goalFloor=u.squad.goalFloor; }
      else {
        const open = this.houses.filter((h) => !h.lost && h.door);
        // 流场：最近的守军在 1.6 以内就顺着流向扑过去（数据继承告诉我们那是什么兵种：维京人绕开矛兵的正面）
        const f = this.flowDef?.atNode(this.navigation.unitNode(u)?.id??-1);
        if (f && f.dist < 1.6) { goal = f.source.type === '矛兵' && f.dist > 0.6 ? null : f.source.cell; if(goal)goalFloor=f.source.unit?.navFloor; }
        if (foe && fd < 1.2 && foe.team === TEAM.DEF && !goal) { goal=this.#cellAt(foe.x,foe.z);goalFloor=foe.navFloor; }
        // 883447205176238083（G5）：自己没看见，但相邻同伴转告了守军位置 → 一起扑过去（动态节点图，info-graph.js）
        if (!goal && this.infoSharing !== false) { const k = (this.infoGraph ??= new InfoGraph()).goalFor(u, this, alive); if (k) { goal = k.cell; goalFloor = k.floor; } }
        if (!goal && open.length) goal = open.reduce((a, h) => (Math.hypot(h.door.cx - u.x, h.door.cz - u.z) < Math.hypot(a.door.cx - u.x, a.door.cz - u.z) ? h : a)).door;
      }
      if (u.tmGoal && u.team === TEAM.VIK && !(foe && fd < 0.6 && foe.team === TEAM.DEF)) { goal = u.tmGoal; goalFloor = w.top(goal); }   // [opt-in] 外部导航目标（苔庭：扑向霸天重甲兵），近身守军仍优先
      if (!goal) continue;
      const plan=this.navigation.plan(u,goal,goalFloor??w.top(goal));
      if(!plan)continue; // Never fall back to a straight line through blocked voxels.
      const here=plan.from.cell,next=plan.next.cell;
      const aim=this.navigation.steerTarget(u,plan);
      let tx=aim?.x??next.cx,tz=aim?.z??next.cz;
      if(!plan.arrived){
        const nav=this.#nav(goal);
        if(this._trafficVersion!==w.version){this._traffic=narrowCells(w,nav);this._trafficVersion=w.version;}
        if(this._traffic[here.id]||this._traffic[next.id]){const lane=leftLaneTarget(here,next,{width:Math.max(.08,u.radius??.055),bodyRadius:u.radius??.055});tx=lane.x;tz=lane.z;}
      }
      // 编队偏移：同一小队在目标格周围围一圈
      const off = u.team === TEAM.DEF ? 0.16 : 0.12;
      const near = plan.arrived;
      if (near) { const a = (u.k / 8) * Math.PI * 2; tx += Math.cos(a) * off * (1 + (u.k % 2)); tz += Math.sin(a) * off * (1 + (u.k % 2)); }
      // 816743289500106752（第 173 轮）：列队同时给速度倍率 —— 拐角处按「转角 + 离拐点远近」降速（内圈更慢）。
      let steerK = 1;
      if (this.c01.on.column) { const st = this.c01.steer(u, plan, tx, tz, near); tx = st.tx; tz = st.tz; steerK = st.speed ?? 1; }
      const dx = tx - u.x, dz = tz - u.z, d = Math.hypot(dx, dz);
      const speed = (u.team === TEAM.DEF ? 0.9 : 0.75) * steerK;
      if (d > 0.02) {
        const s = Math.min(d, speed * dt) / d;
        // Local overlap separation supplements the stable lane target above.
        const separation = localSeparation(u,alive,dt,{heightTolerance:this.L*.6});
        this.#step(u, dx * s, dz * s, separation, plan);
        u.face = Math.atan2(dx, dz);
      }
      // 828984794407170048：层高缓动已上移到本循环前段 —— 落地/近战/待命所有接地状态共用同一处，
      // 走路分支不再单写一遍（写两遍会让移动单位每帧缓动两次、等效速率翻倍，不是已验收的 exp(-10) 解析曲线）。
    }
    // 小屋：维京人在门口站够 4 秒 → 着火
    for (const h of this.houses) {
      if (h.lost || !h.door) continue;
      const floor = w.top(h.door);
      const vikNear = alive.some((u) => u.team === TEAM.VIK && atHouseDoor(u,h.door,{floor,levelHeight:L,radius:.5}));
      const defNear = alive.some((u) => u.team === TEAM.DEF && atHouseDoor(u,h.door,{floor,levelHeight:L,radius:.7}));
      h.burn = vikNear && !defNear ? h.burn + dt : Math.max(0, h.burn - dt * 0.5);
      if (h.burn > 4) {
        h.lost = true;
        const c = h.cell, y = (w.top(c) + 0.6) * L;
        this.view.effects.fireSources.push({ x: c.cx, y, z: c.cz }, { x: c.cx + 0.1, y, z: c.cz - 0.08 });
        this.view.effects.showFire = true;
        this.view.smoke?.sources.push({ x: c.cx, y: y + 0.1, z: c.cz });   // 着火的小屋冒黑烟（1015140880666300416）
        // 第 89 轮（837027901853810688）：这一处是「爆燃」——火先亮、烟被顶起来，两条不同步曲线。
        // 点火的是刚推进去的那个源，别 ignite(0)：0 号是常驻烟囱，点它会让整座岛一起变粗。
        const sm = this.view.smoke;
        if (sm) {
          const si = sm.sources.length - 1;
          sm.setFireCoupling?.(true);   // [opt-in] 桩 view 可以只有 sources：两个调用都按可选处理
          sm.ignite?.(si);
        }
        this.#hud();
      }
    }
    // 箭
    for (const a of this.arrows) {
      if (a.stuck) continue;
      a.t += dt / a.dur;
      const t = Math.min(1, a.t);
      // 987267068495003648（G5）：无阻力解析 shot 与烘表（带 drag）shot 共用一个求位置函数
      const T = t * a.dur, ps = projectileState(a.from, a.to, a.shot, T, G), x = ps.x, y = ps.y, z = ps.z;
      const from=a.previous??{x:a.from[0],y:a.from[1],z:a.from[2]},to={x,y,z};
      if (!this.navigation.clearSegment(from,to)) { a.stuck=true; a.mesh.position.set(from.x,from.y,from.z); if(a.trail)a.trail.visible=false; continue; }
      a.previous=to;
      a.mesh.position.set(x, y, z);
      if (a.trail) { const pa = a.trail.geometry.attributes.position; pa.setXYZ(1, x, y, z); pa.needsUpdate = true; a.trail.geometry.computeBoundingSphere(); }
      a.mesh.lookAt(ps.look[0], ps.look[1], ps.look[2]);
      if (t >= 1) {
        a.stuck = true;
        if (a.trail) a.trail.visible = false;   // 落定后轨迹线收掉，只留插在地上的箭
        const tg = a.target;
        const bodyScale = tg.bodyScale ?? 1;
        if (!tg.dead && Math.hypot(tg.x - x, tg.y+.08*bodyScale-y, tg.z - z) < 0.18*bodyScale) { this.#hit(tg, null); if (tg.dead) this.#creditKill(tg, a.shooter); a.mesh.visible = false; }
        else {
          // 射空：落在船上 → 粘在船上随船走（946660607008403456）；否则插在地上
          const boat = this.boats.find((b) => Math.hypot(b.mesh.position.x - x, b.mesh.position.z - z) < 0.6);
          if (boat) { boat.mesh.attach(a.mesh); }
          else a.mesh.position.y = Math.max(a.mesh.position.y, this.#groundY(x, z) + 0.04);
        }
      }
    }
    if (this.arrows.length > 160) { const old = this.arrows.shift(); old.mesh.parent?.remove(old.mesh); old.trail?.parent?.remove(old.trail); }
    // 小队全灭
    for (const sq of this.squads) if (sq.alive && sq.members.every((u) => u.dead)) { sq.alive = false; sq.flag.visible = false; sq.flag.userData.cloth.visible = false; if (this.selected === sq) { this.selected = null; this.scale = 1; } this.#hud(); }
    // [opt-in] knockoffWater：溺水下沉计时 + 水花扩散
    if (this.knockoff) { for (const u of this.units) if (u.drown) u.drown.t += dt; stepSplashes(this.splashes, dt); }
    // 血滴：抛物线落地 → 一小摊血
    this.#updateDamageNumbers(dt);
    for (const d of this.drops) { d.vy -= 5 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt; const gy = this.#groundY(d.x, d.z); if (d.y <= gy) { d.done = true; this.#bleed(d.x, gy, d.z, 0.02 + Math.random() * 0.02); } }
    this.drops = this.drops.filter((d) => !d.done);
    // 把还在飞的血滴画出来（落地那一下才变成贴地血斑）
    const dp = this.dropPoints.geometry.attributes.position, dn = Math.min(this.drops.length, 600);
    for (let i = 0; i < dn; i++) { const d = this.drops[i]; dp.setXYZ(i, d.x, d.y, d.z); }
    if (dn) dp.needsUpdate = true;
    this.dropPoints.geometry.setDrawRange(0, dn);
    this.#draw();
    this.g3.afterDraw(dt);
    this.c01.afterDraw(dt);
    this.c02.afterDraw(dt);
    this.c03.afterDraw(dt, dtReal);
    // 817323301357948928（G5）：实例批之后按视锥剔除 + 小于 9px 的单位退到「身体+白盔」（有真实渲染器时默认开）
    if (this.unitLodEnabled ?? !!this.view.renderer) (this.unitLod ??= new UnitBatchLod()).apply(this, this.view.camera);
    if (this.pathT > 0) { this.pathT -= dtReal; this.path.material.opacity = Math.min(1, this.pathT); this.path.material.transparent = true; if (this.pathT <= 0) this.path.geometry.setAttribute('position', new THREE.Float32BufferAttribute([], 3)); }
    if ((this._hudT = (this._hudT || 0) + dtReal) > 0.5) { this._hudT = 0; this.#hud(); }
  }

  /**
   * 流场调试：每格到父格画一段（数据继承的树）；颜色由 view.flowColorBy 决定
   *   'unit'（默认）→ 902069261304287232：一支守军一个颜色，同兵种的两支队伍也能分开（片子里青/粉/黄三棵树各属一支队伍）；
   *   'type'          → 901842167508992000：颜色 = 最近单位的兵种（步兵/矛兵/弓手），三种颜色铺满全岛。
   * 父格连线之外，再给每格画出「所有更近的邻格」的细短须（片子每格是从格心朝各方向散开的一小片须，不是单一一根）。
   */
  #drawFlow() {
    const on = !!this.view.flowDebug;
    this.flowLines.visible = on;
    this.flowGrid.visible = on;
    this.flowFaces.visible = on;
    if (this.flowLegend) this.flowLegend.style.display = on ? 'block' : 'none';
    if (this.flowDim) this.flowDim.visible = on;
    if (!on || !this.flowDef) return;
    const F = this.flowDef, nodes = F.nodes, L = this.L, pos = [], col = [];
    const byType = (this.view.flowColorBy || 'unit') === 'type';
    const TYPES = ['步兵', '矛兵', '弓手'];
    const C_UNIT = [[0.15, 0.55, 1.0], [1.0, 0.45, 0.1], [0.15, 0.85, 0.35], [0.95, 0.3, 0.85], [0.95, 0.9, 0.2], [0.3, 0.9, 0.9]];
    const C_TYPE = [[0.95, 0.35, 0.75], [0.72, 0.95, 0.2], [0.2, 0.85, 1.0]];
    const squadIds = [...new Set(F.sources.map((s) => s.squad))];
    const palette = (k) => {
      if (byType) {
        // 第 70 轮：原片 902069261304287232 frame-0090 一条街上同时有青 / 粉 / 黄绿三种线 = 三种兵种。
        // 旧写法 `TYPES.indexOf(type)` 对不在表里的兵种返回 -1 → max(0,-1)=0 → 未知兵种全被染成第一种颜色，
        // 于是画面只剩 2 色。改成：已知兵种按序号，未知兵种用字符串散列取一个与已知色不冲突的槽。
        const ti = TYPES.indexOf(F.sources[k]?.type);
        if (ti >= 0) return C_TYPE[ti % C_TYPE.length];
        const s = String(F.sources[k]?.type ?? '?');
        let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
        return C_TYPE[(TYPES.length + h) % C_TYPE.length];
      }
      // 按守军（队伍）上色：同一支队伍的十几个单位同色，不同队伍按出现顺序取色，不会像 squad%3 那样撞色
      const j = Math.max(0, squadIds.indexOf(F.sources[k]?.squad));
      return C_UNIT[j % C_UNIT.length];
    };
    const gadj = this.navigation?.graph?.adj || [];
    // 第 70 轮：散须长度的参照距离（取全场 dist 的 60% 分位，量级不随场景大小漂）
    const distRef = (() => {
      const ds = (F.dist || []).filter((d) => d > 0 && d < 1e4).sort((a, b) => a - b);
      if (!ds.length) return 6;
      return Math.max(2, ds[Math.floor(ds.length * 0.6)]);
    })();
    let wispCells = 0, wispTotal = 0, wispMax = 0;
    const nearT = [], farT = [];
    // 供测试/页面读：近源 / 远端散须的实际长度（格距）
    for (let id = 0; id < nodes.length; id++) {
      const p = F.parent[id];
      if (p < 0 || F.src[id] < 0) continue;
      const a = nodes[id], b = nodes[p], k = palette(F.src[id]);
      // 第 68 轮：rgb 不再乘 fade（fade 只压 alpha）。压暗层已经把地面拉到 p50≈75，线必须保持满亮才是霓虹对比。
      const fade = Math.max(0.78, 1 - F.dist[id] / 12);
      const ay = a.floor * L + 0.04, by = b.floor * L + 0.04;
      // 第 69 轮：跨台地的主干沿台阶面折两下 —— 原片放大看，线走到台地边缘后先贴着本层顶面平走一段、
      // 再顺着崖壁竖直落下、最后在下一层平走到父格心；不是一根斜穿崖壁的直线。
      if (a.floor !== b.floor) {
        const mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
        pos.push(a.x, ay, a.z, mx, ay, mz); col.push(k[0], k[1], k[2], fade, k[0], k[1], k[2], fade);
        pos.push(mx, ay, mz, mx, by, mz);   col.push(k[0], k[1], k[2], fade, k[0], k[1], k[2], fade);
        pos.push(mx, by, mz, b.x, by, b.z); col.push(k[0], k[1], k[2], fade, k[0], k[1], k[2], fade);
      } else {
        pos.push(a.x, ay, a.z, b.x, by, b.z);
        col.push(k[0], k[1], k[2], fade, k[0], k[1], k[2], fade);
      }
      // 第 66 轮：颜色改 4 分量（rgb + a）。原片的散须是「越往外越淡、末端消失」，
      // 单靠 rgb 变暗在深色地面上读不出来，只能走逐顶点 alpha（three 对 itemSize=4 的 color 自动开 USE_COLOR_ALPHA）。
      // 散须：朝「比本格更靠近源」的邻格拉一小段。第 69 轮：原片每格只有 2–4 根、且比主干短得多，
      // 本仓原来朝**所有**更近邻格都拉一根（六边格最多 5 根），远看是一片绒毛而不是几根须 → 只取最近的 2 个邻格。
      const near = [];
      for (const e of (gadj[id] || [])) {
        const nb = e.to;
        if (nb === p || nb === id || !(F.dist[nb] < F.dist[id])) continue;
        near.push(nb);
      }
      near.sort((u, v) => F.dist[u] - F.dist[v]);
      const wn = Math.min(2, near.length);
      wispCells++; wispTotal += wn; wispMax = Math.max(wispMax, wn);
      for (const nb of near.slice(0, 2)) {
        const c = nodes[nb];
        // 第 70 轮：散须长度随「离源头的距离」增长（原片 902069261304287232 frame-0090：源头那几格只探出一点头，
        //   越往外须越长、到远端才收成一条）。旧写法整片固定 0.45 格距。
        const t = 0.20 + 0.32 * Math.min(1, F.dist[id] / Math.max(1, distRef));
        if (F.dist[id] < distRef * 0.35) nearT.push(t); else if (F.dist[id] > distRef) farT.push(t);
        pos.push(a.x, ay, a.z, a.x + (c.x - a.x) * t, ay + ((c.floor ?? 0) - (a.floor ?? 0)) * L * t, a.z + (c.z - a.z) * t);
        const fa = fade * 0.55;
        col.push(k[0], k[1], k[2], fa, k[0], k[1], k[2], 0);   // 末端 alpha 归零 = 渐隐（rgb 保持满亮）
      }
    }
    this.flowLines.geometry.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.flowLines.geometry.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    // 供验收读：散须根/末端的 alpha 分布（wispTip 必须是 0）
    let zeroAlpha = 0, lit = 0;
    for (let i = 3; i < col.length; i += 4) { if (col[i] === 0) zeroAlpha++; else lit++; }
    this.flowAlphaStats = { verts: col.length / 4, zeroAlpha, lit };
    // 第 70 轮：近源 / 远端散须长度（格距）+ 兵种配色数（原片三色）
    const avg = (a) => (a.length ? +(a.reduce((s, v) => s + v, 0) / a.length).toFixed(3) : null);
    this.flowWispLen = { near: avg(nearT), far: avg(farT), nearN: nearT.length, farN: farT.length, distRef: +distRef.toFixed(2) };
    this.flowTypeColors = byType ? new Set(F.sources.map((s, k) => palette(k).join(','))).size : null;

    // ---- 格网 + 格面着色 ----
    // 902069261304287232：原片流线下面压着一层格网（四边格为主，混着三角格），流线贴着格边走；
    // 901842167508992000：格子本身带一层很淡的队伍色，铺满岛的就是这层"面"，不是只有线。
    const gpos = [], gcol = [], fpos = [], fcol = [], dpos = [];
    const seen = new Set();
    const seenSrc = new Map();   // cellId:floor → src，用来判断邻格是不是同一组
    for (let id = 0; id < nodes.length; id++) {
      const n = nodes[id];
      if (!n.cell || F.src[id] < 0) continue;
      const key = n.cell.id + ':' + n.floor;
      if (!seenSrc.has(key)) seenSrc.set(key, F.src[id]);
    }
    // 第 68 轮：地面被压暗层压到 luma≈75 后，原来的 [0.16,0.18,0.22] 暗线彻底看不见了；原片的格网是「比地面略亮一点」的细线。
    const GRID_COL = [0.30, 0.32, 0.36];
    let skippedWater = 0;
    for (let id = 0; id < nodes.length; id++) {
      const n = nodes[id], cell = n.cell;
      if (!cell || !cell.pts) continue;
      // 第 65 轮（原片 frame-0050 原尺寸）：格网只铺在**可走的地面**上，水面与岛外不铺。
      // nav 图里水面节点 floor 为 0，直接排除。
      if (!(n.floor > 0)) { skippedWater++; continue; }
      const key = cell.id + ':' + n.floor;
      if (seen.has(key)) continue;
      seen.add(key);
      const y = n.floor * L + 0.02;
      const src = F.src[id];
      for (let i = 0; i < cell.n; i++) {
        const a = cell.pts[i], b = cell.pts[(i + 1) % cell.n];
        gpos.push(a.x, y, a.z, b.x, y, b.z);
        gcol.push(...GRID_COL, ...GRID_COL);
      }
      // 区域轮廓：只在「邻格属于别的守军 / 邻格没人」的边上画，同组内部不画
      if (src < 0) continue;
      const k = palette(src);
      for (let i = 0; i < cell.n; i++) {
        const nid = cell.edgeNeighbors[i];
        let same = false;
        if (nid >= 0) {
          const nbKey = nid + ':' + n.floor;
          const nb = seenSrc.get(nbKey);
          same = nb !== undefined && nb === src;
        }
        if (same) continue;
        const a = cell.pts[i], b = cell.pts[(i + 1) % cell.n];
        fpos.push(a.x, y + 0.005, a.z, b.x, y + 0.005, b.z);
        fcol.push(...k, ...k);
      }
    }
    this.flowGrid.geometry.setAttribute('position', new THREE.Float32BufferAttribute(gpos, 3));
    this.flowGrid.geometry.setAttribute('color', new THREE.Float32BufferAttribute(gcol, 3));
    this.flowFaces.geometry.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
    this.flowFaces.geometry.setAttribute('color', new THREE.Float32BufferAttribute(fcol, 3));
    // 压暗层几何：铺在**整个岛体的地形顶面**上（不只是可走格 —— 原来按导航节点铺只有 395 格，
    // 崖脚 / 建筑脚下那些不可走格还亮着，视觉上岛没被压下去）。y 取该格顶面 +0.012，压在格网线下面。
    const wcells = this.view.town?.cells, W = this.view.town;
    if (wcells) for (const c of wcells) {
      if (!c.pts || c.n < 3) continue;
      const top = W.top?.(c) ?? 0;
      if (!(top > 0)) continue;
      if (W.river?.[c.id]) continue;
      const dy = top * L + 0.012;
      for (let i = 1; i < c.n - 1; i++) dpos.push(c.pts[0].x, dy, c.pts[0].z,
        c.pts[i].x, dy, c.pts[i].z, c.pts[i + 1].x, dy, c.pts[i + 1].z);
    }
    this.flowCellsDrawn = seen.size;
    this.flowOutlineEdges = fpos.length / 6;
    // 压暗层几何（可走格顶面扇形）；空数组时保持不可见
    this.flowDim.geometry.dispose();
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.Float32BufferAttribute(dpos, 3));
    this.flowDim.geometry = dg;
    this.flowDimStats = { cells: (wcells?.length ?? 0), tris: dpos.length / 9 };
    this.flowWispStats = { cells: wispCells, wisps: wispTotal, maxPerCell: wispMax };
    this.#flowLegend(F, byType, squadIds, TYPES, C_UNIT, C_TYPE);
    this.flowColorCount = { units: F.sources.length, squads: new Set(F.sources.map((s) => s.squad)).size, type: new Set(F.sources.map((s) => s.type)).size, byType, cells: seen.size, gridEdges: gpos.length / 6, outlineEdges: fpos.length / 6, skippedWater,
      wisps: this.flowWispStats, dim: this.flowDimStats };
  }

  /** 颜色图例（901842167508992000 右侧那块色卡）：按队伍或按兵种，带人数。 */
  #flowLegend(F, byType, squadIds, TYPES, C_UNIT, C_TYPE) {
    if (!this.flowLegend) {
      this.flowLegend = document.createElement('div');
      this.flowLegend.id = 'flow-legend';
      this.flowLegend.style.cssText = 'position:fixed;left:16px;bottom:104px;z-index:6;background:rgba(18,26,30,.82);color:#eaf1f3;border-radius:10px;padding:8px 10px;font:12px/1.5 -apple-system,system-ui,"PingFang SC",sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.3);pointer-events:none;min-width:120px';
      document.body.appendChild(this.flowLegend);
    }
    const css = (c) => `rgb(${c.map((v) => Math.round(Math.min(1, v) * 255)).join(',')})`;
    const rows = [];
    if (byType) {
      for (const t of TYPES) {
        const n = F.sources.filter((s) => s.type === t).length;
        if (n) rows.push([C_TYPE[TYPES.indexOf(t)], `${t} · ${n}`]);
      }
    } else {
      for (const sq of squadIds) {
        const n = F.sources.filter((s) => s.squad === sq).length;
        rows.push([C_UNIT[Math.max(0, squadIds.indexOf(sq)) % C_UNIT.length], `队伍 ${squadIds.indexOf(sq) + 1} · ${n} 人`]);
      }
    }
    this.flowLegend.innerHTML = `<div style="font-weight:600;margin-bottom:4px">流场配色 · ${byType ? '按兵种' : '按队伍'}</div>`
      + rows.map(([c, label]) => `<div style="display:flex;align-items:center;gap:6px"><span style="width:10px;height:10px;border-radius:2px;background:${css(c)};display:inline-block"></span><span>${label}</span></div>`).join('');
    this.flowLegend.style.display = 'block';
  }

  /* ------------------------------------------- 903647529203634176：伤害数字 */
  /** 一个文字纹理（按文本缓存，"N" 的取值只有几种）。奶油白 + 深色描边，像片子里那串小 "+4"。 */
  #damageTex(text, kind = 'damage') {
    const key = kind + '|' + text;
    let t = this.damageTexCache.get(key);
    if (t) return t;
    const style = styleFor(kind);
    const c = document.createElement('canvas');
    const dpr = 2, H = style.heightPx * dpr, W = Math.max(H * 2, 8 + text.length * H * 0.72);
    c.width = Math.ceil(W); c.height = Math.ceil(H * 1.7);
    const g = c.getContext('2d');
    g.font = `${style.weight} ${Math.round(H * 0.92)}px -apple-system,system-ui,"PingFang SC",sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = Math.max(2, H * 0.16); g.strokeStyle = style.stroke;
    g.strokeText(text, c.width / 2, c.height / 2);
    g.fillStyle = style.fill;
    g.fillText(text, c.width / 2, c.height / 2);
    t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.minFilter = THREE.LinearFilter; t.generateMipmaps = false;
    t.userData = { aspect: c.width / c.height };
    this.damageTexCache.set(key, t);
    return t;
  }

  /** 给「真的掉了血」的那一个单位生成一条飘字（不同单位各一条，不会并成一个大数）。 */
  #damagePopup(u, value, kind = 'damage') {
    const y = u.y + (this.view.visualOffset ? this.view.visualOffset(u.x, u.z) : 0) + 0.34 * (u.bodyScale ?? 1);
    const p = addDamageNumber(this.damageNumbers, { unitId: u.uid ?? -1, x: u.x, y, z: u.z, value, kind });
    this.damageStats.spawned += 1;
    this.damageStats.lastKind = kind;
    // 旧口径（第 45 轮测试读的是 lastValue）：lastValue/lastUnit 只记伤害数字，击杀单独计 kills
    if (kind === 'kill') this.damageStats.kills += 1;
    else { this.damageStats.lastValue = value; this.damageStats.lastUnit = u.uid ?? -1; }
    return p;
  }

  /** 每帧推进：位置上升、淡出、按相机距离缩放（屏幕上恒 ~15px 高，不随远近变）。 */
  #updateDamageNumbers(dt) {
    const snap = stepDamageNumbers(this.damageNumbers, dt);
    const cam = this.view.camera;
    let used = 0;
    for (let i = 0; i < snap.length; i++) {
      const p = snap[i];
      let sp = this.damageSprites[used];
      if (!sp) {
        sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
        sp.renderOrder = 32; sp.frustumCulled = false;
        this.group.add(sp); this.damageSprites.push(sp);
      }
      used++;
      const tex = this.#damageTex(p.text, p.kind);
      if (sp.material.map !== tex) { sp.material.map = tex; sp.material.needsUpdate = true; }
      const px = p.x + (p.sx || 0);
      const d = cam ? cam.position.distanceTo(sp.position.set(px, p.y, p.z)) : 10;
      const h = d * 0.021 * (1 + 0.12 * Math.max(0, p.merges - 1));   // 合并次数越多字号略大（片中连击会更大一点）
      sp.scale.set(h * tex.userData.aspect, h, 1);
      sp.position.set(px, p.y, p.z);
      sp.material.opacity = p.alpha;
      sp.visible = true;
    }
    for (let i = used; i < this.damageSprites.length; i++) this.damageSprites[i].visible = false;
    this.damageStats.live = snap.length;
    this.damageStats.merged = this.damageNumbers.filter((p) => p.merges > 1).length;
  }

  /**
   * 挨打：扣血、后退一点、喷几滴血（1022573208590057472 / 912691357440978945 "the look and feel of the basic meat and
   * potato melee combat"）；站在崖边的会被打下去（870296307889573889 "Units can now get knocked off ledges"）。
   */
  #hit(v, by, thrust = null) {
    if (by && !v.onBoat && !v.dead) {
      // [opt-in] knockoffWater：长矛沿矛轴「顶着走」0.12（knockoff-water.hitShove），其余同原值 0.05
      const shove = this.knockoff ? hitShove(v, by, thrust) : (() => { const dx = v.x - by.x, dz = v.z - by.z, d = Math.hypot(dx, dz) || 1; return { nx: dx / d, nz: dz / d, dist: 0.05, spear: false }; })();
      const nx = shove.nx, nz = shove.nz;
      v.x += nx * shove.dist; v.z += nz * shove.dist;
      for (let k = 0; k < 4; k++) this.drops.push({ x: v.x, y: v.y + 0.12, z: v.z, vx: nx * (0.5 + Math.random() * 0.7) + (Math.random() - 0.5) * 0.3, vy: 0.2 + Math.random() * 0.35, vz: nz * (0.5 + Math.random() * 0.7) + (Math.random() - 0.5) * 0.3 });
      // 崖边：往后一步就比脚下低 ≥ 2 层 → 被打下去
      const here = this.#cellAt(v.x, v.z), there = this.#cellAt(v.x + nx * 0.3, v.z + nz * 0.3);
      const w = this.world;
      if (here && (!there || this.navigation.supportBelow(v.x+nx*.3,v.z+nz*.3,v.y)/this.L <= (v.navFloor??Math.round(v.y/this.L))-2) && Math.random() < 0.6) {
        v.fall = { vx: nx * 1.2, vz: nz * 1.2, vy: 0.25, from: v.navFloor??w.top(here) };
      }
      // [opt-in] 落水（870296307889573889）：推到 / 推向水（top 0 或网格外）→ 上抛翻滚 → 入水即溺水
      if (this.knockoff && !v.fall && shouldFallIntoWater(this.view.index, w, v, shove)) {
        beginKnockoff(v, shove, v.navFloor ?? (here ? w.top(here) : 0), shove.spear ? 2.2 : 1.6);
        this.drownStats.knocked++;
      }
    }
    const hpBefore = v.hp;
    damageCombatUnit(v);
    // 只给真的掉了血的单位跳数字（打空 / 已死都不给）
    const dmg = damageValue(hpBefore, v.hp);
    if (dmg > 0) this.#damagePopup(v, dmg);
    v.thrust = v.spearRecovery = null;
    if (v.hp > 0) stunUnit(v);
    else v.stunRemaining = 0;
    this.#bleed(v.x, v.y, v.z, 0.04 + Math.random() * 0.03, v.onBoat);
    if (v.hp <= 0 && !v.dead) {
      v.dead = true;
      this.#creditKill(v, by);   // [opt-in] unitPromotion：击杀记账 → 等级 → 装备档位
      // 第 60 轮：击杀奖励 +10 与伤害数字共用同一套 Sprite 池（原先只有 squad-hud 页另画一套）
      this.#damagePopup(v, KILL_VALUE, 'kill');
      this.#bleed(v.x, v.y, v.z, 0.1 + Math.random() * 0.06, v.onBoat);
      v.corpseRot = Math.random() * 6;
      if (v.onBoat) {
        v.onBoat.mesh.updateMatrix();
        const pose = new THREE.Matrix4().compose(
          new THREE.Vector3(v.x, v.y + 0.05*(v.bodyScale??1), v.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI / 2, v.corpseRot, 0)),
          new THREE.Vector3().setScalar(v.bodyScale??1));
        v.corpseAnchor = capturePlatformAnchor(v.onBoat.mesh.matrix, pose);
      }
    }
    this.c02.onHit(v, by);
    this.c01.onHit(v, by);   // 第 88 轮：skyBeam 的「单位柱」（912 那根）也走同一处命中钩子，关着就是空操作
  }

  /**
   * [opt-in] unitPromotion（827215002448846848 残差）：by 记一次击杀 → u.kills/u.level，
   * 升档时换 appearanceTier（头盔/盾色阶，既有渲染链接管，不回血不重置状态）。
   * 本地最小机制，非原作复现（原作升级经济未公开）；误伤同队与已死的击杀者不记。
   */
  #creditKill(v, by) {
    if (!this.promotion || !by || by.dead || by.team === v.team) return;
    const r = creditUnitKill(by);
    this.promotionStats.credited++;
    if (r.promoted) { setUnitAppearanceTier(by, r.level); this.promotionStats.promoted++; this.promotionStats.last = { uid: by.uid, level: r.level }; }
  }
  #fallStep(u, dt) {
    const f = u.fall;
    const previousY = u.y;
    f.vy -= 6 * dt;
    // 贴壁而不是往崖外抛：横移那一格在自己这一层是实心的 → 卸掉水平速度，竖直继续掉
    const nx = u.x + f.vx * dt, nz = u.z + f.vz * dt;
    const nc = this.#cellAt(nx, nz);
    const lv = Math.max(1, Math.round(previousY / this.L));
    // 只有当那一格的地面高于自己（真的是崖壁挡在面前）才卸横速；站在这格表面上时不能误判成墙
    if (nc && previousY < this.world.top(nc) * this.L - 0.01 && this.world.isSolid(nc, lv)) { f.vx *= 0.25; f.vz *= 0.25; }
    else { u.x = nx; u.z = nz; }
    u.y += f.vy * dt;
    const c = this.#cellAt(u.x, u.z);
    const gy = c ? this.navigation.supportBelow(u.x, u.z, previousY) : -0.3;
    if (f.spin) f.age = (f.age || 0) + dt;   // [opt-in] knockoffWater 空中翻滚计时（表现）
    // [opt-in] 落到水面（网格外或 top 0 的海格）→ 溺水：不摔死、不留尸体、不流血（combatfx：y < waterY → DROWN）
    if (this.knockoff && u.y <= 0 && f.vy < 0 && (!c || this.world.top(c) <= 0)) { this.#drown(u); return; }
    if (u.y <= gy && f.vy < 0) {
      const floorNow = Math.round(gy / this.L);
      // 还被推在出发那一层的沿口上：贴地继续横移，等真的越过后沿再自由落体（片子是被打退两步才踩空）
      if (floorNow >= f.from && Math.hypot(f.vx, f.vz) > 0.15) { u.y = gy; f.vy = 0; return; }
      u.y = Math.max(gy, -0.05);
      const drop = f.from - (c ? gy / this.L : 0);
      u.navFloor = Math.round(gy / this.L);
      // 逐级滚落：脚下这一级只是中转，前方还有更低的台地 → 接着滚（片子是从崖顶经中间一级一路滚到沙地）
      const steps = (f.steps || 0) + 1;
      if (steps < 3 && !u.dead && this.#lowerAhead(u, f)) {
        // from 保持最初那一级：落地伤害按整段落差算（三级连摔照样摔死，不能每级都重新计一次）
        u.fall = { vx: f.vx * 0.8, vz: f.vz * 0.8, vy: -0.15, from: f.from, steps };
        u.y += 0.02;
        this.#bleed(u.x, u.y, u.z, 0.04 + Math.random() * 0.02);
        return;
      }
      u.fall = null;
      // 870296307889573889（G5）：落进海里 = 溺水沉下去（不再站在海面上卡住）；落地按落差硬直
      const landing = resolveFallLanding({ drop, water: !c || this.world.top(c) === 0 });
      if (landing.outcome === 'drown') { if (this.knockoff && !u.dead) this.#drown(u); else if (!u.dead) { u.dead = true; u.drowned = true; u.corpseRot = Math.random() * 6; u.y = -0.3; } }   // [opt-in] knockoffWater 时走带水花/下沉计时的溺水
      else if (landing.outcome === 'dead') { if (!u.dead) { u.dead = true; u.corpseRot = Math.random() * 6; this.#bleed(u.x, u.y, u.z, 0.12); } }
      else { if (landing.outcome === 'hurt' && !u.dead) this.#hit(u, null); if (!u.dead && landing.stun > 0) stunUnit(u, landing.stun); }
    }
  }

  /** [opt-in] 入水：溺水 + 两圈水花（knockoff-water.beginDrown：不留尸体、不流血）。 */
  #drown(u) {
    beginDrown(u);
    this.drownStats.drowned++; if (u.team === TEAM.VIK) this.drownStats.vik++; else this.drownStats.def++;
    for (let k = 0; k < 2; k++) {
      let s = this.splashes.find((q) => q.t >= q.dur);
      if (!s) {
        const mesh = new THREE.Mesh(this.splashGeo, new THREE.MeshBasicMaterial({ color: '#f4fbff', transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide }));
        mesh.rotation.x = -Math.PI / 2; mesh.renderOrder = 3; this.group.add(mesh);
        s = { mesh, t: 0, dur: 1 }; this.splashes.push(s);
      }
      const sc = u.bodyScale ?? 1;
      Object.assign(s, { t: -k * 0.22, dur: 0.9 + k * 0.3, r0: 0.03 * sc, r1: (0.16 + k * 0.08) * sc });
      s.mesh.position.set(u.x, 0.012, u.z); s.mesh.visible = false;
    }
  }

  /** 落点沿下落方向 ±60° 的邻格里，有没有比脚下低一级以上、还能站人的台地（有就接着滚下去） */
  #lowerAhead(u, f) {
    const c = this.#cellAt(u.x, u.z);
    if (!c) return false;
    const hereTop = this.world.top(c);
    const len = Math.hypot(f.vx, f.vz);
    const dx = len > 1e-3 ? f.vx / len : 0, dz = len > 1e-3 ? f.vz / len : 0;
    for (let i = 0; i < c.n; i++) {
      const nb = c.edgeNeighbors[i];
      if (nb < 0) continue;
      const b = this.world.cells[nb];
      if (this.world.top(b) > hereTop - 1) continue;
      if (!this.navigation.pick(b, this.world.top(b) * this.L)) continue;   // 站不住（水里/岩石/没有可站节点）就不算可滚落的下一级
      const ox = b.cx - u.x, oz = b.cz - u.z, ol = Math.hypot(ox, oz) || 1;
      if (len > 1e-3 && (ox / ol) * dx + (oz / ol) * dz < 0.5) continue;
      return true;
    }
    return false;
  }

  setProjectileImpactWeight(impactWeight) {
    if((this.projectileTable??defaultBallisticTable).impactWeight===impactWeight){this.projectileTable??=defaultBallisticTable;return;}
    const next=createBallisticTable({impactWeight});this.projectileTable=next;
  }
  /** 弓手 Validity 契约（987267068495003648）：射程环默认取现有 4.5 开火门槛，
   *  遮挡 = 沿弧线逐点核 world.isSolid（与飞行中 clearSegment 同一条点判据），落点 = 目标站在该格地表 ±容差内。
   *  默认不装（shotContract=null 保持旧行为）；装上后 #shoot 射前逐条候选拦。 */
  makeShotContract({ minRange = 0, maxRange = 4.5, landingTolerance = .3, samples = 40 } = {}) {
    const L = this.L;
    return createShotContract({ minRange, maxRange, landingTolerance, samples,
      blockedAt: (x, y, z) => { const c = this.#cellAt(x, z); return !!(c && y >= 0 && this.world.isSolid(c, Math.floor(y / L) + 1)); },
      groundAt: (x, z) => { const c = this.#cellAt(x, z); return c ? this.world.top(c) * L : null; } });
  }
  #shoot(u, foe) {
    const m = new THREE.Mesh(this.arrowGeo, this.arrowMat);
    this.group.add(m);
    const lead = 0.25;
    const to = [foe.x + (Math.random() - 0.5) * lead, foe.y + 0.08*(foe.bodyScale??1), foe.z + (Math.random() - 0.5) * lead];
    const from = [u.x, u.y + 0.15*(u.bodyScale??1), u.z];
    const dist = Math.hypot(to[0] - from[0], to[2] - from[2]);
    const contract = this.shotContract;
    const shot = pickBallisticShot(this.projectileTable??defaultBallisticTable, dist, to[1] - from[1],
      contract ? (s) => contract.validate(from, to, s, G).ok : null);
    if (!shot) { this.group.remove(m); return; }   // 查表没有解或契约全拒：够不着/不合法
    // 轨迹线：从出箭点到箭当前位置，随箭一起长；落定就收掉
    const tg = new THREE.BufferGeometry();
    tg.setAttribute('position', new THREE.Float32BufferAttribute([from[0], from[1], from[2], from[0], from[1], from[2]], 3));
    const trail = new THREE.Line(tg, this.arrowTrailMat);
    trail.frustumCulled = false; trail.renderOrder = 4; this.group.add(trail);
    this.arrows.push({ mesh: m, trail, from, to, t: 0, dur: shot.time, shot, target: foe, stuck: false, shooter: u });   // shooter：[opt-in] unitPromotion 箭杀记账
  }

  #draw() {
    const m = new THREE.Matrix4(), weapon = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3(), e = new THREE.Euler();
    const col = new THREE.Color();
    const vo = this.view.visualOffset ? (x, z) => this.view.visualOffset(x, z) : () => 0;   // [opt-in] 只画的高度修正（实景地面 − REA 层高），逻辑不变
    // 关掉血腥（999191760944418817）：血/血滴/尸体整层不画；体表浸血也是血——aSoak 与整体发红同样归零
    const gore = !this.view.goreOff;
    this.unitShadows.update(this.world,this.units,this.navigation,this.L);
    this.spriteBatch.update(this.units, this.view.camera, {gore});
    let n = 0, nSpear = 0, nStun = 0;
    for (const u of this.units) {
      if (n >= MAX) break;
      if (u.drown && u.drown.t > DROWN_SINK_SEC) continue;   // [opt-in] 沉下去了，不再画
      if (u.dead && this.view.goreOff && !u.drown) continue;
      if (u.drown) {
        // [opt-in] 溺水：竖着往下沉、慢慢歪倒，衣色压暗
        const k = Math.min(1, u.drown.t / DROWN_SINK_SEC);
        e.set(0.5 * k, u.face, u.drown.spin * k);
        col.copy(u.bodyColor ?? (u.team === TEAM.DEF ? COL.def : COL.vik)).multiplyScalar(1 - 0.45 * k);
      } else if (u.fall?.spin) {
        // [opt-in] 被打飞：空中翻滚（combatfx knockback spin）
        e.set(u.fall.spin * (u.fall.age || 0) * 0.6, u.face, u.fall.spin * (u.fall.age || 0));
        col.copy(u.bodyColor ?? (u.team === TEAM.DEF ? (u.squad?.archer ? COL.defArcher : COL.def) : COL.vik));
      } else if (u.dead) {
        // 尸体：躺倒；死在船上的跟着船
        e.set(Math.PI / 2, u.corpseRot, 0);
        col.copy(u.team === TEAM.DEF ? COL.def : COL.vik).lerp(COL.corpse, 0.45);
        // 946660607008403456（第 185 轮）：原片 0430 的 8× 裁切是「整片暗红舱底 + 上面压一片近白的尸体」，
        // 尸体若只按队伍色去饱和，在暗红底上根本读不出来（船上的白色是这条片子的识别点）。
        if (u.onBoat) col.lerp(COL.boatCorpse, 0.58);
      } else {
        e.set(0, u.face, 0);
        if (u.stunRemaining > 0) {
          e.z = Math.sin(this.t * 28) * 0.13;
          const bs = u.bodyScale ?? 1, hy = u.y + vo(u.x, u.z) + 0.21 * bs;
          for (let k = 0; k < 3 && nStun < MAX * 3; k++) { const a = this.t * 6 + k * 2.094; weapon.makeRotationY(a * 2).setPosition(u.x + Math.cos(a) * 0.05 * bs, hy + Math.sin(a * 2) * 0.006 * bs, u.z + Math.sin(a) * 0.05 * bs); weapon.scale(s.set(bs, bs, bs)); this.mStun.setMatrixAt(nStun++, weapon); }
          s.set(1, 1, 1);
        }
        col.copy(u.bodyColor ?? (u.team === TEAM.DEF ? (u.squad?.archer ? COL.defArcher : COL.def) : COL.vik));   // [opt-in] u.bodyColor：单位衣色覆盖（龙纛队黄金战衣 / 罗马红）
        // 血量改由皮肤空间的血斑表达（aSoak），整体只略微发红（goreOff 时连这层也不画）
        if (gore) col.lerp(new THREE.Color('#9e1f24'), u.soak * 0.15);
      }
      s.setScalar(this.spriteBatch.enabled && !u.dead ? 0 : u.bodyScale??1);
      q.setFromEuler(e);
      m.compose(p.set(u.x, u.drown ? -0.22 * (u.bodyScale ?? 1) * Math.min(1, u.drown.t / DROWN_SINK_SEC) : u.y + vo(u.x, u.z) + (u.dead ? 0.05*(u.bodyScale??1) : 0), u.z), q, s);   // [opt-in] 溺水下沉
      if (u.dead && u.onBoat && u.corpseAnchor) {
        m.copy(resolvePlatformAnchor(u.onBoat.mesh.matrix, u.corpseAnchor));
        p.setFromMatrixPosition(m); u.x = p.x; u.y = p.y - 0.05*(u.bodyScale??1); u.z = p.z;
      }
      this.mBody.setMatrixAt(n, m); this.mBody.setColorAt(n, col);
      this.aSoak.setX(n, gore ? (u.dead ? 0.9 : u.soak) : 0);
      const appearance = u.appearanceTier == null ? null : unitTierAppearance(u.appearanceTier);
      // 头有独立局部姿态（u.headYaw/u.headRoll，默认 0 → 与身体同矩阵）；[opt-in] headLag：僵直时头滞后身体。
      // 右乘局部旋转只转几何体，矩阵平移列不变——血斑（部件空间坐标）钉在头上跟头走。
      const hp_ = u.headYaw || u.headRoll || (this.headLag && u.stunRemaining > 0);
      if (hp_) {
        this._headRot.makeRotationZ((u.headRoll || 0) + (this.headLag && u.stunRemaining > 0 ? Math.sin(this.t * 28 - 0.9) * 0.10 : 0));
        if (u.headYaw) this._headRot.multiply(this._headRotY.makeRotationY(u.headYaw));
        this.mHead.setMatrixAt(n, this._headMat.copy(m).multiply(this._headRot));
      } else this.mHead.setMatrixAt(n, m);
      this.mHead.setColorAt(n, appearance ? col.set(appearance.helmet) : u.team === TEAM.DEF ? COL.shieldD : COL.cream);
      this.mShield.setMatrixAt(n, m); this.mShield.setColorAt(n, appearance ? col.set(appearance.shield) : u.team === TEAM.DEF ? COL.shieldD : COL.shieldV);
      if (u.squad?.pike && !u.dead && !this.spriteBatch.enabled) {
        const phase = u.thrust ?? u.spearRecovery, idle = .32;
        const length = u.thrust ? u.thrust.length*u.thrust.age/u.thrust.duration :
          u.spearRecovery ? idle+(phase.length-idle)*phase.remaining/phase.duration : idle;
        const braced = !phase && u.brace != null;
        const angle = phase ? Math.atan2(phase.dx, phase.dz) : braced ? u.brace : u.face;
        // 待机/收矛时矛杆斜举（903647529203634176 原片里矛尖朝上约 40°），只有刺出那一下压平到水平。
        // 绕序必须 YXZ：先按朝向偏航，再绕自身 X 抬矛，否则换个朝向就会朝侧面倒。
        const idlePitch = 40 * Math.PI / 180;
        const pitch = u.thrust || braced ? 0
          : u.spearRecovery ? idlePitch * (1 - u.spearRecovery.remaining / u.spearRecovery.duration)
            : idlePitch;
        const shaft = braced ? .38 : length;   // 架矛时略往前探
        // A tiny render-only minimum avoids a singular instance normal transform at age 0.
        weapon.compose(p.set(u.x, u.y + vo(u.x, u.z) + .1, u.z), q.setFromEuler(e.set(-pitch, angle, 0, 'YXZ')), s.set(1, 1, Math.max(1e-6, shaft)));
        this.mSpear.setMatrixAt(nSpear, weapon); this.mSpear.setColorAt(nSpear, COL.spearShaft);
        const dir = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
        weapon.compose(p.addScaledVector(dir, shaft), q, s.set(1, 1, 1));
        this.mSpearTip.setMatrixAt(nSpear, weapon); this.mSpearTip.setColorAt(nSpear, COL.spearTip); nSpear++;
      }
      n++;
    }
    this.mStun.count = nStun; this.mStun.instanceMatrix.needsUpdate = true;
    for (const mm of [this.mSpear, this.mSpearTip]) { mm.count = nSpear; mm.instanceMatrix.needsUpdate = true; if (mm.instanceColor) mm.instanceColor.needsUpdate = true; }
    this.aSoak.needsUpdate = true;
    // 关掉血腥：不画血、不留尸体（aSoak/体表发红已在上面归过零）
    this.blood.visible = gore;
    this.dropPoints.visible = gore;
    for (const mm of [this.mBody, this.mHead, this.mShield]) { mm.count = n; mm.instanceMatrix.needsUpdate = true; if (mm.instanceColor) mm.instanceColor.needsUpdate = true; }
    // 旗子跟着小队
    for (const sq of this.squads) {
      if (!sq.alive) continue;
      const [x, z] = this.#centroid(sq);
      sq.flag.position.set(x, this.#squadY(sq) + vo(x, z), z);   // [opt-in] 旗位同样吃 visualOffset
      this.#updateFlag(sq.flag, this._dt ?? 0);
    }
    if (this.selected) { const [x, z] = this.#centroid(this.selected); this.ring.visible = true; this.ring.position.set(x, this.#squadY(this.selected) + 0.03, z); }
    else this.ring.visible = false;
    this.#updateFootprint();
  }
}
