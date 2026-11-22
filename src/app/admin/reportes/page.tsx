import { redirect } from "next/navigation";
// Reportes was folded into Finanzas → Resumen (same figures plus collections).
export default function Page() {
  redirect("/admin/finanzas");
}
