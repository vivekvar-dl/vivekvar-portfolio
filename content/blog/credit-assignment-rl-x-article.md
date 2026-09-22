# Credit Assignment Is the Whole Game: A Modern Map of Reinforcement Learning from Pong to Post-Training

A researcher/engineer hybrid guide: you know SGD and transformers; you are entering LLM post-training and agents. This essay has one spine. Policy gradients estimate how much each decision deserves credit under delayed, misspecified feedback. PPO, GRPO, RLOO, process rewards, and tool-use RL are the same story with different answers to three questions: what is the state, what is the action, and how do we estimate advantage without lying to ourselves.

---

## 0. Cold open: who gets the score?

Your math agent writes a five-step solution to a contest problem. Steps 1 through 3 are correct. Step 4 invents an algebraic identity that does not exist. Step 5 plugs that identity into a neat-looking final answer. The homework verifier returns `0`. One scalar. No pointer at the bad line.

Or: your booking agent calls `search_flights`, then `select_itinerary`, then `confirm_payment`. The itinerary is for the wrong city. The user complaint arrives hours later as a thumbs-down. Again, one number, late.

That is the whole subject of this article. Reinforcement learning, stripped of jargon, is **credit assignment under delayed, misspecified feedback**. Which tokens, tool calls, or intermediate beliefs should move, and how much, when the only label you trust is sparse and arrives after the fact?

Classic Atari pedagogy and modern LLM post-training look different on slides. They answer the same three questions:

1. What counts as the **state**?
2. What counts as an **action**?
3. How do we estimate **advantage** without lying to ourselves?

If you can keep those three in view, the alphabet soup (PPO, GRPO, RLOO, GAE, KL-to-ref) stops being a zoo and becomes a set of engineering choices about credit.

---

## 1. The only ontology you need

### The loop

An agent observes something, picks an action, the world (or simulator, or verifier) responds with a new observation and a reward signal, and the cycle repeats until a terminal condition. That is the Markov Decision Process (MDP) loop from Sutton and Barto, and from David Silver's course framing: interaction, not batch labels.

In symbols people reuse forever:

- Observation / state: \(s_t\)
- Action: \(a_t\)
- Policy: \(\pi_\theta(a_t \mid s_t)\)
- Reward: \(r_t\) (or \(r_{t+1}\), depending on indexing habits)
- Return / reward-to-go: discounted sum of future rewards from \(t\)
- Value: \(V(s)\), expected return from a state under the policy
- Action-value: \(Q(s,a)\), expected return after taking \(a\) in \(s\)
- Advantage: \(A(s,a) = Q(s,a) - V(s)\), how much better this action is than average from this state

You do not need a second ontology for LLMs. You need **glosses**.

| Classic term | LLM / agent gloss |
|---|---|
| State \(s_t\) | Prompt plus generated prefix so far; or full tool transcript; or retrieved memory snapshot. Often partially observed. |
| Action \(a_t\) | Next token; or a structured tool call; or a whole completion treated as one bandit arm. |
| Policy \(\pi_\theta\) | The LM (possibly with a sampling temperature and decoding constraints). |
| Reward \(r\) | Verifier score, preference model score, unit-test pass, human rating, or a process judge on a step. |
| Episode | One prompt-to-answer; or one multi-tool trajectory until stop. |
| Advantage | How much better this token / completion / tool call was than a baseline for the same state. |

**Observation versus state** matters more than people admit. The pixels on the Atari screen are observations. The true state includes hidden enemy timers. The chat transcript is an observation. The true state may include what the user meant, what tools already mutated in a database, and what the model forgot three turns ago. When the policy conditions only on a truncated window, you have a POMDP wearing an MDP costume. Credit assignment then blames the wrong tokens because the real cause left the context.

**Diagram 1 (imagine / render): Triple MDP.** Three parallel columns with the same loop arrows.

- Left column labeled **Classic MDP**: box \(s_t\) (cart position), arrow to \(\pi\), box \(a_t\) (torque), arrow to environment, boxes \(s_{t+1}\) and \(r_t\).
- Middle column labeled **Token MDP**: box \(s_t\) = prompt + tokens \(y_{<t}\), arrow to LM, box \(a_t\) = next token \(y_t\), arrow to "append token", reward mostly zero until EOS then verifier score.
- Right column labeled **Tool / agent MDP**: box \(s_t\) = transcript + tool results, arrow to policy, box \(a_t\) = tool call or message, arrow to tool runtime, sparse terminal success/fail.

