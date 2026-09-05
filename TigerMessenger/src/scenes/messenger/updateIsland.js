// =====================================================================
//  信使主岛逐帧更新
// =====================================================================
import * as THREE from "three";
import { P } from "../../core/params.js";
import { updatePlatformPulse } from "../../world/platforms.js";
import { updateClouds } from "../../assets/lowPoly.js";
import { updateBubblePodPatrol } from "../../assets/bubblePod.js";
import { updateAircraftHover } from "../../assets/moebiusAircraft.js";
import { updateGatePodCraft, updateGatePodEscort } from "../../world/gatePodCraft.js";
import { updateGateHaulerCraft } from "../../world/gateHaulerCraft.js";
import { isCanyonBgmPlaying, isCanyonBgmFinishing } from "../../audio/sfx.js";
import { placeMoebiusAirshipAbove } from "../../assets/moebiusAirship.js";
import { tickTacticalGraph } from "./loadCitadel.js";
import { saihoujiHubDir } from "../../world/saihojiPhalanx.js";
import { tickSwampBgm } from "./swampBgm.js";
import { updatePlanetV8Runtime } from "../../world/planetV8/runtime.js";
import { projectObjectToPlanetSurface } from "../../world/planetV8/riderProjection.js";

const _asTmp = new THREE.Vector3();

