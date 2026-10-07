# Selectable rules and adoptable governance: acceptance findings

This is a bounded local prototype and repair proposal. It does not ship arbitrary rule selection or approve a constitution rewrite. The existing fork PR carries these findings for review.

## Coherent boundaries

| Selection | Necessary meaning / inputs | Optional integration or coupling |
| --- | --- | --- |
| CD-7, with no exemptions | Abstraction-based names, explicit target population, filename checker | The current all-walker dispatcher and compiler bundles are incidental imports. |
| CD-7 plus CD-46 governance | CD-7 compliance; exemption provenance; changed-file/baseline evidence; whole-file paydown and retirement | Adoptable without Rin stages or R7. Decay alone does not prove paydown. |
| DD-1 + DD-3 + DD-4 | Keyed measured claims; record-wide identity/resolution; official artifacts of selected stages | The current dd-1 entrypoint jointly checks DD-1/3. Stock stages provide DD-4 population. |
| CD-37 + CD-38 + CD-39 | Task trace, explicit pre-work constitution check/sign-off, precise rule citations | Manual review obligations; Rin gate numbering is unnecessary. |
| DD-5 with DD-1/4 | Current official facts; append-only discovery narration; correction/withdrawal provenance | Judgement, explicitly not a mechanical prose classifier. |
| DD-7 / R7 exception chains | Explicit adoption, Five Whys content/refusals, adjacent artifact chains and registry/disposition obligations | Canonical DD-7 is project-specific R7 policy. It remains off in this demonstration. |

Declared canonical pairings are related guidance, not an automatically enforced package dependency. CD-46 pairs with CD-2/10/27/37; its script does not import their checkers. Keep applicability conditions, authorised exception locations and inherited-debt carve-outs distinct. With R7 off, a synthetic CD-7 probe passed either registry alone, refused simultaneous ownership through doubly_held_paths, and rejected a malformed carve-out lacking required provenance. These are existing loader/conflict contracts, not dependency-selection validation.

## Prioritized repair sequence

1. **DD population, prerequisite for stock-workflow DD acceptance.** Canonical DD-4 restricts population to artifacts produced by the record's selected stages. The current officialArtefactStems unions every graph node's produces and matches basenames anywhere in the record. Use existing record/scope resolution to supply the selected official population to the inspector; refuse unknown population rather than widening it. Preserve official artifact path/template conventions. No stage or scope rewrite is needed.

   Verified workshop example: requirements-analysis is EXECUTE; intent-capture is SKIP. INCLUDED-2 in requirements.md should fail. EXCLUDED-3 in intent-statement.md must be ignored. Current code reports both; a diagnostic graph restricted through existing subgraphForScope reports only INCLUDED-2. After correcting the included artifact, only the current all-node resolver still fails. Earlier intent-capture key checks proved mechanical detection, not workshop DD-4 applicability.

2. **Coverage honesty, prerequisite for blocking acceptance.** A default aggregate scan succeeded with scanned_count 0; the selected CD script passes a missing file; DD passes outside an intent record. Expose evaluated/not-applicable/unmeasurable plus relevant coverage counts/population. Require evaluated coverage in the enforcement adapter while preserving advisory skips. Missing graph already produces an unmeasurable DD result. Do not infer compliance from pass alone.

3. **CD-46 baseline and paydown, prerequisite only when adopting exemption governance.** The rule requires the whole touched exempt file to become compliant and its exemption to be retired in the same change; it cannot itself be exempted. The checker detects edited retained exemptions, but contentExistsInBaseRef checks cat-file -e blob^{blob}, not membership in the requested baseline. A changed file whose bytes were merely written to the object database incorrectly passes. Repair that bounded lookup in the decay checker; preserve genuine content-identical moves.

   Removing the sidecar entry also passes with src/utils.ts still dirty. This is a composition gap: the decay result proves no active touched exemption, not underlying compliance. Pair it with the governed selected-rule checker and complete-file population at the enforcement boundary. Do not expand the decay script into every rule implementation. Retired paths need their selected-rule compliance evidence; blanket all-CD adoption is unnecessary.

   Existing owner: 260820-cd46-decay-traps-new-fil. The new baseline-membership defect is distinct from its already absorbed script-error false-pass case (01a09f35-6d40-73ea-a9c4-515a57b0a613); paydown composition is distinct from its per-path/per-entry remedy case (01a0192e-82f8-73bf-8ca3-7123318a6571). No competing intent or semantic change was created. Constitution decisions remain with the operator.

