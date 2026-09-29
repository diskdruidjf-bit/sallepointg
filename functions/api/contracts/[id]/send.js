import { clientIp, contractFromRow, escapeHtml, json, logError, randomToken, requireAdmin, sendEmail, sha256 } from '../../../_lib.js';

export async function onRequestPost(context) {
  try {
    const auth=await requireAdmin(context); if(auth.error)return auth.error;
    const id=String(context.params.id); const contract=contractFromRow(await context.env.DB.prepare('SELECT * FROM contracts WHERE id=?').bind(id).first());
    if(!contract)return json({error:'Contrat introuvable.'},404);
    if(!['submitted','approved'].includes(contract.status))return json({error:'Ce contrat a déjà été envoyé ou fermé.'},409);
    if(!contract.locatorName||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contract.locatorEmail))return json({error:'Ajoutez le nom et le courriel du représentant du locateur.'},400);
    const base=String(context.env.PUBLIC_SITE_URL||new URL(context.request.url).origin).replace(/\/$/,''); const expires=Date.now()+14*24*60*60*1000;
    const signers=[{role:'tenant',name:contract.tenantName,email:contract.tenantEmail},{role:'locator',name:contract.locatorName,email:contract.locatorEmail}];
    const prepared=[]; for(const signer of signers){const token=randomToken(32);prepared.push({...signer,id:crypto.randomUUID(),token,hash:await sha256(token)});}
    await context.env.DB.batch([
      context.env.DB.prepare('DELETE FROM contract_signers WHERE contract_id=?').bind(id),
      ...prepared.map(signer=>context.env.DB.prepare('INSERT INTO contract_signers (id,contract_id,role,name,email,token_hash,expires_at) VALUES (?,?,?,?,?,?,?)').bind(signer.id,id,signer.role,signer.name,signer.email,signer.hash,expires))
    ]);
    for(const signer of prepared){const link=`${base}/signature?token=${encodeURIComponent(signer.token)}`;await sendEmail(context.env,{to:signer.email,subject:`Signature du contrat — Salle Point G — ${contract.eventDate}`,html:`<p>Bonjour ${escapeHtml(signer.name)},</p><p>Le contrat de location de la Salle Point G pour l’événement du <strong>${escapeHtml(contract.eventDate)}</strong> est prêt à signer.</p><p><a href="${link}">Lire et signer le contrat</a></p><p>Ce lien personnel expire dans 14 jours. Ne le transférez pas.</p>`});}
    await context.env.DB.batch([context.env.DB.prepare("UPDATE contracts SET status='sent', sent_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(id),context.env.DB.prepare("INSERT INTO contract_audit (contract_id,action,actor_role,actor_email,ip_address,user_agent,details) VALUES (?,'signature_invites_sent','admin','',?,?,?)").bind(id,clientIp(context.request),context.request.headers.get('user-agent')||'',JSON.stringify({recipients:prepared.map(({role,email})=>({role,email}))}))]);
    return json({ok:true});
  }catch(error){logError(error,context.request);return json({error:error instanceof Error?error.message:'Envoi impossible.'},400);}
}
