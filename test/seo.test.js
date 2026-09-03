const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.join(__dirname, '..');
const read = file => fs.readFile(path.join(root, file), 'utf8');

test('le sitemap contient uniquement les URL publiques canoniques', async () => {
  const sitemap = await read('sitemap.xml');
  assert.match(sitemap, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
  assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match => match[1]), [
    'https://sallepointg.ca/',
    'https://sallepointg.ca/evenements'
  ]);
});

test('robots.txt autorise le site, protège l’administration et déclare le sitemap', async () => {
  const robots = await read('robots.txt');
  assert.match(robots, /^User-agent: \*$/m);
  assert.match(robots, /^Allow: \/$/m);
  assert.match(robots, /^Disallow: \/admin$/m);
  assert.match(robots, /^Sitemap: https:\/\/sallepointg\.ca\/sitemap\.xml$/m);
});

test('les pages SEO principales doivent être revalidées par le navigateur', async () => {
  const headers = await read('_headers');
  for (const route of ['/', '/index.html', '/evenements', '/evenements.html']) {
    assert.ok(headers.includes(`${route}\n  Cache-Control: no-cache, no-store, must-revalidate`));
  }
});

test('les pages publiques principales ont les balises SEO attendues', async () => {
  for (const [file, canonical] of [['index.html', 'https://sallepointg.ca/'], ['evenements.html', 'https://sallepointg.ca/evenements']]) {
    const html = await read(file);
    assert.match(html, /<html lang="fr-CA">/);
    assert.match(html, /<title>[^<]+<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]+"\s*\/>/);
    assert.ok(html.includes(`rel="canonical" href="${canonical}"`));
    assert.match(html, /property="og:title"/);
    assert.match(html, /property="og:description"/);
    assert.match(html, /property="og:image"/);
    assert.match(html, /name="twitter:card" content="summary_large_image"/);
  }
});

test('la page d’accueil cible la location de salle sans changer le slogan visuel', async () => {
  const html = await read('index.html');
  assert.match(html, /<title>Location de salle à Saint-Jérôme \| Salle Point G<\/title>/);
  assert.match(html, /<h1 class="sr-only">Location de salle privée à Saint-Jérôme<\/h1>/);
  assert.match(html, /<div class="hero-title" aria-hidden="true">La salle qui donne<br \/><em>le ton à vos soirées\.<\/em><\/div>/);
  assert.match(html, /name="description" content="[^"]*événements privés[^"]*anniversaires[^"]*événements corporatifs[^"]*"/);
  const structuredData = JSON.parse(html.match(/<script type="application\/ld\+json">\s*([^<]+)\s*<\/script>/)[1]);
  assert.deepEqual(structuredData['@type'], ['LocalBusiness', 'EventVenue']);
  assert.equal(structuredData.name, 'Salle Point G');
  assert.equal(structuredData.url, 'https://sallepointg.ca/');
  assert.equal(structuredData.telephone, '+1-450-436-6446');
  assert.equal(structuredData.address.streetAddress, '99 rue Saint-Georges');
  assert.equal(structuredData.address.addressLocality, 'Saint-Jérôme');
  assert.equal(structuredData.address.addressRegion, 'Québec');
});
