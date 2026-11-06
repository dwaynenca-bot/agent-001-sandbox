import {calculateQuote, createQuote, editQuote} from './domain.js';
export const STORAGE_KEY = 'floral-quote-lab.drafts.v1';
const enquiryFields = ['name', 'email', 'phone', 'eventDate', 'eventType', 'venue', 'notes'];
export function createDraft(id = crypto.randomUUID()) {
  return {version: 1, id, enquiry: Object.fromEntries(enquiryFields.map(key => [key, ''])), quote: createQuote()};
}
export function validateDraft(draft) {
  if (!draft || typeof draft !== 'object' || Object.keys(draft).some(key => !['version', 'id', 'enquiry', 'quote'].includes(key)) || draft.version !== 1 || typeof draft.id !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(draft.id)) throw new TypeError('Unsupported draft format');
  const enquiry = draft.enquiry;
  if (!enquiry || typeof enquiry !== 'object' || Array.isArray(enquiry) || Object.keys(enquiry).length !== enquiryFields.length || enquiryFields.some(key => typeof enquiry[key] !== 'string' || enquiry[key].length > (key === 'notes' ? 4000 : 200))) throw new TypeError('Enquiry fields are missing or too long');
  if (enquiry.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(enquiry.email)) throw new TypeError('Enter a valid email address or leave it blank');
  if (enquiry.eventDate && (!/^\d{4}-\d{2}-\d{2}$/.test(enquiry.eventDate) || !Number.isFinite(Date.parse(enquiry.eventDate)) || new Date(enquiry.eventDate).toISOString().slice(0, 10) !== enquiry.eventDate)) throw new TypeError('Enter a valid event date or leave it blank');
  calculateQuote(draft.quote);
  return draft;
}
function read(storage) {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return [];
  let data;
  try { data = JSON.parse(raw); } catch { throw new Error('Saved drafts are unreadable. Existing storage has been preserved.'); }
  if (!data || data.version !== 1 || !Array.isArray(data.drafts) || data.drafts.length > 100) throw new Error('Saved drafts use an unsupported format. Existing storage has been preserved.');
  const ids = new Set();
  for (const draft of data.drafts) {
    validateDraft(draft);
    if (ids.has(draft.id)) throw new Error('Saved drafts have duplicate identities. Existing storage has been preserved.');
    ids.add(draft.id);
  }
  return data.drafts;
}
export function listDrafts(storage) { return structuredClone(read(storage)); }
export function saveDraft(storage, draft) {
  validateDraft(draft);
  const drafts = read(storage), index = drafts.findIndex(value => value.id === draft.id);
  if (index < 0) {
    if (drafts.length >= 100) throw new Error('This browser has reached the 100-draft limit');
    drafts.push(structuredClone(draft));
  } else drafts[index] = structuredClone(draft);
  storage.setItem(STORAGE_KEY, JSON.stringify({version: 1, drafts}));
}
export function fictionalExample(kind = 'wedding') {
  if (!['wedding', 'celebration'].includes(kind)) throw new TypeError('Unknown fictional example');
  const draft = createDraft();
  draft.enquiry = {name: kind === 'wedding' ? 'Alex & Sam (fictional)' : 'Morgan (fictional)', email: '', phone: '', eventDate: '', eventType: kind === 'wedding' ? 'Wedding' : 'Celebration', venue: 'Fictional garden venue', notes: 'Fictional example only. All prices can be edited.'};
  const items = kind === 'wedding' ? [{id: 'bouquet', description: 'Garden bridal bouquet', quantity: 1, unitPence: 9500}, {id: 'tables', description: 'Seasonal table arrangement', quantity: 6, unitPence: 4500}] : [{id: 'gift', description: 'Seasonal celebration bouquet', quantity: 2, unitPence: 3550}];
  for (const value of items) draft.quote = editQuote(draft.quote, {action: 'add', collection: 'items', value});
  if (kind === 'wedding') for (const [id, description, amountPence] of [['delivery', 'Delivery', 2500], ['setup', 'Setup', 4000]]) draft.quote = editQuote(draft.quote, {action: 'add', collection: 'charges', value: {id, description, amountPence}});
  return draft;
}
