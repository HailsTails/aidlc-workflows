# Adopting discipline core

This page takes a TypeScript repository from nothing to a checked, passing run. Do the steps in order. Every command is run from the root of the repository being checked, which this page calls `<repo>`. Nothing here needs AIDLC or any agent harness. A repository that adopted the disciplines through the older standalone copy route follows [MIGRATING.md](MIGRATING.md), which uses these steps.

Discipline core reads `disciplines.json` in `<repo>`, runs the selected disciplines' checks over every git-tracked file, applies the exceptions in `discipline-exceptions.json`, and prints one report ending in `verdict: pass` or `verdict: fail`.

## 1. Check the prerequisites

```bash
node --version
```

It must print `v22.18.0` or later; Node runs the core's `.ts` files directly. Also needed: git 2.24 or later and npm. `<repo>` must be a git repository, and the files to check must be committed or staged: untracked files are not checked.

## 2. Vendor the core at a pinned commit

Pick a commit of `https://github.com/HailsTails/aidlc-workflows` and write its full SHA down; that SHA is your pin. Copy the core into `<repo>/tools/discipline-core/`. The install must not be under any `node_modules` folder, because Node does not run TypeScript there.

Fetch only `plugins/discipline-core`, with long paths allowed:

```bash
git clone -c core.longpaths=true --filter=blob:none --no-checkout https://github.com/HailsTails/aidlc-workflows.git /tmp/discipline-core-source
```

```bash
git -C /tmp/discipline-core-source sparse-checkout set plugins/discipline-core
```

```bash
git -C /tmp/discipline-core-source checkout <pinned-sha>
```

On Windows, a clone without `-c core.longpaths=true` stops with `Filename too long` and leaves a half checkout that makes the `checkout` fail too; delete `/tmp/discipline-core-source` and clone again with the flag.

Copy `package.json`, `README.md`, `core/`, every rule page, both mechanisms and the review methods, then remove the core's own tests:

```bash
SRC=/tmp/discipline-core-source/plugins/discipline-core
DEST=tools/discipline-core
mkdir -p "$DEST"
cp "$SRC/package.json" "$SRC/README.md" "$DEST/"
cp -r "$SRC/core" "$SRC/rules" "$SRC/mechanisms" "$SRC/methods" "$DEST/"
find "$DEST" -type d \( -name tests -o -name test-fixtures \) -prune -exec rm -rf {} +
find "$DEST" -name '*.test.ts' -delete
```

