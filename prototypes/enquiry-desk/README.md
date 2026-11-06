# Enquiry Desk — local training MVP

Fictional full-stack training application with a plain browser interface, authenticated API, SQLite persistence and recovery tools. The backend foundation is durably preserved at `24d6cf80f6fc787a48463e528f361084fe195a22` on `feature/enquiry-desk-m016`. The integrated frontend changes remain local until separately approved for handover. No production security certification, deployment or real-customer use is claimed.

## Runtime and local setup

Use **Node 24.19.0 through Node 24.x**. The app uses only built-in HTTP, SQLite, crypto and test APIs. No npm packages, services or installation are required. The zero-dependency npm manifest/lockfile are included for reproducibility and the quality toolkit.

From `prototypes/enquiry-desk/`:

```sh
umask 077
mkdir -p var
npm run init -- var/enquiry-desk.sqlite var/local-credentials.json
npm start
```

The initialization command creates two independent fictional businesses (Orchard Studio and Lantern Workshop) with one account each. It generates fresh random passwords and writes them once to the **new, owner-only credential file you explicitly selected**. It never prints passwords. Inspect that file only through a trusted local editor; never copy it into source, screenshots, logs or chat. The database, credentials, sessions and backups are local runtime data, excluded from source control. Keep them under ignored `var/` or outside the repository. Tests generate their own random credentials and temporary databases, then remove them.

Initialization is deliberate and transactional: if credential-file persistence fails, account inserts roll back. Existing credential files or databases containing accounts are never overwritten/reseeded. A process crash between filesystem and database operations is not a cross-resource transaction; inspect both before retrying after an interrupted initialization. No registration, password reset or account administration API exists in this foundation.

The server defaults to **http://127.0.0.1:4180** and always binds `127.0.0.1`. `PORT` optionally changes the port; `ENQUIRY_DB` selects an explicit database file. Do not expose it with a tunnel or reverse proxy. Use the exact printed origin, not a different host alias. Startup migrates an empty database but **never creates accounts or sample enquiries**. Stop with Ctrl-C; restart with the same database path to retain accounts, enquiries and unexpired sessions.

Open the printed origin and sign in with an initialized fictional account. The page identifies the authenticated business and account; there is no client-controlled business selector.

- Choose New enquiry, enter a contact name and subject, optionally email/message, then Save enquiry. Status defaults to New; it may be changed to In progress or Closed.
- Select a record from the list to retrieve and edit it through the authenticated API. Each business sees only its own records. The list is paginated at 25 records and can be filtered by status.
- Saves are explicit. Unapplied changes prompt before switching records, starting a new record or signing out; navigation warnings depend on browser behavior. Discard edits restores the last loaded/saved values.
- A failed save retains the form and reports failure. On an uncertain network failure, check/refresh the list before retrying a new record: the server might have committed before the response was lost. Create requests do not yet have idempotency keys.
- Sign out invalidates the session and scrubs the business identity, form and record list. A failed logout reports that the session may remain active; it does not falsely claim success. A server-rejected/expired session clears the workspace on the next request. There is no automatic idle-screen lock.
- Reload retrieves the session and list from the server. Select a record again to reopen it. No enquiry, password, session or CSRF data is placed in browser localStorage/sessionStorage. Unsaved edits are not persisted or backed up.
- Use separate browser profiles/private contexts to review both businesses simultaneously; ordinary tabs in one profile share the session cookie. Browser cookies are HttpOnly and SameSite=Strict. Old in-flight responses are ignored after an authenticated session changes.

Never serve this project directory using a generic static file server: data and source are private. The server exposes only `/`, `/assets/app.js`, `/assets/style.css` and the authenticated API. Generated data is never a public static asset.

## API contract

JSON requests use `Content-Type: application/json`. State-changing requests require an `Origin` header equal to the printed server origin. Authenticated mutations additionally require `X-CSRF-Token` from login or session retrieval. Send the session cookie using a cookie jar or HTTP client; never put tokens in URLs.

| Method/path | Behaviour |
| --- | --- |
| `POST /api/login` | `{email,password}`; generic 401 for wrong/unknown credentials; sets session cookie and returns public user context, `csrfToken`, `expiresAt` |
| `GET /api/session` | Current session context and CSRF token; 401 without a valid session |
| `POST /api/logout` | Requires origin/session/CSRF; invalidates session, expires cookie; 204 |
| `GET /api/enquiries` | Tenant-scoped `{enquiries,total,limit,offset}`; defaults 25/0; maximum limit 50 and offset 10000; optional exact `status` filter |
| `POST /api/enquiries` | Creates an enquiry in the authenticated business; returns 201 and Location |
| `GET /api/enquiries/:id` | Retrieves only the authenticated business's record |
| `PATCH /api/enquiries/:id` | Applies a nonempty set of allowlisted editable fields to an owned record |

