export function groupRecords<T>(items:T[],label:(item:T)=>string){
 const groups=new Map<string,{label:string;items:T[]}>();
 for(const item of items){const name=label(item)||'Sin nombre',key=name.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es');const group=groups.get(key)||{label:name,items:[]};group.items.push(item);groups.set(key,group)}
 return [...groups.values()];
}
