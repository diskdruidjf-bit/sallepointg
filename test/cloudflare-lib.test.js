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

test('valide le contenu réel des images téléversées', async () => {
  const { imageUploadInfo } = await import('../functions/_lib.js');
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
  assert.deepEqual(imageUploadInfo(jpeg, 'image/jpeg'), { contentType:'image/jpeg', extension:'jpg' });
  assert.throws(() => imageUploadInfo(Uint8Array.from([1, 2, 3]), 'image/jpeg'), /image JPEG/);
  assert.throws(() => imageUploadInfo(jpeg, 'text/html'), /image JPEG/);
});
