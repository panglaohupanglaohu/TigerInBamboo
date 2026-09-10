import * as THREE from 'three';
import { RESCUE_CHAPTERS, restoreRescueState, advanceRescue } from './rescueState.js';
import { findSwampTiger } from '../world/moebiusTiger.js';
import { ensureAudio, sfxDeliver } from '../audio/sfx.js';
import { createEscortMotion } from './escortMotion.js';
import { resolveCollisions, resolveAssetColliders } from '../world/collision.js';

const SAVE_KEY = 'tm.rescue.campaign.v1';
export function createRescueCampaign({ scene, player, camera, messenger, worldLandmarks, fox, platforms = [], hills = null, colliders = [], isStarted, isRiding, toast }) {
  if (!messenger) return { update() {}, snapshot: () => null };
  let saved;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch { /* fresh game */ }
  const state = restoreRescueState(saved);
  const panel = document.createElement('section');
  panel.id = 'rescue-campaign';
  panel.innerHTML = `<button class="rescue-heading" aria-expanded="true">家书 · 救援主线 <span>−</span></button><div class="rescue-body"><div class="rescue-chapter"></div><p class="rescue-objective"></p><div class="rescue-nav"></div><button class="rescue-action"></button><p class="rescue-story" aria-live="polite"></p><div class="rescue-abilities"><button data-power="shield">1 · 阿喀琉斯的掩护</button><button data-power="lure">2 · 奥德休斯的佯动</button></div><small>WASD 行走 · F 搭乘 · R 主线交互<br>原送信委托仍使用 E；主线进度自动保存。</small></div>`;
  document.body.append(panel);
  const restart = document.createElement('button');
  restart.className = 'rescue-restart';
  restart.textContent = '重新开始家书主线';
  restart.title = '只重置救援章节，保留地图与设置';
  restart.addEventListener('click', () => {
    try { localStorage.removeItem(SAVE_KEY); } catch { return; }
    location.reload();
  });
  panel.querySelector('.rescue-body').append(restart);
  const $ = (s) => panel.querySelector(s);
  const objective = $('.rescue-objective'), navigation = $('.rescue-nav'), action = $('.rescue-action');
  const story = $('.rescue-story');
  const battleStatus = document.createElement('p');
  battleStatus.className = 'rescue-battle-status';
  battleStatus.setAttribute('role', 'status');
  objective.after(battleStatus);
  const battle = messenger.landmarks?.saihojiPhalanx;
  function syncBattle() {
    battle?.setCampaignProgress?.({ chapter: state.chapter, started: isStarted() });
  }
  function describeBattle() {
    battleStatus.hidden = state.chapter < 2 || state.chapter > 3;
    if (battleStatus.hidden) return;
    const status = battle?.root?.userData?.campaignStatus;
    const stage = battle?.root?.userData?.saihojiAmbush?.state?.stage;
    if (!status) { battleStatus.textContent = '盟军尚未就绪。'; return; }
    if (status.phase === 'atCastle') battleStatus.textContent = '盟约已成，蓝盔盟军正在准备出航。';
    else if (status.phase === 'sailOut') battleStatus.textContent = '蓝盔盟军正乘战船前往苔庭，随后在松林下隐蔽。';
    else if (stage === 'landing') battleStatus.textContent = '盟军已登陆，正在松林下隐蔽；舰队发现鲲后才会反击。';
    else if (stage === 'concealed') battleStatus.textContent = state.chapter === 2
      ? '盟军已在松林下埋伏。靠近苔庭信号点，按 R 送出诱敌信号。'
      : '诱敌信号已送出。盟军静候舰队发现鲲。';
    else if (status.phase === 'fight') battleStatus.textContent = '伏击已开始，蓝盔盟军正在反击。';
    else battleStatus.textContent = '盟军正继续执行作战计划。';
  }
  let cooldown = 0, protection = 0, uiElapsed = 1, tiger = null;
  const targetPos = new THREE.Vector3(), up = new THREE.Vector3(), forward = new THREE.Vector3(), side = new THREE.Vector3();
  const followPos = new THREE.Vector3();
  const followBasis = new THREE.Matrix4(), followRotation = new THREE.Quaternion(), parentRotation = new THREE.Quaternion();
  const actorOffsets = new Map();
  const walkers = new Map();
  const fleet = messenger.landmarks?.aircraftSquad;
  const marker = new THREE.Mesh(new THREE.OctahedronGeometry(0.32), new THREE.MeshBasicMaterial({ color: 0xe8b95b, depthWrite: false }));
  marker.name = 'rescue-objective'; scene.add(marker);
  function actorPosition(actor) { return actor?.getWorldPosition(targetPos) ?? null; }
  function resolveTarget() {
    const key = RESCUE_CHAPTERS[state.chapter]?.target;
    if (key === 'fox') return actorPosition(fox);
    if (key === 'tiger') {
      if (!tiger?.parent) tiger = findSwampTiger(scene);
      return actorPosition(tiger);
    }
    if (key === 'bookshop') return actorPosition(messenger.landmarks.bookshop);
    if (key === 'citadel') return actorPosition(messenger.landmarks.odysseyCitadel);
    const entry = worldLandmarks.find((lm) => lm.id === key)?.getDir?.();
    if (!entry) return null;
    targetPos.copy(entry);
    if (targetPos.length() < 2) targetPos.setLength(player.groundR || 160);
    return targetPos;
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch { toast('本机存储不可用；本次仍可继续游玩'); }
  }
  function refresh() {
    const ch = RESCUE_CHAPTERS[state.chapter];
    $('.rescue-chapter').textContent = ch?.title ?? '终 · 一家人，回家的路';
    objective.textContent = ch ? `前往${ch.place}` : '虎虎与红狐已与你重逢。你可以继续探索两个世界。';
    action.textContent = ch ? `[R] ${ch.action}` : '家书已送达';
    $('.rescue-abilities').hidden = state.chapter < 2;
    syncBattle();
    describeBattle();
    uiElapsed = 1;
  }
  function protect(seconds) {
    protection = Math.max(protection, seconds);
    if (fleet) fleet.userData.rescueSuppressed = true;
  }
  function power(kind) {
    if (!isStarted() || state.chapter < 2 || cooldown > 0) return;
    ensureAudio(); sfxDeliver();
    const seconds = kind === 'shield' ? 12 : 22;
    protect(seconds); cooldown = 35;
    toast(kind === 'shield' ? '阿喀琉斯掩护 · 机队吸食暂停 12 秒' : '奥德休斯佯动 · 机队吸食暂停 22 秒', 3);
  }
  function interact() {
    if (!isStarted()) return;
    const ch = RESCUE_CHAPTERS[state.chapter], pos = resolveTarget();
    if (!ch || !pos || !advanceRescue(state, { target: ch.target, distance: pos.distanceTo(player.position), riding: isRiding() })) return;
    player.checkpoint.copy(player.position);
    if (ch.id === 'diversion') protect(90);
    if (ch.id === 'tiger') protect(45);
    if (state.chapter === RESCUE_CHAPTERS.length) protect(30);
    story.textContent = ch.text;
    ensureAudio(); sfxDeliver(); save(); refresh();
    toast(ch.text, 10);
  }
  action.addEventListener('click', interact);
  for (const button of panel.querySelectorAll('[data-power]')) button.addEventListener('click', () => power(button.dataset.power));
  $('.rescue-heading').addEventListener('click', () => {
    const body = $('.rescue-body'); body.hidden = !body.hidden;
    $('.rescue-heading').setAttribute('aria-expanded', String(!body.hidden));
    $('.rescue-heading span').textContent = body.hidden ? '+' : '−';
  });
  window.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.target.closest?.('input,textarea,select,[contenteditable="true"]')) return;
    if (e.code === 'KeyR') interact();
    if (e.code === 'Digit1') power('shield');
    if (e.code === 'Digit2') power('lure');
  });
  function escort(actor, offset, dt) {
    if (!actor?.parent) return;
    let world = actorOffsets.get(actor);
    if (!world) { world = actor.getWorldPosition(new THREE.Vector3()); actorOffsets.set(actor, world); }
    up.copy(player.position).normalize();
    forward.copy(player.forward).addScaledVector(up, -player.forward.dot(up)).normalize();
    side.crossVectors(up, forward).normalize();
    if (isRiding()) {
      walkers.delete(actor);
      followPos.copy(player.position).addScaledVector(forward, -1.7).addScaledVector(side, offset).setLength(player.position.length() + 0.06);
      world.lerp(followPos, 1 - Math.exp(-dt * 5));
    } else {
      let walker = walkers.get(actor);
      if (!walker) {
        const body = { onGround: false, groundR: world.length(), checkpoint: world.clone() };
        const normal = new THREE.Vector3(), velocity = new THREE.Vector3();
        let radialSpeed = 0;
        walker = createEscortMotion({ position: world, lag: offset < 0 ? 1.8 : 3.4,
          // Footsteps share angular position even while the player is jumping.
          distanceBetween: (a, b) => a.angleTo(b) * a.length(),
          advance(pos, move, step) {
            normal.copy(pos).normalize();
            velocity.copy(move).addScaledVector(normal, -move.dot(normal));
            radialSpeed -= 22 * step;
            velocity.addScaledVector(normal, radialSpeed);
            resolveCollisions(pos, velocity, step, platforms, body, () => {}, hills);
            for (let pass = 0; pass < 3; pass++) resolveAssetColliders(pos, colliders, offset < 0 ? 0.45 : 0.65);
            radialSpeed = body.onGround ? 0 : velocity.dot(normal.copy(pos).normalize());
          },
        });
        walkers.set(actor, walker);
      }
      world.copy(walker.update(player.position, dt));
      up.copy(world).normalize();
      if (walker.direction.lengthSq() > 0.01) {
        forward.copy(walker.direction).addScaledVector(up, -walker.direction.dot(up));
        if (forward.lengthSq() > 1e-6) forward.normalize();
        else forward.copy(player.forward);
      }
    }
    actor.position.copy(actor.parent.worldToLocal(followPos.copy(world)));
    side.crossVectors(up, forward).normalize();
    followBasis.makeBasis(side, up, forward);
    followRotation.setFromRotationMatrix(followBasis);
    actor.parent.getWorldQuaternion(parentRotation);
    actor.quaternion.copy(parentRotation.invert().multiply(followRotation));
    actor.visible = true;
  }
  refresh();
  return {
    snapshot: () => ({ ...state, protection, cooldown, target: RESCUE_CHAPTERS[state.chapter]?.target ?? null }),
    getTargetPosition: () => resolveTarget()?.clone() ?? null,
    update(dt) {
      panel.hidden = !isStarted();
      syncBattle();
      if (!isStarted()) { marker.visible = false; return; }
      cooldown = Math.max(0, cooldown - dt); protection = Math.max(0, protection - dt);
      if (fleet) fleet.userData.rescueSuppressed = protection > 0;
      if (state.rescuedFox) escort(fox, -1.1, dt);
      if (state.rescuedTiger) { if (!tiger?.parent) tiger = findSwampTiger(scene); escort(tiger, 1.1, dt); }
      const pos = resolveTarget();
      marker.visible = !!pos;
      if (pos) { marker.position.copy(pos).addScaledVector(up.copy(pos).normalize(), 3.4); marker.rotation.y += dt; }
      uiElapsed += dt;
      if (uiElapsed < 0.15) return;
      uiElapsed = 0;
      describeBattle();
      const ch = RESCUE_CHAPTERS[state.chapter];
      const distance = pos ? pos.distanceTo(player.position) : Infinity;
      action.disabled = !ch || distance > 9 || (isRiding() && !['tiger', 'citadel'].includes(ch.target));
      if (pos) {
        up.copy(player.position).normalize(); camera.getWorldDirection(forward);
        forward.addScaledVector(up, -forward.dot(up)).normalize(); side.crossVectors(forward, up).normalize();
        followPos.copy(pos).sub(player.position);
        const angle = Math.atan2(followPos.dot(side), followPos.dot(forward));
        const direction = Math.abs(angle) < 0.4 ? '↑ 前方' : Math.abs(angle) > 2.5 ? '↓ 身后' : angle > 0 ? '→ 右侧' : '← 左侧';
        navigation.textContent = `${direction} · 直线 ${Math.round(distance)} m${protection > 0 ? ` · 掩护 ${Math.ceil(protection)} s` : ''}`;
      } else navigation.textContent = ch ? '目标未加载，请使用完整世界入口' : '家书主线完成 · 自由探索';
      for (const b of panel.querySelectorAll('[data-power]')) { b.disabled = cooldown > 0; b.title = cooldown ? `冷却 ${Math.ceil(cooldown)} 秒` : '暂停机队吸食，为救援争取时间；诱敌信号请靠近苔庭后按 R'; }
    },
  };
}
