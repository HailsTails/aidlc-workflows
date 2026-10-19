# CD-44 ESLint piece

This piece enforces CD-44's `parameter-reassignment` clause through ESLint. It is one rule, `no-param-reassign`, in the plugin `cd44/cd44.eslint-plugin.ts` under the namespace `discipline-cd44`. It reuses ESLint's `no-param-reassign` with the `options` `{ "props": false }` carried in `piece.json`, so it flags reassignment of a parameter itself and leaves its fields to the audit's `parameter-mutation` clause.

## Adopting the rule

The projection is the only supported way to adopt the rule. Run core's project command for your repository; it writes `disciplines.eslint.mjs` at the repository root, which enables every selected rule and carries your recorded exceptions. Spread its default export last in your flat config. Core's governance run checks that the projection's effect is in force, so enabling the rule some other way is not supported and fails the run as `not-included` once any exception is recorded for it.
