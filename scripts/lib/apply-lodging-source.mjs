import crypto from "node:crypto";
import {
  fingerprint,
  moneyMinor,
  sourceIsActive,
  sourceIsBlocked,
} from "./lodging-source.mjs";
import { SafeError } from "./site-data-errors.mjs";

// q is a parameterized PostgreSQL adapter. The caller owns the single transaction.
// This module never calls Smoobu, Stripe, email or any other external service.
export async function applyLodgingSource(
  q,
  plan,
  scope,
  content,
  { allowHistoricalAppend = false } = {},
) {
  const mapping = (
    await q(
      "select * from pms_private.site_property_map where property_id=$1::uuid",
      [scope.defaultPropertyId],
    )
  )[0];
  if (!mapping || mapping.organization_id !== scope.organizationId)
    throw new SafeError("TARGET_PROPERTY_INVALID");
  await q(
    "select pg_advisory_xact_lock(hashtextextended($1,0)) is null as locked",
    [scope.defaultPropertyId],
  );
  const sourceHash = fingerprint({ units: plan.units, rows: plan.rows });
  const priorState = (
    await q(
      "select source_fingerprint from pms_private.smoobu_import_state where key='casa-1939851'",
    )
  )[0];
  if (priorState && priorState.source_fingerprint !== sourceHash) {
    if (!allowHistoricalAppend)
      throw new SafeError("SOURCE_CHANGED_AFTER_IMPORT_REVIEW_REQUIRED");
    const priorRows = await q(
      "select external_id,fingerprint from pms_private.smoobu_imports",
    );
    const byId = new Map(plan.rows.map((row) => [row.id, row]));
    if (
      priorRows.some(
        (row) =>
          !byId.has(row.external_id) ||
          fingerprint(byId.get(row.external_id)) !== row.fingerprint,
      )
    )
      throw new SafeError("EXISTING_SOURCE_RECORD_CHANGED");
    const priorIds = new Set(priorRows.map((row) => row.external_id));
    const cutoff = plan.units
      .flatMap((unit) => unit.rates.map((rate) => rate.date))
      .sort()[0];
    if (
      plan.rows.some((row) => !priorIds.has(row.id) && row.departure > cutoff)
    )
      throw new SafeError("HISTORY_APPEND_MUST_NOT_ADD_FUTURE_RECORDS");
  }
  await q("select set_config('cala.bridge_origin','site',true) as origin");
  const productMap = new Map();
  for (const [index, unit] of plan.units.entries()) {
    const existing = (
      await q("select * from site.lodgings where source_apartment_id=$1", [
        unit.sourceId,
      ])
    )[0];
    if (existing) {
      if (existing.site_property_id !== mapping.site_property_id)
        throw new SafeError("TARGET_UNIT_CONFLICT");
      productMap.set(unit.sourceId, existing);
      continue;
    }
    const house = unit.kind === "whole_home";
    const type = house ? mapping.inventory_type_id : crypto.randomUUID();
    const physical = house ? mapping.unit_id : crypto.randomUUID();
    const id = crypto.randomUUID();
    const text = content.rooms[unit.photoRoom] || content.house;
    const capacity = unit.apartment.details.rooms.maxOccupancy;
    if (house) {
      await q(
        "update public.inventory_types set name=$1,base_rate_minor=$2::bigint,max_occupancy=$3 where id=$4::uuid returning id",
        [text.name.es, unit.baseRateMinor, capacity, type],
      );
      await q(
        "update site.properties set base_price=$1::numeric/100,base_capacity=$2,updated_at=now() where id=$3 returning id",
        [unit.baseRateMinor, capacity, mapping.site_property_id],
      );
      await q(
        "update public.properties set concept='boutique_hotel',version=version+1 where id=$1::uuid returning id",
        [mapping.property_id],
      );
    } else {
      await q(
        "insert into public.inventory_types(id,organization_id,property_id,name,code,sell_mode,max_occupancy,base_rate_minor,sort_order) values($1::uuid,$2::uuid,$3::uuid,$4,$5,'unit',$6,$7::bigint,$8) returning id",
        [
          type,
          mapping.organization_id,
          mapping.property_id,
          text.name.es,
          "SMOOBU-" + unit.sourceId,
          capacity,
          unit.baseRateMinor,
          index,
        ],
      );
      await q(
        "insert into public.units(id,organization_id,property_id,inventory_type_id,name,parent_unit_id) values($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6::uuid) returning id",
        [
          physical,
          mapping.organization_id,
          mapping.property_id,
          type,
          unit.apartment.name,
          mapping.unit_id,
        ],
      );
      await q(
        "insert into public.inventory_relations(organization_id,property_id,parent_unit_id,child_unit_id) values($1::uuid,$2::uuid,$3::uuid,$4::uuid) on conflict do nothing returning child_unit_id",
        [
          mapping.organization_id,
          mapping.property_id,
          mapping.unit_id,
          physical,
        ],
      );
    }
    await q(
      "insert into public.unit_attributes(unit_id,key,value_json) values($1::uuid,'smoobu_source',$2::jsonb) on conflict(unit_id,key) do nothing returning unit_id",
      [physical, JSON.stringify(unit.apartment)],
    );
    const photos = house
      ? ["/casaexterior.webp", "/casaestancia.webp", "/casacuartos.webp"]
      : Array.from(
          { length: 5 },
          (_, i) => `/rooms/room${unit.photoRoom}/${i + 1}.webp`,
        );
    const bathrooms = Number.isInteger(unit.apartment.details.rooms.bathrooms)
      ? unit.apartment.details.rooms.bathrooms
      : house
        ? 6
        : 1;
    const product = (
      await q(
        `insert into site.lodgings(id,site_property_id,unit_id,inventory_type_id,rate_plan_id,kind,slug,name_es,name_en,description_es,description_en,beds_es,beds_en,bathrooms,photo_keys,amenities,policy_es,policy_en,min_stay,turnover_nights,open_through,enabled,sort_order,source_apartment_id)
      values($1::uuid,$2,$3::uuid,$4::uuid,$5::uuid,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15::text[],$16::text[],$17,$18,2,0,$19::date,$20,$21,$22) returning *`,
        [
          id,
          mapping.site_property_id,
          physical,
          type,
          mapping.rate_plan_id,
          unit.kind,
          unit.slug,
          text.name.es,
          text.name.en,
          text.description.es,
          text.description.en,
          text.beds.es,
          text.beds.en,
          bathrooms,
          photos,
          house
            ? ["Alberca", "Cocina", "Wi-Fi", "Terraza"]
            : ["Wi-Fi", "Aire acondicionado", "Baño privado"],
          content.policy.es,
          content.policy.en,
          unit.openThrough,
          unit.baseRateMinor > 0,
          index,
          unit.sourceId,
        ],
      )
    )[0];
    productMap.set(unit.sourceId, product);
    const rates = unit.rates
      .filter((r) => r.priceMinor !== null)
      .map((r) => ({
        date: r.date,
        amount: r.priceMinor,
        min_stay: r.minStay,
        closed: r.priceMinor === 0,
      }));
    if (rates.length)
      await q(
        `insert into public.rate_day(organization_id,property_id,rate_plan_id,inventory_type_id,stay_date,amount_minor,currency,min_stay,closed)
      select $1::uuid,$2::uuid,$3::uuid,$4::uuid,r.date,r.amount,'MXN',r.min_stay,r.closed from jsonb_to_recordset($5::jsonb) as r(date date,amount bigint,min_stay integer,closed boolean)
      on conflict(rate_plan_id,inventory_type_id,stay_date,occupancy_key) do update set amount_minor=excluded.amount_minor,min_stay=excluded.min_stay,closed=excluded.closed,version=public.rate_day.version+1 returning id`,
        [
          mapping.organization_id,
          mapping.property_id,
          mapping.rate_plan_id,
          type,
          JSON.stringify(rates),
        ],
      );
  }
  // Availability not explained by a source stay must never become an invented
  // guest reservation or silently become sellable. A review is explicit.
  if (plan.unexplainedClosures.length)
    throw new SafeError("SOURCE_CALENDAR_CLOSURES_REQUIRE_REVIEW");
  let imported = 0,
    reused = 0;
  const blockIds = [];
  for (const row of plan.rows) {
    const hash = fingerprint(row);
    const prior = (
      await q("select * from pms_private.smoobu_imports where external_id=$1", [
        row.id,
      ])
    )[0];
    if (prior) {
      if (prior.fingerprint !== hash)
        throw new SafeError("SOURCE_CHANGED_AFTER_IMPORT_REVIEW_REQUIRED");
      if (!sourceIsBlocked(row)) {
        const paid =
          row["price-paid"] === "Yes"
            ? moneyMinor(row.price)
            : row["prepayment-paid"] === "Yes"
              ? moneyMinor(row.prepayment)
              : 0;
        if (paid > 0) {
          await q(
            "update site.reservas set deposit_paid=$1::numeric/100 where deposit_paid=0 and id=(select site_booking_id from pms_private.site_booking_map where reservation_id=$2::uuid) returning id",
            [paid, prior.entity_id],
          );
          await q(
            "update pms_private.site_booking_map set fingerprint=pms_private.site_booking_fingerprint(site_booking_id) where reservation_id=$1::uuid returning reservation_id",
            [prior.entity_id],
          );
        }
      }
      reused++;
      continue;
    }
    const product = productMap.get(Number(row.apartment.id));
    const active = sourceIsActive(row),
      blocked = sourceIsBlocked(row),
      entity = crypto.randomUUID();
    if (blocked) {
      await q(
        "insert into public.inventory_blocks(id,organization_id,property_id,unit_id,start_date,end_date,reason,status) values($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::date,$6::date,$7,$8) returning id",
        [
          entity,
          mapping.organization_id,
          mapping.property_id,
          product.unit_id,
          row.arrival,
          row.departure,
          "Bloqueo importado de Smoobu #" + row.id,
          active ? "active" : "released",
        ],
      );
      blockIds.push(entity);
    } else {
      const guest = crypto.randomUUID(),
        folio = crypto.randomUUID();
      const rawPhone = String(row.phone || "").trim();
      const cleanedPhone = rawPhone
        .replace(/^00/, "+")
        .replace(/[\s().-]/g, "");
      const phone = /^\+[1-9][0-9]{6,14}$/.test(cleanedPhone)
        ? cleanedPhone
        : null;
      const name = String(
        row.firstname || row["guest-name"] || "Huésped importado #" + row.id,
      ).trim();
      const last = String(row.firstname ? row.lastname || "" : "").trim();
      const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.email || ""))
        ? String(row.email).trim()
        : null;
      const total = moneyMinor(row.price),
        adults = Number(row.adults),
        children = Number(row.children || 0);
      const notes = [
        String(row.notice || ""),
        String(row["assistant-notice"] || ""),
        "Importado de Smoobu #" + row.id,
        total === 0
          ? "Importe original de hospedaje: 0 MXN. Confirma si corresponde a una estancia sin cargo o falta completar el importe."
          : "",
        row["reference-id"]
          ? "Referencia original: " + row["reference-id"]
          : "",
        "Los importes y estados de pago de origen se conservan sin afirmar verificación bancaria. La hora de creación sin zona se interpreta en el horario del alojamiento.",
      ]
        .filter(Boolean)
        .join("\n");
      await q(
        `insert into public.guests(id,organization_id,first_name,last_name,email,phone_e164,notes,language) values($1::uuid,$2::uuid,$3,$4,$5,$6,$7,$8) returning id`,
        [
          guest,
          mapping.organization_id,
          name,
          last,
          email,
          phone,
          rawPhone && !phone ? "Teléfono original: " + rawPhone : "",
          row.language === "es" ? "es" : "en",
        ],
      );
      const sourceName = String(row.channel?.name || "Direct booking");
      const source =
        sourceName === "Direct booking"
          ? "direct"
          : sourceName.toLowerCase().replace(/[^a-z0-9]+/g, "_");
      const created =
        typeof row["created-at"] === "string" &&
        /^\d{4}-\d\d-\d\d \d\d:\d\d(?::\d\d)?$/.test(row["created-at"])
          ? row["created-at"]
          : null;
      await q(
        `insert into public.reservations(id,organization_id,property_id,guest_id,confirmation_code,arrival_date,departure_date,adults,children,status,source,currency,total_minor,notes,booked_at,cancelled_at)
        values($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6::date,$7::date,$8,$9,$10,$11,'MXN',$12::bigint,$13,coalesce($14::timestamp at time zone (select timezone from public.properties where id=$3::uuid),now()),null) returning id`,
        [
          entity,
          mapping.organization_id,
          mapping.property_id,
          guest,
          "SMO-" + row.id,
          row.arrival,
          row.departure,
          adults,
          children,
          active ? "confirmed" : "cancelled",
          source,
          total,
          notes,
          created,
        ],
      );
      await q(
        "insert into public.reservation_units(organization_id,property_id,reservation_id,inventory_type_id,unit_id,rate_plan_id,arrival_date,departure_date,guests_count) values($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5::uuid,$6::uuid,$7::date,$8::date,$9) returning id",
        [
          mapping.organization_id,
          mapping.property_id,
          entity,
          product.inventory_type_id,
          product.unit_id,
          product.rate_plan_id,
          row.arrival,
          row.departure,
          adults + children,
        ],
      );
      await q(
        "insert into public.folios(id,organization_id,property_id,reservation_id,currency) values($1::uuid,$2::uuid,$3::uuid,$4::uuid,'MXN') returning id",
        [folio, mapping.organization_id, mapping.property_id, entity],
      );
      await q(
        "insert into public.folio_items(organization_id,property_id,folio_id,type,description,unit_amount_minor,total_minor,service_date) values($1::uuid,$2::uuid,$3::uuid,'room','Alojamiento importado de Smoobu',$4::bigint,$4::bigint,$5::date) returning id",
        [
          mapping.organization_id,
          mapping.property_id,
          folio,
          total,
          row.arrival,
        ],
      );
      const paid =
        row["price-paid"] === "Yes"
          ? total
          : row["prepayment-paid"] === "Yes"
            ? moneyMinor(row.prepayment)
            : 0;
      if (paid > 0)
        await q(
          "insert into public.payments(organization_id,property_id,reservation_id,provider,provider_payment_id,amount_minor,currency,status,method_type) values($1::uuid,$2::uuid,$3::uuid,'smoobu_import',$4,$5::bigint,'MXN','succeeded','imported_unverified') returning id",
          [
            mapping.organization_id,
            mapping.property_id,
            entity,
            "smoobu-" + row.id,
            paid,
          ],
        );
      await q("select 1 as ok from pms_private.sync_pms_booking($1::uuid)", [
        entity,
      ]);
      await q(
        `update site.reservas set "externalId"=$1,deposit_paid=$3::numeric/100 where id=(select site_booking_id from pms_private.site_booking_map where reservation_id=$2::uuid) returning id`,
        ["SMOOBU-" + row.id, entity, paid],
      );
      await q(
        "update pms_private.site_booking_map set fingerprint=pms_private.site_booking_fingerprint(site_booking_id) where reservation_id=$1::uuid returning reservation_id",
        [entity],
      );
    }
    await q(
      "insert into pms_private.smoobu_imports(external_id,entity_id,kind,fingerprint,original_payload) values($1,$2::uuid,$3,$4,$5::jsonb) returning external_id",
      [
        row.id,
        entity,
        blocked ? "block" : "reservation",
        hash,
        JSON.stringify(row),
      ],
    );
    imported++;
  }
  // Mirror physical block scope to the preserved site modules, while keeping the
  // legacy commercial closures separate. Trigger updates are still transactional.
  await q("select set_config('cala.bridge_origin','',true) as origin");
  for (const id of blockIds)
    await q(
      "update public.inventory_blocks set reason=reason where id=$1::uuid returning id",
      [id],
    );
  const start = plan.rows
    .map((r) => r.arrival)
    .concat(plan.units.flatMap((u) => u.rates.map((r) => r.date)))
    .sort()[0];
  const end = plan.rows
    .map((r) => r.departure)
    .concat(plan.units.map((u) => u.openThrough).filter(Boolean))
    .sort()
    .at(-1);
  if (start && end)
    await q(
      "select 1 as ok from pms_private.recalculate($1::uuid,$2::date,$3::date+1)",
      [mapping.property_id, start, end],
    );
  await q(
    "insert into pms_private.smoobu_import_state(key,source_fingerprint) values('casa-1939851',$1) on conflict(key) do update set source_fingerprint=excluded.source_fingerprint,completed_at=now() returning key",
    [sourceHash],
  );
  return { ...scope, ...plan.summary, imported, reused };
}
