import { LegalPage,LegalSection } from "../legal-document";
const sections:LegalSection[]=[
 {title:"¿A quién pertenecen los datos cargados?",content:<p>Los datos agrícolas, productivos, geográficos y operativos pertenecen al usuario o a la organización que los incorpora. Growr360 no vende esa información ni adquiere propiedad sobre ella.</p>},
 {title:"¿Puedo llevarme una copia completa de mi información?",content:<p>Sí. Growr360 permite solicitar un respaldo integral de la información cargada para conservarla o migrarla si dejás de utilizar la plataforma. Escribinos a info@growr.com para iniciar la exportación.</p>},
 {title:"¿El plan pertenece a cada usuario?",content:<p>No. La suscripción pertenece al grupo u organización activa. Todos sus miembros acceden a las funciones del plan del grupo, mientras que las acciones concretas que pueden realizar dependen de su rol y permisos.</p>},
 {title:"¿Puedo pertenecer a más de un grupo?",content:<p>Sí. Cada grupo puede tener un plan diferente. Al cambiar de grupo, Growr360 aplica inmediatamente las funciones, límites, rol y permisos correspondientes a esa organización.</p>},
 {title:"¿Growr360 reemplaza el asesoramiento agronómico?",content:<p>No. Los mapas, alertas, índices, umbrales y reportes son herramientas de apoyo. Las decisiones productivas deben validarse con un profesional competente y con información del lote.</p>},
 {title:"¿Cómo se protegen los datos?",content:<p>Utilizamos autenticación, conexiones cifradas, controles de acceso, permisos por organización y medidas razonables de seguridad. Ningún servicio conectado a Internet puede garantizar seguridad absoluta.</p>},
 {title:"¿Cómo obtengo ayuda?",content:<p>Podés escribir a <a href="mailto:info@growr.com">info@growr.com</a> o comunicarte al <a href="tel:+5492346458558">+54 9 2346 458558</a>.</p>}
];
export default function FAQ(){return <LegalPage active="faq" eyebrow="CENTRO DE AYUDA" title="Preguntas frecuentes" intro="Respuestas directas sobre cuentas, grupos, planes, datos y seguridad." sections={sections}/>}
