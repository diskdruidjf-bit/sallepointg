'use strict';
document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/events.css">');
const root = document.querySelector('#event-detail');
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
fetch(`/api/events/${encodeURIComponent(slug)}`).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(event => {
  const date = new Intl.DateTimeFormat('fr-CA', { dateStyle:'full', timeStyle:'short' }).format(new Date(event.date));
  document.title = `${event.title} | Salle Point G`;
  root.innerHTML = `<section class="event-hero" style="--event-image:url('${encodeURI(event.image).replace(/'/g, '%27')}')"><div class="hero-shade"></div><div class="wrap hero-content"><p class="kicker">${escapeHtml(date)}</p><h1>${escapeHtml(event.title)}</h1><p>${escapeHtml(event.summary)}</p></div></section><section class="section"><div class="wrap event-detail-grid"><div><p class="kicker dark">À propos</p><h2>Une soirée<br/><em>à ne pas manquer.</em></h2><p class="event-description">${escapeHtml(event.description)}</p></div><aside><p><b>Date</b><br/>${escapeHtml(date)}</p><p><b>Lieu</b><br/>${escapeHtml(event.location)}</p><button class="button" id="eventbrite-trigger" type="button">Acheter mes billets</button><p class="checkout-note">Le paiement sécurisé s’ouvrira dans une fenêtre Eventbrite.</p></aside></div></section>`;
  const init = () => { if (!window.EBWidgets) return setTimeout(init, 100); window.EBWidgets.createWidget({ widgetType:'checkout', eventId:event.eventbriteId, modal:true, modalTriggerElementId:'eventbrite-trigger', onOrderComplete:() => {} }); };
  init();
}).catch(() => { root.innerHTML = '<section class="page-hero compact"><div class="wrap"><p class="kicker">Erreur 404</p><h1>Événement<br/><em>introuvable.</em></h1><a class="button" href="/evenements">Voir les événements</a></div></section>'; });
