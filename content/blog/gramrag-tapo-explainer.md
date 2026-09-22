# When Your Multimodal RAG Team Punishes Good Retrieval: GraMRAG and Topology-Aware Policy Optimization

This is the **DAG / multi-agent specialization** of the thesis in *Credit Assignment Is the Whole Game*: policy gradients still estimate how much each decision deserves under delayed, misspecified feedback. Here the episode is not a token chain or a flat tool transcript. It is a typed memory graph of vision and text hops, and the credit signal still arrives as one sparse terminal bit.

---

## Hook: the homework team that grades itself wrong

Imagine a school project team working from a messy photo of a whiteboard and a pile of library books. One kid crops the photo, hunts for matching diagrams online, and marks each find Hit or NoHit. Another kid turns the photo into a plain-English caption and keeps searching the web. A third kid checks whether the stack of evidence actually answers the question.

That team already looks like a multi-agent multimodal RAG system. The hard part is not "do more retrieval." It is remembering what each step depended on, and later deciding which steps deserved credit when the final answer is graded yes or no.

Zhongyu Wang's **GraMRAG** (Graph Memory-guided multi-agent RAG) builds that team as a living directed acyclic graph, then trains it with **Topology-Aware Policy Optimization (TAPO)**. The paper's claim is not that agents need more tools. It is that shallow retrieval, linear memory, and terminal-only rewards systematically mis-teach them.

