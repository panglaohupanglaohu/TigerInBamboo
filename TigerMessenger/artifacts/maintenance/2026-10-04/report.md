# 2026-10-04 weekly archive maintenance

- Applied 7-day retention with tracked/targets/originals/active-batch protections. Added current citadel active batches to PINNED and protected target-named directories / approved images after dry-run exposed those omissions.
- Moved 1,135 files, 562,561,857 bytes (536.5 MiB), retaining original paths as symlinks.
- Validated all 1,701 manifest-backed project symlinks, archive SHA-256 and complete HTTP response SHA-256 through original localhost:8931 URLs: zero failures. Restore not needed.
- Physical allocated size (du -sk, links not followed): project 7,864,676 KiB (7.50 GiB), external archive 825,844 KiB (806.5 MiB).
- No archive entries older than 90 days by archived_at. No permanent deletion performed.
- All tracked historical outputs retained. Old tracked media/model total 2,434,229,742 bytes across reviewed artifact/optimized scope, including protected products; listing does not imply safe deletion.

Largest tracked old outputs (remain in project):

- 69.2 MiB: `assets/models/optimized/batch-candidates-v1/equatorialClouds.blend`
- 69.2 MiB: `assets/models/optimized/batch-candidates-v2/equatorialClouds.blend`
- 62.2 MiB: `artifacts/world-migration/import-repair/original-world-v1.before.glb`
- 50.1 MiB: `assets/models/optimized/batch-candidates-v1/saihoji.blend`
- 49.4 MiB: `assets/models/optimized/batch-candidates-v2/saihoji.blend`
- 20.5 MiB: `assets/models/optimized/citadel-mountain-forest/mountain-forest-layout-r02.blend`
- 20.5 MiB: `assets/models/optimized/citadel-mountain-forest/mountain-forest-layout-r03.blend`
- 20.3 MiB: `artifacts/pipeline/citadel-compact-ascent/before-common-frame.glb`
- 18.2 MiB: `assets/models/optimized/batch-candidates-v1/moebiusSwamp.blend`
- 18.1 MiB: `assets/models/optimized/batch-candidates-v2/moebiusSwamp.blend`

Offloading is not total disk-space reclamation. Removing archive objects breaks dependent links; any permanent cleanup requires a separate user decision and reference review.
