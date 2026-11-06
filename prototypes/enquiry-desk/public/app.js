const $ = selector => document.querySelector(selector);
const loginForm = $('#login-form'), form = $('#enquiry-form');
let session = null, current = null, dirty = false, saving = false, epoch = 0, listVersion = 0, detailVersion = 0, offset = 0, total = 0;
const LIMIT = 25;
class StaleResponse extends Error {}
class ApiError extends Error { constructor(status, message) { super(message); this.status = status; } }
function notify(message = '', failure = false) { $('#error').textContent = failure ? message : ''; $('#notice').textContent = failure ? '' : message; }
function cleanEditor(item = null) {
  current = item; dirty = false; form.reset();
  if (item) for (const key of ['name','email','subject','message','status']) form.elements[key].value = item[key];
  $('#editor-heading').textContent = item ? 'Edit enquiry' : 'New enquiry';
  $('#edit-state').textContent = item ? 'Saved' : 'Not saved';
  $('#record-meta').textContent = item ? `Created ${date(item.createdAt)} · Updated ${date(item.updatedAt)}` : '';
}
function date(time) { return new Intl.DateTimeFormat('en-GB', {dateStyle: 'medium', timeStyle: 'short'}).format(time); }
function clearSession(message = '') {
  epoch++; listVersion++; detailVersion++; session = null; saving = false; offset = 0; total = 0;
  cleanEditor(); $('#enquiry-list').replaceChildren(); $('#business-name').textContent = ''; $('#user-email').textContent = '';
  $('#status-filter').value = ''; $('#list-status').textContent = ''; $('#page-summary').textContent = '';
  $('#previous').disabled = true; $('#next').disabled = true; $('#editor-fields').disabled = true;
  loginForm.reset(); $('#login-fields').disabled = false; $('#app-panel').hidden = true; $('#login-panel').hidden = false; notify(message);
}
async function api(path, {method = 'GET', data} = {}) {
  const version = epoch, headers = {};
  if (session && method !== 'GET') headers['X-CSRF-Token'] = session.csrfToken;
  if (data !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try { response = await fetch(path, {method, headers, credentials: 'same-origin', body: data === undefined ? undefined : JSON.stringify(data), signal: AbortSignal.timeout(10000)}); }
  catch { if (version !== epoch) throw new StaleResponse(); throw new Error('Cannot reach the local server. Keep this page open and retry.'); }
  let body;
  try { body = response.status === 204 ? undefined : await response.json(); }
  catch { if (version !== epoch) throw new StaleResponse(); throw new Error('The server returned an unreadable response. Please retry.'); }
  if (version !== epoch) throw new StaleResponse();
  if (!response.ok) {
    if (response.status === 401 && path !== '/api/login') clearSession('Your session ended. Sign in again; unsaved work has been cleared.');
    throw new ApiError(response.status, body?.error || 'The request could not be completed');
  }
  return body;
}
function showError(error, prefix) {
  if (error instanceof StaleResponse || error.status === 401 && !session) return;
  notify(`${prefix} ${error.message}`, true);
}
function mayDiscard() {
  if (saving) { notify('Please wait for the current save to finish.', true); return false; }
  return !dirty || confirm('Discard unsaved enquiry changes?');
}
function element(tag, text, className) { const el = document.createElement(tag); if (text !== undefined) el.textContent = text; if (className) el.className = className; return el; }
async function refreshList() {
  const version = ++listVersion;
  $('#list-status').textContent = 'Loading enquiries…';
  const params = new URLSearchParams({limit: String(LIMIT), offset: String(offset)}), status = $('#status-filter').value;
  if (status) params.set('status', status);
  try {
    const data = await api('/api/enquiries?' + params);
    if (version !== listVersion) return;
    total = data.total;
    if (offset >= total && offset > 0) { offset = Math.max(0, Math.floor((total - 1) / LIMIT) * LIMIT); return refreshList(); }
    const list = $('#enquiry-list'); list.replaceChildren();
    for (const item of data.enquiries) {
      const row = element('li'), button = element('button', undefined, 'enquiry-button'); button.type = 'button'; button.dataset.id = item.id;
      button.setAttribute('aria-current', String(current?.id === item.id));
      button.append(element('strong', item.subject), element('span', item.name, 'contact'), element('span', item.status, 'tag'));
      button.addEventListener('click', () => openEnquiry(item.id)); row.append(button); list.append(row);
    }
    $('#list-status').textContent = total ? `${total} enquir${total === 1 ? 'y' : 'ies'}${status ? ' with this status' : ''}` : 'No enquiries with this filter. Start with New enquiry.';
    $('#page-summary').textContent = total ? `${offset + 1}–${Math.min(offset + LIMIT, total)} of ${total}` : '0 enquiries';
    $('#previous').disabled = offset === 0; $('#next').disabled = offset + LIMIT >= total;
  } catch (error) {
    if (version !== listVersion) return;
    $('#list-status').textContent = 'Unable to refresh. Previously displayed results may be out of date.';
    showError(error, 'Could not load enquiries.');
  }
}
async function openEnquiry(id) {
  if (!mayDiscard()) return;
  const version = ++detailVersion, authVersion = epoch;
  $('#editor-fields').disabled = true; notify();
  try {
    const item = await api('/api/enquiries/' + encodeURIComponent(id));
    if (version !== detailVersion) return;
    cleanEditor(item);
    for (const button of $('#enquiry-list').querySelectorAll('button')) button.setAttribute('aria-current', String(button.dataset.id === id));
    form.elements.name.focus();
  } catch (error) { if (version === detailVersion) showError(error, 'Could not open enquiry.'); }
  finally { if (authVersion === epoch && version === detailVersion) $('#editor-fields').disabled = false; }
}
function activate(data) {
  epoch++; session = data; offset = 0; cleanEditor(); $('#enquiry-list').replaceChildren();
  loginForm.reset(); $('#business-name').textContent = data.user.businessName; $('#user-email').textContent = data.user.email;
  $('#login-panel').hidden = true; $('#app-panel').hidden = false; $('#editor-fields').disabled = false; notify();
  return refreshList();
}
loginForm.addEventListener('submit', async event => {
  event.preventDefault(); notify();
  const data = {email: loginForm.elements.email.value, password: loginForm.elements.password.value};
  loginForm.elements.password.value = ''; $('#login-fields').disabled = true;
  try { await activate(await api('/api/login', {method: 'POST', data})); }
  catch (error) { if (!(error instanceof StaleResponse)) notify(`Could not sign in. ${error.message}`, true); }
  finally { $('#login-fields').disabled = false; }
});
$('#sign-out').addEventListener('click', async () => {
  if (!mayDiscard()) return;
  $('#sign-out').disabled = true;
  try { await api('/api/logout', {method: 'POST'}); clearSession('Signed out.'); }
  catch (error) { showError(error, 'Could not sign out; your session may still be active. Retry.'); }
  finally { $('#sign-out').disabled = false; }
});
form.addEventListener('input', () => { dirty = true; $('#edit-state').textContent = 'Unsaved changes'; });
form.addEventListener('submit', async event => {
  event.preventDefault(); if (saving) return; notify();
  const authVersion = epoch, id = current?.id;
  const data = Object.fromEntries(['name','email','subject','message','status'].map(key => [key, form.elements[key].value]));
  saving = true; $('#editor-fields').disabled = true;
  try {
    const saved = await api(id ? '/api/enquiries/' + encodeURIComponent(id) : '/api/enquiries', {method: id ? 'PATCH' : 'POST', data});
    cleanEditor(saved); notify('Enquiry saved to the local database.'); await refreshList();
  } catch (error) { showError(error, 'Could not save enquiry. Your edits remain on this page. Check the list before retrying a new enquiry.'); }
  finally { if (authVersion === epoch) { saving = false; $('#editor-fields').disabled = false; } }
});
$('#new-enquiry').addEventListener('click', () => { if (!mayDiscard()) return; detailVersion++; cleanEditor(); $('#editor-fields').disabled = false; notify(); form.elements.name.focus(); });
$('#discard').addEventListener('click', () => { if (!mayDiscard()) return; cleanEditor(current); notify('Unapplied edits discarded.'); });
$('#refresh').addEventListener('click', () => refreshList());
$('#status-filter').addEventListener('change', () => { offset = 0; refreshList(); });
$('#previous').addEventListener('click', () => { offset = Math.max(0, offset - LIMIT); refreshList(); });
$('#next').addEventListener('click', () => { if (offset + LIMIT < total) { offset += LIMIT; refreshList(); } });
window.addEventListener('beforeunload', event => { if (dirty) { event.preventDefault(); event.returnValue = ''; } });
try { await activate(await api('/api/session')); }
catch (error) { if (error.status !== 401) { clearSession(); notify(`Could not restore your session. ${error.message}`, true); } }
finally { $('#boot-status').hidden = true; document.documentElement.dataset.ready = 'true'; }
