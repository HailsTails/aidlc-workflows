# Standalone discipline coverage inventory

Use the [copy guide](standalone-adoption.md) and [minimal linter setup](standalone-linter-options.md). All **45 active CDs** are optional explicit knowledge/review selections; the 48 atomic files include CD-7a and redirects CD-16→15, CD-20→19, CD-24→23. Select the redirect owner. Read each atomic file in full: this map does not replace its rule text.

Execution evidence: **V** = the named mechanism was exercised, never an equivalence verdict; **R** = source/documentation inspected, not an executed consumer gate; **M** = no machine recipe recommended here. B/E/O mean Biome/ESLint/oxlint. V syntax/linter fixtures used .ts/.test.ts unless explicitly stated; CD-1 also has source TSX and Biome/ESLint/oxlint probes, CD-3 has the recorded project/config proof, and CD-5/CD-47 have focused audit/guard tests. These populations do not establish coverage of an adopter's entire source/test/support/TSX/JS graph. Additional CD-27/CD-44 contrasts exercised source .ts, .test.ts, support/helper.ts, .tsx and .js under explicit fixture globs; they recorded extra restrictions and misses, not adopter population coverage. Existing Rin bindings were source-inspected, not installed by copying knowledge.

Semantic suitability is separate: **aligned partial guard** enforces a stated part of the requirement; **review signal only** can prompt review but cannot decide compliance; **manual** needs a named reviewer; **redirect** selects its owner. Known non-equivalent experiments are rejected below regardless of whether they ran. For every selection, record forbidden and permitted controls, missed cases, extra restrictions, actual scanned population and a manual-review owner in the adoption record.

## Complete selection map

