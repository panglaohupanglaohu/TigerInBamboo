# Pinned local Source extension

Base: deepseek-ai/dsh-superagent-prototype commit6337fc823ce20251c8de8085948165c81aaa701e. `install_extension.py` checks base file SHA256 / already-applied patch, adds source and tests, and patches exports/build/docs. Build/typecheck/tests run in the isolated upstream tree using its frozen pnpm11.7 lock. Keep this source and patch under project review; do not modify an unrecorded cache-only fork.

Profile insertion (isolated DSH_HOME only):
```yaml
- insert:
    - id: dsh-superagent-local
      name: dsh-superagent/local-watch
      config:
        requestDir: /absolute/isolated/state/local-scene-requests
```

Authenticated loopback routes `/scene-source/status` and POST `/scene-source/requests` require the native same-origin header/auth cookie. `local_source_client.py` uses only this instance's own bootstrap log URL in memory, never outputs credentials. Intake stores a private immutable snapshot, rejects ID content conflict and ingests a native Engine Trigger. No arbitrary path or shell field accepted. Native Source setup/model/executor gating remains in force.

The intake extension alone did not bypass GitHub setup. The explicit local deployment extension below now supplies local-only semantics without fake GitHub identities. Model execution is still unverified and requires an authorized provider. Keep isolated executor paused until synthetic integration Triggers are safely excluded; don't let previous tests start model work after setup is changed. Integration fixture data is explicitly synthetic, not a game codec or user save.

## Explicit local deployment extension

The project patch now adds `localRoot` to the deployment schema. Set it to an existing isolated workspace under this instance's state directory. The local resolver records a real local root and leaves `github` absent; it does not construct a GitHub account or repository. Setup skips remote account probes, installs a failing `gh` shim and no GitHub credential helper, while retaining existing credential/environment isolation. Native GitHub-only commands explicitly reject local deployment. Existing GitHub fixtures remain explicitly typed as GitHub, preserving original behavior.

Native Source policy now declares allowed local identities (empty by default); bootstrap authentication does not imply arbitrary execution permission. Runtime setup readiness is distinct from execution and model verification. The Source endpoint always reports model execution unverified until a real model invocation flow is implemented. Current isolated catalog has zero routable providers; configure an authorized provider before any Worker smoke test, never copy old chat tokens. Executor remains paused to prevent synthetic intake tests from starting work.
