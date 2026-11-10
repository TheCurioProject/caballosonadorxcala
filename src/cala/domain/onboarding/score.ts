import type { Snapshot, State } from "@/cala/domain/model";
export function setupChecklist(state: State | Snapshot, propertyId: string) {
  const property = state.properties.find((p) => p.id === propertyId);
  return [
    {
      label: "Datos de propiedad",
      weight: 15,
      complete: !!property?.name && !!property.city,
      href: "/admin/ajustes",
    },
    {
      label: "Inventario y unidades",
      weight: 25,
      complete: state.units.some(
        (u) => u.propertyId === propertyId && u.active,
      ),
      href: "/admin/inventario",
    },
    {
      label: "Tarifas",
      weight: 15,
      complete: state.ratePlans.some(
        (r) => r.propertyId === propertyId && r.active,
      ),
      href: "/admin/tarifas",
    },
    {
      label: "Políticas e impuestos",
      weight: 10,
      complete: !!property?.policy,
      href: "/admin/ajustes",
    },
    {
      label: "Disponibilidad inicial",
      weight: 10,
      complete: !!property?.onboardingComplete,
      href: "/admin/calendario",
    },
    {
      label: "Pagos de producción",
      weight: 10,
      complete: false,
      href: "/admin/finanzas",
    },
    {
      label: "Canales de producción",
      weight: 10,
      complete: false,
      href: "/admin/canales",
    },
    {
      label: "Reportes operativos",
      weight: 5,
      complete: state.reservations.some((r) => r.propertyId === propertyId),
      href: "/admin/reportes",
    },
  ];
}
export function setupScore(state: State | Snapshot, propertyId: string) {
  return setupChecklist(state, propertyId).reduce(
    (total, item) => total + (item.complete ? item.weight : 0),
    0,
  );
}
