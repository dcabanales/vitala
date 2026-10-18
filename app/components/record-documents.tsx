import {friendlyDate} from '../lib/labels';
export type RecordDocument={id:string;name:string;date:string|null;withdrawn:boolean};
export function RecordDocuments({patientId,documents}:{patientId:string;documents?:RecordDocument[]}){
 if(!documents?.length)return null;
 return <div className="v-fact-sources"><strong>Documentos relacionados</strong>{documents.map(doc=><a key={doc.id} className="v-text-link" href={`/api/patients/${patientId}/documents/${doc.id}`} target="_blank" rel="noopener noreferrer">{doc.name}{doc.date?' · '+friendlyDate(doc.date):''}{doc.withdrawn?' · Documento retirado':''} ↗</a>)}</div>;
}
// Hide only the technical identifier; retain page references and quoted evidence.
export function readableSource(text:string|null){
 return text?.replace(/Fuente:\s*[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\s*(?:·\s*)?/gi,'Referencia: ')||'';
}
