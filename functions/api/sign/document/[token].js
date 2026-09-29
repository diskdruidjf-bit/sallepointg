import { buildContractPdf } from '../../../_contract_pdf.js';
import { contractFromRow, json, logError, sha256 } from '../../../_lib.js';

export async function onRequestGet(context) {
  try {
    const tokenHash=await sha256(String(context.params.token));
    const signer=await context.env.DB.prepare('SELECT contract_id,expires_at FROM contract_signers WHERE token_hash=?').bind(tokenHash).first();
    if(!signer||signer.expires_at<Date.now())return json({error:'Ce lien de signature est invalide ou expiré.'},404);
    const contract=contractFromRow(await context.env.DB.prepare('SELECT * FROM contracts WHERE id=?').bind(signer.contract_id).first());
    if(!contract)return json({error:'Contrat introuvable.'},404);
    const pdf=await buildContractPdf(context.env,context.request,contract);
    return new Response(pdf,{headers:{'content-type':'application/pdf','content-disposition':`inline; filename="contrat-salle-point-g-${contract.eventDate}.pdf"`,'cache-control':'private, no-store'}});
  } catch(error) {
    logError(error,context.request);
    return json({error:'Le contrat ne peut pas être affiché.'},500);
  }
}