Enquiry fields: required `name` and `subject` (1–200 characters), optional `email` (valid email or empty, maximum 200), optional `message` (maximum 4000), optional `status` (`New`, `In progress`, `Closed`; creation default `New`). Text is trimmed; disallowed control characters, null values and unknown fields are rejected. Client ownership, business, creator, identity and timestamp fields are never accepted. IDs are server-generated UUIDs. No deletion is implemented. Responses expose no ownership identifiers, password hashes or raw session tokens.

Errors have `{error: 'message'}`. Invalid inputs are 400, unauthenticated requests 401, wrong origin/CSRF/Host 403, unknown/cross-business record IDs 404, excessive body size 413, wrong media type 415, throttled login 429 and unexpected storage failures generic 500. Unknown/cross-business GET and PATCH return the same 404 body; with syntactically valid JSON the ownership lookup precedes patch field validation. Internal stack traces, SQL details and credentials are not returned or logged.

List/filter/count queries and record reads/updates always include the business ID derived from the authenticated user/session. Tenant identity never comes from a submitted field, URL query or request header. SQLite additionally constrains an enquiry's creator to belong to its business using a composite foreign key. This is application-level tenant enforcement; SQLite does not provide independent row-level security against a developer who can alter queries or read database files.

## Authentication and local security model

- Passwords use salted scrypt: **N=131072, r=8, p=1**, 16-byte random salt, 64-byte derived key; maximum memory allowance 256 MiB per derivation. Initialization generates a random 24-byte password encoded as base64url. Password verification uses constant-time derived-key comparison. Unknown users perform the same scrypt work factor; this is not a guarantee of indistinguishable timing.
- Session tokens are random **32-byte/256-bit** values. Only SHA-256 token hashes, user IDs and absolute expiry are stored in SQLite. Sessions expire server-side after **8 hours**, rotate on login when an old cookie is present, and are invalidated on logout. Other independent sessions remain valid until logout/expiry.
- Cookies use `HttpOnly`, `SameSite=Strict`, `Path=/` and bounded Max-Age. This loopback-only HTTP server deliberately does not set `Secure`. The cookie builder sets it for HTTPS; **any future HTTPS hosting must require Secure and receive a separate hosting/security review**. This server does not accept proxy-forwarded identity or HTTPS configuration.
- CSRF tokens are domain-separated SHA-256 derivations of the secret session token, returned only to the authenticated same-origin client. The server compares them against the cookie session. Mutations verify Origin; cross-site fetch metadata is rejected. Login also requires exact origin and JSON. No CORS allow headers are emitted.
- Login hashing is limited to two in-flight requests. Five failed attempts per direct client address cause a 60-second block. This single-process in-memory limiter resets at restart; it is not distributed abuse protection. Repeated successful logins can create multiple sessions, cleaned up as they expire during login; there is no active-session management UI.
- Request bodies are limited to 16 KiB, JSON/UTF-8 is strict, query fields are allowlisted, and SQL values use bound parameters. Responses use no-store, nosniff, restrictive CSP, frame denial and no-referrer headers. Request/internal-error logging is generic and excludes customer text and credentials.
- Database files are owner-only; WAL and runtime directories are private. Local OS users/processes with file access remain trusted. Database and backup contents are **not encrypted**. Loopback cookies are shared by host rather than isolated by TCP port; other local services must be trusted. No external service, telemetry or business-data network call is made.

## Schema and migrations

`src/database.js` owns version 1 of the SQLite schema. New databases are created in a transaction with `application_id` and `user_version` identifiers; STRICT tables, foreign keys, required/length/status checks, the composite creator/business constraint and tenant-list/session-expiry indexes are included. WAL mode, FULL synchronous mode and a 5-second busy timeout are enabled.

Startup accepts the known schema and is idempotent. A future/foreign identity or unrecognized pre-existing tables is rejected instead of reset or overwritten. There is no destructive automatic migration or downgrade. Future changes require a reviewed numbered migration, backup, restore rehearsal and explicit tests. `quick_check` and `foreign_key_check` validate backup/recovery. Runtime code assumes one application process; concurrent same-record edits currently use last successful write wins.

