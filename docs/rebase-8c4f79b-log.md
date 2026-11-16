# Rebase of the rebuild foundation onto upstream 8c4f79b4b

This is the record of how the 126 upstream commits from `caea995ae` to `8c4f79b4b77c5a64738b01b350be2bf72c357dae` landed in the rebuild foundation's shape. It covers every conflict, how each was resolved, and every place where the shape had to change. Each upstream commit has a disposition in the [per-commit table](#every-upstream-commit). The [route ledger](rebase-8c4f79b-ledger.md) routes each commit's paths to their receiving owners and records where each replaced or mixed outcome landed.

## Refs

| What | Ref | Commit |
| --- | --- | --- |
| Upstream pin | `awslabs/aidlc-workflows` `main` | `8c4f79b4b77c5a64738b01b350be2bf72c357dae` (AIDLC_VERSION 2.11.4) |
| Previous pin | | `caea995ae` |
| Foundation before | `rebuild/foundation` | `965cbec73` (613 commits over `caea995ae`) |
| Rebased foundation | `study/foundation-8c4f79b` | `eb126c7be534890d88778388a442f8a76be708ab` |
| Tooling | `study/upstream-shape-tooling-8c4f79b` | this branch |
| Candidate on foundation | `study/upstream-shape-8c4f79b` | `6761b5dce692435a8aae33475539ba179d6b0a50` |
| Candidate on the pin | `ci-proof/upstream-shape-8c4f79b` | `541aca15081af28dc9a1f0e07b68ab81fd0b9437` (same tree `b26df2baa`) |
| Previous release | `v2.11.3` | `a8721be3631e6a254cf524ea57e5932aa56b4149` |

## Method

The method follows the rebaseline note's two tracks:

- **Retained runtime** (`core/`, `plugins/`, and the shipped asset folders under `harness/<host>/`) takes upstream's patches directly.
- **Replaced owners** are the retired manifests, emitters, onboarding fills, `biome.json`, and the build logic in `scripts/package.ts`. Each upstream outcome in one of these is ported test-first into the `src/` owner that replaced it. Deleted manifests and emitters are never resurrected, and host choices stay in `src/hosts/<host>/`, never as host-name branches in shared Projection or Packaging.

The merge is `916facba5` (`git merge 8c4f79b4b`, renames off). Rename detection paired the deleted `harness/<host>/onboarding.fills.ts` with the new `src/hosts/<host>/onboarding-fills.ts` and hid six of the overlaps, so the merge ran with `-X no-renames`. Each path was attributed with `git log caea995ae..8c4f79b4b -- <path>`.

After the merge:

- `core/` and `plugins/` equal `8c4f79b4b` byte for byte.
- `harness/` differs from `8c4f79b4b` only by the replaced owners foundation had already deleted.

Goldens were re-recorded from `8c4f79b4b`'s own build (`b1b93e8fa`). After that, each port was driven to green against them, and nothing was recorded from the port under test.

## Conflicts

`git merge-tree --write-tree --name-only --no-messages -X no-renames 965cbec73 8c4f79b4b` lists 25 conflicted paths.

| Id | Paths | Kind | Resolution |
| --- | --- | --- | --- |
| C1 | `biome.json`; `harness/{claude,codex,copilot,cursor,kiro,kiro-ide,opencode}/manifest.ts`; `harness/{codex,copilot,opencode}/emit.ts`; `harness/{codex,copilot,cursor,kiro,kiro-ide,opencode}/onboarding.fills.ts` (17) | delete/modify | All stay deleted (`git rm`). Each upstream outcome is ported into its owner (P2 to P8). The `biome.json` changes in 237a65f1a #3780, 575079bed #3863 and b650965ea #3933 only raise `maxSize` for grown `core/` files. Foundation's successor to that limit is the monolith-lines ratchet (see [Ratchets](#ratchets)). |
| C2 | `docs/guide/harnesses/kiro-ide.md` | content | Took upstream's stub (6e4a2e9ef #3729 merged the Kiro guides into `kiro.md`; 1ae045440 #3800 edited the stub). Foundation's delegate-shell-deny line edit moved into `kiro.md`, where that section now lives. |
| C3 | `scripts/package.ts`, `scripts/agent-knowledge.ts` | content | Kept foundation's thin entries. The outcomes upstream put there are ported: 9a62cf9f1 #3905 native permissions (P8), 3ca1893e6 #3726 Kiro preflight (P1), and ad4a0ad02 #3906's Copilot absorbed knowledge (P4). ad4a0ad02 also changed a comment in `agent-knowledge.ts`, which needs no port. |
| C4 | `docs/guide/harnesses/kiro.md` | follow-on | Not conflicted. It took C2's moved line. |
| C5 | `tests/unit/t239-documentation-parity.test.ts` | content | Union of both import sets. The conflicting hunk came from 161ddb823 #3916. These commits also touch the file: a12ccbc9f #3922, b63bb2061 #3928, 88a73e5a4 #3908, d864e729c #3910, 7752f3b6d #3925, 7649012be #3962, 8c4f79b4b #3990 and 451098163 #3751. Their test bodies merged unchanged. |
| C6 | `tests/unit/t181-conductor-skill-parity.test.ts`, `tests/harness/harness-matrix.ts` | content | t181 takes the union of both import sets. `harness-matrix.ts` kept foundation's host-module form in the conflict hunks, and 451098163 #3751's check is re-expressed against the registered host (P2, S4). |
| C7 | `docs/harness-engineering/09-porting-to-a-new-harness.md` | content | Kept foundation's rewritten host-module text. ad4a0ad02 #3906's line sat in the retired manifest section. |
| C8 | `tests/unit/t-question-options-fit-the-box.test.ts` | content | Kept foundation's host-module form. ad4a0ad02 #3906's Codex cases are re-expressed on the host token (P3). |

## Ports into replaced owners

| Port | Upstream | Receiver | Foundation commit |
| --- | --- | --- | --- |
| P1 | 3ca1893e6 #3726: Kiro helpers list knowledge folders with the file tool | First landed in shared Projection (S1, `3bf9e622c`), which was the wrong owner. Now `src/hosts/kiro/projection/knowledge-reading.ts` and `src/hosts/kiro-ide/projection/knowledge-reading.ts`, through the `KnowledgeReading` port (S7) | `3bf9e622c`, `eb126c7be` |
| P2 | 451098163 #3751: the Kiro skill is SKILL.md plus workflow.md | `src/hosts/kiro-ide/projection/skill-renderer.ts` `KIRO_IDE_SKILL_INPUTS` gains `skills/aidlc/workflow.md` after SKILL.md, and `tests/harness/harness-matrix.ts` checks `CONDUCTOR_SKILL_FILES` against the registered host's skill inputs (S4). Kiro CLI (V2) keeps one file. | `a55b09eea` |
| P3 | ad4a0ad02 #3906: Codex questions lettered A-C | `src/hosts/codex/host-data.ts` `OPTION_LETTERS: "A-C"`. In `t-question-options-fit-the-box`, the Codex cases read the host token instead of the retired `questionOptions` field. | `dbc15fbe8`, `a512e25d7` |
| P4 | ad4a0ad02 #3906: Copilot reviewers carry their checklist | The Copilot native agent document asks for knowledge `"absorbed"` instead of `"preflight-only"`. No host uses `"preflight-only"` now; the variant is kept and recorded here. | `f79da925a` |
| P5 | 986da3a04 #3799: the OpenCode adapter imports `core/hooks/review-freeze-command.ts` | `src/hosts/opencode/projection/settings-renderer.ts` relocates both engine leaf imports and refuses an adapter that drops either one. | `0aba2352c` |
| P6 | 6e4a2e9ef #3729, 56df50a28 #3820, 915d65c73 #3879, 6b2ac7d0a #3893, 4398ec484 #3904, 2dd100baf #3921: onboarding words and links | `src/hosts/{codex,copilot,cursor,kiro,kiro-ide,opencode}/onboarding-fills.ts`, plus the ACP line in `src/hosts/kiro-ide/host-data.ts` ("the AI-DLC guide for Kiro"). | `33a609c69` |
| P7 | 486c052da #3836, 6b2ac7d0a #3893, 4398ec484 #3904: prior whole-file hashes | `priorIntegrations` in `src/hosts/<host>/distribution.ts` gains these hashes:<br>• `.gitignore` for all seven hosts: claude `839f9801`, codex `c2b1232b`, copilot `0ece34fe`, cursor `55d4cfab`, kiro-ide `e7c17271`, kiro `6df8b41c` and `91f5070a`, opencode `c2b1232b`<br>• `AGENTS.md`: `6d3bf586` for codex, cursor, kiro, kiro-ide and opencode; `a885fe6b` for copilot | `c919167f6` |
| P8 | 9a62cf9f1 #3905: each tree's native onboarding says its own permissions | The `NativePermissions` union in Packaging; Codex owns its line (S2). | `a9c1d6bbe` |

Bridge characterisation re-pins (`6b59a8efa`) change no code. Three `src/` adapter tests pin runtime values they read through retained core bridges:

- 9a45be65a #3961 moves AIDLC_VERSION to 2.11.4, so the next preview is 2.11.5. This affects `legacy-channel.test.ts` and `legacy-version.test.ts`.
- 6e8d5c309 #3917 drops the bare `status` copy-channel allow. This affects `legacy-dispatcher.test.ts`.

4397f483d #3805 changed only a comment in the retired Codex emitter, so it needs no port.

One port was found by fork CI rather than by the merge. ad4a0ad02 #3906 added the t294 case "a Harness CLI row and setup's runtime issue show the CLI's version alone, on every harness". It lists the harnesses whose `harness/<name>/manifest.ts` exists. The file merged cleanly, but with the manifests retired the list was empty, and the case failed on CI (unit-9, 1 of 199). `7aac16444` reads the same seven names from `tests/harness/harness-matrix.ts`, as the other ported per-harness tests do. No other foundation test still reads a retired manifest (`git grep` over `tests/` for `manifest.ts`, `onboarding.fills` and `emit.ts` finds only comments, fixtures and the retired Copilot monolith records).

## Shape changes

Each of these changes a type, a port or a test seam in the foundation's shape. S1 put a Kiro rule in shared Projection, and S7 moves it to the Kiro host owners. After S7, none puts a host choice in shared code.

- **S1 Projection's knowledge reading (P1), superseded by S7.** S1 put a Kiro rule in shared Projection, which is the wrong owner. `3bf9e622c`'s message says "no new bridge module and no host-name branch in shared projection". The first half held. The second did not in substance: the adapter's function read the Kiro clause, and `core-root.ts` wired it for every host. What S1 changed: upstream's runtime now owns the Kiro preflight clause (`core/tools/aidlc-inline-context.ts` `kiroKnowledgePreflightClause`). Foundation's projection domain had its own copy of the older sentence, which would have made it a second owner of that wording. The changes:
  - `injectDelegatedKnowledgePreflight` takes a resolved `readingGuide: string` instead of a reading choice, and holds no Kiro wording.
  - `src/projection/application/ports/agents.ts` adds `KnowledgeReading = "whole-files" | "in-parts"` and `KnowledgeReadingGuides`.
  - `agent-persona.ts` takes `readingGuides` and picks the guide for the persona's reading.
  - The existing bridge adapter `legacy-format-docs.ts` gains `knowledgeReadingGuides(directory)`, which reads the runtime clause, and `core-root.ts` wires it in. No new bridge module is added.
  - `scripts/agent-knowledge.ts` calls the runtime clause, as upstream's does.
