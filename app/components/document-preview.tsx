'use client';
import {useState} from 'react';
import {Icon} from './health-icon';
export function DocumentPreview({href,name,mime}:{href:string;name:string;mime:string}){
 const [open,setOpen]=useState(false),[zoom,setZoom]=useState(false),[failed,setFailed]=useState(false);
 return <div className="v-source-preview"><div className="v-source-heading"><span className="v-icon-soft"><Icon name="file"/></span><div><strong>{name}</strong><small>{mime==='application/pdf'?'PDF · documento original':'Imagen · documento original'}</small></div><a className="v-text-link" href={href} target="_blank" rel="noopener noreferrer">Abrir ↗</a></div>{mime.startsWith('image/')&&<><button type="button" className="v-link-button" aria-expanded={open} onClick={()=>setOpen(!open)}>{open?'Ocultar vista previa':'Ver imagen aquí'}</button>{open&&<div className="v-image-preview"><button type="button" className="v-button v-secondary" onClick={()=>setZoom(!zoom)}>{zoom?'Ajustar imagen':'Ampliar imagen'}</button>{failed?<p role="alert">No se pudo mostrar la imagen. Puedes abrir el original.</p>:<div className={zoom?'is-zoomed':''}><img src={href} alt={'Documento original: '+name} onError={()=>setFailed(true)}/></div>}</div>}</>}</div>
}