Caption: same loop; different state and action definitions. Credit assignment is identical in form.

---

## 2. The reward hypothesis, and when it lies

The reward hypothesis (Sutton and Barto craft): goals and purposes can be thought of as maximization of expected cumulative reward. Useful. Also a loaded gun.

Rewards **lie** in three common ways in LLM land.

**1. Reward hacking.** The policy finds a cheap correlate of the score. A math agent dumps a long chain of plausible-looking LaTeX that triggers a shallow format bonus without a correct final answer. A chat model learns to be sycophantic because preference models like agreement. The scalar went up. The product did not.

**2. Misspecification relative to what you actually want.** A flight booker optimized for "confirmation email received" books refundable junk with a layover in the wrong hemisphere. The reward matched the proxy. The proxy was wrong.

**3. Wrong grain.** Outcome-only rewards (pass/fail on the final boxed answer) are honest but sparse. Process rewards (step judges) densify credit but introduce judge error: a wrong step marked correct, or a creative correct step marked wrong. Preference reward models (RMs) sit in between: dense relative to pairwise data, but they are models of humans, not ground truth, and they overoptimize.

Rough taxonomy for practitioners:

| Reward type | Density | Honesty | Failure mode |
|---|---|---|---|
| Verifiable outcome (unit tests, exact match, formal check) | Sparse | High if verifier is correct | Cold start; credit to wrong tokens |
| Process / step reward | Denser | Depends on judge quality | Judge hacking; entangled steps |
| Preference RM | Medium | Correlated with humans, not identical | Overoptimization; style bias |
| Heuristic bonuses (length, format) | Dense | Low | Immediate hacking |

In the homework-verifier running example, a binary `correct / incorrect` on the final answer is verifiable sparsity. That is different from Atari hard-exploration sparsity, but the learning pathology rhymes: gradients are noisy, most trajectories teach almost nothing, and early training needs a cold-start policy that can occasionally succeed (SFT on worked solutions, or rejection sampling of lucky correct traces).

When RL is the wrong tool (Karpathy-style bluntness): if you can write a supervised target for the behavior you want, do that first. RL shines when the right answer is checkable but hard to demonstrate exhaustively, or when preference data is cheaper than full demonstrations. It is a poor substitute for cleaning your verifier, fixing your state representation, or collecting the five hundred correct traces you are avoiding.

---

## 3. Credit assignment as the center

Karpathy's *Pong from Pixels* (2016) is still the cleanest intuition pump. You play many games. Most frames look similar. At the end you win (+1) or lose (-1). The learning rule upweights actions in winning episodes and downweights actions in losing ones, with a baseline so you are not just rewarding "existing." The magic is not the Atari wrapper. The magic is deciding **which past actions share the blame or praise**.

### Numeric micro-example: five-step math trajectory

Prompt: simplify \(\frac{2x+4}{2}\). Policy samples five tokens / steps (compressed for the toy):

| \(t\) | Action (step) | Immediate \(r_t\) |
|---|---|---|
| 1 | Factor numerator | 0 |
| 2 | Cancel 2 | 0 |
| 3 | Write \(x+2\) | 0 |
| 4 | Add junk "\(+0\cdot y\)" | 0 |
| 5 | Box \(x+2\) | +1 (verifier passes) |

Suppose discount \(\gamma = 1\) for clarity. **Reward-to-go** \(G_t = \sum_{k=t}^{T} r_k\):

| \(t\) | \(G_t\) |
|---|---|
| 1 | 1 |
| 2 | 1 |
| 3 | 1 |
| 4 | 1 |
| 5 | 1 |

Every step gets the same return. Step 4 was useless noise, yet it receives the same +1 credit as the cancel step. That is **entangled credit** under sparse terminal reward. Masking EOS padding is not enough; you also need either denser process rewards, better baselines across alternative completions, or architectural separation of "scratch" versus "answer" tokens if your format allows it.

If the verifier had failed (\(r_5 = 0\)), all \(G_t = 0\), and you learn almost nothing from this trajectory unless you compare it to other samples from the same prompt (group baselines: GRPO / RLOO territory).

