# CD-14 ESLint piece

This piece enforces CD-14's `class-syntax` and `static-only-class` clauses through ESLint, in the plugin `cd14/cd14.eslint-plugin.ts` under the namespace `discipline`. `class-syntax` is the rule `no-class-authoring`. It reports every class declaration and class expression that is not ambient, at its `class` keyword, so it flags the same lines as the audit piece for CD-14. A class with a `declare` modifier, a class inside a `declare` module, namespace or `global` block, and any class in a declaration file are allowed.

`static-only-class` is the rule `no-extraneous-class`, which re-exports typescript-eslint's rule with `allowConstructorOnly`, `allowEmpty` and `allowWithDecorator` true and `allowStaticOnly` false. It reports a class whose members are all static.

`piece.json` names each clause, the namespace, the plugin module, the rule and any `options`. It is the only file core reads to find the rules.

## Adopting the rule

The projection is the only supported way to adopt this rule. Run core's project command for your repository; it writes `disciplines.eslint.mjs` at the repository root, which enables every selected rule and carries your recorded exceptions. Spread its default export last in your flat config. Core's governance run checks that the projection's effect is in force, so enabling the rule some other way is not supported and fails the run as `not-included` once any exception is recorded for it.
