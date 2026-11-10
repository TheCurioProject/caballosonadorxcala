# Migrar reservas de la casa completa a Smoobu

La herramienta está en `scripts/migrate-bookings-to-smoobu.mjs`. Se ejecuta desde la raíz del proyecto y usa el `DATABASE_URL` existente. No necesita cambiar la aplicación ni desplegar una versión nueva.

## Acceso

En Smoobu, abre **Avanzado → Claves API**, crea una clave con su secreto y guárdalos en `.env.local`:

```dotenv
SMOOBU_API_KEY=
SMOOBU_API_SECRET=
SMOOBU_APARTMENT_ID=
```

No guardes estos valores en archivos públicos. `.env.local` ya está excluido de Git. Se usa autenticación HMAC con los cuatro encabezados actuales de Smoobu; no se usa la autenticación antigua.

La cuenta debe ser **1939851**, que es la del widget. El destino debe pertenecer a los alojamientos del widget, tener capacidad para **12 huéspedes** y moneda **MXN**. Si solo hay una casa de esa capacidad, la herramienta puede identificarla; si hay varias, hay que indicar su ID en `SMOOBU_APARTMENT_ID`.

```sh
npm run smoobu:migrate -- --list-apartments
```

## Revisión y respaldo

```sh
npm run smoobu:migrate -- --audit
npm run smoobu:migrate -- --dry-run
```

`--audit` solo consulta la base de datos local. `--dry-run` también consulta Smoobu si las credenciales están configuradas, pero no crea reservas. Sin opciones se ejecuta una revisión, nunca una importación.

Cada ejecución guarda en `.smoobu-migration/<ejecución>/`:

- `source-backup.json`: copia de los registros originales y los bloqueos de calendario.
- `plan.json`: datos propuestos, advertencias, reservas ya existentes y conflictos.
- `smoobu-backup.json`: copia de los registros remotos consultados, cuando hay acceso API.
- `review.html`: informe visual privado para revisar los cruces de fechas, alojamientos y nombres.

La carpeta está excluida de Git y utiliza permisos privados. Los informes contienen datos de huéspedes. La consola muestra únicamente conteos, identificadores y rutas.

Solo se proponen reservas **CONFIRMED** de origen **MANUAL** o **WEBSITE**, incluidas las históricas. Las pendientes, canceladas y las procedentes de otros canales se omiten. Los bloqueos de calendario se respaldan y se contabilizan, pero no se convierten automáticamente en reservas.

## Datos que deben revisarse

Las correcciones se pueden guardar por ID local en `.smoobu-migration/overrides.json`, creado por la primera revisión. Los valores `null` significan «sin corrección». Ejemplo ficticio:

```json
{
  "123": { "adults": 4, "children": 2, "paid": true }
}
```

Los campos admitidos son `adults`, `children`, `paid`, `prepaymentMxn`, `guestName`, `guestEmail` y `guestPhone`. No rellenes datos que no hayas confirmado.

- **Huéspedes:** el sistema propio no guardaba su número. Se omiten adultos/niños cuando no se conocen y se añade una nota visible para revisión. Smoobu puede mostrar una ocupación por defecto, que no acredita la ocupación real.
- **Anticipos:** `depositPaid` se traslada como `prepayment` pagado, no como depósito de seguridad. Si está en otra moneda, hay que indicar el importe confirmado en MXN con `prepaymentMxn`.
- **Pago total:** una reserva confirmada no demuestra que esté totalmente pagada. Solo se marca pagada con un anticipo que cubre el total o una corrección `paid: true`. No se realiza ningún cobro.
- **Contacto:** se omite el correo de relleno `manual@reserva.com`. Smoobu puede exigir teléfono, correo o apellido según sus campos obligatorios; hay que completar los datos reales.
- **Servicios:** los servicios originales se conservan en las notas y en el respaldo. No se crean reservas nuevas de tours ni cargos adicionales.

## Importación

Después de revisar `plan.json` y los datos faltantes:

```sh
npm run smoobu:migrate -- --apply
```

Antes de cada envío se vuelve a consultar el origen y Smoobu. Los conflictos impiden importar. La herramienta reconoce la marca de origen o una coincidencia de huésped, fechas e importe; no modifica reservas existentes. También comprueba reservas de habitaciones relacionadas que bloqueen la casa.

Cada intento queda anotado antes del envío en `.smoobu-migration/ledger.json`. Después de crear una reserva, se consulta para verificar los datos y se guarda su identificador remoto. Si hay un fallo ambiguo de red o de verificación, se detiene el proceso y no se repite el POST a ciegas. El registro original permanece en la base de datos.

La API puede activar las automatizaciones configuradas en la cuenta de Smoobu al recibir nuevas reservas. Revisa allí las confirmaciones y recordatorios antes de importar si no deseas enviarlos de nuevo. La herramienta no llama a ningún endpoint de mensajes o cobros.

## Pruebas

```sh
npm run test:smoobu-migration
```

Referencias: [API de Smoobu](https://docs.smoobu.com/#create-booking), [autenticación HMAC](https://docs.smoobu.com/#hmac-authentication), [crear el acceso API](https://support.smoobu.com/hc/en-us/articles/360003170740-Use-the-Smoobu-API-get-an-API-key-set-up-webhooks-and-sign-your-requests).
