# Agent 001 — supervised software delivery

Use this procedure with AGENTS.md, the permanent build-test-fix skill and the existing quality toolkit. It grants no additional permissions. Ordinary approved local edits and tests proceed without repeated confirmation; external GitHub actions need explicit owner authority for their scope. The agent never merges or deploys autonomously.

## 1. Accept the ticket and verify the base

Record the outcome, observable acceptance criteria, permitted files/dependencies, fictional test data, baseline commit, proposed head branch and intended PR base. Clarify missing authority or destructive/ambiguous scope before acting. Never invent a defect to justify work.

Inspect remote branch SHAs, compare/merge-base history, relevant source, AGENTS.md, skills, manifests, lockfiles and test scripts. Do not assume main is the correct base: main currently contains only a README. Verify source bytes against Git identities when working through the connector; preserve a manifest and baseline copy before editing. Do not use the old README-only local checkout as application source.

The Mission 017 pilot starts at `ebe8321d691fc978e4e7de63e4c1e74ca56b3f0b` on `feature/enquiry-desk-m016`. Proposed head: `ci/agent-001-delivery-m017`; PR base: `feature/enquiry-desk-m016`. A four-file infrastructure PR against that base avoids importing unrelated application history into main. PR #1 remains unchanged. Later integration/promotion and any protection-rule changes are separate owner decisions.

## 2. Implement and verify locally

Use an isolated directory and preserve all unrelated source. Review/install only approved locked dependencies; no silent npx downloads, forced dependency fixes or new services. Use fictional information. Add meaningful regression tests and run focused checks, then the appropriate complete suites. Review your diff for correctness, scope, security, compatibility and generated data. Fix causes rather than weakening tests; stop after three unsuccessful fix/retest iterations on the same issue or a permission blocker.

Review `--plan`, cwd, every package script including pre/post lifecycle scripts, source and lockfile before approving a toolkit digest. A plan or digest alone is not owner permission. Run with the exact digest and a new evidence directory. Copying a checkout or replacing a lockfile can invalidate the digest; do not reuse local digests on CI runners or weaken the toolkit to make them portable.

## 3. Present the external-write proposal

Give the owner the exact changed paths/status, tested SHA-256 manifest, source diff, actual test counts/exits, limitations, commit message, expected parent, intended head/base refs and recovery approach. Include expected CI effects. Ask for the specific checkpoint/branch and draft-PR operations required. A local pass or preview is not durable handover, CI success, human acceptance or release authority.

## 4. Approved checkpoint and draft PR

Before writing, recover the reviewed manifest; compare every proposed file. Stop on missing approval evidence, drift, unexpected branches or failed operations. Verify the expected base/head SHAs. With the approved connector route: upload only allowlisted bytes, verify blob identities, construct a tree from the approved base, verify all unrelated entries/modes, create the exact commit and parent, re-read the branch and advance with matching expected_sha and force:false. Rejected leases require inspection, not an automatic retry or force update. Independently read back the resulting source hashes.

Create a draft PR only when authorized, with explicit head and base and the reviewed body based on `.github/pull_request_template.md`. Verify the submitted PR's actual base/head SHA and changed-file inventory. The new template will not necessarily auto-populate GitHub's UI while it is absent from default-branch main: the connector should pass the body explicitly. Do not retarget/close PR #1, request reviewers or post comments without corresponding authority.

## 5. CI contract

The single required job name remains **verify**, supplied by GitHub Actions. It uses Node 24.19.0, the root lockfile, read-only contents permission, checkout without persisted credentials, and the existing Playwright dependency/browser. No application package or new service is introduced. Checks execute on the PR's merge result by default, not just its head tree.

Both applications and their reviewed configurations must exist. Missing/unsafe paths, redirected cwd, omitted/substituted checks and focused tests fail preflight. Both application steps use an explicit `!cancelled()` condition and depend only on successful preflight, so an earlier application failure does not suppress the other. Earlier failures remain job failures; there is no continue-on-error. Installation/browser failures, incomplete reports, skipped/cancelled tests, missing screenshots and insufficient suite counts also fail the completion gate.

Commands remain governed by the unchanged toolkit:

- Watchdog: unit, production build, browser, dependency tree, full audit and production audit.
- Enquiry Desk: backend/database/process tests and browser tests.

Approval of this exact CI policy authorizes execution of these fixed reviewed plans on an ephemeral CI runner. Each run prints the complete plan and passes a freshly computed runner-local digest explicitly with `--approve-plan`; the toolkit rechecks it before every command. This is not autonomous permission for unrelated commands or remote writes. Future changes to configs, scripts, dependencies and underlying tests/code require the ordinary ticket review before authorized pushes. Outside/fork contributions require separate owner review; this pilot fails preflight for cross-repository PR heads.

Pilot minimum suite counts are Watchdog 36 unit/6 browser and Enquiry Desk 35 backend/12 browser. Actual totals may grow. Skips, cancellations or suite reductions do not become green silently; an intentional reduction needs explicit review of the CI expectation. This is an accidental-omission safeguard, not proof against malicious test code. Passing tests do not constitute production security certification.

