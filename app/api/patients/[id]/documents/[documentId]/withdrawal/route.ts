import {requireUser,authorizePatient,boundedRequest,failure,noCache} from '../../../../../../lib/server';
import {transaction} from '../../../../../../lib/db';
import {withdrawalPreview,withdrawDocument,restoreWithdrawal} from '../../../../../../lib/document-withdrawal';
import {z} from 'zod';
type Context={params:Promise<{id:string;documentId:string}>};
export async function GET(req:Request,{params}:Context){try{
 const user=await requireUser(req),{id,documentId}=await params;await authorizePatient(user,id,true);
 const plan=await transaction(c=>withdrawalPreview(c,id,documentId));
 return Response.json({token:plan.token,withdrawn:plan.withdrawn,items:plan.items,tasks:plan.tasks},{headers:noCache});
}catch(e){return failure(e)}}
export async function POST(req:Request,{params}:Context){try{
 const user=await requireUser(req),{id,documentId}=await params;await authorizePatient(user,id,true);
 const body=z.discriminatedUnion('action',[z.object({action:z.literal('withdraw'),token:z.string().regex(/^[a-f0-9]{64}$/)}).strict(),z.object({action:z.literal('restore')}).strict()]).safeParse(await(await boundedRequest(req,2048)).json());if(!body.success)throw Error('VALIDATION');
 const result=await transaction<unknown>(c=>body.data.action==='withdraw'?withdrawDocument(c,id,documentId,user.id,body.data.token):restoreWithdrawal(c,id,documentId,user.id));
 return Response.json(result,{headers:noCache});
}catch(e){return failure(e)}}
