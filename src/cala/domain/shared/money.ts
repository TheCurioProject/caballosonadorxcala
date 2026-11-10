import { invariant } from "./errors";
/** Decimal string -> integer minor units; never multiply a floating-point input. */
export function parseMoney(value: string): number {
  const match = /^(\d{1,10})(?:[.,](\d{1,2}))?$/.exec(value.trim());
  invariant(
    match,
    "INVALID_MONEY",
    "Introduce un importe con un máximo de dos decimales.",
  );
  const minor =
    BigInt(match[1]) * 100n + BigInt((match[2] ?? "").padEnd(2, "0"));
  invariant(
    minor <= 100000000000n,
    "INVALID_MONEY",
    "El importe supera el límite permitido.",
  );
  return Number(minor);
}
export function moneyInput(minor: number): string {
  return `${Math.trunc(minor / 100)}.${String(minor % 100).padStart(2, "0")}`;
}
