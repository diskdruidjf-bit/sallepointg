'use strict';
const popup=document.querySelector('#event-popup');
const popupContent=document.querySelector('#event-popup-content');
const popupClose=document.querySelector('.event-popup-close');
const popupEscape=value=>String(value).replace(/[&<>'"]/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'})[character]);
const popupDate=value=>new Intl.DateTimeFormat('fr-CA',{dateStyle:'long',timeStyle:'short'}).format(new Date(value));
function closeEventPopup(){popup.close();sessionStorage.setItem('spg-event-popup-closed','1');}
popupClose.addEventListener('click',closeEventPopup);
popup.addEventListener('click',event=>{if(event.target===popup)closeEventPopup();});
popup.addEventListener('cancel',event=>{event.preventDefault();closeEventPopup();});
if(!sessionStorage.getItem('spg-event-popup-closed'))fetch('/api/events').then(response=>{if(!response.ok)throw new Error();return response.json();}).then(events=>{
  const event=events.filter(item=>new Date(item.date)>=new Date()).sort((left,right)=>new Date(left.date)-new Date(right.date))[0];
  if(!event)return;
  const href=`/evenements/${encodeURIComponent(event.slug)}`;
  popupContent.innerHTML=`<div class="event-popup-grid"><img class="event-popup-image" src="/assets/jeudis-humour-popup.png" alt="Affiche des Jeudis humour à la Salle Point G"/><div class="event-popup-copy"><p class="kicker dark">Prochain événement · ${popupEscape(popupDate(event.date))}</p><h2 id="event-popup-title">${popupEscape(event.title)}</h2><p>${popupEscape(event.summary)}</p><div class="event-popup-actions"><button class="button" id="home-eventbrite-trigger" type="button">Acheter des billets</button><a class="event-popup-link" href="${href}">Voir la fiche →</a></div></div></div>`;
  popup.showModal();
  document.querySelector('#home-eventbrite-trigger').addEventListener('click',closeEventPopup);
  const initialize=()=>{if(!window.EBWidgets)return setTimeout(initialize,100);window.EBWidgets.createWidget({widgetType:'checkout',eventId:event.eventbriteId,modal:true,modalTriggerElementId:'home-eventbrite-trigger',onOrderComplete:()=>{}});};
  initialize();
}).catch(()=>{});
