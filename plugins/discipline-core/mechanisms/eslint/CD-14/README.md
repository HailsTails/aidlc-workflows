# CD-14 ESLint piece

This piece enforces CD-14's `class-syntax` clause through ESLint. It is one ESLint rule, `no-class-authoring`, in the plugin `cd14/cd14.eslint-plugin.ts` under the namespace `discipline`. The rule reports every class declaration and class expression that is not ambient, at its `class` keyword, so it flags the same lines as the audit piece for CD-14. A class with a `declare` modifier, a class inside a `declare` module, namespace or `global` block, and any class in a declaration file are allowed.

`piece.json` names the clause, the namespace, the plugin module and the rule. It is the only file core reads to find the rule.

## Adopting the rule

The projection is the only supported way to adopt this rule. Run core's project command for your repository; it writes `disciplines.eslint.mjs` at the repository root, which enables every selected rule and carries your recorded exceptions. Spread its default export last in your flat config. Core's governance run checks that the projection's effect is in force, so enabling the rule some other way is not supported and fails the run as `not-included` once any exception is recorded for it.
