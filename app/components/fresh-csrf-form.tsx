'use client';
import {useRef,useState} from 'react';

export function FreshCsrfForm({action,initialToken,children}:{action:string;initialToken:string;children:React.ReactNode}){
  const tokenInput=useRef<HTMLInputElement>(null);
  const [error,setError]=useState('');
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    setError('');
    const form=event.currentTarget;
    try{
      const response=await fetch('/api/auth/csrf',{cache:'no-store'});
      if(!response.ok)throw new Error('TOKEN');
      const data=await response.json();
      if(typeof data.token!=='string'||!tokenInput.current)throw new Error('TOKEN');
      tokenInput.current.value=data.token;
      form.submit();
    }catch{
      setError('No pudimos verificar el formulario. Comprueba tu conexión e inténtalo de nuevo.');
    }
  }
  return <form action={action} method="post" onSubmit={submit}>
    <input ref={tokenInput} type="hidden" name="csrfToken" defaultValue={initialToken}/>
    {children}
    {error&&<p className="error" role="alert">{error}</p>}
  </form>;
}
