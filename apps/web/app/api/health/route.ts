export async function GET() {
  return Response.json({ ok: true, service: "hms-api", time: new Date().toISOString() });
}
