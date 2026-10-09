import { and, count, desc, eq, gt, sql } from "drizzle-orm";

import { getDb } from "@/db";
import { guestbook } from "@/db/schema";
import { sha256 } from "@/lib/admin-auth";

const PUBLIC = {
  id: guestbook.id,
  name: guestbook.name,
  message: guestbook.message,
  signature: guestbook.signature,
  viewBox: guestbook.viewBox,
  createdAt: guestbook.createdAt,
};
export type GuestbookEntry = { [K in keyof typeof PUBLIC]: (typeof guestbook.$inferSelect)[K] };

// The pad draws "M x yQ x y x y…L x y" strokes; anything else is rejected.
const NUMBER = String.raw`-?\d{1,4}(?:\.\d{1,2})?`;
const PATH = new RegExp(`^(?:[MQL]${NUMBER}(?: ${NUMBER})*)+$`);
const VIEW_BOX = new RegExp(`^${NUMBER}(?: ${NUMBER}){3}$`);
const RECENT_LIMIT = 3; // signatures per IP every 10 minutes

export function cleanEntry(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const input = value as Record<string, unknown>;
  const name = String(input.name ?? "").trim();
  const message = String(input.message ?? "").trim();
  const signature = String(input.signature ?? "");
  const viewBox = String(input.viewBox ?? "");
  if (!name || name.length > 40 || !message || message.length > 120) return null;
  if (signature.length > 40_000 || !PATH.test(signature) || !VIEW_BOX.test(viewBox)) return null;
  return { name, message, signature, viewBox };
}

// ponytail: one page of 500, paginate if the book ever outgrows it.
export async function listEntries(limit = 500): Promise<GuestbookEntry[]> {
  try {
    return await getDb().select(PUBLIC).from(guestbook).orderBy(desc(guestbook.id)).limit(limit);
  } catch (error) {
    console.warn("Guestbook database is not ready yet", error);
    return [];
  }
}

export async function countEntries() {
  try {
    const [row] = await getDb().select({ n: count() }).from(guestbook);
    return row?.n ?? 0;
  } catch {
    return 0;
  }
}

// Returns null when this IP has already signed RECENT_LIMIT times in the last 10 minutes.
export async function createEntry(entry: NonNullable<ReturnType<typeof cleanEntry>>, ip: string) {
  const db = getDb();
  const ipHash = await sha256(`guestbook:${ip}`);
  const [recent] = await db
    .select({ n: count() })
    .from(guestbook)
    .where(and(eq(guestbook.ipHash, ipHash), gt(guestbook.createdAt, sql`datetime('now', '-10 minutes')`)));
  if ((recent?.n ?? 0) >= RECENT_LIMIT) return null;
  const [row] = await db.insert(guestbook).values({ ...entry, ipHash }).returning(PUBLIC);
  return row;
}

export async function deleteEntry(id: number) {
  const rows = await getDb().delete(guestbook).where(eq(guestbook.id, id)).returning({ id: guestbook.id });
  return rows[0] ?? null;
}
