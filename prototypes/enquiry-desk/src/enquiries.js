import {randomUUID} from 'node:crypto';
import {enquiryInput, HttpError, validId} from './validation.js';
import {transaction} from './database.js';
const columns = 'id,name,email,subject,message,status,created_at AS createdAt,updated_at AS updatedAt';
const missing = () => { throw new HttpError(404, 'Enquiry not found'); };
export function getEnquiry(db, actor, id) {
  if (!validId(id)) missing();
  const row = db.prepare(`SELECT ${columns} FROM enquiries WHERE business_id=? AND id=?`).get(actor.businessId, id);
  if (!row) missing(); return {...row};
}
export function listEnquiries(db, actor, {limit = 25, offset = 0, status = null} = {}) {
  const where = status === null ? 'business_id=?' : 'business_id=? AND status=?';
  const args = status === null ? [actor.businessId] : [actor.businessId, status];
  return {enquiries: db.prepare(`SELECT ${columns} FROM enquiries WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT ? OFFSET ?`).all(...args, limit, offset).map(row => ({...row})), total: db.prepare(`SELECT count(*) AS n FROM enquiries WHERE ${where}`).get(...args).n, limit, offset};
}
export function createEnquiry(db, actor, input, now = Date.now()) {
  const data = enquiryInput(input), id = randomUUID();
  db.prepare('INSERT INTO enquiries(id,business_id,created_by,name,email,subject,message,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id, actor.businessId, actor.userId, data.name, data.email, data.subject, data.message, data.status, now, now);
  return getEnquiry(db, actor, id);
}
export function updateEnquiry(db, actor, id, input, now = Date.now()) {
  return transaction(db, () => {
    const current = getEnquiry(db, actor, id);
    const patch = enquiryInput(input, true), data = {...current, ...patch};
    db.prepare('UPDATE enquiries SET name=?,email=?,subject=?,message=?,status=?,updated_at=? WHERE business_id=? AND id=?').run(data.name, data.email, data.subject, data.message, data.status, Math.max(now, current.updatedAt), actor.businessId, id);
    return getEnquiry(db, actor, id);
  });
}
