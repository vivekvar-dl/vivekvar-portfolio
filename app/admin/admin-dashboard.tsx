"use client";

import { ArrowUpRight, Check, FileText, LogOut, Plus, Save, Trash2 } from "lucide-react";
import Link from "next/link";
import { FormEvent, useMemo, useState } from "react";

import type { BlogPost } from "@/lib/posts";

const emptyPost = { id: 0, title: "", slug: "", excerpt: "", imageUrl: "", content: "", status: "draft" as const, createdAt: "", updatedAt: "" };

export function AdminDashboard({ initialPosts }: { initialPosts: BlogPost[] }) {
  const [posts, setPosts] = useState(initialPosts);
  const [selectedId, setSelectedId] = useState<number>(initialPosts[0]?.id ?? 0);
  const [draft, setDraft] = useState<BlogPost>(initialPosts[0] ?? emptyPost);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const selected = useMemo(() => posts.find((post) => post.id === selectedId), [posts, selectedId]);

  function select(post: BlogPost) {
    setSelectedId(post.id);
    setDraft(post);
    setMessage("");
  }

  function createNew() {
    setSelectedId(0);
    setDraft(emptyPost);
    setMessage("");
  }

  function change<K extends keyof BlogPost>(key: K, value: BlogPost[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const response = await fetch(draft.id ? `/api/admin/posts/${draft.id}` : "/api/admin/posts", {
      method: draft.id ? "PUT" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(draft),
    });
    const result = (await response.json()) as { post?: BlogPost; error?: string };
    setSaving(false);
    if (!response.ok || !result.post) {
      setMessage(result.error ?? "Could not save this post.");
      return;
    }
    const saved = result.post;
    setPosts((current) => current.some((post) => post.id === saved.id) ? current.map((post) => post.id === saved.id ? saved : post) : [saved, ...current]);
    setSelectedId(saved.id);
    setDraft(saved);
    setMessage("Saved.");
  }

  async function remove() {
    if (!draft.id || !window.confirm(`Delete “${draft.title}”?`)) return;
    const response = await fetch(`/api/admin/posts/${draft.id}`, { method: "DELETE" });
    if (!response.ok) return setMessage("Could not delete this post.");
    const remaining = posts.filter((post) => post.id !== draft.id);
    setPosts(remaining);
    setSelectedId(remaining[0]?.id ?? 0);
    setDraft(remaining[0] ?? emptyPost);
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <main className="admin-shell">
      <header className="admin-topbar">
        <div><p className="eyebrow">VSV / PUBLISHING</p><h1>Blog console</h1></div>
        <div className="admin-actions"><Link href="/blog" target="_blank">View blog <ArrowUpRight size={14} /></Link><button type="button" onClick={logout}><LogOut size={14} />Sign out</button></div>
      </header>
      <div className="admin-workspace">
        <aside className="post-rail">
          <button className="new-post" type="button" onClick={createNew}><Plus size={15} />New document</button>
          <div className="post-count">{posts.length} {posts.length === 1 ? "document" : "documents"}</div>
          <ul>{posts.map((post) => <li key={post.id}><button className={post.id === selectedId ? "active" : ""} type="button" onClick={() => select(post)}><FileText size={15} /><span><strong>{post.title}</strong><small>{post.status} · {new Date(post.updatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}</small></span></button></li>)}</ul>
        </aside>
        <form className="post-editor" onSubmit={save}>
          <div className="editor-status"><span className={draft.status === "published" ? "status-live" : ""}>{draft.status === "published" ? "LIVE" : "DRAFT"}</span><span>{selected ? `DOC-${String(selected.id).padStart(3, "0")}` : "NEW-DOC"}</span></div>
          <label>Title<input value={draft.title} onChange={(event) => change("title", event.target.value)} onBlur={() => !draft.slug && change("slug", draft.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""))} placeholder="A precise, useful title" required /></label>
          <div className="editor-grid"><label>Slug<input value={draft.slug} onChange={(event) => change("slug", event.target.value)} placeholder="technical-note" required /></label><label>State<select value={draft.status} onChange={(event) => change("status", event.target.value as BlogPost["status"])}><option value="draft">Draft</option><option value="published">Published</option></select></label></div>
          <label>Abstract<textarea className="excerpt-input" value={draft.excerpt} onChange={(event) => change("excerpt", event.target.value)} placeholder="One sentence for the index and social cards." /></label>
          <label>Article image URL<input value={draft.imageUrl} onChange={(event) => change("imageUrl", event.target.value)} placeholder="https://… (shown below the article title)" /></label>
          <label className="markdown-field"><span>Document <small>Markdown supported</small></span><textarea value={draft.content} onChange={(event) => change("content", event.target.value)} placeholder={"## Start with the system\n\nWrite the technical argument, the evidence, and the trade-offs."} required /></label>
          <div className="editor-footer">{message && <span className={message === "Saved." ? "save-success" : "form-error"}>{message === "Saved." && <Check size={13} />}{message}</span>}<div><button className="delete-post" type="button" onClick={remove} disabled={!draft.id}><Trash2 size={14} />Delete</button><button className="admin-primary" type="submit" disabled={saving}><Save size={14} />{saving ? "Saving…" : "Save document"}</button></div></div>
        </form>
      </div>
    </main>
  );
}
