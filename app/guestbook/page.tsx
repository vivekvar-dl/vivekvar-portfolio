import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { GuestbookWall } from "@/components/guestbook";
import { isAdminPageSession } from "@/lib/admin-auth";
import { countEntries, listEntries } from "@/lib/guestbook";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Guestbook — V Sara Vivek",
  description: "Everyone who stopped by, in their own hand.",
};

export default async function GuestbookPage() {
  const [entries, count, admin] = await Promise.all([listEntries(), countEntries(), isAdminPageSession()]);
  return (
    <main className="guestbook-shell">
      <nav className="blog-topnav"><Link href="/"><ArrowLeft size={13} />Portfolio</Link></nav>
      <GuestbookWall entries={entries} count={count} admin={admin} />
    </main>
  );
}
