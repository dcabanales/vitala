import type { Metadata } from 'next';
import './globals.css';
import './patient-experience.css';
export const metadata:Metadata={title:'Vitala · Tu salud, en un solo lugar',description:'Tu espacio personal para organizar el historial médico, documentos y seguimiento de salud.',icons:{icon:'/favicon.svg'},robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