Copying everything is the simplest install. [README.md](README.md#installing) lists the smaller set a selection strictly needs, if you would rather copy only that.

Install the core's runtime packages inside the install folder, so they resolve from there. Remove the core's own development entries first; npm otherwise tries to resolve its test tooling and can fail:

```bash
cd tools/discipline-core
npm pkg delete devDependencies scripts
npm install --no-audit --no-fund --ignore-scripts
cd -
```

Add `tools/discipline-core/node_modules/` to `<repo>/.gitignore`, and commit `tools/discipline-core/` with a message that names the pinned SHA. To update later, repeat this step with a newer SHA.

## 3. Read what each discipline means

[rules/README.md](rules/README.md) lists every discipline. Each `rules/<ID>/README.md` quotes the rule, says exactly what its check flags, shows a violation and its fix, and says how to record an exception. A discipline's clause addresses are in its README's Clauses table, for example `CD-14#class-syntax`, with the mechanism that checks each clause. A clause whose mechanism is `review` is a judgement clause: it is applied in review, not by a check, with the review lens the page names (step 9).

A check covers only what its page says it flags. Read the whole rule, not only the Clauses table: where a rule asks for more than its check can see, the page says which part is left to review, and the page's review lens covers that part.

Where to start: for an API, boundary validation (CD-4, CD-45), result-shaped failures (CD-9, CD-10, CD-11) and inward dependency direction (CD-12, CD-13) are useful next selections, most of them judgement rules. For React, first select the type and test disciplines that apply to component code; do not apply server ports or process-lifecycle rules to browser code.

## 4. Write disciplines.json

Create `<repo>/disciplines.json`. Map every clause you adopt to the mechanism that checks it, and exclude the vendored core so it is not checked as your code:

```json
{
  "version": 1,
  "ruleSets": {},
  "clauses": {
    "CD-15#loops": "audit",
    "CD-17#clock-sources": "audit",
    "CD-23#export-test-sibling": "audit"
  },
  "exclude": ["tools/discipline-core"]
}
```

- `clauses` keys are clause addresses from the rules pages; the value is a mechanism the clause's rules page lists, `audit` or `eslint`.
- Selecting one clause of a discipline adopts the whole discipline: any of its other mechanical clauses you leave out are reported as `uncovered` and fail the run. CD-3 has seven clauses; select all seven or none.
- A discipline may span mechanisms; adopt every mechanical clause through the mechanism that has it, or the discipline reports the rest uncovered. CD-14, for example, checks `class-syntax` through `audit` or `eslint` but `static-only-class` only through `eslint`, so adopting CD-14 means adopting the ESLint mechanism for at least that clause; see [README.md](README.md#adopting-the-eslint-mechanism). To defer such a clause, still list it with its mechanism and record a `clause-wide-carve-out` for it (step 7).
- `exclude` lists folders or exact files, as repository paths with forward slashes; an entry containing `*` is refused, because globs are not supported. A folder entry excludes everything under it. Use it for generated or third-party code. `node_modules`, `dist`, `build`, `coverage`, `.git` and a top-level `vendor` folder are skipped already.
- `ruleSets` stays `{}` unless you write disciplines of your own; see [docs/adding-a-discipline-or-mechanism.md](docs/adding-a-discipline-or-mechanism.md).

Every clause address the core ships:

```text
audit:
CD-1#any-cast            CD-2#cast-expressions      CD-5#comments-directives
CD-6#identifier-names    CD-7#categorical-paths     CD-7a#factory-return-types
CD-8#switch-defaults     CD-10#throws-in-tests      CD-14#class-syntax
CD-15#loops              CD-17#clock-sources        CD-19#import-boundaries
CD-23#export-test-sibling                           CD-25#dependency-isolation
CD-26#module-mocking     CD-27#test-body-logic      CD-43#boolean-signatures
CD-44#parameter-mutation CD-47#hermetic-git-spawns
CD-3#strict  CD-3#no-unchecked-indexed-access  CD-3#exact-optional-property-types
CD-3#no-implicit-override  CD-3#no-fallthrough-cases-in-switch
CD-3#no-property-access-from-index-signature  CD-3#use-unknown-in-catch-variables

eslint:
CD-1#explicit-any        CD-1#implicit-any-let      CD-6#naming-convention
CD-7#filename-case       CD-10#throw-only-error     CD-14#class-syntax
CD-14#static-only-class  CD-27#focused-tests        CD-27#skipped-tests
CD-40#parameter-count    CD-41#cognitive-complexity CD-41#function-length
CD-42#useless-else       CD-44#parameter-reassignment
```

CD-1, CD-6, CD-7, CD-10, CD-14, CD-27 and CD-44 have clauses under both mechanisms, and CD-40, CD-41 and CD-42 only under `eslint`, so adopting any of them needs the ESLint mechanism.

Starting with a few disciplines and adding more once the run passes is easier than fixing everything at once.

### 4a. Set up ESLint for `eslint` clauses

Skip this if every selected clause is `audit`. Otherwise, after writing `disciplines.json`, write the ESLint projection:

```bash
node tools/discipline-core/core/check/project-command.ts --repo .
```

It prints `disciplines.eslint.mjs written`. Spread its default export last in the repository's flat config. A repository with no ESLint config yet can start from this `eslint.config.mjs`:

```js
import projection from "./disciplines.eslint.mjs";

export default [
  { files: ["**/*.{ts,tsx,mts,cts}"] },
  ...projection,
];
```

Commit both files. Core's check reads this configuration and fails if the projection is missing, not in effect, or out of date, so re-run `project-command` whenever `disciplines.json` or `discipline-exceptions.json` changes. Core's own ESLint run uses the copy installed in step 2, so the repository's own ESLint version does not change the verdict. [README.md](README.md#adopting-the-eslint-mechanism) has the details.

## 5. Run the check

```bash
node tools/discipline-core/core/check/check-command.ts --repo .
```

| Exit code | Meaning |
| --- | --- |
| `0` | `verdict: pass` |
| `1` | `verdict: fail`: the report says why |
| `2` | an input could not be loaded or a check crashed; the output is one line starting `load failure:` or names the failing piece |

A Node stack trace such as `ERR_MODULE_NOT_FOUND ... 'zod'` instead of a report means the packages from step 2 are not installed in `tools/discipline-core/node_modules`.

If the report lists findings under `tools/discipline-core/`, the `exclude` entry from step 4 is missing.

In CI, pass the branch's base so that debt recorded per file is forfeited once that file changes:

```bash
node tools/discipline-core/core/check/check-command.ts --repo . --base-revision origin/main
```

Add the command to the repository's existing validation script, and run that same script in CI and in any pre-push hook the repository already has, so the check runs wherever the other checks run. With `eslint` clauses, the repository's own `eslint` run also reports them in the editor, from the projection.

Tell any coding agent working in the repository, in its project instructions: "Read the rule pages under `tools/discipline-core/rules/` for the disciplines in `disciplines.json` before editing. Before handing off, run the repository's validation command, report its exit code and findings, and apply the judgement rules listed in this file with their review lenses." Copying the rule pages does not make an agent read them; the instruction does.

## 6. Read the report

The report prints only the sections that have entries, each with its count, then the verdict. A finding line is:

```text
<clause> <mechanism> <file>:<line>:<column> <snippet>
CD-15#loops audit src/basket.ts:15:0 for (const line of this.lines) {
```

Lines are 1-based and columns 0-based. The run passes only when every section except `excluded` and `exempted` is empty. The sections are:

| Section | Meaning and what to do |
| --- | --- |
| `excluded` | the `exclude` entries from `disciplines.json` that were left out of the run; informational, check it is what you meant |
| `findings` | violations: fix the code, or record an exception (step 7) |
| `exempted` | findings an exception covers; informational |
| `uncovered` | a mechanical clause of an adopted discipline is not selected: add it to `disciplines.json` |
| `stale` | an exception that no longer exempts anything: delete it |
| `forfeited` | a file carve-out whose file changed since `--base-revision`: fix the file and delete the carve-out |
| `invalidRecords` | an exception entry that cannot be accepted, with the reason: correct it |
| `doublyHeld` | a file both authorised and carved out for one clause: keep one |
| `unmeasured` | something could not be measured, for example `forfeiture-unmeasured` when file carve-outs exist and no `--base-revision` was given |

## 7. Record exceptions

Fix findings where you can. Where a file legitimately needs what a clause forbids, record it in `<repo>/discipline-exceptions.json`:

- `authorised-location`: the clause does not apply to this one file, for example the single adapter that reads the real clock.
- `file-carve-out`: known debt in one file. It is forfeited, and fails the run, as soon as that file changes since `--base-revision`.
- `clause-wide-carve-out`: the clause is waived everywhere. Not selecting the clause is not an alternative: it leaves the clause `uncovered`. A clause-wide carve-out that exempts no finding is `stale`, so record one only while the clause still has findings.

Every entry needs a `reason` and a `whyChain` shaped like this, with exactly five steps in `whys`:

```json
"whyChain": {
  "whys": [
    { "why": "...", "because": "...", "evidence": "..." },
    { "why": "...", "because": "...", "evidence": "..." },
    { "why": "...", "because": "...", "evidence": "..." },
    { "why": "...", "because": "...", "evidence": "..." },
    { "why": "...", "because": "...", "evidence": "..." }
  ],
  "rootCause": "...",
  "owner": "..."
}
```

Answers must be real: placeholders, and a root cause that only says the check was failing or there was no time, are refused as `invalidRecords`. `file` is an exact repository path. A clause whose rule refuses exceptions, CD-1 today, cannot be exempted at all.

Debt or authorisations already recorded by an earlier system, for example the old standalone route's `.constitution-carve-outs/`, can be imported with `provenance` instead of a `whyChain`, as [MIGRATING.md](MIGRATING.md#3-convert-the-old-records-into-exceptions) step 3 shows. Imported entries are checked against `--base-revision`: any entry you write or change yourself needs the full `whyChain`.

## 8. Prove one failure and correction

Before relying on the check, prove that it fails on a real violation in your repository and passes once it is fixed. With CD-17 selected, create `src/discipline-probe.ts` (any path the check covers) containing exactly:

```ts
const probeStartedAt = Date.now();
```

Stage it, since only tracked files are checked, and run the check:

```bash
git add src/discipline-probe.ts
node tools/discipline-core/core/check/check-command.ts --repo .
```

It must exit `1` with the line `CD-17#clock-sources audit src/discipline-probe.ts:1:0 const probeStartedAt = Date.now();` among its findings. Change the same file to `const probeStartedAt = 0;`, stage it, and run the check again: that finding must be gone. Then remove the probe with `git rm -f src/discipline-probe.ts`. A run that never showed the finding proves nothing: check that the file was staged and is not under an `exclude` entry. For another discipline, take a flag case from its `rules/<ID>/discipline.json`.

## 9. Apply the judgement rules

A judgement clause cannot be selected in `disciplines.json`, and no check reports it. Write down which judgement rules the repository adopts, in the project instructions beside `disciplines.json`, so reviewers and agents know to apply them.

Each rule page names its review lens, a method under [methods/lenses/](methods/README.md) for reading code against that kind of rule. To review a change, by a human reviewer or a coding agent:

1. The reviewer is not the change's author. An agent reviewing a change reads files only; it does not edit them.
2. Pin the tree under review to a commit and review that.
3. Run each lens on its own, one concern at a time, without seeing the other lenses' findings. Follow the lens file: load the rule pages that name it, inspect the change as it says, and report findings in its output shape, citing the clause address. A lens covers mechanical rules too, beyond what their checks flag.
4. Run [defended-on-intent](methods/lenses/defended-on-intent.md) last, over the rule text and the other lenses' findings, to catch changes that meet a rule's letter but defeat its intent.
5. Fix each finding. A deliberate departure from a judgement rule is recorded where the review decision is kept, with the same five-step `whyChain` as step 7.

To use an agent, give it the lens file, the rule pages it names, the change and the pinned commit, and ask it to follow the lens exactly. A single reviewer covering every concern at once misses what separate lenses catch.

## 10. Update and remove

To update, repeat step 2 on a branch with a newer pinned SHA, compare the copied rule pages with the old ones, re-run `project-command` if any clause is `eslint`, run the check, and commit with a message naming the new SHA. Rule text can change between pins, so read the changed pages.

To remove, delete `tools/discipline-core/`, `disciplines.json`, `discipline-exceptions.json` and, with `eslint` clauses, `disciplines.eslint.mjs` and its spread in the flat config, and take the check out of the validation script.

## Worked example

In the discipline-core source, [tests/test-fixtures/walkthrough/](tests/test-fixtures/walkthrough/) is a small repository before and after its fix, selecting CD-2, CD-15, CD-17 and CD-23 through the audit, with a `generated/` folder excluded. `tests/walkthrough.integration.test.ts` pins both reports exactly.

Before, `node tools/discipline-core/core/check/check-command.ts --repo .` prints, and exits `1`:

```text
excluded (1)
generated
findings (5)
CD-17#clock-sources audit src/basket.ts:7:0 private openedAt = Date.now();
CD-2#cast-expressions audit src/basket.ts:10:20 entry as Line);   }    total(): string {     let pence = 0;     for (const line …
CD-15#loops audit src/basket.ts:15:0 for (const line of this.lines) {
CD-17#clock-sources audit src/basket.ts:22:0 return Date.now() - this.openedAt;
CD-23#export-test-sibling audit src/utils/format.ts:1:0 missing co-located *.test.ts(x) sibling
verdict: fail
```

The fix replaces the `Basket` class with functions over a readonly `Basket` value, sums with `reduce`, takes the time from an injected `Clock`, types the input instead of casting it, moves `src/utils/format.ts` to `src/format.ts` with a `src/format.test.ts` sibling, and records `src/clock.ts`, the one adapter that reads `Date.now()`, as an authorised location. After, the same command prints, and exits `0`:

```text
excluded (1)
generated
exempted (1)
CD-17#clock-sources audit src/clock.ts:3:0 export const createSystemClock = (): Clock => ({ now: () => Date.now() }); exempted by authorised-location
verdict: pass
```

## Known gaps

- The worked example uses only the audit mechanism. The ESLint consumer in `tests/test-fixtures/consumer-proof/eslint/` is the tested ESLint setup.
- Each check flags exactly what its rules page says and no more. Where a rule asks for more than its check can see, the page says which part is left to review.
- A snippet is the text the check reports; some checks report a fixed-width window that runs across lines, as CD-2 does above.
- The disciplines' IDs and rule text come from one team's code-discipline set. Selecting a subset is supported; editing a shipped rule is not. Write your own rule set for different rules.
