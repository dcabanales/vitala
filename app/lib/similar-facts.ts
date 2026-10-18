// Visual candidate grouping only: original records, states and sources stay separate.
export function factName(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/^(antecedentes? (?:de )?|alergia (?:a |al )?)/,'').replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ')}
function distance(a:string,b:string){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next}return row[b.length]}
export function similarFactNames(a:string,b:string){
 const explicitAlias=(long:string,short:string)=>[...long.matchAll(/\(([A-ZÁÉÍÓÚ]{2,8})\)/g)].some(m=>factName(m[1])===factName(short));
 if(!/\b(no|sin|niega|descartad[ao]|familiar|izquierd[ao]|derech[ao])\b/i.test(a+' '+b)&&(explicitAlias(a,b)||explicitAlias(b,a)))return true;
 a=factName(a);b=factName(b);if(a===b)return true;if(!a||!b)return false;
 // Never suggest equivalence across negations, numbers, laterality or family context.
 const qualifiers=(s:string)=>s.split(' ').filter(w=>/^(no|sin|niega|descartad[ao]|izquierd[ao]|derech[ao]|bilateral|familia[rn]|madre|padre|hermano|hermana|\d+)$/.test(w)).sort().join(' ');
 if(qualifiers(a)!==qualifiers(b))return false;
 const aa=a.split(' ').sort().join(' '),bb=b.split(' ').sort().join(' ');
 if(aa===bb)return true;
 const words=(s:string)=>s.split(' ').filter(w=>!['de','del','la','el','los','las','en','a','y'].includes(w));
 const wa=new Set(words(a)),wb=new Set(words(b)),overlap=[...wa].filter(w=>wb.has(w)).length;
 if(Math.min(wa.size,wb.size)>=2&&overlap===Math.min(wa.size,wb.size)&&overlap/Math.max(wa.size,wb.size)>=0.75)return true;
 return Math.min(aa.length,bb.length)>=7&&distance(aa,bb)/Math.max(aa.length,bb.length)<=0.12;
}
export function groupSimilarFacts<T>(items:T[],label:(row:T)=>string,context:(row:T)=>string){
 const groups:{label:string;items:T[];context:string}[]=[];
 for(const item of items){const name=label(item)||'Sin nombre',scope=context(item);const group=groups.find(g=>g.context===scope&&g.items.every(other=>similarFactNames(label(other),name)));if(group)group.items.push(item);else groups.push({label:name,items:[item],context:scope})}
 return groups;
}
