# Agent 001 controlled coding spike: Niveous CRM identity mapping

**Status:** Local prototype only; NOT linked to Niveous or its production data.

This is a pure JavaScript proposed addition to the public `agent-001-sandbox` GitHub repository. It addresses the duplicate external CRM ID risk discovered during Agent 001's v0.5.1 schema draft. It performs no API calls, database writes, deployments, or customer actions.

To test on Node.js 22 (no dependencies):

```sh
node --test experiments/niveous-crm-sync/tests/mapping.node-check.mjs
```

- Composite key: `[tenantId, entityType, provider, externalId]`, using JSON encoding rather than delimiter concatenation.
- Provider names are case-insensitive; external IDs preserve case and leading zeros.
- Conflicts are reported and **all proposed additions are suppressed** until reviewed.
- Returns `applied: false`; does not change its inputs.

**Known limitation:** In-memory checks are not concurrency-safe. Real Niveous integration requires backend-validated tenant permissions, atomic uniqueness enforcement or transactional locking, retries, audit logs, and a verified source-of-truth policy. This code must not be connected to live records until those are established.

**Next governed step:** Review the patch, explicitly approve a GitHub sandbox branch write, then have the existing GitHub Actions pipeline validate the proposed change. Do not deploy Niveous.
