import { CalaLoader } from "@/cala/components/ui/cala-loader";

/** Route transition inside CALA (website modules and server-rendered sections). */
export default function AdminLoading() {
  return <CalaLoader className="cala-route-loader" label="Abriendo sección…" />;
}
