// =====================================================================
//  场景：西芳寺（苔寺）景观 —— 太古巨型浮岛白鲸脊背上的苔海六景
//  - 六座苔海石庭整座扎根、承托在巨鲸脊背的墨绿苔原地壳上
//  - 平时巨鲸藏在地下（鲸身全沉、只见苔庭落在地表）；
//    扫描灯艇（莫比斯航空艇编队）掠过苔庭上空时才升空，
//    尾鳍随升空扬起 35°，随灯艇远去再缓缓藏回地下
//  - 鲸体：非等比拉伸山岳躯干 + 背部横向切平 + 巨型 Y 字尾鳍
//    （assets/leviathanIsland.js）；入口苔径/主石/枯瀑/岛群/空庭/回望
//    全部随鲸呼吸起伏
//  构建逻辑在 world/saihoji.js + assets/leviathanIsland.js。
// =====================================================================
import * as THREE from "three";
import { PLANET_RADIUS } from "../world/planet.js";
import { buildSaihojiPlanet, SAIHOJI_HUB, SAIHOJI_ZONES, latLonToGardenDir } from "../world/saihoji.js";
import {
  buildEcoLeviathanIsland,
  LEVIATHAN_GARDEN_SCALE,
} from "../assets/leviathanIsland.js";
import {
  cueLeviathanStormOnce,
  setLeviathanStormBgm,
  rearmPhalanxAlarm,
} from "../audio/sfx.js";

/** 鲸体升空锚点：地壳板（背脊）悬停在球面 +24 上方，鲸腹不压苔丘 */
const WHALE_LIFT = 24;
/** 藏地锚点：鲸身整头沉入地下（背顶 = 锚点 +6 ≤ R−7），只见苔庭 */
const WHALE_BURIED_DEPTH = 13;
/** 藏地时苔庭岛留驻的地表高度（球面 +0.3） */
const PLATE_GROUND_LIFT = 0.3;
/** 扫描灯艇接近半径：进入则升空；退出须超出降藏半径（迟滞防抖）。
 *  按切向角距判定（不含飞行高度）：航线横向最近 54.5，68 留足余量——
 *  灯艇每趟掠过都会触发，不再被高度起伏卡在阈值上。 */
const RISE_RADIUS = 68;
const SINK_RADIUS = 78;
/** 风暴曲先响再升鲸，让「升起前触发一次」听得见曲头 */
const STORM_PRELUDE_SEC = 2.8;

