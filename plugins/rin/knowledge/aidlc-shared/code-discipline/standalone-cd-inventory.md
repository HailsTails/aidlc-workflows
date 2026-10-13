# Standalone discipline coverage inventory

Use the [copy guide](standalone-adoption.md) and [minimal linter setup](standalone-linter-options.md). All **45 active CDs** are optional explicit knowledge/review selections; the 48 atomic files include CD-7a and redirects CD-16→15, CD-20→19, CD-24→23. Select the redirect owner. Read each atomic file in full: this map does not replace its rule text.

Evidence: **V** = executed violation/correction for the named clause, not complete CD enforcement; **R** = source/documentation candidate, not a consumer gate; **M** = manual or consumer-specific review. B/E/O mean Biome/ESLint/oxlint. Existing Rin bindings were source-inspected, not installed by copying knowledge.

## Complete selection map

| Canonical CD | Candidate ordinary check / evidence | Manual obligation and current Rin gap |
| --- | --- | --- |
| [1 No any](cd-001-no-any.md) | **V** B noExplicitAny/noImplicitAnyLet; E/O no-explicit-any; compiler noImplicitAny | Semantic propagation remains; no exemptions. Rin regex/visited-node checks are narrower. |
| [2 Closed cast list](cd-002-closed-cast-list.md) | **V** E TSAsExpression/TSTypeAssertion selectors | Blanket ban needs approved-site policy; tested as-const exception is not a full approved list. Rin hardcodes particular Zod/tool types. |
| [3 Strict flags](cd-003-strict-mode-flags.md) | **V** compiler/effective-config review; seven quick-start flags | Review strict constituent overrides, every config/reference and source/test membership. Rin text check does not resolve inheritance/named configs. Progressive path below. |
| [4 Zod boundaries](cd-004-zod-at-boundaries.md) | **M** boundary/schema/result review | Lint cannot identify all trust boundaries. Another validator is not automatically equivalent; no Rin custom binding. |
| [5 No comments](cd-005-no-comments.md) | **V** Rin tracked linter-directive recognition; **R** broader comment policy | ESLint/Biome/oxlint directives require their own tracker, not exemption authority. Config/file ignores are separate. Rin still does not prove all comments/JSDoc comply. |
| [6 Meaningful names](cd-006-meaningful-names.md) | **R** naming conventions, proxy | Meaning/role needs review; Rin has a short name deny list. |
| [7 Concept filenames](cd-007-no-categorical-filenames.md) | **R** filename/path inventory | Check applicable extensions/paths; Rin exact .ts/path rules are incomplete. |
| [7a No owned ReturnType typeof](cd-007a-no-returntype-typeof.md) | **V** E TSTypeReference/TSTypeQuery selector | Also rejects permitted external origins. Provenance manual; Rin regex has same gap. |
| [8 Closed-union switch](cd-008-no-default-on-closed-union.md) | **V** typed E switch-exhaustiveness-check | Project service/included files required; open string default passed. Rin text heuristic has no type proof. |
| [9 Result failures](cd-009-result-shaped-failures.md) | **M** API/call-site review | Prove expected failures flow as data; no custom binding. |
| [10 Closed throw list](cd-010-throws-closed-list.md) | **V** E ThrowStatement ban in forbidden locations | Approved startup invariants need narrow scope; blanket ban rejects them too. Rin principally checks test throws. |
| [11 Error data](cd-011-error-shapes-are-data.md) | **M** shape/startup review | Startup Error-class allowance conflicts with CD-14's class ban in that case: resolve explicitly; no custom binding. |
| [12 Storage repositories](cd-012-repositories-as-storage-abstraction.md) | **M** import/abstraction review | Responsibility is not a generic lint check; no custom binding. |
| [13 Inward layers](cd-013-kernel-layer-boundaries.md) | **R** consumer restricted imports/architecture checks | Configure actual graph, dynamic imports/re-exports; no custom binding. |
| [14 No authored classes](cd-014-no-class-authoring.md) | **V** E ClassDeclaration/ClassExpression ban | External construction passed; wrapper placement manual. Rin line regex misses shapes. |
| [15 Functional transformation](cd-015-no-for-of.md) | **V** E ForStatement/ForOfStatement[await=false] ban | forEach/async drain passed; authorize async location and review functional body. Rin broad async allowance can hide sync loops. |
| [16 Redirect](cd-016-no-counted-for.md) | CD-15 | Not an additional active CD. |
| [17 Clock port](cd-017-clock-only-time-source.md) | **V** E restricted Date.now/performance.now and zero-arg new Date | Fixed-input Date passed: clarify atomic interpretation. Other clock APIs/provenance remain; Rin app/script exceptions. |
| [18 SignalSink](cd-018-process-through-signalsink.md) | **V** E restricted process.exit/kill/on/once/hrtime | Destructured exit detected; full process surface/adapter ownership unproved; no custom binding. |
| [19 Unowned dependency ports](cd-019-third-party-wrapping-factories.md) | **V** E restricted static imports for explicit dependency list | Dynamic import passed. Review runtime/type imports, require/re-exports/browser globals. React/test dependencies have no automatic exemption. Rin fixed vendor/node list. |
| [20 Redirect](cd-020-node-stdlib-through-ports.md) | CD-19 | Not an additional active CD. |
| [21 Default factory](cd-021-ports-ship-default-factory.md) | **M** port/factory inventory | Verify shipped implementation/overrides; no custom binding. |
| [22 Middleware context](cd-022-middleware-context-constraint.md) | **M** shape/capability review | Consumer architecture matters; no custom binding. |
| [23 Co-located unit tests](cd-023-tests-co-located.md) | **R** sibling/path inventory | Presence is not substantive coverage. Rin .test.ts/.tsx check has exemptions/naming gaps. |
| [24 Redirect](cd-024-every-file-unit-tested.md) | CD-23 | Not an additional active CD. |
| [25 Fake unit collaborators](cd-025-fake-everything-outside-unit.md) | **V** E restricted I/O imports in identified unit tests, partial | Transitive effects/fake responsibility manual; don't apply unit restrictions blindly to integration. Rin mockImplementation heuristic is not isolation proof. |
| [26 No module mocks](cd-026-no-module-mocking.md) | **V** E vi/jest mock/doMock selector; O vitest/no-restricted-vi-methods | Aliases/computed/other-framework APIs and DI manual. vi.fn passed; Rin directly recognizes vi.mock. |
| [27 Straight-line tests](cd-027-tests-are-zero-everything.md) | **V** E test-only if/ternary/try/switch/loop bans | Helpers/randomness/time/computed assertions manual; Rin syntax/mutator list partial. |
| [28 Assert responsibility](cd-028-assert-only-unit-responsibility.md) | **M** assertion ownership review | Passing tests cannot prove responsibility; no custom binding. |
| [29 Minimum integration](cd-029-integration-is-minimum.md) | **M** composition/risk review | No universal test count or lint mapping; no custom binding. |
| [30 Composition-only integration](cd-030-integration-catches-composition-only.md) | **M** assertion/fixture review | Review unit behavior duplication; no custom binding. |
| [31 No coverage thresholds](cd-031-no-coverage-thresholds.md) | **M** test/CI configuration review | Preserve existing CI until reviewed adoption resolves policy conflict; no tested threshold detector/custom binding. |
| [32 PII redaction](cd-032-pii-redact-by-default.md) | **M** data/log inventory and targeted tests | Value flow/effectiveness manual; no custom binding. |
| [33 Sensitive hard redaction](cd-033-sensitive-brand-hard-redact.md) | **M** branded type/output review | Syntax cannot prove redaction; no custom binding. |
| [34 No secrets](cd-034-secrets-never-in-repo.md) | **R** existing consumer secret scanner | Credentials/false negatives/history manual; no speculative scanner install/custom binding here. |
| [35 Ingress binding cap](cd-035-funnel-binding-cap.md) | **M** deployment/configured budget | Project-configurable, not universal Tailscale/exactly-one browser policy; no custom binding. |
| [36 Service RAM cap](cd-036-per-service-ram-cap.md) | **M** budget/measurement | Project budget, not universal 200MB or lint; no custom binding. |
| [37 Task coverage](cd-037-spec-coverage.md) | **M** task/change traceability | Select artifact obligation without AIDLC stages; no custom binding. |
| [38 Constitution gate](cd-038-constitution-check-gate.md) | **M** explicit receipt/checklist | Lint is not this review; agree reviewer; no custom binding. |
| [39 Cite IDs](cd-039-cite-by-id.md) | **M** review finding format | Agent guidance/review, not lint; no custom binding. |
| [40 Named-object argument](cd-040-single-object-arg.md) | **V** E FunctionDeclaration[params.length>1], weak proxy | Scalar and multi-arg arrows passed. Callback/zero-arg/external applicability needs decision; no custom binding. |
| [41 Orchestrate only](cd-041-orchestrators-only-orchestrate.md) | **V** B complexity/function-length, proxy | Tiny fixture thresholds are not recommended budgets. Small calculation can pass but violate; no custom binding. |
| [42 Unhappy early return](cd-042-unhappy-path-early-return.md) | **V** E no-else-return; B noUselessElse | Else-after-return caught; happy-first body can pass; no custom binding. |
| [43 Evaluative booleans](cd-043-booleans-are-evaluative.md) | **V** E TSBooleanKeyword, unsuitable blanket policy | Rejects legitimate predicates/misses inferred state. State/mode meaning manual; Rin explicit annotations partial. |
| [44 No parameter field mutation](cd-044-no-parameter-field-mutation.md) | **V** E no-param-reassign props:true | Assignment caught, push/sort passed. Typed functional policy broader, below; Rin compound/alias/Map gaps. |
| [45 Zod once](cd-045-zod-once-at-boundary.md) | **M** boundary/internal-flow review | CD-4 pairing does not collapse this ID; no custom binding. |
| [46 Decarve on touch](cd-046-decarve-on-touch.md) | **R** existing decay CLI, sidecar-specific | Whole-file paydown/checker rerun required; not lint-disable/compiler baseline conversion; never exempt itself. |
| [47 Hermetic tests](cd-047-tests-are-hermetic.md) | **V** focused guard tests; **R** consumer CLI integration | Git text guard partial; subsystem qualification/network/HOME/environment/filesystem/time manual. No universal 400-test floor. |

