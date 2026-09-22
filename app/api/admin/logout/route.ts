import { clearAdminCookie } from "@/lib/admin-auth";

export async function POST() {
  const response = Response.json({ ok: true });
  response.headers.set("Set-Cookie", clearAdminCookie());
  return response;
}
