import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/cala/infrastructure/db/database.types";
import type { CommandGateway } from "@/cala/application/ports/command-gateway";
import { commandSchema } from "@/cala/application/schemas";
import { DomainError } from "@/cala/domain/shared/errors";
import { z } from "zod";
const commandErrors: Record<string, string> = {
  CHECKOUT_BUFFER_MANAGED:
    "Esta noche de preparación se gestiona con la reserva. Cambia o cancela la estancia para actualizarla.",
  SITE_INVENTORY_SCOPE:
    "La web vende esta villa completa. Utiliza su unidad vinculada; las habitaciones necesitan una configuración de inventario específica.",
  VERSION_CONFLICT:
    "Otra persona actualizó este registro. Recarga y revisa el cambio antes de guardar.",
  VERSION_CONFLICT_OR_MESSAGE_STATE:
    "El mensaje cambió o ya no es un borrador editable. Recarga la conversación.",
  UNIT_CONFLICT:
    "La unidad o un espacio relacionado ya está ocupado o bloqueado en alguna noche de la estancia.",
  NO_AVAILABILITY:
    "No hay disponibilidad para todas las noches de la estancia.",
  ROOM_NOT_READY:
    "La habitación de destino necesita limpieza antes del traslado.",
  IN_HOUSE_DATES:
    "Una estancia en casa solo puede cambiar de unidad conservando sus fechas.",
  STAY_DURATION:
    "El traslado conserva el número de noches. Edita la reserva para cambiar la duración.",
  NO_CHANGE: "La estancia ya está en esa unidad y esas fechas.",
  INVALID_UNIT: "Selecciona una unidad activa de esta propiedad.",
  INVALID_RATE:
    "El plan y el tipo de inventario deben pertenecer a esta propiedad.",
  RATE_RESTRICTION:
    "La estancia no cumple las restricciones de la tarifa de destino.",
  FOLIO_MISSING_OR_CLOSED:
    "El folio está cerrado o falta el cargo de alojamiento. Revísalo antes de recalcular.",
  MARKET_CURRENCY:
    "La moneda de las observaciones debe coincidir con la propiedad.",
  FUTURE_OBSERVATION: "La fecha de observación de mercado no puede ser futura.",
  DUPLICATE_OBSERVATION: "El lote contiene observaciones duplicadas.",
  UNKNOWN_VARIABLE:
    "La plantilla contiene una variable desconocida. Revisa las variables disponibles.",
  PAST_SCHEDULE: "La fecha de envío solicitada debe estar en el futuro.",
  RESERVATION_INACTIVE:
    "La reserva ya no está activa; puedes añadir una nota interna.",
  INVALID_PROVIDER: "Elige un canal compatible con el asistente de conexión.",
  INVALID_CHANNEL_SETTINGS: "Revisa el modo de sincronización del canal.",
  INVALID_MAPPING:
    "Cada vínculo necesita un alojamiento, una tarifa de esta propiedad y el ID del anuncio.",
  DUPLICATE_MEMBER: "Esta persona ya pertenece al equipo.",
  INVITE_USER_MISSING:
    "No se encontró la cuenta de esa persona. Vuelve a enviar la invitación.",
  SELF_ROLE: "No puedes cambiar ni retirar tu propio acceso.",
  OWNER_TRANSFER_REQUIRED:
    "El propietario no se modifica desde Equipo; la transferencia requiere un proceso aparte.",
  INVALID_ROLE: "Elige un rol válido.",
  INVALID_SCOPE: "Elige propiedades de esta organización.",
  DUPLICATE_UNIT: "Ya existe una unidad con ese nombre en la propiedad.",
  INVALID_PARENT: "Elige una casa de esta propiedad.",
  ROOM_HAS_ROOMS:
    "Esta casa tiene habitaciones registradas. Elimínalas primero o deja la casa fuera de servicio.",
  ROOM_HAS_RESERVATIONS:
    "Tiene reservas en su historial, así que no se puede borrar. Déjala fuera de servicio para dejar de venderla.",
  ROOM_ON_WEBSITE:
    "Se publica en la página web. Déjala fuera de servicio en lugar de borrarla.",
  ROOM_HAS_CALENDAR_SYNC:
    "Tiene un calendario iCal conectado. Desconéctalo antes de borrarla.",
  ROOM_HAS_CHANNEL:
    "Está vinculada a un canal de venta. Quita el vínculo antes de borrarla.",
  INVALID_RENTAL_MODE: "Elige cómo se renta la casa.",
  RENTAL_MODE_NEEDS_ROOMS:
    "Registra al menos una habitación dentro de la casa para elegir cómo se renta.",
  INVALID_INVENTORY: "Elige un tipo de alojamiento de esta propiedad.",
  NOT_FOUND: "El registro ya no existe. Recarga la vista.",
  DUPLICATE_MAPPING:
    "Cada alojamiento y cada ID del canal solo puede vincularse una vez.",
};
/** Production adapter: expose only whitelisted, actionable database errors. */
export class SupabaseCommandGateway implements CommandGateway {
  constructor(private client: SupabaseClient<Database>) {}
  async execute(input: unknown, idempotencyKey: string) {
    const command = commandSchema.parse(input);
    const { data, error } = await this.client.rpc("pms_command", {
      command: command as Json,
      idempotency_key: idempotencyKey,
    });
    if (error) {
      const known = commandErrors[error.message];
      throw new DomainError(
        known ? error.message : "DATABASE_COMMAND_REJECTED",
        error.code === "42501"
          ? "Tu acceso no permite esta operación. Revisa la propiedad y tus permisos."
          : (known ??
              "No se pudo guardar. Revisa el estado, los permisos y la disponibilidad."),
        error.code === "42501" ? 403 : 409,
      );
    }
    return z
      .object({
        id: z.string(),
        message: z.string(),
        warning: z.string().optional(),
        secretUrl: z
          .string()
          .regex(/^\/api\/ical\?token=[a-f0-9]{64}$/)
          .optional(),
      })
      .parse(data);
  }
}
