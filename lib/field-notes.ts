import creditAssignmentArticle from "@/content/blog/credit-assignment-rl-x-article.md?raw";
import gramragArticle from "@/content/blog/gramrag-tapo-explainer.md?raw";

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

const withoutTitle = (article: string) => article.replace(/^# .+\n+/, "");

export const fieldNotes: FieldNote[] = [
  {
    slug: "credit-assignment-is-the-whole-game",
    title: "Credit Assignment Is the Whole Game: A Modern Map of Reinforcement Learning from Pong to Post-Training",
    excerpt: "A researcher-engineer guide to policy gradients, PPO, GRPO, RLOO, process rewards, and tool-use RL through the lens of credit assignment.",
    imageUrl: "/credit-assignment-rl-cover.jpg",
    topic: "REINFORCEMENT LEARNING",
    readTime: "22 min",
    date: "2026-09-22",
    content: withoutTitle(creditAssignmentArticle),
  },
  {
    slug: "gramrag-topology-aware-policy-optimization",
    title: "When Your Multimodal RAG Team Punishes Good Retrieval: GraMRAG and Topology-Aware Policy Optimization",
    excerpt: "How graph memory and topology-aware policy optimization assign credit across long-horizon multimodal retrieval trajectories.",
    imageUrl: "/gramrag-tapo-cover.jpg",
    topic: "MULTIMODAL RAG",
    readTime: "12 min",
    date: "2026-09-22",
    content: withoutTitle(gramragArticle),
  },
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
