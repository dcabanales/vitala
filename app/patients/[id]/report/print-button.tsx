'use client';
import {useState} from 'react';
export function PrintButton({patientId,disabled=false}:{patientId:string;disabled?:boolean}){
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  async function print(){setBusy(true);setError('');try{const token=(await (await fetch('/api/auth/csrf',{cache:'no-store'})).json()).token;
    const r=await fetch(`/api/patients/${patientId}/report-events`,{method:'POST',headers:{'x-csrf-token':token}});if(!r.ok)throw Error('No se pudo registrar la emisión del reporte.');window.print();
  }catch(e){setError(e instanceof Error?e.message:'No se pudo imprimir')}finally{setBusy(false)}}
  return <><button className="v-button" disabled={busy||disabled} onClick={print}>Imprimir o guardar como PDF</button>{error&&<p className="error" role="alert">{error}</p>}</>
}
