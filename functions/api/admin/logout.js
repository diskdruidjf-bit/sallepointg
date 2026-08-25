import { json, logError, tokenFromRequest } from '../../_lib.js';

export async function onRequestPost(context) {
  try { const token = tokenFromRequest(context.request); if (token) await context.env.DB.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run(); return json({ ok: true }, 200, { 'set-cookie': 'spg_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0' }); }
  catch (error) { logError(error, context.request); return json({ error: 'Déconnexion impossible.' }, 500); }
}