Other prototypes are not covered by this CI contract. Branches lacking Enquiry Desk are not suitable pilot targets: the workflow intentionally fails rather than silently dropping its checks. Installing this workflow on an integration/main branch must accompany a separately reviewed compatible baseline promotion. Workflow changes do not retroactively update other branches' older workflow definitions.

## 6. Validate the actual pilot trigger

The YAML includes `pull_request` base filters for main, `feature/agent-001-mission-002` and `feature/enquiry-desk-m016`, including opened/synchronize/reopened/ready_for_review/edited activities. Push filters retain the original Watchdog feature coverage and include feature/**, maintenance/**, ci/** and main. Concurrency cancels superseded runs per PR/ref; a push run does not stand in for the required pilot PR run. No path filter, pull_request_target, draft exclusion or GitHub-write step is used.

Official GitHub event documentation describes branch filters as **base** filters and pull_request as testing refs/pull/NUMBER/merge. Merge conflicts prevent pull_request runs. A workflow can be proposed in a PR; the prior repository PR #1 already demonstrates a pull_request run while main has no workflow. This supports the pilot design but does NOT prove that its new trigger will run.

After separate owner approval for the pilot writes, require a real GitHub-hosted run whose event is pull_request, linked PR/head matches the approved pilot commit, base is feature/enquiry-desk-m016 at its approved SHA, and checkout/merge revision is recorded. `revision.json` records head, base, checkout, run ID and attempt independently. Read the run/job/steps/logs and actual check name/conclusion. Check the allowlisted artifact and its verification.json. Never count local execution, a push-only run, an older green SHA or a missing/skipped/cancelled workflow as successful pilot validation.

If no matching run appears, mark the pilot BLOCKED. Inspect actual PR base/head, mergeability, activity, workflow presence, Actions policy/approval requirements and token identity. Connector-created PRs use the connected identity, not an Actions GITHUB_TOKEN; do not assume recursive-event behavior or permission from API availability. Current docs also describe approval requirements for some GITHUB_TOKEN-created PR runs. Do not bypass a trigger failure by silently dispatching/rerunning or changing main/settings. Manual-dispatch UI availability depends on the workflow being on the default branch; any documented API alternative still needs explicit approval and is not evidence of a pull_request trigger.

## 7. Inspect failures, retry and correct

Fetch the exact current run and attempt, verify its revision tuple, then inspect named steps, toolkit reports and redacted diagnostic logs. The commit-specific connector workflow-run helper filters to PR runs; use repository-run inspection when diagnosing missing push runs. Classify code/test failure, missing prerequisite, registry outage, permission or trigger failure separately. Missing/failed audit responses are BLOCKED, never a clean audit pass.

Local corrections within the approved ticket continue autonomously. Remote correction commits, replies and manual reruns require the approved write scope. Retry only a diagnosed transient failure on the same tested revision, with bounded attempts. A rerun normally reuses its original revision; if the PR head or relevant base moved, obtain approval for an appropriate branch refresh/new run rather than representing an old attempt as fresh coverage. Keep failed-run evidence and never delete tests/skip checks to obtain green.

Read review submissions, conversation comments and inline threads. Address each finding with a code change/test or reasoned explanation; cite the fix commit and fresh CI result. Replies and thread resolution are external writes. Do not resolve a disputed finding unilaterally. The connector currently acts as the PR author's account, so it cannot provide an independent approval of its own PR. Agent technical review is not human acceptance; a distinct GitHub reviewer is needed if an approving-review rule is introduced.

## 8. Evidence, acceptance and recovery

Artifacts are explicitly allowlisted: revision/preflight/gate metadata, reviewed plans, toolkit reports, selected redacted logs and fictional screenshots. Long token-like values are additionally masked in diagnostic copies. Never upload raw temporary directories, SQLite/WAL/SHM files, generated credentials/accounts/sessions, backups, storage states, HAR, traces, videos, environment dumps, node_modules or dist. Redaction cannot identify arbitrary secrets reliably; avoid printing them and review artifacts before sharing. Registry audits use the configured registry; no credentials are passed to application tests. Artifacts are retained seven days and are not durable business-data backups.

Current main rules require verify and a PR, but zero approving reviews and no thread-resolution/up-to-date enforcement. They apply only to main. The delivery process adds explicit owner authority; it does not claim these safeguards are technically enforced on every branch. Ruleset/Actions/account settings are owner-controlled and outside this four-file change.

Completion requires the expected source manifest/readback, correct PR diff, fresh successful verify run with both applications, no unresolved blocking findings and final human acceptance. No autonomous merge, deployment, publication or production-security claim. If a run is failed, absent, pending, cancelled or tied to stale code/base, report incomplete/blocked.

Preserve the verified baseline and focused diff. Before external handover, recovery is confined to the isolated workspace. After approved writes, propose a focused revert on the affected branch; never reset, clean shared work or force-update refs. No rollback changes production data or restores browser/database contents automatically.
