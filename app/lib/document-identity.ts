export type IdentityIssue={field:'name'|'birthDate'|'identifier';documentValue:string;patientValue:string|null;message:string};
export function normalizedName(name:string){return name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z ]/g,' ').replace(/\s+/g,' ').trim()}
export function identityMismatch(documentName:string|null|undefined,patientName:string){return !!documentName&&normalizedName(documentName)!==normalizedName(patientName)}
export function identityIssues(draft:{patientName?:string|null;patientBirthDate?:string|null;patientIdentifier?:string|null},patient:{name:string;birthDate?:string|null}):IdentityIssue[]{
 const issues:IdentityIssue[]=[];
 if(identityMismatch(draft.patientName,patient.name))issues.push({field:'name',documentValue:draft.patientName!,patientValue:patient.name,message:'El nombre del documento es diferente. Puede ser una variante del mismo nombre; verifica a quién pertenece.'});
 if(draft.patientBirthDate&&draft.patientBirthDate!==patient.birthDate)issues.push({field:'birthDate',documentValue:draft.patientBirthDate,patientValue:patient.birthDate||null,message:patient.birthDate?'La fecha de nacimiento contradice la del perfil. Revisa esta diferencia por separado.':'El documento contiene una fecha de nacimiento que aún no consta en el perfil.'});
 if(draft.patientIdentifier)issues.push({field:'identifier',documentValue:draft.patientIdentifier,patientValue:null,message:'Hay un identificador en el documento. El perfil no tiene un identificador comparable; verifícalo con la fuente.'});
 return issues;
}
