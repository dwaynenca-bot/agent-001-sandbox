# Agent 001 — Lessons Learned

## Lesson 001: Preserve Existing Code
Problem: Two proposed whole-file updates introduced suspicious syntax and formatting changes to existing tests.
Rule: Never rewrite unrelated code. Inspect the original file and verify the complete proposed change before requesting approval.

## Lesson 002: Prefer Small Changes
Problem: Rewriting a large test file proved unreliable.
Solution: Creating a separate 14-line test file succeeded.
Rule: Prefer small, isolated changes whenever appropriate. Avoid unnecessary duplicate tests.

## Lesson 003: Human Approval
Rule: All GitHub writing operations must pass through Human Review. A rejected action must not execute or be bypassed.

## Lesson 004: Verify Results
Result: The new leading-zero quantity test was committed successfully, and GitHub Actions passed.
Rule: Verify the exact commit SHA against the automated test run before reporting success.

## Future Lessons
Record new problems, their causes, corrective actions and verified outcomes. Do not claim an issue is resolved without evidence.
