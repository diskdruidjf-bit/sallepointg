const JSON_HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' };

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

export function eventFromRow(row) {
  if (!row) return null;
  return { ...row, published: Boolean(row.published), externalOrganizer: Boolean(row.externalOrganizer) };
}

export function cleanEvent(input, existing = {}) {
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

export async function requestBody(request) {
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 12 * 1024 * 1024) throw new Error('Requête trop volumineuse.');
  return request.json();
}

export async function eventRequest(request) {
  const contentType = request.headers.get('content-type') || '';
  if (!contentType.toLowerCase().startsWith('multipart/form-data')) {
    const input = await requestBody(request);
    const image = input.imageUpload || null;
    delete input.imageUpload;
    return { input, image };
  }
  const length = Number(request.headers.get('content-length') || 0);
  if (length > 9 * 1024 * 1024) throw new Error('L’image dépasse la limite de 8 Mo.');
  const form = await request.formData();
  const serialized = form.get('event');
  if (typeof serialized !== 'string') throw new Error('Données d’événement manquantes.');
  let input;
  try { input = JSON.parse(serialized); } catch { throw new Error('Données d’événement invalides.'); }
  const candidate = form.get('image');
  const image = candidate && typeof candidate === 'object' && typeof candidate.arrayBuffer === 'function' && candidate.size > 0 ? candidate : null;
  return { input, image };
}

export async function storeEventImage(env, file) {
  if (!env.EVENT_IMAGES) throw new Error('Le stockage des images n’est pas configuré.');
  let bytes; let type;
  if (file && typeof file.arrayBuffer === 'function') {
    if (file.size > 8 * 1024 * 1024) throw new Error('L’image dépasse la limite de 8 Mo.');
    bytes = new Uint8Array(await file.arrayBuffer()); type = file.type;
  } else {
    type = String(file?.type || '');
    const encoded = String(file?.data || '');
    if (!encoded || encoded.length > 11 * 1024 * 1024 || !/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)) throw new Error('Données d’image invalides.');
    try { bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0)); } catch { throw new Error('Données d’image invalides.'); }
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error('L’image dépasse la limite de 8 Mo.');
  }
  const info = imageUploadInfo(bytes, type);
  const key = `${crypto.randomUUID()}.${info.extension}`;
  await env.EVENT_IMAGES.put(key, bytes, { httpMetadata: { contentType: info.contentType } });
  return `/media/${key}`;
}

export function tokenFromRequest(request) {
  return /(?:^|;\s*)spg_session=([^;]+)/.exec(request.headers.get('cookie') || '')?.[1] || '';
}

export async function getSession(request, env) {
  const token = tokenFromRequest(request);
  if (!token) return null;
  const record = await env.DB.prepare('SELECT token, csrf, expires_at FROM sessions WHERE token = ? AND expires_at > ?').bind(token, Date.now()).first();
  return record ? { token: record.token, csrf: record.csrf } : null;
}

export async function requireAdmin(context) {
  const session = await getSession(context.request, context.env);
  if (!session || context.request.headers.get('x-csrf-token') !== session.csrf) return { error: json({ error: 'Accès refusé.' }, 403) };
  return { session };
}

export async function secureEqual(provided, expected) {
  const encoder = new TextEncoder();
  const [a, b] = await Promise.all([crypto.subtle.digest('SHA-256', encoder.encode(provided)), crypto.subtle.digest('SHA-256', encoder.encode(expected))]);
  const left = new Uint8Array(a); const right = new Uint8Array(b); let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
}

export function randomToken(bytes = 32) {
  const values = new Uint8Array(bytes); crypto.getRandomValues(values);
  return Array.from(values, value => value.toString(16).padStart(2, '0')).join('');
}

export function imageUploadInfo(bytes, contentType) {
  const type = String(contentType || '').toLowerCase().split(';')[0].trim();
  const signatures = {
    'image/jpeg': { extension: 'jpg', valid: bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff },
    'image/png': { extension: 'png', valid: bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a },
    'image/webp': { extension: 'webp', valid: String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP' }
  };
  const match = signatures[type];
  if (!match || !match.valid) throw new Error('Le fichier doit être une image JPEG, PNG ou WebP valide.');
  return { contentType: type, extension: match.extension };
}

export function logError(error, request) {
  console.error(JSON.stringify({ message: 'request failed', path: new URL(request.url).pathname, error: error instanceof Error ? error.message : String(error) }));
}
