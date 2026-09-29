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

export async function sha256(value) {
  const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value)));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
}

export function clientIp(request) { return request.headers.get('cf-connecting-ip') || ''; }
export function escapeHtml(value) { return String(value??'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character])); }

export async function sendEmail(env, { to, subject, html, attachments = [] }) {
  if (!env.RESEND_API_KEY || !env.SIGNATURE_FROM_EMAIL) throw new Error('Configurez RESEND_API_KEY et SIGNATURE_FROM_EMAIL dans Cloudflare.');
  const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{authorization:`Bearer ${env.RESEND_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({from:env.SIGNATURE_FROM_EMAIL,to:Array.isArray(to)?to:[to],subject,html,attachments})});
  if(!response.ok){const data=await response.json().catch(()=>({}));throw new Error(data.message||'Le courriel de signature n’a pas pu être envoyé.');}
  return response.json();
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

const CONTRACT_STATUSES = ['submitted', 'approved', 'sent', 'client_signed', 'signed', 'declined', 'cancelled'];

export function dateMinusDays(value, days) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || ''));
  if (!match) return '';
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

export function cleanContract(input, existing = {}) {
  const text = (name, max = 3000) => String(input[name] ?? existing[name] ?? '').trim().slice(0, max);
  const bool = name => input[name] === true || input[name] === 'true' || input[name] === 'on' || (input[name] == null && Boolean(existing[name]));
  const eventDate = text('eventDate', 10);
  const contract = {
    id: existing.id || crypto.randomUUID(), status: CONTRACT_STATUSES.includes(input.status) ? input.status : (existing.status || 'submitted'),
    tenantName: text('tenantName', 180), tenantAddress: text('tenantAddress', 500), tenantEmail: text('tenantEmail', 254).toLowerCase(), tenantPhone: text('tenantPhone', 40), tenantNeq: text('tenantNeq', 20),
    eventDate, eventType: text('eventType', 300), minorsPresent: bool('minorsPresent'), minorsCount: text('minorsCount', 4), accessTime: text('accessTime', 5), guestTime: text('guestTime', 5),
    roomPrice: text('roomPrice', 30), roomTaxes: text('roomTaxes', 30), deposit: text('deposit', 100), roomBalance: text('roomBalance', 100), securityDeposit: text('securityDeposit', 30),
    mealPlan: text('mealPlan', 1000), mealCount: text('mealCount', 5), mealDeadline: dateMinusDays(eventDate, 7), mealPayment: ['guests','tenant','other'].includes(input.mealPayment) ? input.mealPayment : (existing.mealPayment || 'guests'), mealAllocation: text('mealAllocation', 500),
    beveragePayment: ['guests','tenant','limit','quantity'].includes(input.beveragePayment) ? input.beveragePayment : (existing.beveragePayment || 'guests'), beverageTerms: text('beverageTerms', 500), otherPurchases: text('otherPurchases', 500),
    onsiteContact: text('onsiteContact', 180), onsitePhone: text('onsitePhone', 40), notes: text('notes', 2000),
    locatorName: text('locatorName', 180), locatorEmail: text('locatorEmail', 254).toLowerCase(), accepted: bool('accepted'),
    signatureRequestId: existing.signatureRequestId || '', signedFileKey: existing.signedFileKey || ''
  };
  if (!contract.tenantName || !contract.tenantAddress || !contract.tenantEmail || !contract.tenantPhone || !contract.eventDate || !contract.eventType || !contract.accessTime || !contract.guestTime || !contract.onsiteContact || !contract.onsitePhone) throw new Error('Veuillez remplir tous les champs obligatoires.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contract.tenantEmail)) throw new Error('L’adresse courriel du locataire est invalide.');
  if (Number.isNaN(Date.parse(`${contract.eventDate}T12:00:00Z`))) throw new Error('La date de l’événement est invalide.');
  if (contract.minorsPresent && (!/^\d{1,4}$/.test(contract.minorsCount) || Number(contract.minorsCount) < 1)) throw new Error('Indiquez le nombre approximatif de personnes mineures.');
  if (!contract.accepted) throw new Error('Le locataire doit confirmer avoir lu et accepté les conditions.');
  return contract;
}

export function contractFromRow(row) {
  if (!row) return null;
  return {
    id: row.id, status: row.status, tenantName: row.tenant_name, tenantAddress: row.tenant_address, tenantEmail: row.tenant_email, tenantPhone: row.tenant_phone, tenantNeq: row.tenant_neq,
    eventDate: row.event_date, eventType: row.event_type, minorsPresent: Boolean(row.minors_present), minorsCount: row.minors_count, accessTime: row.access_time, guestTime: row.guest_time,
    roomPrice: row.room_price, roomTaxes: row.room_taxes, deposit: row.deposit, roomBalance: row.room_balance, securityDeposit: row.security_deposit,
    mealPlan: row.meal_plan, mealCount: row.meal_count, mealDeadline: row.meal_deadline, mealPayment: row.meal_payment, mealAllocation: row.meal_allocation,
    beveragePayment: row.beverage_payment, beverageTerms: row.beverage_terms, otherPurchases: row.other_purchases, onsiteContact: row.onsite_contact, onsitePhone: row.onsite_phone, notes: row.notes,
    locatorName: row.locator_name, locatorEmail: row.locator_email, accepted: Boolean(row.accepted), signatureRequestId: row.signature_request_id || '', signedFileKey: row.signed_file_key || '',
    submittedAt: row.submitted_at, updatedAt: row.updated_at, sentAt: row.sent_at, signedAt: row.signed_at
  };
}

export const CONTRACT_COLUMNS = ['id','status','tenant_name','tenant_address','tenant_email','tenant_phone','tenant_neq','event_date','event_type','minors_present','minors_count','access_time','guest_time','room_price','room_taxes','deposit','room_balance','security_deposit','meal_plan','meal_count','meal_deadline','meal_payment','meal_allocation','beverage_payment','beverage_terms','other_purchases','onsite_contact','onsite_phone','notes','locator_name','locator_email','accepted'];

export function contractValues(contract) {
  return [contract.id,contract.status,contract.tenantName,contract.tenantAddress,contract.tenantEmail,contract.tenantPhone,contract.tenantNeq,contract.eventDate,contract.eventType,contract.minorsPresent?1:0,contract.minorsCount,contract.accessTime,contract.guestTime,contract.roomPrice,contract.roomTaxes,contract.deposit,contract.roomBalance,contract.securityDeposit,contract.mealPlan,contract.mealCount,contract.mealDeadline,contract.mealPayment,contract.mealAllocation,contract.beveragePayment,contract.beverageTerms,contract.otherPurchases,contract.onsiteContact,contract.onsitePhone,contract.notes,contract.locatorName,contract.locatorEmail,contract.accepted?1:0];
}

export function contractSigningSnapshot(contract) {
  const { status, signatureRequestId, signedFileKey, submittedAt, updatedAt, sentAt, signedAt, ...terms }=contract;
  return { template:'contrat-location-template-v1', ...terms };
}
