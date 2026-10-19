# CD-27 ESLint piece

This piece enforces CD-27's `focused-tests` and `skipped-tests` clauses through ESLint, in the plugin `cd27/cd27.eslint-plugin.ts` under the namespace `discipline-cd27`.

- `focused-tests` reports `.only` and the bare `fdescribe`, `fit`, `ftest` and `fsuite`, at the `only` token.
- `skipped-tests` reports `.skip`, `.fixme` and the bare `xdescribe`, `xit`, `xtest` and `xsuite`.

`piece.json` names each clause, the namespace, the plugin module and the rule. It is the only file core reads to find the rules.

## Adopting the rule

The projection is the only supported way to adopt these rules. Run core's project command for your repository; it writes `disciplines.eslint.mjs` at the repository root, which enables every selected rule and carries your recorded exceptions. Spread its default export last in your flat config. Core's governance run checks that the projection's effect is in force, so enabling these rules some other way is not supported and fails the run as `not-included` once any exception is recorded for it.
