/** Retry a read once when an idle database connection has been closed.
 * Never wrap writes or queries running inside an application transaction.
 */
export async function databaseRead<T>(read: () => Promise<T>): Promise<T> {
  try {
    return await read();
  } catch (error) {
    const code =
      (error as { code?: string; errorCode?: string }).code ||
      (error as { errorCode?: string }).errorCode;
    if (!["P1001", "P1002", "P1017", "P2024"].includes(code || "")) throw error;
    await new Promise((resolve) => setTimeout(resolve, 120));
    return read();
  }
}
