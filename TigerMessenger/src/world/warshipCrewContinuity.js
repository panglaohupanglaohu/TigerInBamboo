// Identity/display ownership only. Physical boarding paths remain separately unvalidated.
export function bindWarshipCohort(boat, soldiers, cohort) {
  if (soldiers.length > 25) throw new Error('Warship combat cohort exceeds 25 seats');
  const api = boat.userData.warshipV6;
  const manifest = soldiers.map((actor, seat) => ({
    uid: actor.userData.uid, role: actor.userData.phalanxRole, seat,
    combatant: true, embarked: false, weaponStored: false, stage: 'ashore',
  }));
  manifest.push({uid: `${boat.name}:shipkeeper`, role: 'shipkeeper', seat: 25,
    combatant: false, embarked: true, weaponStored: false});
  boat.userData.crewManifest = manifest;
  for (const entry of manifest) api?.bindCrewIdentity?.(entry.seat, entry);
  for (let seat = soldiers.length; seat < 25; seat++) {
    api?.setCrewEmbarked?.(seat, false);
    api?.setCrewWeaponStored?.(seat, false);
  }
  api?.setCrewEmbarked?.(25, true);
  api?.setCrewWeaponStored?.(25, false);
  const equipment = soldiers.map(actor => Object.fromEntries(
    ['spear', 'gladius', 'shield', 'bow'].map(key => [key, actor.userData.equipment?.[key]])
      .filter(([,node]) => node).map(([key,node]) => [key,{node,visible:node.visible}])));
  const stages = new Set(['seated', 'deck-unarmed', 'deck-armed', 'ashore']);
  function refreshCohort() {
    cohort.visible = soldiers.some(s => s.visible);
    boat.visible = true;
  }
  // Stage changes own display/weapon identity, never world position or animation.
  // A motion controller must place the existing actor before releasing its seat.
  function setStage(seat, stage) {
    if (!stages.has(stage)) return false;
    const actor = soldiers[seat], entry = manifest[seat];
    if (!actor || !entry?.combatant) return false;
    if (actor.userData.dead || actor.userData.downed) return false;
    const onboard = stage === 'seated', stored = onboard || stage === 'deck-unarmed';
    entry.stage = actor.userData.shipTransferStage = stage;
    entry.embarked = actor.userData.embarked = onboard;
    entry.weaponStored = stored;
    actor.userData.shipSeat = seat;
    actor.userData.shipName = boat.name;
    actor.userData.weaponStorage = stored ? 'ship-center' : 'actor';
    actor.visible = !onboard;
    for (const [key,item] of Object.entries(equipment[seat])) item.node.visible = !stored && item.visible && !(key === 'shield' && actor.userData.shieldBroken);
    api?.setCrewEmbarked?.(seat, onboard);
    api?.setCrewWeaponStored?.(seat, stored, {shieldBroken: !!actor.userData.shieldBroken});
    refreshCohort();
    return true;
  }
  const setEmbarked = (embarked) => {
    for (let seat = 0; seat < soldiers.length; seat++) {
      const actor = soldiers[seat], entry = manifest[seat];
      const unable = actor.userData.dead || actor.userData.downed;
      // Casualties remain where combat left them; do not resurrect or assign a seat.
      if (unable) {
        entry.embarked = entry.weaponStored = false;
        actor.userData.embarked = false;
        api?.setCrewEmbarked?.(seat, false);
        api?.setCrewWeaponStored?.(seat, false);
        continue;
      }
      setStage(seat, embarked ? 'seated' : 'ashore');
    }
    // Keep wounded actors at their existing world position rather than deleting them.
    cohort.visible = !embarked || soldiers.some(s => s.userData.downed && !s.userData.dead);
    boat.visible = true;
    api?.render?.();
  };
  setEmbarked(true);
  return {manifest, setStage, embark: () => setEmbarked(true), disembark: () => setEmbarked(false)};
}