## Using verified clauses

The linter-options page supplies explicit parser/plugin setup and CD-1 probes. Merge only selected rules into that existing eligible source/test block. Preserve existing no-restricted-syntax entries: a later flat-config block can replace their array. Avoid broad presets. Preserve source, tests, test support, TSX and applicable JS coverage; tiny .ts/.test.ts fixtures are not a consumer scope prescription.

Additional syntax clauses were executed with ESLint 10.11.0, typescript-eslint 8.71.2, TypeScript 6.0.3 and Node 22.22.2 on Windows. Append selected selectors with messages to the existing no-restricted-syntax list:
- CD-14: ClassDeclaration and ClassExpression.
- CD-15: ForStatement and ForOfStatement[await=false].
- CD-26: CallExpression[callee.object.name=/^(vi|jest)$/][callee.property.name=/^(mock|doMock)$/], only in the actual test population.
- CD-27: IfStatement, ConditionalExpression, TryStatement, SwitchStatement, ForStatement, ForInStatement, ForOfStatement, WhileStatement, DoWhileStatement, only in selected test files.

Each is a partial clause with the table's gaps. A source-file control passed the test-only policy. For an existing Vitest/oxlint setup, the tested rule is vitest/no-restricted-vi-methods with error severity and options { mock: 'Inject dependencies', doMock: 'Inject dependencies' }, with the Vitest plugin enabled. No preset or dependency injection proof is implied.

