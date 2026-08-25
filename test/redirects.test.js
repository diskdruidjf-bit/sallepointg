const assert = require('node:assert/strict');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const test = require('node:test');

test('Cloudflare Pages maps the events list before event detail routes', async () => {
  const redirects = (await readFile(path.join(__dirname, '..', '_redirects'), 'utf8'))
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  assert.deepEqual(redirects.slice(0, 3), [
    '/evenements /events.html 200',
    '/evenements/ /events.html 200',
    '/evenements/* /event.html 200',
  ]);
});
