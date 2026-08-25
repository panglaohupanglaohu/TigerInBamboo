export function createPlanetFailureManifest({ runId, seed, stage, report, versions, artifacts = [] } = {}) {
  return {
    kind: "planet-v8-failure-manifest",
    runId: runId || `failed-${seed ?? "unknown"}`,
    seed: seed ?? null,
    stage: stage || "unknown",
    versions: versions || null,
    report: report || null,
    artifacts: artifacts.map((artifact) => ({ id: artifact.id, type: artifact.type, path: artifact.path || null })),
    createdAt: new Date().toISOString(),
  };
}

