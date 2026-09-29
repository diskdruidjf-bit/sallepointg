import { cleanContract, contractFromRow, CONTRACT_COLUMNS, contractValues, json, logError, requireAdmin } from '../../_lib.js';

export async function onRequestGet(context) {
  try {
    const auth = await requireAdmin(context); if (auth.error) return auth.error;
    const contract = contractFromRow(await context.env.DB.prepare('SELECT * FROM contracts WHERE id=?').bind(String(context.params.id)).first());
    return contract ? json(contract) : json({ error:'Contrat introuvable.' }, 404);
  } catch (error) { logError(error, context.request); return json({ error:'Contrat introuvable.' }, 500); }
}

export async function onRequestPut(context) {
  try {
    const auth = await requireAdmin(context); if (auth.error) return auth.error;
    const id = String(context.params.id);
    const current = contractFromRow(await context.env.DB.prepare('SELECT * FROM contracts WHERE id=?').bind(id).first());
    if (!current) return json({ error:'Contrat introuvable.' }, 404);
    if (['sent','client_signed','signed'].includes(current.status)) return json({ error:'Un contrat envoyé pour signature ne peut plus être modifié.' }, 409);
    const contract = cleanContract(await context.request.json(), current); contract.id=id;
    const assignments = CONTRACT_COLUMNS.slice(1).map(column => `${column}=?`).join(',');
    await context.env.DB.prepare(`UPDATE contracts SET ${assignments}, updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(...contractValues(contract).slice(1),id).run();
    return json(contractFromRow(await context.env.DB.prepare('SELECT * FROM contracts WHERE id=?').bind(id).first()));
  } catch (error) { logError(error, context.request); return json({ error:error instanceof Error ? error.message : 'Requête invalide.' }, 400); }
}
