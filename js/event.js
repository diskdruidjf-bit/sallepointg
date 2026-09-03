'use strict';
document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/events.css">');
document.head.insertAdjacentHTML('beforeend', '<link rel="stylesheet" href="/event-images.css">');
const root = document.querySelector('#event-detail');
const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' })[char]);
const setMeta = (selector, value) => {
  const element = document.head.querySelector(selector);
  if (element) element.setAttribute('content', value);
};
const slug = decodeURIComponent(location.pathname.split('/').filter(Boolean).pop() || '');
fetch(`/api/events/${encodeURIComponent(slug)}`).then(response => { if (!response.ok) throw new Error(); return response.json(); }).then(event => {
  const date = new Intl.DateTimeFormat('fr-CA', { dateStyle:'full', timeStyle:'short' }).format(new Date(event.date));
  const ticketType=event.ticketType||'eventbrite';
  const organizer=event.organizer||'Salle Point G';
  const organizerNotice=event.externalOrganizer?`<div class="organizer-notice"><b>Événement organisé par ${escapeHtml(organizer)}</b><br/>La Salle Point G agit uniquement comme lieu d’accueil. La billetterie, les modifications, les annulations et les remboursements relèvent de l’organisateur.</div>`:`<p><b>Organisateur</b><br/>${escapeHtml(organizer)}</p>`;
  const tickets=ticketType==='external'?`<a class="button" href="${escapeHtml(event.ticketUrl)}" target="_blank" rel="noopener noreferrer">Acheter mes billets</a><p class="checkout-note">Le paiement sera traité sur le site sécurisé de l’organisateur.</p>`:ticketType==='none'?'<p class="checkout-note">Aucune billetterie en ligne pour cet événement.</p>':'<button class="button" id="eventbrite-trigger" type="button">Acheter mes billets</button><p class="checkout-note">Le paiement sécurisé s’ouvrira dans une fenêtre Eventbrite.</p>';
  const pageTitle = `${event.title} | Salle Point G`;
  const description = event.summary || `Découvrez ${event.title}, présenté à la Salle Point G, à Saint-Jérôme.`;
  const canonicalUrl = `https://sallepointg.ca/evenements/${encodeURIComponent(event.slug)}`;
  const imageUrl = new URL(event.image, 'https://sallepointg.ca').href;
  document.title = pageTitle;
  let canonical = document.head.querySelector('link[rel="canonical"]');
  if (!canonical) { canonical = document.createElement('link'); canonical.rel = 'canonical'; document.head.append(canonical); }
  canonical.href = canonicalUrl;
  setMeta('meta[name="description"]', description);
  setMeta('meta[property="og:title"]', pageTitle);
  setMeta('meta[property="og:description"]', description);
  setMeta('meta[property="og:image"]', imageUrl);
  setMeta('meta[property="og:url"]', canonicalUrl);
  setMeta('meta[name="twitter:title"]', pageTitle);
  setMeta('meta[name="twitter:description"]', description);
  setMeta('meta[name="twitter:image"]', imageUrl);
  root.innerHTML = `<section class="event-hero" style="--event-image:url('${encodeURI(event.image).replace(/'/g, '%27')}')"><div class="hero-shade"></div><div class="wrap hero-content"><p class="kicker">${escapeHtml(date)}</p><h1>${escapeHtml(event.title)}</h1><p>${escapeHtml(event.summary)}</p></div></section><section class="section"><div class="wrap event-detail-grid"><div><p class="kicker dark">À propos</p><h2>Une soirée<br/><em>à ne pas manquer.</em></h2><p class="event-description">${escapeHtml(event.description)}</p></div><aside><p><b>Date</b><br/>${escapeHtml(date)}</p><p><b>Lieu</b><br/>${escapeHtml(event.location)}</p>${organizerNotice}${tickets}</aside></div></section>`;
  if(ticketType==='eventbrite'){const init = () => { if (!window.EBWidgets) return setTimeout(init, 100); window.EBWidgets.createWidget({ widgetType:'checkout', eventId:event.eventbriteId, modal:true, modalTriggerElementId:'eventbrite-trigger', onOrderComplete:() => {} }); };init();}
}).catch(() => { root.innerHTML = '<section class="page-hero compact"><div class="wrap"><p class="kicker">Erreur 404</p><h1>Événement<br/><em>introuvable.</em></h1><a class="button" href="/evenements">Voir les événements</a></div></section>'; });
