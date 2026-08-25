import { getSession, json, logError } from '../../_lib.js';

export async function onRequestGet(context) {
  try { const session = await getSession(context.request, context.env); return session ? json({ authenticated: true, csrf: session.csrf }) : json({ authenticated: false }, 401); }
  catch (error) { logError(error, context.request); return json({ authenticated: false }, 401); }
}
