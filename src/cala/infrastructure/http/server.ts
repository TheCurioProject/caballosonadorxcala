import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { randomUUID } from "node:crypto";
import { DomainError, invariant } from "@/cala/domain/shared/errors";
export async function body(request: Request) {
  invariant(
    Number(request.headers.get("content-length") ?? 0) <= 128000,
    "BODY_TOO_LARGE",
    "La solicitud es demasiado grande.",
    413,
  );
  const raw = await request.text();
  invariant(
    raw.length <= 128000,
    "BODY_TOO_LARGE",
    "La solicitud es demasiado grande.",
    413,
  );
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new DomainError("INVALID_JSON", "Solicitud inválida.");
  }
}
export function failure(error: unknown) {
  const requestId = randomUUID();
  if (error instanceof DomainError)
    return NextResponse.json(
      { code: error.code, message: error.message, request_id: requestId },
      { status: error.status },
    );
  if (error instanceof ZodError)
    return NextResponse.json(
      {
        code: "VALIDATION",
        message: "Revisa los campos indicados.",
        request_id: requestId,
        field_errors: error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  console.error(JSON.stringify({ requestId, code: "INTERNAL_ERROR" }));
  return NextResponse.json(
    {
      code: "INTERNAL_ERROR",
      message: "No pudimos completar la operación. Inténtalo de nuevo.",
      request_id: requestId,
    },
    { status: 500 },
  );
}
