import { json, logError } from '../../_lib.js';

async function validEvent(event,key){
  if(!event?.event_hash||!event?.event_time||!event?.event_type)return false;
  const cryptoKey=await crypto.subtle.importKey('raw',new TextEncoder().encode(key),{name:'HMAC',hash:'SHA-256'},false,['sign']);
  const digest=await crypto.subtle.sign('HMAC',cryptoKey,new TextEncoder().encode(`${event.event_time}${event.event_type}`));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')===event.event_hash;
}
export async function onRequestPost(context){
  try{
    if(!context.env.DROPBOX_SIGN_API_KEY)return new Response('Configuration missing',{status:503});
    const form=await context.request.formData(); const payload=JSON.parse(String(form.get('json')||'{}')); const event=payload.event;
    if(!(await validEvent(event,context.env.DROPBOX_SIGN_API_KEY)))return new Response('Invalid event',{status:401});
    const request=payload.signature_request||{}; const contractId=request.metadata?.contract_id;
    if(!contractId)return new Response('Hello API Event Received');
    if(event.event_type==='signature_request_signed')await context.env.DB.prepare("UPDATE contracts SET status=CASE WHEN status='sent' THEN 'client_signed' ELSE status END, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(contractId).run();
    if(event.event_type==='signature_request_declined')await context.env.DB.prepare("UPDATE contracts SET status='declined', updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(contractId).run();
    if(event.event_type==='signature_request_all_signed')await context.env.DB.prepare("UPDATE contracts SET status='signed', signed_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(contractId).run();
    if(event.event_type==='signature_request_downloadable'&&context.env.CONTRACT_FILES){
      const response=await fetch(`https://api.hellosign.com/v3/signature_request/files/${request.signature_request_id}?file_type=pdf`,{headers:{authorization:`Basic ${btoa(`${context.env.DROPBOX_SIGN_API_KEY}:`)}`}});
      if(response.ok){const key=`signed/${contractId}.pdf`;await context.env.CONTRACT_FILES.put(key,response.body,{httpMetadata:{contentType:'application/pdf'}});await context.env.DB.prepare('UPDATE contracts SET signed_file_key=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').bind(key,contractId).run();}
    }
    return new Response('Hello API Event Received');
  }catch(error){logError(error,context.request);return new Response('Callback error',{status:400});}
}
