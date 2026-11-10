import type {
  State,
  Role,
  Property,
  Reservation,
  ReservationStatus,
} from "@/cala/domain/model";
import { today, addDays, nights } from "@/cala/domain/shared/dates";
export function seedState(): State {
  const now = new Date().toISOString(),
    day = today();
  const s: State = {
    conversations: [],
    messageEntries: [],
    messageTemplates: [],
    marketObservations: [],
    schemaVersion: 2,
    organizations: [
      {
        id: "org-estancia",
        name: "Grupo Estancia",
        currency: "MXN",
        timezone: "America/Mexico_City",
      },
      {
        id: "org-other",
        name: "Horizonte · tenant de prueba",
        currency: "MXN",
        timezone: "America/Mexico_City",
      },
    ],
    users: [],
    memberships: [],
    properties: [],
    inventoryTypes: [],
    units: [],
    guests: [],
    reservations: [],
    blocks: [],
    ratePlans: [],
    rateDays: [],
    folioItems: [],
    payments: [],
    tasks: [],
    channels: [],
    jobs: [],
    audits: [],
    outbox: [],
    automations: [],
    drafts: [],
    sessions: [],
    idempotency: [],
    externalIdentities: [],
  };
  const roles: Role[] = [
    "owner",
    "admin",
    "manager",
    "front_desk",
    "housekeeping",
    "finance",
    "viewer",
  ];
  const names = [
    "Mariana Torres",
    "Diego Luna",
    "Valeria Ortiz",
    "Andrés Cruz",
    "Lucía Méndez",
    "Daniela Ríos",
    "Pablo Vega",
  ];
  roles.forEach((role, i) => {
    s.users.push({
      id: "user-" + role,
      name: names[i],
      email: role + "@example.test",
    });
    s.memberships.push({
      id: "member-" + role,
      userId: "user-" + role,
      organizationId: "org-estancia",
      role,
      status: "active",
      propertyIds: role === "manager" ? ["property-hotel"] : [],
    });
  });
  s.users.push({
    id: "user-other",
    name: "Tenant independiente",
    email: "other@example.test",
  });
  s.memberships.push({
    id: "member-other",
    userId: "user-other",
    organizationId: "org-other",
    role: "owner",
    status: "active",
    propertyIds: [],
  });
  const props: [string, string, Property["concept"], string, number][] = [
    ["hotel", "Casa Jacaranda", "boutique_hotel", "Oaxaca de Juárez", 240000],
    ["home", "Casa del Mar", "entire_home", "Puerto Escondido", 420000],
    ["villas", "Villas del Valle", "villas", "Valle de Guadalupe", 360000],
    ["hostel", "Patio Nómada", "hostel", "Ciudad de México", 65000],
  ];
  for (const [key, name, concept, city, rate] of props) {
    const id = "property-" + key;
    s.properties.push({
      id,
      organizationId: "org-estancia",
      name,
      concept,
      city,
      country: "MX",
      timezone: "America/Mexico_City",
      currency: "MXN",
      address: "Dirección ficticia de demostración",
      checkIn: "15:00",
      checkOut: "11:00",
      policy:
        "Cancelación flexible hasta 48 horas antes. Política de demostración.",
      taxBps: 0,
      allowedOverbooking: 0,
      onboardingComplete: true,
      version: 1,
    });
    const typeId = "type-" + key;
    s.inventoryTypes.push({
      id: typeId,
      propertyId: id,
      name:
        key === "hotel"
          ? "Suite Jardín"
          : key === "hostel"
            ? "Cama en dormitorio"
            : key === "home"
              ? "Casa completa"
              : "Villa privada",
      sellMode: key === "hostel" ? "bed" : "unit",
      maxOccupancy: key === "hostel" ? 1 : key === "home" ? 6 : 2,
      baseRateMinor: rate,
      amenities: ["WiFi", "Baño privado"],
      active: true,
    });
    s.ratePlans.push({
      id: "plan-" + key,
      propertyId: id,
      name: "Tarifa flexible",
      active: true,
    });
    if (key === "hostel") {
      s.inventoryTypes.push({
        id: "type-dorm",
        propertyId: id,
        name: "Dormitorio completo",
        sellMode: "unit",
        maxOccupancy: 4,
        baseRateMinor: 220000,
        amenities: ["Baño compartido"],
        active: true,
      });
      s.units.push({
        id: "unit-dorm",
        propertyId: id,
        inventoryTypeId: "type-dorm",
        name: "Dormitorio A",
        parentUnitId: null,
        active: true,
        housekeeping: "clean",
        version: 1,
      });
    }
    const count = key === "hotel" ? 8 : key === "home" ? 1 : 4;
    for (let i = 1; i <= count; i++)
      s.units.push({
        id: `unit-${key}-${i}`,
        propertyId: id,
        inventoryTypeId: typeId,
        name:
          key === "hotel"
            ? String(100 + i)
            : key === "hostel"
              ? `Cama A${i}`
              : key === "home"
                ? "Casa del Mar"
                : `Villa ${i}`,
        parentUnitId: key === "hostel" ? "unit-dorm" : null,
        active: true,
        housekeeping: i === 3 ? "dirty" : "clean",
        version: 1,
      });
    s.channels.push({
      id: "channel-" + key,
      propertyId: id,
      name: "Canal de demostración",
      provider: "development",
      status: "connected",
      syncMode: "ari",
      ownership: "pms",
      mappings: [
        {
          inventoryTypeId: typeId,
          externalId: "demo-" + key,
          ratePlanId: "plan-" + key,
        },
      ],
      lastSync: now,
      lastError: null,
      simulateFailure: false,
      version: 1,
    });
  }
  s.properties.push({
    ...s.properties[0],
    id: "property-other",
    organizationId: "org-other",
    name: "Hotel de otro tenant",
  });
  const guests = [
    ["Sofía", "Ramírez"],
    ["Alejandro", "García"],
    ["Camila", "Santos"],
    ["Mateo", "López"],
    ["Isabella", "Hernández"],
    ["Sebastián", "Ruiz"],
    ["Renata", "Morales"],
    ["Emiliano", "Vargas"],
    ["Valentina", "Castillo"],
    ["Nicolás", "Mendoza"],
    ["Ana", "Navarro"],
    ["Tomás", "Flores"],
  ];
  guests.forEach(([firstName, lastName], i) =>
    s.guests.push({
      id: "guest-" + (i + 1),
      organizationId: "org-estancia",
      firstName,
      lastName,
      email: `huesped${i + 1}@example.test`,
      phone: "",
      country: "MX",
      notes: "Perfil ficticio de desarrollo.",
      version: 1,
    }),
  );
  const specs: [number, number, number, ReservationStatus][] = [
    [1, -2, 2, "checked_in"],
    [2, 0, 3, "confirmed"],
    [3, 1, 5, "confirmed"],
    [4, -3, 0, "checked_in"],
    [5, 0, 2, "confirmed"],
    [6, 4, 7, "pending"],
    [7, -8, -5, "checked_out"],
    [8, 2, 5, "cancelled"],
  ];
  specs.forEach(([u, a, d, status], i) => {
    const r: Reservation = {
      id: "reservation-" + (i + 1),
      organizationId: "org-estancia",
      propertyId: "property-hotel",
      guestId: "guest-" + (i + 1),
      inventoryTypeId: "type-hotel",
      unitId: "unit-hotel-" + u,
      ratePlanId: "plan-hotel",
      arrival: addDays(day, a),
      departure: addDays(day, d),
      adults: 2,
      children: 0,
      status,
      source: "direct",
      confirmationCode: "EST-" + String(1024 + i),
      currency: "MXN",
      totalMinor: (d - a) * 240000,
      notes: i === 1 ? "Llegada estimada a las 16:00." : "",
      version: 1,
      createdAt: now,
    };
    s.reservations.push(r);
    s.folioItems.push({
      id: "folio-" + r.id,
      propertyId: r.propertyId,
      reservationId: r.id,
      description: `Alojamiento · ${nights(r.arrival, r.departure).length} noches`,
      amountMinor: r.totalMinor,
      kind: "room",
      createdAt: now,
    });
    if (i % 2 === 0)
      s.payments.push({
        id: "payment-" + i,
        propertyId: r.propertyId,
        reservationId: r.id,
        amountMinor: r.totalMinor,
        provider: "development",
        externalId: "demo-payment-" + i,
        status: "succeeded",
        createdAt: now,
      });
  });
  for (const key of ["home", "villas", "hostel"]) {
    const type = s.inventoryTypes.find((t) => t.id === "type-" + key)!;
    const r: Reservation = {
      ...s.reservations[0],
      id: "reservation-" + key,
      propertyId: "property-" + key,
      inventoryTypeId: type.id,
      unitId: `unit-${key}-1`,
      guestId: "guest-9",
      ratePlanId: "plan-" + key,
      confirmationCode: "EST-" + key.toUpperCase(),
      arrival: day,
      departure: addDays(day, 3),
      status: "confirmed",
      totalMinor: type.baseRateMinor * 3,
    };
    s.reservations.push(r);
    s.folioItems.push({
      id: "folio-" + key,
      propertyId: r.propertyId,
      reservationId: r.id,
      description: "Alojamiento",
      amountMinor: r.totalMinor,
      kind: "room",
      createdAt: now,
    });
  }
  s.blocks.push({
    id: "block-1",
    propertyId: "property-hotel",
    unitId: "unit-hotel-8",
    arrival: day,
    departure: addDays(day, 2),
    reason: "Mantenimiento preventivo",
    active: true,
  });
  s.tasks.push(
    {
      id: "task-1",
      propertyId: "property-hotel",
      unitId: "unit-hotel-3",
      kind: "housekeeping",
      title: "Preparar habitación para llegada",
      status: "pending",
      priority: "high",
      assigneeId: "user-housekeeping",
      version: 1,
    },
    {
      id: "task-2",
      propertyId: "property-hotel",
      unitId: "unit-hotel-8",
      kind: "maintenance",
      title: "Revisar aire acondicionado",
      status: "in_progress",
      priority: "normal",
      assigneeId: "user-manager",
      version: 1,
    },
  );
  s.automations.push({
    id: "automation-1",
    propertyId: "property-hotel",
    name: "Preparar limpieza al salir",
    trigger: "checkout.completed",
    action: "create_task",
    enabled: true,
  });
  s.audits.push({
    id: "audit-seed",
    organizationId: "org-estancia",
    propertyId: null,
    actorId: "system",
    action: "development.seed",
    entityId: "seed-v1",
    requestId: "seed",
    createdAt: now,
    detail: "Datos ficticios de demostración inicializados.",
  });
  return s;
}