Primary source: [GraMRAG on arXiv](https://arxiv.org/abs/2609.14066).

---

## Three failures stacked on one trajectory

Task 1 named the failure modes in the abstract: **state blindness**, **sparse terminal reward**, and **entangled credit**. GraMRAG lives where those three meet a multimodal multi-agent DAG.

### 1. Shallow retrieval (the cold-start cousin)

Many multi-agent multimodal RAG systems stop after too few hops. On hard questions that need tens of steps, they settle for partial evidence and call it done. Without occasional successful long traces, RL has no support to learn from. Same pathology as sparse-verifier cold start: you cannot assign credit to successes that never happen.

### 2. State blindness from linear or summary memory

Two common memory styles fail for the same reason:

- **History accumulation** (ReAct-style): glue every observation into one growing transcript.
- **Iterative summarization** (Mem1-style): compress observations so the context fits.

As rounds pile up, both styles lose the *path*: which action produced which observation, and which later step depended on which earlier one. The paper names this **state blindness**: the agent can no longer track historical retrieval paths, so it re-queries, re-retrieves, and burns steps on work it already did.

In Task 1 language: the chat transcript is an observation. The true state includes which crop and which Hit actually enabled the answer. Truncate or summarize that path away, and credit blames the wrong segments.

### 3. Sparse terminal reward and entangled credit on a DAG

Training often gives a single binary outcome: final answer correct or not. That signal is then smeared across the whole trajectory.

Two bad biases follow:

- On a **lucky wrong-path success**, dead-end explorations still get a positive update. Call those **false positive nodes**: steps that did not cause the correct answer but ride the terminal reward.
- On a **mostly-good failure**, productive Hits and relevant text retrievals still get a negative update. Call those **false negative nodes**: valuable steps punished because a later step blew the answer.

Good retrieval gets punished on failed trajectories. Junk gets rewarded on lucky ones. Flat reward-to-go is worse on a **DAG**: wall-clock order is not causal order.

---

## Key insight

If reasoning is a graph, credit assignment can read the graph.

GraMRAG records every agent step as a typed node and every action-observation dependency as an edge. At train time, TAPO walks that topology: on success it masks dead ends off the **critical path**; on failure it masks valuable Hits and relevant text so they are not negatively updated. The policy still uses clipped policy gradients plus a KL term toward a reference policy. The new piece is *which* node-level segments are allowed to move the parameters.

Reuse the Task 1 spine without re-teaching it: state, action, advantage. Here **state** is a serialized multimodal memory DAG (plus the current query and image). **Action** is a reasoning segment that constructs one typed node. **Advantage** (the \(\Psi\) slot) is still driven by a sparse terminal reward, but gated by a topology mask so entangled credit does not broadcast the terminal bit onto every node.

GRPO is the sibling packaging: group-relative baselines without a critic. TAPO is not a replacement for GRPO's group math. It is a mask on top of the same sparse-outcome RL family, using graph structure that a flat completion never had.

---

## How GraMRAG works (three parts)

### Part A: Vision-text bridged reasoning

**Visual Explorer.** Given image \(I\) and query \(q\), it proposes multi-scale crops (coarse context, fine entity patches). Each crop set drives a ReAct-style visual toolchain: image search, then webpage fetch into structured markdown.

After each visual observation, an independent **Hit / NoHit Judge** scores whether the retrieve matches the query entity (\(s_t \in \{0,1\}\)). Hits enter a valid evidence pool. NoHits trigger finer re-crops or query reformulation.

**Bridge.** A captioner writes a text description \(D\) of the image (entities, spatial relations, scene). The visual trajectory is rewritten for language: image tokens become \(D\), visual prompts drop out, but verified Hits and prior reasoning stay. That bridged context feeds the **Text Researcher**, a deep-research LLM with web search, for further textual hops.

**Evidence Validator.** It aggregates judge-verified visual evidence and the text trajectory, resolves conflicts, filters hallucinations, and emits the final answer over graph-structured memory rather than a flattened window.

### Part B: Multimodal memory graph as a dynamic DAG

The memory graph \(\mathcal{G}_t = (\mathcal{V}_t, \mathcal{E}_t)\) grows as agents act. Each node is a typed quadruple: modality tag, action/query descriptor, short summary, and (for visual nodes) a visual feature bank.

Five node types:

| Type | Role |
|------|------|
| `root` | Anchors \(q\) and \(I\) |
| `vis` | Visual Explorer step + Hit/NoHit + evidence |
| `bridge` (`brd`) | Caption \(D\), modality handoff |
| `txt` | Text Researcher web evidence |
| `ans` | Final answer from the Validator |

Edges encode sequential and cross-modal dependencies (visual chain, then bridge, then text chain, then answer). The result is a DAG of what actually happened, not a single scroll of chat.

**Why this fights state blindness:** any agent can query the structured history of actions and observations instead of inferring it from a compressed paragraph. Redundant retrieval becomes visible as a dead branch you already explored.

### Part C: TAPO at a glance

At each step the policy sees a serialized graph context and emits one reasoning segment that constructs one node. A full rollout is a sequence of node-level segments ending at `ans`. Terminal reward is still binary (\(r \in \{0,1\}\)). TAPO then builds a **gradient mask** \(\psi_t\): \(\psi_t = 1\) means *suppress* that segment's update; \(\psi_t = 0\) means update normally.

Same Monday instinct as masking prompt tokens and tool-result tokens in Task 1: do not let the optimizer train on positions where the credit story is a lie. TAPO extends the idea from sequence positions to DAG nodes.

---

## TAPO deep dive: two biases, one mask

### Definitions

- **State blindness:** memory forgets retrieval *paths*, not just facts. The policy re-searches what it already tried because \(s_t\) no longer encodes dependency structure.
- **Critical path:** on a successful trajectory (\(r=1\)), the backward walk from `ans` to `root` along edges that actually support the answer. Nodes on this path are the causal spine; nodes off it are topological dead ends.
- **False positive node:** a step that did not cause the correct answer but would receive positive credit under naive terminal broadcast (typical: dead-end crops on a lucky win).
- **False negative node:** a valuable step that would receive negative credit under naive terminal broadcast on a failed trajectory (typical: Hit=1 visual nodes, or text nodes a relevance judge marks on-query).

### Kid-flowchart version

Draw the homework DAG from root to answer.

**Case + (team got the answer right):** Trace backward from the answer to the root along the edges that actually support the answer. That chain is the **critical path**. Every node off that path is a topological dead end (a false positive candidate). Do **not** reinforce those dead ends just because the final grade was an A.

**Case − (team got it wrong):** Find the nodes that still did valuable work: visual nodes with Hit = 1, and text nodes a relevance judge marks as on-query. Those are false negative candidates. Do **not** punish them just because someone later wrote the wrong conclusion.

Everything else still gets the ordinary sparse-reward update. TAPO does not invent dense rewards. It refuses to lie with the terminal bit.

### Technical paragraph

Serialize \(\mathcal{G}_{t-1}\) into context \(C_t\). The policy segment \(s_t = (C_t, \zeta_t, A_t, O_t)\) maps onto node \(n_t\). After rollout, identify critical path \(\rho^*\) by walking backward from \(n_{\mathrm{ans}}\) to \(n_{\mathrm{root}}\) when \(r=1\). When \(r=0\), build valuable set \(\mathcal{N}_{\mathrm{val}}\): visual Hits and relevance-approved text nodes. The mask is

\[
\psi_t = \mathbb{I}(r=1)\cdot\mathbb{I}(n_t \notin \rho^*) + \mathbb{I}(r=0)\cdot\mathbb{I}(n_t \in \mathcal{N}_{\mathrm{val}})
\]

TAPO's objective is a gated clipped policy-gradient loss times \((1-\psi)\), minus a KL penalty to a reference policy. Dead ends on wins and valuable steps on losses contribute zero gradient. Credit follows causal structure in the DAG, not the length of the transcript.

Intuition, then the mask, then the gloss: naive RTG broadcasts \(r\) onto every node (entangled credit). Process rewards densify \(r_t\) but import judge error everywhere. TAPO keeps the sparse verifier honest and uses topology plus local Hit/relevance labels only to *gate* which segments move \(\theta\). KL-to-ref still constrains drift from the cold-start policy, same role as in PPO/GRPO packaging.

---

## Diagram description (for a figure you can draw)

**Left panel: memory DAG.** Boxes in a left-to-right flow: `root`, then several `vis` nodes (label Hit/NoHit on each), then singleton `bridge`, then several `txt` nodes, then `ans`. Solid edges = action-observation dependencies. Optional dashed side branch off a `vis` to show a dead-end crop that never feeds `ans`.

**Right panel: TAPO masks.** Same DAG twice.

- Top (success, \(r=1\)): highlight critical path in solid; gray-out / "mask \(\psi=1\)" on dead-end nodes.
- Bottom (failure, \(r=0\)): highlight Hit=1 / relevant `txt` nodes with "mask \(\psi=1\) (protect)"; leave junk steps unmasked for negative update.

Caption: "Same terminal bit; opposite topology rules."

---

## Results (light, from the paper)

On Qwen3-VL-8B-Instruct, GraMRAG reports an overall average of **53.5** across the paper's suite (text, visual document, and long video-corpus benches), ahead of VimRAG at **50.1** and Mem1 at **43.8** in the same table. On Qwen3-VL-4B-Instruct the overalls are **48.5** (GraMRAG) vs **45.6** (VimRAG).

Ablations (same paper, 8B setting) show progressive gains: long horizon + iterative memory about **44.2**; swap in graph memory to **47.5**; add GRPO to **49.3**; replace GRPO with TAPO to **53.5**. Treat these as the paper's reported figures under its binary reward-model metric, not as a universal ranking of every RAG system. The ablation spine is the useful story: long horizon, graph memory, GRPO, then TAPO each move the needle on this setup.

---

## Why it matters, and where it stops

GraMRAG's useful idea for practitioners is simple: **if you train multi-step retrieval with outcome-only RL, your memory representation is part of the optimizer.** A DAG gives you critical paths and valuable nodes to mask. A flat transcript mostly gives you noise.

Limits to own:

- **Inference cost.** Multi-agent collaboration costs more inference than single-shot RAG. That trade-off is easier to accept for deep research than for latency-bound chat.
- **Judge quality.** TAPO needs reliable Hit / relevance labels to protect valuable failure nodes. If those judges are wrong, you protect the wrong steps. Topology cannot rescue a broken verifier. Same honesty rule as process rewards in Task 1: gated credit imports judge error.
- **Scope.** TAPO is a credit mask for graph trajectories, not a claim that every agent should become a three-role multimodal orchestra.

---

## Link back to Task 1

*Credit Assignment Is the Whole Game* argued that PPO, GRPO, RLOO, process rewards, and tool-use RL are packaging choices around state, action, and advantage under delayed feedback. Its failure catalog already named state blindness, sparse terminal reward, and entangled credit, and flagged causal / DAG credit for tool graphs as curiosity work.

GraMRAG is that curiosity item made concrete for multimodal RAG:

| Task 1 concept | GraMRAG / TAPO gloss |
|---|---|
| State \(s_t\) | Serialized memory DAG + query/image, not a flat summary |
| Action \(a_t\) | Node-constructing reasoning segment (vis / bridge / txt / ans) |
| Sparse terminal reward | Binary answer correctness |
| Entangled credit | Naive RTG on all nodes, including dead ends and valuable failures |
| Masking | \(\psi_t\) gates dead ends on wins and valuable Hits on losses |
| KL-to-ref | Still in the TAPO objective |
| GRPO | Sibling baseline packaging; ablation baseline before TAPO |
| Cold start | Need long-horizon successes before topology can teach |

Same game. Different state definition. Credit finally allowed to read the graph.

---

## Takeaways

1. **State blindness** is what happens when memory forgets retrieval *paths*, not just facts: agents re-search what they already tried because the path left \(s_t\).
2. GraMRAG's vision, then caption, then text, then validate pipeline is how long-horizon research transfers into multimodal RAG without treating the whole image as one fragile query.
3. The multimodal memory DAG turns each hop into a typed node (`root` / `vis` / `bridge` / `txt` / `ans`) so later credit assignment has structure to read.
4. On success, TAPO masks **false positive** dead ends off the **critical path**; on failure, it masks **false negative** valuable Hits / relevant text so they are not negatively updated.
5. Ablations in the paper attribute clear gains to long horizon, graph memory, and TAPO over GRPO; expect higher inference cost than vanilla RAG, and treat Hit/relevance judges as part of the credit story.

---

## Further reading

1. Zhongyu Wang, *GraMRAG: Orchestrating Multi-Agent Multi-Step Reasoning via Graph Memory with Reinforcement Learning*. https://arxiv.org/abs/2609.14066
2. VimRAG (multimodal memory graph baseline the paper compares against). https://arxiv.org/pdf/2602.12735
3. OpenAI Spinning Up, policy optimization intro. https://spinningup.openai.com/en/latest/
4. Mem1 (iterative memory compression). https://arxiv.org/abs/2506.15841
5. *Credit Assignment Is the Whole Game: A Modern Map of Reinforcement Learning from Pong to Post-Training* (Task 1 spine: state, action, advantage, entangled credit, GRPO, masking, KL).

---

*Facts and numbers traced to arXiv:2609.14066. Vocabulary aligned with the Task 1 credit-assignment map; this article specializes rather than re-teaching the RL spine.*
