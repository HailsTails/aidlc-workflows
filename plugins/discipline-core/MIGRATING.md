# Migrating from the standalone copy route

This page moves a repository from the older standalone route, which copied rule files into a harness folder and wired selected linter rules by hand, to discipline core. Follow the steps in order. Every command is run from the repository root. Stop at any "stop and ask" line and hand the question to the human; do not guess past it.

## 1. Detect the old install

Look for each of these and write down what you find:

| What | Where | Example |
| --- | --- | --- |
| Copied rule files | `.claude/`, `.codex/` or `.cursor/` under `knowledge/aidlc-shared/code-discipline/` | `.cursor/knowledge/aidlc-shared/code-discipline/cd-001-no-any.md` |
| Copied guides | the same folder | `standalone-adoption.md`, `standalone-cd-inventory.md`, `standalone-linter-options.md` |
| Copied tools tree | `.claude/tools/`, `.codex/tools/` or `.cursor/tools/` | `.cursor/tools/rin-harness-constitution-audit.ts` |
| Tool config | repository root | `harness.config.json` |
| Debt records | repository root | `.constitution-carve-outs/cd-<id>.json` |
| Structural records | repository root | `.constitution-authorised-locations/cd-<id>.json` |
| Hand-written linter rules | `biome.json`, `eslint.config.*`, `.oxlintrc.json` | `noExplicitAny`, `@typescript-eslint/no-explicit-any`, `typescript/no-explicit-any` |
| Compiler flags | every `tsconfig*.json` | the seven CD-3 flags |
| Scripts and hooks | `package.json` scripts, CI workflow, pre-push hook | `bun .cursor/tools/rin-harness-constitution-audit.ts`, `rin-harness-carve-out-decay.ts`, `rin-harness-hermetic-git-guard.ts` |
| Agent instructions | `AGENTS.md`, `CLAUDE.md`, `.cursor/rules/`, an adoption record | "read the selected discipline files before editing" |

The chosen disciplines are the `cd-NNN-*.md` files that were copied (CD-1, CD-3 and CD-46 in the old quick start), plus any CD named in a record file.

Stop and ask the human if the adoption record names disciplines that were not copied, or the copied files and the record disagree.

## 2. Install core and select the clauses

Do [ADOPTING.md](ADOPTING.md) steps 1, 2 and 4 (and 4a for any `eslint` clause). Leave the old files in place until step 6.

Map each chosen discipline to its clauses with this table. A discipline is adopted whole: select every mechanical clause it lists, or the check reports the rest as `uncovered`.

| Old CD | Clauses to select in `disciplines.json` |
| --- | --- |
| CD-1 | `CD-1#any-cast` audit, `CD-1#explicit-any` eslint, `CD-1#implicit-any-let` eslint |
| CD-3 | all seven `CD-3#...` clauses, audit; then move the flags out of `tsconfig.json` (step 4) |
| CD-46 | nothing to select: it applies to every file carve-out once the check runs with `--base-revision` |
| CD-16, CD-20, CD-24 | select their owners, CD-15, CD-19 and CD-23 |
| CD-35, CD-36, CD-37, CD-38 | not in core; keep their current handling |
| any other CD | every mechanical clause in `tools/discipline-core/rules/<ID>/README.md`'s Clauses table, with a mechanism that table lists |

Clauses whose mechanism is `review` are judgement clauses: do not put them in `disciplines.json`; list them in the agent instructions instead (step 6).

Stop and ask the human if a chosen CD is one of CD-35 to CD-38, or if selecting a whole discipline adds clauses the old route never checked and the first run shows findings for them: they decide whether to fix those findings, carve them out (step 3), or not adopt that discipline yet.

## 3. Convert the old records into exceptions

Run the check once with no exceptions file, to see what core finds:

```bash
node tools/discipline-core/core/check/check-command.ts --repo .
```