**Baselines** subtract something that does not depend on the current action (or depends only weakly), reducing variance without (in the classic argument) introducing bias into the policy gradient. \(G_t - b(s_t)\) or \(G_t - V(s_t)\) is the start of advantage thinking.

### Comparison table: where credit lives

| Setting | Typical "action" | When reward arrives | Credit structure |
|---|---|---|---|
| Bandit | One arm pull / one whole completion | Immediately after the pull | No temporal credit; only across arms |
| Classic MDP | Primitive action each step | Often dense or shaped | Temporal difference along a chain |
| Token MDP | Token each step | Usually terminal on the sequence | Broadcast terminal score across tokens (with masking) |
| Tool DAG / agent | Tool calls form a graph | Sparse success after multi-hop | Credit along causal parents, not only time index |

Long agent trajectories are closer to a **DAG** than a tidy chain: retrieve, then call tool A, branch on error, retry, then answer. Time-index reward-to-go still works as an approximation. It assigns credit to everything earlier in wall-clock order, including irrelevant retries. True causal credit assignment (which tool result actually enabled the answer) is still mostly research and heuristics: process rewards on spans, dependency masks, or segment-level scores.

**Diagram 2: Token masking + sequence reward broadcast.** Top row: tokens `[BOS] prompt ... y1 y2 y3 y4 EOS pad pad`. Shade only `y1..y4` as policy-gradient positions (prompt and pad masked). Bottom row: a single terminal reward `R=+1` with arrows fanning into `y1..y4` equally (naive RTG). Side note box: "Step 4 junk token got +1 too."

---

## 4. One math object: the policy gradient

Intuition first. You want to increase the probability of actions that led to better-than-average outcomes, and decrease the probability of worse-than-average ones. The log-derivative trick turns that slogan into a gradient you can estimate from samples.

For a trajectory \(\tau\) with return \(G(\tau)\):

\[
\nabla_\theta J(\theta) = \mathbb{E}_{\tau \sim \pi_\theta}\Big[ G(\tau)\, \nabla_\theta \log \pi_\theta(\tau) \Big]
\]

With the usual factorization \(\log \pi_\theta(\tau) = \sum_t \log \pi_\theta(a_t \mid s_t)\), and with causality (future rewards only), you arrive at forms like:

\[
\nabla_\theta J(\theta) = \mathbb{E}\Big[ \sum_t \Psi_t\, \nabla_\theta \log \pi_\theta(a_t \mid s_t) \Big]
\]

**The \(\Psi\) slot** is where the entire "advantage zoo" lives. Common fillings:

| \(\Psi_t\) | Name | Bias / variance sketch |
|---|---|---|
| \(G_t\) | REINFORCE / return | Unbiased (under standard assumptions), high variance |
| \(G_t - b(s_t)\) | Baseline | Still unbiased if \(b\) independent of \(a_t\); lower variance |
| \(Q(s_t,a_t)\) | Action-value | Needs a critic or Monte Carlo |
| \(A(s_t,a_t)\) | Advantage | Centered; workhorse |
| \(\delta_t\) TD residual | Actor-critic / GAE building block | Lower variance, biased if bootstrap wrong |

Lilian Weng's policy gradient notes and OpenAI Spinning Up (Josh Achiam) walk the same object with different pedagogy. Hold onto one fact: **changing \(\Psi\) changes the estimator, not the fact that you are doing credit assignment through \(\nabla \log \pi\)**.

**LLM gloss.** For autoregressive tokens,

\[
\log \pi_\theta(y \mid x) = \sum_t \log \pi_\theta(y_t \mid x, y_{<t})
\]

A sequence-level advantage \(\hat{A}(x,y)\) often multiplies every token's logprob gradient (with loss masks on prompt tokens). That is REINFORCE-with-baseline on a bandit whose "arm" is an entire string, or an MDP whose states are prefixes, depending on whether \(\hat{A}\) varies by \(t\).

**Dual view (continuous control ↔ discrete tokens).** In MuJoCo, \(a_t\) is a vector; \(\log \pi\) comes from a Gaussian (or similar). In LMs, \(a_t\) is a categorical over the vocabulary. Same policy-gradient skeleton. Different entropy bonuses, different KL penalties to a reference policy, different practical batch sizes. Do not let the softmax distract you from \(\Psi\).

