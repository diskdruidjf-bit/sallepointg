const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

test('Cloudflare Pages redirige seulement les anciennes URL anglaises', async () => {
  const redirects = (await readFile(path.join(__dirname, '..', '_redirects'), 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  assert.deepEqual(redirects, [
    '/events /evenements 301',
    '/events/ /evenements 301',
    '/events.html /evenements 301',
  ]);
});

test('la route dynamique conserve le slug tout en servant la fiche statique', async () => {
  const { onRequest } = await import('../functions/evenements/[slug].js');
  let fetched;
  const response = new Response('<main id="event-detail"></main>', { headers:{ 'content-type':'text/html' } });
  const result = await onRequest({
    request:new Request('https://example.com/evenements/soiree-test'),
    env:{ ASSETS:{ fetch(request) { fetched = request; return response; } } }
  });
  assert.equal(new URL(fetched.url).pathname, '/event');
  assert.equal(result, response);
});
