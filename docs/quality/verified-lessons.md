# Verified mission lessons and evidence limits

These are persistent repository procedures, not model training. Mission reports and tool evidence supplied in this conversation were reviewed alongside repository instructions, local suites, source-harness tests and historical sanitized MCP snapshots. Historical checks must be rerun for a new version.

| Lesson | Basis | Reusable rule |
|---|---|---|
| Preserve unrelated work | Mission 001 repository lessons; Mission 002 recovery | Verify origin/branch/dirty state, retain backups, prefer isolated recovery; never reset/clean |
| Small changes + real checks | Local Watchdog/Hearth tests; Missions 005/009–010D | Focused edits, unit then regression/build; three failed fix iterations maximum |
| MCP resource writes are consequential | Official remote guidance and Missions 004–010D | Direct edits only within scope; pre/post named checkpoints; no AI builder fallback |
| Checkpoints only restore source | Missions 008/010 recovery review | Separate entity/localStorage backup and cleanup planning |
| Auth route code is not browser proof | Mission 009B owner sandbox report + source Chromium harness | Preserve all platform auth wrappers/middleware/returnTo; navigate parent TanStack app above iframe; test actual browser where available |
| Protected UI is not server authorisation | Inspected requireUser/business server functions, mocked tests | Server auth.me identity, server-selected assignment, strict inputs, tenant checks before data access; no service-role shortcut |
| Owner editor is privileged | Mission 010 collaborator inspection | Independent ordinary sessions required; never count owner/impersonation as isolation proof |
| Test Data is entity separation, not auth separation | Official current docs, Mission 010B configuration readback | Explicitly verify each request environment; retained data remains; branches share test dataset; identities remain app-wide |
| Clean headline can miss vulnerabilities | Mission 010C Base44 clean vs npm 11 vulnerable entries | Read every scan group; full + production npm audits and dependency tree separately |
| Transitive versions matter | Missions 010C/D trees and audits | Trace parents, imports, prebundle and framework requirements; remove only verified unnecessary packages; compatible targeted updates; no force/suppression |
| Mobile checks are executable | Mission 009B/010D Chromium desktop +375px | Overflow, labels, touch/focus, errors, persistence and customer regression; inspect screenshots |
| No fake live pass | Mission 010E remains PENDING | Mock/source/config evidence cannot certify live authentication/RLS enforcement |
| Blockers need concrete handover | Prior approval gates and proxy CONNECT403 | Record exact denial, prepared result, minimal owner action and resume checkpoint; never alternate transport to bypass |

Uncompleted: independent ordinary-user unpublished testing-link login, runtime test/live routing proof, live two-business access enforcement and successful authorised database saves. No clean build or audit completes those tests.