| Canonical CD | Execution evidence / mechanism | Semantic suitability | Permitted cases, gaps and manual review |
| --- | --- | --- | --- |
| [1 No any](cd-001-no-any.md) | **V** B noExplicitAny/noImplicitAnyLet; E/O no-explicit-any; compiler noImplicitAny | Aligned partial guard | Semantic propagation remains; no exemptions. Rin regex/visited-node checks are narrower. |
| [2 Closed cast list](cd-002-closed-cast-list.md) | **V** cast-selector/as-const experiment; no portable site authority | Rejected as equivalent; manual | Casting is permitted only at deliberately enumerated, recorded boundary-forced sites. The as-const green fixture creates no portable permission or approved subset. Resolve exact sites/amendments; Rin hardcodes particular Zod/tool types. |
| [3 Strict flags](cd-003-strict-mode-flags.md) | **V** compiler/effective-config review; seven quick-start flags | Aligned partial guard | Review strict constituent overrides, every config/reference and source/test membership. Rin text check does not resolve inheritance/named configs. Progressive path below. |
| [4 Zod boundaries](cd-004-zod-at-boundaries.md) | **M** boundary/schema/result review | Manual | Lint cannot identify all trust boundaries. Another validator is not automatically equivalent; no Rin custom binding. |
| [5 No comments](cd-005-no-comments.md) | **V** Rin tracked linter-directive recognition; **R** broader comment policy | Aligned partial guard | ESLint/Biome/oxlint directives require their own tracker, not exemption authority. Config/file ignores are separate. Rin still does not prove all comments/JSDoc comply. |
| [6 Meaningful names](cd-006-meaningful-names.md) | **R** naming conventions, proxy | Review signal only | Meaning/role needs review; Rin has a short name deny list. |
| [7 Concept filenames](cd-007-no-categorical-filenames.md) | **R** filename/path inventory | Review signal only | Check applicable extensions/paths; Rin exact .ts/path rules are incomplete. |
| [7a No owned ReturnType typeof](cd-007a-no-returntype-typeof.md) | **V** origin-blind type-query selector experiment | Rejected as equivalent; manual | Owned output types must be named/exported. The external exception requires BOTH external provenance and absence of a named return type in that package; external origin alone is insufficient. The tested selector/Rin regex cannot establish either condition. |
| [8 Closed-union switch](cd-008-no-default-on-closed-union.md) | **V** typed E switch-exhaustiveness-check | Aligned partial guard | Project service/included files required; open string default passed. Rin text heuristic has no type proof. |
| [9 Result failures](cd-009-result-shaped-failures.md) | **M** API/call-site review | Manual | Prove expected failures flow as data; no custom binding. |
| [10 Closed throw list](cd-010-throws-closed-list.md) | **V** blanket ThrowStatement experiment; review the two closed contexts | Rejected as equivalent; manual | Startup-invariant failure at boot and a branch unreachable by exhaustive type narrowing are permitted. Defensive throws are not; library throws become results at the boundary; tests have no exemption. A blanket ThrowStatement ban rejects compliant cases. Rin principally checks test throws. |
| [11 Error data](cd-011-error-shapes-are-data.md) | **M** shape/startup review | Manual | Startup Error-class allowance conflicts with CD-14's class ban in that case: resolve explicitly; no custom binding. |
| [12 Storage repositories](cd-012-repositories-as-storage-abstraction.md) | **M** import/abstraction review | Manual | Responsibility is not a generic lint check; no custom binding. |
| [13 Inward layers](cd-013-kernel-layer-boundaries.md) | **R** consumer restricted imports/architecture checks | Review signal only | Configure actual graph, dynamic imports/re-exports; no custom binding. |
| [14 No authored classes](cd-014-no-class-authoring.md) | **V** E ClassDeclaration/ClassExpression ban | Aligned partial guard | External construction passed; wrapper placement manual. Rin line regex misses shapes. |
| [15 Functional transformation](cd-015-no-for-of.md) | **V** blanket loop-ban experiment; review authorized async drains | Rejected as equivalent; manual | Functional sync traversal and void-returning forEach side effects remain distinct. Authorized AsyncIterable drains may use for-await or manual await iterator.next(), including a counted/manual-next loop; review functional bodies and whole-value accumulator replacements. ForStatement bans reject an allowed shape; broad Rin async allowances can also hide forbidden sync loops. |
| [16 Redirect](cd-016-no-counted-for.md) | CD-15 | Redirect | Not an additional active CD. |
| [17 Clock port](cd-017-clock-only-time-source.md) | **V** E restricted Date.now/performance.now and zero-arg new Date | Aligned partial guard | Fixed-input Date passed: clarify atomic interpretation. Other clock APIs/provenance remain; Rin app/script exceptions. |
| [18 SignalSink](cd-018-process-through-signalsink.md) | **V** E restricted process.exit/kill/on/once/hrtime | Aligned partial guard | Destructured exit detected; full process surface/adapter ownership unproved. Inject the lifecycle capability; SignalSink is not a required identifier. No custom binding. |
| [19 Unowned dependency ports](cd-019-third-party-wrapping-factories.md) | **V** E restricted static imports and Node-prefix rule; **R** Rin import audit | Aligned partial guard | Rin detects literal `node:` specifiers in imports, re-exports, `require` and dynamic imports, and 14 exact vendor specifiers in static `from` clauses. Bare builtins require the separate ESLint rule below; computed specifiers, aliases, `process.getBuiltinModule`, other vendors and port ownership remain review work. React/test dependencies have no automatic exemption. |
| [20 Redirect](cd-020-node-stdlib-through-ports.md) | CD-19 | Redirect | Not an additional active CD. |
| [21 Default factory](cd-021-ports-ship-default-factory.md) | **M** port/factory inventory | Manual | Verify shipped implementation/overrides; no custom binding. |
| [22 Middleware context](cd-022-middleware-context-constraint.md) | **M** shape/capability review | Manual | Consumer architecture matters; no custom binding. |
| [23 Co-located unit tests](cd-023-tests-co-located.md) | **R** sibling/path inventory | Review signal only | Presence is not substantive coverage. Rin .test.ts/.tsx check has exemptions/naming gaps. |
| [24 Redirect](cd-024-every-file-unit-tested.md) | CD-23 | Redirect | Not an additional active CD. |
| [25 Fake unit collaborators](cd-025-fake-everything-outside-unit.md) | **V** E restricted I/O imports in identified unit tests, partial | Review signal only | Transitive effects/fake responsibility manual; don't apply unit restrictions blindly to integration. Rin mockImplementation heuristic is not isolation proof. |
| [26 No module mocks](cd-026-no-module-mocking.md) | **V** E vi/jest mock/doMock selector; O vitest/no-restricted-vi-methods | Aligned partial guard | Aliases/computed/other-framework APIs and DI manual. vi.fn passed; Rin directly recognizes vi.mock. |
| [27 Straight-line tests](cd-027-tests-are-zero-everything.md) | **V** whole-test-file selector experiment | Rejected as equivalent; manual | Canonical scope is straight-line test bodies. File-wide bans additionally inspect suite setup/builders/fakes, yet equivalent separate helpers escape; that is not equivalent. Helpers have no automatic exemption: review hidden logic, computed expectations and pinned variability. Contrast probes found both extra helper scope and missed computed expectations. Rin syntax/mutator list is partial. |
| [28 Assert responsibility](cd-028-assert-only-unit-responsibility.md) | **M** assertion ownership review | Manual | Passing tests cannot prove responsibility; no custom binding. |
| [29 Minimum integration](cd-029-integration-is-minimum.md) | **M** composition/risk review | Manual | No universal test count or lint mapping; no custom binding. |
| [30 Composition-only integration](cd-030-integration-catches-composition-only.md) | **M** assertion/fixture review | Manual | Review unit behavior duplication; no custom binding. |
| [31 No coverage thresholds](cd-031-no-coverage-thresholds.md) | **M** test/CI configuration review | Manual | Preserve existing CI until reviewed adoption resolves policy conflict; no tested threshold detector/custom binding. |
| [32 PII redaction](cd-032-pii-redact-by-default.md) | **M** data/log inventory and targeted tests | Manual | Value flow/effectiveness manual; no custom binding. |
| [33 Sensitive hard redaction](cd-033-sensitive-brand-hard-redact.md) | **M** branded type/output review | Manual | Syntax cannot prove redaction; no custom binding. |
| [34 No secrets](cd-034-secrets-never-in-repo.md) | **R** existing consumer secret scanner | Review signal only | Scanner absence is not proof. Secrets belong only in environment/secrets-manager ownership, never source/history, logs or URL query parameters. Review all surfaces and false negatives; no speculative install/custom binding here. |
| [35 Ingress binding cap](cd-035-funnel-binding-cap.md) | **M** deployment/configured budget | Manual | Project-configurable, not universal Tailscale/exactly-one browser policy; no custom binding. |
| [36 Service RAM cap](cd-036-per-service-ram-cap.md) | **M** budget/measurement | Manual | Hard explicit steady-state project budget and bounded-memory design, with recorded justified exceptions; not universal 200MB or lint. No custom binding. |
| [37 Task coverage](cd-037-spec-coverage.md) | **M** task/change traceability | Manual | Trace every change to the active task list without AIDLC stages. Latitude is only pure typo/format touches in already-covered files; no custom binding. |
| [38 Constitution gate](cd-038-constitution-check-gate.md) | **M** explicit pre-work plan gate/signoff | Manual | Before work begins, confirm the design needs no violation. A necessary violation records the rejected simpler alternative and earns explicit signoff. Lint is not this gate; no custom binding. |
| [39 Cite IDs](cd-039-cite-by-id.md) | **M** review finding format | Manual | Cite specific rule IDs and principle references in reviews/rationale; agent guidance, not lint. No custom binding. |
| [40 Named-object argument](cd-040-single-object-arg.md) | **V** multi-parameter-declaration signal experiment | Review signal only | Arity does not enforce named fields: scalar arguments pass; the declaration selector misses arrows/methods. Review declarations/expressions/arrows/methods, aliases/object shapes and call-site labels. Callback/zero-argument/external API handling is unresolved, not a canonical blanket exemption. |
| [41 Orchestrate only](cd-041-orchestrators-only-orchestrate.md) | **V** complexity/length experiments; coordination review required | Rejected as equivalent; manual | Frontmatter names complexity/length bindings, but prose requires coordination-only bodies. Those thresholds are rejected as equivalent CD-41 checks: small computation can pass and pure coordination can exceed them. This is a binding/intent mismatch, not permission to redefine orchestration; no custom binding. |
| [42 Unhappy early return](cd-042-unhappy-path-early-return.md) | **V** E no-else-return; B noUselessElse | Aligned partial guard | Else-after-return caught; happy-first body can pass; no custom binding. |
| [43 Evaluative booleans](cd-043-booleans-are-evaluative.md) | **V** boolean-annotation selector experiment | Rejected as equivalent; manual | A blanket TSBooleanKeyword ban is rejected as equivalent: annotations do not identify state/mode meaning and inferred booleans escape it. The prose criticizes boolean parameters/fields/returns and prefers meaningful unions; predicate applicability is unresolved, not a settled canonical exception. Rin explicit annotations are partial. |
| [44 No parameter field mutation](cd-044-no-parameter-field-mutation.md) | **V** E no-param-reassign props:true detects input property/index writes | Aligned partial guard; extra restriction | Also rejects parameter rebinding beyond CD-44. Input push/sort, aliases and callee effects can escape. Fresh local data is not categorically forbidden; a shallow copy does not make shared nested children fresh. Broader immutability is a separate policy; Rin compound/alias/Map gaps remain. |
| [45 Zod once](cd-045-zod-once-at-boundary.md) | **M** boundary/internal-flow review | Manual | Exactly once per crossing: map to a plain domain shape, no deep reparsing or inward validator types. CD-4 pairing does not collapse this ID; no custom binding. |
| [46 Decarve on touch](cd-046-decarve-on-touch.md) | **R** existing decay CLI, sidecar-specific | Review signal only | Whole-file paydown/checker rerun required; not lint-disable/compiler baseline conversion; never exempt itself. |
| [47 Hermetic tests](cd-047-tests-are-hermetic.md) | **V** focused guard tests; **R** consumer CLI integration | Aligned partial guard | Git text guard partial; subsystem qualification/network/HOME/environment/filesystem/time manual. No universal 400-test floor. |

