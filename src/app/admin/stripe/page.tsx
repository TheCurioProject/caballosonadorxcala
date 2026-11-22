import { redirect } from "next/navigation";
// "Pagos de la web" now lives in CALA → Finanzas → Pagos web (Stripe balance
// and latest charges). Website coupons are managed in Cupones.
export default function Page() {
  redirect("/admin/finanzas?tab=web");
}
