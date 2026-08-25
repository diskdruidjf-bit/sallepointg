'use strict';
document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/events.css">');
document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/event-images.css">');
const list = document.querySelector('#event-list');
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
const formatDate = value => new Intl.DateTimeFormat('fr-CA', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value));
fetch('/api/events').then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(events => {
  if (!events.length) { list.innerHTML = '<p>Aucun événement n’est annoncé pour le moment.</p>'; return; }
  list.innerHTML = events.sort((a,b) => new Date(a.date)-new Date(b.date)).map(event => `<article class="event-card"><a href="/evenements/${encodeURIComponent(event.slug)}"><img src="${escapeHtml(event.image)}" alt=""/><div><p class="kicker dark">${escapeHtml(formatDate(event.date))}</p><h2>${escapeHtml(event.title)}</h2><p>${escapeHtml(event.summary)}</p><span class="text-link">Voir l’événement →</span></div></a></article>`).join('');
}).catch(() => { list.innerHTML = '<p>Les événements sont temporairement indisponibles.</p>'; });
