import type { Metadata } from "next";

import { isAdminPageSession } from "@/lib/admin-auth";
import { listPosts } from "@/lib/posts";

import { AdminDashboard } from "./admin-dashboard";
import { AdminLogin } from "./admin-login";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Private publishing console", robots: { index: false, follow: false } };

export default async function AdminPage() {
  const authenticated = await isAdminPageSession();
  if (!authenticated) return <AdminLogin />;
  return <AdminDashboard initialPosts={await listPosts(true)} />;
}
