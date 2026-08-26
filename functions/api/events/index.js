import { cleanEvent, eventFromRow, eventRequest, getSession, json, logError, requireAdmin, storeEventImage } from '../../_lib.js';

export async function onRequestGet(context) {
  try {
    const admin = await getSession(context.request, context.env);
    const query = admin ? 'SELECT * FROM events ORDER BY date ASC' : 'SELECT * FROM events WHERE published = 1 ORDER BY date ASC';
    const result = await context.env.DB.prepare(query).all();
    return json(result.results.map(eventFromRow));
  } catch (error) { logError(error, context.request); return json({ error: 'Les événements sont temporairement indisponibles.' }, 500); }
}

export async function onRequestPost(context) {
  try {
    const auth = await requireAdmin(context); if (auth.error) return auth.error;
    const { input, image } = await eventRequest(context.request);
    const event = cleanEvent(input);
    const duplicate = await context.env.DB.prepare('SELECT id FROM events WHERE slug = ?').bind(event.slug).first();
    if (duplicate) return json({ error: 'Cette adresse d’événement existe déjà.' }, 409);
    if (image) event.image = await storeEventImage(context.env, image);
    if (event.image === '/assets/point-g-salle.jpg') return json({ error: 'Sélectionnez une image pour cet événement.' }, 400);
    await context.env.DB.prepare('INSERT INTO events (id, slug, title, summary, description, date, location, image, eventbriteId, published) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').bind(event.id, event.slug, event.title, event.summary, event.description, event.date, event.location, event.image, event.eventbriteId, event.published ? 1 : 0).run();
    return json(event, 201);
  } catch (error) { logError(error, context.request); return json({ error: error instanceof Error ? error.message : 'Requête invalide.' }, 400); }
}
