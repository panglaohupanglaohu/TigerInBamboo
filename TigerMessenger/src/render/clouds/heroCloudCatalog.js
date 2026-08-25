// =====================================================================
// Landmark-authored hero clouds.  These are special-asset placements in the
// same class as the white-whale lake (PLAN 12.10.4): they are pinned to
// mountain geometry, never sampled from per-cell climate probability.
// Climate bands still supply the wet atmosphere underneath.
// =====================================================================

export const HERO_CLOUD_SPECS = Object.freeze({
  highlandCitadel: Object.freeze({
    landmarkId: "highland-citadel",
    // Mid-slope / snowline ring: the "cloud-sea frame" that also continues
    // the windward climate band.  Radius is relative to the massif cap.
    ringRadiusRatio: 0.62,
    ringHeightBand: Object.freeze([0.55, 0.70]),
    ringCardCount: 12,
    sizeJitter: Object.freeze([0.7, 1.3]),
    // Impostor plane world size.  capCard.scale is a multiplier on this unit
    // so the ridge cap reads as one oversized card, not a climate puff.
    cardWorldScale: 7.2,
    capCard: Object.freeze({
      heightRatio: 0.92,
      scale: 2.4,
      hugRidge: true,
      // 0 = main peak, 1 = secondary peak.  Offset so the cap covers about
      // half the ridge instead of swallowing the summit.
      ridgeMix: 0.28,
    }),
    forestScatter: Object.freeze({
      count: 1,
      radiusRatio: 0.78,
      heightBand: Object.freeze([0.22, 0.34]),
      scale: 1.15,
    }),
    driftSpeed: 0.15,
    dayPhaseWeight: Object.freeze({ dawn: 0.5, noon: 0.8, dusk: 1.0, night: 0.6 }),
  }),
});

export function heroCloudSpecForLandmark(landmark) {
  if (!landmark) return null;
  if (landmark.heroCloud && HERO_CLOUD_SPECS[landmark.heroCloud]) return HERO_CLOUD_SPECS[landmark.heroCloud];
  if (landmark.id === "highland-citadel") return HERO_CLOUD_SPECS.highlandCitadel;
  return null;
}
