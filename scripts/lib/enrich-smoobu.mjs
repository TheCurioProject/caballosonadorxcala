import crypto from "node:crypto";
import { SafeError } from "./site-data-errors.mjs";
const connection = "smoobu-1939851";
const phone = (value) => {
  const text = String(value || "")
    .replace(/^00/, "+")
    .replace(/[\s().-]/g, "");
  return /^\+[1-9][0-9]{6,14}$/.test(text) ? text : null;
};
export function messageText(message) {
  if (String(message.message || "").trim())
    return String(message.message).trim();
  return String(message.htmlMessage || message.messageHtml || "")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/(p|div|li)>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim();
}
/** Import only provider identities, never fuzzy-match people by name or email. */
export async function enrichSmoobu(
  q,
  source,
  profiles,
  conversations,
  scope,
  ownerId,
) {
  if (profiles.accountId !== 1939851 || conversations.accountId !== 1939851)
    throw new SafeError("SOURCE_ACCOUNT_INVALID");
  const known = new Set(source.apartments.map((a) => Number(a.id)));
  const bookings = source.bookings.filter(
    (b) => known.has(Number(b.apartment.id)) && !b["is-blocked-booking"],
  );
  const profileMap = new Map(profiles.guests.map((g) => [Number(g.id), g]));
  const groupIds = [
    ...new Set(bookings.map((b) => Number(b.guestId)).filter(Boolean)),
  ];
  await q("select set_config('cala.bridge_origin','site',true) as origin");
  let profilesImported = 0,
    duplicatesMerged = 0,
    messagesImported = 0;
  for (const id of groupIds) {
    const profile = profileMap.get(id);
    if (!profile) throw new SafeError("SOURCE_GUEST_PROFILE_MISSING");
    const existing = await q(
      "select internal_id from public.external_identities where organization_id=$1::uuid and connection_id=$2 and provider='smoobu' and external_type='guest' and external_id=$3",
      [scope.organizationId, connection, String(id)],
    );
    if (existing.length) continue;
    const rows = bookings
      .filter((b) => Number(b.guestId) === id)
      .sort((a, b) => a.id - b.id);
    const candidates = [];
    for (const booking of rows) {
      const candidate = (
        await q(
          `select r.id as reservation_id,g.* from pms_private.smoobu_imports i join public.reservations r on r.id=i.entity_id join public.guests g on g.id=r.guest_id where i.external_id=$1 and i.kind='reservation' and r.organization_id=$2::uuid for update of g,r`,
          [booking.id, scope.organizationId],
        )
      )[0];
      if (!candidate || Number(candidate.version) !== 1)
        throw new SafeError("GUEST_EDITED_SINCE_IMPORT_REVIEW_REQUIRED");
      candidates.push(candidate);
    }
    const primary = candidates[0];
    const emails = Array.isArray(profile.emails)
      ? profile.emails.map(String)
      : [];
    const phones = Array.isArray(profile.telephoneNumbers)
      ? profile.telephoneNumbers.map(String)
      : [];
    const address = profile.address || {};
    const notes = [
      profile.notes,
      ...candidates.map((g) => g.notes),
      emails.length ? "Correos originales de Smoobu: " + emails.join(", ") : "",
      phones.length
        ? "Teléfonos originales de Smoobu: " + phones.join(", ")
        : "",
      address.country ? "País original: " + address.country : "",
    ].filter(Boolean);
    await q(
      `update public.guests set first_name=$1,last_name=$2,email=$3,phone_e164=$4,company=$5,address=$6,city=$7,postal_code=$8,country_code=$9,notes=$10,version=version+1 where id=$11::uuid and version=1 returning id`,
      [
        String(profile.firstName || primary.first_name).slice(0, 160),
        String(profile.lastName || primary.last_name || "").slice(0, 160),
        emails.find((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) ||
          primary.email,
        phones.map(phone).find(Boolean) || primary.phone_e164,
        String(profile.companyName || primary.company || "").slice(0, 160),
        String(address.street || primary.address || "").slice(0, 400),
        String(address.city || primary.city || "").slice(0, 160),
        String(address.postalCode || primary.postal_code || "").slice(0, 32),
        /^[A-Z]{2}$/.test(address.country || "")
          ? address.country
          : primary.country_code,
        [...new Set(notes)].join("\n\n"),
        primary.id,
      ],
    );
    const filteredProfile = {
      ...profile,
      bookings: Array.isArray(profile.bookings)
        ? profile.bookings.filter((b) => known.has(Number(b.apartment?.id)))
        : [],
    };
    for (const [index, booking] of rows.entries()) {
      const candidate = candidates[index];
      if (candidate.id !== primary.id) {
        await q(
          "update public.reservations set guest_id=$1::uuid,version=version+1 where id=$2::uuid returning id",
          [primary.id, candidate.reservation_id],
        );
        await q(
          "update public.reservation_guests set guest_id=$1::uuid where reservation_id=$2::uuid and guest_id=$3::uuid returning reservation_id",
          [primary.id, candidate.reservation_id, candidate.id],
        );
      }
      await q(
        "update pms_private.smoobu_imports set original_payload=original_payload||jsonb_build_object('_guestProfile',$1::jsonb) where external_id=$2 returning external_id",
        [JSON.stringify(filteredProfile), booking.id],
      );
      await q("select 1 as ok from pms_private.sync_pms_booking($1::uuid)", [
        candidate.reservation_id,
      ]);
    }
    for (const duplicate of new Set(
      candidates.map((g) => g.id).filter((g) => g !== primary.id),
    )) {
      const removed = await q(
        "delete from public.guests g where id=$1::uuid and version=1 and not exists(select 1 from public.reservations r where r.guest_id=g.id) and not exists(select 1 from public.reservation_guests rg where rg.guest_id=g.id) returning id",
        [duplicate],
      );
      duplicatesMerged += removed.length;
    }
    await q(
      "insert into public.external_identities(organization_id,connection_id,provider,external_type,external_id,internal_id) values($1::uuid,$2,'smoobu','guest',$3,$4::uuid) returning internal_id",
      [scope.organizationId, connection, String(id), primary.id],
    );
    profilesImported++;
  }
  for (const conversation of conversations.conversations) {
    const original = Number(conversation.thread.booking.id);
    const link = (
      await q(
        "select i.entity_id from pms_private.smoobu_imports i join public.reservations r on r.id=i.entity_id where i.external_id=$1 and i.kind='reservation' and r.organization_id=$2::uuid",
        [original, scope.organizationId],
      )
    )[0];
    if (!link) throw new SafeError("CONVERSATION_RESERVATION_MISSING");
    await q(
      "insert into public.conversations(organization_id,property_id,reservation_id) values($1::uuid,$2::uuid,$3::uuid) on conflict(reservation_id) do nothing returning id",
      [scope.organizationId, scope.defaultPropertyId, link.entity_id],
    );
    for (const message of conversation.messages) {
      const external = original + ":" + message.id;
      const duplicate = await q(
        "select internal_id from public.external_identities where organization_id=$1::uuid and connection_id=$2 and provider='smoobu' and external_type='message' and external_id=$3",
        [scope.organizationId, connection, external],
      );
      if (duplicate.length) continue;
      const body = messageText(message);
      if (!body) continue;
      if (body.length > 10000)
        throw new SafeError("SOURCE_MESSAGE_TOO_LONG_REVIEW_REQUIRED");
      if (![1, 2].includes(Number(message.type)))
        throw new SafeError("SOURCE_MESSAGE_DIRECTION_UNKNOWN");
      const created =
        typeof message.createdAt === "string" &&
        /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d(?::\d\d)?$/.test(message.createdAt)
          ? message.createdAt.replace("T", " ")
          : null;
      const id = crypto.randomUUID();
      await q(
        `insert into public.message_entries(id,organization_id,property_id,reservation_id,direction,status,subject,body,author_id,created_at) values($1::uuid,$2::uuid,$3::uuid,$4::uuid,$5,$6,$7,$8,$9::uuid,coalesce($10::timestamp at time zone (select timezone from public.properties where id=$3::uuid),now())) returning id`,
        [
          id,
          scope.organizationId,
          scope.defaultPropertyId,
          link.entity_id,
          Number(message.type) === 1 ? "inbound" : "outbound",
          Number(message.type) === 1 ? "received" : "recorded",
          String(message.subject || "Conversación importada de Smoobu").slice(
            0,
            200,
          ),
          body.slice(0, 10000),
          ownerId,
          created,
        ],
      );
      await q(
        "insert into public.external_identities(organization_id,connection_id,provider,external_type,external_id,internal_id) values($1::uuid,$2,'smoobu','message',$3,$4::uuid) returning internal_id",
        [scope.organizationId, connection, external, id],
      );
      messagesImported++;
    }
    await q(
      "update pms_private.smoobu_imports set original_payload=original_payload||jsonb_build_object('_conversation',$1::jsonb) where external_id=$2 returning external_id",
      [JSON.stringify(conversation), original],
    );
  }
  return { profilesImported, duplicatesMerged, messagesImported };
}
