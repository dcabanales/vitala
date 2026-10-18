// Optional transactional transport. No clinical data is included in invitation messages.
export function emailReady(){return !!process.env.RESEND_API_KEY&&!!process.env.INVITATION_FROM}
export async function sendInvitationEmail(email:string,url:string,idempotencyKey:string):Promise<'sent'|'manual'|'failed'>{
 if(!emailReady())return 'manual';
 try{const r=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:`Bearer ${process.env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({from:process.env.INVITATION_FROM,to:[email],subject:'Tu invitación a Vitala',text:`Te han invitado a acceder a tu espacio privado en Vitala. Activa tu cuenta usando este enlace de un solo uso, válido durante 24 horas:\n\n${url}\n\nSi no esperabas esta invitación, ignora este mensaje.`}),signal:AbortSignal.timeout(15_000)});return r.ok?'sent':'failed'}catch{return 'failed'}
}
