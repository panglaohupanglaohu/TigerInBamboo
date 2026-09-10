// Identity/display ownership only. Physical boarding paths remain separately unvalidated.
export function bindWarshipCohort(boat, soldiers, cohort) {
  if (soldiers.length > 25) throw new Error('Warship combat cohort exceeds 25 seats');
  const api = boat.userData.warshipV6;
  const manifest = soldiers.map((actor, seat) => ({
    uid: actor.userData.uid, role: actor.userData.phalanxRole, seat,
    combatant: true, embarked: false, weaponStored: false,
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
  const setEmbarked = (embarked) => {
    for (let seat = 0; seat < soldiers.length; seat++) {
      const actor = soldiers[seat], entry = manifest[seat];
      const unable = actor.userData.dead || actor.userData.downed;
      // Casualties never become healthy rowers simply because a phase changes.
      const onboard = !!embarked && !unable;
      entry.embarked = onboard;
      entry.weaponStored = onboard;
      actor.userData.shipSeat = seat;
      actor.userData.shipName = boat.name;
      actor.userData.embarked = onboard;
      actor.userData.weaponStorage = onboard ? 'ship-center' : 'actor';
      if (!unable) actor.visible = !onboard;
      api?.setCrewEmbarked?.(seat, onboard);
      api?.setCrewWeaponStored?.(seat, onboard);
    }
    // Keep wounded actors at their existing world position rather than deleting them.
    cohort.visible = !embarked || soldiers.some(s => s.userData.downed && !s.userData.dead);
    boat.visible = true;
    api?.render?.();
  };
  setEmbarked(true);
  return {manifest, embark: () => setEmbarked(true), disembark: () => setEmbarked(false)};
}
