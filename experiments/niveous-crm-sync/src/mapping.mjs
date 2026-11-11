/**
 * Niveous CRM identity-mapping design spike.
 * Pure in-memory planning only: no databases, credentials, API calls or writes.
 * A proposed mapping is not a uniqueness guarantee until enforced atomically by the datastore.
 */
const PROVIDER = /^[A-Za-z0-9_-]{1,64}$/;
const TENANT = /^[A-Za-z0-9_-]{1,128}$/;
const ENTITY_TYPES = new Set(['Contact', 'Project']);

function requiredId(value, field, maxLength = 255) {
  if (typeof value !== 'string' || value.length < 1 || value.length > maxLength ||
      value !== value.trim() || /[\x00-\x1F\x7F]/.test(value)) {
    throw new TypeError(`${field} must be a nonempty, trimmed string of at most ${maxLength} characters without control characters.`);
  }
  return value;
}

/** Validate and normalize provider without changing case-sensitive external IDs. */
export function validateMapping(record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('Mapping must be an object.');
  }
  const tenantId = requiredId(record.tenantId, 'tenantId', 128);
  if (!TENANT.test(tenantId)) throw new TypeError('Invalid tenantId.');
  const providerRaw = requiredId(record.provider, 'provider', 64);
  if (!PROVIDER.test(providerRaw)) throw new TypeError('Invalid provider.');
  const provider = providerRaw.toLowerCase();
  const externalId = requiredId(record.externalId, 'externalId', 255);
  if (!ENTITY_TYPES.has(record.entityType)) throw new TypeError('Unsupported entityType.');
  const entityId = requiredId(record.entityId, 'entityId', 255);
  return {tenantId, provider, externalId, entityType: record.entityType, entityId};
}

/** Collision-safe exact composite key, including tenant and entity type. */
export function mappingKey(record) {
  const {tenantId, provider, externalId, entityType} = validateMapping(record);
  return JSON.stringify([tenantId, entityType, provider, externalId]);
}

/**
 * Plan idempotent additions, without mutating data.
 * Any conflicting identity blocks ALL proposed additions (fail closed).
 * Callers must still enforce uniqueness atomically in a privileged backend transaction.
 */
export function planMappingUpserts(existingRecords, incomingRecords) {
  if (!Array.isArray(existingRecords) || !Array.isArray(incomingRecords)) {
    throw new TypeError('Both existingRecords and incomingRecords must be arrays.');
  }
  const existing = new Map();
  const pending = new Map();
  const conflicts = [];
  let alreadyMapped = 0;
  let repeatedIncoming = 0;

  for (const raw of existingRecords) {
    const record = validateMapping(raw);
    const key = mappingKey(record);
    if (existing.has(key) && existing.get(key).entityId !== record.entityId) {
      conflicts.push({reason:'EXISTING_KEY_CONFLICT', key, entityIds:[existing.get(key).entityId, record.entityId]});
    } else {
      existing.set(key, record);
    }
  }

  for (const raw of incomingRecords) {
    const record = validateMapping(raw);
    const key = mappingKey(record);
    const found = existing.get(key) || pending.get(key);
    if (found && found.entityId !== record.entityId) {
      conflicts.push({reason:'EXTERNAL_ID_CONFLICT', key, entityIds:[found.entityId, record.entityId]});
    } else if (existing.has(key)) {
      alreadyMapped++;
    } else if (pending.has(key)) {
      repeatedIncoming++;
    } else {
      pending.set(key, record);
    }
  }
  return {
    safeToApply: conflicts.length === 0,
    additions: conflicts.length ? [] : [...pending.values()],
    alreadyMapped,
    repeatedIncoming,
    conflicts,
    applied: false,
  };
}
