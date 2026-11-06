import {editQuote, calculateQuote, parseMoney, formatMoney} from './domain.js';
import {createDraft, validateDraft, listDrafts, saveDraft, fictionalExample} from './drafts.js';
const $ = selector => document.querySelector(selector);
const enquiry = $('#enquiry-form'), itemForm = $('#item-form'), chargesForm = $('#charges-form');
let draft = createDraft(), dirty = false, editingId = null, pendingItem = false, pendingCharges = false;
const report = message => { $('#error').textContent = message; };
function markDirty() { dirty = true; $('#save-status').textContent = 'Unsaved changes — this draft is not backed up'; }
function pending() { $('#pending-status').textContent = pendingItem || pendingCharges ? 'Unapplied edits: apply or clear arrangement changes and apply charges before saving or printing. Summary shows applied values.' : ''; }
function moneyInput(value) { return `${Math.floor(value / 100)}.${String(value % 100).padStart(2, '0')}`; }
function node(tag, text, className) {
  const element = document.createElement(tag);
  if (text !== undefined) element.textContent = text;
  if (className) element.className = className;
  return element;
}
function resetItem() {
  editingId = null; itemForm.reset(); itemForm.elements.quantity.value = '1';
  $('#item-form-heading').textContent = 'Add an arrangement'; $('#apply-item').textContent = 'Add line item'; pendingItem = false; pending();
}
function syncCharges() {
  for (const id of ['delivery', 'setup']) {
    const value = draft.quote.charges.find(charge => charge.id === id);
    chargesForm.elements[id].value = value ? moneyInput(value.amountPence) : '';
  }
  pendingCharges = false; pending();
}
function renderPrint(totals) {
  const details = $('#print-details'); details.replaceChildren();
  for (const [label, value] of [['Prepared for', draft.enquiry.name || 'Name not provided'], ['Occasion', draft.enquiry.eventType], ['Event date', draft.enquiry.eventDate], ['Venue', draft.enquiry.venue], ['Email', draft.enquiry.email], ['Phone', draft.enquiry.phone]]) {
    if (!value) continue;
    const row = node('div'); row.append(node('strong', label), node('p', value)); details.append(row);
  }
  const tbody = $('#print-items'); tbody.replaceChildren();
  for (const item of draft.quote.items) {
    const row = node('tr');
    for (const value of [item.description, String(item.quantity), formatMoney(item.unitPence), formatMoney(totals.lines.find(line => line.id === item.id).totalPence)]) row.append(node('td', value));
    tbody.append(row);
  }
  if (!draft.quote.items.length) { const row = node('tr'); const cell = node('td', 'No arrangements added'); cell.colSpan = 4; row.append(cell); tbody.append(row); }
  const printTotals = $('#print-totals'); printTotals.replaceChildren();
  for (const [label, value] of [['Flowers subtotal', totals.subtotalPence], ...draft.quote.charges.map(charge => [charge.description, charge.amountPence]), ['Draft total', totals.totalPence]]) {
    const row = node('div'); row.append(node('dt', label), node('dd', formatMoney(value))); printTotals.append(row);
  }
  const notes = $('#print-notes'); notes.replaceChildren();
  if (draft.enquiry.notes) notes.append(node('h3', 'Notes'), node('p', draft.enquiry.notes));
}
function render() {
  const totals = calculateQuote(draft.quote);
  $('#subtotal').textContent = formatMoney(totals.subtotalPence); $('#total').textContent = formatMoney(totals.totalPence);
  for (const id of ['delivery', 'setup']) {
    const value = draft.quote.charges.find(charge => charge.id === id);
    $(`#${id}-total`).textContent = value ? formatMoney(value.amountPence) : 'Not added';
  }
  const list = $('#items'); list.replaceChildren();
  for (const item of draft.quote.items) {
    const row = node('div', undefined, 'item-row');
    const description = node('div'); description.append(node('h3', item.description), node('p', `${item.quantity} × ${formatMoney(item.unitPence)}`, 'hint'));
    const actions = node('div', undefined, 'item-actions');
    const edit = node('button', 'Edit', 'secondary'); edit.setAttribute('aria-label', `Edit ${item.description}`);
    edit.addEventListener('click', () => {
      if (pendingItem && !confirm('Discard unapplied arrangement edits?')) return;
      editingId = item.id; itemForm.elements.description.value = item.description;
      itemForm.elements.quantity.value = String(item.quantity); itemForm.elements.price.value = moneyInput(item.unitPence);
      $('#item-form-heading').textContent = 'Edit arrangement'; $('#apply-item').textContent = 'Apply item changes';
      pendingItem = true; pending(); itemForm.elements.description.focus();
    });
    const remove = node('button', 'Remove', 'text-button'); remove.setAttribute('aria-label', `Remove ${item.description}`);
    remove.addEventListener('click', () => {
      if (!confirm(`Remove “${item.description}”?`)) return;
      draft.quote = editQuote(draft.quote, {action: 'remove', collection: 'items', id: item.id});
      if (editingId === item.id) resetItem(); markDirty(); render();
    });
    actions.append(node('strong', formatMoney(totals.lines.find(line => line.id === item.id).totalPence)), edit, remove); row.append(description, actions); list.append(row);
  }
  if (!draft.quote.items.length) list.append(node('p', 'No arrangements yet. Add your first line item below.', 'empty-state'));
  renderPrint(totals);
}
function refreshSaved() {
  const select = $('#saved-drafts'); select.replaceChildren(new Option('Choose a draft', ''));
  try {
    for (const saved of listDrafts(window.localStorage)) select.append(new Option(`${saved.enquiry.name || 'Untitled draft'} · ${saved.enquiry.eventType || 'Occasion not set'} · ${formatMoney(calculateQuote(saved.quote).totalPence)}`, saved.id));
  } catch { report('Saved drafts could not be read. Existing browser data has been preserved. You can keep editing, but saving may be unavailable.'); }
}
function load(next, saved = false) {
  draft = structuredClone(next); dirty = !saved;
  for (const field of Object.keys(draft.enquiry)) enquiry.elements[field].value = draft.enquiry[field];
  resetItem(); syncCharges(); report(''); $('#save-status').textContent = saved ? 'Opened saved draft from this browser' : 'New draft — not saved'; render();
}
function mayReplace() { return !(dirty || pendingItem || pendingCharges) || confirm('Discard unsaved or unapplied changes and open another draft?'); }
function ready() {
  if (pendingItem || pendingCharges) throw new Error('Apply or clear arrangement edits and apply charges before saving or printing.');
  validateDraft(draft);
}
enquiry.addEventListener('submit', event => event.preventDefault());
enquiry.addEventListener('input', event => {
  if (!Object.hasOwn(draft.enquiry, event.target.name)) return;
  draft.enquiry[event.target.name] = event.target.value; markDirty(); renderPrint(calculateQuote(draft.quote));
});
itemForm.addEventListener('input', () => { pendingItem = true; pending(); });
itemForm.addEventListener('submit', event => {
  event.preventDefault(); report('');
  try {
    if (!/^[1-9]\d*$/.test(itemForm.elements.quantity.value)) throw new Error('Quantity must be a positive whole number');
    const value = {description: itemForm.elements.description.value, quantity: Number(itemForm.elements.quantity.value), unitPence: parseMoney(itemForm.elements.price.value)};
    draft.quote = editQuote(draft.quote, editingId ? {action: 'update', collection: 'items', id: editingId, value} : {action: 'add', collection: 'items', value: {id: crypto.randomUUID(), ...value}});
    resetItem(); markDirty(); render();
  } catch (error) { report(error.message); }
});
$('#cancel-item').addEventListener('click', () => { resetItem(); report(''); });
chargesForm.addEventListener('input', () => { pendingCharges = true; pending(); });
chargesForm.addEventListener('submit', event => {
  event.preventDefault(); report('');
  try {
    const charges = [];
    for (const id of ['delivery', 'setup']) {
      const input = chargesForm.elements[id].value;
      if (input !== '') charges.push({id, description: id === 'delivery' ? 'Delivery' : 'Setup', amountPence: parseMoney(input)});
    }
    const next = {...draft.quote, charges}; calculateQuote(next); draft.quote = next;
    syncCharges(); markDirty(); render();
  } catch (error) { report(error.message); }
});
$('#save-draft').addEventListener('click', () => {
  report('');
  try { ready(); saveDraft(window.localStorage, draft); dirty = false; $('#save-status').textContent = 'Saved in this browser — not backed up'; refreshSaved(); }
  catch (error) { $('#save-status').textContent = 'Not saved — your current work remains on this page'; report(`Could not save draft. ${error.message} Keep this page open; apply or correct inputs, or print a copy when valid.`); }
});
$('#print-draft').addEventListener('click', () => {
  report(''); try { ready(); renderPrint(calculateQuote(draft.quote)); window.print(); } catch (error) { report(`Could not prepare print. ${error.message}`); }
});
$('#new-draft').addEventListener('click', () => { if (mayReplace()) load(createDraft()); });
for (const kind of ['wedding', 'celebration']) $(`#example-${kind}`).addEventListener('click', () => { if (mayReplace()) load(fictionalExample(kind)); });
$('#open-draft').addEventListener('click', () => {
  const id = $('#saved-drafts').value;
  if (!id) { report('Choose a saved draft first.'); return; }
  if (!mayReplace()) return;
  try { const saved = listDrafts(window.localStorage).find(value => value.id === id); if (!saved) throw new Error('Draft is no longer available in this browser'); load(saved, true); }
  catch (error) { report(`Could not open draft. ${error.message}`); }
});
window.addEventListener('beforeunload', event => { if (dirty || pendingItem || pendingCharges) { event.preventDefault(); event.returnValue = ''; } });
window.addEventListener('beforeprint', () => {
  try { ready(); $('.document-note').textContent = 'Draft for discussion • Tax treatment not configured'; }
  catch { $('.document-note').textContent = 'DRAFT INCOMPLETE — unresolved or unapplied edits; applied values shown • Tax treatment not configured'; }
});
load(draft); refreshSaved();