export function updateMessengerIsland(s, dt, t, runtime) {
  updatePlatformPulse(s.platforms, t);
  updateClouds(s.clouds, dt, t, { speed: P.windSpeed, dirDeg: P.windDir });
  s.tramSystem.update(dt, runtime?.player?.position);

  s.canalBoats?.update?.(dt);
  s.waterRouteFleet?.update?.(dt);
  s.canalSys?.group?.userData?.update?.(dt, t);
  s.canalJunctionBox?.userData?.update?.(dt, t);
  s.canalJunctionCitadel?.update?.(dt, t);
  s.harborBuilt?.update?.(dt, t);
  // 弹唱老人（2026-08-29 修订）：不再随狐——老人在旧港灯杆/半沉战船旁站立（loadCitadel snap 落位）。


  s.canalLakeLink?.update?.(dt, t);
  updateBubblePodPatrol(s.bubblePods, t);
  s.citySeaLake.update?.(dt, t);
  s.citadelRange.pilgrimageCascades.update?.(dt, t);
  s.citadelRange.update?.(dt, t, { listener: runtime?.player?.position || null });
  s.citadelRange.moat?.update?.(dt, t);
  s.citadelRange.navonaPlaza?.update?.(dt, t);
  s.odysseyCitadel.update?.(dt, t);
  s.v4Runtime?.update?.(dt, t, P);
  updatePlanetV8Runtime(s.planetV8, t, [Math.cos(P.windDir * Math.PI / 180), Math.sin(P.windDir * Math.PI / 180)]);
  if (!s.scoutDefense) s.tripleGateScoutAircraft?.userData?.update?.(t, dt);
  s.scoutDefense?.update?.(dt, t);
  if (s.planetV8?.surfaceProjectionEnabled && runtime?.player) {
    projectObjectToPlanetSurface(s.planetV8.compiler?.surface, runtime.player, { allowWater: true });
  }

  // 湖沼生物袭击莫比斯机队（主人 2026-09-05）：把机队对象清单与受击回调
  // 挂进 runtime，湖沼侧（猴/蜥蜴/鸟）命中机队时回调触发全员开战。
  // ⚠️ gatePods/gateHaulers 是父 Group（成员在 .children），不是数组。
  if (s.vanguardAssault?.onFleetUnderAttack) {
    const asList = (x) => (Array.isArray(x) ? x : x ? [...x.children] : []);
    runtime.fleetObjects = [
      ...(s.aircraftSquad?.userData?.members || []),
      ...asList(s.gatePods),
      ...asList(s.gateHaulers),
    ];
    runtime.onFleetAttacked = (attacker) => {
      // 首次受击时 homeHub 可能还没建立，补传苔庭方向兜底
      s.vanguardAssault.onFleetUnderAttack(
        attacker,
        saihoujiHubDir(_asTmp)
      );
    };
  }

  s.scene.traverse((o) => {
    const kind = o.userData?.kind;
    if ((kind === "moebius-swamp" || kind === "moebius-airship") && o.userData.update) {
      o.userData.update(dt, t, runtime);
    }
  });

  let swampRoot = s.airshipAnchor.swamp;
  if (!swampRoot || !swampRoot.parent) {
    swampRoot = null;
    s.scene.traverse((o) => {
      if (!swampRoot && o.userData?.kind === "moebius-swamp") swampRoot = o;
    });
    s.airshipAnchor.swamp = swampRoot;
    s.airshipAnchor.locked = false;
  }

  updateAircraftHover(s.aircraftSquad, t, dt, { swamp: swampRoot });
  // 伴飞泡机必须在 updateAircraftHover **之后**跟位：机队这一帧的阵位已经算完，
  // 反过来会慢一帧，编队转弯时看得出拖影。
  // 先锋兵任务期间泡机由 vanguardAssault 接管（索降/编队/离场），跳过护航跟位。
  const podsOnMission = s.vanguardAssault?.controlsPods?.() ?? false;
  if (!podsOnMission) updateGatePodEscort(s.aircraftSquad, t);
  // 先锋重甲兵：乘 GatePodCraft / gateHaulerCraft 到场（主人 2026-09-05），
  // 不再吊挂在莫比斯机腹下飞行；未开局时全员隐身在载具里
  s.saihojiPhalanx?.update?.(dt, t);
  s.vanguardAssault?.update?.(dt, t);
  tickTacticalGraph(s.combatPack, dt);

  if (!s.airship.userData.flown && !s.airship.userData.flying) {
    const sw = swampRoot;
    if (sw) {
      _asTmp.copy(sw.position);
      if (!s.airshipAnchor.locked || s.airshipAnchor.lastPos.distanceToSquared(_asTmp) > 0.25) {
        s.airshipAnchor.lastPos.copy(_asTmp);
        placeMoebiusAirshipAbove(s.airship, _asTmp.normalize(), s.R, 20, s.airship.userData.yaw ?? 0.7);
        s.airshipAnchor.locked = true;
      }
    }
  }

  {
    const bgmHold = isCanyonBgmPlaying() || isCanyonBgmFinishing();
    const escortTram = s.tramSystem.getFarewellEscortTram?.({ bgmHold }) || null;
    s.moebius.update?.(dt, t, { escortTram });
  }

  if (s.gateBirdVortex) {
    const tram = s.tramSystem.getNearestTram?.(runtime?.player?.position) || s.tramSystem.tram || null;
    s.gateBirdVortex.update(dt, t, { tram, viewer: runtime?.player?.position || null });
  }
  if (s.gatePods) updateGatePodCraft(s.gatePods, t); // 叹息之门泡形飞行器悬停摆动
  if (s.gateHaulers) updateGateHaulerCraft(s.gateHaulers, t); // 重型运输艇（更重更慢）
  if (s.terraceBirds) {
    const tram = s.tramSystem.getNearestTram?.(runtime?.player?.position) || s.tramSystem.tram || null;
    s.terraceBirds.update(dt, t, {
      phase: P.timeOfDay,
      tram,
      viewer: runtime?.player?.position || null,
      infiltration: s.citadelRange?.nightInfiltration || null,
    });
  }
  if (s.flock?.root?.visible) s.flock.update(dt, t);
  s.hallFlock.update(dt, t);
  s.escort.update(dt, t);
  tickSwampBgm(s.swampBgm, s.scene, runtime?.player);

  const player = runtime?.player;
  if (player) player.wadeFactor = 1;
}
