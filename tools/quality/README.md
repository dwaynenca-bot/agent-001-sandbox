# Agent 001 quality toolkit

Uses Node built-ins and each application's existing npm/Playwright tooling. Only allowlisted npm quality commands can be supplied; no install/fix/deploy command is accepted. Configuration alone grants no execution authority: review the --plan output and underlying project scripts/code, then explicitly approve its digest. The digest binds config, resolved cwd, the full package manifest and the applicable npm lockfile, and is rechecked before each command. Arbitrary executables, shell strings, deployment scripts, extra options and unknown config fields are rejected before subprocesses. npm scripts and imported code can still have side effects: this is NOT a security sandbox. Only approve commands whose actual effects fit the mission; a script named test is not automatically safe. Application source, installed node_modules and dependencies outside the bound manifest/lockfile are not hashed; use an isolated, reviewed checkout with no concurrent writers. Never treat a digest as owner permission for an action outside the task scope.

From the repository root:

```sh
node --test tools/quality/tests/toolkit.test.mjs
node tools/quality/run.mjs --plan tools/quality/configs/hearth-local.json
# Review commands, cwd and ALL scripts including pre/post lifecycle scripts.
# Then use the displayed digest; approval is for this run only:
node tools/quality/run.mjs tools/quality/configs/hearth-local.json /tmp/quality-new-run --approve-plan REVIEWED_DIGEST
# Repeat --plan/review/--approve-plan for configs/watchdog.json or a new app.
node tools/quality/inspect.mjs /tmp/sanitized-base44-snapshot.json
```

`run.mjs` executes argv arrays without a shell, in config-relative `cwd`, in sequence. It saves stdout/stderr, command exit codes, timestamp, Git commit/branch/dirty status, JSON and Markdown reports. Each child has a 120-second default timeout. Override `timeoutMs` per check for an authorised longer suite. Failed checks do not suppress independent checks. Missing requested npm scripts are NOT TESTED, even if other checks pass. Exit 0 means all executed command checks passed; exit 1 means failure/blockage/incomplete checks; exit 2 means invalid invocation/configuration. It NEVER means release approved. Inspect test logs for actual test counts. Audits contact the configured npm registry and disclose dependency metadata; only run where permitted. Missing dependencies/network/browser are prerequisites, not permission to install or bypass restrictions.

Use a new empty output directory per run to preserve evidence. Logs may contain sensitive application output: keep artifacts outside Git, inspect/redact before sharing. Do not put credentials in commands, configurations or snapshots. Preview URLs can contain credentials. Evidence files, console messages and returned reports redact known secret environment values and credential patterns (Bearer/JWT/provider tokens, labelled keys/passwords, credential URL parameters/basic auth, private keys). Arbitrary unlabelled secrets cannot be identified reliably; do not supply them and independently review artifacts before sharing. No unredacted log copy is intentionally saved. Redaction is not a substitute for avoiding secret output.

## Dependency lockfile approval

Exactly one regular npm lockfile must exist alongside the target cwd's package.json: `package-lock.json` OR `npm-shrinkwrap.json`. Both formats are supported. Although npm normally gives shrinkwrap precedence, this toolkit rejects two coexisting files rather than silently selecting one. It does not search parent directories for workspace locks: point the config at the explicitly reviewed npm project root that contains both manifest and lockfile.

The digest includes the selected filename, complete raw file bytes (including whitespace), and filesystem device/inode identity. The CLI plan shows its name and SHA-256 without printing contents. Content edits, atomic replacement (even with identical bytes), removal, renaming/switching format, or introduction of a competing lockfile invalidate approval. A new checkout/copy may therefore need fresh approval even with identical content. Ordinary unchanged files preserve approval. An in-place rewrite of exactly identical bytes is the same bound state. Filesystem identity is an additional local safeguard, not a portable signature.

Missing/unreadable/invalid lockfiles, symlinks or ambiguous lockfiles block planning/execution. Projects without an npm lockfile cannot receive an execution approval; obtain separate authorisation to create/recover the correct lockfile, review it, then generate a new plan. No installation or lockfile generation is automatic. JSON must declare an integer lockfileVersion; this is not full npm-schema or manifest/install consistency validation.

Before every command the runner recomputes the whole plan. A changed/missing lockfile stops the run before further commands; completed-command evidence remains, but there is no overall PASS. Re-review and regenerate approval only after resolving the change. Old pre-hardening digests no longer work. Use a new output directory when resuming.

This remains a pre-command integrity check, not a sandbox, continuous filesystem monitor or transaction. It cannot prevent changes after a check while a command is running, changes reverted before the next check, or malicious code in a reviewed npm script. Installed dependency contents, npm configuration and source are not authenticated by the lockfile digest. Avoid concurrent writers and use the approved isolated environment.

## Adapting to another app

Review `configs/fictional-app.json`; point `cwd` at the authorised checkout and map its existing scripts. Add desktop/mobile checks as argv arrays, e.g. `["npm","run","test:browser","--","--project=desktop"]` and the equivalent `--project=mobile` ONLY if those projects exist. Use 375px in the app's existing Playwright configuration. Do not assume any script or framework exists. A missing lint script stays NOT TESTED until deliberately configured; do not invent a pass. The Hearth example runs both existing desktop/mobile projects in one invocation. Watchdog's existing suite includes a mobile-layout scenario; wider real-device acceptance remains NOT TESTED.

Checks use `level: local-source`, `mocked` or `tooling`; `kind: audit` parses npm JSON. Findings always FAIL, even if a command incorrectly exits zero. Malformed/failed audits BLOCK rather than pass. No forced fixes. Live-tenant kinds are rejected: use the separately approved manual matrix in `docs/quality/tenant-testing.md`.

## Base44 snapshots

`inspect.mjs` accepts sanitized owner-reviewed MCP read results, not credentials. Shape:

```json
{"expectedAppId":"explicit-target-id","branch":"main","app":{"id":"explicit-target-id","public_settings":"public_without_login","auth_config":{}},"expectedEntities":["Business","Enquiry"],"schemas":[],"scan":{}}
```

Populate `app` from Get app, `schemas` from List entity schemas and `scan` from Get security scan. Read current API contracts first. Snapshot checks only establish identity match, configuration presence, explicit four-operation RLS coverage and current scan findings. They do not validate rule semantics, independently prove freshness, or enforce permissions. Review ownership rules, server middleware and protected-route tests separately. An old snapshot can become stale; record capture time and version in the evidence report. Raw scan evidence must include every group and ignored findings. NULL/missing groups or disabled static analysis BLOCK a clean-scan claim. No Base44 mutation is automated here.

See `docs/quality/release-checklist.md`, `evidence-template.md`, `pending-tests.md`, and `mission-011-report.md`. Invoke both existing skills for Base44 work; these tools supplement, never expand, task permissions.

Some existing browser suites write tracked screenshots. Before invoking them, preserve originals and record dirty status; retain new screenshots outside Git and restore only the runner's generated changes after checking no concurrent owner edits occurred. The runner does not automatically revert files. Recheck the complete working tree after every run. Do not run suites with shared-data side effects under these local example configs.
