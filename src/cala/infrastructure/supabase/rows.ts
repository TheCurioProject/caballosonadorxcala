import { DomainError } from "@/cala/domain/shared/errors";
type Page<T> = {
  data: T[] | null;
  error: { message: string } | null;
  count?: number | null;
};
/** PostgREST caps each response. Never interpret the first page as the entire inventory. */
export async function allRows<T>(
  query: {
    order: (column: string) => {
      range: (from: number, to: number) => PromiseLike<Page<T>>;
    };
  },
  order = "id",
): Promise<Page<T>> {
  const data: T[] = [];
  const ordered = query.order(order);
  const size = 200;
  for (let offset = 0; offset < 100000; offset += size) {
    const page = await ordered.range(offset, offset + size - 1);
    if (page.error) return { data: null, error: page.error };
    if (!page.data)
      throw new DomainError(
        "WORKSPACE_READ_FAILED",
        "No se pudo completar la lectura.",
        503,
      );
    data.push(...page.data);
    if (page.count != null && data.length >= page.count)
      return { data, error: null, count: data.length };
    if (page.data.length === 0) {
      if (page.count != null && data.length < page.count)
        throw new DomainError(
          "WORKSPACE_READ_FAILED",
          "Los datos cambiaron durante la lectura. Vuelve a cargar.",
          503,
        );
      return { data, error: null, count: data.length };
    }
    if (page.count == null && page.data.length < size)
      return { data, error: null, count: data.length };
  }
  throw new DomainError(
    "WORKSPACE_LIMIT",
    "El espacio supera el límite de consulta. Contacta al administrador.",
    503,
  );
}
