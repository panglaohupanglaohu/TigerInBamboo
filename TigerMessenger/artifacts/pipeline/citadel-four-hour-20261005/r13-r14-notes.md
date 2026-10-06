# Front platform apron study, 2026-10-05

r13 actual GPU: sample-clean, no application errors in sampled report. Independent advisor reviewed actual r13 against r12: lower front ledges improved locally, but rear shoulders lost greenery, an isolated pointed remnant emerged, and the right edge acquired fine steps. Rejected as an overall improvement; the optional switch remains off by default.

Cause: the bay-facing max(nx,nz) mask reached the side and back of platforms. Adjacent apron/core boundaries were hard-gated.

r14 limits changes to platform front edges, fades the sides, fades all reserved building cores, and blends toward the original shore before it reaches water. Rear samples x=-130..130 / z=-60..10 stay exactly unchanged. Flat building cores and closed finite geometry pass CPU tests. Bay grid x=-40..45 / z=0..80, 1m samples retains every previously wet point by row; this is a local discrete measurement, not an exact coastline area or global navigation proof.

Actual r14 GPU and bare-frame review must precede any acceptance. Architecture, railway, full routes and final >95 target acceptance remain unfinished.

Actual r14 GPU verified: sample-clean, glErrors=[], appErrors=[]. Both dressed and bare real-frame PNG/JSON saved. Bay grid wet count 6072 -> 6072; each sampled row no decrease. r14 remains an unaccepted candidate, not a city/rail release.
