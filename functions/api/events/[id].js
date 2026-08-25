import { cleanEvent, eventFromRow, getSession, json, logError, requestBody, requireAdmin } from '../../_lib.js';

export async function onRequestGet(context) {
  try {
    const key = String(context.params.id);
    const event = eventFromRow(await context.env.DB.prepare('SELECT * FROM events WHERE id = ? OR slug = ?').bind(key, key).first());
    if (!event || (!event.published && !(await getSession(context.request, context.env)))) return json({ error: 'Événement introuvable.' }, 404);
    return json(event);
  } catch (error) { logError(error, context.request); return json({ error: 'Événement introuvable.' }, 500); }
}

export async function onRequestPut(context) {
  try {
    const auth = await requireAdmin(context); if (auth.error) return auth.error;
    const id = String(context.params.id); const current = eventFromRow(await context.env.DB.prepare('SELECT * FROM events WHERE id = ?').bind(id).first());
    if (!current) return json({ error: 'Événement introuvable.' }, 404);
    const event = cleanEvent(await requestBody(context.request), current);
    const duplicate = await context.env.DB.prepare('SELECT id FROM events WHERE slug = ? AND id != ?').bind(event.slug, id).first();
    if (duplicate) return json({ error: 'Cette adresse d’événement existe déjà.' }, 409);
    await context.env.DB.prepare('UPDATE events SET slug=?, title=?, summary=?, description=?, date=?, location=?, image=?, eventbriteId=?, published=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(event.slug, event.title, event.summary, event.description, event.date, event.location, event.image, event.eventbriteId, event.published ? 1 : 0, id).run();
    return json(event);
  } catch (error) { logError(error, context.request); return json({ error: error instanceof Error ? error.message : 'Requête invalide.' }, 400); }
}

export async function onRequestDelete(context) {
  try {
    const auth = await requireAdmin(context); if (auth.error) return auth.error;
    const result = await context.env.DB.prepare('DELETE FROM events WHERE id = ?').bind(String(context.params.id)).run();
    return result.meta.changes ? json({ ok: true }) : json({ error: 'Événement introuvable.' }, 404);
  } catch (error) { logError(error, context.request); return json({ error: 'Suppression impossible.' }, 500); }
}