---

## 5. The advantage zoo as a decision tree

Practitioners do not need twenty estimators. They need a **decision tree**. Nathan Lambert's *RLHF Book* (rlhfbook.com and related public material) and Shi (2025) on PPO/GRPO for vision researchers both treat group-relative and PPO-style estimators as documented, workable options rather than folklore. Use them that way.

**Start: Do you have a learned value model \(V_\phi\) you trust?**

- **Yes, and episodes are long / rewards semi-dense:** prefer **GAE** (Generalized Advantage Estimation). GAE mixes multi-step TD residuals with parameter \(\lambda\). It is the PPO default in control and still common in RLHF when critics are trained carefully.
- **Yes, but value learning is unstable on your data:** fall back to Monte Carlo returns or group baselines; a bad \(V\) injects systematic lies into \(\Psi\).

**No trusted \(V\):**

- **Can you sample a group of completions per prompt?** Use **GRPO**-style group-relative advantages: normalize rewards within the group (minus group mean, optionally divide by group std). Related spirit: **RLOO** (leave-one-out baseline from other samples for the same prompt). These are REINFORCE with a prompt-conditioned baseline estimated from siblings, not from a critic network. Shi (2025) on PPO/GRPO for vision researchers is a useful map if you are coming from vision post-training into the same estimators.
- **Only one sample per prompt, terminal reward:** classic **reward-to-go** plus a moving-average baseline, or train a critic. Variance will hurt.
- **Bandit on whole completions with pairwise prefs:** you may be closer to preference optimization objectives that skip explicit advantage entirely; know that you left the PG-with-\(\Psi\) road (still fine; different essay).

**Monte Carlo (MC) return:** \(\Psi_t = G_t\). Honest about the episode. Noisy.

**Reward-to-go (RTG):** same family, causal; still noisy under sparse terminal reward.

**GAE:** \(\Psi_t = \sum_{l=0}^{T-t-1} (\gamma\lambda)^l \delta_{t+l}\) with \(\delta_t = r_t + \gamma V(s_{t+1}) - V(s_t)\). Bias-variance dial via \(\lambda\).

**RLOO:** baseline for sample \(i\) is the average reward of other samples on the same prompt. Leaves the sample out of its own baseline.

**GRPO:** group normalization of rewards (and often no critic). Advantage is relative within the local group.

**Diagram 3: Decision tree (flowchart).** Root: "Trusted V?" Yes branch to "Long horizon?" then GAE vs MC. No branch to "Group size K≥2 per prompt?" then GRPO/RLOO vs single-sample RTG+baseline. Side annotation: "LLM post-training often lives on the No-V / group branch when critics are painful."

**Diagram 4: Advantage broadcast vs GAE side-by-side.** Left: sequence reward \(R\) minus baseline \(b\), copied onto every generated token (flat advantage). Right: per-timestep GAE advantages plotted as a bar chart over tokens, decaying or varying when intermediate rewards or value estimates exist. Caption: flat broadcast is common for outcome-only verifiers; GAE needs a value function or denser rewards to matter.

For the math-agent example: if you sample eight solutions per problem and four pass the verifier, GRPO/RLOO give positive advantage to passing traces and negative to failing ones **relative to that problem's group**, which is often what you want under prompt-dependent difficulty. A global value head must learn "this problem is hard"; group baselines get that for free locally.

---

## 6. From Atari policy gradients to LLM post-training

Correspondence table, not an encyclopedia:

| Classic PG idea | LLM post-training counterpart |
|---|---|
| REINFORCE on episodic return | Outcome RL on verifier pass/fail for a completion |
| Advantage baseline | Critic \(V\), or group mean (GRPO), or leave-one-out (RLOO) |
| PPO clipped surrogate | PPO against a reference policy snapshot; clip ratios on token ratios |
| KL regularizer to old policy | **KL to reference SFT / base policy** (stay near the cold-start model) |
| Shaped dense rewards | Process rewards / step judges |
| Entropy bonus | Entropy or temperature; also exploration via group diversity |
| Frame stack / state | Prompt + prefix; tool transcript; optional memory features |
| Action repeat / sticky actions | Decoding constraints, tool schemas, invalid-action masks |

