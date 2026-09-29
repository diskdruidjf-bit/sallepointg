import { cleanContract, contractFromRow, CONTRACT_COLUMNS, contractValues, escapeHtml, json, logError, requestBody, requireAdmin, sendEmail } from '../../_lib.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAdmin(context); if (auth.error) return auth.error;
    const result = await context.env.DB.prepare('SELECT * FROM contracts ORDER BY submitted_at DESC').all();
    return json(result.results.map(contractFromRow));
  } catch (error) { logError(error, context.request); return json({ error:'Les contrats sont temporairement indisponibles.' }, 500); }
}

export async function onRequestPost(context) {
  try {
    const input = await requestBody(context.request);
    if (input.website) return json({ ok:true }, 201);
    const contract = cleanContract(input);
    const placeholders = CONTRACT_COLUMNS.map(() => '?').join(',');
    await context.env.DB.prepare(`INSERT INTO contracts (${CONTRACT_COLUMNS.join(',')}) VALUES (${placeholders})`).bind(...contractValues(contract)).run();
    let notificationSent=true;
    try {
      const base=String(context.env.PUBLIC_SITE_URL||new URL(context.request.url).origin).replace(/\/$/,'');
      await sendEmail(context.env,{
        to:context.env.CONTRACT_NOTIFICATION_EMAIL||'info@stgeorgestaverne.ca',
        subject:`Nouveau contrat à réviser — ${contract.tenantName} — ${contract.eventDate}`,
        html:`<p>Une nouvelle demande de contrat attend votre révision.</p><p><strong>Locataire :</strong> ${escapeHtml(contract.tenantName)}<br><strong>Événement :</strong> ${escapeHtml(contract.eventType)}<br><strong>Date :</strong> ${escapeHtml(contract.eventDate)}<br><strong>Courriel :</strong> ${escapeHtml(contract.tenantEmail)}<br><strong>Téléphone :</strong> ${escapeHtml(contract.tenantPhone)}</p><p><a href="${base}/admin">Ouvrir l’administration des contrats</a></p>`
      });
    } catch (error) {
      notificationSent=false;
      logError(error,context.request);
    }
    return json({ ok:true, id:contract.id, mealDeadline:contract.mealDeadline, notificationSent }, 201);
  } catch (error) { logError(error, context.request); return json({ error:error instanceof Error ? error.message : 'Formulaire invalide.' }, 400); }
}
