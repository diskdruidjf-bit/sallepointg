'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { createApp, cleanEvent } = require('../server');

async function fixture(t) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'salle-point-g-'));
  const dataFile = path.join(dir, 'events.json');
  await fs.writeFile(dataFile, JSON.stringify([
    { id:'public', slug:'public', title:'Public', summary:'', description:'', date:'2026-10-17T20:00', location:'Salle', image:'/assets/point-g-salle.jpg', eventbriteId:'1998914026663', published:true },
    { id:'draft', slug:'draft', title:'Brouillon', summary:'', description:'', date:'2026-11-17T20:00', location:'Salle', image:'/assets/point-g-salle.jpg', eventbriteId:'1998914026663', published:false }
  ]));
  const server = createApp({ root:path.resolve(__dirname, '..'), dataFile, adminPassword:'secret-test' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { base, dataFile };
}

test('valide et normalise un événement', () => {
  const event = cleanEvent({ title:'Soirée d’été', date:'2026-08-30T19:30', eventbriteId:'1998914026663', published:true });
  assert.equal(event.slug, 'soiree-d-ete'); assert.equal(event.published, true);
  assert.throws(() => cleanEvent({ title:'Invalide', date:'x', eventbriteId:'abc' }));
});

test('l’API publique masque les brouillons', async t => {
  const { base } = await fixture(t);
  const events = await (await fetch(`${base}/api/events`)).json();
  assert.deepEqual(events.map(event => event.id), ['public']);
  assert.equal((await fetch(`${base}/api/events/draft`)).status, 404);
});

test('l’administration exige une session et permet le CRUD', async t => {
  const { base } = await fixture(t);
  assert.equal((await fetch(`${base}/api/events/public`, { method:'DELETE' })).status, 403);
  assert.equal((await fetch(`${base}/api/admin/login`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({password:'faux'}) })).status, 401);
  const login = await fetch(`${base}/api/admin/login`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({password:'secret-test'}) });
  const cookie = login.headers.get('set-cookie').split(';')[0]; const { csrf } = await login.json();
  const headers = { cookie, 'content-type':'application/json', 'x-csrf-token':csrf };
  const createdResponse = await fetch(`${base}/api/events`, { method:'POST', headers, body:JSON.stringify({ title:'Nouveau', date:'2026-12-01T19:00', eventbriteId:'1998914026663', published:false }) });
  assert.equal(createdResponse.status, 201); const created = await createdResponse.json();
  const privateEvents = await (await fetch(`${base}/api/events`, {headers:{cookie}})).json();
  assert.equal(privateEvents.length, 3);
  const updated = await fetch(`${base}/api/events/${created.id}`, { method:'PUT', headers, body:JSON.stringify({...created, title:'Nouveau titre', published:true}) });
  assert.equal(updated.status, 200); assert.equal((await updated.json()).title, 'Nouveau titre');
  assert.equal((await fetch(`${base}/api/events/${created.id}`, { method:'DELETE', headers })).status, 200);
});

test('sert les pages publiques et privées', async t => {
  const { base } = await fixture(t);
  assert.match(await (await fetch(`${base}/evenements`)).text(), /Nos<br\/><em>événements/);
  assert.match(await (await fetch(`${base}/evenements/public`)).text(), /event-detail/);
  assert.match(await (await fetch(`${base}/admin`)).text(), /Administration/);
});
