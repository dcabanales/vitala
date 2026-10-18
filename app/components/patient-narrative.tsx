import {ReadingText} from './reading';
import {patientSummaryView} from '../lib/patient-summary-data';
import {GenerateSummary} from './generate-summary';
export async function PatientNarrative({patientId,admin=false,report=false}:{patientId:string;admin?:boolean;report?:boolean}){
 const view=await patientSummaryView(patientId);
 return <section className="v-patient-narrative"><h3>Resumen del paciente</h3><ReadingText text={view.cached?.content||view.fallback} limit={report?10000:420}/>
 {view.cached?<small>Resumen generado por IA a partir de datos publicados · {new Date(view.cached.created_at).toLocaleDateString('es-ES')}. No es una conclusión del médico.</small>:<small>{view.stale?'Hay datos nuevos: el resumen de IA necesita actualizarse. Se muestra una síntesis de los registros actuales.':'Síntesis de datos registrados.'}</small>}
 {report&&<small>Visión general del expediente; no está limitada por los filtros del reporte.</small>}
 {admin&&!report&&!view.cached&&<GenerateSummary patientId={patientId} stale={view.stale} hasData={view.hasData}/>}</section>;
}
