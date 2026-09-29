'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('les fonctions Cloudflare normalisent les événements', async () => {
  const { cleanEvent, eventFromRow } = await import('../functions/_lib.js');
  const event = cleanEvent({ title:'Événement spécial', date:'2026-12-20T20:00', eventbriteId:'1998914026663', published:true });
  assert.equal(event.slug, 'evenement-special');
  assert.equal(eventFromRow({ ...event, published:1 }).published, true);
  const external = cleanEvent({ title:'Impro', date:'2026-08-27T20:00', ticketType:'external', ticketUrl:'https://www.experiencesdore.com/product/test', organizer:'Expériences Doré', externalOrganizer:true });
  assert.equal(external.ticketType,'external'); assert.equal(external.eventbriteId,''); assert.equal(external.organizer,'Expériences Doré'); assert.equal(external.externalOrganizer,true);
  assert.throws(()=>cleanEvent({title:'Impro',date:'2026-08-27T20:00',ticketType:'external',ticketUrl:'javascript:alert(1)'}),/HTTPS/);
});

test('la comparaison Cloudflare des secrets est exacte', async () => {
  const { secureEqual } = await import('../functions/_lib.js');
  assert.equal(await secureEqual('secret', 'secret'), true);
  assert.equal(await secureEqual('secret', 'autre'), false);
});

test('valide le contenu réel des images téléversées', async () => {
  const { imageUploadInfo } = await import('../functions/_lib.js');
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
  assert.deepEqual(imageUploadInfo(jpeg, 'image/jpeg'), { contentType:'image/jpeg', extension:'jpg' });
  assert.throws(() => imageUploadInfo(Uint8Array.from([1, 2, 3]), 'image/jpeg'), /image JPEG/);
  assert.throws(() => imageUploadInfo(jpeg, 'text/html'), /image JPEG/);
});

test('reçoit et stocke un événement et son image dans une même requête', async () => {
  const { eventRequest, storeEventImage } = await import('../functions/_lib.js');
  const form = new FormData();
  form.append('event', JSON.stringify({ title:'Avec image', date:'2026-12-20T20:00', eventbriteId:'1998914026663' }));
  form.append('image', new File([Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], 'promo.png', { type:'image/png' }));
  const parsed = await eventRequest(new Request('https://example.test/api/events', { method:'POST', body:form }));
  assert.equal(parsed.input.title, 'Avec image');
  let stored;
  const url = await storeEventImage({ EVENT_IMAGES:{ put:async (...args) => { stored=args; } } }, parsed.image);
  assert.match(url, /^\/media\/[0-9a-f-]{36}\.png$/);
  assert.equal(stored[2].httpMetadata.contentType, 'image/png');
});

test('reçoit une image encodée explicitement en JSON', async () => {
  const { eventRequest, storeEventImage } = await import('../functions/_lib.js');
  const png = Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]);
  const request = new Request('https://example.test/api/events', { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({title:'JSON',imageUpload:{type:'image/png',data:Buffer.from(png).toString('base64')}}) });
  const parsed = await eventRequest(request);
  assert.equal(parsed.input.imageUpload, undefined);
  let stored;
  await storeEventImage({EVENT_IMAGES:{put:async(...args)=>{stored=args;}}},parsed.image);
  assert.equal(stored[1].byteLength,8); assert.equal(stored[2].httpMetadata.contentType,'image/png');
});

test('valide le contrat et calcule la date limite des repas côté serveur', async () => {
  const { cleanContract, dateMinusDays } = await import('../functions/_lib.js');
  assert.equal(dateMinusDays('2026-12-01', 7), '2026-11-24');
  const contract=cleanContract({tenantName:'Client Test',tenantAddress:'1, rue Test',tenantEmail:'client@example.com',tenantPhone:'450 555-0101',eventDate:'2026-12-01',eventType:'Réception privée',accessTime:'17:00',guestTime:'18:00',onsiteContact:'Client Test',onsitePhone:'450 555-0101',accepted:true,mealDeadline:'2099-01-01'});
  assert.equal(contract.mealDeadline,'2026-11-24'); assert.equal(contract.status,'submitted');
  assert.throws(()=>cleanContract({...contract,accepted:false}),/confirmer/);
});
