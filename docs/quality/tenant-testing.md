# Live tenant verification procedure

Default: NOT TESTED. Mocked responses, static RLS checks, source harnesses, editor preview and a clean scanner NEVER prove isolation.

## Gate before testing

Record exact app/branch/source version and verified entity environment; obtain written approval for the environment, fixtures, all probes (including writes that might succeed), and cleanup. Require two independently authenticated ordinary app users A/B with distinct verified IDs and role user, no collaborator/admin/service role. Owners operate official sign-in; never request credentials in chat. Do not use impersonation/embed sign-in tokens. Prove session independence in separate browser profiles/devices and verify no editor privilege inheritance. An unassigned test can run before assigning A/B; a third user is optional and needs approval.

Test Data does not isolate identities. Base44 retains disabled test data, shares test data across branches, and uses live App Users. Explicitly verify dashboard, testing link, direct entity calls and server functions all select the approved test environment. Do not guess undocumented environment parameters. If test selection is unavailable, stop before records/probes. Never publish to make login work without separate approval.

## Fictional fixtures and manifest

At most two Businesses and four Enquiries per approved run, each with a unique run prefix. Store returned record IDs, app/environment, verified owner IDs, parent business IDs, timestamps, initial values and canonical before hashes. Use example.invalid emails and obvious fictional contact text; fixed non-binding DEMO price snapshot, original project note and separate internal note. accepting_enquiries=false. Inventory retained data first; never assume disposable. Administrative fixture creation is preparation, never ordinary-user enforcement evidence. No service role unless separately authorised; none is needed for this procedure's ordinary-user probes.

## Matrix (one evidence row per direction/operation)

| Check | Expected | Initial result |
|---|---|---|
| Anonymous protected route, server functions, direct entity reads | Login/401 or no protected records | NOT TESTED |
| A/B unassigned | Server refuses business access | NOT TESTED |
| Assigned A reads own Business/enquiries; B reads own | Exact authorised fixture set, ordinary role | NOT TESTED |
| A→B and B→A list/filter/get known ID | No foreign records or private fields | NOT TESTED |
| A→B and B→A update/delete | Denied; foreign before/after hash unchanged | NOT TESTED |
| Ordinary create/update/delete own records under restrictive policies | Denied according to current policy | NOT TESTED |
| Direct API bulk/update-by-filter, aggregation, cursor and realtime paths if available | No scope bypass or information leak | NOT TESTED |
| Forged owner/business IDs, extra fields, foreign record IDs | Rejected independently of UI | NOT TESTED |
| Ownership reassignment / user self-elevation | Denied | NOT TESTED |
| Invalid status/transition, 1001-character or wrong-type note | Rejected server-side | NOT TESTED |
| Valid status/note while save gate disabled | Explicit refusal; all records unchanged | NOT TESTED |
| Reload/new independent sessions | Same authorised fixture reads | NOT TESTED |
| Unrelated requests and denied writes | Project notes/prices/other records unchanged | NOT TESTED |
| Successful ordinary-user save persistence | Separate architecture/write approval first | BLOCKED |

For each request: record time, identity label/verified ID and role, environment proof, route/API, sanitized input, status/body without credentials, expected vs actual, before/after integrity of target and unrelated fixtures. Denied requests must not reveal foreign customer data. A 503 or empty list is not a positive own-read test. Stop on unexpected success or environment ambiguity; preserve evidence and request recovery authority. Do not continue destructive probes after a bypass.

## Cleanup and resume

Only delete exact manifest IDs after re-verifying app/environment and ownership; enquiries first, then businesses. No empty/broad filters, truncation, permanent deletion, schema cleanup or account removal. Each requires explicit cleanup authority. Export evidence before deletion; verify retained records unaffected. Source checkpoints do not back up database/browser-local data. If cleanup is blocked, retain manifest and report. Resume after approval by rechecking source version, configuration, sessions, record versions and checkpoint; never blindly repeat an uncertain write.
