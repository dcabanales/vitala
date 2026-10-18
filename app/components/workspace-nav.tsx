'use client';
import {Icon,type IconName} from './health-icon';
import Link from 'next/link';
import {usePathname} from 'next/navigation';
export function WorkspaceNav({admin,mobile=false}:{admin:boolean;mobile?:boolean}){
 const path=usePathname();
 const links=[['/patients',admin?'Pacientes':'Mis expedientes'],...(admin?[['/catalogs','Directorio médico'],['/security','Mi cuenta']]:[['/logout','Cerrar sesión']])];
 return <nav className={mobile?'v-mobile-nav':'v-workspace-nav'} aria-label={mobile?'Navegación móvil':'Principal'}>{links.map(([href,label])=><Link key={href} href={href} aria-current={path===href||path.startsWith(href+'/')?'page':undefined}><Icon name={({'/patients':'people','/catalogs':'book','/security':'user','/logout':'user'} as Record<string,IconName>)[href]}/><span>{label}</span></Link>)}</nav>;
}
