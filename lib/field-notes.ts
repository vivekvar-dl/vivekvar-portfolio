export type FieldNote = {
  slug: string;
  title: string;
  excerpt: string;
  imageUrl?: string;
  content: string;
  topic: string;
  readTime: string;
  date: string;
};

export const fieldNotes: FieldNote[] = [
  {
    slug: "multilingual-tokenization-without-shortcuts",
    title: "Multilingual tokenization without shortcuts",
    excerpt: "Design notes from building indicTok across 22 Indian languages and 12 scripts.",
    topic: "NLP SYSTEMS",
    readTime: "6 min",
    date: "2026-09-18",
    content: `## The unit of computation is political

A tokenizer decides what a model gets to treat as a unit. For English-heavy corpora, the usual merge statistics often look reasonable. Across Indian scripts, the same defaults can turn a short word into a long sequence of fragments—and silently make training, inference, and evaluation more expensive.

## What we measured

For indicTok, the useful metric was not vocabulary size in isolation. I tracked fertility by language, script coverage, unknown-token behavior, and compression against a shared baseline. The goal was a vocabulary that stayed balanced across 22 languages rather than optimizing the average and hiding the tail.

## The systems lesson

Tokenization belongs in the performance budget. Longer sequences increase KV-cache pressure, attention cost, and serving latency. A language-aware tokenizer is therefore not only an NLP artifact; it is infrastructure for fairer and faster inference.

The durable pattern is simple: stratify every metric by language, inspect the failures visually, and treat script coverage as a release gate—not a footnote.`,
  },
  {
    slug: "evidence-first-rag-for-high-stakes-workflows",
    title: "Evidence-first RAG for high-stakes workflows",
    excerpt: "How retrieval, citations, and human review fit together when plausible text is not enough.",
    topic: "RETRIEVAL",
    readTime: "7 min",
    date: "2026-09-08",
    content: `## Retrieval is not the product

In a high-stakes workflow, the generated answer is only useful when a reviewer can trace every consequential claim back to source material. That changes the architecture: retrieval quality, evidence packaging, and abstention matter more than stylistic fluency.

## Build the evidence object first

Our pipeline treated each answer as a structured record: claim, source span, document identity, retrieval score, and validation state. The language model could compose a scorecard, but it could not erase provenance. Missing evidence became an explicit gap instead of an invitation to improvise.

## Human review as a model boundary

Human-in-the-loop does not mean placing an approval button after generation. The reviewer needs focused uncertainty: conflicting passages, weak retrieval, and unsupported claims. Surfacing those boundaries reduced hallucinations and made review materially faster.

The design rule I keep: when the cost of a confident error is high, optimize the interface for verification—not persuasion.`,
  },
];
