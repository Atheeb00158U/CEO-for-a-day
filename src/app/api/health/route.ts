// Railway's health check (railway.json): a new deploy gets traffic only once this answers, so a deploy never drops
// requests. It touches nothing else, so a slow database can't keep a good deploy from going live.
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({ ok: true });
}
