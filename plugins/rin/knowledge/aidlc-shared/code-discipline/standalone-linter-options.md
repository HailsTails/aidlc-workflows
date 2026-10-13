# Small ESLint and oxlint alternatives for the standalone trial

Use your existing linter first. These alternatives cover only explicit `any` for
CD-1; they do not replace CD-3's compiler checks or prove full CD-1 compliance.
Keep the consumer's package manager, lockfile, validation script, CI and existing
Lefthook pre-push command. Do not install a second linter or migrate versions just
to match an example. Return to the [standalone guide](standalone-adoption.md) for
packaging/copying and the seven compiler flags.

Preserve the agreed source **and test** population. Never exclude test files,
weaken a rule or shrink configured coverage just to get green checks. Inventory
existing findings and deliberate exclusions before changing them; an excluded
probe is uncovered, not a successful check. Do not overwrite intentional exclusions
without assessing their purpose and agreeing the scope. Initial inventory needs
no Five Whys; CD-1 still permits no exemptions within the selected population.
This does not authorize fixing every legacy defect or adopting a blanket baseline.

## ESLint: existing configuration first

In the existing TS/TSX block, enable
`"@typescript-eslint/no-explicit-any": "error"`. Keep its TypeScript parser,
plugin registration, other rules and ignores. A rule name without the TS parser
is not a working TypeScript setup. Include co-located tests and any separate test
roots in the actual lint population.

The minimal fresh flat-config example below was tested with ESLint **10.11.0**,
`typescript-eslint` **8.71.2**, TypeScript **6.0.3** and Node **22.22.2**.
The selected parser supports TypeScript `>=4.8.4 <6.1.0`; ESLint 10.11.0 needs
Node `^20.19.0 || ^22.13.0 || >=24`. Use compatible existing versions rather than
upgrading the consumer's compiler. Legacy ESLint configuration migration and
TypeScript 7 are outside this recipe.

Only for a new Bun-managed setup with compatible TypeScript already installed:

```bash
bun add --dev --exact eslint@10.11.0 typescript-eslint@8.71.2 --ignore-scripts
```

New `eslint.config.mjs` (do not replace an existing config with this):

```javascript
import tseslint from 'typescript-eslint';
export default [{
  files: ['apps/**/*.ts', 'apps/**/*.tsx', 'packages/**/*.ts', 'packages/**/*.tsx'],
  languageOptions: { parser: tseslint.parser },
  plugins: { '@typescript-eslint': tseslint.plugin },
  rules: { '@typescript-eslint/no-explicit-any': 'error' }
}];
```

If no lint script exists, add `"lint": "eslint apps packages"`; otherwise preserve
its invocation. Adjust both globs and command arguments to the actual source/test
roots. ESLint refuses nonexistent or empty requested paths, so inventory paths
before copying the example. No recommended preset or typed-linting service is
needed for this one rule. The parser/plugin wiring follows the
[official flat-config setup](https://typescript-eslint.io/getting-started/).

## oxlint: existing configuration first

Enable `"typescript/no-explicit-any": "error"` in the existing configuration and
include the `typescript` plugin without removing the other plugins. Preserve
other categories, rules, ignores, validation commands and test roots. The
`plugins` array replaces the default set, so do not paste the entire fresh config
over a consumer's existing one.

The fresh example was tested with oxlint **1.87.0**, Node **22.22.2** and the same
TypeScript **6.0.3** compiler checks. This syntax-only rule uses no type-aware mode,
TS 7 upgrade, JS plugin or additional rule preset. The package supports Node
`^20.19.0 || >=22.12.0`.

Only for a new Bun-managed setup:

```bash
bun add --dev --exact oxlint@1.87.0 --ignore-scripts
```

New `.oxlintrc.json`:

```json
{
  "plugins": ["typescript"],
  "categories": { "correctness": "off" },
  "rules": { "typescript/no-explicit-any": "error" }
}
```

If no lint script exists, add `"lint": "oxlint apps packages"`; otherwise preserve
its invocation. The fresh example disables the default correctness category to
isolate one rule; **do not disable existing consumer categories**. These options
follow the [official configuration reference](https://oxc.rs/docs/guide/usage/linter/config).
No formatting, write or auto-fix command is used.

## Prove the selected population, not just a green exit

Use the standalone guide's `any` → `unknown` probe in a previously nonexistent
source `.ts` file. Run the existing lint script, retain its failing diagnostic,
correct the same file without suppression, and run it again. Repeat in an unused
`.test.ts` file inside the intended test population. Include `.tsx` and other
selected test roots in your coverage review; do not omit them after findings.

| Engine | Expected explicit-any diagnostic | Observed exits before/after correction |
| --- | --- | --- |
| ESLint 10.11.0 | `@typescript-eslint/no-explicit-any`: Unexpected any. Specify a different type | 1 → 0 |
| oxlint 1.87.0 | `typescript(no-explicit-any)`: Unexpected `any`. Specify a different type. | 1 → 0 |

Both recipes were executed in tiny isolated fixtures using Git Bash 5.3.9 on
Windows, Bun 1.3.14 and the versions above. Source `.ts`, `.tsx` and `.test.ts`
negatives each failed with the selected rule; their `unknown` corrections passed.
An unselected class declaration passed, confirming no accidental CD-14 baseline.
An untyped parameter passed both linters but failed `tsc --noEmit` with **TS7006**;
annotating it `unknown` made compilation pass. All seven effective compiler flags
were true. This compiler control does not detect future flag weakening: keep
CD-3's configuration inheritance review and effective-flag inspection.

These checks do not cover every semantic/inferred `any`, Biome's whole rule pair,
CD-3 governance or CD-46. The broader research presets were not adopted or executed.
No actual CI/Lefthook execution, native rule loading, continuous sensors or macOS/
Linux execution is claimed. Reuse the adopter's existing validation command in
agent instructions, CI and existing pre-push configuration, and report manual gaps.

For selected CD-5, read [machine-directive coverage](cd-005-no-comments.md#machine-directives-and-suppression-coverage): ESLint/Biome/oxlint suppression comments need their own tracker and eligible underlying exception. Tracker syntax does not authorize CD-1 exemptions. Native unused-suppression reporting and file/config ignore review remain separate; copying knowledge activates neither.
