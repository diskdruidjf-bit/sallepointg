import { contractFromRow, json, logError, requireAdmin } from '../../../_lib.js';

const label = value => ({guests:'Payé par chaque invité',tenant:'Payé par le locataire',limit:'Payé par le locataire jusqu’au plafond convenu',quantity:'Quantité convenue payée par le locataire',other:'Autre répartition'}[value] || value || '');

export async function onRequestPost(context) {
  try {
    const auth = await requireAdmin(context); if (auth.error) return auth.error;
    const { DROPBOX_SIGN_API_KEY:key, DROPBOX_SIGN_TEMPLATE_ID:templateId } = context.env;
    if (!key || !templateId) return json({ error:'Configurez DROPBOX_SIGN_API_KEY et DROPBOX_SIGN_TEMPLATE_ID dans Cloudflare.' }, 503);
    const id=String(context.params.id); const contract=contractFromRow(await context.env.DB.prepare('SELECT * FROM contracts WHERE id=?').bind(id).first());
    if (!contract) return json({ error:'Contrat introuvable.' },404);
    if (!['submitted','approved'].includes(contract.status)) return json({ error:'Ce contrat a déjà été envoyé ou fermé.' },409);
    if (!contract.locatorName || !contract.locatorEmail) return json({ error:'Ajoutez le nom et le courriel du représentant du locateur.' },400);
    const fields={tenant_name:contract.tenantName,tenant_address:contract.tenantAddress,tenant_email:contract.tenantEmail,tenant_phone:contract.tenantPhone,tenant_neq:contract.tenantNeq,event_date:contract.eventDate,event_type:contract.eventType,minors_present:contract.minorsPresent?'Oui':'Non',minors_count:contract.minorsCount,access_time:contract.accessTime,guest_time:contract.guestTime,room_price:contract.roomPrice,room_taxes:contract.roomTaxes,deposit:contract.deposit,room_balance:contract.roomBalance,security_deposit:contract.securityDeposit,meal_plan:contract.mealPlan,meal_count:contract.mealCount,meal_deadline:contract.mealDeadline,meal_payment:label(contract.mealPayment),meal_allocation:contract.mealAllocation,beverage_payment:label(contract.beveragePayment),beverage_terms:contract.beverageTerms,other_purchases:contract.otherPurchases,onsite_contact:contract.onsiteContact,onsite_phone:contract.onsitePhone,notes:contract.notes};
    const body=new URLSearchParams(); body.set('template_ids[0]',templateId); body.set('subject',`Contrat de location — Salle Point G — ${contract.eventDate}`); body.set('message','Veuillez lire et signer le contrat de location. Une copie signée par les deux parties vous sera transmise automatiquement.'); body.set('test_mode',context.env.DROPBOX_SIGN_TEST_MODE==='true'?'1':'0'); body.set('signers[Locataire][name]',contract.tenantName); body.set('signers[Locataire][email_address]',contract.tenantEmail); body.set('signers[Locateur][name]',contract.locatorName); body.set('signers[Locateur][email_address]',contract.locatorEmail); body.set('signing_options[draw]','1'); body.set('signing_options[type]','1'); body.set('signing_options[upload]','1'); body.set('signing_options[phone]','0'); body.set('metadata[contract_id]',contract.id); body.set('custom_fields',JSON.stringify(Object.entries(fields).map(([name,value])=>({name,value:String(value||''),required:false}))));
    const response=await fetch('https://api.hellosign.com/v3/signature_request/send_with_template',{method:'POST',headers:{authorization:`Basic ${btoa(`${key}:`)}`,'content-type':'application/x-www-form-urlencoded'},body});
    const data=await response.json(); if(!response.ok) throw new Error(data?.error?.error_msg || 'Dropbox Sign a refusé la demande.');
    const requestId=data.signature_request.signature_request_id;
    await context.env.DB.prepare("UPDATE contracts SET status='sent', signature_request_id=?, sent_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(requestId,id).run();
    return json({ ok:true, signatureRequestId:requestId });
  } catch(error){ logError(error,context.request); return json({error:error instanceof Error?error.message:'Envoi impossible.'},400); }
}
