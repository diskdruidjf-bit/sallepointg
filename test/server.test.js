'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createApp, cleanEvent, imageUploadInfo } = require('../server');

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'salle-point-g-'));
  const dataFile = path.join(dir, 'events.json');
  const uploadDir = path.join(dir, 'media');
  await fs.writeFile(dataFile, JSON.stringify([
    { id:'public', slug:'public', title:'Public', summary:'', description:'', date:'2026-10-17T20:00', location:'Salle', image:'/assets/point-g-salle.jpg', eventbriteId:'1998914026663', published:true },
    { id:'draft', slug:'draft', title:'Brouillon', summary:'', description:'', date:'2026-11-17T20:00', location:'Salle', image:'/assets/point-g-salle.jpg', eventbriteId:'1998914026663', published:false }
  ]));
  const server = createApp({ root:path.resolve(__dirname, '..'), dataFile, uploadDir, adminPassword:'secret-test' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { base, dataFile, uploadDir };
}

test('valide et normalise un événement', () => {
  const event = cleanEvent({ title:'Soirée d’été', date:'2026-08-30T19:30', eventbriteId:'1998914026663', published:true });
  assert.equal(event.slug, 'soiree-d-ete'); assert.equal(event.published, true);
  const external=cleanEvent({title:'Impro',date:'2026-08-27T20:00',ticketType:'external',ticketUrl:'https://www.experiencesdore.com/product/test',organizer:'Expériences Doré',externalOrganizer:true});
  assert.equal(external.ticketType,'external'); assert.equal(external.organizer,'Expériences Doré'); assert.equal(external.externalOrganizer,true);
  assert.throws(() => cleanEvent({ title:'Invalide', date:'x', eventbriteId:'abc' }));
});

test('valide la signature des images', () => {
  assert.equal(imageUploadInfo(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg').extension, 'jpg');
  assert.throws(() => imageUploadInfo(Buffer.from('<script>'), 'image/jpeg'), /image JPEG/);
});

test('l’API publique masque les brouillons', async t => {
  const { base } = await fixture(t);
  const events = await (await fetch(`${base}/api/events`)).json();
  assert.deepEqual(events.map(event => event.id), ['public']);
  assert.equal((await fetch(`${base}/api/events/draft`)).status, 404);
});

test('l’administration exige une session et permet le CRUD', async t => {
  const { base, uploadDir } = await fixture(t);
  assert.equal((await fetch(`${base}/api/events/public`, { method:'DELETE' })).status, 403);
  assert.equal((await fetch(`${base}/api/admin/login`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({password:'faux'}) })).status, 401);
  const login = await fetch(`${base}/api/admin/login`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({password:'secret-test'}) });
  const cookie = login.headers.get('set-cookie').split(';')[0]; const { csrf } = await login.json();
  const headers = { cookie, 'content-type':'application/json', 'x-csrf-token':csrf };
  const imageResponse = await fetch(`${base}/api/admin/images`, { method:'POST', headers:{ cookie, 'content-type':'image/jpeg', 'x-csrf-token':csrf }, body:Buffer.from([0xff, 0xd8, 0xff, 0xe0]) });
  assert.equal(imageResponse.status, 201); const uploaded = await imageResponse.json();
  assert.match(uploaded.url, /^\/media\/[0-9a-f-]{36}\.jpg$/);
  assert.equal((await fs.stat(path.join(uploadDir, path.basename(uploaded.url)))).size, 4);
  const encodedPng = Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]).toString('base64');
  const createdResponse = await fetch(`${base}/api/events`, { method:'POST', headers, body:JSON.stringify({ title:'Nouveau', date:'2026-12-01T19:00', eventbriteId:'1998914026663', published:false, imageUpload:{type:'image/png',data:encodedPng} }) });
  assert.equal(createdResponse.status, 201); const created = await createdResponse.json();
  assert.match(created.image, /^\/media\/[0-9a-f-]{36}\.png$/);
  const privateEvents = await (await fetch(`${base}/api/events`, {headers:{cookie}})).json();
  assert.equal(privateEvents.length, 3);
  const updated = await fetch(`${base}/api/events/${created.id}`, { method:'PUT', headers, body:JSON.stringify({...created, title:'Nouveau titre', published:true}) });
  assert.equal(updated.status, 200); assert.equal((await updated.json()).title, 'Nouveau titre');
  const payload = new FormData();
  payload.append('event', JSON.stringify({...created, title:'Avec image PNG', published:true}));
  payload.append('image', new File([Uint8Array.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a])], 'promo.png', {type:'image/png'}));
  const unified = await fetch(`${base}/api/events/${created.id}`, { method:'PUT', headers:{cookie,'x-csrf-token':csrf}, body:payload });
  assert.equal(unified.status, 200); const unifiedEvent = await unified.json();
  assert.equal(unifiedEvent.title, 'Avec image PNG'); assert.match(unifiedEvent.image, /^\/media\/[0-9a-f-]{36}\.png$/);
  assert.equal((await fs.stat(path.join(uploadDir, path.basename(unifiedEvent.image)))).size, 8);
  assert.equal((await fetch(`${base}/api/events/${created.id}`, { method:'DELETE', headers })).status, 200);
});