For CD-8, a compatible existing typescript-eslint setup needs parserOptions.projectService:true and tsconfigRootDir set to the actual config directory, with the tested files in its tsconfig. The executed rule configuration is:

~~~js
'@typescript-eslint/switch-exhaustiveness-check': ['error', {
  allowDefaultCaseForExhaustiveSwitch: false,
  considerDefaultExhaustiveForUnions: false,
}]
~~~

Closed-union default and missing case failed; exhaustive union without default and open string default passed, in source and tests. Do not exclude tests outside project service to obtain green. Typed oxlint is research only here: current typed-mode documentation requires TS7+ and oxlint-tsgolint. Do not migrate the compiler or assume alpha JS plugins receive type information.

Typed eslint-plugin-functional@10.0.1 was tested as an optional **broader immutability policy**, not a CD-44 drop-in. Default immutable-data catches parameter push/sort/Object.assign/Map.set but rejects permitted fresh local accumulators. ignoreNonConstDeclarations:{treatParametersAsConst:true} permits fresh let accumulators, rejects fresh const ones and misses Object.assign on a parameter. Neither is exact CD-44 coverage.

Other Biome/Unicorn/functional/custom/GritQL mappings remain candidates unless marked V. No all-CD preset is supplied. Prove each selected clause with a deliberate violation, actual command/diagnostic/nonzero exit, correction, then that same command passing. Repeat in the actual test population; retain evidence in the adoption artifact.