## Using verified clauses

The linter-options page supplies explicit parser/plugin setup and CD-1 probes. Merge only selected rules into that existing eligible source/test block. Preserve existing no-restricted-syntax entries: a later flat-config block can replace their array. Avoid broad presets. Preserve source, tests, test support, TSX and applicable JS coverage; tiny .ts/.test.ts fixtures are not a consumer scope prescription.

Additional syntax clauses were executed with ESLint 10.11.0, typescript-eslint 8.71.2, TypeScript 6.0.3 and Node 22.22.2 on Windows. Append selected selectors with messages to the existing no-restricted-syntax list:
- CD-14: ClassDeclaration and ClassExpression.
- CD-26: CallExpression[callee.object.name=/^(vi|jest)$/][callee.property.name=/^(mock|doMock)$/], only in the actual test population.

Each is a partial clause with the table's gaps. A source-file control passed the test-only policy. For an existing Vitest/oxlint setup, the tested rule is vitest/no-restricted-vi-methods with error severity and options { mock: 'Inject dependencies', doMock: 'Inject dependencies' }, with the Vitest plugin enabled. No preset or dependency injection proof is implied.

For CD-8, a compatible existing typescript-eslint setup needs parserOptions.projectService:true and tsconfigRootDir set to the actual config directory, with the tested files in its tsconfig. The executed rule configuration is:

