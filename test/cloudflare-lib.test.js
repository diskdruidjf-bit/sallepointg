'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

test('les fonctions Cloudflare normalisent les événements', async () => {
  const { cleanEvent, eventFromRow } = await import('../functions/_lib.js');
  const event = cleanEvent({ title:'Événement spécial', date:'2026-12-20T20:00', eventbriteId:'1998914026663', published:true });
  assert.equal(event.slug, 'evenement-special');
  assert.equal(eventFromRow({ ...event, published:1 }).published, true);
});

test('la comparaison Cloudflare des secrets est exacte', async () => {
  const { secureEqual } = await import('../functions/_lib.js');
  assert.equal(await secureEqual('secret', 'secret'), true);
  assert.equal(await secureEqual('secret', 'autre'), false);
});
