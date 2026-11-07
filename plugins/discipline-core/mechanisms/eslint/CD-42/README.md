# CD-42 ESLint piece

This piece enforces CD-42's `useless-else` clause through ESLint. It is one rule, `useless-else`, in the plugin `cd42/cd42.eslint-plugin.ts` under the namespace `discipline-cd42`. The rule reports an `else` that follows an `if` branch which always exits, at the `else` keyword.

`piece.json` names the clause, the namespace, the plugin module and the rule. It is the only file core reads to find the rule.

## Adopting the rule

The projection is the only supported way to adopt the rule. Run core's project command for your repository; it writes `disciplines.eslint.mjs` at the repository root, which enables every selected rule and carries your recorded exceptions. Spread its default export last in your flat config. Core's governance run checks that the projection's effect is in force, so enabling the rule some other way is not supported and fails the run as `not-included` once any exception is recorded for it.