- **S2 Packaging's native permissions (P8).** `NativeRelease.permissionsLine: "exact-reads" | "prefix-only"` becomes `NativeRelease.permissions: NativePermissions`, defined in `src/packaging/domain/payload.ts`:

  ```ts
  type NativePermissions =
    | { kind: "authored" }
    | { kind: "exact-reads" }
    | { kind: "host-line"; line: NativePermissionsLine };
  ```

  - Packaging renders `authored` (the bullet is kept) and `exact-reads` itself.
  - For a `host-line`, Packaging calls the host's own function with the native command prefix. Codex owns `codexNativePermissionsLine` in `src/hosts/codex/distribution.ts`.
  - Kiro and Kiro IDE choose `exact-reads`. Claude, Cursor, Copilot and OpenCode choose `authored`.
  - The prefix-only wording had no caller left, so it was deleted.
  - Upstream's `tierFlavor` switch in `scripts/package.ts` is not copied.
  - Lane 0 and Q199 own the final form of this contract.
- **S3 Test matrix `tierFlavor` capability.** Two upstream tests select Kiro with the retired manifest's `tierFlavor`: `t-generated-text-names-what-the-harness-has` (9a62cf9f1 #3905) and `t-phase-check-has-one-owner` (0a3854daf #3914).
  - These tests stay at upstream's bytes, so the zones check admits them as upstream arrivals.
  - `tests/harness/harness-matrix.ts` carries `tierFlavor` as an explicit per-harness test capability: claude, codex, copilot, cursor, kiro (Kiro IDE and Kiro CLI V2) and opencode. It is set on the shipped manifest view.
  - `src/` has no `tierFlavor`.
  - A first attempt rewrote the two tests to select `harnessDir === ".kiro"`. The zones check refused it as new debt-zone code, so the change moved into the test matrix.
- **S4 Conductor skill files check (P2).** `harness-matrix.ts` gains `validateConductorSkillFiles`, called in `fullHostView`. It checks every file `CONDUCTOR_SKILL_FILES` names against `member.projection.skills.inputs`, where the retired manifest's `harnessFiles` used to be checked.
- **S5 Glossary.** `src/glossary.json` names `NativePermissions` and `NativePermissionsLine` (packaging) and `KnowledgeReading` and `KnowledgeReadingGuides` (projection). S7 removes `KnowledgeReadingGuides` and redefines `KnowledgeReading`. The definitions of `NativeRelease` and `AgentPersonaRequest` are updated to match.
- **S6 Previous release.** `lint/gate/previous-release.json` moves from 2.11.2 to 2.11.3 (`a8721be36`), with its dist at `aidlc-study-release-v2.11.3/dist`.
  - Rule: `8c4f79b4b`'s AIDLC_VERSION is 2.11.4, and the install lifecycle upgrades from the release before the one being built. The same rule gave 2.11.3 over 2.11.2 at `caea995ae`.
  - Upstream CI upgrades from the latest published release, which today is v2.11.4, the version being built.
  - The upgrade step exits 0 on all seven harnesses.
  - The seven release stamps are unchanged.
