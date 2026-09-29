import { cleanContract, contractFromRow, CONTRACT_COLUMNS, contractValues, json, logError, requestBody, requireAdmin } from '../../_lib.js';

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
    return json({ ok:true, id:contract.id, mealDeadline:contract.mealDeadline }, 201);
  } catch (error) { logError(error, context.request); return json({ error:error instanceof Error ? error.message : 'Formulaire invalide.' }, 400); }
}
