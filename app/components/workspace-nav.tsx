'use client';
import {Icon,type IconName} from './health-icon';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
export function WorkspaceNav({admin,mobile=false,patientId}:{admin:boolean;mobile?:boolean;patientId?:string|null}){
 const path=usePathname();
 const root=patientId?`/patients/${patientId}`:'/access-unavailable';
 const links=admin?[['/patients','Pacientes'],['/reviews','Revisar documentos'],['/catalogs','Directorio médico'],['/security','Mi cuenta']]:[[root,'Mi salud'],...(patientId?[[root+'/documents','Mis documentos']]:[]),['/logout','Salir']];
 return <nav className={mobile?'v-mobile-nav':'v-workspace-nav'} aria-label={mobile?'Navegación móvil':'Principal'}>{links.map(([href,label])=><Link key={href} href={href} aria-current={path===href||(admin&&path.startsWith(href+'/'))?'page':undefined}><Icon name={({'/patients':'people','/reviews':'file','/catalogs':'book','/security':'user','/logout':'user',[root]:admin?'people':'heart',[root+'/documents']:'file'} as Record<string,IconName>)[href]||'heart'}/><span>{label}</span></Link>)}</nav>;
}
