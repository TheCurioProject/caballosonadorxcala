// Driver errors can contain connection passwords, SQL and guest data. Only
// messages authored by this migration script and allowlisted codes may escape.
export class SafeError extends Error {}

const hints = new Map([
  [
    "ENOENT",
    "No se encuentra el archivo de respaldo. Primero completa db:export y comprueba la ruta indicada en --input.",
  ],
  [
    "EEXIST",
    "Ya existe un respaldo con ese nombre. Consérvalo y usa otro --name si necesitas una exportación nueva.",
  ],
  [
    "EACCES",
    "No hay permisos para leer o guardar el respaldo privado en esta carpeta.",
  ],
  [
    "EPERM",
    "El sistema impidió leer o guardar el respaldo privado. Revisa los permisos de la carpeta.",
  ],
  ["ENOSPC", "No hay espacio suficiente para guardar el respaldo."],
  [
    "ERR_MODULE_NOT_FOUND",
    "Falta una dependencia o un cliente Prisma generado. Revisa npm ci y npm run postinstall.",
  ],
  [
    "MODULE_NOT_FOUND",
    "Falta una dependencia o un cliente Prisma generado. Revisa npm ci y npm run postinstall.",
  ],
  [
    "P1000",
    "La base rechazó las credenciales. Revisa localmente el usuario y la contraseña de la conexión.",
  ],
  [
    "P1001",
    "No se puede conectar a la base. Revisa host, puerto, red y permisos de acceso remoto.",
  ],
  [
    "P1002",
    "La conexión con la base agotó el tiempo de espera. Revisa la red y la disponibilidad del servidor.",
  ],
  [
    "P1003",
    "La base indicada en la conexión no existe. Revisa el nombre de la base de datos.",
  ],
  ["P1010", "El usuario no tiene permisos para acceder a la base indicada."],
  [
    "P1011",
    "Falló la conexión TLS. Revisa la configuración SSL de la conexión.",
  ],
  [
    "P1013",
    "La URL de conexión no es válida. Revisa su formato y codifica los caracteres especiales de la contraseña.",
  ],
  [
    "P2021",
    "Falta una tabla necesaria. Revisa el esquema instalado antes de continuar; no sobrescribas la base anterior.",
  ],
  [
    "P2022",
    "Falta una columna necesaria. Revisa que el esquema instalado corresponda al proyecto.",
  ],
  [
    "P2024",
    "No se obtuvo una conexión disponible a tiempo. Revisa la disponibilidad y los límites de la base.",
  ],
  [
    "P2028",
    "La transacción no pudo completarse. Revisa la conexión y el resultado antes de reintentar.",
  ],
]);

export function migrationErrorMessage(error) {
  if (error instanceof SafeError) return error.message;
  for (const code of [error?.code, error?.errorCode]) {
    if (typeof code !== "string") continue;
    if (hints.has(code)) return `[${code}] ${hints.get(code)}`;
    if (/^P\d{4}$/.test(code))
      return `[${code}] La operación de base de datos falló. Revisa la configuración antes de continuar.`;
  }
  if (error instanceof SyntaxError)
    return "El respaldo no contiene JSON válido. Conserva el archivo original y revisa la exportación.";
  return "La operación de base de datos o archivo falló. No se muestran detalles privados del controlador.";
}
