# CD-6 ESLint piece

This piece enforces CD-6's `naming-convention` clause through ESLint. It is one rule, `naming-convention`, in the plugin `cd6/cd6.eslint-plugin.ts` under the namespace `discipline-cd6`. It reuses typescript-eslint's `naming-convention` with the option list carried in `piece.json`, which sets the allowed case for each kind of name.

`piece.json` names the clause, the namespace, the plugin module, the rule and its `options`. It is the only file core reads to find the rule.

## Adopting the rule

The projection is the only supported way to adopt the rule. Run core's project command for your repository; it writes `disciplines.eslint.mjs` at the repository root, which enables every selected rule and carries your recorded exceptions. Spread its default export last in your flat config. Core's governance run checks that the projection's effect is in force, so enabling the rule some other way is not supported and fails the run as `not-included` once any exception is recorded for it.
