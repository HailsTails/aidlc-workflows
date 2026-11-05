# CD-10 ESLint piece

This piece enforces CD-10's `throw-only-error` clause through ESLint. It is one rule, `throw-only-error`, in the plugin `cd10/cd10.eslint-plugin.ts` under the namespace `discipline-cd10`. The rule reports a `throw` of a literal, object literal, binary expression, template or `undefined`, and allows `new Error(...)`, identifiers, calls and member access.

`piece.json` names the clause, the namespace, the plugin module and the rule. It is the only file core reads to find the rule.

## Adopting the rule

The projection is the only supported way to adopt the rule. Run core's project command for your repository; it writes `disciplines.eslint.mjs` at the repository root, which enables every selected rule and carries your recorded exceptions. Spread its default export last in your flat config. Core's governance run checks that the projection's effect is in force, so enabling the rule some other way is not supported and fails the run as `not-included` once any exception is recorded for it.
