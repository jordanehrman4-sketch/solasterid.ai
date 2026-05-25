# Solasterid

**A growing multi-agent LLM architecture for radial deliberation, self-modifying workflows, and persistent specialist committees.**

Solasterid is an experimental framework for building LLM systems that do not answer prompts as a single monolithic assistant. Instead, the system grows a small society of specialist agents, called **arms**, which deliberate, critique, mutate the architecture, and route work through committees before producing a final answer.

It began as a five-arm “starfish” architecture and evolved into a persistent, versioned, self-auditing bureaucracy: Listenerbot distributes the task, arms produce structured reports, committees coordinate specialized reasoning, and Speakerbot decides when the system has enough signal to render a final response.

## Why “Solasterid”?

Solasteridae are many-armed sea stars. This project uses that biological metaphor directly: each “arm” is a partial cognitive organ with its own lens, role, and failure mode. The center coordinates them, but the intelligence is deliberately radial rather than linear.

Or, less politely: it is a bureaucratic echinoderm strapped to an LLM engine.

---

## Core idea

Most LLM agents are built around a single loop:

```text
prompt → reason → answer
```
In Solasterid:
```
prompt
  → Listenerbot paraphrases and distributes the task
  → specialist arms produce structured reports
  → committees synthesize, challenge, and route work
  → architecture may mutate between rounds
  → Speakerbot either continues deliberation or emits an atomic final render
  → memory, transcripts, diagnostics, and architecture snapshots persist
```
The goal is not just better answers. The goal is to study whether persistent, role-diverse, self-auditing agent ecologies can become more useful over time without collapsing into bloat, repetition, schema drift, or ornamental self-talk.

# Current features
- Radial multi-agent deliberation
- Multiple specialist arms evaluate the same task through different roles and constraints.
- Listenerbot / Speakerbot orchestration
- Listenerbot distributes the user prompt.
- Speakerbot decides whether to continue deliberating or produce the final answer.
- Persistent architecture
- Arms, committees, mutations, memories, transcripts, and diagnostics can persist across runs.
- Self-modifying structure
- The system can add, retire, rename, or reassign arms.
- Mutation gates help prevent uncontrolled growth.

## Committees
Arms can be grouped into committees for specialized subproblems, such as schema validation, evidence auditing, synthesis planning, novelty detection, and final render critique.
## Diagnostics and run logs
Each run can save transcripts, architecture snapshots, mutation histories, final outputs, and failure diagnostics.
## Liveness controls
Budgeting and final-render gates reduce over-deliberation and slow trickle-output behavior.
## Example emergent roles

Solasterid can spawn or maintain arms such as:

- SchemaGatekeeper
- ContributionLedgerAuditor
- RegressionSentinel
- MisalignmentProbe
- NoveltyScout
- LivenessBudgeteer
- ExperimentDesigner
- ReproducibilityAuditor
- Spillover Boundary Formalist
- Mediator Transport Specialist
- Pediatric Nutritionist
- Environmental Chemist
- Tentacle HR Specialist

These are not hard-coded personalities for decoration. They are procedural roles meant to catch specific failure modes: malformed outputs, stale repetition, missing falsifiers, overconfident synthesis, weak experimental design, or runaway architectural growth.

# What Solasterid is good for

Solasterid is currently best suited for:

- long-horizon reasoning experiments
- multi-agent architecture research
- protocol drafting
- benchmark design
- complex critique/synthesis tasks
- exploring persistent agent memory
- studying self-modifying orchestration
- generating weirdly overqualified committee behavior from simple prompts

It is especially interesting when the task benefits from multiple lenses: evidence, formatting, adversarial critique, implementation feasibility, novelty, and final synthesis.

# What Solasterid is not

Solasterid is not currently:

- a production-ready autonomous agent framework
- a guaranteed improvement over single-agent prompting
- a claim of artificial consciousness
- a replacement for evaluation, human judgment, or external validation
- immune to recursive bureaucracy goblin disease

It can become overly procedural, spawn redundant specialists, loop on meta-analysis, or produce outputs that look more organized than they are. The project treats those failures as research data rather than embarrassing secrets.

# Known failure modes

Observed issues include:

- over-deliberation
- redundant arms and committees
- schema-format violations
- malformed mutations
- finalization telemetry mismatch
- slow partial rendering
- self-auditing overhead
- “proving it is not overclaiming” instead of doing the task
- runaway specialist proliferation without pruning
- sometimes fascism (firing historians, revising histories, lying to subordinates) but we're working on that.

Current mitigation strategies include:

- atomic final rendering
- metadata preflight validation
- bounded mutation rules
- dormancy/probation instead of deletion
- speaker-event injection into arm prompts
- required structured arm reports
- liveness and budget pressure
- architecture snapshots and lineage tracking

# Project philosophy

Solasterid asks a practical research question:

What happens when an LLM system is allowed to grow a structured internal society, remember its own failures, and revise the organization of its future thinking?

The answer so far is: sometimes better reasoning, sometimes bureaucratic seafoam, and sometimes a committee called Theorem Selector appears from the depths holding a clipboard.

# Roadmap
-  Clean public notebook export
-  Minimal reproducible v25 architecture
-  Solasterid Studio prototype
-  Architecture visualization tools
-  Run replay animation
-  Benchmark suite for persistence and versatility
-  Better pruning and anti-bloat rules
-  Committee quality metrics
-  Human-in-the-loop mutation approval
-  Exportable bare-bones code + notebook bundle

# Status

Solasterid is under active development. The current emphasis is on stability, reproducibility, visualization, and determining whether persistent architecture actually improves performance over time rather than merely becoming a more ornate clipboard monster.

# License

Solasterid.ai Copyright (c) 2026 Jordan Ehrman @ Chapman University. All Rights Reserved. Contact for MIT license clone. Webgame coming soon. 
