import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMapping, mappingKey, planMappingUpserts } from '../src/mapping.mjs';

const m = (overrides = {}) => ({tenantId:'tenant_A',provider:'HubSpot',externalId:'000123',entityType:'Contact',entityId:'contact_1', ...overrides});

test('accepts valid identity, normalizing provider only', () => {
  assert.deepEqual(validateMapping(m()),{tenantId:'tenant_A',provider:'hubspot',externalId:'000123',entityType:'Contact',entityId:'contact_1'});
});
test('preserves external ID case and leading zeros', () => {
  assert.notEqual(mappingKey(m({externalId:'000123'})),mappingKey(m({externalId:'123'})));
  assert.notEqual(mappingKey(m({externalId:'ABC'})),mappingKey(m({externalId:'abc'})));
});
test('provider spelling is case-insensitive',()=>assert.equal(mappingKey(m({provider:'HUBSPOT'})),mappingKey(m({provider:'hubspot'}))));
test('tenant is part of identity',()=>assert.notEqual(mappingKey(m()),mappingKey(m({tenantId:'tenant_B'}))));
test('entity type is part of identity',()=>assert.notEqual(mappingKey(m()),mappingKey(m({entityType:'Project'}))));
test('composite keys cannot collide via embedded separators',()=>{
  assert.notEqual(mappingKey(m({externalId:'x","y'})),mappingKey(m({externalId:'x',entityId:'y'})));
});
test('rejects missing, blank and padded external IDs',()=>{
  for(const externalId of ['', '   ', ' abc', 'abc '])assert.throws(()=>validateMapping(m({externalId})),/externalId/);
});
test('rejects external IDs longer than 255 characters',()=>assert.throws(()=>validateMapping(m({externalId:'z'.repeat(256)})),/externalId/));
test('rejects invalid provider characters and long provider',()=>{
  for(const provider of ['hub spot','a/b','p'.repeat(65)])assert.throws(()=>validateMapping(m({provider})),/provider/);
});
test('rejects invalid tenant and unknown entity type',()=>{
  assert.throws(()=>validateMapping(m({tenantId:'a/b'})),/tenantId/);
  assert.throws(()=>validateMapping(m({entityType:'User'})),/entityType/);
});
test('rejects missing entity IDs and embedded control chars',()=>{
  assert.throws(()=>validateMapping(m({entityId:''})),/entityId/);
  assert.throws(()=>validateMapping(m({externalId:'abc\n123'})),/externalId/);
});
test('new mapping produces one non-applied addition',()=>{
  const r=planMappingUpserts([], [m()]);
  assert.equal(r.safeToApply,true);assert.equal(r.applied,false);assert.equal(r.additions.length,1);
});
test('exact existing mapping is idempotent',()=>{
  const r=planMappingUpserts([m()],[m({provider:'hubspot'})]);
  assert.deepEqual([r.additions.length,r.alreadyMapped,r.conflicts.length],[0,1,0]);
});
test('duplicate incoming mapping to same entity is deduplicated',()=>{
  const r=planMappingUpserts([], [m(),m()]);
  assert.deepEqual([r.additions.length,r.repeatedIncoming],[1,1]);
});
test('incoming duplicate external ID for another entity blocks all additions',()=>{
  const r=planMappingUpserts([], [m(),m({entityId:'contact_2'}),m({externalId:'other',entityId:'contact_3'})]);
  assert.equal(r.safeToApply,false);assert.equal(r.additions.length,0);assert.equal(r.conflicts[0].reason,'EXTERNAL_ID_CONFLICT');
});
test('existing ownership conflict blocks additions',()=>{
  const r=planMappingUpserts([m()],[m({entityId:'contact_2'})]);
  assert.equal(r.safeToApply,false);assert.equal(r.conflicts.length,1);
});
test('corrupt existing index is caught rather than silently overwritten',()=>{
  const r=planMappingUpserts([m(),m({entityId:'contact_2'})],[]);
  assert.equal(r.safeToApply,false);assert.equal(r.conflicts[0].reason,'EXISTING_KEY_CONFLICT');
});
test('same ID in different tenant and provider is allowed',()=>{
  const r=planMappingUpserts([m()],[m({tenantId:'tenant_B'}),m({provider:'Salesforce'})]);
  assert.equal(r.safeToApply,true); assert.equal(r.additions.length,2);
});
test('does not mutate source arrays or records',()=>{
  const old=Object.freeze([Object.freeze(m())]); const incoming=Object.freeze([Object.freeze(m({externalId:'456'}))]);
  const r=planMappingUpserts(old,incoming);
  assert.equal(r.additions.length,1);assert.equal(incoming[0].provider,'HubSpot');
});
test('rejects non-array and malformed inputs',()=>{
  assert.throws(()=>planMappingUpserts({}, []),/arrays/);
  assert.throws(()=>planMappingUpserts([], [null]),/object/);
});