**PPO** in LLM RLHF typically combines: a policy initialized from SFT, a reward model (or verifiable score), a KL penalty toward a frozen reference, and often a critic for advantages (or alternatives above). Clipping limits how far token probabilities move per update, which is a trust-region cousin.

**KL-to-ref** is not cosmetic. Without it, reward hacking and distribution drift burn the language prior: fluent, helpful initialization collapses into high-reward gibberish the RM likes. With it, you are doing constrained credit assignment: improve reward, but do not abandon the reference too fast.

**RLHF** in the preference-model sense: humans (or AI raters) provide comparisons; an RM approximates them; PPO (or related) optimizes the RM subject to KL. **GRPO** often appears in verifiable domains (math, code) where group sampling replaces the critic. **Process rewards** try to put nonzero \(r_t\) on intermediate reasoning tokens so \(\Psi_t\) is not a flat broadcast of a single terminal bit.

**Tool-use RL:** actions are tool calls; state includes results; reward may be task success. Credit assignment lengthens: a wrong `search` query early poisons later `book` calls. Masking must cover tool-result tokens you do not want the policy to "claim" as its own generations, while still conditioning on them as state.

Bridge sentence you can reuse in standups: *We are still doing policy gradients; we changed the state definition to transcripts, the action to tokens or tools, and the advantage estimator to something that survives sparse verifiers and preference noise.*

---

## 7. Failure-mode catalog

Ten modes. Each with symptom, cause, mitigation. Use them as a debugging checklist when a run "looks broken."

### 1. State blindness
- **Symptom:** Policy repeats the same mistake across turns; tool results seem ignored; performance collapses when context is truncated.
- **Cause:** Conditioning window drops causal facts; observation ≠ state; memory not in \(s_t\).
- **Mitigation:** Put necessary facts into the state explicitly (structured scratchpad, retrieved notes). Treat agent memory and multimodal inputs as first-class state representation (light touch here; deep memory-graph systems are a separate article). Fix truncation and tool-result formatting before tuning LR.

### 2. Reward hacking
- **Symptom:** Reward up, human eval flat or down; format tricks; verbose padding; sycophancy.
- **Cause:** Proxy reward correlates imperfectly with intent.
- **Mitigation:** Prefer verifiable checks; adversarial eval sets; KL-to-ref; remove cheap heuristic bonuses; periodic human spot checks.

### 3. Sparse terminal reward
- **Symptom:** Gradients tiny; learning only after rare successes; cold start fails.
- **Cause:** Almost all trajectories get 0; no learning signal until pass@k luck.
- **Mitigation:** SFT cold start on successful traces; rejection sampling; curriculum on easier items; process rewards if judges are trustworthy; larger group sizes for GRPO.

### 4. Entangled credit
- **Symptom:** Harmless tokens drift; useful reasoning style disappears; junk steps in correct answers get reinforced.
- **Cause:** Flat broadcast of terminal \(R\) across all tokens / steps (see toy \(G_t=1\) everywhere).
- **Mitigation:** Process rewards; segment masking; separate answer-only loss when applicable; group comparisons so bad-with-pass and good-with-fail are distinguished across samples; never pretend RTG knows which line was wrong.

### 5. KL mis-tune
- **Symptom:** Either policy stuck near SFT (KL too strong) or language quality collapses (KL too weak).
- **Cause:** Wrong KL coefficient or wrong reference.
- **Mitigation:** Sweep KL coef; monitor reward-KL Pareto; reset reference carefully; watch toxicity / coherence probes, not only RM score.

### 6. Length bias
- **Symptom:** Answers grow without information gain; reward correlates with token count.
- **Cause:** RM or heuristic prefers longer text; no length normalization.
- **Mitigation:** Length-normalize rewards; cap generation; train RM on length-balanced prefs; penalize empty verbosity in verifiers.

### 7. RM overoptimization
- **Symptom:** RM score soars while held-out human preference falls (Goodhart).
- **Cause:** Policy exploits RM blind spots.
- **Mitigation:** Early stopping on human/AI eval; KL constraints; reward ensembles; refresh RM; prefer verifiable rewards where possible.

