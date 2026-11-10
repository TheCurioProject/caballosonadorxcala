export function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  return !!secret && (request.headers.get('authorization') === `Bearer ${secret}` || request.headers.get('x-cron-secret') === secret);
}
