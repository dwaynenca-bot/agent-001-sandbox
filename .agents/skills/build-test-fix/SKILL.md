---
name: build-test-fix
description: Build, troubleshoot, test and repair software changes in this repository. Use for feature implementation, bug fixes, refactors and prototype tasks that require an iterative code-test-fix workflow and a reviewable handoff.
---

# Build → test → fix → hand off

Use this procedure when Agent 001 is asked to implement or repair software.

## 1. Frame the task

- Identify the requested outcome, likely affected files and observable acceptance criteria.
- Inspect relevant files and `README.md`; do not perform a full-repository tour for a tiny change.
- Keep an existing working feature working unless the user deliberately requests a behavior change.
- For ambiguous but low-risk details, state a reasonable assumption and continue. Ask when ambiguity could cause destructive or consequential changes.

## 2. Implement the smallest suitable solution

- Write maintainable, focused changes. Reuse existing libraries and patterns.
- Add or update relevant tests for new behavior and fixed regressions.
- Keep changes within the authorized working branch. Do not deploy, publish, merge or make remote GitHub writes without explicit approval.
- Do not add credentials, external integrations, network calls or new paid services without approval.

## 3. Verify with real commands

For the existing Stock Integrity Watchdog application, use the following as appropriate:

```sh
npm ci
npm test
npm run build
npm run test:e2e
```

- Run `npm ci` only when dependencies are not installed; do not needlessly reinstall on every iteration.
- Run targeted tests first, then the unit suite and production build for code changes.
- For UI changes, run the Playwright browser tests when the browser is available. The current Playwright configuration may expect Chromium at `/usr/bin/chromium`; if unavailable, check the environment before suggesting an installation.
- Never report the historical test count as a current result. Record the actual commands, outcomes and observed test counts.
- If a command cannot run, describe the missing prerequisite and whether the work remains unverified.

## 4. Fix and retest

1. Read the exact failure output; identify whether it indicates a code defect, test defect or environment issue.
2. Fix the root cause with the smallest sensible change.
3. Rerun the failing check; then rerun relevant regression checks.
4. Limit the same issue to **three unsuccessful fix/retest iterations**. If still failing, stop and give the owner a useful failure report.
5. Do not weaken or delete tests merely to get a green result. Do not hide unresolved errors.

## 5. Deliver a reviewable prototype

Provide:

- **Outcome:** what was built or fixed, with a short usage note if applicable.
- **Changes:** files touched and key decisions.
- **Verification:** commands and their actual pass/fail/blocked status.
- **Remaining issues:** blockers, caveats and risks.
- **Review/approval needed:** what the owner should inspect or approve next.

Do not claim that the prototype has been deployed, is production-ready, or can operate continuously unless independently verified. For user-requested cloud work, follow the execution environment's runtime limits, available tools and permission prompts.