## Initial debt and progressive CD-3 adoption

Run agreed checks unchanged first. Initial red is useful inventory evidence, not a reason to preemptively weaken checks or exclude tests. Separate deliberate probes from inherited findings. Record only eligible inherited debt with file/rule/reason/scope/reviewer; initial inventory requires no Five Whys. Authorized structural locations are separate from debt. CD-1 has no exemptions; CD-46 cannot exempt itself. Preserve unrelated debt and policies, and claim new/touched enforcement only where the chosen tool supports it.

TypeScript has no general diagnostic warning/error setting. Linter warning severity can expose a selected clause without failing normal lint (unless the existing command fails on warnings); that is visibility, not enforcement. noEmitOnError controls output, not diagnostic severity. Do not blanket-swallow compiler status with ||true.

A practical progressive path toward CD-3:
1. Preserve required current checks and all intended source/test coverage. Run a visible advisory target-strict check with the same installed compiler and actual project graph; distinguish diagnostic debt from compiler/config/reference failure.
2. Inventory actual findings in the existing adoption record. Promote currently clean flags to the required shared config; choose the next flag from actual debt, not a universal ordering. Promoted flags prevent regression; pending advisory flags can still accumulate debt.
3. Recheck combinations: exactOptionalPropertyTypes requires strictNullChecks. strict:true does not override explicit false strict-family members. Inspect effective options and child overrides. An extends config does not inherit references: preserve the real project graph explicitly.
4. Finish when all seven CD-3 flags are required through shared config, no child overrides weaken them, and ordinary checks pass for every intended project. Remove temporary target configs. Until then report progressive adoption, not full CD-3 compliance.

For example, if the actual remaining diagnostics are only exactOptionalPropertyTypes and noPropertyAccessFromIndexSignature, confirm the other flags are clean for the same population and require them now. For the two pending flags, distinguish truly optional fields from intentional explicit undefined values, and known properties from dictionary keys. Do not mechanically add undefined unions or bracket access everywhere just to silence diagnostics.

Do not add skipLibCheck, weaken flags or exclude tests to obtain green. Preserve and disclose an existing skipLibCheck policy. Linter ignores/Rin sidecars do not suppress tsc diagnostics. A separately clean existing TS project is a bounded option, not a whole-population diagnostic ratchet.

