# CD-40 ESLint piece

This piece enforces CD-40's `parameter-count` clause through ESLint. It is one rule, `max-params`, in the plugin `cd40/cd40.eslint-plugin.ts` under the namespace `discipline-cd40`. It reuses typescript-eslint's `max-params` with the `options` `{ "max": 2, "countVoidThis": true }` carried in `piece.json`, so a function with more than two parameters is reported and a `this` parameter counts.

## Adopting the rule

The projection is the only supported way to adopt the rule. Run core's project command for your repository; it writes `disciplines.eslint.mjs` at the repository root, which enables every selected rule and carries your recorded exceptions. Spread its default export last in your flat config. Core's governance run checks that the projection's effect is in force, so enabling the rule some other way is not supported and fails the run as `not-included` once any exception is recorded for it.
