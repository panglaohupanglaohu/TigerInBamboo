// Reservation planning only. This cannot move/hide an actor, mark them boarded,
// authorize sailing, or release the Kun's departure gate. Physical transfer is
// a separate operation, after measured shore/plank/deck support is available.
export function createWarshipEvacuationPlan({boats, actors, escortOf = actor => actor.userData?.garrisonRetreat?.escortedBy}) {
  const entries = new Map(), groups = [], diagnostics = [];
  const roster = new Map();
  for (const actor of actors) {
    const uid = actor?.userData?.uid;
    if (uid == null) throw Error('Evacuation actor requires a stable UID');
    if (roster.has(uid) && roster.get(uid) !== actor) throw Error('Conflicting evacuation actor UID');
    roster.set(uid, actor);
  }
  const consumed = new Set();
  const alive = actor => actor && !actor.userData.dead;
  // Protect pairs first: assigning healthy actors first can exhaust the last
  // adjacent two-person capacity and separate a patient from their escort.
  for (const patient of roster.values()) {
    if (!alive(patient) || !patient.userData.downed) continue;
    const escort = roster.get(escortOf(patient));
    if (!alive(escort) || escort.userData.downed || escort === patient || consumed.has(escort)) {
      groups.push({actors:[patient], blocked:'needs-escort'});
      consumed.add(patient); continue;
    }
    groups.push({actors:[patient, escort], patient, escort});
    consumed.add(patient); consumed.add(escort);
  }
  for (const actor of roster.values()) if (alive(actor) && !consumed.has(actor)) groups.push({actors:[actor]});
  for (const group of groups) {
    if (group.blocked) continue;
    for (const ship of boats) {
      const continuity = ship.crewContinuity;
      if (!continuity?.reservePassenger || !continuity?.releaseReservation) continue;
      const reserved = [];
      let failure = null;
      for (const actor of group.actors) {
        const result = continuity.reservePassenger(actor);
        if (!result?.ok) { failure = result?.reason || 'reservation-rejected'; break; }
        reserved.push({actor, ...result});
      }
      if (failure) {
        for (const r of reserved.reverse()) if (r.created) continuity.releaseReservation(r.uid);
        diagnostics.push({boat:ship.boat?.name, uids:group.actors.map(a=>a.userData.uid), reason:failure});
        continue;
      }
      group.ship = ship;
      for (const reservation of reserved) entries.set(reservation.uid, { ...reservation, ship, group });
      break;
    }
    if (!group.ship) group.blocked = 'awaiting-available-transport';
  }
  function snapshot() {
    return {
      allocated: [...entries.values()].map(e=>({uid:e.uid,seat:e.seat,boat:e.ship.boat?.name,patient:!!e.actor.userData.downed})),
      waiting: groups.filter(g=>g.blocked).map(g=>({uids:g.actors.map(a=>a.userData.uid),reason:g.blocked})),
      diagnostics,
      // An allocated seat is never proof of physical boarding.
      boardingComplete: false,
    };
  }
  function releaseUnboarded() {
    for (const group of groups) {
      const members = group.actors.map(actor=>entries.get(actor.userData.uid)).filter(Boolean);
      // Once either member is aboard, cancellation cannot abandon their partner.
      if (members.some(e=>e.ship.crewContinuity.getPassenger?.(e.uid)?.entry.embarked)) continue;
      for (const entry of members) if (entry.created && entry.ship.crewContinuity.releaseReservation(entry.uid)?.ok) entries.delete(entry.uid);
    }
  }
  return {entries,groups,snapshot,releaseUnboarded};
}