[tsc-baseline 2.1.0](https://github.com/TimMikeladze/tsc-baseline/releases/tag/2.1.0) is a maintained research candidate, **not an execution-tested gate here**. File+diagnostic-code+message counts can ignore line movement and reject new/increased signatures; unmatched-allowance reporting can expose stale entries. Saving must not automatically accept debt in CI. Same-signature substitution in one file can trade unnoticed. Its compiler pipe cannot preserve compiler exit semantics, skips empty input and can ignore global/unparseable diagnostics; pipefail rejects expected accepted debt. A fail-closed integration proof is required separately. Betterer's TS adapter has reference/locationless-diagnostic gaps too. **No-growth across pending strict diagnostics is not delivered by advisory checks**; it needs a separately proven external baseline. No baseline framework is installed.

Primary compiler references: [strict](https://www.typescriptlang.org/tsconfig/strict.html), [extends](https://www.typescriptlang.org/tsconfig/extends.html), [exact optional properties](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-4-4.html#exact-optional-property-types---exactoptionalpropertytypes).

## Existing Rin tools are not a selected-CD CLI

These source-inspected capabilities are not extra installation commands:
- rin-harness-constitution-audit.ts --project-dir <consumer> [--json] has 19 hardcoded check families, no --cd/--rules selector, ordinary 0/1 status. Zero files can pass. It is not an initial carve-out exporter or all-CD proof.
- Per-CD sensors accept --project-dir and optional --file-path/--output-path. Findings/clean/not-evaluated generally exit 0; malformed sidecars can exit 1. Chaining with && is not a failing CI gate. Missing/out-of-scope files can pass.
- rin-harness-carve-out-decay.ts --project-dir <consumer> --base-ref <resolvable-base> [--json] has ordinary 0/1 status. Default HEAD concerns uncommitted changes, not prior branch commits; choose a fetched/resolvable review base. Sensor switches change status semantics. It reads Rin sidecars, not lint disables/config overrides/tsc baselines. Removing an entry alone does not prove whole-file paydown; rerun the governing check/review.
- rin-harness-audit-debt-inventory.ts clusters recorded sidecars; it does not discover or initialize initial debt. No supported initial exporter/importer is installed. Manual sidecar review must enforce eligibility: the generic loader does not protect CD-1 for you. R7/Five Whys is not selected.
- Default scopes principally cover src/scripts/root TS/TSX, not arbitrary apps/packages. Directories/suffixes are pruned. A partial constitution-only harness config may fail required schema; empty arrays may restore defaults. A passing result does not prove scope.
- Full plugin core dependency is distinct from builtin-only source tools. Copying one generated sensor does not prove dependency closure. Hook protocols/mutating format sensors are not standalone lint commands; no automatic dispatch is installed.

## CD-47 optional guard

The source CLI accepts --project-dir <consumer> and optional --minimum-test-files <nonnegative-safe-integer>. Generic default **0**, not 400. Empty clean scan reports NOT APPLICABLE without establishing coverage. Ordinary exit 0=no findings, 1=findings/configured-floor failure, 2=invalid floor arguments. A local floor is a consumer sanity check, not a canonical CD-47 test-count rule.

Use generated tools/rin-harness-hermetic-git-guard.ts only after verifying projection at the selected pin; run Bun with an explicit consumer path. pnpm run audit:hermetic-git in the atomic file describes a script binding, not an automatically added consumer script. Git-call and reason/stale allowance handling remain. Suffixes .test.ts/.tsx/.mjs/.js and .spec.ts/.mjs are recognized; others uncovered. Text matching is not AST proof, and recognized environment names do not prove their contents. A helper does not authorize a real Git spawn: the subsystem's own observable behavior must be the assertion's subject. Setup realism does not qualify. Other side-effect classes remain manual.

## Adoption record

Commit producer pin, selected canonical IDs/files, source/test/support scope, tool versions, exact ordinary command, tested clauses/gaps, reviewed eligible debt, manual-review owner and probe evidence. Fresh chats explicitly read the record and copied artifacts. Updates rebuild a reviewed pin and compare chosen copies/config before repeating probes; removal reviews only trial edits, preserving unrelated tooling. No native discovery, installer ownership, automatic all-CD enforcement or completed compiler-debt ratchet is claimed.
