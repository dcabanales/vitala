import type {ReactNode} from 'react';
export function StatusLabel({children,tone='neutral'}:{children:ReactNode;tone?:'neutral'|'info'|'success'|'warning'|'private'}){
 return <span className={'v-label v-label-'+tone}>{children}</span>;
}
export function RecordLabel({status}:{status:string}){
 return status==='draft'?<StatusLabel tone="private">Borrador privado</StatusLabel>:status==='published'?<StatusLabel tone="info">Publicado</StatusLabel>:status==='void'?<StatusLabel>Retirado</StatusLabel>:null;
}
export function careTone(state:string){return state==='completed'?'success':state==='active'||state==='planned'?'info':state==='paused'||state==='suspended'?'warning':'neutral'}
