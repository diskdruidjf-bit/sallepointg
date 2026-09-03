'use strict';

const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = __dirname;
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

function imageUploadInfo(bytes, contentType) {
  const type = String(contentType || '').toLowerCase().split(';')[0].trim();
  const signatures = {
    'image/jpeg': { extension: 'jpg', valid: bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
    'image/png': { extension: 'png', valid: bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a },
    'image/webp': { extension: 'webp', valid: bytes.subarray(0, 4).toString() === 'RIFF' && bytes.subarray(8, 12).toString() === 'WEBP' }
  };
  const match = signatures[type];
  if (!match || !match.valid) throw new Error('Le fichier doit être une image JPEG, PNG ou WebP valide.');
  return { contentType: type, extension: match.extension };
}

function cleanEvent(input, existing = {}) {
  const text = (name, max = 5000) => String(input[name] ?? existing[name] ?? '').trim().slice(0, max);
  const title = text('title', 140);
  const slugSource = text('slug', 100) || title;
  const slug = slugSource.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const ticketType = ['eventbrite','external','none'].includes(input.ticketType) ? input.ticketType : (existing.ticketType || 'eventbrite');
  const ticketUrl = text('ticketUrl', 1000);
  const event = {
    id: existing.id || crypto.randomUUID(), slug, title,
    summary: text('summary', 300), description: text('description'),
    date: text('date', 30), location: text('location', 200),
    image: text('image', 500) || '/assets/point-g-salle.jpg',
    eventbriteId: text('eventbriteId', 30), ticketType, ticketUrl, organizer: text('organizer', 160) || 'Salle Point G', externalOrganizer: input.externalOrganizer === true, published: input.published === true
  };
  if (!event.title || !event.slug || !event.organizer || Number.isNaN(Date.parse(event.date))) throw new Error('Titre, organisateur et date valide sont requis.');
  if (ticketType === 'eventbrite' && !/^\d{10,20}$/.test(event.eventbriteId)) throw new Error('Un identifiant Eventbrite valide est requis.');
  if (ticketType === 'external') { try { if (new URL(ticketUrl).protocol !== 'https:') throw new Error(); } catch { throw new Error('Une adresse HTTPS de billetterie valide est requise.'); } }
  return event;
}

function createApp(options = {}) {
  const root = options.root || ROOT;
  const dataFile = options.dataFile || path.join(root, 'data/events.json');
  const uploadDir = options.uploadDir || path.join(root, 'media');
  const password = options.adminPassword || process.env.ADMIN_PASSWORD;
  const sessions = new Map();

  async function readEvents() { return JSON.parse(await fs.readFile(dataFile, 'utf8')); }
  async function writeEvents(events) {
    const temp = `${dataFile}.${process.pid}.tmp`;
    await fs.writeFile(temp, `${JSON.stringify(events, null, 2)}\n`);
    await fs.rename(temp, dataFile);
  }
  function json(res, status, body, headers = {}) {
    res.writeHead(status, { 'content-type': MIME['.json'], 'cache-control': 'no-store', ...headers });
    res.end(JSON.stringify(body));
  }
  function session(req) {
    const token = /(?:^|;\s*)spg_session=([^;]+)/.exec(req.headers.cookie || '')?.[1];
    const record = token && sessions.get(token);
    if (!record || record.expires < Date.now()) return null;
    return { token, ...record };
  }
  async function body(req) {
    let raw = '';
    for await (const chunk of req) { raw += chunk; if (raw.length > 12 * 1024 * 1024) throw new Error('Requête trop volumineuse.'); }
    return JSON.parse(raw || '{}');
  }
  async function binaryBody(req, maxSize = 8 * 1024 * 1024) {
    const chunks = []; let size = 0;
    for await (const chunk of req) { size += chunk.length; if (size > maxSize) throw new Error('L’image dépasse la limite de 8 Mo.'); chunks.push(chunk); }
    return Buffer.concat(chunks);
  }
  async function eventBody(req, existing = {}) {
    const contentType = String(req.headers['content-type'] || '');
    if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
      const input = await body(req); const upload = input.imageUpload; delete input.imageUpload;
      const event = cleanEvent(input, existing);
      if (upload) {
        const encoded=String(upload.data||'');
        if (!encoded || encoded.length > 11 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('Données d’image invalides.');
        const bytes=Buffer.from(encoded,'base64');
        if (bytes.length > 8 * 1024 * 1024) throw new Error('L’image dépasse la limite de 8 Mo.');
        const {extension}=imageUploadInfo(bytes,upload.type); const key=`${crypto.randomUUID()}.${extension}`;
        await fs.mkdir(uploadDir,{recursive:true}); await fs.writeFile(path.join(uploadDir,key),bytes); event.image=`/media/${key}`;
      }
      return event;
    }
    const raw = await binaryBody(req, 9 * 1024 * 1024);
    const form = await new Request('http://localhost/event', { method:'POST', headers:{ 'content-type':contentType }, body:raw }).formData();
    const serialized = form.get('event');
    if (typeof serialized !== 'string') throw new Error('Données d’événement manquantes.');
    let input;
    try { input = JSON.parse(serialized); } catch { throw new Error('Données d’événement invalides.'); }
    const event = cleanEvent(input, existing);
    const image = form.get('image');
    if (image && typeof image === 'object' && image.size > 0) {
      if (image.size > 8 * 1024 * 1024) throw new Error('L’image dépasse la limite de 8 Mo.');
      const bytes = Buffer.from(await image.arrayBuffer());
      const { extension } = imageUploadInfo(bytes, image.type);
      const key = `${crypto.randomUUID()}.${extension}`;
      await fs.mkdir(uploadDir, { recursive:true });
      await fs.writeFile(path.join(uploadDir, key), bytes);
      event.image = `/media/${key}`;
    }
    return event;
  }
  async function serve(res, file) {
    const resolved = path.resolve(root, file.replace(/^\/+/, ''));
    if (!resolved.startsWith(`${path.resolve(root)}${path.sep}`)) return json(res, 403, { error: 'Accès refusé.' });
    try {
      const content = await fs.readFile(resolved);
      res.writeHead(200, { 'content-type': MIME[path.extname(resolved)] || 'application/octet-stream', 'x-content-type-options': 'nosniff', 'referrer-policy': 'origin-when-cross-origin' });
      res.end(content);
    } catch { json(res, 404, { error: 'Page introuvable.' }); }
  }

  return http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname === '/api/events' && req.method === 'GET') {
        const events = await readEvents();
        return json(res, 200, session(req) ? events : events.filter(event => event.published));
      }
      if (url.pathname.startsWith('/api/events/') && req.method === 'GET') {
        const key = decodeURIComponent(url.pathname.slice(12));
        const event = (await readEvents()).find(item => item.id === key || item.slug === key);
        if (!event || (!event.published && !session(req))) return json(res, 404, { error: 'Événement introuvable.' });
        return json(res, 200, event);
      }
      if (url.pathname === '/api/admin/login' && req.method === 'POST') {
        if (!password) return json(res, 503, { error: 'ADMIN_PASSWORD doit être configuré sur le serveur.' });
        const supplied = String((await body(req)).password || '');
        const suppliedHash = crypto.createHash('sha256').update(supplied).digest();
        const passwordHash = crypto.createHash('sha256').update(password).digest();
        const valid = crypto.timingSafeEqual(suppliedHash, passwordHash);
        if (!valid) return json(res, 401, { error: 'Mot de passe incorrect.' });
        const token = crypto.randomBytes(32).toString('base64url');
        const csrf = crypto.randomBytes(24).toString('base64url');
        sessions.set(token, { csrf, expires: Date.now() + 8 * 60 * 60 * 1000 });
        return json(res, 200, { csrf }, { 'set-cookie': `spg_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800` });
      }
      if (url.pathname === '/api/admin/session' && req.method === 'GET') {
        const active = session(req);
        return active ? json(res, 200, { authenticated: true, csrf: active.csrf }) : json(res, 401, { authenticated: false });
      }
      if (url.pathname === '/api/admin/logout' && req.method === 'POST') {
        const active = session(req); if (active) sessions.delete(active.token);
        return json(res, 200, { ok: true }, { 'set-cookie': 'spg_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0' });
      }
      if (url.pathname === '/api/admin/images' && req.method === 'POST') {
        const active = session(req);
        if (!active || req.headers['x-csrf-token'] !== active.csrf) return json(res, 403, { error: 'Accès refusé.' });
        const image = await binaryBody(req); const { extension } = imageUploadInfo(image, req.headers['content-type']);
        const key = `${crypto.randomUUID()}.${extension}`; await fs.mkdir(uploadDir, { recursive:true }); await fs.writeFile(path.join(uploadDir, key), image);
        return json(res, 201, { url:`/media/${key}` });
      }
      if (url.pathname === '/api/events' && req.method === 'POST') {
        const active = session(req);
        if (!active || req.headers['x-csrf-token'] !== active.csrf) return json(res, 403, { error: 'Accès refusé.' });
        const events = await readEvents(); const event = await eventBody(req);
        if (events.some(item => item.slug === event.slug)) return json(res, 409, { error: 'Cette adresse d’événement existe déjà.' });
        if (event.image === '/assets/point-g-salle.jpg') return json(res, 400, { error: 'Sélectionnez une image pour cet événement.' });
        events.push(event); await writeEvents(events); return json(res, 201, event);
      }
      if (url.pathname.startsWith('/api/events/') && ['PUT', 'DELETE'].includes(req.method)) {
        const active = session(req);
        if (!active || req.headers['x-csrf-token'] !== active.csrf) return json(res, 403, { error: 'Accès refusé.' });
        const id = decodeURIComponent(url.pathname.slice(12)); const events = await readEvents();
        const index = events.findIndex(item => item.id === id);
        if (index < 0) return json(res, 404, { error: 'Événement introuvable.' });
        if (req.method === 'DELETE') { events.splice(index, 1); await writeEvents(events); return json(res, 200, { ok: true }); }
        const event = await eventBody(req, events[index]);
        if (events.some((item, i) => i !== index && item.slug === event.slug)) return json(res, 409, { error: 'Cette adresse d’événement existe déjà.' });
        if (event.image === '/assets/point-g-salle.jpg') return json(res, 400, { error: 'Sélectionnez une image pour cet événement.' });
        events[index] = event; await writeEvents(events); return json(res, 200, event);
      }
      if (url.pathname === '/events' || url.pathname === '/events/' || url.pathname === '/events.html') {
        res.writeHead(301, { location: '/evenements' });
        return res.end();
      }
      if (url.pathname === '/evenements' || url.pathname === '/evenements/') return serve(res, 'evenements.html');
      if (url.pathname.startsWith('/evenements/')) return serve(res, 'event.html');
      if (url.pathname === '/location-salle-saint-jerome' || url.pathname === '/location-salle-saint-jerome/') return serve(res, 'location-salle-saint-jerome.html');
      if (url.pathname === '/admin' || url.pathname === '/admin/') return serve(res, 'admin.html');
      return serve(res, url.pathname === '/' ? 'index.html' : url.pathname);
    } catch (error) { json(res, 400, { error: error.message || 'Requête invalide.' }); }
  });
}

if (require.main === module) {
  const port = Number(process.env.PORT) || 3000;
  createApp().listen(port, () => console.log(`Salle Point G : http://localhost:${port}`));
}

module.exports = { createApp, cleanEvent, imageUploadInfo };