- **S7 Kiro's knowledge reading belongs to the Kiro hosts (P1 fix, `eb126c7be`).** The route ledger found S1 as the one wrong landing of the rebase. The fix keeps one owner of the wording, the runtime's `kiroKnowledgePreflightClause`, and one owner of the choice to read in parts, each Kiro host. They meet at a named boundary:

  ```ts
  type KnowledgeReading =
    | { readonly kind: "whole-files" }
    | { readonly kind: "in-parts"; readonly guide: string };
  ```

  - `src/hosts/kiro/projection/knowledge-reading.ts` (`kiroKnowledgeReading`) and `src/hosts/kiro-ide/projection/knowledge-reading.ts` (`kiroIdeKnowledgeReading`) read the clause.
    - Each is registered as an `aidlc-inline-context` host bridge in `lint/context-map.ts`, beside the Copilot launcher and Codex TOML host bridges.
    - The two are separate because no host folder imports another's.
  - The Kiro CLI and Kiro IDE agent renderers ask for `kiroKnowledgeReading(inputs.host.directory)` and `kiroIdeKnowledgeReading(inputs.host.directory)`. The other five hosts ask for `{ kind: "whole-files" }`.
  - `agent-persona.ts` only places the guide the request carries. `KnowledgeReadingGuides` and the preparer's `readingGuides` input are gone.
  - `legacy-format-docs.ts` and `core-root.ts` return to their `965cbec73` bytes.
  - The domain's `injectDelegatedKnowledgePreflight` (a resolved string, no host wording) and the thin entry `scripts/agent-knowledge.ts` are unchanged.
  - Test-first:
    - Changed first: the two host tests (the clause's literal text moved here from the adapter test), the seven agent renderer tests, the persona test and the bridge list test.
    - Red before the code: 22 failures and 4 missing modules across 13 files.
    - After the code: `bun test ./src` gives 1581 pass, and the gate's nine checks are green with goldens at 0 findings and no baseline rise.

## Zod uses

`8e310c44d` is a separate commit on `study/foundation-8c4f79b`, so it can be cherry-picked onto `rebuild/foundation`. It removes the Zod uses that guard no boundary and changes no behaviour on real data. Files importing `zod`: 44 before, 43 after (`src/`: 24 before, 23 after).

| Candidate | Verdict |
| --- | --- |
| `src/projection/adapters/legacy-plugin-emit.ts` | Removed. `z.enum(...).parse(row.kind)` ran on data our own `shippedPluginTarget` builds. A type guard over the shipped emitter's `PluginTargetKind` narrows it. An unknown format is still refused before the emitter runs; only the refusal's wording changes, from Zod's "Invalid option" to "The shipped plugin emitter has no <format> target." No registered host has such a format. Narrowing the domain's `HostPluginTarget.format` to the union instead was tried and refused by the harness-name rule, because the domain may not name `kiro`, `kiro-ide` or `cursor`. |
| `src/projection/adapters/compiled-method-file.ts` | Kept. As plain types, the compiled graph's `consumes[].required` key is a `boolean` field, which discipline CD-43 (`boolean-signatures`) refuses. Deriving that type from the serializer with `ReturnType` is refused by CD-7a (`factory-return-types`). Removing the schemas needs an authorised-location exception for the on-disk format, which is Helen's call. Until then `z.infer` carries the types. |
| `src/execution/adapters/intent-registry-file.ts` | Kept. It decodes the intent registry rows `core/tools/aidlc-lib.ts` writes into the person's project. Execution's `RecordStore.load` port is the planned reader, and `discipline-exceptions.json` already authorises its snake_case keys as that decoder. |
| `src/execution/adapters/session-binding-file.ts` | Kept. It decodes the per-session binding the runtime writes (`readSessionBinding` in `core/tools/aidlc-lib.ts`). Execution's `Sessions.current` port is the planned reader. |
| `src/installation/adapters/ownership-record-file.ts` | Kept. It decodes the install's ownership record. Installation's `OwnershipStore` port is the planned reader, and the glossary defines that port as reading the record "parsing it with Zod". |
| `src/packaging/adapters/distribution-descriptor-file.ts` | Kept. It is the documented format of the distribution descriptor Packaging writes into every payload (`legacy-payload-metadata.ts`, origin `distribution-descriptor`), which Installation reads back through the payload's `DistributionDescriptor`. |

The silent-failure and error-handling problems seen on the way are out of scope here. They are packaged-sources returning `{}`, the Kiro tool-allows `accepted(null)`, raw `ZodError` throws and dropped issues.

## Ratchets

All of these rises are upstream code arriving. The records check already admits rises in arrivals, meaning files byte-equal to an upstream merge parent. Commit `7e586689b` writes them down. **It is a proposal: record moves belong to Lane G and need Helen.**

- **Lint boundary** (`bun scripts/gate.ts --full --only lint --record`): 604 rises in 258 files.
  - 246 of the files are byte-equal to `8c4f79b4b`.
  - The other 12 are tests foundation had already edited before the merge. No commit after the merge touches them. For each, every rule's rise from `965cbec73` to the head equals upstream's own rise from `caea995ae` to `8c4f79b4b` for that file (each file linted at all four revisions); t181 and t239, whose import sets were unioned by hand, included. The measurements are in [Lint boundary rises](#lint-boundary-rises).
  - The one rise a port caused, a `max-lines-per-function` finding in `t-question-options-fit-the-box` from P3, was fixed in the code (`a512e25d7`).
- **Monoliths:**

  | Monolith | Lines (before → after) | Declarations |
  | --- | --- | --- |
  | `core/tools/aidlc-orchestrate.ts` | 23490 → 24298 | 36 added, 2 gone |
  | `core/tools/aidlc-init.ts` | 14964 → 15081 | 5 added |
  | `core/tools/aidlc-lib.ts` | 42322 → 42114 | `tests/fixtures/aidlc-lib-declarations.txt` merged cleanly: it carries upstream's 21 removals (87472aa2a #3737, 237a65f1a #3780, 6e8d5c309 #3917, b650965ea #3933) beside foundation's own 21 earlier ones |

  36 + 5 new declarations and the two line growths are the gate's 43 monolith findings. Erratum: the message of `7e586689b` says 38 declarations added to orchestrate; it is 36 (38 was the changed-line count).

  All three are byte-equal to `8c4f79b4b`. `--record` can only lower a monolith record, so there is no recorded path for upstream growth. The two growing entries were dropped and re-recorded from their measured shape.

  The retired Copilot emitter and manifest records (lines 207 and 270 on deleted files) are left as they were. They are pre-existing housekeeping.

- **No precedent.** Foundation has never merged upstream before, so this is the first upstream merge and there is no earlier one to follow.
- **Gaps for Lane G:**
  - The monolith ratchet has no command that raises a record for an arrival.
  - The records check skipped the boundary comparison in this diff ("lint rules changed in this diff"), so the boundary rises were checked by hand with `git diff --quiet 8c4f79b4b HEAD -- <file>`.

The files and counts are listed in [Lint boundary rises](#lint-boundary-rises).

## Tooling changes

Branch `study/upstream-shape-tooling-8c4f79b`:

- `regenerate.ts` requires `--pin`.
  - `src/pin-facts.ts` reads the pin's `core/tools/aidlc-version.ts`, foundation's `lint/gate/previous-release.json` and foundation's `tests/golden/`.
  - `templates/PARITY.md` renders `{{pin}}`, `{{release}}`, `{{previous-release}}` and `{{golden-file-count}}` from those reads.
  - The coverage-registry observation stays dated to `caea995ae`, because it was measured there.
- `shape-plan.ts` names those sources (`pinSources`).
- The candidate is authored and committed by `HailsTails <9475175+HailsTails@users.noreply.github.com>`, a constant in `regenerate.ts`, never read from git config.
  - It keeps foundation's tip dates and adds no `Co-Authored-By` trailer.
  - The repository-local identity is `rin-author[bot]`, so `--reset-author` would have resolved to the bot. The global identity is a personal address and is not used either.
  - A first regeneration (`c6b67ac64` and `23886338e`, pushed to the two candidate refs and since replaced) read the global identity and so carried the personal address. Those two commits are no longer on any branch but stay reachable on the public fork by SHA and from run 43812083339 (cancelled).
- `src/route-ledger.ts` routes each upstream commit's paths to their receiving owners and renders [the route ledger](rebase-8c4f79b-ledger.md) from hand-made judgements in `docs/rebase-8c4f79b-judgements.json`.
  - It demands a judgement for every replaced or mixed commit.
  - It also demands one for any commit touching a dual-use core module, a legacy script, a build file added in the range, a conflicted path, or a path that differs from upstream at head beyond the change foundation already had.
  - It exits 1 while any of those commits has no judgement.
- `src/test-case-counts.ts` compares the test cases per test file between two commits and lists every file with fewer, exiting 1 if any. The restored cases are in `overlay/tests/unit/t-package-sources.test.ts` and in `patches/tests~integration~t145-packaging-parity.test.ts.patch`, `patches/tests~unit~t285-knowledge-skill.test.ts.patch` and `patches/tests~unit~t303-packager-orchestrator-skill-path.test.ts.patch`. `templates/PARITY.md` records them case by case.
- **Patch redone:** in `patches/scripts~parity~install-lifecycle.ts.patch`, the usage line said `v2.11.2` and now says `<previous release tag>`. A hard-coded release would go stale at every pin.
- The 16 patches that were already there, and the optional gitleaks patch, apply to the rebased foundation unchanged. The two `t285` and `t303` patches are new, and the `t145` patch grew by the restored cases, so there are 18 now.
  - The kiro README patch's sentence about the packager at `caea995ae` is kept. It is a historical fact about that packager, not the pin.

## Re-prove

**Foundation gate.** On `study/foundation-8c4f79b` at `eb126c7be`, `bun scripts/gate.ts --full --only zones,records,lint,disciplines,typecheck,monolith,kernel,isolation,goldens` is green with 0 findings in every check. It was also green at `8e310c44d`.

- The goldens check counts files per harness: claude 818, codex 934, copilot 846, cursor 836, kiro 853, kiro-ide 859, opencode 848, plugin-marketplaces 4.
- `tests` was not run. It runs the legacy suites, which is the full suite.
- `ownership` needs a lane, and no lane was given.
- No sweep is recorded for this commit.
- The touched legacy test files ran on their own and gave 159 pass, 0 fail: t181, t239, t-question-options-fit-the-box, t-generated-text-names-what-the-harness-has, t-phase-check-has-one-owner and t-aidlc-lib-only-shrinks.
- `bun test ./src` gives 1581 pass, 0 fail.
- The lint total is 177992 against a recorded 177993, so nothing rose.
- The candidate's local runs below used `bun --cwd <candidate>` (never a shell `cd`) under the machine lock.

**Candidate.** The candidate is `6761b5dce`, with the same tree as `541aca150`. All of these checks ran in a clean worktree after `bun scripts/package.ts`:

| Check | Result |
| --- | --- |
| `bun scripts/parity/dist-goldens.ts --check` | 0 findings |
| `bun scripts/parity/install-lifecycle.ts --check --previous <v2.11.3 dist>` | 0 findings |
| `bun run check` | exit 0 |
| `bun test ./src` | 1581 pass, 0 fail |
| `bun test ./scripts/parity` | 13 pass, 0 fail |
| `bun test` on `t-package-sources`, `t285` and `t303` | 95 pass, 0 fail |
| `bun test tests/integration/t145-packaging-parity.test.ts` | 13 pass, 0 fail |
| `bun src/test-case-counts.ts` against `8c4f79b4b` (tooling) | 1297 shared test files, 0 with fewer cases |
| Goldens re-recorded on an unmodified `8c4f79b4b` checkout with the candidate's `scripts/parity/` (`--record` for both) | byte-identical to the candidate's `tests/golden/` (recorded against `c6b67ac64`; no later regeneration changed `scripts/parity/` or `tests/golden/`) |
| `git diff --name-status 8c4f79b4b 541aca150 -- core plugins` | empty |

`git diff --name-status 8c4f79b4b 541aca150 -- harness` lists 18 deletions and nothing else:

- `harness/<host>/manifest.ts` for all 7 hosts
- `harness/<host>/onboarding.fills.ts` for all 7 hosts
- `harness/{codex,copilot,opencode}/emit.ts`
- `harness/kiro-ide/delegate-shell-deny.ts`

None of these is in a shipped asset folder (`hooks/`, `skills/`, `agents/`, `settings/`, `steering/`, `command/`, `plugin/`).

**Commit identity.** The candidate commit's author and committer are both `HailsTails <9475175+HailsTails@users.noreply.github.com>`. The message has no trailer.

## CI

The fork's standard GitHub runners ran each candidate on the pin, `ci-proof/upstream-shape-8c4f79b`. CI was dispatched with `platform_regressions=false`, and Markdownlint and Security Scanners alongside it. The reference is `8c4f79b4b`'s own run on the same workflows:

- CI run 43807098520: 26 of 26 jobs green, 1266 test files (1225 pass, 41 skip).
- Markdownlint run 43807101908: green.
- Security Scanners run 43807105016: green.

The candidate's per-file results are compared with that reference's parsed results (`aidlc-ci-proof-20261116/parsed/ci-8c4f79b.tsv`, ref `base`), using `parse_summaries.py` and `compare.py` from `aidlc-ci-proof-20261116/scripts/`.

| Candidate on the pin | CI | Markdownlint | Security Scanners | Against `8c4f79b4b` |
| --- | --- | --- | --- | --- |
| `23886338e` | 43812083339, cancelled | | | Replaced: it carried the personal identity. |
| `2d9a859e1` | 43817932139, red | 43817936577, green | 43817940761, green | 1266 files and 41 skip on both. The one difference: unit-9 t294 failed 1 of 199. ad4a0ad02 #3906's case listed the retired manifests, fixed in `7aac16444`. |
| `1fcb108a9` | 43827242879, 26 of 26 green | 43827247248, green | 43827251965, green | 1266 files, 41 skip, 0 fail on both; no file differs. |
| `b085d715a` | 43835310216, 26 of 26 green | 43835317308, green | 43835323478, green | 1266 files, 41 skip, 0 fail on both; no file differs. |
| `541aca150` | {{ci-final}} | {{md-final}} | {{sec-final}} | {{ci-final-compare}} |

- `1fcb108a9` and `b085d715a` differ only by S7, the P1 fix.
- `b085d715a` and `541aca150` differ only by the restored test cases (see [Test cases](#test-cases)).
- The comparison is per test file, so it cannot see a case missing inside a file that still passes. The case counts are checked separately.

## Test cases

The candidate ran fewer test cases than the pin in four files. The v3 full suite showed it first, by top-level test counts and full-suite assertion counts against `caea995ae`. `src/test-case-counts.ts` then found the same four files on `9efb4b826` against `8c4f79b4b`:

| File | Cases at `8c4f79b4b` | Cases at `9efb4b826` |
| --- | --- | --- |
| `tests/unit/t-package-sources.test.ts` | 9 | 2 |
| `tests/integration/t145-packaging-parity.test.ts` | 13 | 10 |
| `tests/unit/t285-knowledge-skill.test.ts` | 46 | 45 |
| `tests/unit/t303-packager-orchestrator-skill-path.test.ts` | 3 | 2 |

These are textual `test(` and `it(` calls, so a `test.each` table counts once.

Every drop predates this rebase: `rebuild/foundation` at `965cbec73` already had the same counts. Each dropped case tested a file foundation retired: `scripts/package-sources.ts`, a `harness/<name>/manifest.ts` or `emit.ts`, or `scripts/package.ts`'s manifest resolution. The behaviour of `scripts/package-sources.ts` had moved to `src/` unit tests, which upstream's runner does not run.

The restored cases now run in upstream's runner against the new owners, with upstream's assertions:

- **`t-package-sources`**: the tooling overlay, which also keeps the two copied-coverage cases. 14 tests pass.
- **`t145`, `t285` and `t303`**: tooling patches (`patches/tests~…`).
- **The parts that cannot apply.** `t145`'s synthetic harness name and the optional orchestrator-skill default are recorded case by case in `PARITY.md`, with the reasons.
- **The `t145` fixture.** It renames a host's directory throughout `src/hosts/<name>/`. A scratch build first confirmed that the generic outputs follow the rename:
  - `harness.json`;
  - the stage graph's sensor paths;
  - the runner commands;
  - Codex's hooks, rules and trust seed.
  
  Renaming only the host identity is refused (`path-undeclared`).
- **A synthetic host named `foo`.** It is refused by the frozen model policy ("The frozen model policy has no host foo"), because that policy is keyed by host name.

After regenerating, `bun src/test-case-counts.ts --repository aidlc-workflows --base 8c4f79b4b --candidate study/upstream-shape-8c4f79b` reports 1297 shared test files and 0 with fewer cases. No test file at the pin is missing from the candidate.

## Every upstream commit

`git log --reverse caea995ae..8c4f79b4b`, 126 commits. "Landed as upstream bytes" means every path the commit touches is byte-equal to `8c4f79b4b` on the rebased foundation.

| Upstream | PR | Subject | Disposition |
| --- | --- | --- | --- |
| `6e4a2e9ef` | #3729 | docs(kiro): one Kiro guide, kiro.md, with Kiro CLI (V2) as its own section | Conflict (C1, C2; C4 follows). kiro-ide.md took upstream's stub; kiro-ide and kiro onboarding.fills stay deleted, their text ported (P6). |
| `81f084e55` | #3727 | docs(kiro): on Kiro CLI 3.1.0, the guide says what the main chat's approval card offers and what its allow rule covers | Landed; `docs/guide/harnesses/kiro.md` (new upstream in #3729) differs from upstream only by the line C4 moved into it. |
| `01b80253f` | #3728 | fix(install): on Windows, the install recipes allow scripts in their window first, and doctor names aidlc.exe for an uninstall retry | Landed; `docs/guide/harnesses/kiro.md` (new upstream in #3729) differs from upstream only by the line C4 moved into it. |
| `3ca1893e6` | #3726 | fix(kiro): a helper agent lists its knowledge folders with its file tool, not the shell | Conflict (C3). Ported as P1. It first landed in shared Projection and was moved to the Kiro host owners (S7). |
| `87472aa2a` | #3737 | fix(compose): the engine keeps the in-flight compose question itself, so no hidden aidlc/.aidlc-compose-pending file appears in your project | Landed; merged cleanly into files foundation had already edited: `docs/reference/06-hooks-and-tools.md`, `tests/fixtures/aidlc-lib-declarations.txt`, `tests/smoke/t148-kiro-file-structure.test.ts`. |
| `9cd212592` | #3735 | fix(kiro): on macOS and Linux, a quote escaped with a backslash in a simple shell command keeps the > or \| after it inside the value | Landed as upstream bytes. |
| `3bfb58698` | #3739 | test(compose): a setting that needs their words names their message while the compose question is open; comments say what the code does | Landed as upstream bytes. |
| `fd3ac2345` | #3667 | fix(guards): a team Unit's first record names its start, so its gate never asks you to mark it finished | Landed as upstream bytes. |
| `4484fef97` | #3588 | fix(release): a provenance failure names the repository and workflow it checked against | Landed as upstream bytes. |
| `16b461d94` | #3675 | test(graph): the read-only aidlc-graph subcommands are driven as the CLI and checked against the compiled graph | Landed as upstream bytes. |
| `f8ed25733` | #3574 | fix(hooks): walk each script once in the runtime-integrity guard | Landed as upstream bytes. |
| `8647fa952` | #3414 | fix(stages): Delivery Planning plans the mob per Bolt and leaves who builds the Units to the engine's question | Landed as upstream bytes. |
| `f592d97ee` | #3611 | fix(jump): a unit-major forward jump moves only the Unit in flight on | Landed; merged cleanly into files foundation had already edited: `docs/reference/01-architecture.md`. |
| `794fcf2b6` | #3646 | fix(review): each review and each build is dispatched as a new subagent, never an earlier one continued (#3549) | Landed as upstream bytes. |
| `e558d6cfd` | #3612 | fix(orchestrate): name the stored request so a long brief fits one step | Landed as upstream bytes. |
| `517bafb60` | #3738 | fix(guards): the start-receipt guard never names a unit start the engine then refuses | Landed as upstream bytes. |
| `a4e663b58` | #3673 | fix(stages): a Code Generation plan names the data-model elements it adds, and the person sees the ones no requirement asks for | Landed as upstream bytes. |
| `afa704058` | #3730 | feat(version): a pinned project's version answer names the release that runs its work | Landed as upstream bytes. |
| `ab95815fa` | #3754 | fix(next): over work made from a long request, another request reaches its question | Landed as upstream bytes. |
| `5e561ab1a` | #3755 | fix(claude): the code plan question box shows each plan's summary lines and its path | Landed; merged cleanly into files foundation had already edited: `docs/reference/06-hooks-and-tools.md`. |
| `ce4207b77` | #3756 | fix(review): the Code Generation reviewer is told when the person's approved plan changed mid-build and their setting did not ask again | Landed as upstream bytes. |
| `47da6ddce` | #3757 | test(units): the lead's checkout fetches the teammate's claim before the cases that need it | Landed as upstream bytes. |
| `432a50f17` | #3743 | fix(engine): a request pasted after /aidlc that is longer than 8,000 characters reaches the work whole | Landed; merged cleanly into files foundation had already edited: `docs/reference/06-hooks-and-tools.md`. |
| `0d69b5c35` | #3758 | fix(plan-approval): turning plan approval on before a plan's build starts asks you about that plan | Landed as upstream bytes. |
| `92d39a09e` | #3752 | fix(hooks): after a long /aidlc paste, the agent carries on without typing the whole request again | Landed; merged cleanly into files foundation had already edited: `docs/reference/06-hooks-and-tools.md`. |
| `a9b4d6dc4` | #3764 | fix(intent): add-repo asks for the address of a repo no repos.json lists, instead of cloning it from github.com under the list's org | Landed; merged cleanly into files foundation had already edited: `docs/reference/06-hooks-and-tools.md`. |
| `af3df59dd` | #3742 | fix(kiro): the agent checks a Unit's changed files with an AI-DLC lookup instead of `git status`, which Kiro asks you to approve | Landed; merged cleanly into files foundation had already edited: `tests/smoke/t148-kiro-file-structure.test.ts`. |
| `451098163` | #3751 | fix(kiro): the aidlc agent's skill is two files, so Kiro's 50,000-character limit on one resource file no longer cuts it | Conflict (C1, C5, C6). Ported as P2 into the Kiro IDE skill inputs; harness-matrix checks the conductor skill files; t181 and t239 import sets unioned. |
| `71094735d` | #3771 | fix(plan-approval): the code plan question no longer lists a repo just cloned for the work as already changed | Landed as upstream bytes. |
| `144874088` | #3772 | fix(practices): approving Practices Discovery in a space made by space create saves the practices instead of stopping at a missing heading | Landed as upstream bytes. |
| `1bc8e7447` | #3774 | fix(engine): a command run from a code repo inside the workspace is recorded in the workspace, not in that repo | Landed; merged cleanly into files foundation had already edited: `docs/reference/06-hooks-and-tools.md`. |
| `89610b4b7` | #3776 | fix(knowledge): knowledge onboard adds every document you name, and names any it cannot add with why | Landed; merged cleanly into files foundation had already edited: `docs/reference/06-hooks-and-tools.md`, `tests/unit/t285-knowledge-skill.test.ts`. |
| `ff498c1f4` | #3779 | fix(knowledge): on a copy install, knowledge onboard adds a file from outside documents/ instead of saying the folder does not exist | Landed as upstream bytes. |
| `237a65f1a` | #3780 | fix(hooks): a background helper's record no longer shows in git status, so git add -A cannot commit it | Conflict (C1). biome.json stays deleted. Rest landed. |
| `adedc674a` | #3783 | fix(copilot): a stage output saved with apply_patch on Copilot CLI is recorded, so its review starts | Landed as upstream bytes. |
| `51d4b9aa9` | #3781 | fix(knowledge): onboarding a changed document again updates its copy in place, so it stays the same document | Landed; merged cleanly into files foundation had already edited: `docs/reference/06-hooks-and-tools.md`. |
| `83638be25` | #3786 | fix(construction): going back to a Unit while the walking skeleton waits asks its own plan, and a stale skeleton is checked again instead of a resume that is refused | Landed as upstream bytes. |
| `911f52e52` | #3788 | fix(teams): a lead asking to redo their own finished Unit is told it is finished and what the checkout builds | Landed as upstream bytes. |
| `59b64b0d8` | #3785 | fix(plan-approval): writing the code plan with cat or tee and a heredoc is read as the write it is, not refused as unreadable | Landed; merged cleanly into files foundation had already edited: `docs/reference/06-hooks-and-tools.md`. |
| `8624c26a5` | #3789 | fix(kiro): on a Kiro copy install, knowledge onboard adds a file from outside documents/ instead of saying the folder does not exist | Landed as upstream bytes. |
| `a49739ce5` | #3795 | fix(source): a repo added to work under way no longer stops a parallel build or reads as changed at the review or the build's start | Landed as upstream bytes. |
| `1102324f9` | #3797 | fix(kiro): on Kiro CLI's V2 engine, a long pasted request AI-DLC kept whole is not handed to the agent to type again | Landed; merged cleanly into files foundation had already edited: `docs/reference/06-hooks-and-tools.md`, `docs/reference/09-testing.md`. |
| `798eceeb4` | #3794 | fix(teams): a lead with no Unit left to build is told their finished Unit is not redone there, not offered a reopen for every unit | Landed as upstream bytes. |
| `ac4b02b63` | #3798 | fix(engine): a plan question or approval left open in another chat is shown in a new chat before anything is recorded | Landed as upstream bytes. |
| `986da3a04` | #3799 | fix(guards): on Codex, a file written with the shell's apply_patch is read as the write its patch names | Conflict (C1). harness/opencode/emit.ts stays deleted. Ported as P5 into the OpenCode settings renderer. |
| `1ae045440` | #3800 | fix(kiro): the Kiro guide describes Approve for me, and the issue report tells it apart from Accept file changes | Conflict (C2). kiro-ide.md took upstream's stub; the change is in kiro.md, which merged cleanly. |
| `4446c9f9e` | #3807 | fix(teams): a team Unit's approval records only that Unit's open decisions, not a teammate's | Landed as upstream bytes. |
| `2f5537f0d` | #3819 | fix(setup): reopening step 1 of Customize setup keeps the MCP answer instead of setting it back to the harness default | Landed as upstream bytes. |
| `06a3d5391` | #3823 | fix(swarm): with Units in parallel, a passing test command that prints a lot is no longer reported as failed | Landed as upstream bytes. |
| `ca2c816cb` | #3817 | docs(kiro): the Kiro CLI (V2) guide says Kiro joins the lines of a request typed after /aidlc, and points to naming a file instead | Landed; `docs/guide/harnesses/kiro.md` (new upstream in #3729) differs from upstream only by the line C4 moved into it. |
| `707e50b0a` | #3826 | fix(reviews): a reviewed stage run on its own after the work finished no longer says no reviewer finished its review | Landed; merged cleanly into files foundation had already edited: `docs/reference/06-hooks-and-tools.md`. |
| `95fbef09e` | #3827 | fix(construction): a parallel Unit with nothing to change lands and the batch goes on, instead of a hook refusal on every rerun | Landed as upstream bytes. |
| `56df50a28` | #3820 | fix(kiro): the Default-agent note says nothing when Approve for me is on, and names /agent for Kiro CLI | Conflict (C1). kiro-ide onboarding.fills stays deleted. Ported as P6. |
| `dfa9d67ff` | #3816 | fix(report): an approval given beside a setting the team locked, or before Practices Discovery's practices are saved, is recorded instead of stopping on an error | Landed as upstream bytes. |
| `ff22aef72` | #3813 | fix(scope): switching scope on a Windows clone runs the new scope's stages, not the old ones | Landed as upstream bytes. |
| `4397f483d` | #3805 | fix(codex): on Windows a call AI-DLC's checks refuse is held, with the same words | Conflict (C1). harness/codex/emit.ts stays deleted. The upstream change there is a comment only: no port. |
| `47de5005f` | #3818 | fix(teams): the share, push and publish questions name every file of yours they commit, and the results say what they took | Landed as upstream bytes. |
| `0f826bc1c` | #3812 | fix(claim): a claim typed as the first message in a new clone claims the Unit there, instead of ending on State file not found | Landed as upstream bytes. |
| `b980a43a7` | #3830 | fix(windows): after an uninstall that stopped and lost its temp record, commands and hooks run again and uninstall or the installer clears what it left | Landed as upstream bytes. |
| `12a98acfa` | #3828 | fix(plan-approval): the engine writes the code plan's Testing Contract block itself, so a copy that goes wrong no longer stops the plan question | Landed; merged cleanly into files foundation had already edited: `docs/reference/06-hooks-and-tools.md`. |
| `300fbb5dd` | #3840 | fix(sensors): a check whose output passes 1 MiB reports its findings instead of reading as could not run | Landed as upstream bytes. |
| `aa53a342c` | #3852 | fix(teams): a lead whose teams hold Units can pause main's own work, and "approve, and stop there" stops | Landed as upstream bytes. |
| `575079bed` | #3863 | fix(reviews): a stage's verdict waits for its reviewer to finish, so a review changed afterwards is flagged again | Conflict (C1). biome.json stays deleted. Rest landed. |
| `6f9c45db1` | #3868 | docs(guards): the patchUnseen field comments say what the flag covers since the Codex patch mode reading | Landed as upstream bytes. |
| `8504dd817` | #3842 | fix(teams): moving main on to Build and Test while a team builds a Unit keeps the board, runs Build and Test, and the Unit still lands | Landed as upstream bytes. |
| `8e6b65e16` | #3846 | fix(engine): the warning about a key in your message is said in the reply that answers it | Landed as upstream bytes. |
| `de3617916` | #3876 | fix(docs): section links open their section on GitHub, stage links open a page, and Copilot's guide is in the site menu | Landed; merged cleanly into files foundation had already edited: `docs/reference/15-stage-definition.md`. |
| `d3c4b95b8` | #3869 | fix: the first setup's ending, the models screen, a stage's notes file and unit status say what is so | Landed as upstream bytes. |
| `741f86646` | #3875 | fix(questions): an answer you gave is taken as given, and how you answer is asked once | Landed as upstream bytes. |
| `f15d76083` | #3824 | fix(teams): a share or publish after git rm or git mv commits them, instead of stopping on "git add failed" every time | Landed as upstream bytes. |
| `568f1d88e` | #3878 | fix(agents): personas and knowledge match their stages: the Ideation handoff, Delivery Planning, requirement IDs, worktree landings, brownfield work | Landed as upstream bytes. |
| `ddec5c0b5` | #3877 | fix(doctor): a stage waiting for your approval and a hook that fires only on rare events are no longer warnings | Landed as upstream bytes. |
| `6d6974507` | #3880 | fix(doctor): doctor --json and --quiet count the workflow warnings the plain report shows | Landed as upstream bytes. |
| `7281155dc` | #3883 | fix(cursor): under Guard Policy strict or relaxed, the helper that builds a Unit runs its builds and tests | Landed as upstream bytes. |
| `915d65c73` | #3879 | fix(handover): OUTCOMES.md no longer tells you to delete your state and answers, and Cursor and opencode say which stages hand work off | Conflict (C1). cursor and opencode onboarding.fills stay deleted. Ported as P6. |
| `53aeef3b8` | #3838 | fix(swarm): a check stopped at its time limit says so, and --timeout-ms gives it longer | Landed as upstream bytes. |
| `f9e1fa464` | #3837 | fix(review): a recovery review whose answer was lost is retried, not called spent | Landed as upstream bytes. |
| `8e1e640b0` | #3907 | refactor(kiro): one reader of Kiro CLI's approve-for-me policy, which the issue report takes from the install | Landed as upstream bytes. |
| `2dd100baf` | #3921 | fix(kiro): a quoted engine command no longer runs, and argument-less Plan Approval writes, the ACP line and the onboarding follow what exists | Conflict (C1). kiro-ide manifest and onboarding.fills stay deleted. Ported as P6 (fills and the ACP line in kiro-ide host data). |
| `020b9fcdd` | #3845 | fix(sensors): a shipped check's large result is read whole instead of reading as could not run | Landed as upstream bytes. |
| `165a19c72` | #3888 | fix(stages): stage steps say what the engine does at Reverse Engineering, CI Pipeline, Requirements Analysis and two Operation stages | Landed as upstream bytes. |
| `eced48f64` | #3843 | fix(plan-approval): a note the person writes under the code plan's Testing Contract heading while editing the plan is kept when the engine writes the contract back | Landed; merged cleanly into files foundation had already edited: `docs/reference/06-hooks-and-tools.md`. |
| `6b2ac7d0a` | #3893 | fix(onboarding): the documentation links an installed project shows open the docs site, not a docs folder it does not have | Conflict (C1). Seven manifests and four onboarding.fills stay deleted. Ported as P6 (fills) and P7 (prior hashes). |
| `ed2c6b04b` | #3895 | fix(uninstall): Kiro IDE's terminal records are no longer reported as files AI-DLC did not install, and --purge removes them | Landed as upstream bytes. |
| `bf7e0b1cf` | #3887 | fix(runners): gen runners no longer calls the main aidlc skill unmanaged, and --check sees a missing reverse-engineering runner | Landed as upstream bytes. |
| `486c052da` | #3836 | fix(swarm): a Unit's landing carries its code only, whatever AI-DLC files its Bolt committed | Conflict (C1). Seven manifests stay deleted. Ported as P7 (prior gitignore hashes). |
| `1d4b76a83` | #3892 | fix(update): an update of the release you already have no longer downloads its binary again | Landed as upstream bytes. |
| `4c3a662f9` | #3894 | fix(hooks): the runtime graph recompiles after your own approval on a team project | Landed; merged cleanly into files foundation had already edited: `docs/reference/06-hooks-and-tools.md`. |
| `9c1c8ba3c` | #3891 | fix(teams): after going back to change the Unit plan, switching to building the Units alone is refused while teams hold their Units, as before the move | Landed as upstream bytes. |
| `a12ccbc9f` | #3922 | fix: the plan check's refusal, the config list and two step instructions say where things stand in plain words | Touches t239 (C5): its test body merged unchanged into the unioned file. |
| `b63bb2061` | #3928 | docs(guide): a second Kiro manual copy keeps the project's saved Kiro CLI settings | Touches t239 (C5): its test body merged unchanged into the unioned file. |
| `4398ec484` | #3904 | fix(kiro-v2): a request with one double quote or a plan's name first gets a first call that runs and is accepted, and the forwarding latch is git-ignored | Conflict (C1). kiro manifest and onboarding.fills stay deleted. Ported as P6 and P7. |
| `9a62cf9f1` | #3905 | fix(runners): scope runners ask in each harness's own words, native onboarding names the permissions each install has, and test-pro steps land before the approval | Conflict (C3). scripts/package.ts kept foundation's. Ported as P8 (NativePermissions); its tests restored to upstream bytes with the tierFlavor test capability. |
| `ad8ba858d` | #3931 | fix(kiro): a typed /aidlc --status says the line AI-DLC is keeping for you, on Kiro and on Kiro CLI (V2) | Landed as upstream bytes. |
| `88a73e5a4` | #3908 | docs(reference): the stage and plugin reference say what infra, support agents and plugin house rules do | Touches t239 (C5): its test body merged unchanged into the unioned file. |
| `7fb6555a0` | #3909 | fix(code-generation): ES modules, Sass, F#, VB, Gradle, Razor and Windows scripts are code by name, so the build's approval does not name them as files you had before | Landed as upstream bytes. |
| `578a61cad` | #3911 | fix(questions): on opencode, Cursor and Copilot a question from a questions file shows one Other choice, not two | Landed as upstream bytes. |
| `1fcea463f` | #3915 | fix(jump): a forward jump's phase row no longer says traceability was verified | Landed as upstream bytes. |
| `359613c3b` | #3920 | fix(rules): the shipped rule files say a team's practice replaces a framework default, give classic no coverage floor, and ask no trace to Ideation on plans that skip it | Landed as upstream bytes. |
| `d864e729c` | #3910 | docs(guide): the install, harness and troubleshooting pages give the setup steps the product needs | Touches t239 (C5): its test body merged unchanged into the unioned file. |
| `0a3854daf` | #3914 | fix(protocols): the phase-boundary check runs once, in the stage that ends the phase | Landed. Its test reads tierFlavor; the test matrix gained that capability (S3). |
| `ad4a0ad02` | #3906 | fix: doctor, plugin test, Copilot reviewers and Codex questions work the same on every harness | Conflict (C1, C3, C7, C8). Copilot emitter and Codex manifest stay deleted; porting doc and agent-knowledge kept foundation's. Ported as P3 (Codex letters) and P4 (Copilot absorbed knowledge). Its new t294 case is re-pointed at the test matrix (`7aac16444`). |
| `6cbf16257` | #3913 | fix(requirements): the summary stop before Requirements Analysis writes its document is the same stop every other stage shows | Landed as upstream bytes. |
| `b72cc6d1d` | #3829 | fix(teams): a project in a folder of a bigger repository is told team work needs it at the repository's top, instead of a share that fails | Landed as upstream bytes. |
| `c9591e300` | #3885 | fix(teams): once a team has taken a Unit, redoing a Unit stage for every unit reopens only the Units your checkout builds and says which it left | Landed as upstream bytes. |
| `5f67de0e3` | #3898 | docs(cursor): the guide says a helper is refused a write over its records only where its command names the path | Landed as upstream bytes. |
| `eb59fe50a` | #3899 | fix(cursor): the checks before each tool call run in one process, so a shell call waits for one engine start, not five | Landed; merged cleanly into files foundation had already edited: `docs/reference/06-hooks-and-tools.md`. |
| `3b0a329a2` | #3926 | docs(doctor): the guide says where a waiting gate and cold hooks show in doctor's report | Landed as upstream bytes. |
| `161ddb823` | #3916 | docs(guide): the scope, approval, knowledge, state, guard and bugfix pages say what the product does | Conflict (C5). t239 import set unioned. |
| `226b593c1` | #3851 | fix(sensors): the lint check reports a file's thousands of lint errors instead of reading as could not run | Landed as upstream bytes. |
| `6e8d5c309` | #3917 | fix(commands): a command AI-DLC prints runs as printed on a copy install, on Codex, with a folder that has a space and on Windows | Landed. Bridge characterization test re-pinned (status no longer a dispatcher verb). |
| `7752f3b6d` | #3925 | docs(guide): the Codex manual copy keeps a project's own .codex settings, hooks and rules | Touches t239 (C5): its test body merged unchanged into the unioned file. |
| `d2b117274` | #3932 | fix(teams): the team board says where the Units stand in plain words | Landed as upstream bytes. |
| `b650965ea` | #3933 | fix(pin): a pinned project checks its release in full once per session, not on every command and hook call | Conflict (C1). biome.json stays deleted. Rest landed. |
| `91b15fc8d` | #3935 | fix(teams): after moving main on past the Unit stages while teams hold Units, switching to building them alone stays refused | Landed as upstream bytes. |
| `17f495318` | #3952 | fix(teams): a redo that is not done for every Unit says why and stops there, with no doctor line after it | Landed as upstream bytes. |
| `c4960e702` | #3896 | refactor(git): where a project sits in its git repository is read in one place, with nothing a person meets changed | Landed as upstream bytes. |
| `09f006e4e` | #3919 | fix(construction): the team Unit steps in the stage protocol name the commands as the install runs them | Landed as upstream bytes. |
| `9a45be65a` | #3961 | chore(release): record v2.11.4 on main | Landed. Bridge characterization tests re-pinned to 2.11.4 and preview 2.11.5. |
| `7649012be` | #3962 | fix(refined-mockups): Refined Mockups runs for a project with a UI on the classic and workshop plans | Touches t239 (C5): its test body merged unchanged into the unioned file. |
| `d8dd27dcf` | #3929 | fix(teams): a claim kept in the project's aidlc/ folder is read and keeps its place, and claim files and Unit results never land on main | Landed as upstream bytes. |
| `843d995d0` | #3986 | fix(read-boundary): a hardlinked file's refusal says the step in words every shell reads | Landed as upstream bytes. |
| `50a9e926c` | #3963 | fix(setup): at a terminal with Kiro CLI found, Enter at the harness question sets up Kiro, with Kiro CLI (V2) one number away | Landed; `docs/guide/harnesses/kiro.md` (new upstream in #3729) differs from upstream only by the line C4 moved into it. |
| `8ed977085` | #3997 | fix(state): work set up with a newer AI-DLC offers the update and carries on, instead of a dead end | Landed as upstream bytes. |
| `445578dc9` | #3976 | fix(kiro): config models, its --check and doctor name an agent model Kiro CLI's model list does not have | Landed; `docs/guide/harnesses/kiro.md` (new upstream in #3729) differs from upstream only by the line C4 moved into it. |
| `8c4f79b4b` | #3990 | docs(kiro): a copied Kiro project moves to a newer release with its setup command alone, keeping its plugin choices and setup answers | Touches t239 (C5): its test body merged unchanged into the unioned file. |

## Lint boundary rises

Upstream-byte files (byte-equal to `8c4f79b4b`), with the findings each added and the upstream commits that touched it:

| File | Findings added | Upstream commits touching it |
| --- | --- | --- |
| `core/hooks/aidlc-log-subagent.ts` | 2 | `707e50b0a` |
| `core/hooks/aidlc-plan-approval-guard.ts` | 32 | `a12ccbc9f` `6f9c45db1` `4397f483d` `986da3a04` `59b64b0d8` `0d69b5c35` |
| `core/hooks/aidlc-rebuild-stage-graph.ts` | 10 | `4c3a662f9` |
| `core/hooks/aidlc-record-human-turn.ts` | 23 | `8e6b65e16` `1102324f9` `92d39a09e` `432a50f17` `5e561ab1a` |
| `core/hooks/aidlc-reviewer-scope.ts` | 4 | `986da3a04` `87472aa2a` |
| `core/hooks/review-freeze-command.ts` | 72 | `4397f483d` `986da3a04` `9cd212592` |
| `core/hooks/runtime-integrity.ts` | 11 | `986da3a04` `59b64b0d8` `f8ed25733` |
| `core/skills/aidlc-issue-report/scripts/collect.ts` | 2 | `8e1e640b0` |
| `core/skills/aidlc-issue-report/scripts/lib-project.ts` | 11 | `8e1e640b0` |
| `core/skills/aidlc-issue-report/scripts/lib-shape.ts` | 1 | `1ae045440` |
| `core/skills/aidlc-issue-report/scripts/lib-transcripts.ts` | 31 | `8e1e640b0` `1ae045440` |
| `core/tools/aidlc-audit.ts` | 7 | `6e8d5c309` `8e6b65e16` |
| `core/tools/aidlc-brought-files.ts` | 6 | `6e8d5c309` `af3df59dd` |
| `core/tools/aidlc-channel.ts` | 6 | `afa704058` |
| `core/tools/aidlc-command.ts` | 4 | `6e8d5c309` `5e561ab1a` |
| `core/tools/aidlc-config-diagnostics.ts` | 9 | `6e8d5c309` `ad4a0ad02` |
| `core/tools/aidlc-directive.ts` | 5 | `8ed977085` `ad8ba858d` `a12ccbc9f` `ce4207b77` |
| `core/tools/aidlc-doctor-bundle.ts` | 5 | `3b0a329a2` `ddec5c0b5` |
| `core/tools/aidlc-doctor.ts` | 16 | `445578dc9` `6d6974507` `b980a43a7` `01b80253f` |
| `core/tools/aidlc-documentkb-schema.ts` | 1 | `51d4b9aa9` |
| `core/tools/aidlc-git.ts` | 23 | `c4960e702` |
| `core/tools/aidlc-guard-operation.ts` | 5 | `6e8d5c309` |
| `core/tools/aidlc-init.ts` | 33 | `445578dc9` `50a9e926c` `c4960e702` `6e8d5c309` `ad4a0ad02` `a12ccbc9f` `d3c4b95b8` `2f5537f0d` |
| `core/tools/aidlc-inline-context.ts` | 8 | `3ca1893e6` |
| `core/tools/aidlc-install-paths.ts` | 7 | `b650965ea` |
| `core/tools/aidlc-jump.ts` | 11 | `91b15fc8d` `c9591e300` `1fcea463f` `8504dd817` |
| `core/tools/aidlc-kiro-chat-record.ts` | 12 | `8e1e640b0` `56df50a28` |
| `core/tools/aidlc-kiro-ide-terminal.ts` | 2 | `ed2c6b04b` |
| `core/tools/aidlc-kiro-session.ts` | 20 | `445578dc9` |
| `core/tools/aidlc-knowledge.ts` | 69 | `843d995d0` `6e8d5c309` `ad4a0ad02` `51d4b9aa9` `89610b4b7` |
| `core/tools/aidlc-lib.ts` | 22 | `843d995d0` `d8dd27dcf` `c4960e702` `b650965ea` `6e8d5c309` `7fb6555a0` `ad8ba858d` `486c052da` `f9e1fa464` `8504dd817` `575079bed` `1102324f9` `a49739ce5` `51d4b9aa9` `237a65f1a` `144874088` `71094735d` `92d39a09e` `432a50f17` `794fcf2b6` `fd3ac2345` `87472aa2a` |
| `core/tools/aidlc-lifecycle.ts` | 12 | `c4960e702` `b650965ea` `6e8d5c309` `1d4b76a83` `ed2c6b04b` |
| `core/tools/aidlc-locks.ts` | 8 | `843d995d0` `51d4b9aa9` `517bafb60` |
| `core/tools/aidlc-log.ts` | 68 | `6e8d5c309` `f9e1fa464` `432a50f17` `ce4207b77` `517bafb60` `fd3ac2345` |
| `core/tools/aidlc-machine-config.ts` | 2 | `6e8d5c309` |
| `core/tools/aidlc-markdown.ts` | 9 | `144874088` |
| `core/tools/aidlc-message-store.ts` | 11 | `432a50f17` |
| `core/tools/aidlc-model-policy.ts` | 3 | `445578dc9` |
| `core/tools/aidlc-orchestrate.ts` | 334 | `8ed977085` `17f495318` `91b15fc8d` `d2b117274` `6e8d5c309` `c9591e300` `b72cc6d1d` `ad8ba858d` `8e6b65e16` `8504dd817` `575079bed` `47de5005f` `dfa9d67ff` `ac4b02b63` `798eceeb4` `911f52e52` `83638be25` `ff498c1f4` `92d39a09e` `432a50f17` `ab95815fa` `afa704058` `e558d6cfd` `f592d97ee` `3bfb58698` `87472aa2a` |
| `core/tools/aidlc-plan-approval-ask.ts` | 67 | `eced48f64` `12a98acfa` `ac4b02b63` `71094735d` `0d69b5c35` `5e561ab1a` `a4e663b58` `fd3ac2345` |
| `core/tools/aidlc-plugin-build.ts` | 1 | `6e8d5c309` |
| `core/tools/aidlc-plugin-test.ts` | 5 | `ad4a0ad02` |
| `core/tools/aidlc-plugin-validate.ts` | 1 | `6e8d5c309` |
| `core/tools/aidlc-plugin.ts` | 5 | `6e8d5c309` |
| `core/tools/aidlc-questions.ts` | 9 | `ac4b02b63` |
| `core/tools/aidlc-record-core.ts` | 8 | `c4960e702` `b650965ea` `87472aa2a` |
| `core/tools/aidlc-release.ts` | 11 | `1d4b76a83` `4484fef97` |
| `core/tools/aidlc-reply-reader.ts` | 6 | `432a50f17` |
| `core/tools/aidlc-runner-gen.ts` | 11 | `6e8d5c309` `9a62cf9f1` `bf7e0b1cf` |
| `core/tools/aidlc-runtime-paths.ts` | 18 | `6e8d5c309` `020b9fcdd` `1bc8e7447` |
| `core/tools/aidlc-sensor-linter.ts` | 1 | `226b593c1` `020b9fcdd` |
| `core/tools/aidlc-state-upgrade.ts` | 28 | `8ed977085` |
| `core/tools/aidlc-state.ts` | 42 | `c4960e702` `6e8d5c309` `9c1c8ba3c` `aa53a342c` `4446c9f9e` `ac4b02b63` `a49739ce5` `144874088` `af3df59dd` `517bafb60` |
| `core/tools/aidlc-steering.ts` | 1 | `359613c3b` |
| `core/tools/aidlc-subagent-inflight.ts` | 48 | `575079bed` `237a65f1a` |
| `core/tools/aidlc-swarm-source.ts` | 1 | `a49739ce5` |
| `core/tools/aidlc-swarm.ts` | 18 | `c4960e702` `6e8d5c309` `486c052da` `53aeef3b8` `06a3d5391` |
| `core/tools/aidlc-testing-posture.ts` | 53 | `c4960e702` `eced48f64` `2dd100baf` `12a98acfa` `a49739ce5` `0d69b5c35` `ce4207b77` |
| `core/tools/aidlc-uninstall-plan.ts` | 1 | `ed2c6b04b` |
| `core/tools/aidlc-unit-holders.ts` | 27 | `d8dd27dcf` |
| `core/tools/aidlc-unit.ts` | 63 | `8ed977085` `d8dd27dcf` `6e8d5c309` `b72cc6d1d` `f15d76083` `d3c4b95b8` `47de5005f` |
| `core/tools/aidlc-utility.ts` | 61 | `8ed977085` `6e8d5c309` `0f826bc1c` `ff22aef72` `51d4b9aa9` `237a65f1a` `89610b4b7` `a9b4d6dc4` `afa704058` `87472aa2a` |
| `core/tools/aidlc-windows-uninstall.ts` | 4 | `ed2c6b04b` `b980a43a7` `01b80253f` |
| `core/tools/aidlc-workspace-doctor.ts` | 17 | `c4960e702` `6e8d5c309` `4398ec484` |
| `core/tools/aidlc-worktree.ts` | 8 | `c4960e702` `6e8d5c309` `95fbef09e` `a49739ce5` |
| `core/tools/aidlc.ts` | 37 | `6e8d5c309` `51d4b9aa9` `89610b4b7` `1bc8e7447` `5e561ab1a` `afa704058` |
| `harness/codex/hooks/aidlc-codex-adapter.ts` | 9 | `4397f483d` `986da3a04` |
| `harness/copilot/hooks/aidlc-copilot-adapter.ts` | 5 | `986da3a04` `adedc674a` |
| `harness/kiro-ide/hooks/aidlc-kiro-adapter.ts` | 69 | `ad8ba858d` `2dd100baf` `56df50a28` `8624c26a5` `9cd212592` |
| `harness/kiro/hooks/aidlc-kiro-adapter.ts` | 62 | `ad8ba858d` `4398ec484` `ca2c816cb` `1102324f9` `8624c26a5` |
| `harness/opencode/plugin/aidlc-opencode-adapter.ts` | 7 | `986da3a04` `92d39a09e` |
| `plugins/test-pro/tests/plugin.test.ts` | 6 | `9a62cf9f1` |
| `plugins/test-pro/tools/test-pro-doctor.ts` | 1 | `6e8d5c309` |
| `scripts/plugin-hooks-template/compose.ts` | 5 | `6e8d5c309` |
| `scripts/release-promotion.ts` | 2 | `01b80253f` |
| `tests/e2e/t-acp-kiro-compose-inflight.serial.test.ts` | 2 | `87472aa2a` |
| `tests/e2e/t-exec-codex-compose-inflight.serial.test.ts` | 3 | `87472aa2a` |
| `tests/harness/code-generation-states.ts` | 2 | `4397f483d` |
| `tests/harness/codex-hook-answer.ts` | 8 | `4397f483d` |
| `tests/harness/conductor-skill.ts` | 11 | `451098163` |
| `tests/harness/fixtures.ts` | 1 | `a49739ce5` |
| `tests/harness/person-turns.ts` | 7 | `4c3a662f9` |
| `tests/harness/persons-words-readers.ts` | 8 | `2dd100baf` `0f826bc1c` `92d39a09e` `432a50f17` `e558d6cfd` |
| `tests/harness/swarm-checkpoint.ts` | 4 | `486c052da` |
| `tests/integration/t-claim-file-place.test.ts` | 37 | `d8dd27dcf` |
| `tests/integration/t-claimed-unit-beside-another-checkouts-unit.test.ts` | 3 | `d2b117274` `47da6ddce` |
| `tests/integration/t-claimed-unit-reopen.test.ts` | 7 | `ab95815fa` `517bafb60` `fd3ac2345` |
| `tests/integration/t-lead-redo-finished-unit.test.ts` | 84 | `17f495318` `c9591e300` `798eceeb4` `911f52e52` |
| `tests/integration/t-review-verdict-unit-state.test.ts` | 1 | `fd3ac2345` |
| `tests/integration/t-single-on-finished-work.test.ts` | 9 | `707e50b0a` |
| `tests/integration/t-team-handover-offers.test.ts` | 65 | `d2b117274` `b72cc6d1d` `f15d76083` `47de5005f` |
| `tests/integration/t-team-lead-stop.test.ts` | 50 | `aa53a342c` |
| `tests/integration/t-team-unit-land-after-jump.test.ts` | 58 | `17f495318` `91b15fc8d` `d2b117274` `c9591e300` `8504dd817` |
| `tests/integration/t-team-unit-replan-open-claims.test.ts` | 3 | `91b15fc8d` |
| `tests/integration/t-unit-help-changes-nothing.test.ts` | 5 | `d3c4b95b8` |
| `tests/integration/t121-stop-hook-enforce.test.ts` | 1 | `87472aa2a` |
| `tests/integration/t127-single-stage-invariant.test.ts` | 4 | `12a98acfa` |
| `tests/integration/t195-stop-hook-compose-carveout.test.ts` | 4 | `87472aa2a` |
| `tests/integration/t325-team-unit-claims.test.ts` | 37 | `0f826bc1c` |
| `tests/integration/t326-team-unit-merge-records.test.ts` | 2 | `fd3ac2345` |
| `tests/integration/t327-stop-hook-subagent-inflight.test.ts` | 6 | `237a65f1a` |
| `tests/integration/t327-team-dispatcher.test.ts` | 4 | `d2b117274` `6e8d5c309` |
| `tests/integration/t36-stage-protocol-governance.test.ts` | 1 | `0a3854daf` |
| `tests/integration/t37-stage-protocol-compliance.test.ts` | 3 | `0a3854daf` |
| `tests/integration/t91.test.ts` | 12 | `4c3a662f9` `237a65f1a` |
| `tests/integration/t92.test.ts` | 32 | `226b593c1` `020b9fcdd` `300fbb5dd` |
| `tests/smoke/t03-settings-json.test.ts` | 4 | `09f006e4e` `6e8d5c309` |
| `tests/unit/t-active-space-includes.test.ts` | 3 | `4398ec484` |
| `tests/unit/t-agent-reference-agrees-with-the-stages.test.ts` | 18 | `568f1d88e` |
| `tests/unit/t-answers-taken-as-given.test.ts` | 19 | `741f86646` |
| `tests/unit/t-approval-beside-refused-setting.test.ts` | 71 | `dfa9d67ff` |
| `tests/unit/t-build-told-brought-files.test.ts` | 2 | `7fb6555a0` |
| `tests/unit/t-claim-places.test.ts` | 27 | `d8dd27dcf` |
| `tests/unit/t-claude-guard-group.test.ts` | 3 | `5e561ab1a` |
| `tests/unit/t-code-generation-completion-owner.test.ts` | 1 | `12a98acfa` |
| `tests/unit/t-code-generation-plan-adds-mid-build.test.ts` | 55 | `a4e663b58` |
| `tests/unit/t-code-generation-plan-names-data-model.test.ts` | 50 | `a4e663b58` |
| `tests/unit/t-codex-helper-session.test.ts` | 3 | `4397f483d` |
| `tests/unit/t-compose-approve-carries-on.test.ts` | 38 | `3bfb58698` `87472aa2a` |
| `tests/unit/t-construction-staffing-question.test.ts` | 7 | `8647fa952` |
| `tests/unit/t-contract-stale-by-setting.test.ts` | 6 | `eced48f64` `12a98acfa` |
| `tests/unit/t-copy-install-onboard-step.test.ts` | 40 | `8624c26a5` `ff498c1f4` |
| `tests/unit/t-cut-request-whole-words.test.ts` | 111 | `432a50f17` |
| `tests/unit/t-docs-links-reach-a-page.test.ts` | 47 | `de3617916` |
| `tests/unit/t-engine-from-code-repo.test.ts` | 35 | `1bc8e7447` |
| `tests/unit/t-gate-says-replaced-files.test.ts` | 3 | `7fb6555a0` |
| `tests/unit/t-generated-text-names-what-the-harness-has.test.ts` | 17 | `9a62cf9f1` |
| `tests/unit/t-graph-read-subcommands.test.ts` | 27 | `16b461d94` |
| `tests/unit/t-guard-plan-continuation-swarm.test.ts` | 10 | `a12ccbc9f` `0d69b5c35` |
| `tests/unit/t-handover-and-onboarding-match-what-ships.test.ts` | 16 | `915d65c73` |
| `tests/unit/t-hooks-off-step.test.ts` | 16 | `2dd100baf` `432a50f17` |
| `tests/unit/t-installed-text-names-no-repo-docs.test.ts` | 28 | `6b2ac7d0a` |
| `tests/unit/t-intent-add-repo.test.ts` | 14 | `a9b4d6dc4` |
| `tests/unit/t-issue-report-doctor-env.test.ts` | 16 | `8e1e640b0` |
| `tests/unit/t-issue-report-run-facts.test.ts` | 19 | `8e1e640b0` `1ae045440` |
| `tests/unit/t-issue-report-shape.test.ts` | 8 | `1ae045440` |
| `tests/unit/t-kiro-agent-models.test.ts` | 32 | `445578dc9` |
| `tests/unit/t-kiro-ide-terminal.test.ts` | 3 | `ed2c6b04b` `451098163` |
| `tests/unit/t-kiro-request-keeps-spacing.test.ts` | 7 | `4398ec484` `432a50f17` |
| `tests/unit/t-kiro-skill-read-in-parts.test.ts` | 40 | `451098163` `3ca1893e6` |
| `tests/unit/t-lines-said-before-they-reply.test.ts` | 46 | `ad8ba858d` `a12ccbc9f` `8e6b65e16` |
| `tests/unit/t-long-message-note.test.ts` | 107 | `4398ec484` `1102324f9` `92d39a09e` |
| `tests/unit/t-newer-work-update-offer.test.ts` | 49 | `8ed977085` |
| `tests/unit/t-onboard-adds-named-document.test.ts` | 55 | `51d4b9aa9` `89610b4b7` |
| `tests/unit/t-one-other-choice.test.ts` | 11 | `578a61cad` |
| `tests/unit/t-open-work-long-name.test.ts` | 35 | `ab95815fa` |
| `tests/unit/t-person-turns.test.ts` | 9 | `4c3a662f9` |
| `tests/unit/t-phase-check-has-one-owner.test.ts` | 14 | `0a3854daf` |
| `tests/unit/t-plan-approval-ask.test.ts` | 192 | `a12ccbc9f` `eced48f64` `12a98acfa` `a49739ce5` `71094735d` `0d69b5c35` |
| `tests/unit/t-plan-approval-off-after-question.test.ts` | 10 | `12a98acfa` |
| `tests/unit/t-plan-approval-refusal-way-out.test.ts` | 4 | `a12ccbc9f` `12a98acfa` |
| `tests/unit/t-plan-approval-switch.test.ts` | 5 | `0d69b5c35` |
| `tests/unit/t-plan-question-box-summary.test.ts` | 129 | `5e561ab1a` |
| `tests/unit/t-plan-question-new-chat.test.ts` | 90 | `ac4b02b63` |
| `tests/unit/t-practices-save-new-space.test.ts` | 35 | `144874088` |
| `tests/unit/t-printed-commands-config.test.ts` | 47 | `6e8d5c309` |
| `tests/unit/t-printed-commands-dispatcher.test.ts` | 35 | `6e8d5c309` |
| `tests/unit/t-printed-commands-engine.test.ts` | 30 | `09f006e4e` `6e8d5c309` |
| `tests/unit/t-printed-commands-quoting.test.ts` | 24 | `6e8d5c309` |
| `tests/unit/t-project-in-repo.test.ts` | 43 | `c4960e702` |
| `tests/unit/t-refined-mockups-runs-without-ideation.test.ts` | 20 | `7649012be` |
| `tests/unit/t-release-provenance-names-repository.test.ts` | 14 | `4484fef97` |
| `tests/unit/t-repair-says-what-it-repaired.test.ts` | 1 | `12a98acfa` |
| `tests/unit/t-review-knows-plan-change.test.ts` | 61 | `ce4207b77` |
| `tests/unit/t-review-request-names-its-command.test.ts` | 1 | `794fcf2b6` |
| `tests/unit/t-routing-question-own-marker.test.ts` | 1 | `ac4b02b63` |
| `tests/unit/t-rule-layers-say-what-the-engine-does.test.ts` | 36 | `359613c3b` |
| `tests/unit/t-rules-travel-with-steps.test.ts` | 2 | `a12ccbc9f` `451098163` |
| `tests/unit/t-scope-switch-windows-line-endings.test.ts` | 35 | `ff22aef72` |
| `tests/unit/t-sensor-type-check-native.test.ts` | 3 | `300fbb5dd` |
| `tests/unit/t-set-aside-unit-skeleton.test.ts` | 99 | `83638be25` |
| `tests/unit/t-skill-composer-on-demand.test.ts` | 1 | `451098163` |
| `tests/unit/t-skill-no-continuation-default.test.ts` | 5 | `451098163` |
| `tests/unit/t-skill-title-in-plain-words.test.ts` | 3 | `451098163` |
| `tests/unit/t-stage-steps-agree-with-the-engine.test.ts` | 24 | `165a19c72` |
| `tests/unit/t-steps-carry-their-words.test.ts` | 4 | `a12ccbc9f` |
| `tests/unit/t-subagent-inflight-ignored.test.ts` | 18 | `237a65f1a` |
| `tests/unit/t-summary-stop-has-one-owner.test.ts` | 10 | `6cbf16257` |
| `tests/unit/t-swarm-check-time-limit.test.ts` | 14 | `53aeef3b8` |
| `tests/unit/t-swarm-ignored-files-are-not-source.test.ts` | 47 | `a49739ce5` |
| `tests/unit/t-swarm-landing-clash.test.ts` | 40 | `486c052da` `95fbef09e` |
| `tests/unit/t-swarm-landing-leaves-aidlc-files.test.ts` | 29 | `486c052da` |
| `tests/unit/t-swarm-recovery-review-retry.test.ts` | 14 | `f9e1fa464` |
| `tests/unit/t-swarm-unit-starts-with-records.test.ts` | 1 | `6e8d5c309` |
| `tests/unit/t-swarm-unit-tests-through-aidlc.test.ts` | 10 | `53aeef3b8` `06a3d5391` |
| `tests/unit/t-team-skeleton-answer-first.test.ts` | 3 | `f592d97ee` |
| `tests/unit/t-team-skip-mid-walk.test.ts` | 14 | `f592d97ee` |
| `tests/unit/t-traced-id-examples.test.ts` | 3 | `568f1d88e` |
| `tests/unit/t-uninstall-plan.test.ts` | 5 | `ed2c6b04b` |
| `tests/unit/t-unit-notes-in-unit-folder.test.ts` | 2 | `d3c4b95b8` |
| `tests/unit/t-unit-receipt-recovery-ask.test.ts` | 6 | `fd3ac2345` |
| `tests/unit/t-unit-source-changes-lookup.test.ts` | 58 | `af3df59dd` |
| `tests/unit/t-unit-start-receipt.test.ts` | 42 | `517bafb60` `fd3ac2345` |
| `tests/unit/t-version-names-pin.test.ts` | 30 | `afa704058` |
| `tests/unit/t-windows-path-uninstall.test.ts` | 29 | `ed2c6b04b` `b980a43a7` `01b80253f` |
| `tests/unit/t100-memory-template-lifecycle.test.ts` | 1 | `d3c4b95b8` |
| `tests/unit/t114-orchestrate-next.test.ts` | 3 | `6e8d5c309` `ff498c1f4` |
| `tests/unit/t129-stage-runner-drift.test.ts` | 5 | `bf7e0b1cf` |
| `tests/unit/t1454-long-brief-compose.test.ts` | 16 | `e558d6cfd` |
| `tests/unit/t149-codex-hook-adapter.test.ts` | 20 | `4397f483d` |
| `tests/unit/t174-docs-legacy-refs-gate.test.ts` | 2 | `6b2ac7d0a` `451098163` |
| `tests/unit/t178-classify-terminal-command.test.ts` | 1 | `6e8d5c309` |
| `tests/unit/t180-kiro-rollforward-seam.test.ts` | 37 | `ad8ba858d` `4398ec484` `8624c26a5` |
| `tests/unit/t186-foreach-per-unit-iteration.test.ts` | 4 | `12a98acfa` |
| `tests/unit/t204-compose-marker-doctor.test.ts` | 3 | `6e8d5c309` `237a65f1a` `87472aa2a` |
| `tests/unit/t218-kiro-ide-hook-adapter.test.ts` | 111 | `ad8ba858d` `2dd100baf` `56df50a28` `451098163` `9cd212592` |
| `tests/unit/t222-plugin-runner-naming.test.ts` | 3 | `bf7e0b1cf` |
| `tests/unit/t229-workspace-parser.test.ts` | 1 | `6e8d5c309` |
| `tests/unit/t232-phase-progress-flip.test.ts` | 3 | `1fcea463f` |
| `tests/unit/t236-ensemble-evidence-gate.test.ts` | 11 | `dfa9d67ff` |
| `tests/unit/t240-opencode-packaging.test.ts` | 2 | `986da3a04` |
| `tests/unit/t242-state-transition-guard.test.ts` | 20 | `f8ed25733` |
| `tests/unit/t243-doctor-bundle.test.ts` | 7 | `3b0a329a2` `ddec5c0b5` |
| `tests/unit/t243-install-mechanism.test.ts` | 46 | `b650965ea` `6e8d5c309` `4398ec484` `486c052da` `6b2ac7d0a` `b980a43a7` |
| `tests/unit/t244-install-management.test.ts` | 24 | `1d4b76a83` `ed2c6b04b` |
| `tests/unit/t245-kiro-ide-hook-registrations.test.ts` | 1 | `6e4a2e9ef` |
| `tests/unit/t249-copilot-adapter.test.ts` | 9 | `adedc674a` |
| `tests/unit/t250-copilot-adapter-security.test.ts` | 4 | `986da3a04` `adedc674a` |
| `tests/unit/t251-sensor-stdout-noise.test.ts` | 4 | `020b9fcdd` |
| `tests/unit/t256-workspace-doctor.test.ts` | 25 | `6e8d5c309` `4398ec484` |
| `tests/unit/t259-turn-markers.test.ts` | 5 | `3bfb58698` `87472aa2a` |
| `tests/unit/t263-reviewer-terminal-ordering.test.ts` | 1 | `451098163` |
| `tests/unit/t264-review-freeze-hook.test.ts` | 12 | `986da3a04` `451098163` |
| `tests/unit/t265-plan-approval-guard.test.ts` | 134 | `a12ccbc9f` `4397f483d` `986da3a04` `59b64b0d8` `237a65f1a` `451098163` |
| `tests/unit/t27.test.ts` | 6 | `3b0a329a2` `6d6974507` |
| `tests/unit/t272-unit-major-code-gen.test.ts` | 4 | `12a98acfa` |
| `tests/unit/t276-cursor-adapter.test.ts` | 69 | `6e8d5c309` `eb59fe50a` `a12ccbc9f` `7281155dc` `237a65f1a` |
| `tests/unit/t282-state-version-doctor.test.ts` | 3 | `8ed977085` |
| `tests/unit/t286-read-write-boundary.test.ts` | 3 | `843d995d0` |
| `tests/unit/t288-documentkb-schema.test.ts` | 4 | `51d4b9aa9` |
| `tests/unit/t289-knowledge-onboard-boundary.test.ts` | 14 | `843d995d0` `51d4b9aa9` `89610b4b7` |
| `tests/unit/t293-config-models.test.ts` | 3 | `a12ccbc9f` `d3c4b95b8` |
| `tests/unit/t294-config-diagnostics.test.ts` | 18 | `6e8d5c309` `ad4a0ad02` `a12ccbc9f` |
| `tests/unit/t295-knowledge-extraction.test.ts` | 2 | `6e8d5c309` |
| `tests/unit/t299-first-run-wizard.test.ts` | 18 | `50a9e926c` `d3c4b95b8` `2f5537f0d` |
| `tests/unit/t314-source-freshness-receipts.test.ts` | 10 | `6e8d5c309` `a49739ce5` |
| `tests/unit/t316-plugin-test.test.ts` | 13 | `ad4a0ad02` |
| `tests/unit/t318-session-binding-helpers.test.ts` | 7 | `b650965ea` |
| `tests/unit/t319-doctor-hooks-blocked.test.ts` | 2 | `2dd100baf` |
| `tests/unit/t324-team-unit-progress-gates.test.ts` | 22 | `9c1c8ba3c` `4446c9f9e` `fd3ac2345` |
| `tests/unit/t329-document-input.test.ts` | 10 | `51d4b9aa9` |
| `tests/unit/t334-change-control-plan-approval.test.ts` | 14 | `a49739ce5` |
| `tests/unit/t341-orchestrate-wait.test.ts` | 56 | `575079bed` |
| `tests/unit/t342-construction-checkpoint-routing.test.ts` | 13 | `12a98acfa` `f592d97ee` `fd3ac2345` |
| `tests/unit/t349-audit-trail-guard.test.ts` | 6 | `986da3a04` |
| `tests/unit/t352-workspace-reclassify.test.ts` | 1 | `8e6b65e16` |

Files foundation had edited before the merge (12), rises by rule as (rule, before, after):

- `tests/smoke/t148-kiro-file-structure.test.ts`: [('aidlc/no-comments', 192, 198)]
- `tests/unit/t-kiro-hook-exit-code.test.ts`: [('max-len', 8, 9)]
- `tests/unit/t-kiro-typed-harness-names.test.ts`: [('aidlc/no-comments', 82, 85), ('max-len', 111, 115)]
- `tests/unit/t-skill-body-carriers.test.ts`: [('max-lines-per-function', 0, 1)]
- `tests/unit/t147-kiro-hook-adapter.test.ts`: [('aidlc/no-comments', 276, 303), ('max-len', 142, 170), ('max-lines-per-function', 11, 12)]
- `tests/unit/t150-codex-packaging.test.ts`: [('aidlc/no-comments', 77, 78)]
- `tests/unit/t151-onboarding-skeleton.test.ts`: [('max-len', 9, 12)]
- `tests/unit/t181-conductor-skill-parity.test.ts`: [('max-depth', 3, 4)]
- `tests/unit/t221-reviewer-scope-hook.test.ts`: [('aidlc/no-comments', 107, 110), ('max-len', 50, 57)]
- `tests/unit/t230-dispatcher-routes.test.ts`: [('max-len', 127, 132)]
- `tests/unit/t239-documentation-parity.test.ts`: [('max-len', 33, 111), ('aidlc/no-comments', 44, 70), ('max-lines-per-function', 7, 8), ('complexity', 2, 3)]
- `tests/unit/t248-steering-content-delivery.test.ts`: [('aidlc/no-comments', 138, 139)]

102 per-file rule counts fell.

Each mixed file linted at `caea995ae`, `8c4f79b4b`, `965cbec73` and the head: the recorded rise (head over `965cbec73`) against upstream's own rise (`8c4f79b4b` over `caea995ae`), per rule:

- `tests/smoke/t148-kiro-file-structure.test.ts`: aidlc/no-comments: recorded +6, upstream own +6 COVERED; max-len: recorded +2, upstream own +2 COVERED
- `tests/unit/t-kiro-hook-exit-code.test.ts`: max-len: recorded +1, upstream own +1 COVERED
- `tests/unit/t-kiro-typed-harness-names.test.ts`: aidlc/no-comments: recorded +3, upstream own +3 COVERED; max-len: recorded +4, upstream own +4 COVERED
- `tests/unit/t-skill-body-carriers.test.ts`: max-lines-per-function: recorded +1, upstream own +1 COVERED
- `tests/unit/t147-kiro-hook-adapter.test.ts`: aidlc/no-comments: recorded +27, upstream own +27 COVERED; max-len: recorded +28, upstream own +28 COVERED; max-lines-per-function: recorded +1, upstream own +1 COVERED
- `tests/unit/t150-codex-packaging.test.ts`: aidlc/no-comments: recorded +1, upstream own +1 COVERED
- `tests/unit/t151-onboarding-skeleton.test.ts`: max-len: recorded +3, upstream own +3 COVERED
- `tests/unit/t181-conductor-skill-parity.test.ts`: max-depth: recorded +1, upstream own +1 COVERED
- `tests/unit/t221-reviewer-scope-hook.test.ts`: aidlc/no-comments: recorded +3, upstream own +3 COVERED; max-len: recorded +7, upstream own +7 COVERED
- `tests/unit/t230-dispatcher-routes.test.ts`: max-len: recorded +5, upstream own +5 COVERED
- `tests/unit/t239-documentation-parity.test.ts`: aidlc/no-comments: recorded +26, upstream own +26 COVERED; complexity: recorded +1, upstream own +1 COVERED; max-len: recorded +78, upstream own +78 COVERED; max-lines-per-function: recorded +1, upstream own +1 COVERED
- `tests/unit/t248-steering-content-delivery.test.ts`: aidlc/no-comments: recorded +1, upstream own +1 COVERED
