// Identity/display ownership only. Physical routes are verified by the caller.
const bindings = new WeakMap();
const actorOwners = new WeakMap();
const sceneClaims = new WeakMap();
const detachedScope = {};
const CAPACITY = 25;
function claimsFor(boat) {
  let scope = boat;
  while (scope.parent) scope = scope.parent;
  if (scope === boat) scope = detachedScope;
  let claims = sceneClaims.get(scope);
  if (!claims) { claims = new Map(); sceneClaims.set(scope, claims); }
  return claims;
}
const equipmentOf = actor => Object.fromEntries(
  ['spear', 'gladius', 'shield', 'bow'].map(key => [key, actor.userData.equipment?.[key]])
    .filter(([,node]) => node).map(([key,node]) => [key,{node,visible:node.visible}]));
const failure = reason => ({ok:false, reason});

export function bindWarshipCohort(boat, soldiers, cohort) {
  if (bindings.has(boat)) return bindings.get(boat);
  if (soldiers.length > CAPACITY) throw new Error('Warship combat cohort exceeds 25 seats');
  const claims = claimsFor(boat), seen = new Set();
  for (const actor of soldiers) {
    const uid = actor.userData.uid;
    if (uid == null || seen.has(uid) || claims.has(uid) || actorOwners.has(actor)) {
      throw new Error('Warship passenger identity already reserved or missing');
    }
    seen.add(uid);
  }
  const api = boat.userData.warshipV6;
  // Sparse fixed-seat arrays: the keeper is always manifest[25], never [soldiers.length].
  const manifest = new Array(26), slots = new Array(CAPACITY), released = [];
  let disposed = false;
  function assign(actor, seat, original) {
    const entry = {uid:actor.userData.uid, role:actor.userData.phalanxRole, seat,
      combatant:true, embarked:false, weaponStored:false, stage:'ashore', reserved:true};
    const slot = {actor, entry, original, equipment:equipmentOf(actor)};
    slots[seat] = slot; manifest[seat] = entry;
    const owner = {boat, actor}; claims.set(entry.uid, owner); actorOwners.set(actor, owner);
    api?.bindCrewIdentity?.(seat, entry);
    return slot;
  }
  soldiers.forEach((actor, seat) => assign(actor, seat, true));
  manifest[25] = {uid:`${boat.name}:shipkeeper`, role:'shipkeeper', seat:25,
    combatant:false, embarked:true, weaponStored:false};
  boat.userData.crewManifest = manifest;
  api?.bindCrewIdentity?.(25, manifest[25]);
  for (let seat = soldiers.length; seat < CAPACITY; seat++) {
    api?.setCrewEmbarked?.(seat, false); api?.setCrewWeaponStored?.(seat, false);
  }
  api?.setCrewEmbarked?.(25, true); api?.setCrewWeaponStored?.(25, false);
  const stages = new Set(['seated', 'deck-unarmed', 'deck-armed', 'ashore']);
  function refreshCohort() {
    cohort.visible = slots.some(slot => slot?.actor.visible);
    boat.visible = true;
  }
  function display(slot, stage, assisted = false) {
    const {actor, entry, equipment} = slot, seat = entry.seat;
    const onboard = stage === 'seated', stored = onboard || stage === 'deck-unarmed';
    entry.stage = actor.userData.shipTransferStage = stage;
    entry.embarked = actor.userData.embarked = onboard;
    entry.weaponStored = stored;
    entry.assisted = assisted;
    actor.userData.shipSeat = seat; actor.userData.shipName = boat.name;
    actor.userData.weaponStorage = stored ? 'ship-center' : 'actor';
    actor.visible = assisted || !onboard;
    for (const [key,item] of Object.entries(equipment)) {
      item.node.visible = !stored && item.visible && !(key === 'shield' && actor.userData.shieldBroken);
    }
    // A wounded actor is the passenger visual; never replace it with a healthy rower.
    api?.setCrewEmbarked?.(seat, onboard && !assisted);
    api?.setCrewWeaponStored?.(seat, stored, {shieldBroken:!!actor.userData.shieldBroken});
    refreshCohort();
    return true;
  }
  // Compatibility for original passengers only. New reservations need physical proof.
  function setStage(seat, stage) {
    if (disposed) return false;
    const slot = slots[seat];
    if (!stages.has(stage) || !slot || slot.actor.userData.dead || slot.actor.userData.downed) return false;
    if (!slot.original && stage === 'seated' && !slot.entry.embarked) return false;
    return display(slot, stage);
  }
  function setEmbarked(embarked) {
    if (disposed) return false;
    for (const slot of slots) {
      if (!slot) continue;
      const {actor, entry} = slot, seat = entry.seat;
      // Never bulk-seat an extra passenger or undo assisted boarding on a legacy call.
      if (!slot.original || entry.assisted) continue;
      if (actor.userData.dead || actor.userData.downed) {
        entry.embarked = entry.weaponStored = false;
        actor.userData.embarked = false;
        api?.setCrewEmbarked?.(seat, false); api?.setCrewWeaponStored?.(seat, false);
        continue;
      }
      setStage(seat, embarked ? 'seated' : 'ashore');
    }
    refreshCohort(); api?.render?.();
  }
  function reservePassenger(actor) {
    if (disposed) return failure('disposed');
    const uid = actor?.userData?.uid;
    if (uid == null) return failure('missing-uid');
    if (actor.userData.dead) return failure('dead-passenger');
    const owned = actorOwners.get(actor), sameUid = claims.get(uid);
    if (owned?.boat === boat && sameUid?.actor === actor) {
      const slot = slots.find(s => s?.actor === actor);
      return {ok:true, uid, seat:slot.entry.seat, entry:slot.entry, created:false};
    }
    if (owned || sameUid) return failure('already-reserved');
    const seat = Array.from({length:CAPACITY}, (_,i) => i).find(i => !slots[i]);
    if (seat == null) return failure('capacity');
    const slot = assign(actor, seat, false);
    api?.setCrewEmbarked?.(seat, false); api?.setCrewWeaponStored?.(seat, false);
    return {ok:true, uid, seat, entry:slot.entry, created:true};
  }
  function releaseReservation(uid) {
    if (disposed) return failure('disposed');
    const seat = slots.findIndex(slot => slot?.entry.uid === uid);
    if (seat < 0) return failure('not-reserved');
    const slot = slots[seat], {actor, entry} = slot;
    if (slot.original || entry.embarked) return failure('passenger-still-owned');
    entry.reserved = false; entry.embarked = false; entry.weaponStored = false;
    entry.stage = 'released'; released.push(entry);
    if (actor.userData.shipName === boat.name) {
      actor.userData.embarked = false;
      delete actor.userData.shipSeat; delete actor.userData.shipName;
    }
    delete slots[seat]; delete manifest[seat];
    if (claims.get(uid)?.actor === actor) claims.delete(uid);
    if (actorOwners.get(actor)?.boat === boat) actorOwners.delete(actor);
    api?.setCrewEmbarked?.(seat, false); api?.setCrewWeaponStored?.(seat, false);
    api?.bindCrewIdentity?.(seat, {uid:null, role:'vacant', seat, combatant:false, embarked:false, reserved:false});
    return {ok:true, uid, seat};
  }
  // proof: {boat, uid, seat, routeValidated, gangplankCrossed, deckSupported,
  // seatSupported, seatWorldPosition, assisted?, escortUid?, escortActor?}.
  // Geometry validation belongs to the route controller; this checks its receipt
  // against the reserved identity and the actual actor position (within 0.2m).
  function commitBoarding(uid, proof) {
    if (disposed) return failure('disposed');
    const slot = slots.find(s => s?.entry.uid === uid);
    if (!slot) return failure('not-reserved');
    const {actor, entry} = slot;
    if (actor.userData.dead) return failure('dead-passenger');
    if (proof?.boat !== boat || proof.uid !== uid || proof.seat !== entry.seat ||
        proof.routeValidated !== true || proof.gangplankCrossed !== true ||
        proof.deckSupported !== true || proof.seatSupported !== true) return failure('invalid-boarding-proof');
    const target = proof.seatWorldPosition;
    if (![target?.x, target?.y, target?.z].every(Number.isFinite) || !actor.getWorldPosition || !actor.position?.clone) {
      return failure('missing-seat-position');
    }
    const position = actor.getWorldPosition(actor.position.clone());
    if (![position.x, position.y, position.z].every(Number.isFinite) || position.distanceTo(target) > .2) return failure('seat-not-reached');
    const assisted = !!actor.userData.downed;
    if (assisted) {
      const escort = slots.find(s => s?.entry.uid === proof.escortUid);
      if (proof.assisted !== true || !escort || proof.escortActor !== escort.actor || escort === slot || escort.actor.userData.dead || escort.actor.userData.downed) {
        return failure('missing-escort');
      }
      if (!boat.attach || !actor.isObject3D) return failure('unsupported-passenger-attachment');
      // The caller has already moved and posed the patient at verified support.
      // attach preserves its world pose while making the existing actor follow the ship.
      boat.attach(actor);
      actor.userData.shipEscortUid = proof.escortUid;
    }
    display(slot, 'seated', assisted); api?.render?.();
    return {ok:true, uid, seat:entry.seat, assisted};
  }
  function getPassenger(uid) {
    if (disposed) return null;
    const slot = slots.find(s => s?.entry.uid === uid);
    return slot ? {actor:slot.actor, entry:slot.entry, original:slot.original} : null;
  }
  // Call when permanently removing this mission. Does not delete/move actors,
  // dispose shared ship assets, or use reservation cancellation to disembark them.
  function dispose() {
    if (disposed) return;
    disposed = true;
    for (const slot of slots) {
      if (!slot) continue;
      if (claims.get(slot.entry.uid)?.actor === slot.actor) claims.delete(slot.entry.uid);
      if (actorOwners.get(slot.actor)?.boat === boat) actorOwners.delete(slot.actor);
    }
    bindings.delete(boat);
  }
  setEmbarked(true);
  const controller = {manifest, released, setStage, reservePassenger, releaseReservation, commitBoarding, getPassenger, dispose,
    embark:() => setEmbarked(true), disembark:() => setEmbarked(false)};
  bindings.set(boat, controller);
  return controller;
}