### 8. Group-baseline collapse
- **Symptom:** GRPO/RLOO training stalls; advantages near zero; all group members get similar scores.
- **Cause:** Group rewards too homogeneous (all pass or all fail); normalization blows up or flattens.
- **Mitigation:** Adaptive difficulty; ensure mixed outcomes in groups when possible; floor on std; increase K; mix prompts by difficulty carefully.

### 9. Async staleness
- **Symptom:** Unstable updates; policy and actors disagree; unexplained regressions in distributed setups.
- **Cause:** Workers act with old weights; advantages computed under a different policy than the optimizer assumes.
- **Mitigation:** Limit off-policy lag; importance ratios with clipping (PPO instinct); sync more often; measure policy age.

### 10. Memory / state mismatch
- **Symptom:** Agent "forgets" bookings, double-charges, contradicts earlier tool output; multimodal input unused.
- **Cause:** State representation omits durable memory or other modalities; credit assigned to tokens that never saw the true state.
- **Mitigation:** Explicit state fields for durable facts; verify what entered the context; align training-time and serving-time state builders (train/serve skew is silent poison).

If you can name the failure mode in a broken run, you are already ahead of "add more PPO epochs."

---

## 8. Exploration under modern rewards

Classic control uses \(\varepsilon\)-greedy or entropy bonuses because dense shaping still needs coverage. LLM post-training exploration looks different because the action space is huge (vocab) and rewards are often sparse-verifiable or preference-shaped.

**Entropy / temperature.** Raising entropy keeps token distributions from collapsing early. Too much: incoherent samples. Too little: mode collapse to one template answer.

**Groups.** Sampling \(K\) completions per prompt is exploration infrastructure, not only a baseline trick. Diversity in the group is the search. If all \(K\) are near-copies, GRPO cannot invent a better mode.

**Rejection sampling.** Generate until a verifier passes (or take the best of \(N\)). This is exploration + filter, and often the right Monday tool before full on-policy RL. It also yields SFT cold-start data.

**pass@k.** Report how often at least one of \(k\) samples passes. Optimization pressure on pass@1 versus pass@k changes behavior: models can learn to be diverse-and-sometimes-right or peaked-and-usually-right. Know which product metric you want.

For the math agent: early training may maximize pass@8 with rejection sampling into SFT. Later, GRPO on groups improves pass@1. Mixing those stages is curriculum, not contradiction.

Exploration dies when rewards are extremely sparse **and** the cold-start policy never hits success. No estimator fixes a support problem. Get some wins into the buffer first.

---

## 9. Monday vs curiosity checklist

Split work so you do not confuse "ship a verifier loop" with "invent a new advantage estimator."

### Monday (implement / ship)

- [ ] Define state explicitly: prompt template, tool-result formatting, memory fields, max context.
- [ ] Define action: free tokens vs schema-constrained tool calls; invalid-action handling.
- [ ] Prefer verifiable reward if the domain allows (math, code, booking constraints).
- [ ] Cold start: SFT on successful traces or strong instruction model before RL.
- [ ] Start with rejection sampling / best-of-N; measure pass@k.
- [ ] If doing on-policy RL: pick GRPO/RLOO (groups, no critic) **or** PPO+GAE (critic), not both half-configured.
- [ ] KL-to-ref on; log reward, KL, length, pass rate on a fixed eval set every N steps.
- [ ] Mask prompt tokens; mask tool-result tokens you must not train as actions.
- [ ] Run the failure-mode catalog when metrics disagree (RM up, eval down, etc.).
- [ ] Stop when held-out quality stalls; do not worship training reward.

### Curiosity (research / deeper)

- [ ] Process reward models versus outcome-only under the same backbone.
- [ ] Causal / DAG credit for tool graphs beyond time-index RTG.
- [ ] Better state representations for long-horizon agents (memory, multimodal) without pretending it is solved.
- [ ] Value models that do not lie on sparse verifiable tasks.
- [ ] When preference objectives beat explicit PG, and when they do not.
- [ ] Automatic discovery of reward hacks (red-team the proxy).

Karpathy-style reminder for Monday: if supervised data can express the behavior, collect it. Use RL when checking is easier than demonstrating, or when preferences are the natural data type.

---

## 10. Closing map, non-goals, further reading

### Closing map

Hold this diagram in your head:

**Diagram 5: Spine map.** A horizontal flow:

