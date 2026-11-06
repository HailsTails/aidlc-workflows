# CD-41 ESLint piece

This piece enforces CD-41's `cognitive-complexity` and `function-length` clauses through ESLint, in the plugin `cd41/cd41.eslint-plugin.ts` under the namespace `discipline-cd41`.

- `cognitive-complexity` reports a function whose cognitive complexity is above 15, at the function's name.
- `function-length` reports a function whose body spans more than 50 lines, at the function.

`piece.json` names each clause, the namespace, the plugin module and the rule. It is the only file core reads to find the rules.

## Adopting the rule

The projection is the only supported way to adopt these rules. Run core's project command for your repository; it writes `disciplines.eslint.mjs` at the repository root, which enables every selected rule and carries your recorded exceptions. Spread its default export last in your flat config. Core's governance run checks that the projection's effect is in force, so enabling these rules some other way is not supported and fails the run as `not-included` once any exception is recorded for it.