/** @type {import("./sceneApi.js").SceneModule} */
export const saihojiGardenScene = {
  id: "saihoji",
  name: "西芳寺 · 苔寺",
  description: "西芳寺苔海六景：整座庭园扎根太古浮岛白鲸，随鲸呼吸遨游天空",

  load(ctx) {
    const scene = ctx.scene;
    const R = ctx.planetRadius ?? PLANET_RADIUS;
    const opt = ctx.options || {};

    const built = buildSaihojiPlanet(scene, {
      planet: ctx.planet ?? null,
      radius: R,
      seed: opt.seed ?? 884,
      // 默认略降密度，避免同屏过重；可用 options 拉高
      mossCount: opt.mossCount ?? 120,
      rockCount: opt.rockCount ?? 28,
    });

    // ---------- 太古浮岛白鲸：栖于苔庭中枢，平时藏地、扫描灯艇掠过时升空 ----------
    const hubDir = latLonToGardenDir(SAIHOJI_HUB.lat, SAIHOJI_HUB.lon, new THREE.Vector3());
    const hubEast = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), hubDir).normalize();
    const buriedR = R - WHALE_BURIED_DEPTH; // 鲸身全沉地下
    const risenR = R + WHALE_LIFT;
    const leviathan = buildEcoLeviathanIsland({
      basePos: hubDir.clone().multiplyScalar(buriedR),
      up: hubDir,
      forward: hubEast,
      minR: buriedR,
      maxR: risenR,
      plateWorldLift: R + PLATE_GROUND_LIFT,
      groundRadius: R,
    });
    const leviathanGroup = leviathan.group;
    const islandGroup = leviathan.island;
    scene.add(leviathanGroup);

    // 苔庭整组移上鲸背：把「球面苔庭」仿射变换进鲸体局部系——
    //   whaleLocal = Q⁻¹ · (p − hub·R) · S + (0, PLATE_Y, 0)
    // 六景组原点在 (0,0,0)（合并网格持有绝对坐标），按组整体套仿射；
    // 再按景区中心补回球面下陷 S·tan²/2R，使边缘石组/松树不陷进地壳板。
    const garden = built.group;
    scene.remove(garden);
    const invQ = leviathanGroup.quaternion.clone().invert();
    const S = LEVIATHAN_GARDEN_SCALE;
    const hubR = hubDir.clone().multiplyScalar(R);
    // 六景足迹质心（苔庭中枢偏在六景西缘）：按质心平移到地壳板中心，
    // 否则枯瀑/苔海岛群会悬在板外、西半板空置。
    const centroidEast = new THREE.Vector3()
      .crossVectors(new THREE.Vector3(0, 1, 0), hubDir)
      .normalize();
    const centroidNorth = new THREE.Vector3().crossVectors(hubDir, centroidEast).normalize();
    let centroidX = 0;
    let centroidZ = 0;
    for (const zone of SAIHOJI_ZONES) {
      const d = latLonToGardenDir(zone.lat, zone.lon, new THREE.Vector3());
      centroidX += d.dot(centroidEast) * R;
      centroidZ += d.dot(centroidNorth) * R;
    }
    centroidX /= SAIHOJI_ZONES.length;
    centroidZ /= SAIHOJI_ZONES.length;
    // 鲸体局部 Z = east×up = −north（右手基）：北向分量映射时取反，
    // 因此 Z 向质心平移取 +S·centroid（X 向 = east 取 −S·centroid）。
    const shiftX = -S * centroidX;
    const shiftZ = +S * centroidZ;
    const zoneByName = new Map((built.landmarks.zones
      ? Object.values(built.landmarks.zones).map((z) => [z.definition?.name, z.definition])
      : []).filter(([, d]) => !!d));
    const sagAt = (worldPos) => {
      const proj = worldPos.dot(hubDir);
      return Math.max(0, worldPos.lengthSq() - proj * proj) / (2 * R);
    };
    for (const child of garden.children.slice()) {
      const p0 = child.position.clone();
      const q0 = child.quaternion.clone();
      // 六景组：按景区中心算下陷；其余（参道步级）：按自身世界位算
      const zoneDef = zoneByName.get(child.name?.replace(/^Saihoji:/, ""));
      const sag = zoneDef
        ? sagAt(latLonToGardenDir(zoneDef.lat, zoneDef.lon, new THREE.Vector3()).multiplyScalar(R))
        : sagAt(p0);
      const off = p0
        .clone()
        .sub(hubR)
        .multiplyScalar(S)
        .applyQuaternion(invQ);
      off.x += shiftX;
      off.z += shiftZ;
      off.y += sag * S + 0.05; // 相对岛面原点（islandGroup 局部 y=0 即板面）
      child.position.copy(off);
      child.quaternion.copy(invQ).multiply(q0);
      child.scale.multiplyScalar(S);
    }
    // 残余下陷逐株补偿：景区中心 sag 只在中心精确；松树/石组各自
    // 按自身球面位置补 (sag(p) − sag(center))，沿鲸背法向抬高——
    // 远端古松不得陷进地壳板。
    for (const zone of Object.values(built.landmarks.zones)) {
      const center = latLonToGardenDir(
        zone.definition.lat,
        zone.definition.lon,
        new THREE.Vector3()
      ).multiplyScalar(R);
      const sagC = sagAt(center);
      for (const obj of [...(zone.pines || []), ...(zone.stones || [])]) {
        const delta = sagAt(obj.position) - sagC;
        if (Math.abs(delta) > 1e-4) obj.position.addScaledVector(hubDir, delta);
      }
    }
    islandGroup.add(garden);

    // ---------- 扫描吸食感：松树波动 + 树叶螺旋升空被吸进灯艇 ----------
    // 扫描灯艇掠近时（同升空触发圈），古松按强度左右摇摆；
    // 树叶从树冠脱离、沿螺旋弧线飞向编队中心（扫描激光吸食语汇，
    // 与湖沼蜂鸟吸蜜同源）。灯艇远去后残叶快速消散。
    const pines = [];
    for (const zone of Object.values(built.landmarks.zones)) {
      for (const pine of zone.pines || []) {
        pine.userData._swayBase = pine.quaternion.clone();
        pines.push(pine);
      }
    }
    const leafRnd = (() => {
      let s = 9901 >>> 0;
      return () => {
        s = (Math.imul(1664525, s) + 1013904223) >>> 0;
        return s / 0x100000000;
      };
    })();
    const LEAF_COUNT = 110;
    const leafGroup = new THREE.Group();
    leafGroup.name = "saihoji-scan-leaves";
    const leafGeo = new THREE.BufferGeometry();
    leafGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute([0, 0, 0, 0.22, 0, 0.08, -0.06, 0, 0.2], 3)
    );
    leafGeo.setIndex([0, 1, 2]);
    leafGeo.computeVertexNormals();
    // 亮色叶片：被高级文明吸走时高亮可见
    const leafMats = [0x4ade80, 0x7bed9f, 0x2f9e44, 0x8fe388, 0xd9f99a, 0x38d9a9].map(
      (c) =>
        new THREE.MeshBasicMaterial({
          color: c,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.95,
        })
    );
    const leafPool = [];
    for (let i = 0; i < LEAF_COUNT; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMats[i % leafMats.length]);
      leaf.visible = false;
      leaf.userData = {
        life: 0,
        dur: 2.2 + leafRnd() * 1.1,
        start: new THREE.Vector3(),
        phase: leafRnd() * Math.PI * 2,
        radius: 1.4 + leafRnd() * 2.2,
      };
      leafGroup.add(leaf);
      leafPool.push(leaf);
    }
    scene.add(leafGroup);

    // ---------- 扫描吸食光束：编队中心 → 苔庭盘面（鲸起/战斗全程可见） ----------
    // 光束本体（加色混合锥 + 亮核）随吸取力缩放：箭伤越重、光束越细越暗；
    // 地面光圈照亮盘面，像高级文明的「吸食探照灯」。
    const beamGroup = new THREE.Group();
    beamGroup.name = "saihoji-suction-beam";
    beamGroup.visible = false;
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x7fffe0,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beamCone = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 18, 1, true), beamMat);
    beamCone.name = "beam-cone";
    const beamCoreMat = new THREE.MeshBasicMaterial({
      color: 0xc8fff0,
      transparent: true,
      opacity: 0.32,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const beamCore = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.5, 1, 10, 1, true), beamCoreMat);
    beamCore.name = "beam-core";
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x8fffe4,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const groundRing = new THREE.Mesh(new THREE.RingGeometry(0.72, 1, 28), ringMat);
    groundRing.rotation.x = -Math.PI / 2;
    groundRing.name = "beam-ground-ring";
    beamGroup.add(beamCone, beamCore, groundRing);
    scene.add(beamGroup);
    const beamSpot = new THREE.SpotLight(0x9fffe8, 0, 280, 0.75, 0.6, 1.7);
    beamSpot.name = "saihoji-beam-spot";
    beamSpot.target = new THREE.Object3D();
    beamSpot.target.name = "saihoji-beam-spot-target";
    scene.add(beamSpot, beamSpot.target);

    // ---------- 藏地/升空状态机：扫描灯艇（莫比斯航空艇编队）掠过才升空 ----------
    let currentR = buriedR;
    let squad = null;
    const squadPos = new THREE.Vector3();
    const hubGround = hubDir.clone().multiplyScalar(R);
    const _toTarget = new THREE.Vector3();
    const _leafUp = new THREE.Vector3();
    const _leafSide = new THREE.Vector3();
    const _beamUp = new THREE.Vector3(0, 1, 0);
    const _beamDir = new THREE.Vector3();
    const _beamMid = new THREE.Vector3();
    const _plateTop = new THREE.Vector3();
    const _plateEdge = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
    const _hubNorth = new THREE.Vector3().crossVectors(hubDir, hubEast).normalize();
    let scanSmooth = 0;
    let leafTimer = 0;
    let leafCursor = 0;
    // ---------- 苔庭鲸故事线状态 ----------
    // 0 常规：扫描接近升空、远去藏回（周而复始）
    // 1 战斗：锁定升空——莫比斯 aircraft 俯冲吸食、悬停盘顶；
    //   长弓手攒箭逐箭削弱吸取力，士兵绳索小队拔河拉鲸；
    //   吸取力不足时绳索获胜 → 鲸落回地面
    // 2 收束：鲸回原位 → 机队离开 → 终扫一次 → 再离开 → 中箭计数清零
    //   （吸取力随缓动恢复）、故事复位回 0
    let storyPhase = 0;
    let finaleLeft = false;
    let finaleScanned = false;
    let returnSignaled = false;
    let stormArmed = false;
    let stormPreludeT = 0;
    // 拔河拉锯进度：绳索拉力 − 吸取力 → 负值鲸保持升空，正值缓缓下降；
    // 越过阈值（吸取力被箭削弱）后绳索获胜、鲸整段落回地面
    let tug01 = 0;
    let pulseCd = 15; // aircraft 反击脉冲（光束闪爆推倒士兵）的间隔计时
    let phalanxRoot = null;
    const leafSpawn = () => {
      const pine = pines[(leafRnd() * pines.length) | 0] || null;
      const leaf = leafPool[leafCursor];
      leafCursor = (leafCursor + 1) % leafPool.length;
      if (!leaf) return;
      if (pine) {
        pine.updateWorldMatrix(true, false);
        pine.getWorldPosition(_leafUp);
        const h =
          (Number.isFinite(pine.userData?.height) ? pine.userData.height : 8) *
          (pine.userData?.pineScale ?? 1) *
          LEVIATHAN_GARDEN_SCALE *
          0.6;
        _leafUp.addScaledVector(hubDir, h + leafRnd() * 1.2);
      } else {
        _leafUp.copy(hubGround).addScaledVector(hubDir, 3 + leafRnd() * 4);
      }
      leaf.userData.start.copy(_leafUp);
      leaf.userData.life = 0;
      leaf.userData.dur = 2.2 + leafRnd() * 1.1;
      leaf.userData.phase = leafRnd() * Math.PI * 2;
      leaf.userData.radius = 1.4 + leafRnd() * 2.2;
      leaf.position.copy(_leafUp);
      leaf.scale.setScalar(0.6 + leafRnd() * 0.7);
      leaf.visible = true;
    };
    const updateLeaves = (dt, strength, suction01) => {
      const pull = 0.06 + 0.94 * Math.max(0, Number.isFinite(suction01) ? suction01 : 1);
      for (const leaf of leafPool) {
        if (!leaf.visible) continue;
        const u = leaf.userData;
        // 灯艇远去 / 吸取力枯竭：残叶快速消散（被箭打落的叶片不再升起）
        u.life += dt * (strength > 0.02 && pull > 0.25 ? 1 : 3);
        const e = Math.min(1, u.life / u.dur);
        if (e >= 1) {
          leaf.visible = false;
          continue;
        }
        const ee = e * e * (3 - 2 * e);
        _toTarget.copy(squadPos).sub(u.start);
        // 吸取力越弱，叶片飞得越近——够不到灯艇就提前坠落（吸取力下降的可视化）
        const dist = _toTarget.length() * pull;
        if (dist > 1e-4) _toTarget.multiplyScalar(1 / dist);
        _leafUp.copy(u.start).normalize();
        _leafSide.crossVectors(_leafUp, _toTarget);
        if (_leafSide.lengthSq() < 1e-8) _leafSide.set(1, 0, 0).addScaledVector(_leafUp, -_leafUp.x);
        _leafSide.normalize();
        leaf.position
          .copy(u.start)
          .addScaledVector(_toTarget, dist * ee)
          .addScaledVector(_leafSide, Math.sin(ee * Math.PI * 2.6 + u.phase) * u.radius * (1 - ee))
          .addScaledVector(_leafUp, Math.sin(ee * Math.PI) * 5.5 * (0.4 + 0.6 * pull));
        leaf.rotation.y += dt * 8;
        const s = (1 - ee) * (0.9 + (u.phase % 1) * 0.4) + 0.05;
        leaf.scale.setScalar(s);
      }
    };
    const update = (dt, t) => {
      const step = Math.min(1, Number(dt) || 0.016);
      if (!squad) squad = scene.getObjectByName("moebius-aircraft-squad") || null;
      if (!phalanxRoot) phalanxRoot = scene.getObjectByName("saihoji-phalanx-battle") || null;
      let target = null;
      let scanDist = Infinity;
      let near = false;
      let far = false;
      if (squad) {
        // 编队组自身不动，成员逐帧摆到 formationCenter：
        // 读 _patrolCenter（updateAircraftHover 每帧刷新）为编队实时位置
        const center = squad.userData?._patrolCenter;
        if (center) squadPos.copy(center);
        else squad.getWorldPosition(squadPos);
        // 切向角距（不含飞行高度）：航线横向最近 54.5，而灯艇高度 ~24——
        // 三维距离 sqrt(54.5²+24.6²)≈59.6~60.2 恰卡在触发半径上，起伏相位
        // 一偏整趟掠过都不触发（用户反馈从未见鲸升起）。改用方向角距：
        // 灯艇从苔庭上空掠过即算「扫描过来」，与高度无关。
        scanDist = squadPos.clone().normalize().angleTo(hubDir) * R;
        near = scanDist < RISE_RADIUS;
        far = scanDist > SINK_RADIUS;
        if (storyPhase === 0) {
          // 常规：唯一前提——莫比斯飞艇飞过来吸食松树（切向掠近即触发）；
          // 远去藏回；升到顶后故事线接管
          if (near) {
            // 升起前先触发一次《狂风暴雨》；真正升空后切 Terminator 2
            if (!stormArmed) {
              cueLeviathanStormOnce();
              stormArmed = true;
              stormPreludeT = 0;
            }
            stormPreludeT += step;
            if (stormPreludeT >= STORM_PRELUDE_SEC) {
              setLeviathanStormBgm(true);
              target = risenR;
            } else {
              target = buriedR;
            }
          } else if (far) {
            target = buriedR;
            const lift01 =
              (currentR - buriedR) / Math.max(1e-3, risenR - buriedR);
            if (lift01 < 0.05) {
              setLeviathanStormBgm(false, { fade: 1.4 });
              stormArmed = false;
              stormPreludeT = 0;
            }
          }
          if (target === risenR && (currentR - buriedR) / Math.max(1e-3, risenR - buriedR) > 0.92) {
            storyPhase = 1; // 苔庭鲸升空：故事线以鲸为主
          }
        } else if (storyPhase === 1) {
          // 战斗期：锁顶不落，吸取力 vs 绳索拉力的拔河——
          // 长弓手逐箭削弱吸取力，绳索小队把鲸一点点拽回地面
          setLeviathanStormBgm(true);
          const suction01 = Number.isFinite(squad?.userData?.squadSuction01)
            ? squad.userData.squadSuction01
            : 1;
          const ropePull01 = THREE.MathUtils.clamp(
            phalanxRoot?.userData?.ropePull01 ?? 0,
            0,
            1
          );
          const range = risenR - buriedR;
          const lift01 = (currentR - buriedR) / Math.max(1e-3, range);
          // 净拉力：绳索拉（×0.9 拔河优势）− 吸取抬（×1.15 高等文明防线）。
          // 吸取力满时绳索拉不动（僵持期：长弓攒箭）；逐箭削弱后净拉力越过
          // 阈值 → 鲸缓缓下降；吸取枯竭 → 绳索获胜整段落回地面
          const net = ropePull01 * 0.9 - suction01 * 1.15;
          tug01 += (THREE.MathUtils.clamp(net, -0.5, 1.5) - tug01) * Math.min(1, step * 0.4);
          // 越过阈值后绳索获胜：鲸整段落回地面
          const down01 = THREE.MathUtils.clamp((tug01 - 0.25) / 0.45, 0, 1);
          target = risenR - range * down01;
          // 拉锯中的挣扎：被绳拽着仍有微幅起伏（鲸在对抗）
          if (down01 > 0.03) target += Math.sin(t * 2.1) * 0.7 * (1 - down01 * 0.5);
          if (down01 > 0.97 && lift01 < 0.06) {
            storyPhase = 2;
            finaleLeft = false;
            finaleScanned = false;
            returnSignaled = false;
            stormArmed = false;
            setLeviathanStormBgm(false, { fade: 1.6 });
          }
        } else {
          // 收束：鲸回原位 → 士兵撤阵返回高山圣城 → 机队离开 → 终扫一次
          // → 再离开 → 伤口痊愈、故事复位
          setLeviathanStormBgm(false, { fade: 1.4 });
          target = buriedR;
          const lift01 = (currentR - buriedR) / Math.max(1e-3, risenR - buriedR);
          if (!returnSignaled && lift01 < 0.03) {
            // 苔庭鲸恢复原位：士兵离开返回高山圣城（此后才重新受鼓声控制）
            returnSignaled = true;
            if (phalanxRoot?.userData?.whaleReturned) phalanxRoot.userData.whaleReturned();
            else phalanxRoot?.userData?.reset?.();
          }
          if (far) finaleLeft = true;
          if (finaleLeft && near) finaleScanned = true;
          if (finaleScanned && far) {
            const members = squad?.userData?.members;
            if (members) {
              for (const m of members) m.userData.arrowHits = 0; // 吸取力随缓动恢复
            }
            finaleLeft = false;
            finaleScanned = false;
            storyPhase = 0;
            stormArmed = false;
            stormPreludeT = 0;
            tug01 = 0;
            rearmPhalanxAlarm();
          }
        }
      } else {
        target = buriedR; // 无扫描灯艇的独立场景：永远藏地
        storyPhase = 0;
        finaleLeft = false;
        finaleScanned = false;
        stormArmed = false;
        stormPreludeT = 0;
        tug01 = 0;
        setLeviathanStormBgm(false, { fade: 0.8 });
      }

      // ---------- 对抗期对外契约：机队锁定悬停 / 盘沿锚点 / 反击脉冲 ----------
      const range = risenR - buriedR;
      const lift01 = (currentR - buriedR) / Math.max(1e-3, range);
      const plateTopR = currentR + islandGroup.position.y; // 盘面世界半径
      const suction01 = Number.isFinite(squad?.userData?.squadSuction01)
        ? squad.userData.squadSuction01
        : 1;
      if (squad) {
        const lock = squad.userData.whaleLock || (squad.userData.whaleLock = {});
        const wantLock =
          storyPhase === 1 || (storyPhase === 0 && near && lift01 > 0.03);
        if (wantLock && !lock.active) {
          // 新一轮锁定：重置过渡起点（从当前航线位平滑俯冲/爬升到盘顶）
          lock.active = true;
          lock.blend = 0;
          lock.blendStart = null;
          lock.az0 = Math.random() * Math.PI * 2;
        } else if (!wantLock && lock.active) {
          lock.active = false;
        }
        lock.hubDir = hubDir;
        lock.hoverRadius = plateTopR + 7;
        // 悬停位偏到北翼（鲸身侧缘之外）：长弓列阵与机队面对面，全程可见
        lock.offset = _hubNorth.clone().multiplyScalar(26);
        // 反击脉冲：战斗期 aircraft 每隔一阵闪爆光束、推倒光束落点附近的士兵
        if (storyPhase === 1) {
          pulseCd -= step;
          if (pulseCd <= 0) {
            pulseCd = 15 + Math.random() * 9;
            // 落点在北翼长弓列阵处（机队盘旋一侧）
            squad.userData.groundPulse = {
              t: 1.2,
              center: hubDir
                .clone()
                .multiplyScalar(R + 0.5)
                .addScaledVector(_hubNorth, 19.5),
              radius: 10,
            };
          }
        }
        const gp = squad.userData.groundPulse;
        if (gp) {
          gp.t -= step;
          if (gp.t <= 0) squad.userData.groundPulse = null;
        }
      }
      // 盘沿锚点（世界坐标）：绳索小队抛绳/挂绳的落点，随鲸升降每帧刷新
      if (phalanxRoot) {
        const pe = phalanxRoot.userData.plateEdges || (phalanxRoot.userData.plateEdges = []);
        _plateEdge[0].copy(hubDir).multiplyScalar(plateTopR).addScaledVector(hubEast, 12.5);
        _plateEdge[1].copy(hubDir).multiplyScalar(plateTopR).addScaledVector(hubEast, -12.5);
        _plateEdge[2].copy(hubDir).multiplyScalar(plateTopR).addScaledVector(_hubNorth, 7);
        _plateEdge[3].copy(hubDir).multiplyScalar(plateTopR).addScaledVector(_hubNorth, -7);
        for (let i = 0; i < 4; i++) {
          if (!pe[i]) pe[i] = new THREE.Vector3();
          pe[i].copy(_plateEdge[i]);
        }
      }

      if (target != null) {
        const k = 1 - Math.exp(-step * 0.22); // ~8s 的庄严升降
        currentR += (target - currentR) * k;
        if (Math.abs(target - currentR) < 0.02) currentR = target;
        leviathan.setAnchorRadius(currentR);
      }
      leviathan.update(dt, t);

      // ---- 扫描吸食感 ----
      let strength = Number.isFinite(scanDist)
        ? THREE.MathUtils.clamp(1 - scanDist / RISE_RADIUS, 0, 1)
        : 0;
      // 战斗期：机队锁定盘顶，吸食始终进行（不再依赖角距）
      if (storyPhase === 1) strength = Math.max(strength, 0.85);
      scanSmooth += (strength - scanSmooth) * Math.min(1, step * 2.2);
      if (scanSmooth > 0.008) {
        const tNow = Number(t) || 0;
        for (let i = 0; i < pines.length; i++) {
          const pine = pines[i];
          const base = pine.userData._swayBase;
          if (!base) continue;
          const a = Math.sin(tNow * 2.1 + i * 1.7) * 0.055 * scanSmooth;
          const b = Math.sin(tNow * 0.83 + i * 0.9) * 0.035 * scanSmooth;
          pine.quaternion.copy(base);
          pine.rotateX(a);
          pine.rotateZ(b);
        }
        // 岛面高于灯艇时不吸叶（鲸已升到灯艇上方，吸食方向会反向）；
        // 吸取力接近枯竭才停——从鲸升起到被拉回，吸食过程全程可见
        const islandTopR = currentR + islandGroup.position.y;
        if (islandTopR < squadPos.length() + 6 && suction01 > 0.04) {
          leafTimer -= step;
          while (leafTimer <= 0) {
            leafSpawn();
            leafTimer += 0.055 / Math.max(0.4, scanSmooth);
          }
        }
      } else if (scanSmooth > 0.001) {
        scanSmooth = 0;
      }
      updateLeaves(step, scanSmooth, suction01);

      // ---- 光束本体：编队中心 → 盘面；随吸取力缩放（箭伤越重越细越暗） ----
      const pulseFlash = squad?.userData?.groundPulse
        ? 1 + squad.userData.groundPulse.t * 1.6
        : 1;
      if (scanSmooth > 0.02 && suction01 > 0.02 && squadPos.lengthSq() > 0) {
        beamGroup.visible = true;
        _plateTop.copy(hubDir).multiplyScalar(plateTopR);
        _beamDir.copy(_plateTop).sub(squadPos);
        const beamLen = Math.max(0.1, _beamDir.length());
        _beamDir.normalize();
        _beamMid.copy(squadPos).addScaledVector(_beamDir, beamLen * 0.5);
        const beamR =
          (1.6 + 3.4 * scanSmooth) * (0.4 + 0.6 * suction01) * pulseFlash;
        beamCone.scale.set(beamR, beamLen, beamR);
        beamCone.quaternion.setFromUnitVectors(_beamUp, _beamDir);
        beamCone.position.copy(_beamMid);
        beamCone.material.opacity =
          (0.1 + 0.13 * scanSmooth) * (0.35 + 0.65 * suction01) * pulseFlash;
        beamCore.scale.set(1, beamLen, 1);
        beamCore.quaternion.copy(beamCone.quaternion);
        beamCore.position.copy(_beamMid);
        beamCore.material.opacity =
          (0.22 + 0.2 * scanSmooth) * (0.35 + 0.65 * suction01) * pulseFlash;
        groundRing.position.copy(_plateTop);
        groundRing.quaternion.setFromUnitVectors(_beamUp, hubDir);
        const gr = beamR * 1.15;
        groundRing.scale.set(gr, gr, 1);
        groundRing.material.opacity =
          0.28 * scanSmooth * (0.4 + 0.6 * suction01) * pulseFlash;
        beamSpot.position.copy(squadPos);
        beamSpot.target.position.copy(_plateTop);
        beamSpot.intensity = 6 * scanSmooth * (0.4 + 0.6 * suction01) * pulseFlash;
      } else {
        beamGroup.visible = false;
        beamSpot.intensity = 0;
      }
    };
    update(0, 0);

    return {
      id: "saihoji",
      group: leviathanGroup,
      // 苔庭已升空：地面碰撞剔除（浮岛不可步行，不参与地面寻路）
      colliders: [],
      landmarks: built.landmarks,
      debug: {
        mossCount: built.mossCount,
        placed: built.placed?.length ?? 0,
        onLeviathan: true,
        buriedR,
        risenR,
      },
      isWhaleRisen: () =>
        (currentR - buriedR) / Math.max(1e-3, risenR - buriedR) > 0.55,
      whaleLift01: () =>
        THREE.MathUtils.clamp(
          (currentR - buriedR) / Math.max(1e-3, risenR - buriedR),
          0,
          1
        ),
      getStoryPhase: () => storyPhase,
      update,
      dispose() {
        setLeviathanStormBgm(false, { fade: 0.4 });
        if (leafGroup.parent) leafGroup.parent.remove(leafGroup);
        leafGroup.traverse((o) => {
          if (o.geometry) o.geometry.dispose?.();
        });
        for (const m of leafMats) m.dispose?.();
        if (beamGroup.parent) beamGroup.parent.remove(beamGroup);
        for (const m of [beamMat, beamCoreMat, ringMat]) m.dispose?.();
        if (beamSpot.parent) beamSpot.parent.remove(beamSpot);
        if (beamSpot.target.parent) beamSpot.target.parent.remove(beamSpot.target);
        if (leviathanGroup.parent) leviathanGroup.parent.remove(leviathanGroup);
        leviathanGroup.traverse((o) => {
          if (o.geometry) o.geometry.dispose?.();
          if (o.material) {
            if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
            else o.material.dispose?.();
          }
        });
      },
    };
  },
};
