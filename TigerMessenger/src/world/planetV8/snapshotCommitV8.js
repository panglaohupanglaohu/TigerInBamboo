// Frame-boundary commit queue for V8 dirty charts.  Validation happens before
// replacing the current snapshot; a failed patch cannot mutate collision/nav.

export function createPlanetSnapshotCommitQueue({ validate = () => ({ ok: true }) } = {}) {
  let current = null;
  let pending = null;
  let previewToken = 0;
  return {
    get current() { return current; },
    preview(next) {
      const result = validate(next);
      return { ...result, token: ++previewToken, snapshot: result.ok ? next : current, committed: false };
    },
    enqueue(next) {
      const result = validate(next);
      if (!result.ok) return { ok: false, result };
      pending = next;
      return { ok: true, queued: true };
    },
    flush() {
      if (!pending) return { ok: true, changed: false, snapshot: current };
      const result = validate(pending);
      if (!result.ok) { pending = null; return { ok: false, result, snapshot: current }; }
      current = pending; pending = null;
      return { ok: true, changed: true, snapshot: current };
    },
    commitAtFrameBoundary() { return this.flush(); },
    discard() { pending = null; },
  };
}

/**
 * Visual growth is intentionally detached from collision/nav.  The returned
 * sampler only exposes presentation progress; callers must use the queue's
 * frame-boundary commit for the authoritative snapshot.
 */
export function createGrowthAnimation({ duration = 0.22 } = {}) {
  const total = Math.max(0.001, duration);
  return {
    duration: total,
    sample(elapsed = 0) {
      const progress = Math.max(0, Math.min(1, elapsed / total));
      return { progress, presentationOnly: true, collisionNavCommitted: progress >= 1 };
    },
  };
}

/**
 * Move occupants out of a dirty region before the new surface is committed.
 * `nearestSurface` is deliberately injected so this helper cannot invent a
 * second height field.  Failure is explicit and leaves the actor unchanged.
 */
export function migrateDirtyOccupants(occupants = [], { isDirty = () => false, nearestSurface = () => null } = {}) {
  const migrated = []; const failures = [];
  for (const occupant of occupants) {
    if (!isDirty(occupant)) { migrated.push({ ...occupant, migrated: false }); continue; }
    const target = nearestSurface(occupant);
    if (!target?.surfaceId || !Array.isArray(target.position)) {
      failures.push({ id: occupant.id ?? null, reason: "no-legal-surface" });
      continue;
    }
    migrated.push({ ...occupant, position: target.position.slice(), surfaceId: target.surfaceId, migrated: true });
  }
  return { ok: failures.length === 0, migrated, failures };
}
