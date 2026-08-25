import { json, logError, randomToken, requestBody, secureEqual } from '../../_lib.js';

export async function onRequestPost(context) {
  try {
    if (!context.env.ADMIN_PASSWORD) return json({ error: 'ADMIN_PASSWORD doit être configuré dans Cloudflare.' }, 503);
    const supplied = String((await requestBody(context.request)).password || '');
    if (!(await secureEqual(supplied, context.env.ADMIN_PASSWORD))) return json({ error: 'Mot de passe incorrect.' }, 401);
    const token = randomToken(); const csrf = randomToken(24); const expires = Date.now() + 8 * 60 * 60 * 1000;
    await context.env.DB.batch([
      context.env.DB.prepare('DELETE FROM sessions WHERE expires_at <= ?').bind(Date.now()),
      context.env.DB.prepare('INSERT INTO sessions (token, csrf, expires_at) VALUES (?, ?, ?)').bind(token, csrf, expires)
    ]);
    return json({ csrf }, 200, { 'set-cookie': `spg_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=28800` });
  } catch (error) { logError(error, context.request); return json({ error: 'Connexion impossible.' }, 500); }
}
