'use client';
import {useRef,useState} from 'react';

export function FreshCsrfForm({action,initialToken,children}:{action:string;initialToken:string;children:React.ReactNode}){
  const tokenInput=useRef<HTMLInputElement>(null);
  const submitting=useRef(false);
  const [error,setError]=useState('');
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(submitting.current)return;
    submitting.current=true;
    setError('');
    const form=event.currentTarget;
    try{
      const response=await fetch('/api/auth/csrf',{cache:'no-store'});
      if(!response.ok)throw new Error('TOKEN');
      const data=await response.json();
      if(typeof data.token!=='string'||!tokenInput.current)throw new Error('TOKEN');
      tokenInput.current.value=data.token;
      const result=await fetch(action,{method:'POST',body:new FormData(form)});
      if(result.redirected){window.location.assign(result.url);return;}
      const body=await result.json();
      setError(body.error||'No se pudo completar la solicitud.');
    }catch{
      setError('No pudimos verificar el formulario. Comprueba tu conexión e inténtalo de nuevo.');
    }finally{submitting.current=false}
  }
  return <form action={action} method="post" onSubmit={submit}>
    <input ref={tokenInput} type="hidden" name="csrfToken" defaultValue={initialToken}/>
    {children}
    {error&&<p className="error" role="alert">{error}</p>}
  </form>;
}