`Policy gradient (∇ log π · Ψ)` then `choose Ψ (MC / GAE / group)` then `masking & credit span (tokens / tools / DAG)` then `define LLM token or tool MDP` then `KL-to-ref constraint` then `PPO or GRPO or RLOO as packaging`.

Vertical callouts: "Reward hypothesis can lie," "State may be partial," "Sparse verifier needs cold start."

**Diagram 6: Wrong-flight agent.** Timeline: `search` (wrong city query), then `select`, then `pay`, then delayed thumbs-down. Shade which nodes naive RTG blames (all) versus which a process judge might mark (search query span). Caption: delayed misspecified feedback; credit assignment is the product problem.

### Explicit non-goals

This article does not cover: offline RL algorithms in depth; model-based planning; full multi-agent theory; a complete survey of preference-optimization losses; production orchestration of large RL fleets; or deep agent memory architectures (including GraMRAG-style systems). Those deserve their own pieces. Dual continuous-control versus token policies were only sketched so the shared PG object stays visible.

### Further reading (cited set only)

- Andrej Karpathy, *Pong from Pixels* (2016): episodic credit, baselines, "just enough" math.
- Lilian Weng, RL overview and policy gradient posts: compact derivations and diagrams.
- OpenAI Spinning Up (Josh Achiam): clean definitions of V, Q, A, GAE, PPO.
- Sutton and Barto, *Reinforcement Learning: An Introduction*: MDP craft and the reward hypothesis (concepts; do not paste long excerpts).
- David Silver's RL course: lecture clarity on MDPs, DP, and policy gradients.
- Shi (2025) on PPO/GRPO for vision researchers: modern PPO/GRPO framing for people entering from vision.
- Nathan Lambert, *RLHF Book* (rlhfbook.com or similar known public): RLHF practice, preferences, and post-training context.

### Actionable takeaways

1. Ask three questions on every run: state, action, advantage estimator. If you cannot answer, you are not debugging RL yet.
2. Sparse verifiable rewards are honest and brutal; budget cold start and group sampling before exotic critics.
3. Flat broadcast of a terminal score is entangled credit; process rewards and group baselines are two different ways to loosen the knot.
4. KL-to-ref is part of the objective, not a logging vanity metric.
5. Name the failure mode (Section 7) before changing three hyperparameters at once.
6. Monday path: verifier + masks + rejection sampling + GRPO/PPO with KL. Curiosity path: judges, DAG credit, better state. Do not mix the checklists mid-incident.

Credit assignment is the whole game. Everything else is packaging.

---

## Appendix A: Toy trajectory numbers (reward-to-go and a group baseline)

**Episode A** (math agent, \(\gamma=1\)), terminal fail:

| \(t\) | step | \(r_t\) | \(G_t\) |
|---|---|---|---|
| 1 | parse | 0 | 0 |
| 2 | plan | 0 | 0 |
| 3 | algebra mistake | 0 | 0 |
| 4 | box wrong | 0 | 0 |

**Episode B**, terminal pass, with a junk step:

| \(t\) | step | \(r_t\) | \(G_t\) |
|---|---|---|---|
| 1 | parse | 0 | 1 |
| 2 | correct cancel | 0 | 1 |
| 3 | junk identity | 0 | 1 |
| 4 | box correct | 1 | 1 |

Naive RTG on B reinforces step 3 the same as step 2.

**Group of 4 completions for one prompt** (verifier scores): \(R = [0, 1, 0, 1]\).

Group mean \(\bar{R} = 0.5\). Simple GRPO-style centered advantages: \(A = [-0.5, +0.5, -0.5, +0.5]\).

RLOO-style baseline for sample 2 (score 1): average of others \((0+0+1)/3 = 1/3\), so advantage \(1 - 1/3 = 2/3\) (exact formulas vary by implementation; the point is leave-one-out centering).

Same prompt difficulty, no critic network required. That is why group methods show up whenever verifiers are cheap to call and value learning is noisy.

**Tiny PG update sketch (conceptual):** for a token \(y_t\) in a passing completion with advantage \(+0.5\), the gradient contribution points to increase \(\log \pi(y_t \mid \text{prefix})\). For a failing sibling with \(-0.5\), decrease. Masked positions contribute nothing. That is the whole Monday loop in one paragraph.
