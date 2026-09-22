import { ArrowLeft, ArrowUpRight } from "lucide-react";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { fieldNotes } from "@/lib/field-notes";
import { listPosts } from "@/lib/posts";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Blog — V Sara Vivek",
  description: "Technical notes on LLM systems, retrieval, multilingual NLP, computer vision, and production AI.",
};

export default async function BlogPage() {
  const posts = await listPosts();
  const published = posts.map((post) => ({ ...post, topic: "FIELD NOTE", readTime: `${Math.max(2, Math.ceil(post.content.split(/\s+/).length / 220))} min`, date: post.updatedAt }));
  const notes = [...published, ...fieldNotes];

  return (
    <main className="blog-shell">
      <nav className="blog-topnav"><Link href="/"><ArrowLeft size={13} />Portfolio</Link></nav>
      <figure className="blog-banner"><Image src="/blog-banner.png" alt="Abstract white particle field on black" width={2172} height={724} priority /></figure>
      <header className="blog-identity"><div><h1>Blog</h1><p>Research, systems, and things learned while building.</p></div></header>
      <div className="blog-intro"><p>I write about model research, post-training, inference, retrieval, and the engineering details that decide whether an AI system works outside a notebook.</p></div>
      <section className="blog-list" aria-labelledby="blog-heading">
        <div className="section-heading"><h2 id="blog-heading">Writing</h2><span>{notes.length} posts</span></div>
        <ol>{notes.map((note) => <li key={note.slug}><Link href={`/blog/${note.slug}`}><span className="blog-post-copy"><strong>{note.title}</strong><span>{note.excerpt}</span></span><span className="blog-post-date"><time dateTime={note.date}>{new Date(note.date).toLocaleDateString("en", { month: "short", year: "numeric" })}</time><ArrowUpRight size={14} /></span></Link></li>)}</ol>
      </section>
      <footer className="blog-footer"><span>V Sara Vivek © 2026</span><a href="mailto:vivekvarikuti22@gmail.com">Email me <ArrowUpRight size={12} /></a></footer>
    </main>
  );
}
