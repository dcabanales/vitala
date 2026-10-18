import type { Metadata } from 'next';
import './globals.css';
import './patient-experience.css';
export const metadata:Metadata={title:'Vitala · Tu salud, en un solo lugar',description:'Tu espacio personal para organizar el historial médico, documentos y seguimiento de salud.',icons:{icon:[{url:'/favicon.ico?v=2',sizes:'16x16 32x32 48x48'},{url:'/favicon.svg?v=2',type:'image/svg+xml',sizes:'any'},{url:'/favicon-32.png?v=2',type:'image/png',sizes:'32x32'}],apple:[{url:'/apple-touch-icon.png?v=2',sizes:'180x180',type:'image/png'}]},robots:{index:false,follow:false}};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>}
