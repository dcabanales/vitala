'use client';
import {groupRecords} from '../lib/group-records';
import {Children,isValidElement,useEffect,useState,type ReactNode} from 'react';
function hasId(node:ReactNode,id:string):boolean{
 if(!id||!isValidElement<{id?:string;children?:ReactNode}>(node))return false;
 return node.props.id===id||Children.toArray(node.props.children).some(child=>hasId(child,id));
}
export function PagedList({children,className='',pageSize=10,groupNames}:{children:ReactNode;className?:string;pageSize?:number;groupNames?:string[]}){
 const [anchor,setAnchor]=useState(''),[position,setPosition]=useState({key:'',page:1});
 useEffect(()=>{const sync=()=>setAnchor(decodeURIComponent(location.hash.slice(1)));sync();window.addEventListener('hashchange',sync);return()=>window.removeEventListener('hashchange',sync)},[]);
 const raw=Children.toArray(children),rows=groupNames?groupRecords(raw.map((node,i)=>({node,name:groupNames[i]||String(i)})),r=>r.name).map(g=>g.items.length===1?g.items[0].node:<details className="v-grouped-records" key={g.label} open={g.items.some(r=>hasId(r.node,anchor))||undefined}><summary>{g.label} · {g.items.length} registros con sus propias fechas</summary>{g.items.map(r=>r.node)}</details>):raw;
 const key=rows.map((r,i)=>typeof r==='object'&&r!==null&&'key' in r?r.key:i).join('|');
 const target=rows.findIndex(r=>hasId(r,anchor));
 useEffect(()=>{if(target>=0)setPosition({key,page:Math.floor(target/pageSize)+1})},[anchor,key,target,pageSize]);
 const pages=Math.max(1,Math.ceil(rows.length/pageSize)),page=position.key===key?Math.min(position.page,pages):1;
 return <><div className={className}>{rows.slice((page-1)*pageSize,page*pageSize)}</div>{rows.length>pageSize&&<nav className="v-pagination" aria-label="Paginación"><button type="button" className="v-button v-secondary" disabled={page===1} onClick={()=>setPosition({key,page:page-1})}>Anterior</button><span role="status">{page} / {pages} · {rows.length} {groupNames?'grupos':'registros'}</span><button type="button" className="v-button v-secondary" disabled={page===pages} onClick={()=>setPosition({key,page:page+1})}>Siguiente</button></nav>}</>;
}
