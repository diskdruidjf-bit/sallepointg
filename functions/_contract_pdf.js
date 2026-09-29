import { PDFDocument, StandardFonts } from 'pdf-lib';

const dateFr=value=>{const match=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(value||''));return match?`${match[3]}/${match[2]}/${match[1]}`:String(value||'');};
const payment=value=>({guests:'Chaque invité',tenant:'Locataire',other:'Autre',limit:'Locataire — plafond',quantity:'Locataire — quantité précise'}[value]||'');
export const signatureFieldsForRole=role=>role==='tenant'
  ? ['signature_locataire','annexe_sign_locataire']
  : ['signature_locateur','annexe_sign_locateur'];
export const contractPdfValues=contract=>({representant_locateur:contract.locatorName,contact_locateur:contract.locatorEmail,nom_locataire:contract.tenantName,adresse_locataire:contract.tenantAddress,contact_locataire:`${contract.tenantEmail} · ${contract.tenantPhone}`,neq_locataire:contract.tenantNeq,date_evenement:dateFr(contract.eventDate),type_evenement:contract.eventType,nombre_mineurs:contract.minorsCount,heure_acces:contract.accessTime,heure_invites:contract.guestTime,prix_salle:contract.roomPrice,taxes_salle:contract.roomTaxes,acompte:contract.deposit,solde_salle:contract.roomBalance,depot_garantie:contract.securityDeposit,repas_formule:contract.mealPlan,repas_nombre:contract.mealCount,date_limite_repas:dateFr(contract.mealDeadline),repas_repartition:contract.mealAllocation,boissons_modalites:`${payment(contract.beveragePayment)}${contract.beverageTerms?` — ${contract.beverageTerms}`:''}`,autres_achats:contract.otherPurchases,responsable:`${contract.onsiteContact} · ${contract.onsitePhone}`,nom_sign_locateur:contract.locatorName,nom_sign_locataire:contract.tenantName,lieu_date_signature:'Saint-Jérôme — signatures électroniques horodatées ci-dessous'});
export async function buildContractPdf(env,request,contract,signers=[]){
  const template=await env.ASSETS.fetch(new URL('/assets/contrat-location-template.pdf',request.url)); if(!template.ok)throw new Error('Modèle PDF introuvable.');
  const pdf=await PDFDocument.load(await template.arrayBuffer()); const form=pdf.getForm(); const font=await pdf.embedFont(StandardFonts.Helvetica);
  const values=contractPdfValues(contract);
  for(const [name,value] of Object.entries(values)){try{form.getTextField(name).setText(String(value||''));}catch{}}
  const checks={mineurs_presents:contract.minorsPresent,repas_invites:contract.mealPayment==='guests',repas_locataire:contract.mealPayment==='tenant',repas_autre:contract.mealPayment==='other',boissons_invites:contract.beveragePayment==='guests',boissons_locataire:contract.beveragePayment==='tenant',boissons_plafond_case:contract.beveragePayment==='limit',boissons_quantite_case:contract.beveragePayment==='quantity'};
  for(const [name,checked] of Object.entries(checks)){try{if(checked)form.getCheckBox(name).check();else form.getCheckBox(name).uncheck();}catch{}}
  const signatureOverlays=[];
  for(const signer of signers){const timestamp=new Date(`${signer.signed_at.replace(' ','T')}Z`).toLocaleString('fr-CA',{timeZone:'America/Toronto',dateStyle:'short',timeStyle:'medium'});for(const fieldName of signatureFieldsForRole(signer.role)){try{const field=form.getTextField(fieldName);const widget=field.acroField.getWidgets()[0];const pageIndex=pdf.getPages().findIndex(page=>String(page.ref)===String(widget.P()));field.setText('');signatureOverlays.push({signer,timestamp,rect:widget.getRectangle(),pageIndex});}catch{}}}
  form.updateFieldAppearances(font); form.flatten();
  for(const overlay of signatureOverlays){if(overlay.pageIndex<0)continue;const page=pdf.getPages()[overlay.pageIndex];const {x,y,width,height}=overlay.rect;try{const stored=overlay.signer.signature_key&&await env.CONTRACT_FILES.get(overlay.signer.signature_key);if(stored){const image=await pdf.embedPng(await stored.arrayBuffer());const imageHeight=Math.max(6,height-7);const scale=Math.min((width-4)/image.width,imageHeight/image.height);page.drawImage(image,{x:x+2,y:y+6,width:image.width*scale,height:image.height*scale});}}catch{}page.drawText(`Signé par ${overlay.signer.name} · ${overlay.timestamp}`,{x:x+2,y:y+1,size:4.7,font,maxWidth:width-4});}
  return pdf.save();
}

export const buildSignedContract=buildContractPdf;
