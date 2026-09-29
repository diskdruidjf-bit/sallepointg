import { json, requireAdmin } from '../../../_lib.js';
export async function onRequestGet(context){
  const auth=await requireAdmin(context); if(auth.error)return auth.error;
  const row=await context.env.DB.prepare('SELECT signed_file_key FROM contracts WHERE id=?').bind(String(context.params.id)).first();
  if(!row?.signed_file_key)return json({error:'La copie signée n’est pas encore disponible.'},404);
  const file=await context.env.CONTRACT_FILES.get(row.signed_file_key); if(!file)return json({error:'Fichier introuvable.'},404);
  return new Response(file.body,{headers:{'content-type':'application/pdf','content-disposition':`attachment; filename="contrat-salle-point-g-${context.params.id}.pdf"`,'cache-control':'private, no-store'}});
}
