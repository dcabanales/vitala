import {csrfToken} from '../../../lib/auth';
export function GET(){return Response.json({token:csrfToken()},{headers:{'Cache-Control':'no-store'}})}
