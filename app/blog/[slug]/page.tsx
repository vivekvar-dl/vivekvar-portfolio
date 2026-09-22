/* eslint-disable @next/next/no-img-element */
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import rehypeKatex from "rehype-katex";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";

import { fieldNotes } from "@/lib/field-notes";
import { getPostBySlug } from "@/lib/posts";

export const dynamic = "force-dynamic";

function normalizeMathDelimiters(content: string) {
  return content
    .replace(/\\\[([\s\S]*?)\\\]/g, (_, equation: string) => `\n$$\n${equation.trim()}\n$$\n`)
    .replace(/\\\((.*?)\\\)/g, (_, equation: string) => `$${equation.trim()}$`);
}

async function resolveNote(slug: string) {
  const databasePost = await getPostBySlug(slug);
  if (databasePost?.status === "published") return { ...databasePost, topic: "FIELD NOTE", date: databasePost.updatedAt };
  return fieldNotes.find((note) => note.slug === slug) ?? null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const note = await resolveNote(slug);
  if (!note) return { title: "Note not found" };
  return { title: `${note.title} — V Sara Vivek`, description: note.excerpt, openGraph: { title: note.title, description: note.excerpt, images: [note.imageUrl || "/og.png"] } };
}

export default async function NotePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const note = await resolveNote(slug);
  if (!note) notFound();
  const readTime = "readTime" in note ? note.readTime : `${Math.max(2, Math.ceil(note.content.split(/\s+/).length / 220))} min`;

  return (
    <main className="article-shell">
      <nav className="article-nav"><Link href="/blog"><ArrowLeft size={14} />Blog</Link><span>{note.topic}</span></nav>
      <header className="article-header"><p className="eyebrow">{note.topic} · {readTime} READ</p><h1>{note.title}</h1><p>{note.excerpt}</p><div><time dateTime={note.date}>{new Date(note.date).toLocaleDateString("en", { day: "2-digit", month: "long", year: "numeric" })}</time><span>V SARA VIVEK</span></div></header>
      {note.imageUrl && <figure className="article-cover"><img src={note.imageUrl} alt={`${note.title} cover`} /></figure>}
      <div className="article-rule"><span /></div>
      <article className="article-body"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>{normalizeMathDelimiters(note.content)}</ReactMarkdown></article>
      <footer className="article-footer"><p>Working on a similar systems problem?</p><a href="mailto:vivekvarikuti22@gmail.com">Let&apos;s compare notes <ArrowUpRight size={14} /></a></footer>
    </main>
  );
}