test('sert les pages publiques et privées', async t => {
  const { base } = await fixture(t);
  const oldEventsUrl = await fetch(`${base}/events`, { redirect:'manual' });
  assert.equal(oldEventsUrl.status, 301);
  assert.equal(oldEventsUrl.headers.get('location'), '/evenements');
  assert.match(await (await fetch(`${base}/evenements`)).text(), /Nos<br\/><em>événements/);
  const locationPage = await (await fetch(`${base}/location-salle-saint-jerome`)).text();
  assert.match(locationPage, /Location de salle privée/);
  assert.match(locationPage, /Questions fréquentes/);
  const contractPage = await (await fetch(`${base}/contrat-location`)).text();
  assert.match(contractPage, /Contrat de/); assert.match(contractPage, /Tolérance zéro/); assert.match(contractPage, /sept jours avant/);
  const signaturePage = await (await fetch(`${base}/signature?token=test`)).text();
  assert.match(signaturePage, /Signature électronique/); assert.match(signaturePage, /adresse IP/); assert.match(signaturePage, /signature\.js/);
  assert.match(await (await fetch(`${base}/evenements/public`)).text(), /event-detail/);
  const admin = await (await fetch(`${base}/admin`)).text();
  assert.match(admin, /Administration/);
  assert.match(admin, /Sélectionnez l’image, puis cliquez sur « Enregistrer »/);
  assert.match(await fs.readFile(path.resolve(__dirname, '../js/admin.js'), 'utf8'), /imageFile\.required = editor\.elements\.image\.value/);
  assert.match(await fs.readFile(path.resolve(__dirname, '../events.css'), 'utf8'), /page-hero[^}]+point-g-salle\.jpg/);
  assert.match(admin, /Administration/);
  const home = await (await fetch(`${base}/`)).text();
  assert.match(home, /id="event-popup"/); assert.match(home, /home-event-popup\.js/); assert.match(home, /eb_widgets\.js/);
  assert.match(home, /mobile-menu-toggle/); assert.match(home, /mobile-nav\.js/);
  const popupScript = await fs.readFile(path.resolve(__dirname, '../js/home-event-popup.js'), 'utf8');
  assert.match(popupScript, /jeudis-humour-popup\.png/); assert.match(popupScript, /external-ticket-trigger/);
  assert.match(popupScript, /api\/events\/soireehumourpointg011026/); assert.match(popupScript, /Nos autres événements/);
  assert.match(admin, /Billetterie externe/); assert.match(admin, /Événement organisé par un tiers/);
  assert.match(admin, /Envoyer pour signature/); assert.match(admin, /id="contracts-panel"/);
  const migration=await fs.readFile(path.resolve(__dirname, '../migrations/0002_ticketing_options.sql'),'utf8'); assert.match(migration,/ticketType/); assert.match(migration,/externalOrganizer/);
  assert.match(await fs.readFile(path.resolve(__dirname, '../js/event.js'),'utf8'), /agit uniquement comme lieu d’accueil/);
});