4. **Stock selection lifecycle, prerequisite for claiming selective adoption/removal on stock.** Upstream current-root-only sync bypasses selection filtering and does not clean proven owned deselected files. Apply selection consistently and transact only ownership-proven removals. The fork already filters current-root inventory and removes owned deselected contributions; its generic removal test deleted 416 files and preserved four consumer files. Do not present fork behavior as upstream behavior. Do not fake full inventory or force prune.

5. **Dependency closure, prerequisite for a safe production selector; explicit recipe is sufficient for this bounded prototype.** Existing manifests declare core/runtime dependencies, but validation checks array shape and selection accepts omitted runtime. Validate selected required dependencies using the existing declaration before mutation, with clear missing-dependency diagnostics. Define removal ordering and cycle/version semantics narrowly before supporting them; no new rule DSL is needed. Current recipe selects the complete closure explicitly.

6. **Optional integration and packaging, later work.** Existing adds.sensors can attach chosen manifests to named stock stages without replacing stage identities/scopes. That changes sensor metadata/compiled graph, so it was not applied to the byte-identical graph prototype. A project-wide trigger independent of stages would need a separate project-selected registration contract. Blocking Lefthook/consumer commands remain distinct from advisory automatic sensors.

   Shared payload is 41,855,246 bytes, primarily 40,906,049 bytes of bundles. CD dispatcher executable closure is 40,979,951 bytes; DD-only is 894,965, excluding declarations/licenses. Separate existing naming logic from the all-walker barrel/compiler-dependent export audit, and package DD independently. This optimization is not prerequisite for demonstrating correct rule semantics.

Stock sync/dependency fixes are upstream candidates; DD/CD-46/coverage fixes belong first to their existing fork/owner layers. The independent three-file marketplace candidate remains local, outside this documentation publication.

## What actually passed

Selected CD-7 detected/corrected its filename negative while an omitted CD-14 class violation remained; a labelled control detected CD-14. Selected DD-1/3 detected/corrected a dangling key while omitted DD-2's bare figure remained; its control detected DD-2. Sensors remained advisory; the consumer adapter returned failure on findings and success after correction. No installed Lefthook binary existed, so actual Lefthook execution is not claimed.

Producer-owned edit refusal preserved all hashes/modes. A real auxiliary-document update and exact rollback passed, with canonical rules/sensors unchanged. Stock graph/scopes were byte-identical throughout. Stock deselection failed to remove the DD script; complete valid selection was restored. No native workflow gate or R7 adoption was earned.

## Reproduce using public inputs

Pins and synthetic result data are in [results.json](rule-reuse-evidence/results.json). Use two producer checkouts: this public fork at 761b3c48758598fd0b4d1ae695430a4f29aca93a (same authored runtime as archive producer 50cda419b787644f77e8d9ec8493a1862b100fbb), and aws/aidlc-workflows at 0dba615ffd4375d85fbe16a36040b0cbf58f2960. In each producer, install the locked dependencies and run bun scripts/package.ts. All subsequent consumer work uses generated outputs, not checkout dependencies or private configuration.

Use EVIDENCE as the absolute path to the accompanying rule-reuse-evidence directory from the documentation revision serving this page; these helpers are not part of the pinned runtime producer commit. Keep that documentation directory separate from the pinned producer checkouts. Use fresh absolute paths FORK, STOCK, PACKS, OUT and CONSUMER. Run from CONSUMER with a clean HOME and explicit AIDLC_PROJECT_DIR/CLAUDE_PROJECT_DIR, AIDLC_HARNESS=claude, AIDLC_HARNESS_DIR=.claude, AIDLC_RUNTIME_ROOT pointing to STOCK/dist. R7 defaults off. Do not borrow a user's plugin registry.