CD-3 findings on `tsconfig.json` are fixed in step 4, not recorded. Then write `discipline-exceptions.json` from the old records, using the format in [README.md](README.md#discipline-exceptionsjson):

- Each file in a `.constitution-carve-outs/cd-<id>.json` entry that core now flags becomes one `file-carve-out`: `clause` is the clause the finding names (for example `CD-15#loops`), `file` is the exact path.
- Each file in a `.constitution-authorised-locations/cd-<id>.json` entry that core now flags becomes one `authorised-location`.
- A listed file core does not flag gets no record: a record that exempts nothing is reported `stale` and fails the run.
- A finding in a file no old record lists is new debt: fix it, or record it only after the human approves.
- CD-1 refuses exceptions. A CD-1 finding must be fixed. Stop and ask the human if it cannot be fixed in this change.

Each converted record is imported: give it `provenance` naming the old record instead of a `whyChain`, and keep the old `reason`:

```json
{
  "kind": "file-carve-out",
  "clause": "CD-15#loops",
  "file": "src/legacy.ts",
  "reason": "Inherited for...of totals loop from the 2025 pricing import",
  "provenance": {
    "kind": "inherited-debt",
    "source": ".constitution-carve-outs/cd-15.json#0",
    "decision": "Initial adoption inventory accepted by pricing owner Sam on 2026-09-02; retire on touch"
  }
}
```

`source` is the old file and the entry's position in its array, counting from `0`. An authorised location uses `{ "kind": "existing-authorisation", "source": ".constitution-authorised-locations/cd-<id>.json#<index>" }`. Core accepts an imported record only while the `--base-revision` holds it unchanged or its `source` entry lists the record's file at that revision, so keep the old record files committed until step 6, and run every check in this migration with `--base-revision HEAD`. A record you write for new debt, or an imported record you later change, needs a full `whyChain` (five `why`/`because`/`evidence` steps, a `rootCause` and an `owner`): core refuses it as `import-unverified` otherwise.

Stop and ask the human if an old record has no `decision`. Never write a placeholder or a root cause that only says the check was failing: core refuses those as `invalidRecords`.

## 4. Replace the hand-written linter rules

The ESLint projection from step 2 now carries every `eslint` clause. Remove only the rules the old route added for the disciplines; keep every other rule the repository uses:

- `biome.json`: remove `suspicious.noExplicitAny` and `suspicious.noImplicitAnyLet`. If nothing else in the file was added for the trial, remove the file and the `@biomejs/biome` dev dependency the old quick start installed; otherwise keep it for its other rules.
- `eslint.config.*`: remove `@typescript-eslint/no-explicit-any` (and any other rule the old route added for a CD), and spread the projection last as [ADOPTING.md](ADOPTING.md#4a-set-up-eslint-for-eslint-clauses) shows.
- `.oxlintrc.json`: remove `typescript/no-explicit-any`; remove the file if it held nothing else.
- CD-3: core flags any of the seven strict flags written in a file named `tsconfig.json`, even when it is `true`, because the flags must be inherited, never set per project. Move them from every `tsconfig.json` into one shared base file with another name, for example `tsconfig.base.json`, and make each `tsconfig.json` extend it (`"extends": "./tsconfig.base.json"`). Keep every other compiler option where it is. Then run the repository's own typecheck, which must still pass.

Then re-run `project-command` and the check. With any `file-carve-out` recorded, pass `--base-revision`: without it core cannot tell whether a carved file was touched, reports `forfeiture-unmeasured` and fails. Locally, `HEAD` measures what is already committed:

```bash
node tools/discipline-core/core/check/project-command.ts --repo .
node tools/discipline-core/core/check/check-command.ts --repo . --base-revision HEAD
```

Stop and ask the human if a rule you are about to remove was there before the trial, or if you cannot tell which rules the trial added (the adoption record or `git log -p -- biome.json` usually says).

## 5. Prove the migration

Do [ADOPTING.md](ADOPTING.md#8-prove-one-failure-and-correction) step 8, the red/green probe, for one `audit` clause and, if any clause is `eslint`, one `eslint` clause (a flag case from that clause's `rules/<ID>/discipline.json`). Then run the check with no probe, with `--base-revision HEAD` if any file carve-out exists: it must print `verdict: pass` and exit `0`.

Stop here, do not remove anything, and ask the human if the check does not pass.

## 6. Remove the old route and repoint everything

Only after step 5 passes:

1. Delete the copied rule files and guides from step 1's harness folder (`.cursor/knowledge/aidlc-shared/code-discipline/` or its `.claude`/`.codex` equivalent).
2. Delete the copied tools tree and `harness.config.json`, unless anything else in the repository uses them.
3. Delete `.constitution-carve-outs/` and `.constitution-authorised-locations/`: their content now lives in `discipline-exceptions.json`.
4. In `package.json` scripts, CI and the pre-push hook, replace the old tool commands with the core check, as [ADOPTING.md](ADOPTING.md#5-run-the-check) step 5 shows; in CI pass `--base-revision` with the branch's base.
5. Rewrite the agent instructions to point at `tools/discipline-core/rules/` and the judgement rules, as ADOPTING step 5 and step 9 say, and remove any instruction to read the old copied files.
6. Run the check and the repository's own validation command again, then commit everything in one change.

Stop and ask the human if anything outside the old trial uses the copied tools or `harness.config.json`.

## 7. Known differences

| | Old route | Discipline core |
| --- | --- | --- |
| What is installed | rule text only; checks were the repository's own linters, plus an optional copied tools tree | one folder that runs every selected check |
| Selection | whole CD files, read by an agent; a check ran only if wired by hand | clauses in `disciplines.json`; every mechanical clause of an adopted discipline must be selected |
| First-adoption debt | inherited debt could be recorded without a why-chain | imported with `provenance` and no `whyChain`, accepted only while unchanged since `--base-revision`; new or edited exceptions need a five-step `whyChain` |
| CD-1 | no exemptions | no exemptions (`"exceptions": "refused"`) |
| CD-3 flags | merged into the shared `compilerOptions`, wherever they were | set only in a base file not named `tsconfig.json`; any of the seven in a `tsconfig.json` is a finding |
| Running with debt | the decay check needed a base ref | every run with a file carve-out needs `--base-revision` |
| Debt decay (CD-46) | optional `rin-harness-carve-out-decay.ts` run | built into every check run with `--base-revision` |
| Stale and unrecorded exceptions | not checked | fail the run, including linter ignores or disables with no record |
| Path matching | old tools matched records by path suffix | exact repository paths |
| Linter | Biome, ESLint or oxlint for explicit `any` only | ESLint through the generated projection; Biome and oxlint are not core mechanisms |
| CD-8 exhaustive switch | typed ESLint `switch-exhaustiveness-check` suggested | the audit's `switch-defaults` clause only; type-aware linting is not supported |
| Judgement rules | read by an agent on request | each rule page names a review lens in `methods/lenses/`; ADOPTING step 9 is the procedure |
