'use strict';
document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/events.css">');
document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/event-images.css">');
let csrf = ''; let events = [];
const $ = selector => document.querySelector(selector);
const loginPanel = $('#login-panel'), dashboard = $('#dashboard'), editor = $('#event-form');
const imageFile = $('#image-file'), imagePreview = $('#image-preview'), imagePreviewWrap = $('#image-preview-wrap');
let localImageUrl = '';
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
async function api(url, options = {}) { options.headers = { 'content-type':'application/json', ...(csrf ? {'x-csrf-token':csrf} : {}), ...options.headers }; const response = await fetch(url, options); const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Une erreur est survenue.'); return data; }
function message(form, text, ok = false) { const node = form.querySelector('.form-message'); node.textContent = text; node.classList.toggle('success', ok); }
function showDashboard() { loginPanel.classList.add('hidden'); dashboard.classList.remove('hidden'); $('#logout').classList.remove('hidden'); loadEvents(); }
async function loadEvents() { events = await api('/api/events'); $('#admin-list').innerHTML = events.length ? events.map(event => `<button class="admin-event" data-id="${escapeHtml(event.id)}" type="button"><span><b>${escapeHtml(event.title)}</b><small>${escapeHtml(new Intl.DateTimeFormat('fr-CA',{dateStyle:'medium',timeStyle:'short'}).format(new Date(event.date)))}</small></span><i class="status ${event.published?'live':''}">${event.published?'Publié':'Brouillon'}</i></button>`).join('') : '<p>Aucun événement.</p>'; }
function showImage(url) { imagePreview.src = url; imagePreviewWrap.classList.toggle('hidden', !url); }
function clearLocalImageUrl() { if (localImageUrl) URL.revokeObjectURL(localImageUrl); localImageUrl = ''; }
function edit(event = null) { clearLocalImageUrl(); editor.reset(); editor.classList.remove('hidden'); $('#editor-title').textContent = event ? 'Modifier l’événement' : 'Nouvel événement'; $('#delete-event').classList.toggle('hidden', !event); editor.elements.id.value = event?.id || ''; if (event) { for (const [key,value] of Object.entries(event)) if (editor.elements[key]) editor.elements[key].type === 'checkbox' ? editor.elements[key].checked = value : editor.elements[key].value = value; } else { editor.elements.location.value='99, rue Saint-Georges, Saint-Jérôme'; editor.elements.image.value='/assets/point-g-salle.jpg'; editor.elements.eventbriteId.value='1998914026663'; } imageFile.required = editor.elements.image.value === '/assets/point-g-salle.jpg'; showImage(editor.elements.image.value); message(editor, imageFile.required ? 'Sélectionnez une image pour remplacer l’image par défaut.' : ''); editor.scrollIntoView({behavior:'smooth',block:'start'}); }
imageFile.addEventListener('change', () => {
  const file = imageFile.files[0]; if (!file) return;
  if (file.size > 8 * 1024 * 1024) { message(editor, 'L’image dépasse la limite de 8 Mo.'); imageFile.value = ''; return; }
  if (!['image/jpeg','image/png','image/webp'].includes(file.type)) { message(editor, 'Choisissez une image JPEG, PNG ou WebP.'); imageFile.value = ''; return; }
  clearLocalImageUrl(); localImageUrl = URL.createObjectURL(file); showImage(localImageUrl); message(editor, `${file.name} est prête. Cliquez sur « Enregistrer » pour la téléverser.`, true);
});
async function uploadSelectedImage() {
  const file = imageFile.files[0]; if (!file) return;
  const response = await fetch('/api/admin/images', { method:'POST', headers:{ 'content-type':file.type, 'x-csrf-token':csrf }, body:file });
  const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Téléversement impossible.');
  editor.elements.image.value = data.url; imageFile.required = false; clearLocalImageUrl(); showImage(data.url); imageFile.value = '';
}
$('#login-form').addEventListener('submit', async event => { event.preventDefault(); try { const data = await api('/api/admin/login',{method:'POST',body:JSON.stringify({password:event.currentTarget.elements.password.value})}); csrf=data.csrf; showDashboard(); } catch(error) { message(event.currentTarget,error.message); } });
$('#admin-list').addEventListener('click', event => { const button=event.target.closest('[data-id]'); if(button) edit(events.find(item=>item.id===button.dataset.id)); });
$('#new-event').addEventListener('click',()=>edit()); $('#cancel-edit').addEventListener('click',()=>editor.classList.add('hidden'));
editor.addEventListener('submit', async event => { event.preventDefault(); const saveButton=editor.querySelector('button[type="submit"]'); saveButton.disabled=true; try { if(imageFile.files[0]) { message(editor,'Téléversement de l’image…'); await uploadSelectedImage(); } const values=Object.fromEntries(new FormData(editor)); values.published=editor.elements.published.checked; const id=values.id; delete values.id; await api(id?`/api/events/${encodeURIComponent(id)}`:'/api/events',{method:id?'PUT':'POST',body:JSON.stringify(values)}); message(editor,'Image et événement enregistrés.',true); await loadEvents(); if(!id) editor.classList.add('hidden'); } catch(error) { message(editor,error.message); } finally { saveButton.disabled=false; } });
$('#delete-event').addEventListener('click', async()=>{ const id=editor.elements.id.value; if(!id || !confirm('Supprimer définitivement cet événement?')) return; try { await api(`/api/events/${encodeURIComponent(id)}`,{method:'DELETE'}); editor.classList.add('hidden'); await loadEvents(); } catch(error){ message(editor,error.message); } });
$('#logout').addEventListener('click',async()=>{ await api('/api/admin/logout',{method:'POST',body:'{}'}); location.reload(); });
api('/api/admin/session').then(data=>{csrf=data.csrf;showDashboard();}).catch(()=>{});
