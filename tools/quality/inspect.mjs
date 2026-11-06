// Inspect owner-reviewed, sanitized MCP snapshots. This never calls Base44 or writes to it.
import {readFileSync} from 'node:fs';
import {sanitize} from './safety.mjs';
export function inspect(snapshot) {
  const rows=[];
  const add=(id,status,reason)=>rows.push({id,status,reason,level:'configuration inspection only'});
  const a=snapshot.app;
  add('target',typeof snapshot.expectedAppId==='string' && snapshot.expectedAppId.length>0 && a?.id===snapshot.expectedAppId && snapshot.branch==='main' ? 'PASS':'BLOCKED','Match pinned app and explicit main branch; inspect other branches manually');
  add('auth-config',a?.auth_config && typeof a.public_settings==='string'?'PASS':'NOT TESTED','Configuration presence only; does not prove authentication');
  for(const name of snapshot.expectedEntities || []) {
    const schema=snapshot.schemas?.find(x=>x.entity_name===name)?.entity_schema;
    const complete=['read','create','update','delete'].every(k=>Object.hasOwn(schema?.rls || {},k));
    add(`rls-${name}`,complete?'PASS':'FAIL','Explicit policy coverage only; rule semantics and enforcement require independent review');
  }
  const scan=snapshot.scan;
  const groups=['rls_recommendations','hardcoded_secrets','backend_functions','open_backend_functions','unlocked_user_fields','exposed_fields','dependency_vulnerabilities','static_code_findings','header_recommendations'];
  const complete=scan?.status==='up_to_date' && scan.static_code_enabled===true && scan.result?.scanned_at && !scan.result?.rls_scan_failed && groups.every(g=>Array.isArray(scan.result[g]));
  add('security-scan',!complete?'BLOCKED':groups.some(g=>scan.result[g].length) || scan.result.ignored_fingerprints?.length?'FAIL':'PASS','Requires current completed scan and all groups; ignored findings are not clean');
  for(const id of ['protected-route-runtime','test-database-routing','disabled-write-enforcement','live-tenant-isolation']) add(id,'NOT TESTED','Snapshot cannot establish runtime behaviour');
  return sanitize(rows);
}
if(process.argv[2]) {try {console.log(JSON.stringify(inspect(JSON.parse(readFileSync(process.argv[2],'utf8'))),null,2));} catch {console.error('Invalid snapshot; details omitted to avoid exposing input');process.exitCode=2;}}
