import {notFound} from "next/navigation";
const sections = ["inicio", "calendario", "reservas", "inbox", "huespedes", "inventario", "tarifas", "canales", "limpieza", "mantenimiento", "finanzas", "plantillas", "mercado", "automatizaciones", "reportes", "actividad", "equipo", "ajustes", "onboarding"];
export default async function Page({params}:{params:Promise<{section:string}>}) {if(!sections.includes((await params).section))notFound();return null;}