~~~bash
python3 "$EVIDENCE/prepare-rule-packs.py" --rin-plugin "$FORK/dist/plugins/rin/claude" --out "$PACKS"
bun "$STOCK/dist/claude/.claude/tools/aidlc-init.ts" config --from "$STOCK/dist/claude" --project-dir "$CONSUMER"
for name in discipline-runtime cd-7 dd-1; do
  bun "$CONSUMER/.claude/tools/aidlc-plugin-build.ts" "$PACKS/$name" claude "$OUT/$name" --json
  AIDLC_PLUGIN_ROOT="$OUT/$name" CLAUDE_PLUGIN_ROOT="$OUT/$name" CODEX_PLUGIN_ROOT="$OUT/$name" bun "$CONSUMER/.claude/tools/aidlc-plugin.ts" sync --project-dir "$CONSUMER"
done
bun "$CONSUMER/.claude/tools/aidlc-init.ts" config project --plugins aidlc,discipline-runtime,cd-7,dd-1 --yes --project-dir "$CONSUMER"
for name in discipline-runtime cd-7 dd-1; do
  AIDLC_PLUGIN_ROOT="$OUT/$name" CLAUDE_PLUGIN_ROOT="$OUT/$name" CODEX_PLUGIN_ROOT="$OUT/$name" bun "$CONSUMER/.claude/tools/aidlc-plugin.ts" sync --project-dir "$CONSUMER"
done
python3 "$EVIDENCE/probe.py" scope --consumer "$CONSUMER" --tools "$CONSUMER/.claude/tools"
python3 "$EVIDENCE/probe.py" cd46 --tools "$FORK/dist/plugins/rin/claude/tools"
~~~

The scope probe owns temporary fixtures and uses the actual stock scope API; its filtered graph is a diagnostic control, never installed. The CD-46 probe owns a temporary Git repository and creates only synthetic files/objects. Neither calls a model or changes installed rule sources. They assert observed defects, not repaired acceptance.

For the CD negative create src/purchase-amount.ts containing a class, run installed rin-harness-sensor-cd-7.ts --project-dir CONSUMER, rename it to src/utils.ts and repeat, then restore. CD-14 remains omitted despite its deliberate violation. For the DD positive use a workshop-selected requirements.md with a facts.md keyed row; add/remove an undefined key. The public scope probe supplies this fixture and distinguishes included/excluded artifacts.

For lifecycle repetition add an auxiliary knowledge document to the authored cd-7 pack, build immutable v1/v2 projections with different auxiliary bodies, sync v1 then v2 then v1. Deliberately edit the installed owned auxiliary document to reproduce refusal, preserve a complete hash/mode snapshot, restore its exact bytes and retry. Do not edit canonical rule text. Stock deselection can be repeated via config project without dd-1 and explicit-root sync; expect the measured defect, then restore the full selection.

The simple JSON adapter fails unless pass is true; add the independent coverage prerequisite before describing it as blocking enforcement. Lefthook installation and native hook/model execution are outside this reproduction.

## Source contracts

- Public plugins/rin/knowledge/aidlc-shared/code-discipline/cd-046-decarve-on-touch.md: full-file paydown/retirement.
- plugins/rin/tools/rin-harness-carve-out-decay.ts: changedFiles, contentExistsInBaseRef and findBreaches.
- plugins/rin/tools/rin-harness-cd-carve-outs.ts and exception-baseline helper: registry/provenance and optional R7 checks.
- plugins/rin/tools/rin-harness-doc-discipline.ts: officialArtefactStems, officialProseIn and inspectRecordDirectory.
- Stock core/tools/aidlc-graph.ts: resolvePlanForScope/subgraphForScope.
- Stock core/tools/aidlc-plugin.ts: current-root-only selection behavior; fork source includes deselected-owned cleanup.
- Stock core/hooks/aidlc-run-sensors.ts: active-stage advisory dispatch; docs/reference/18-plugin-mechanism.md: adds.sensors.