~~~js
'@typescript-eslint/switch-exhaustiveness-check': ['error', {
  allowDefaultCaseForExhaustiveSwitch: false,
  considerDefaultExhaustiveForUnions: false,
}]
~~~

Closed-union default and missing case failed; exhaustive union without default and open string default passed, in source and tests. Do not exclude tests outside project service to obtain green. Typed oxlint is research only here: current typed-mode documentation requires TS7+ and oxlint-tsgolint. Do not migrate the compiler or assume alpha JS plugins receive type information.

### CD-19: make Node builtin imports explicit

The Rin CD-19 sensor selects both CD-19 vendor findings and the CD-20 stdlib
redirect. Its source audit recognizes literal `node:` specifiers in static and
side-effect imports, type imports and import-type queries, re-exports, TypeScript `import = require`,
`require()` and dynamic `import()` in the configured TS/TSX source, script and
test population. It does not rewrite bare imports such as `from "fs"` or
`require("child_process")`. If you select this partial guard, add the maintained
[`n/prefer-node-protocol` rule](https://github.com/eslint-community/eslint-plugin-n/blob/master/docs/rules/prefer-node-protocol.md)
to the consumer's existing ESLint run so those literal Node builtins must carry
`node:`. The rule is not enabled merely by copying the discipline or by ESLint's
default configuration.

The verified isolated setup used ESLint 10.11.0, `eslint-plugin-n` 18.4.1,
`typescript-eslint` 8.71.2, TypeScript 6.0.3 and Node 22.22.2. For an existing
compatible ESLint setup, add the plugin with your consumer's package manager,
preserving its lockfile and scripts. For a Bun-managed consumer only:

```bash
bun add --dev --exact eslint-plugin-n@18.4.1 --ignore-scripts
```

Merge the plugin and rule into the **existing** flat-config block for the
selected TS/TSX source, script and test files. This self-contained block is an
example for a new compatible ESLint config; change the globs to your actual
population and keep an existing config's other plugins, parser, rules and
ignores:

~~~js
import n from 'eslint-plugin-n';
import tseslint from 'typescript-eslint';
export default [{
  files: ['src/**/*.{ts,tsx}', 'scripts/**/*.{ts,tsx}', 'tests/**/*.{ts,tsx}'],
  languageOptions: { parser: tseslint.parser },
  plugins: { n },
  rules: { 'n/prefer-node-protocol': 'error' },
}];
~~~

Keep the configured Node target truthful; the rule can skip a target range that
predates `node:` support. Its prefix fix preserves the import's shape and layout;
it does not force every module use into a static `from` clause. The executed
three-file probe reported errors for `from "fs"`, `require("child_process")` and
`import("worker_threads")` in source, scripts and tests, then passed with
`node:fs`, `node:child_process` and `node:worker_threads` using the same command.

Rin's detector still cannot prove one approved wrapping port, confined vendor
types or an absence of computed/aliased module loading. Its third-party check
lists only 14 exact static `from` specifiers; side-effect, dynamic and `require`
forms of those packages are not covered. `process.getBuiltinModule` is checked
by the ESLint prefix rule but not the Rin audit. Review those gaps, actual lint
file coverage, authorized wrapping locations and pre-existing debt explicitly.
Do not ban legitimate import forms merely to make a line scan appear complete.

## Tested approaches rejected as CD enforcement

The following experiments are negative evidence, not selections to merge into consumer lint:
- **CD-2:** the as-const green fixture shows the experimental selector's behavior, not approval of that cast shape. A boundary must genuinely force each cast site, and the closed register/amendment must authorize it.
- **CD-7a:** an origin-blind ReturnType/typeof selector rejects the external case even when the package exports no named return type. A selector's syntax detection is not origin or package-export verification; no default recipe is recommended.
- **CD-27:** file-wide control-flow bans are not scoped to test bodies. They can reject setup/builders/fakes in the test file while missing identical code in another helper. No such recipe is recommended as CD-27 enforcement. A separately adopted whole-file convention would be a stronger consumer policy; helpers still need semantic review rather than an automatic exemption.
- **CD-10:** a global ThrowStatement ban rejects both permitted boot-invariant failures and exhaustive-unreachable branches. This inventory recommends review of the closed contexts rather than that ban.
- **CD-15:** a ForStatement ban rejects a compliant manual await iterator.next() AsyncIterable drain at an authorized location. Six source/test controls for canonical boot-invariant, exhaustive-unreachable and authorized manual-next drain shapes reproduced the rejected proxies' false positives; the three source shapes also passed strict TypeScript compilation. The previous for-await green probe did not establish that every authorized drain shape passed. No blanket loop-ban recipe is recommended here.
- **CD-40:** maximum arity does not require a named-field object. The scalar-argument and arrow counterexamples show why it cannot enforce the contract.
- **CD-41:** frontmatter names cognitive complexity/function length, while prose requires orchestration-only bodies. These bindings do not identify responsibility: small computation can pass and lengthy pure coordination can fail. Record that mismatch; select a separate size budget only as a different consumer policy.
- **CD-43:** TSBooleanKeyword bans are non-equivalent: they classify annotations rather than state/mode meaning and miss inferred booleans. The canonical prose does not enumerate a predicate exception; resolve applicability explicitly instead of inventing one. Naming prefixes alone do not establish semantics.
- **CD-44:** typed eslint-plugin-functional@10.0.1 immutable-data is broader than input-field mutation. Default settings reject permitted fresh local accumulators; ignoreNonConstDeclarations:{treatParametersAsConst:true} still rejects fresh const accumulators and misses Object.assign on a parameter. These are counterexamples to equivalence, not an optional CD-44 recipe. Choosing general immutability would be a separate policy.

For CD-44, retain the field-only boundary: assignment to an input object's properties/indices is prohibited and detected by no-param-reassign props:true. That rule also rejects parameter-identifier rebinding, an additional restriction beyond CD-44. Its failure to detect input push/sort does not make those operations allowed. Fresh local mutation is outside this input-field prohibition, but nested children shared through a shallow copy remain caller-owned. Select the lint rule only with its additional restriction explicitly recorded; general immutable-data remains a separate policy, not CD-44 enforcement.


Untested Biome/Unicorn/functional/custom/GritQL mappings remain research only. Rejected approaches above are not candidates merely because their fixture behavior was measured. No all-CD preset is supplied. Prove each selected clause with a deliberate violation, actual command/diagnostic/nonzero exit, correction, then that same command passing. Repeat in the actual test population; retain evidence in the adoption artifact.

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
- Default scopes principally cover src/scripts/test/tests/root TS/TSX, not arbitrary apps/packages. Directories/suffixes are pruned. A partial constitution-only harness config may fail required schema; empty arrays may restore defaults. A passing result does not prove scope.
- Full plugin core dependency is distinct from builtin-only source tools. Copying one generated sensor does not prove dependency closure. Hook protocols/mutating format sensors are not standalone lint commands; no automatic dispatch is installed.

## CD-47 optional guard

The source CLI accepts --project-dir <consumer> and optional --minimum-test-files <nonnegative-safe-integer>. Generic default **0**, not 400. Empty clean scan reports NOT APPLICABLE without establishing coverage. Ordinary exit 0=no findings, 1=findings/configured-floor failure, 2=invalid floor arguments. A local floor is a consumer sanity check, not a canonical CD-47 test-count rule.

Use generated tools/rin-harness-hermetic-git-guard.ts only after verifying projection at the selected pin; run Bun with an explicit consumer path. pnpm run audit:hermetic-git in the atomic file describes a script binding, not an automatically added consumer script. Git-call and reason/stale allowance handling remain. Suffixes .test.ts/.tsx/.mjs/.js and .spec.ts/.mjs are recognized; others uncovered. Text matching is not AST proof, and recognized environment names do not prove their contents. A helper does not authorize a real Git spawn: the subsystem's own observable behavior must be the assertion's subject. Setup realism does not qualify. Other side-effect classes remain manual.

## Adoption record

Commit producer pin, selected canonical IDs/files, source/test/support scope, tool versions, exact ordinary command, tested clauses/gaps, reviewed eligible debt, manual-review owner and probe evidence. Fresh chats explicitly read the record and copied artifacts. Updates rebuild a reviewed pin and compare chosen copies/config before repeating probes; removal reviews only trial edits, preserving unrelated tooling. No native discovery, installer ownership, automatic all-CD enforcement or completed compiler-debt ratchet is claimed.
