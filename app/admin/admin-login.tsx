"use client";

import { ArrowLeft, KeyRound, LockKeyhole } from "lucide-react";
import Link from "next/link";
import { FormEvent, useState } from "react";

export function AdminLogin() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setLoading(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Sign in failed.");
      setLoading(false);
      return;
    }
    window.location.reload();
  }

  return (
    <main className="admin-auth-shell">
      <div className="admin-auth-card">
        <div className="admin-auth-mark"><LockKeyhole size={18} /></div>
        <p className="eyebrow">PRIVATE CONSOLE</p>
        <h1>Writer access</h1>
        <p className="admin-auth-copy">A server-protected workspace for publishing Vivek&apos;s blog.</p>
        <form onSubmit={submit}>
          <label>Username<input name="username" autoComplete="username" required /></label>
          <label>Password<input name="password" type="password" autoComplete="current-password" required /></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="admin-primary" disabled={loading} type="submit"><KeyRound size={15} />{loading ? "Verifying…" : "Enter console"}</button>
        </form>
        <Link className="admin-back" href="/blog"><ArrowLeft size={14} />Back to blog</Link>
      </div>
    </main>
  );
}
