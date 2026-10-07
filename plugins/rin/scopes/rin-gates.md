---
name: rin-gates
plugin: rin
depth: Standard
keywords:
  - rin gate
  - gated spec pipeline
  - gate 0
  - gate 1
  - gate 2
  - gate 3
  - gate 4
  - gate 5
  - gate 6
description: Run one Slice through rin's own gated pipeline (Gate 0 → 6)
---

# rin-gates scope

The rin-gates scope runs a **single Slice** through rin's own gated
pipeline, expressed as AIDLC stages. It is NOT one of AIDLC's shipped
Ideation→Operation scopes: its stages ARE rin's gates, end to end —

```
Gate 0 reconcile → Gate 1 framing → Gate 2 plan-review → Gate 3 interface-lock → Gate 4 implement → Gate 5 review-cycle → Gate 6 operate
```

Rin's mental model is canonical here; AIDLC is the engine (ordered stage
walk, approval gate, sensors, conductor-as-arbiter, gate-completion side
effects). This scope selects the seven gate stages authored under the
canonical stages tree (`{{HARNESS_DIR}}/aidlc-common/stages/`) and compiled to the
canonical graph — rin-gates IS the graph the harness runs (the former
phase-mapped comparison baseline was dropped).

## Why these stages, why no others

The pipeline is the whole product. There is no Ideation discovery and no
per-Unit Construction fan-out — a Slice is already a scoped unit of work
when it enters Gate 0, review is the Gate-5 decorrelated cycle, and
operation is Gate 6 scoped to that one Slice. The seven gates are the
entire in-scope set; everything AIDLC ships beside them is SKIP.

## Membership

Keyword triggers: `rin gate`, `gated spec pipeline`, `gate N`. The seven
gate stages (rin-gate-0-reconcile, rin-gate-1-framing, rin-gate-2-plan-review,
rin-gate-3-interface-lock, rin-gate-4-implement, rin-gate-5-review-cycle,
rin-gate-6-operate) execute; nothing else is in scope.

## System of record (repo-SoR)

The **AIDLC workspace record dir owns the lifecycle and artifacts** for an
intent: stage + lifecycle (the engine's own
forward-only machine in `intents.json` + `aidlc-state.md` + `<record>/audit/`) AND
detail (the requirements, the design, the interface bundle, the implementation
plan, the logs). Any consumer-configured {{BACKLOG_STORE}} integration is an
**intake buffer**: eligible captures are promoted once at Gate 0 and dispositioned
according to that integration, without mirroring workflow state. Each gate's transition is the
engine's own `report --result approved` (Current Stage + a committed audit event);
there is no external store advancing the workflow's lifecycle.
