import { redirect } from "next/navigation";
// "Revisión de pagos" now lives in CALA → Finanzas → Pagos web.
export default function Page() {
  redirect("/admin/finanzas?tab=web");
}
