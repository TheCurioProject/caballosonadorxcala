import { z } from "zod";
import { allRows } from "./rows";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/cala/infrastructure/db/database.types";
import type {
  Concept,
  JobStatus,
  Payment,
  Permission,
  RentalMode,
  ReservationStatus,
  Role,
  Snapshot,
} from "@/cala/domain/model";
import { grants } from "@/cala/domain/identity/permissions";
import { DomainError, invariant } from "@/cala/domain/shared/errors";
import { today } from "@/cala/domain/shared/dates";
import { workspacePreferences } from "@/cala/domain/workspace/preferences";
type QueryResult<T> = {
  data: T | null;
  error: {
    message: string;
  } | null;
};
function value<T>(result: QueryResult<T>, label: string): T {
  if (result.error)
    throw new DomainError(
      "WORKSPACE_READ_FAILED",
      `No pudimos cargar ${label}.`,
      503,
    );
  invariant(
    result.data !== null,
    "WORKSPACE_READ_FAILED",
    `No pudimos cargar ${label}.`,
    503,
  );
  return result.data;
}
function primitiveRecord(
  input: Json,
): Record<string, string | number | boolean> {
  if (!input || Array.isArray(input) || typeof input !== "object") return {};
  return Object.fromEntries(
    Object.entries(input).filter(
      (entry): entry is [string, string | number | boolean] =>
        ["string", "number", "boolean"].includes(typeof entry[1]),
    ),
  );
}
function stringRecord(input: Json): Record<string, string> {
  if (!input || Array.isArray(input) || typeof input !== "object") return {};
  return Object.fromEntries(
    Object.entries(input).map(([key, item]) => [key, String(item ?? "")]),
  );
}
function stringArray(input: Json): string[] {
  return Array.isArray(input)
    ? input.filter((item): item is string => typeof item === "string")
    : [];
}
export async function supabaseSnapshot(
  client: SupabaseClient<Database>,
  organizationId?: string,
  propertyId?: string,
): Promise<Snapshot> {
  const { data: auth, error: authError } = await client.auth.getUser();
  invariant(
    !authError && auth.user,
    "UNAUTHORIZED",
    "Inicia sesión para continuar.",
    401,
  );
  const user = auth.user;
  const memberRows = value(
    await allRows(
      client
        .from("organization_members")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active"),
      "organization_id",
    ),
    "tus organizaciones",
  );
  const org =
    organizationId ??
    memberRows.find((member) => member.status === "active")?.organization_id;
  invariant(
    org,
    "NO_ORGANIZATION",
    "Crea una organización para continuar.",
    409,
  );
  const currentMember = memberRows.find(
    (member) => member.organization_id === org,
  );
  invariant(
    currentMember,
    "FORBIDDEN",
    "No tienes acceso a esta organización.",
    403,
  );
  const organizationRows = value(
    await allRows(
      client.from("organizations").select("*").in("id", [org]),
      "id",
    ),
    "tus organizaciones",
  );
  const roleRows = value(
    await allRows(
      client
        .from("roles")
        .select("*")
        .in(
          "id",
          memberRows.map((member) => member.role_id),
        ),
      "id",
    ),
    "tus permisos",
  );
  const currentRole = (roleRows.find(
    (role) => role.id === currentMember.role_id,
  )?.key ?? "viewer") as Role;
  const permissions = (grants[currentRole] ?? grants.viewer) as Permission[];
  const propertyRows = value(
    await allRows(
      client.from("properties").select("*").eq("organization_id", org),
      "id",
    ),
    "tus propiedades",
  );
  const selectedProperty = propertyId
    ? propertyRows.find((property) => property.id === propertyId)
    : propertyRows[0];
  invariant(
    !propertyId || selectedProperty,
    "FORBIDDEN",
    "No tienes acceso a esta propiedad.",
    403,
  );
  const currentPropertyId = selectedProperty?.id ?? "";
  const privateNotes = new Map<string, string>();
  if (
    permissions.includes("reservation.read") &&
    permissions.includes("guest.pii.read")
  ) {
    const rows = await Promise.all(
      propertyRows.map((property) =>
        client.rpc("pms_reservations", { org, prop: property.id }),
      ),
    );
    for (const result of rows)
      for (const row of z
        .array(z.object({ id: z.string(), notes: z.string() }))
        .parse(value(result, "las notas de las reservas")))
        privateNotes.set(row.id, row.notes);
  }
  const [
    settingsResult,
    scopesResult,
    inventoryTypesResult,
    unitsResult,
    guestsResult,
    reservationsResult,
    reservationUnitsResult,
    blocksResult,
    ratePlansResult,
    rateDaysResult,
    foliosResult,
    folioItemsResult,
    paymentsResult,
    tasksResult,
    channelsResult,
    mappingsResult,
    jobsResult,
    auditsResult,
    automationsResult,
    draftsResult,
    conversationsResult,
    messageEntriesResult,
    messageTemplatesResult,
    marketResult,
    preferencesResult,
  ] = await Promise.all([
    allRows(
      client.from("property_settings").select("*").eq("organization_id", org),
      "property_id",
    ),
    allRows(
      client
        .from("member_property_scopes")
        .select("*")
        .eq("organization_id", org),
      "property_id",
    ),
    allRows(
      client
        .from("inventory_types")
        .select("*", { count: "exact" })
        .eq("organization_id", org),
      "id",
    ),
    allRows(
      client
        .from("units")
        .select("*", { count: "exact" })
        .eq("organization_id", org),
      "id",
    ),
    allRows(client.from("guests").select("*").eq("organization_id", org), "id"),
    allRows(
      client
        .from("reservations")
        .select(
          "id,organization_id,property_id,guest_id,confirmation_code,arrival_date,departure_date,adults,children,status,source,currency,version,booked_at,cancelled_at",
          { count: "exact" },
        )
        .eq("organization_id", org),
      "id",
    ),
    allRows(
      client
        .from("reservation_units")
        .select("*", { count: "exact" })
        .eq("organization_id", org),
      "id",
    ),
    allRows(
      client
        .from("inventory_blocks")
        .select("*", { count: "exact" })
        .eq("organization_id", org),
      "id",
    ),
    allRows(
      client.from("rate_plans").select("*").eq("organization_id", org),
      "id",
    ),
    allRows(
      client.from("rate_day").select("*").eq("organization_id", org),
      "id",
    ),
    allRows(
      client
        .from("folios")
        .select("*", { count: "exact" })
        .eq("organization_id", org),
      "id",
    ),
    allRows(
      client
        .from("folio_items")
        .select("*", { count: "exact" })
        .eq("organization_id", org),
      "id",
    ),
    allRows(
      client.from("payments").select("*").eq("organization_id", org),
      "id",
    ),
    allRows(client.from("tasks").select("*").eq("organization_id", org), "id"),
    allRows(
      client.from("channel_connections").select("*").eq("organization_id", org),
      "id",
    ),
    allRows(
      client.from("channel_mappings").select("*").eq("organization_id", org),
      "id",
    ),
    allRows(client.from("jobs").select("*").eq("organization_id", org), "id"),
    allRows(
      client.from("audit_logs").select("*").eq("organization_id", org),
      "id",
    ),
    allRows(
      client.from("automation_rules").select("*").eq("organization_id", org),
      "id",
    ),
    allRows(
      client
        .from("onboarding_drafts")
        .select("*")
        .eq("organization_id", org)
        .eq("user_id", user.id),
      "id",
    ),
    allRows(
      client.from("conversations").select("*").eq("organization_id", org),
      "id",
    ),
    allRows(
      client.from("message_entries").select("*").eq("organization_id", org),
      "id",
    ),
    allRows(
      client.from("message_templates").select("*").eq("organization_id", org),
      "id",
    ),
    allRows(
      client
        .from("market_observations")
        .select("*", { count: "exact" })
        .eq("organization_id", org),
      "id",
    ),
    allRows(
      client
        .from("workspace_preferences")
        .select("*")
        .eq("organization_id", org)
        .eq("user_id", user.id),
      "id",
    ),
  ]);
  // Team (names/emails from auth.users) and unit attributes. Both are
  // optional extras: an older database without pms_team keeps working.
  const [teamResult, attributesResult] = await Promise.all([
    client.rpc("pms_team", { org }),
    client.from("unit_attributes").select("*"),
  ]);
  const team = z
    .array(
      z.object({
        userId: z.string(),
        name: z.string(),
        email: z.string().nullable(),
        role: z.string(),
        status: z.string(),
        propertyIds: z.array(z.string()),
      }),
    )
    .catch([])
    .parse(teamResult.error ? [] : teamResult.data);
  const attributes = new Map<string, Record<string, number>>();
  for (const row of attributesResult.error
    ? []
    : (attributesResult.data ?? [])) {
    const current = attributes.get(row.unit_id) ?? {};
    if (typeof row.value_json === "number") current[row.key] = row.value_json;
    attributes.set(row.unit_id, current);
  }
  const settings = value(settingsResult, "la configuración");
  const scopes = value(scopesResult, "los alcances");
  const inventoryTypes = value(inventoryTypesResult, "el inventario");
  const units = value(unitsResult, "las unidades");
  const guests = value(guestsResult, "los huéspedes");
  const reservations = value(reservationsResult, "las reservas");
  const reservationUnits = value(reservationUnitsResult, "las asignaciones");
  const blocks = value(blocksResult, "los bloqueos");
  const ratePlans = value(ratePlansResult, "los planes tarifarios");
  const rateDays = value(rateDaysResult, "las tarifas");
  const folios = value(foliosResult, "los folios");
  const folioItems = value(folioItemsResult, "los cargos");
  const payments = value(paymentsResult, "los pagos");
  const tasks = value(tasksResult, "las tareas");
  const channels = value(channelsResult, "los canales");
  const mappings = value(mappingsResult, "los mappings");
  const jobs = value(jobsResult, "los procesos");
  const audits = value(auditsResult, "la auditoría");
  const automations = value(automationsResult, "las automatizaciones");
  const drafts = value(draftsResult, "el avance de configuración");
  const properties = propertyRows.map((property) => {
    const configuration = settings.find(
      (item) => item.property_id === property.id,
    );
    const onboarding = primitiveRecord(property.onboarding_state);
    return {
      id: property.id,
      organizationId: property.organization_id,
      name: property.name,
      concept: property.concept as Concept,
      city: property.city,
      country: property.country_code,
      timezone: property.timezone,
      currency: property.currency,
      address: property.address,
      checkIn: configuration?.check_in_from?.slice(0, 5) ?? "15:00",
      checkOut: configuration?.check_out_until?.slice(0, 5) ?? "11:00",
      policy: configuration?.policy ?? "",
      taxBps: configuration?.tax_bps ?? 0,
      allowedOverbooking: configuration?.allowed_overbooking ?? 0,
      ...rentalSettings(configuration?.settings_json),
      onboardingComplete: onboarding.complete === true,
      version: property.version,
    };
  });
  const folioById = new Map(folios.map((folio) => [folio.id, folio]));
  return {
    workspacePreferences: value(preferencesResult, "tus preferencias").map(
      (row) => ({
        id: row.id,
        organizationId: row.organization_id,
        userId: row.user_id,
        version: row.version,
        updatedAt: row.updated_at,
        preferences: workspacePreferences(row.preferences),
      }),
    ),
    conversations: value(conversationsResult, "las conversaciones").map(
      (x) => ({
        id: x.id,
        propertyId: x.property_id,
        reservationId: x.reservation_id,
        status: x.status as "open" | "archived",
        assigneeId: x.assignee_id,
        version: x.version,
        updatedAt: x.updated_at,
      }),
    ),
    messageEntries: value(messageEntriesResult, "los mensajes").map((x) => ({
      id: x.id,
      propertyId: x.property_id,
      reservationId: x.reservation_id,
      direction: x.direction as Snapshot["messageEntries"][number]["direction"],
      status: x.status as Snapshot["messageEntries"][number]["status"],
      subject: x.subject,
      body: x.body,
      scheduledAt: x.scheduled_at,
      failureCode: x.failure_code,
      authorId: x.author_id,
      createdAt: x.created_at,
      version: x.version,
    })),
    messageTemplates: value(messageTemplatesResult, "las plantillas").map(
      (x) => ({
        id: x.id,
        propertyId: x.property_id,
        name: x.name,
        locale: x.locale,
        subject: x.subject,
        body: x.body,
        trigger: x.trigger as Snapshot["messageTemplates"][number]["trigger"],
        offsetDays: x.offset_days,
        version: x.version,
      }),
    ),
    marketObservations: value(marketResult, "el mercado").map((x) => ({
      id: x.id,
      propertyId: x.property_id,
      date: x.stay_date,
      observedOn: x.observed_on,
      source: x.source,
      market: x.market,
      currency: x.currency,
      adrMinor: x.adr_minor,
      occupancyBps: x.occupancy_bps,
      sampleSize: x.sample_size,
    })),
    schemaVersion: 2,
    organizations: organizationRows.map((organization) => ({
      id: organization.id,
      name: organization.name,
      currency: organization.default_currency,
      timezone: organization.default_timezone,
    })),
    users: [
      ...team
        .filter((member) => member.userId !== user.id)
        .map((member) => ({
          id: member.userId,
          name: member.name,
          email: member.email ?? "",
        })),
      {
        id: user.id,
        name:
          String(user.user_metadata.name ?? "").trim() ||
          user.email?.split("@")[0] ||
          "Anfitrión",
        email: user.email ?? "",
        assistantCompleted: Boolean(
          user.user_metadata.cala_assistant_completed,
        ),
      },
    ],
    memberships: team.length
      ? team.map((member) => ({
          id: `${org}:${member.userId}`,
          organizationId: org,
          userId: member.userId,
          role: member.role as Role,
          propertyIds: member.propertyIds,
          status: member.status as "active" | "suspended",
        }))
      : memberRows
          .filter((member) => member.organization_id === org)
          .map((member) => ({
            id: `${member.organization_id}:${member.user_id}`,
            organizationId: member.organization_id,
            userId: member.user_id,
            role: (roleRows.find((role) => role.id === member.role_id)?.key ??
              "viewer") as Role,
            propertyIds: member.all_properties
              ? []
              : scopes
                  .filter((scope) => scope.user_id === member.user_id)
                  .map((scope) => scope.property_id),
            status: member.status as "active" | "suspended",
          })),
    properties,
    inventoryTypes: inventoryTypes.map((item) => ({
      id: item.id,
      propertyId: item.property_id,
      name: item.name,
      sellMode: item.sell_mode as "unit" | "bed",
      maxOccupancy: item.max_occupancy,
      baseRateMinor: item.base_rate_minor,
      amenities: [],
      active: item.active,
    })),
    units: units.map((unit) => ({
      id: unit.id,
      propertyId: unit.property_id,
      inventoryTypeId: unit.inventory_type_id,
      name: unit.name,
      parentUnitId: unit.parent_unit_id,
      active: unit.active,
      housekeeping: unit.housekeeping_status as "clean" | "dirty" | "inspected",
      version: unit.version,
      ...(attributes.has(unit.id)
        ? {
            attributes: {
              bedrooms: attributes.get(unit.id)!.bedrooms ?? 0,
              beds: attributes.get(unit.id)!.beds ?? 0,
              bathrooms: attributes.get(unit.id)!.bathrooms ?? 0,
            },
          }
        : {}),
    })),
    guests: guests.map((guest) => ({
      id: guest.id,
      organizationId: guest.organization_id,
      firstName: guest.first_name,
      lastName: guest.last_name,
      email: guest.email ?? "",
      phone: guest.phone_e164 ?? "",
      country: guest.country_code ?? "",
      notes: guest.notes,
      version: guest.version,
      company: guest.company,
      address: guest.address,
      city: guest.city,
      region: guest.region,
      postalCode: guest.postal_code,
      language: guest.language,
    })),
    reservations: reservations.map((reservation) => {
      const assignment = reservationUnits.find(
        (item) => item.reservation_id === reservation.id,
      );
      const totalMinor = folioItems
        .filter(
          (item) =>
            folioById.get(item.folio_id)?.reservation_id === reservation.id &&
            item.type === "room",
        )
        .reduce((sum, item) => sum + item.total_minor, 0);
      return {
        id: reservation.id,
        organizationId: reservation.organization_id,
        propertyId: reservation.property_id,
        guestId: reservation.guest_id,
        inventoryTypeId: assignment?.inventory_type_id ?? "",
        unitId: assignment?.unit_id ?? null,
        ratePlanId: assignment?.rate_plan_id ?? "",
        arrival: reservation.arrival_date,
        departure: reservation.departure_date,
        adults: reservation.adults,
        children: reservation.children,
        status: reservation.status as ReservationStatus,
        source: reservation.source,
        confirmationCode: reservation.confirmation_code,
        currency: reservation.currency,
        totalMinor,
        notes: privateNotes.get(reservation.id) ?? "",
        version: reservation.version,
        createdAt: reservation.booked_at,
      };
    }),
    blocks: blocks.map((block) => ({
      id: block.id,
      propertyId: block.property_id,
      unitId: block.unit_id,
      arrival: block.start_date,
      departure: block.end_date,
      reason: block.reason,
      active: block.status === "active",
    })),
    ratePlans: ratePlans.map((plan) => ({
      id: plan.id,
      propertyId: plan.property_id,
      name: plan.name,
      active: plan.active,
    })),
    rateDays: rateDays.map((rate) => ({
      id: rate.id,
      propertyId: rate.property_id,
      ratePlanId: rate.rate_plan_id,
      inventoryTypeId: rate.inventory_type_id,
      date: rate.stay_date,
      amountMinor: rate.amount_minor,
      minStay: rate.min_stay,
      maxStay: rate.max_stay,
      closed: rate.closed,
      cta: rate.cta,
      ctd: rate.ctd,
      version: rate.version,
    })),
    folioItems: folioItems.map((item) => ({
      id: item.id,
      propertyId: item.property_id,
      reservationId: folioById.get(item.folio_id)?.reservation_id ?? "",
      description: item.description,
      amountMinor: item.total_minor,
      kind:
        item.type === "room" || item.type === "adjustment"
          ? item.type
          : "charge",
      createdAt: item.created_at,
    })),
    payments: payments.map((payment) => ({
      id: payment.id,
      propertyId: payment.property_id,
      reservationId: payment.reservation_id,
      amountMinor: payment.amount_minor,
      provider: payment.provider,
      externalId: payment.provider_payment_id,
      status: payment.status as "pending" | "succeeded" | "failed",
      createdAt: payment.received_at,
      concept: (payment.concept ?? "payment") as Payment["concept"],
      method: payment.method_type,
      note: payment.note ?? "",
    })),
    tasks: tasks.map((task) => ({
      id: task.id,
      propertyId: task.property_id,
      unitId: task.unit_id,
      kind: task.kind as "housekeeping" | "maintenance",
      title: task.title,
      status: task.status as "pending" | "in_progress" | "completed",
      priority: task.priority as "normal" | "high",
      assigneeId: task.assignee_id,
      version: task.version,
    })),
    channels: channels.map((channel) => ({
      id: channel.id,
      propertyId: channel.property_id,
      name: channel.name,
      provider: channel.provider,
      status: channel.status as "connected" | "disconnected" | "error",
      syncMode: channel.sync_mode as "ari" | "all",
      ownership: channel.field_ownership as "pms" | "channel",
      mappings: mappings
        .filter((mapping) => mapping.connection_id === channel.id)
        .map((mapping) => ({
          inventoryTypeId: mapping.inventory_type_id,
          externalId: mapping.external_id,
          ratePlanId: mapping.rate_plan_id,
        })),
      lastSync: channel.last_sync,
      lastError: channel.last_error_code,
      simulateFailure: false,
      version: channel.version,
    })),
    jobs: jobs.map((job) => ({
      id: job.id,
      organizationId: job.organization_id,
      propertyId: job.property_id,
      actorId: job.actor_id,
      type: job.type as Snapshot["jobs"][number]["type"],
      status: job.status as JobStatus,
      step: job.step,
      progress: job.progress,
      message: String(
        primitiveRecord(job.payload).message ?? "Proceso en curso",
      ),
      attempts: job.attempts,
      maxAttempts: job.max_attempts,
      runAfter: job.run_after,
      lockedUntil: job.locked_until,
      lockToken: job.lock_token,
      payload: primitiveRecord(job.payload),
      records: [],
      result: stringArray(job.result),
      lastError: job.last_error_code,
      createdAt: job.created_at,
      updatedAt: job.updated_at,
    })),
    audits: audits.map((entry) => ({
      id: entry.id,
      organizationId: entry.organization_id,
      propertyId: entry.property_id,
      actorId: entry.actor_id ?? "system",
      action: entry.action,
      entityId: entry.entity_id,
      requestId: entry.request_id,
      createdAt: entry.created_at,
      detail: auditDetail(entry.after_json),
    })),
    outbox: [],
    automations: automations.map((automation) => ({
      id: automation.id,
      propertyId: automation.property_id,
      name: automation.name,
      trigger: automation.trigger as Snapshot["automations"][number]["trigger"],
      action: automation.action as Snapshot["automations"][number]["action"],
      enabled: automation.enabled,
    })),
    drafts: drafts.map((draft) => ({
      id: draft.id,
      organizationId: draft.organization_id,
      userId: draft.user_id,
      step: draft.step,
      data: stringRecord(draft.data),
      updatedAt: draft.updated_at,
    })),
    analyticsComplete: [
      reservationsResult,
      reservationUnitsResult,
      inventoryTypesResult,
      unitsResult,
      blocksResult,
      foliosResult,
      folioItemsResult,
      marketResult,
    ].every(
      (result) => result.count !== null && result.count === result.data?.length,
    ),
    currentUser: {
      id: user.id,
      name:
        String(user.user_metadata.name ?? "").trim() ||
        user.email?.split("@")[0] ||
        "Anfitrión",
      email: user.email ?? "",
      assistantCompleted: Boolean(user.user_metadata.cala_assistant_completed),
    },
    permissions,
    currentOrganizationId: org,
    currentPropertyId,
    development: false,
    today: today(selectedProperty?.timezone),
  };
}

/** Rental mode and website link kept in property_settings.settings_json. */
function rentalSettings(raw: unknown): {
  rentalMode?: RentalMode;
  websiteLinked?: boolean;
} {
  const json =
    raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const mode = json.rentalMode;
  return {
    ...(mode === "whole" || mode === "rooms" || mode === "both"
      ? { rentalMode: mode }
      : {}),
    ...(json.websiteLinked === true ? { websiteLinked: true } : {}),
  };
}

/** Readable audit text: a `message` written by the command, else the raw JSON. */
function auditDetail(value: unknown) {
  if (value === null || value === undefined) return "Operación registrada";
  if (typeof value === "object" && !Array.isArray(value)) {
    const message = (value as Record<string, unknown>).message;
    if (typeof message === "string" && message) return message;
    if (!Object.keys(value).length) return "Operación registrada";
  }
  return JSON.stringify(value);
}