## Backup and recovery

Backups contain private account hashes, session hashes and enquiry data. Keep them private and out of Git. Use fresh output paths; scripts refuse to overwrite existing files.

```sh
# May run while the server is active: SQLite's online backup API includes committed WAL data.
npm run backup -- var/enquiry-desk.sqlite var/backup-001.sqlite
# Restore to a NEW file; do not overwrite the running/original database.
npm run restore -- var/backup-001.sqlite var/recovered.sqlite
# Stop the old server, then explicitly select the recovered database:
ENQUIRY_DB=var/recovered.sqlite npm start
```

The backup uses `node:sqlite.backup`, not a plain live copy of the main file. Restore checks database identity/integrity and creates a new database. It then invalidates **all restored sessions**, preserving businesses, user password hashes and enquiries; users must log in again with their existing passwords. The original database and backup remain untouched. If restore reports failure, do not use its destination: retain the original, inspect the failure and retry to another new path. There is no automatic failover, remote backup, point-in-time recovery or production disaster-recovery guarantee.

## Tests and quality toolkit

```sh
npm test
# Reuse a locally installed Playwright module; never install it implicitly:
ENQUIRY_PLAYWRIGHT_PATH=/absolute/path/to/playwright npm run test:browser
```

Backend tests use genuine scrypt, temporary SQLite files, real loopback HTTP, and separate Node server processes. They cover independent logins, CRUD, both-direction tenant attacks, unknown/cross-business indistinguishable 404s, forged ownership fields, session hash storage/rotation/expiry/logout, CSRF/origin/Host, invalid JSON/UTF-8/body sizes, SQL-like text, throttling, constraints/rollback, migration refusal, online backup, restore session invalidation, process restart and initialization refusal. No test uses real customer information. `ENQUIRY_TEST_ROOT` can select a private generated-data directory outside source; tests clean their own temporary directories. Tests run sequentially to bound memory used by real scrypt.

Browser tests use the existing Playwright module and installed Chromium (default `/usr/bin/chromium`; override with `ENQUIRY_CHROMIUM_PATH`). No browser runner or application package is downloaded. `ENQUIRY_BROWSER_EVIDENCE` optionally names a private evidence directory outside source for screenshots. The approved environment reuses Playwright 1.64.1 at `/workspace/watchdog-m015/source/node_modules/playwright`; another environment must provide an approved compatible existing runner or obtain separate installation approval.

The browser suite covers full workflows at 1440px and 375px, independent business contexts and both-direction cross-tenant GET/PATCH attempts, CSRF/ownership rejection, real HttpOnly/Strict cookies, pagination, same-profile business switching, logout/session-expiry data scrubbing, delayed old-session response rejection, save/logout failures, actual restart/reload, safely rendered stored text, unsaved prompts, keyboard navigation, validation and failed-login recovery.

Use the existing repository quality toolkit, unchanged:

```sh
node tools/quality/run.mjs --plan prototypes/enquiry-desk/quality.json
# Review cwd, scripts and the lockfile-bound digest, then use a NEW output directory:
node tools/quality/run.mjs prototypes/enquiry-desk/quality.json /private/evidence/new-run --approve-plan REVIEWED_DIGEST
```

Paths above assume the original repository root. In the isolated workspace, the verified toolkit lives under `baseline/tools/quality/`; use that absolute path with this project's config. Git metadata is unavailable in the isolated project; the evidence manifest records the pinned source and file hashes independently.

The current plan is `quality.json`; `quality.foundation.json` is retained as the original foundation plan. Set the browser runner/executable/evidence environment variables when running the integrated plan. No npm install, bundler build or lint script is needed/provided. No registry-audit pass is claimed for this zero-dependency application. Tested browser behavior is Chromium only; physical devices, Firefox/Safari, full assistive-technology review, load testing and independent security review remain untested. Passing API/browser checks is not production security certification.

## Source and preservation boundaries

Base: `dwaynenca-bot/agent-001-sandbox`, `feature/agent-001-mission-002`, commit `39f38fd86750588dfcaa9be059ab1f7b8f45fcb2`. New source belongs only under `prototypes/enquiry-desk/`. Existing applications, dependencies, permanent skills and quality toolkit are preserved. Any checkpoint beyond the verified foundation requires separate owner approval before GitHub writes. Generated accounts, password files, SQLite databases/sidecars, backups, test output and sessions must never be added to the source manifest. The foundation was independently read back from GitHub before frontend work began. A working preview or local SQLite database is not a durable source handover.
