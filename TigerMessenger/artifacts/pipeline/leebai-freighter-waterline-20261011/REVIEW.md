# LeeBai spherical waterline CPU survey

Read-only batch; no production source changed.

Authority: production bookshopTownPose(160), actual buildBookshopFactoryBase town/dock/ship matrices, default grandFreighter=1, bookshopRaise=1, scale=5. Ocean uses runtime.js official branch compileOfficialOcean(radius=160): actual 72x48 triangle shell, SEA_LEVEL=0.5 / nominal radius=160.5, including officialOceanLevelAt canyon lowering. Both continuous authority and actual triangle shell radial ray distances are measured; no horizontal water-plane approximation.

Shader radial vertex wave is conservatively bounded +/-0.067 world units (sin*.045 + cos*.022). GPU rasterization and time waves were not measured.

| Ship-local z | Continuous waterline local y | Triangle-shell local y |
|---|---|---|
| -7 | -1.0675 | -1.0879 |
| -6 | -0.8778 | -0.9021 |
| -4 | -0.5643 | -0.5898 |
| -2 | -0.3766 | -0.3952 |
| 0 | -0.3138 | -0.3266 |
| 2 | -0.3766 | -0.3951 |
| 4 | -0.5643 | -0.5980 |
| 6 | -0.8741 | -0.9159 |
| 8 | -1.2756 | -1.3208 |
| 9 | -1.5037 | -1.5418 |
| 9.5 | -1.6269 | -1.6491 |

Fixed red antifouling transition is at local depth 46-52% (y=-1.564 to -1.768), while actual continuous side waterline is y=-0.314 amidships and y=-1.627 near prow z9.5. The 49% color midpoint lies 6.883 world units UNDER water amidships (actual triangle shell 6.796), 3.981 under at z6, and only .168 under near z9.5 (triangle shell .057). Thus the fixed local-y stripe does not represent the curved sea waterline. Recommendation: retain the same colors but color actual hull vertices by their world radial distance to the sea authority. Do not move ship root or alter global sea level.

Forwardmost bulb point (0,-2.05,10.2) is .978 world units below continuous sea and .862 below actual triangle shell: the tip is submerged. Its upper forward fairing at y=-1.6375,z9.6534 is .308 ABOVE triangle sea, while y=-1.775,z9.8891 is only .024 below, within the shader wave bound. The y=-1.5,z9.5 upper transition is .754 above triangle sea. If the forward bulb start must remain submerged, only revise upper bulb transition geometry after authorization; do not lower the entire ship or move the dock. Whether the exposed upper transition is acceptable requires GPU visual review.

Artifacts: waterline-cpu.json (matrices and complete samples), bookshopFreighterWaterline.inspect.mjs; test source tests/world/bookshopFreighterWaterline.inspect.mjs. No GPU acceptance. If page explicitly enables planetTerrainV1=1 or overrides oceanSeaLevel, rerun against that page compiled sea surface.
