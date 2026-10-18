import type {CSSProperties} from 'react';
export type IconName='people'|'heart'|'visit'|'chart'|'care'|'file'|'clock'|'user'|'more'|'arrow'|'shield'|'plus'|'leaf'|'book';
const paths:Record<IconName,React.ReactNode>={
 people:<><circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2M16 5a3 3 0 0 1 0 6m2 3a5 5 0 0 1 3 4v2"/></>,
 heart:<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>,
 visit:<><rect x="4" y="5" width="16" height="16" rx="3"/><path d="M8 3v4m8-4v4M4 11h16m-8 3v4m-2-2h4"/></>,
 chart:<><path d="M4 3v17h17M7 15l4-5 4 3 5-7"/><circle cx="20" cy="6" r="1"/></>,
 care:<><rect x="4" y="6" width="16" height="15" rx="4"/><path d="M9 6V3h6v3m-3 5v6m-3-3h6"/></>,
 file:<><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9Zm0 0v6h6M8 13h8m-8 4h5"/></>,
 clock:<><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
 user:<><circle cx="12" cy="8" r="4"/><path d="M4 22v-2a8 8 0 0 1 16 0v2"/></>,
 more:<><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
 arrow:<path d="M4 12h16m-6-6 6 6-6 6"/>,
 shield:<><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,
 plus:<path d="M12 5v14M5 12h14"/>,
 leaf:<><path d="M20 3C8 2 2 8 5 15s15 7 15-12ZM5 20l9-10"/></>,
 book:<><path d="M12 6C8 3 4 4 2 5v15c4-2 7-1 10 1 3-2 6-3 10-1V5c-4-2-7-1-10 1Zm0 0v15"/></>
};
export function Icon({name,size=20,style}:{name:IconName;size?:number;style?:CSSProperties}){return <svg className="v-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}>{paths[name]}</svg>}
