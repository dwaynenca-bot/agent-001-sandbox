# Application readiness checklist

PASS = verified evidence at the stated version/environment. FAIL = observed violation. NOT TESTED = no valid evidence. BLOCKED = missing external prerequisite/permission, with a named action/owner. No blank rows and no conversion of BLOCKED to PASS by elapsed time. A clean local run never approves release.

For each row record status, evidence, version/environment, date, owner and next action:

| Area | Required evidence | Default |
|---|---|---|
| Requirements | Observable acceptance criteria and non-goals | NOT TESTED |
| Repository/target | Origin, branch, commit, dirty files; explicit remote app/branch | NOT TESTED |
| Architecture | Framework/storage preserved; threat boundaries reviewed | NOT TESTED |
| Authentication | Real signed-out, ordinary-user and unassigned behaviour | NOT TESTED |
| Authorisation | Server identity verification; no browser ownership trust | NOT TESTED |
| Isolation | Approved two-user direct API and dashboard matrix | BLOCKED |
| Validation | Types, length limits, immutable ownership, transitions | NOT TESTED |
| Errors | Failed persistence cannot report success or leak data | NOT TESTED |
| Unit/regression | Actual commands/counts and raw logs | NOT TESTED |
| Desktop/mobile | Browser/version, 375px, overflow/touch/focus/keyboard/feedback/screenshots | NOT TESTED |
| Dependencies | Full + production audits, dependency tree, residual advisories/reachability | NOT TESTED |
| Platform scan | Fresh complete groups; no ignored finding hidden; static-analysis coverage | NOT TESTED |
| Environment | Explicit test routing; auth not assumed isolated; retained data inventory | NOT TESTED |
| Fixtures | Fictional manifest, bounded approved writes, record integrity | NOT TESTED |
| Recovery | Pre/post source checkpoints plus separate data recovery plan | NOT TESTED |
| Human acceptance | Actual device/login/tenant acceptance, pending register reviewed | NOT TESTED |
| Release | All blocking checks resolved and explicit publish/deploy approval | BLOCKED |
