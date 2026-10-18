'use client';
import {DocumentPreview} from '../../../components/document-preview';
import {DocumentUpload} from '../../../components/document-upload';
import {clinicalDate} from '../../../lib/labels';
import {useCallback,useEffect,useState} from 'react';
import Link from 'next/link';
type Document={id:string;fileName:string;mimeType:string;byteSize:number;sha256:string;status:string;visibleToPatient:boolean;documentDate:string|null;createdAt:string;specialtyName:string|null};
export function DocumentList({patientId,role}:{patientId:string;role:'admin'|'patient'}){
  const [items,setItems]=useState<Document[]>([]),[error,setError]=useState(''),[busy,setBusy]=useState(false),[open,setOpen]=useState(false);
  const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{setLoading(true);try{const r=await fetch(`/api/patients/${patientId}/documents`,{cache:'no-store'}),j=await r.json();if(!r.ok)throw Error(j.error);setItems(j.documents)}catch(e){setError(e instanceof Error?e.message:'No se pudieron cargar los documentos')}finally{setLoading(false)}},[patientId]);
  useEffect(()=>{void load()},[load]);
  async function csrf(){return (await (await fetch('/api/auth/csrf',{cache:'no-store'})).json()).token}
  async function publish(doc:Document){setBusy(true);setError('');try{
    const r=await fetch(`/api/patients/${patientId}/documents/${doc.id}`,{method:'PATCH',headers:{'Content-Type':'application/json','x-csrf-token':await csrf()},body:JSON.stringify({visibleToPatient:!doc.visibleToPatient})}),j=await r.json();if(!r.ok)throw Error(j.error);await load();
  }catch(e){setError(e instanceof Error?e.message:'No se pudo actualizar')}finally{setBusy(false)}}
  return <>{role==='admin'&&<div className="v-toolbar"><button className="v-button" onClick={()=>setOpen(!open)}>{open?'Cerrar':'Subir documento'}</button></div>}{error&&<p className="error" role="alert">{error}</p>}{open&&role==='admin'&&<DocumentUpload patientId={patientId} onCancel={()=>setOpen(false)} onUploaded={()=>void load()}/>}<section className="v-panel"><h2>Archivos del paciente</h2>{loading&&<p role="status">Cargando documentos…</p>}{!loading&&!items.length&&<p className="v-muted">Aún no hay documentos.</p>}<div className="v-doc-grid">{items.map(doc=><article className="v-doc" key={doc.id}>{doc.status==='ready'?<DocumentPreview href={`/api/patients/${patientId}/documents/${doc.id}`} name={doc.fileName} mime={doc.mimeType}/>:<h3>{doc.fileName}</h3>}<p>{Math.ceil(doc.byteSize/1024)} KB · {clinicalDate(doc.createdAt)}</p><p className="v-muted">{doc.status==='ready'?'Original disponible':doc.status==='pending'?'Carga pendiente':'Error de carga'} · {doc.visibleToPatient?'Visible al paciente':'Privado'}</p>{role==='admin'&&doc.status==='ready'&&<Link className="v-button v-secondary" href={`/patients/${patientId}/documents/${doc.id}/review`}>Leer con IA</Link>}{role==='admin'&&doc.status==='ready'&&<button className="v-link-button" disabled={busy} onClick={()=>publish(doc)}>{doc.visibleToPatient?'Ocultar al paciente':'Publicar para el paciente'}</button>}</article>)}</div></section></>}
