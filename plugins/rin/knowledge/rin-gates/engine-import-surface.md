# Engine import surface — the engine modules the kept hooks may import

**The invariant:** the kept hooks import ONLY the set recorded here. An allowlist anchor records it, so a `subtree pull` renaming an imported module surfaces as a mismatch, not a silent break.

## Why this file exists

`.claude/hooks/**` is rin's harness surface; `.claude/tools/aidlc-*.ts` is the composed pristine engine. Every import that crosses from the first into the second is a dependency on upstream's internal module layout — a layout upstream may rename at any `git subtree pull` without notice, because it is not a published API. Nothing else in the repo records which crossings exist, so a rename would surface as a runtime `ERR_MODULE_NOT_FOUND` in whichever hook fired first, at whatever moment it fired.

This anchor is the record. On any vendor bump, diff the real crossings against this list: an entry that no longer resolves is a rename to reconcile deliberately, not a break to discover in production.

## The allowed set

`aidlc-lib.ts`, `aidlc-audit.ts`, `aidlc-graph.ts`, `aidlc-includes.ts`, `aidlc-state.ts` — derived by the procedure below. Record each module's importing files alongside it, re-derived on every vendor bump; the per-module importer counts are the drift signal, and a module whose count drops to 0 has been renamed or removed upstream.

A module reached only from a test stays in the allowed set: a test crossing is a real dependency on upstream's module layout and breaks identically on a rename.

## Derivation (re-runnable)

Grep tool, `output_mode: content`, over **both** importer roots — `.claude/hooks` and `plugins/rin/tools` (see "Importer roots" below for why the second is not optional):

```
from "\.\./tools/aidlc-|from "\./aidlc-|from "\.\./\.\./\.\./\.claude/tools/aidlc-|tools/aidlc-[a-z-]+\.ts"
```

Read every `../tools/aidlc-*.ts` specifier out of the hits; the distinct module basenames are the crossings. Ignore `./aidlc-*` hits — those are hook-to-hook imports inside `.claude/hooks/`, not engine crossings — and ignore string literals inside test fixtures (`aidlc-state-transition-guard.test.ts:70` names a command string, not an import).

Per-module importer counts are re-runnable the same way: a Grep over `.claude/hooks/` for the literal specifier, counted with `output_mode: files_with_matches`.

**Counting trap.** A naive grep for a module path returns far more lines than there are imports, because a hook that *guards against* a command names that command in its own test fixtures (e.g. `directStateTransition("bun .claude/tools/aidlc-state.ts approve")` — the command string is the hook's subject matter, not a dependency on the module). Count `import`/`from` specifiers, never bare path occurrences.

An anchor whose only job is to be diffed against reality cannot afford an undercount, which is why the record carries explicit per-module figures rather than a single total.

## Importer roots — why `.claude/hooks` alone is an undercount

The derivation was scoped to `.claude/hooks/**` because that was the only importer root when this anchor was written. It is no longer. `plugins/rin/tools/rin-harness-review-attempt-floor.test.ts` imports three symbols from `../../../.claude/tools/aidlc-lib.ts`, and a hooks-only grep returns zero hits for it — so a `subtree pull` renaming `latestMainWorkflowStageRunFloorForProject` or `aidlc-lib.ts` itself breaks that suite with this anchor reporting no change.

The crossing is legitimate and stays: the units under test live in the installed payload and have no test sibling there, and writing one into `.claude/tools/` would put rin-authored code in a tree `harness:package` regenerates. The packager excludes `*.test.*`, so the specifier never reaches an adopter's `dist/plugins/rin/<face>` tree — it is a repo-local, test-time arrow. What was wrong was not the import but the derivation's blindness to it.

**The general form, which is the reusable part:** a derivation scoped to one directory cannot see an importer class nobody thought to look for, and it reports clean while doing so. Re-derive the ROOTS, not just the hits — if a new importer root appears, this section is where it gets named.

**This is a record, not an enforced gate.** No check fails today when a crossing is added — adding one is a deliberate widening of rin's dependency on upstream internals, and this file is where that decision becomes visible for review. A future mechanical drift check would read its allowed set from here.
