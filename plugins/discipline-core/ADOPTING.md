# Adopting discipline core

This page takes a TypeScript repository from nothing to a checked, passing run. Do the steps in order. Every command is run from the root of the repository being checked, which this page calls `<repo>`. Nothing here needs AIDLC, rin or any agent harness.

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

Copy `package.json`, `core/`, the walker runner, and one rule folder plus one piece folder per discipline you will select (step 4 lists them; copying all of them is fine):

```bash
SRC=/tmp/discipline-core-source/plugins/discipline-core
DEST=tools/discipline-core
mkdir -p "$DEST/mechanisms/walker" "$DEST/rules"
cp "$SRC/package.json" "$DEST/"
cp -r "$SRC/core" "$DEST/"
cp -r "$SRC/mechanisms/walker/runner" "$DEST/mechanisms/walker/"
for ID in CD-1 CD-2 CD-3 CD-5 CD-6 CD-7 CD-7a CD-8 CD-10 CD-14 CD-15 CD-17 CD-19 CD-23 CD-25 CD-26 CD-27 CD-43 CD-44 CD-47; do
  cp -r "$SRC/rules/$ID" "$DEST/rules/"
  cp -r "$SRC/mechanisms/walker/$ID" "$DEST/mechanisms/walker/"
done
find "$DEST" -name '*.test.ts' -delete
```

Install the core's runtime packages inside the install folder, so they resolve from there. Remove the core's own development entries first; npm otherwise tries to resolve its test tooling and can fail:

```bash
cd tools/discipline-core
npm pkg delete devDependencies scripts
npm install --no-audit --no-fund --ignore-scripts
cd -
```

Add `tools/discipline-core/node_modules/` to `<repo>/.gitignore`, and commit `tools/discipline-core/` with a message that names the pinned SHA. To update later, repeat this step with a newer SHA.

## 3. Read what each discipline means

[rules/README.md](rules/README.md) lists every discipline. Each `rules/<ID>/README.md` quotes the rule, says exactly what its check flags, shows a violation and its fix, and says how to record an exception. A discipline's clause addresses are in its README's Clauses table, for example `CD-14#class-syntax`.

## 4. Write disciplines.json

Create `<repo>/disciplines.json`. Map every clause you adopt to the mechanism `walker`, and exclude the vendored core so it is not checked as your code:

```json
{
  "version": 1,
  "ruleSets": {},
  "clauses": {
    "CD-14#class-syntax": "walker",
    "CD-15#loops": "walker",
    "CD-17#clock-sources": "walker"
  },
  "exclude": ["tools/discipline-core"]
}
```

- `clauses` keys are clause addresses from the rules pages; the value is always `walker` for the disciplines listed in step 3.
- Selecting one clause of a discipline adopts the whole discipline: any of its other mechanical clauses you leave out are reported as `uncovered` and fail the run. CD-3 has seven clauses; select all seven or none.
- `exclude` lists folders or exact files, as repository paths with forward slashes; an entry containing `*` is refused, because globs are not supported. A folder entry excludes everything under it. Use it for generated or third-party code. `node_modules`, `dist`, `build`, `coverage`, `.git` and a top-level `vendor` folder are skipped already.
- `ruleSets` stays `{}` unless you write disciplines of your own; see [docs/adding-a-discipline-or-mechanism.md](docs/adding-a-discipline-or-mechanism.md).

Every clause address the core ships:

```text
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
```

Starting with a few disciplines and adding more once the run passes is easier than fixing everything at once.

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

## 6. Read the report

The report prints only the sections that have entries, each with its count, then the verdict. A finding line is:

```text
<clause> <mechanism> <file>:<line>:<column> <snippet>
CD-15#loops walker src/basket.ts:15:0 for (const line of this.lines) {
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
- `clause-wide-carve-out`: the clause is waived everywhere. Prefer not selecting the clause instead.

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

A complete, accepted entry is in [the worked example](tests/test-fixtures/walkthrough/after/discipline-exceptions.json).

## Worked example

[tests/test-fixtures/walkthrough/](tests/test-fixtures/walkthrough/) is a small repository before and after its fix, selecting CD-2, CD-7, CD-14, CD-15, CD-17 and CD-23, with a `generated/` folder excluded. `tests/walkthrough.integration.test.ts` pins both reports exactly.

Before, `node tools/discipline-core/core/check/check-command.ts --repo .` prints, and exits `1`:

```text
excluded (1)
generated
findings (7)
CD-14#class-syntax walker src/basket.ts:5:7 export class Basket {
CD-17#clock-sources walker src/basket.ts:7:0 private openedAt = Date.now();
CD-2#cast-expressions walker src/basket.ts:10:20 entry as Line);   }    total(): string {     let pence = 0;     for (const line …
CD-15#loops walker src/basket.ts:15:0 for (const line of this.lines) {
CD-17#clock-sources walker src/basket.ts:22:0 return Date.now() - this.openedAt;
CD-7#categorical-paths walker src/utils/format.ts:1:0 forbidden categorical folder: utils
CD-23#export-test-sibling walker src/utils/format.ts:1:0 missing co-located *.test.ts(x) sibling
verdict: fail
```

The fix replaces the `Basket` class with functions over a readonly `Basket` value, sums with `reduce`, takes the time from an injected `Clock`, types the input instead of casting it, moves `src/utils/format.ts` to `src/format.ts` with a `src/format.test.ts` sibling, and records `src/clock.ts`, the one adapter that reads `Date.now()`, as an authorised location. After, the same command prints, and exits `0`:

```text
excluded (1)
generated
exempted (1)
CD-17#clock-sources walker src/clock.ts:3:0 export const createSystemClock = (): Clock => ({ now: () => Date.now() }); exempted by authorised-location
verdict: pass
```

## Known gaps

- Only the walker mechanism is covered here. The ESLint mechanism ships for CD-14 only; see [README.md](README.md#adopting-the-eslint-mechanism).
- Each check flags exactly what its rules page says and no more. Where a rule asks for more than its check can see, the page says which part is left to review.
- A snippet is the text the check reports; some checks report a fixed-width window that runs across lines, as CD-2 does above.
- The disciplines' IDs and rule text come from one team's code-discipline set. Selecting a subset is supported; editing a shipped rule is not. Write your own rule set for different rules.
